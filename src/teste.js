const menu = require('./menu');
const { normalizeText } = require('./utils');

function getAjudaTeste() {
  return `Modo teste ativo.

Comandos disponiveis:

/teste - Ver esta ajuda
/ola - Ver mensagem inicial
/menu - Ver menu principal
/1 ou /catalogo - Catalogo de servicos
/2 ou /endereco - Endereco
/3 ou /agenda - Link de agendamento
/4 ou /horario - Horario de funcionamento
/5 ou /atendente - Simular atendimento humano
/salmo - Ver salmo do dia
/1.1 - Testar um submenu, se existir
/bot - Reativar atendimento automatico de um cliente`;
}

function respostaPorOpcao(telefone, opcao) {
  const resposta = menu.getRespostaOpcao(opcao);

  if (!resposta) {
    return null;
  }

  if (resposta.tipo === 'salmo') {
    return resposta.mensagem;
  }

  return resposta.mensagem;
}

function respostaAtendenteTeste(telefone, opcao = '5') {
  const resposta = respostaPorOpcao(telefone, opcao) || menu.getAtendimentoHumano();
  const behavior = menu.getBehavior();

  if (!behavior.mensagemAutomaticaEsperaAtiva) {
    return resposta;
  }

  let extra = menu.getMensagemAutomaticaEspera();

  if (behavior.mensagemAutomaticaEsperaTipo === 'salmo') {
    extra = menu.getSalmoDoDiaMensagem();
  }

  if (behavior.mensagemAutomaticaEsperaTipo === 'biblia') {
    extra = menu.getMensagemAutomaticaEsperaComPalavraBiblica();
  }

  return extra && extra.trim()
    ? `${resposta}\n\n[depois da pausa configurada]\n\n${extra}`
    : resposta;
}

function obterRespostaTeste(telefone, texto) {
  const comando = normalizeText(texto);

  if (!comando.startsWith('/')) {
    return null;
  }

  if (comando === '/teste' || comando === '/ajuda') {
    return getAjudaTeste();
  }

  if (comando === '/ola') {
    return `${menu.getMensagemRecepcaoAntesMenu()}\n\n[no WhatsApp real, o bot aguarda a pausa configurada e envia o menu em outra mensagem]\n\n${menu.getMenuPrincipal()}`;
  }

  if (comando === '/menu') {
    return menu.getMenuPrincipal();
  }

  if (comando === '/5') {
    return respostaAtendenteTeste(telefone, '5');
  }

  if (/^\/\d+(\.\d+)*$/.test(comando)) {
    const opcao = comando.slice(1);
    const resposta = menu.getRespostaOpcao(opcao);

    if (resposta && resposta.tipo === 'humano') {
      return respostaAtendenteTeste(telefone, opcao);
    }

    return respostaPorOpcao(telefone, opcao);
  }

  if (comando === '/catalogo') {
    return respostaPorOpcao(telefone, '1') || menu.getCatalogoServicos();
  }

  if (comando === '/endereco') {
    return respostaPorOpcao(telefone, '2') || menu.getEndereco();
  }

  if (comando === '/agenda' || comando === '/agendamento') {
    return respostaPorOpcao(telefone, '3') || menu.getAgendamentoOnline();
  }

  if (comando === '/horario') {
    return respostaPorOpcao(telefone, '4') || menu.getHorarioFuncionamento();
  }

  if (comando === '/atendente') {
    return respostaAtendenteTeste(telefone, menu.getPrimeiraOpcaoPorTipo('humano') || '5');
  }

  if (comando === '/salmo') {
    const opcoes = menu.getMenuPrincipal().split('\n');
    const linhaSalmo = opcoes.find((linha) => linha.toLowerCase().includes('salmo do dia'));
    const numero = linhaSalmo ? linhaSalmo.split(' - ')[0].trim() : null;
    return numero ? respostaPorOpcao(telefone, numero) : null;
  }

  return null;
}

module.exports = {
  getAjudaTeste,
  obterRespostaTeste
};
