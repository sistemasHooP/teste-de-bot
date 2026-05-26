const menuConfig = require('./menuConfig');
const salmo = require('./salmo');
const palavraBiblica = require('./palavraBiblica');

function getMenuPrincipal() {
  return menuConfig.buildMainMenu();
}

function getMensagemRecepcaoAntesMenu() {
  return menuConfig.buildMensagemRecepcaoAntesMenu();
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
  const currentConfig = menuConfig.loadMenuConfig();
  return menuConfig.aplicarTags(currentConfig.menu.respostaModoHumano, currentConfig);
}

function getMensagemGenerica() {
  const currentConfig = menuConfig.loadMenuConfig();
  return menuConfig.aplicarTags(currentConfig.menu.respostaGenerica, currentConfig);
}

function getOpcaoInvalida() {
  const currentConfig = menuConfig.loadMenuConfig();
  return menuConfig.aplicarTags(currentConfig.menu.respostaOpcaoInvalida, currentConfig);
}

function getMensagemAutomaticaEspera() {
  const currentConfig = menuConfig.loadMenuConfig();
  return menuConfig.aplicarTags(currentConfig.comportamento.mensagemAutomaticaEsperaTexto, currentConfig);
}

function getMensagemAutomaticaAposMenu() {
  const currentConfig = menuConfig.loadMenuConfig();
  return menuConfig.aplicarTags(currentConfig.comportamento.mensagemAutomaticaAposMenuTexto, currentConfig);
}

function hasSalmoPlacementTag(texto) {
  return /\{salmo_(do_dia|referencia|mensagem)\}/.test(String(texto || ''));
}

function montarSalmoComMensagemPersonalizada(texto, currentConfig = menuConfig.loadMenuConfig()) {
  const salmoDia = salmo.getSalmoDoDia();
  const mensagemPersonalizada = menuConfig.aplicarTags(texto, currentConfig);

  if (hasSalmoPlacementTag(texto)) {
    return mensagemPersonalizada;
  }

  const lines = [
    mensagemPersonalizada,
    '',
    salmoDia.referencia,
    salmoDia.mensagem
  ];

  return lines.filter((line, index, array) => line || array[index - 1]).join('\n');
}

function getMensagemAutomaticaAposMenuComSalmo() {
  const currentConfig = menuConfig.loadMenuConfig();
  return montarSalmoComMensagemPersonalizada(
    currentConfig.comportamento.mensagemAutomaticaAposMenuTexto,
    currentConfig
  );
}

function montarPalavraBiblicaComMensagemPersonalizada(texto, currentConfig = menuConfig.loadMenuConfig()) {
  const palavraDia = palavraBiblica.getPalavraBiblicaDoDia();
  const mensagemPersonalizada = menuConfig.aplicarTags(texto, currentConfig);
  const lines = [
    mensagemPersonalizada,
    '',
    palavraDia.referencia,
    palavraDia.mensagem
  ];

  return lines.filter((line, index, array) => line || array[index - 1]).join('\n');
}

function getMensagemAutomaticaEsperaComPalavraBiblica() {
  const currentConfig = menuConfig.loadMenuConfig();
  return montarPalavraBiblicaComMensagemPersonalizada(
    currentConfig.comportamento.mensagemAutomaticaEsperaTexto,
    currentConfig
  );
}

function getSalmoDoDiaMensagem() {
  return menuConfig.buildSalmoDoDiaMensagem();
}

function getRespostaOpcao(texto) {
  const resposta = menuConfig.getOptionResponse(texto);

  if (resposta && resposta.tipo === 'salmo') {
    return {
      ...resposta,
      mensagem: getSalmoDoDiaMensagem()
    };
  }

  return resposta;
}

function getPrimeiraOpcaoPorTipo(tipo) {
  return menuConfig.findFirstOptionPathByType(tipo);
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
  getMensagemRecepcaoAntesMenu,
  getCatalogoServicos,
  getEndereco,
  getAgendamentoOnline,
  getHorarioFuncionamento,
  getAtendimentoHumano,
  getModoHumanoMensagem,
  getMensagemGenerica,
  getOpcaoInvalida,
  getMensagemAutomaticaEspera,
  getMensagemAutomaticaEsperaComPalavraBiblica,
  getMensagemAutomaticaAposMenu,
  getMensagemAutomaticaAposMenuComSalmo,
  getSalmoDoDiaMensagem,
  getRespostaOpcao,
  getPrimeiraOpcaoPorTipo,
  isMenuTrigger,
  isGreeting,
  getBehavior,
  getSafety
};
