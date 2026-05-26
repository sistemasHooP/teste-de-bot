const path = require('path');
const dotenv = require('dotenv');

const rootDir = path.resolve(__dirname, '..');
const envPath = path.join(rootDir, '.env');

function loadDotEnv() {
  dotenv.config({
    path: envPath,
    override: true
  });
}

loadDotEnv();

function getEnv(name, fallback = '') {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : fallback;
}

function splitCatalog(value) {
  return value
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean);
}

function getBooleanEnv(name, fallback = false) {
  const value = getEnv(name, String(fallback));
  return ['1', 'true', 'sim', 's', 'yes'].includes(value.toLowerCase());
}

function normalizeTelefone(telefone) {
  return String(telefone || '').replace(/\D/g, '');
}

function splitTelefoneList(value) {
  return value
    .split(/[;,|\n]/)
    .map(normalizeTelefone)
    .filter((telefone) => telefone.length >= 10)
    .filter(Boolean);
}

function getTelefoneVariacoes(telefone) {
  const numero = normalizeTelefone(telefone);
  const variacoes = new Set();

  function add(value) {
    const normalizado = normalizeTelefone(value);

    if (normalizado.length >= 10) {
      variacoes.add(normalizado);
    }
  }

  add(numero);

  if (numero.length === 13 && numero.startsWith('55')) {
    add(numero.slice(0, 4) + numero.slice(5));
  }

  if (numero.length === 12 && numero.startsWith('55')) {
    add(numero.slice(0, 4) + '9' + numero.slice(4));
  }

  if (numero.length === 11 && !numero.startsWith('55')) {
    add('55' + numero);
    add(numero.slice(0, 2) + numero.slice(3));
    add('55' + numero.slice(0, 2) + numero.slice(3));
  }

  if (numero.length === 10 && !numero.startsWith('55')) {
    add('55' + numero);
    add(numero.slice(0, 2) + '9' + numero.slice(2));
    add('55' + numero.slice(0, 2) + '9' + numero.slice(2));
  }

  return Array.from(variacoes);
}

const defaultCatalog =
  'Limpeza de pele; Design de sobrancelhas; Depilacao; Massagem; Outros procedimentos';

function buildConfig() {
  const catalogoServicos = splitCatalog(getEnv('CATALOGO_SERVICOS', defaultCatalog));
  const telefonesPermitidos = splitTelefoneList(getEnv('TELEFONES_PERMITIDOS', ''));

  return {
    env: getEnv('NODE_ENV', 'development'),
    envPath,
    botClientId: getEnv('BOT_CLIENT_ID', 'renaly-bot'),
    modoTeste: getBooleanEnv('MODO_TESTE', false),
    botAtivo: getBooleanEnv('BOT_ATIVO', false),
    autoStartWhatsApp: getBooleanEnv('AUTO_START_WHATSAPP', false),
    apenasNumerosPermitidos: getBooleanEnv('APENAS_NUMEROS_PERMITIDOS', true),
    telefonesPermitidos,
    isTelefonePermitido,
    isTelefoneNaListaPermitidos,
    reloadConfig,
    empresa: {
      nome: getEnv('EMPRESA_NOME', 'Renaly Basilio Estetica'),
      endereco: getEnv('EMPRESA_ENDERECO', 'COLOCAR ENDERECO AQUI'),
      pontoReferencia: getEnv('EMPRESA_PONTO_REFERENCIA', 'COLOCAR PONTO DE REFERENCIA AQUI'),
      mapsUrl: getEnv('EMPRESA_MAPS_URL', 'COLOCAR LINK DO GOOGLE MAPS AQUI'),
      minhaAgendaUrl: getEnv('MINHA_AGENDA_URL', 'COLOCAR LINK DO MINHAAGENDA AQUI'),
      horarioFuncionamento: getEnv(
        'HORARIO_FUNCIONAMENTO',
        'Segunda a sexta: 08h as 18h | Sabado: 08h as 12h'
      )
    },
    catalogoServicos,
    paths: {
      rootDir,
      dataDir: path.join(rootDir, 'data'),
      logsDir: path.join(rootDir, 'logs'),
      sessionDir: path.join(rootDir, '.wwebjs_auth'),
      databasePath: path.join(rootDir, 'data', 'banco.sqlite')
    }
  };
}

const configState = {};

function reloadConfig() {
  loadDotEnv();

  for (const key of Object.keys(configState)) {
    delete configState[key];
  }

  Object.assign(configState, buildConfig());
  return configState;
}

function isTelefonePermitido(telefone) {
  if (!configState.apenasNumerosPermitidos) {
    return true;
  }

  if (!configState.telefonesPermitidos.length) {
    return false;
  }

  return configState.telefonesPermitidos.includes(normalizeTelefone(telefone));
}

function isTelefoneNaListaPermitidos(telefone) {
  const telefoneVariacoes = getTelefoneVariacoes(telefone);

  return configState.telefonesPermitidos.some((permitido) => {
    const permitidoVariacoes = getTelefoneVariacoes(permitido);
    return telefoneVariacoes.some((telefoneVariacao) => permitidoVariacoes.includes(telefoneVariacao));
  });
}

reloadConfig();

module.exports = configState;
