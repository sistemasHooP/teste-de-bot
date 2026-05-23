const { getDatabase } = require('../database');
const logger = require('../logger');
const { getIsoNow, safeMessageText } = require('../utils');
const menuConfig = require('../menuConfig');

function registrar(telefone, direcao, mensagem) {
  try {
    const behavior = menuConfig.getBehavior();

    if (!behavior.historicoMensagensAtivo) {
      return true;
    }

    getDatabase()
      .prepare(`
        INSERT INTO mensagens (telefone, direcao, mensagem, criado_em)
        VALUES (?, ?, ?, ?)
      `)
      .run(telefone, direcao, safeMessageText(mensagem), getIsoNow());

    return true;
  } catch (error) {
    logger.error('Erro ao registrar mensagem:', error);
    return false;
  }
}

function registrarRecebida(telefone, mensagem) {
  return registrar(telefone, 'recebida', mensagem);
}

function registrarEnviada(telefone, mensagem) {
  return registrar(telefone, 'enviada', mensagem);
}

function registrarComando(telefone, mensagem) {
  return registrar(telefone, 'comando', mensagem);
}

function limparHistorico() {
  try {
    const result = getDatabase().prepare('DELETE FROM mensagens').run();
    return result.changes;
  } catch (error) {
    logger.error('Erro ao limpar historico de mensagens:', error);
    return 0;
  }
}

module.exports = {
  registrar,
  registrarRecebida,
  registrarEnviada,
  registrarComando,
  limparHistorico
};
