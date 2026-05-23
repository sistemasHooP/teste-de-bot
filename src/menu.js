const menuConfig = require('./menuConfig');

function getMenuPrincipal() {
  return menuConfig.buildMainMenu();
}

function getCatalogoServicos() {
  const resposta = menuConfig.getOptionResponse('1');
  return resposta ? resposta.mensagem : '';
}

function getEndereco() {
  const resposta = menuConfig.getOptionResponse('2');
  return resposta ? resposta.mensagem : '';
}

function getAgendamentoOnline() {
  const resposta = menuConfig.getOptionResponse('3');
  return resposta ? resposta.mensagem : '';
}

function getHorarioFuncionamento() {
  const resposta = menuConfig.getOptionResponse('4');
  return resposta ? resposta.mensagem : '';
}

function getAtendimentoHumano() {
  const resposta = menuConfig.getOptionResponse('5');
  return resposta ? resposta.mensagem : '';
}

function getModoHumanoMensagem() {
  return menuConfig.loadMenuConfig().menu.respostaModoHumano;
}

function getMensagemGenerica() {
  return menuConfig.loadMenuConfig().menu.respostaGenerica;
}

function getOpcaoInvalida() {
  return menuConfig.loadMenuConfig().menu.respostaOpcaoInvalida;
}

function getRespostaOpcao(texto) {
  return menuConfig.getOptionResponse(texto);
}

function isMenuTrigger(texto) {
  return menuConfig.isMenuTrigger(texto);
}

function isGreeting(texto) {
  return menuConfig.isGreeting(texto);
}

function getBehavior() {
  return menuConfig.getBehavior();
}

function getSafety() {
  return menuConfig.getSafety();
}

module.exports = {
  getMenuPrincipal,
  getCatalogoServicos,
  getEndereco,
  getAgendamentoOnline,
  getHorarioFuncionamento,
  getAtendimentoHumano,
  getModoHumanoMensagem,
  getMensagemGenerica,
  getOpcaoInvalida,
  getRespostaOpcao,
  isMenuTrigger,
  isGreeting,
  getBehavior,
  getSafety
};
