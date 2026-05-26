const fs = require('fs');
const path = require('path');
const { MessageMedia } = require('whatsapp-web.js');
const logger = require('./logger');
const config = require('./config');
const { getDatabase } = require('./database');
const gerenciadorListas = require('./gerenciadorListas');
const { updateCampaignStatus, getCampaignStatus } = require('./status');
const { ensureDirectoryExists } = require('./utils');

let cancelRequested = false;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomDelay(min, max) {
  const minValue = Math.max(1000, Number(min) || 10000);
  const maxValue = Math.max(minValue, Number(max) || 25000);
  return Math.floor(Math.random() * (maxValue - minValue + 1)) + minValue;
}

function getHistoricoPath() {
  ensureDirectoryExists(config.paths.dataDir);
  return path.join(config.paths.dataDir, 'campanhas_historico.json');
}

function lerHistoricoCampanhas() {
  const filePath = getHistoricoPath();

  if (!fs.existsSync(filePath)) {
    return [];
  }

  try {
    const historico = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return Array.isArray(historico) ? historico : [];
  } catch (error) {
    logger.warn('Nao foi possivel ler historico de campanhas:', error.message);
    return [];
  }
}

function salvarHistoricoCampanhas(historico) {
  fs.writeFileSync(getHistoricoPath(), `${JSON.stringify(historico.slice(0, 50), null, 2)}\n`, 'utf8');
}

function registrarHistoricoCampanha() {
  const campanha = getCampaignStatus();

  if (!campanha.id) {
    return;
  }

  const historico = lerHistoricoCampanhas().filter((item) => item.id !== campanha.id);
  historico.unshift({
    id: campanha.id,
    alvo: campanha.alvo,
    status: campanha.status,
    total: campanha.total,
    enviados: campanha.enviados,
    falhas: campanha.falhas,
    ignorados: campanha.ignorados,
    iniciadaEm: campanha.iniciadaEm,
    finalizadaEm: campanha.finalizadaEm,
    mensagem: campanha.mensagem,
    erro: campanha.erro
  });
  salvarHistoricoCampanhas(historico);
}

function normalizarTelefone(telefone) {
  let numero = String(telefone || '').replace(/\D/g, '');

  if ((numero.length === 10 || numero.length === 11) && !numero.startsWith('55')) {
    numero = `55${numero}`;
  }

  return numero;
}

function gerarTentativasTelefone(numero) {
  const tentativas = [];

  function add(value) {
    const normalizado = normalizarTelefone(value);

    if (normalizado.length >= 10 && !tentativas.includes(normalizado)) {
      tentativas.push(normalizado);
    }
  }

  add(numero);

  if (numero.length === 13 && numero.startsWith('55')) {
    add(numero.substring(0, 4) + numero.substring(5));
  }

  if (numero.length === 12 && numero.startsWith('55')) {
    add(numero.substring(0, 4) + '9' + numero.substring(4));
  }

  return tentativas;
}

function obterNumerosTeste() {
  return config.telefonesPermitidos || [];
}

function obterTodosClientes() {
  try {
    return getDatabase()
      .prepare("SELECT telefone FROM clientes WHERE telefone IS NOT NULL AND telefone != ''")
      .all()
      .map((cliente) => cliente.telefone);
  } catch (error) {
    logger.error('Erro ao buscar clientes para campanha:', error);
    return [];
  }
}

function dedupeTelefones(telefones) {
  const vistos = new Set();
  const normalizados = [];

  for (const telefone of telefones || []) {
    const numero = normalizarTelefone(telefone);
    const chave = gerenciadorListas.gerarTelefoneWhatsappProvavel(numero);

    if (numero.length < 10 || vistos.has(chave)) {
      continue;
    }

    vistos.add(chave);
    normalizados.push(numero);
  }

  return normalizados;
}

function obterTelefonesPorAlvo(payload) {
  const alvo = payload.alvo || 'teste';

  if (alvo === 'teste') {
    return dedupeTelefones(obterNumerosTeste());
  }

  if (alvo === 'personalizado') {
    return dedupeTelefones(payload.numerosPersonalizados || []);
  }

  if (alvo === 'lista_salva') {
    const lista = gerenciadorListas.obterListaPorNome(payload.nomeLista);
    return dedupeTelefones(lista ? lista.contatos.map((contato) => contato.telefone) : []);
  }

  if (alvo === 'todos') {
    return dedupeTelefones(obterTodosClientes());
  }

  return [];
}

function prepararMedia(imagemBase64) {
  if (!imagemBase64) {
    return null;
  }

  const match = String(imagemBase64).match(/^data:([A-Za-z0-9/+.-]+);base64,(.+)$/);

  if (!match) {
    throw new Error('Imagem em formato invalido.');
  }

  return new MessageMedia(match[1], match[2], 'campanha');
}

async function obterContactId(client, numero) {
  const tentativas = gerarTentativasTelefone(numero);

  for (const tentativa of tentativas) {
    const contactId = await client.getNumberId(tentativa);

    if (contactId) {
      return contactId;
    }
  }

  return null;
}

