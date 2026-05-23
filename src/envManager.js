const fs = require('fs');
const config = require('./config');
const logger = require('./logger');

function quoteValue(value) {
  return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function readLines() {
  if (!fs.existsSync(config.envPath)) {
    return [];
  }

  return fs.readFileSync(config.envPath, 'utf8').split(/\r?\n/);
}

function setEnvValues(values) {
  const lines = readLines();
  const pending = new Map(
    Object.entries(values).map(([key, value]) => [key, quoteValue(value)])
  );
  const nextLines = lines
    .filter((line, index) => line || index < lines.length - 1)
    .map((line) => {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=/);

      if (!match || !pending.has(match[1])) {
        return line;
      }

      const key = match[1];
      const value = pending.get(key);
      pending.delete(key);
      return `${key}=${value}`;
    });

  for (const [key, value] of pending.entries()) {
    nextLines.push(`${key}=${value}`);
  }

  fs.writeFileSync(config.envPath, `${nextLines.join('\n')}\n`, 'utf8');

  for (const [key, value] of Object.entries(values)) {
    process.env[key] = String(value);
  }

  config.reloadConfig();
  logger.info('Configuracao .env atualizada pela interface.');
  return config;
}

function ativarModoTesteSeguro(telefonesPermitidos) {
  return setEnvValues({
    BOT_ATIVO: 'true',
    MODO_TESTE: 'true',
    APENAS_NUMEROS_PERMITIDOS: 'true',
    TELEFONES_PERMITIDOS: telefonesPermitidos || config.telefonesPermitidos.join(',')
  });
}

function ativarProducaoSegura(removerTelefonesTeste) {
  return setEnvValues({
    BOT_ATIVO: 'true',
    MODO_TESTE: 'false',
    APENAS_NUMEROS_PERMITIDOS: 'false',
    TELEFONES_PERMITIDOS: removerTelefonesTeste ? '' : config.telefonesPermitidos.join(',')
  });
}

function desativarBot() {
  return setEnvValues({
    BOT_ATIVO: 'false'
  });
}

function atualizarAutoStartWhatsApp(ativo) {
  return setEnvValues({
    AUTO_START_WHATSAPP: ativo ? 'true' : 'false'
  });
}

function limparTelefonesPermitidos() {
  return setEnvValues({
    TELEFONES_PERMITIDOS: ''
  });
}

module.exports = {
  setEnvValues,
  ativarModoTesteSeguro,
  ativarProducaoSegura,
  desativarBot,
  atualizarAutoStartWhatsApp,
  limparTelefonesPermitidos
};
