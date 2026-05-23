const menu = require('./menu');
const quiz = require('./quiz');
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
/6 ou /quiz - Iniciar quiz de teste
/1.1 - Testar um submenu, se existir
/bot - Reativar atendimento automatico de um cliente`;
}

function respostaPorOpcao(telefone, opcao) {
  const resposta = menu.getRespostaOpcao(opcao);

  if (!resposta) {
    return null;
  }

  if (resposta.tipo === 'quiz') {
    return quiz.iniciarQuiz(telefone);
  }

  return resposta.mensagem;
}

function obterRespostaTeste(telefone, texto) {
  const comando = normalizeText(texto);

  if (!comando.startsWith('/')) {
    return null;
  }

  if (comando === '/teste' || comando === '/ajuda') {
    return getAjudaTeste();
  }

  if (comando === '/ola' || comando === '/menu') {
    return menu.getMenuPrincipal();
  }

  if (/^\/\d+(\.\d+)*$/.test(comando)) {
    return respostaPorOpcao(telefone, comando.slice(1));
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
    return respostaPorOpcao(telefone, '5') || menu.getAtendimentoHumano();
  }

  if (comando === '/quiz') {
    return quiz.iniciarQuiz(telefone);
  }

  return null;
}

module.exports = {
  getAjudaTeste,
  obterRespostaTeste
};
