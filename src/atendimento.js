const clientesRepository = require('./repositories/clientesRepository');
const mensagensRepository = require('./repositories/mensagensRepository');
const logger = require('./logger');
const menu = require('./menu');
const config = require('./config');
const teste = require('./teste');
const { getStatus } = require('./status');
const {
  extractTelefone,
  getChatIdFromMessage,
  getMessageBody,
  getTodayKey,
  isBotCommand,
  isPrivateChatId,
  normalizeText,
  safeMessageText
} = require('./utils');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clienteAutorizado(telefone) {
  if (config.isTelefoneNaListaPermitidos(telefone)) {
    return true;
  }

  if (config.apenasNumerosPermitidos) {
    return false;
  }

  return Boolean(menu.getSafety().responderTodosClientes);
}

function isContatoTestePermitido(telefone) {
  return Boolean(config.modoTeste && config.isTelefoneNaListaPermitidos(telefone));
}

function addDaysToDateKey(dateKey, days) {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function getSilencioAteData(dataAtual, intervaloDias) {
  const intervalo = Math.max(1, Number(intervaloDias) || 1);
  return addDaysToDateKey(dataAtual, intervalo - 1);
}

function getMenuExpiraEm(behavior) {
  const minutos = Math.max(1, Number(behavior.janelaMenuMinutos) || 30);
  return new Date(Date.now() + minutos * 60000).toISOString();
}

async function aplicarComportamentoEnvio(client, chatId) {
  const behavior = menu.getBehavior();
  let chatDigitando = null;

  if (behavior.digitandoAtivo) {
    try {
      chatDigitando = await client.getChatById(chatId);

      if (chatDigitando && typeof chatDigitando.sendStateTyping === 'function') {
        await chatDigitando.sendStateTyping();
      }

      await sleep(behavior.tempoDigitandoMs);
    } catch (error) {
      logger.warn('Nao foi possivel exibir estado digitando:', error.message);
    }
  }

  if (behavior.atrasoRespostaMs > 0) {
    await sleep(behavior.atrasoRespostaMs);
  }

  return chatDigitando;
}

async function enviarMensagem(client, chatId, telefone, texto) {
  let chatDigitando = null;

  try {
    chatDigitando = await aplicarComportamentoEnvio(client, chatId);
    await client.sendMessage(chatId, texto);
    mensagensRepository.registrarEnviada(telefone, texto);
    return true;
  } catch (error) {
    logger.error(`Erro ao enviar mensagem para ${telefone}:`, error);
    return false;
  } finally {
    if (chatDigitando && typeof chatDigitando.clearState === 'function') {
      try {
        await chatDigitando.clearState();
      } catch (error) {
        logger.warn('Nao foi possivel limpar estado digitando:', error.message);
      }
    }
  }
}

async function enviarMenuInicial(client, chatId, telefone, behavior) {
  if (behavior.recepcaoAntesMenuAtiva) {
    const mensagemRecepcao = menu.getMensagemRecepcaoAntesMenu();

    if (mensagemRecepcao.trim()) {
      await enviarMensagem(client, chatId, telefone, mensagemRecepcao);
    }

    const atraso = Math.max(0, Math.min(30000, Number(behavior.atrasoMenuInicialMs) || 0));

    if (atraso > 0) {
      await sleep(atraso);
    }
  }

  await enviarMensagem(client, chatId, telefone, menu.getMenuPrincipal());

  if (behavior.mensagemAutomaticaAposMenuAtiva) {
    await enviarMensagemAutomaticaAposMenu(client, chatId, telefone, behavior);
  }
}

async function enviarMensagemAutomaticaAposMenu(client, chatId, telefone, behavior) {
  const atraso = Math.max(0, Math.min(30000, Number(behavior.mensagemAutomaticaAposMenuAtrasoMs) || 0));

  if (atraso > 0) {
    await sleep(atraso);
  }

  if (behavior.mensagemAutomaticaAposMenuTipo === 'salmo') {
    await enviarMensagem(client, chatId, telefone, menu.getMensagemAutomaticaAposMenuComSalmo());
    return;
  }

  const texto = menu.getMensagemAutomaticaAposMenu();

  if (texto.trim()) {
    await enviarMensagem(client, chatId, telefone, texto);
  }
}

async function enviarMensagemAutomaticaEspera(client, chatId, telefone, behavior) {
  if (!behavior.mensagemAutomaticaEsperaAtiva) {
    return;
  }

  const atraso = Math.max(0, Math.min(30000, Number(behavior.mensagemAutomaticaEsperaAtrasoMs) || 0));

  if (atraso > 0) {
    await sleep(atraso);
  }

  if (behavior.mensagemAutomaticaEsperaTipo === 'salmo') {
    logger.info(`Extra ao chamar atendente para ${telefone}: Salmo do Dia.`);
    await enviarMensagem(client, chatId, telefone, menu.getSalmoDoDiaMensagem());
    return;
  }

  if (behavior.mensagemAutomaticaEsperaTipo === 'biblia') {
    logger.info(`Extra ao chamar atendente para ${telefone}: Palavra Biblica de Espera.`);
    await enviarMensagem(client, chatId, telefone, menu.getMensagemAutomaticaEsperaComPalavraBiblica());
    return;
  }

  const textoEspera = menu.getMensagemAutomaticaEspera();

  if (textoEspera.trim()) {
    await enviarMensagem(client, chatId, telefone, textoEspera);
  }
}

async function obterNomeContato(message) {
  try {
    const contato = await message.getContact();
    return contato.pushname || contato.name || contato.shortName || null;
  } catch (error) {
    logger.warn('Nao foi possivel obter nome do contato:', error.message);
    return null;
  }
}

async function obterDadosContato(message) {
  try {
    const contato = await message.getContact();

    return {
      nome: contato.pushname || contato.name || contato.shortName || null,
      telefone: contato.number || (contato.id && contato.id.user) || null,
      isMe: Boolean(contato.isMe)
    };
  } catch (error) {
    logger.warn('Nao foi possivel obter dados do contato:', error.message);

    return {
      nome: null,
      telefone: null,
      isMe: false
    };
  }
}

function montarTextoTeste(textoOriginal, isConversaComigo) {
  const texto = String(textoOriginal || '').trim();
  const normalizado = normalizeText(texto);

  if (!isConversaComigo || texto.startsWith('/')) {
    return texto;
  }

  if (/^\d+(\.\d+)*$/.test(texto)) {
    return `/${texto}`;
  }

  const atalhos = {
    oi: '/ola',
    ola: '/ola',
    menu: '/menu',
    '1': '/1',
    catalogo: '/catalogo',
    '2': '/2',
    endereco: '/endereco',
    '3': '/3',
    agenda: '/agenda',
    agendamento: '/agenda',
    '4': '/4',
    horario: '/horario',
    '5': '/5',
    atendente: '/atendente',
    teste: '/teste'
  };

  return atalhos[normalizado] || texto;
}

function deveIgnorarMensagemRecebida(message) {
  if (!message) {
    return true;
  }

  if (message.fromMe) {
    return true;
  }

  if (!isPrivateChatId(message.from)) {
    return true;
  }

  return false;
}

function mensagemFoiRecebidaAntesDoBotPronto(message) {
  if (!message || !message.timestamp) {
    return false;
  }

  const status = getStatus();
  const readyReference = status.lastReadyAt || status.processStartedAt;
  const readyTime = readyReference ? new Date(readyReference).getTime() : Date.now();
  const messageTime = Number(message.timestamp) * 1000;

  if (!Number.isFinite(messageTime) || !Number.isFinite(readyTime)) {
    return false;
  }

  // Pequena tolerancia por causa do arredondamento do WhatsApp em segundos.
  return messageTime < readyTime - 10000;
}

async function responderOpcaoMenu(client, chatId, telefone, opcao) {
  const resposta = menu.getRespostaOpcao(opcao);

  if (!resposta) {
    await enviarMensagem(client, chatId, telefone, menu.getOpcaoInvalida());
    return;
  }

  if (resposta.tipo === 'humano') {
    const enviado = await enviarMensagem(client, chatId, telefone, resposta.mensagem);

    if (enviado) {
      clientesRepository.desativarMenu(telefone);
      clientesRepository.ativarModoHumano(telefone);
      logger.info(`Cliente ${telefone} entrou em modo de atendimento humano.`);
      await enviarMensagemAutomaticaEspera(client, chatId, telefone, menu.getBehavior());
    }

    return;
  }

  if (resposta.tipo === 'submenu') {
    await enviarMensagem(client, chatId, telefone, resposta.mensagem);
    return;
  }

  if (resposta.tipo === 'salmo') {
    const enviado = await enviarMensagem(client, chatId, telefone, resposta.mensagem);

    if (enviado) {
      clientesRepository.desativarMenu(telefone);
    }

    return;
  }

  const enviado = await enviarMensagem(client, chatId, telefone, resposta.mensagem);

  if (enviado) {
    clientesRepository.desativarMenu(telefone);
  }
}

async function responderModoHumano(client, chatId, telefone, textoOriginal) {
  if (menu.isMenuTrigger(textoOriginal)) {
    await enviarMensagem(client, chatId, telefone, menu.getModoHumanoMensagem());
  }
}

async function handleIncomingMessage(client, message) {
  try {
    if (deveIgnorarMensagemRecebida(message)) {
      return;
    }

    if (config.modoTeste && message) {
      logger.info(
        `Evento message: fromMe=${message.fromMe} from=${message.from} to=${message.to} body=${getMessageBody(message)}`
      );
    }

    const chatId = message.from;
    const dadosContato = await obterDadosContato(message);
    const telefone = dadosContato.telefone || extractTelefone(chatId);
    const textoOriginal = safeMessageText(getMessageBody(message));

    if (!config.botAtivo) {
      logger.warn(`Mensagem ignorada de ${telefone}: BOT_ATIVO=false.`);
      return;
    }

    if (mensagemFoiRecebidaAntesDoBotPronto(message)) {
      logger.warn(`Mensagem ignorada de ${telefone}: recebida antes do bot ficar pronto.`);
      return;
    }

    if (!clienteAutorizado(telefone)) {
      logger.warn(`Mensagem ignorada de ${telefone}: telefone fora da lista permitida.`);
      return;
    }

    const cliente = clientesRepository.obterOuCriar(telefone, dadosContato.nome);
    const hoje = getTodayKey();
    const behavior = menu.getBehavior();
    const contatoTestePermitido = isContatoTestePermitido(telefone);

    mensagensRepository.registrarRecebida(telefone, textoOriginal);

    if (cliente.modo_humano === 1) {
      if (contatoTestePermitido && (menu.isMenuTrigger(textoOriginal) || menu.isGreeting(textoOriginal))) {
        clientesRepository.desativarModoHumano(telefone);
      } else {
        await responderModoHumano(client, chatId, telefone, textoOriginal);
        return;
      }
    }

    if (contatoTestePermitido && menu.isGreeting(textoOriginal)) {
      clientesRepository.limparSilencio(telefone);
      clientesRepository.marcarMenuEnviado(telefone, hoje, getMenuExpiraEm(behavior));
      await enviarMenuInicial(client, chatId, telefone, behavior);
      logger.info(`Contato de teste ${telefone} recebeu menu inicial sem aplicar silencio.`);
      return;
    }

    if (menu.isMenuTrigger(textoOriginal)) {
      clientesRepository.limparSilencio(telefone);
      clientesRepository.marcarMenuEnviado(telefone, hoje, getMenuExpiraEm(behavior));
      await enviarMensagem(client, chatId, telefone, menu.getMenuPrincipal());
      return;
    }

    if (!contatoTestePermitido && clientesRepository.estaSilenciado(telefone, hoje)) {
      logger.info(`Cliente ${telefone} esta silenciado ate o proximo ciclo do menu.`);
      return;
    }

    const deveEnviarMenu = clientesRepository.deveEnviarMenuNoPeriodo(
      telefone,
      hoje,
      behavior.intervaloMenuDias
    );

    if (deveEnviarMenu) {
      clientesRepository.marcarMenuEnviado(telefone, hoje, getMenuExpiraEm(behavior));
      await enviarMenuInicial(client, chatId, telefone, behavior);
      return;
    }

    const textoOpcao = textoOriginal.trim();
    const respostaOpcao = menu.getRespostaOpcao(textoOpcao);
    const menuAtivo = clientesRepository.menuEstaAtivo(telefone, hoje);

    if (respostaOpcao && (menuAtivo || contatoTestePermitido)) {
      await responderOpcaoMenu(client, chatId, telefone, textoOriginal.trim());
      return;
    }

    if (respostaOpcao && !menuAtivo && !contatoTestePermitido) {
      logger.info(`Opcao ${textoOpcao} ignorada para ${telefone}: menu nao esta ativo.`);
      return;
    }

    if (menuAtivo && /^\d+(\.\d+)*$/.test(textoOpcao)) {
      await enviarMensagem(client, chatId, telefone, menu.getOpcaoInvalida());
      return;
    }

    if (menuAtivo) {
      if (contatoTestePermitido) {
        await enviarMensagem(client, chatId, telefone, menu.getMensagemGenerica());
        logger.info(`Contato de teste ${telefone} nao foi silenciado apos mensagem fora do menu.`);
        return;
      }

      const silencioAte = getSilencioAteData(hoje, behavior.intervaloMenuDias);
      clientesRepository.silenciarAteData(telefone, silencioAte);
      logger.info(`Cliente ${telefone} ignorou o menu. Silenciado ate ${silencioAte}.`);
      return;
    }

    if (contatoTestePermitido) {
      await enviarMensagem(client, chatId, telefone, menu.getMensagemGenerica());
      logger.info(`Contato de teste ${telefone} recebeu resposta generica fora da janela do menu.`);
      return;
    }

    logger.info(`Mensagem ignorada de ${telefone}: fora da janela ativa do menu.`);
  } catch (error) {
    logger.error('Erro ao processar mensagem recebida:', error);
  }
}

async function handleOutgoingMessage(client, message) {
  try {
    if (!message || !message.fromMe) {
      return;
    }

    if (config.modoTeste) {
      logger.info(
        `Evento message_create: fromMe=${message.fromMe} from=${message.from} to=${message.to} remote=${message.id && message.id.remote} body=${getMessageBody(message)}`
      );
    }

    const chatId = getChatIdFromMessage(message);

    if (!isPrivateChatId(chatId)) {
      if (config.modoTeste) {
        logger.warn('Comando ignorado porque nao foi possivel identificar uma conversa privada.');
      }
      return;
    }

    const telefoneChat = extractTelefone(chatId);
    const telefoneRemetente = extractTelefone(message.from);
    const textoOriginal = getMessageBody(message);
    const dadosContato = await obterDadosContato(message);
    const telefoneContato = dadosContato.telefone || telefoneChat;
    const telefoneControle = clienteAutorizado(telefoneChat)
      ? telefoneChat
      : clienteAutorizado(telefoneRemetente)
        ? telefoneRemetente
      : telefoneContato;
    const isConversaComigo =
      dadosContato.isMe ||
      (message.fromMe && clienteAutorizado(telefoneRemetente) && chatId.endsWith('@lid'));
    const textoTeste = montarTextoTeste(textoOriginal, isConversaComigo);

    if (config.modoTeste && !isBotCommand(textoOriginal)) {
      if (!clienteAutorizado(telefoneControle)) {
        logger.warn(`Comando de teste ignorado para ${telefoneControle}: telefone fora da lista permitida.`);
        return;
      }

      if (normalizeText(textoTeste) === '/ola') {
        mensagensRepository.registrarComando(telefoneControle, textoOriginal);
        await enviarMenuInicial(client, chatId, telefoneControle, menu.getBehavior());
        logger.info(`Comando de teste /ola processado com pausa para ${telefoneControle}.`);
        return;
      }

      const comandoTesteNormalizado = normalizeText(textoTeste);
      const opcaoTeste = comandoTesteNormalizado.startsWith('/') ? comandoTesteNormalizado.slice(1) : '';
      const respostaOpcaoTeste = /^\d+(\.\d+)*$/.test(opcaoTeste) ? menu.getRespostaOpcao(opcaoTeste) : null;

      if (
        comandoTesteNormalizado === '/atendente' ||
        (respostaOpcaoTeste && respostaOpcaoTeste.tipo === 'humano')
      ) {
        mensagensRepository.registrarComando(telefoneControle, textoOriginal);
        clientesRepository.obterOuCriar(telefoneControle, dadosContato.nome);
        await responderOpcaoMenu(
          client,
          chatId,
          telefoneControle,
          respostaOpcaoTeste ? opcaoTeste : (menu.getPrimeiraOpcaoPorTipo('humano') || '5')
        );
        logger.info(`Comando de teste de atendente processado para ${telefoneControle}.`);
        return;
      }

      const respostaTeste = teste.obterRespostaTeste(telefoneControle, textoTeste);

      if (respostaTeste) {
        mensagensRepository.registrarComando(telefoneControle, textoOriginal);
        await enviarMensagem(client, chatId, telefoneControle, respostaTeste);
        logger.info(`Comando de teste processado para ${telefoneControle}: ${textoOriginal}`);
      }

      return;
    }

    if (!isBotCommand(textoOriginal)) {
      return;
    }

    if (!clienteAutorizado(telefoneControle)) {
      logger.warn(`Comando /bot ignorado para ${telefoneControle}: telefone fora da lista permitida.`);
      return;
    }

    clientesRepository.obterOuCriar(telefoneControle);
    mensagensRepository.registrarComando(telefoneControle, textoOriginal);
    clientesRepository.desativarModoHumano(telefoneControle);

    await enviarMensagem(
      client,
      chatId,
      telefoneControle,
      'Atendimento automatico reativado.\n\nO cliente ja pode usar o menu novamente digitando menu.'
    );

    logger.info(`Atendimento automatico reativado para ${telefoneControle}.`);
  } catch (error) {
    logger.error('Erro ao processar comando /bot:', error);
  }
}

module.exports = {
  handleIncomingMessage,
  handleOutgoingMessage
};
