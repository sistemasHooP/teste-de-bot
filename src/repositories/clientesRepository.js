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

function limparSilencio(telefone) {
  obterOuCriar(telefone);

  getDatabase()
    .prepare(`
      UPDATE clientes
      SET bot_silenciado_ate_data = NULL,
          atualizado_em = ?
      WHERE telefone = ?
    `)
    .run(getIsoNow(), telefone);
}

function limparSilencios() {
  const result = getDatabase()
    .prepare(`
      UPDATE clientes
      SET bot_silenciado_ate_data = NULL,
          atualizado_em = ?
      WHERE bot_silenciado_ate_data IS NOT NULL
    `)
    .run(getIsoNow());

  return result.changes || 0;
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

function listarModoHumano(limit = 100) {
  return getDatabase()
    .prepare(`
      SELECT telefone, nome, modo_humano, ultimo_menu_data, atualizado_em
      FROM clientes
      WHERE modo_humano = 1
      ORDER BY atualizado_em DESC
      LIMIT ?
    `)
    .all(Math.max(1, Math.min(500, Number(limit) || 100)));
}

function contarModoHumano() {
  const row = getDatabase()
    .prepare('SELECT COUNT(*) AS total FROM clientes WHERE modo_humano = 1')
    .get();

  return row ? row.total : 0;
}

function contarClientes() {
  const row = getDatabase()
    .prepare("SELECT COUNT(*) AS total FROM clientes WHERE telefone IS NOT NULL AND telefone != ''")
    .get();

  return row ? row.total : 0;
}

function listarRecentes(limit = 80) {
  return getDatabase()
    .prepare(`
      SELECT
        telefone,
        nome,
        modo_humano,
        ultimo_menu_data,
        menu_ativo,
        menu_ativo_data,
        menu_ativo_expira_em,
        bot_silenciado_ate_data,
        criado_em,
        atualizado_em
      FROM clientes
      ORDER BY atualizado_em DESC
      LIMIT ?
    `)
    .all(Math.max(1, Math.min(300, Number(limit) || 80)));
}

function getResumoDia(dataAtual) {
  const inicio = `${dataAtual}T00:00:00`;
  const proximoDia = new Date(`${dataAtual}T00:00:00Z`);
  proximoDia.setUTCDate(proximoDia.getUTCDate() + 1);
  const fim = proximoDia.toISOString().slice(0, 10) + 'T00:00:00';

  const criados = getDatabase()
    .prepare('SELECT COUNT(*) AS total FROM clientes WHERE criado_em >= ? AND criado_em < ?')
    .get(inicio, fim);
  const atualizados = getDatabase()
    .prepare('SELECT COUNT(*) AS total FROM clientes WHERE atualizado_em >= ? AND atualizado_em < ?')
    .get(inicio, fim);

  return {
    data: dataAtual,
    clientesNovos: criados ? criados.total : 0,
    clientesAtualizados: atualizados ? atualizados.total : 0,
    clientesModoHumano: contarModoHumano()
  };
}

module.exports = {
  buscarPorTelefone,
  obterOuCriar,
  marcarMenuEnviado,
  jaRecebeuMenuHoje,
  deveEnviarMenuNoPeriodo,
  estaSilenciado,
  silenciarAteData,
  limparSilencio,
  limparSilencios,
  desativarMenu,
  menuEstaAtivo,
  ativarModoHumano,
  desativarModoHumano,
  estaEmModoHumano,
  listarModoHumano,
  contarModoHumano,
  contarClientes,
  listarRecentes,
  getResumoDia
};
