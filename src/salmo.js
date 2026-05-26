const { getTodayKey } = require('./utils');

const salmos = [
  {
    referencia: 'Salmo 23',
    mensagem: 'Que hoje voce se lembre: Deus cuida, guia e renova as forcas no caminho.'
  },
  {
    referencia: 'Salmo 27',
    mensagem: 'Que a confianca venca a ansiedade e traga coragem para atravessar o dia.'
  },
  {
    referencia: 'Salmo 91',
    mensagem: 'Que este dia seja vivido com paz, protecao e descanso no cuidado de Deus.'
  },
  {
    referencia: 'Salmo 121',
    mensagem: 'Que voce encontre ajuda, firmeza e direcao para cada passo de hoje.'
  },
  {
    referencia: 'Salmo 46',
    mensagem: 'Mesmo em dias corridos, que a presenca de Deus traga calma ao coracao.'
  },
  {
    referencia: 'Salmo 34',
    mensagem: 'Que a gratidao abra espaco para perceber cuidado, livramento e bondade.'
  },
  {
    referencia: 'Salmo 37',
    mensagem: 'Que voce entregue suas preocupacoes a Deus e caminhe com paciencia e confianca.'
  },
  {
    referencia: 'Salmo 139',
    mensagem: 'Que voce se sinta visto, conhecido e cuidado por Deus em todos os detalhes.'
  },
  {
    referencia: 'Salmo 19',
    mensagem: 'Que suas palavras, escolhas e pensamentos sejam guiados por sabedoria.'
  },
  {
    referencia: 'Salmo 103',
    mensagem: 'Que este dia seja lembrado pela misericordia, pelo recomeco e pela esperanca.'
  }
];

function getIndexDoDia() {
  const today = getTodayKey().replace(/\D/g, '');
  const numericValue = Number(today);
  return Number.isFinite(numericValue) ? numericValue % salmos.length : 0;
}

function getSalmoDoDia() {
  return salmos[getIndexDoDia()];
}

function montarMensagemSalmoDoDia() {
  const salmo = getSalmoDoDia();

  return [
    'Salmo do dia',
    '',
    salmo.referencia,
    salmo.mensagem
  ].join('\n');
}

module.exports = {
  getSalmoDoDia,
  montarMensagemSalmoDoDia
};
