const fs = require('fs');
const path = require('path');
const config = require('./config');
const logger = require('./logger');
const { ensureDirectoryExists } = require('./utils');

function getArquivoListas() {
  ensureDirectoryExists(config.paths.dataDir);
  return path.join(config.paths.dataDir, 'listas_campanha.json');
}

function getArquivoBase() {
  ensureDirectoryExists(config.paths.dataDir);
  return path.join(config.paths.dataDir, 'base_csv.json');
}

function lerJsonSeguro(filePath, fallback) {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    logger.error(`Erro ao ler ${path.basename(filePath)}:`, error);
    return fallback;
  }
}

function escreverJsonSeguro(filePath, data) {
  ensureDirectoryExists(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function gerarTelefoneWhatsappProvavel(telefone) {
  const numero = String(telefone || '').replace(/\D/g, '');

  if (numero.length === 13 && numero.startsWith('55')) {
    return numero.substring(0, 4) + numero.substring(5);
  }

  if (numero.length === 11 && !numero.startsWith('55')) {
    return numero.substring(0, 2) + numero.substring(3);
  }

  return numero;
}

function normalizarContato(contato) {
  const telefone = String(contato && contato.telefone ? contato.telefone : '').replace(/\D/g, '');
  const nome = String(contato && contato.nome ? contato.nome : '').trim();

  if (!telefone) {
    return null;
  }

  return {
    nome,
    telefone,
    whatsappProvavel: gerarTelefoneWhatsappProvavel(telefone),
    origem: String(contato && contato.origem ? contato.origem : '').trim()
  };
}

function normalizarContatos(contatos) {
  const vistos = new Set();
  const lista = Array.isArray(contatos) ? contatos : [];

  return lista
    .map(normalizarContato)
    .filter(Boolean)
    .filter((contato) => {
      const chave = contato.whatsappProvavel || contato.telefone;

      if (vistos.has(chave)) {
        return false;
      }

      vistos.add(chave);
      return true;
    });
}

function lerBaseContatos() {
  return normalizarContatos(lerJsonSeguro(getArquivoBase(), []));
}

function salvarBaseContatos(contatos) {
  const lista = normalizarContatos(contatos);
  escreverJsonSeguro(getArquivoBase(), lista);
  logger.info(`Base CSV salva com ${lista.length} contato(s).`);
  return lista;
}

function limparBaseContatos() {
  const filePath = getArquivoBase();

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  logger.info('Base CSV limpa.');
  return [];
}

function lerListas() {
  const listas = lerJsonSeguro(getArquivoListas(), []);
  return Array.isArray(listas)
    ? listas.map((lista) => ({
        nome: String(lista.nome || '').trim(),
        dataCriacao: lista.dataCriacao || null,
        contatos: normalizarContatos(lista.contatos)
      })).filter((lista) => lista.nome)
    : [];
}

function salvarLista(nome, contatos) {
  const nomeLista = String(nome || '').trim();
  const contatosNormalizados = normalizarContatos(contatos);

  if (!nomeLista) {
    throw new Error('Informe um nome para a lista.');
  }

  if (!contatosNormalizados.length) {
    throw new Error('Selecione pelo menos um contato para salvar a lista.');
  }

  const listas = lerListas().filter((lista) => lista.nome !== nomeLista);
  listas.push({
    nome: nomeLista,
    dataCriacao: new Date().toISOString(),
    contatos: contatosNormalizados
  });

  escreverJsonSeguro(getArquivoListas(), listas);
  logger.info(`Lista "${nomeLista}" salva com ${contatosNormalizados.length} contato(s).`);
  return listas;
}

function excluirLista(nome) {
  const nomeLista = String(nome || '').trim();
  const listas = lerListas().filter((lista) => lista.nome !== nomeLista);
  escreverJsonSeguro(getArquivoListas(), listas);
  logger.info(`Lista "${nomeLista}" excluida.`);
  return listas;
}

function obterListaPorNome(nome) {
  const nomeLista = String(nome || '').trim();
  return lerListas().find((lista) => lista.nome === nomeLista) || null;
}

module.exports = {
  lerBaseContatos,
  salvarBaseContatos,
  limparBaseContatos,
  lerListas,
  salvarLista,
  excluirLista,
  obterListaPorNome,
  normalizarContatos,
  gerarTelefoneWhatsappProvavel
};
