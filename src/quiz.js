const quizRepository = require('./repositories/quizRepository');
const { normalizeText } = require('./utils');

const perguntas = [
  {
    texto: 'Dormir maquiada pode prejudicar a pele?',
    opcoes: {
      A: 'Sim',
      B: 'Nao'
    },
    correta: 'A',
    explicacao: 'Dormir maquiada pode obstruir poros e favorecer irritacoes.'
  },
  {
    texto: 'O protetor solar deve ser usado apenas quando vai a praia?',
    opcoes: {
      A: 'Sim',
      B: 'Nao'
    },
    correta: 'B',
    explicacao: 'O ideal e usar protetor solar todos os dias, mesmo em dias nublados.'
  },
  {
    texto: 'Beber agua ajuda nos cuidados com a pele?',
    opcoes: {
      A: 'Sim',
      B: 'Nao'
    },
    correta: 'A',
    explicacao: 'A hidratacao ajuda no funcionamento do corpo e tambem contribui para a saude da pele.'
  },
  {
    texto: 'A esfoliacao da pele deve ser feita com cuidado?',
    opcoes: {
      A: 'Sim',
      B: 'Nao, quanto mais forte melhor'
    },
    correta: 'A',
    explicacao: 'Esfoliacao em excesso ou com muita forca pode sensibilizar a pele.'
  }
];

function montarPergunta(index, prefixo = 'Quiz rapido enquanto voce aguarda:') {
  const pergunta = perguntas[index];

  if (!pergunta) {
    return 'O quiz foi encerrado. Digite menu para voltar ao atendimento automatico.';
  }

  const opcoes = Object.entries(pergunta.opcoes)
    .map(([letra, texto]) => `${letra} - ${texto}`)
    .join('\n');

  return `${prefixo}

${pergunta.texto}

${opcoes}

Responda com a letra da opcao.`;
}

function iniciarQuiz(telefone) {
  quizRepository.iniciar(telefone);
  return montarPergunta(0);
}

function encerrarQuiz(telefone) {
  quizRepository.encerrar(telefone);
}

function processarResposta(telefone, texto) {
  const estado = quizRepository.obterOuCriar(telefone);

  if (!estado.ativo) {
    return {
      respondeu: false,
      mensagem: ''
    };
  }

  const pergunta = perguntas[estado.pergunta_atual];

  if (!pergunta) {
    quizRepository.encerrar(telefone);
    return {
      respondeu: true,
      mensagem: 'O quiz foi encerrado. Digite menu para voltar ao atendimento automatico.'
    };
  }

  const resposta = normalizeText(texto).toUpperCase();
  const letrasValidas = Object.keys(pergunta.opcoes);

  if (!letrasValidas.includes(resposta)) {
    return {
      respondeu: true,
      mensagem: `Responda apenas com ${letrasValidas.join(' ou ')}.

${montarPergunta(estado.pergunta_atual, 'Pergunta atual:')}`
    };
  }

  const acertou = resposta === pergunta.correta;
  const pontos = estado.pontos + (acertou ? 1 : 0);
  const proximaPergunta = estado.pergunta_atual + 1;
  const resultado = acertou
    ? `Voce acertou!\n\n${pergunta.explicacao}`
    : `Quase! A resposta correta e ${pergunta.correta} - ${pergunta.opcoes[pergunta.correta]}.\n\n${pergunta.explicacao}`;

  if (proximaPergunta >= perguntas.length) {
    quizRepository.encerrar(telefone);

    return {
      respondeu: true,
      mensagem: `${resultado}

Quiz finalizado! Voce fez ${pontos} de ${perguntas.length} ponto(s).

Digite menu para voltar as opcoes de atendimento.`
    };
  }

  quizRepository.atualizar(telefone, proximaPergunta, pontos, 1);

  return {
    respondeu: true,
    mensagem: `${resultado}

${montarPergunta(proximaPergunta, 'Proxima pergunta:')}`
  };
}

module.exports = {
  iniciarQuiz,
  encerrarQuiz,
  processarResposta
};
