const { getTodayKey } = require('./utils');

const palavras = [
  {
    referencia: 'Mateus 11:28',
    mensagem: 'Jesus acolhe quem esta cansado e lembra que existe descanso para o coracao.'
  },
  {
    referencia: 'Filipenses 4:7',
    mensagem: 'Que a paz de Deus guarde seus pensamentos e traga calma enquanto voce espera.'
  },
  {
    referencia: 'Isaias 41:10',
    mensagem: 'Deus fortalece, sustenta e renova a coragem de quem confia nele.'
  },
  {
    referencia: 'Jeremias 29:11',
    mensagem: 'Que voce se lembre que Deus conduz planos de paz, futuro e esperanca.'
  },
  {
    referencia: 'Proverbios 3:5',
    mensagem: 'Confie em Deus de todo o coracao e entregue a ele os caminhos deste dia.'
  },
  {
    referencia: 'Romanos 8:28',
    mensagem: 'Mesmo quando algo demora, Deus continua trabalhando para o bem dos que o amam.'
  },
  {
    referencia: 'Joao 14:27',
    mensagem: 'Que a paz de Cristo abrace seu coracao e afaste a ansiedade.'
  },
  {
    referencia: '2 Corintios 12:9',
    mensagem: 'A graca de Deus e suficiente, inclusive nos momentos de espera e fragilidade.'
  },
  {
    referencia: 'Lamentacoes 3:23',
    mensagem: 'As misericordias de Deus se renovam a cada manha, trazendo novo folego.'
  },
  {
    referencia: 'Numeros 6:24',
    mensagem: 'Que Deus abencoe, guarde e ilumine o seu dia com cuidado e paz.'
  }
];

function getIndexDoDia() {
  const today = getTodayKey().replace(/\D/g, '');
  const numericValue = Number(today);
  return Number.isFinite(numericValue) ? numericValue % palavras.length : 0;
}

function getPalavraBiblicaDoDia() {
  return palavras[getIndexDoDia()];
}

function montarPalavraBiblicaDoDia() {
  const palavra = getPalavraBiblicaDoDia();

  return [
    palavra.referencia,
    palavra.mensagem
  ].join('\n');
}

module.exports = {
  getPalavraBiblicaDoDia,
  montarPalavraBiblicaDoDia
};