function iniciarStatus(payload, telefones) {
  updateCampaignStatus({
    ativa: true,
    cancelando: false,
    status: 'rodando',
    id: `${Date.now()}`,
    alvo: payload.alvo || 'teste',
    total: telefones.length,
    enviados: 0,
    falhas: 0,
    ignorados: 0,
    atual: 0,
    numeroAtual: null,
    iniciadaEm: new Date().toISOString(),
    finalizadaEm: null,
    mensagem: 'Campanha iniciada.',
    erro: null,
    proximosSegundos: null
  });
}

function finalizarStatus(mensagem, status = 'finalizada') {
  updateCampaignStatus({
    ativa: false,
    cancelando: false,
    status,
    numeroAtual: null,
    finalizadaEm: new Date().toISOString(),
    mensagem,
    proximosSegundos: null
  });
  registrarHistoricoCampanha();
}

async function processarCampanhaEmBackground(client, payload) {
  const atual = getCampaignStatus();

  if (atual.ativa) {
    throw new Error('Ja existe uma campanha em andamento.');
  }

  const texto = String(payload.texto || '').trim();
  const media = prepararMedia(payload.imagemBase64);

  if (!texto && !media) {
    throw new Error('Informe uma mensagem ou uma imagem para enviar.');
  }

  const telefones = obterTelefonesPorAlvo(payload);

  if (!telefones.length) {
    throw new Error('Nenhum contato valido encontrado para esta campanha.');
  }

  cancelRequested = false;
  iniciarStatus(payload, telefones);
  logger.warn(`Campanha iniciada para ${telefones.length} contato(s). Alvo=${payload.alvo || 'teste'}`);

  let enviados = 0;
  let falhas = 0;
  let ignorados = 0;

  try {
    for (let index = 0; index < telefones.length; index++) {
      const numero = telefones[index];

      if (cancelRequested) {
        finalizarStatus('Campanha cancelada pelo usuario.', 'cancelada');
        logger.warn('Campanha cancelada pelo usuario.');
        return;
      }

      updateCampaignStatus({
        atual: index + 1,
        numeroAtual: numero,
        enviados,
        falhas,
        ignorados,
        mensagem: `Verificando WhatsApp de ${numero}...`
      });

      try {
        const contactId = await obterContactId(client, numero);

        if (!contactId) {
          ignorados++;
          updateCampaignStatus({
            ignorados,
            mensagem: `Numero ignorado: ${numero} nao parece ter WhatsApp ativo.`
          });
          logger.warn(`Campanha: numero ignorado sem WhatsApp ativo: ${numero}`);
        } else if (media) {
          await client.sendMessage(contactId._serialized, media, {
            caption: texto || undefined
          });
          enviados++;
          updateCampaignStatus({
            enviados,
            mensagem: `Mensagem enviada para ${contactId.user}.`
          });
          logger.info(`Campanha: enviada para ${contactId.user}.`);
        } else {
          await client.sendMessage(contactId._serialized, texto);
          enviados++;
          updateCampaignStatus({
            enviados,
            mensagem: `Mensagem enviada para ${contactId.user}.`
          });
          logger.info(`Campanha: enviada para ${contactId.user}.`);
        }
      } catch (error) {
        falhas++;
        updateCampaignStatus({
          falhas,
          erro: error.message,
          mensagem: `Falha ao enviar para ${numero}.`
        });
        logger.error(`Campanha: falha ao enviar para ${numero}:`, error);
      }

      if (index < telefones.length - 1) {
        const delay = randomDelay(payload.delayMinMs, payload.delayMaxMs);
        updateCampaignStatus({
          enviados,
          falhas,
          ignorados,
          proximosSegundos: Math.ceil(delay / 1000),
          mensagem: `Pausa de seguranca antes do proximo envio.`
        });
        await sleep(delay);
      }
    }

    finalizarStatus(`Campanha finalizada. Enviados: ${enviados}. Falhas: ${falhas}. Ignorados: ${ignorados}.`);
    logger.warn(`Campanha finalizada. Enviados=${enviados} Falhas=${falhas} Ignorados=${ignorados}`);
  } catch (error) {
    updateCampaignStatus({
      ativa: false,
      status: 'erro',
      erro: error.message,
      finalizadaEm: new Date().toISOString(),
      mensagem: `Campanha encerrada com erro: ${error.message}`
    });
    registrarHistoricoCampanha();
    logger.error('Campanha encerrada com erro:', error);
  }
}

function cancelarCampanha() {
  const atual = getCampaignStatus();

  if (!atual.ativa) {
    return atual;
  }

  cancelRequested = true;
  updateCampaignStatus({
    cancelando: true,
    mensagem: 'Cancelamento solicitado. A campanha vai parar no proximo intervalo seguro.'
  });

  return getCampaignStatus();
}

module.exports = {
  processarCampanhaEmBackground,
  cancelarCampanha,
  lerHistoricoCampanhas
};
