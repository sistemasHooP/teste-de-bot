const { getDatabase } = require('../database');
const { getIsoNow } = require('../utils');

function buscarPorTelefone(telefone) {
  return getDatabase()
    .prepare('SELECT * FROM quiz_estado WHERE telefone = ?')
    .get(telefone);
}

function obterOuCriar(telefone) {
  getDatabase()
    .prepare(`
      INSERT INTO quiz_estado (telefone, pergunta_atual, pontos, ativo, atualizado_em)
      VALUES (?, 0, 0, 0, ?)
      ON CONFLICT(telefone) DO NOTHING
    `)
    .run(telefone, getIsoNow());

  return buscarPorTelefone(telefone);
}

function iniciar(telefone) {
  obterOuCriar(telefone);

  getDatabase()
    .prepare(`
      UPDATE quiz_estado
      SET pergunta_atual = 0, pontos = 0, ativo = 1, atualizado_em = ?
      WHERE telefone = ?
    `)
    .run(getIsoNow(), telefone);

  return buscarPorTelefone(telefone);
}

function atualizar(telefone, perguntaAtual, pontos, ativo = 1) {
  obterOuCriar(telefone);

  getDatabase()
    .prepare(`
      UPDATE quiz_estado
      SET pergunta_atual = ?, pontos = ?, ativo = ?, atualizado_em = ?
      WHERE telefone = ?
    `)
    .run(perguntaAtual, pontos, ativo, getIsoNow(), telefone);

  return buscarPorTelefone(telefone);
}

function encerrar(telefone) {
  obterOuCriar(telefone);

  getDatabase()
    .prepare(`
      UPDATE quiz_estado
      SET ativo = 0, pergunta_atual = 0, pontos = 0, atualizado_em = ?
      WHERE telefone = ?
    `)
    .run(getIsoNow(), telefone);
}

module.exports = {
  buscarPorTelefone,
  obterOuCriar,
  iniciar,
  atualizar,
  encerrar
};
