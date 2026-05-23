const { getDatabase } = require('../database');
const { getIsoNow } = require('../utils');

function buscarPorTelefone(telefone) {
  return getDatabase()
    .prepare('SELECT * FROM clientes WHERE telefone = ?')
    .get(telefone);
}

function obterOuCriar(telefone, nome = null) {
  const now = getIsoNow();

  getDatabase()
    .prepare(`
      INSERT INTO clientes (telefone, nome, criado_em, atualizado_em)
      VALUES (@telefone, @nome, @now, @now)
      ON CONFLICT(telefone) DO UPDATE SET
        nome = CASE
          WHEN excluded.nome IS NOT NULL AND excluded.nome != '' THEN excluded.nome
          ELSE clientes.nome
        END,
        atualizado_em = excluded.atualizado_em
    `)
    .run({
      telefone,
      nome: nome || null,
      now
    });

  return buscarPorTelefone(telefone);
}

function marcarMenuEnviado(telefone, data, expiraEm = null) {
  obterOuCriar(telefone);

  getDatabase()
    .prepare(`
      UPDATE clientes
      SET ultimo_menu_data = ?,
          menu_ativo = 1,
          menu_ativo_data = ?,
          menu_ativo_expira_em = ?,
          bot_silenciado_ate_data = NULL,
          atualizado_em = ?
      WHERE telefone = ?
    `)
    .run(data, data, expiraEm, getIsoNow(), telefone);
}

function jaRecebeuMenuHoje(telefone, data) {
  const cliente = buscarPorTelefone(telefone);
  return Boolean(cliente && cliente.ultimo_menu_data === data);
}

function getDiferencaDias(dataMaisRecente, dataMaisAntiga) {
  const recente = new Date(`${dataMaisRecente}T00:00:00Z`);
  const antiga = new Date(`${dataMaisAntiga}T00:00:00Z`);

  if (Number.isNaN(recente.getTime()) || Number.isNaN(antiga.getTime())) {
    return Infinity;
  }

  return Math.floor((recente.getTime() - antiga.getTime()) / 86400000);
}

function deveEnviarMenuNoPeriodo(telefone, dataAtual, intervaloDias) {
  const cliente = buscarPorTelefone(telefone);
  const intervalo = Math.max(1, Number(intervaloDias) || 1);

  if (!cliente || !cliente.ultimo_menu_data) {
    return true;
  }

  return getDiferencaDias(dataAtual, cliente.ultimo_menu_data) >= intervalo;
}

function isDataDentroSilencio(dataAtual, dataSilencio) {
  if (!dataSilencio) {
    return false;
  }

  return getDiferencaDias(dataAtual, dataSilencio) <= 0;
}

function estaSilenciado(telefone, dataAtual) {
  const cliente = buscarPorTelefone(telefone);
  return Boolean(cliente && isDataDentroSilencio(dataAtual, cliente.bot_silenciado_ate_data));
}

function silenciarAteData(telefone, data) {
  obterOuCriar(telefone);

  getDatabase()
    .prepare(`
      UPDATE clientes
      SET menu_ativo = 0,
          menu_ativo_data = NULL,
          menu_ativo_expira_em = NULL,
          bot_silenciado_ate_data = ?,
          atualizado_em = ?
      WHERE telefone = ?
    `)
    .run(data, getIsoNow(), telefone);
}

function desativarMenu(telefone) {
  obterOuCriar(telefone);

  getDatabase()
    .prepare(`
      UPDATE clientes
      SET menu_ativo = 0,
          menu_ativo_data = NULL,
          menu_ativo_expira_em = NULL,
          atualizado_em = ?
      WHERE telefone = ?
    `)
    .run(getIsoNow(), telefone);
}

function menuEstaAtivo(telefone, dataAtual) {
  const cliente = buscarPorTelefone(telefone);

  if (!cliente || cliente.menu_ativo !== 1 || cliente.menu_ativo_data !== dataAtual) {
    return false;
  }

  if (!cliente.menu_ativo_expira_em) {
    return true;
  }

  const expiraEm = new Date(cliente.menu_ativo_expira_em).getTime();

  if (Number.isNaN(expiraEm)) {
    return false;
  }

  return Date.now() <= expiraEm;
}

function ativarModoHumano(telefone) {
  obterOuCriar(telefone);

  getDatabase()
    .prepare(`
      UPDATE clientes
      SET modo_humano = 1, atualizado_em = ?
      WHERE telefone = ?
    `)
    .run(getIsoNow(), telefone);
}

function desativarModoHumano(telefone) {
  obterOuCriar(telefone);

  getDatabase()
    .prepare(`
      UPDATE clientes
      SET modo_humano = 0, atualizado_em = ?
      WHERE telefone = ?
    `)
    .run(getIsoNow(), telefone);
}

function estaEmModoHumano(telefone) {
  const cliente = buscarPorTelefone(telefone);
  return Boolean(cliente && cliente.modo_humano === 1);
}

module.exports = {
  buscarPorTelefone,
  obterOuCriar,
  marcarMenuEnviado,
  jaRecebeuMenuHoje,
  deveEnviarMenuNoPeriodo,
  estaSilenciado,
  silenciarAteData,
  desativarMenu,
  menuEstaAtivo,
  ativarModoHumano,
  desativarModoHumano,
  estaEmModoHumano
};
