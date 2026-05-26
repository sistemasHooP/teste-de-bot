const fs = require('fs');
const path = require('path');
const config = require('./config');
const logger = require('./logger');
const { ensureDirectoryExists } = require('./utils');

const fileName = 'modelos_resposta.json';

function getFilePath() {
  ensureDirectoryExists(config.paths.dataDir);
  return path.join(config.paths.dataDir, fileName);
}

function getDefaultModelos() {
  return [
    {
      titulo: 'Atendimento em instantes',
      texto: 'Ola! Ja recebemos sua mensagem. Assim que nossa equipe desocupar, vamos te atender por aqui.'
    },
    {
      titulo: 'Link de agendamento',
      texto:
        'Voce pode fazer seu agendamento on-line pelo link abaixo:\n\n' +
        `${config.empresa.minhaAgendaUrl}\n\n` +
        'Por la voce escolhe o servico, a data e o horario disponiveis.'
    },
    {
      titulo: 'Pedir procedimento desejado',
      texto: 'Qual procedimento voce deseja fazer? Assim conseguimos te orientar melhor.'
    },
    {
      titulo: 'Endereco',
      texto:
        `Nosso endereco:\n${config.empresa.endereco}\n\n` +
        `Ponto de referencia:\n${config.empresa.pontoReferencia}\n\n` +
        `Google Maps:\n${config.empresa.mapsUrl}`
    }
  ];
}

function sanitizeModelo(modelo) {
  return {
    titulo: String(modelo && modelo.titulo ? modelo.titulo : '').trim(),
    texto: String(modelo && modelo.texto ? modelo.texto : '').trim()
  };
}

function sanitizeModelos(modelos) {
  return (Array.isArray(modelos) ? modelos : [])
    .map(sanitizeModelo)
    .filter((modelo) => modelo.titulo && modelo.texto);
}

function lerModelos() {
  const filePath = getFilePath();

  if (!fs.existsSync(filePath)) {
    salvarModelos(getDefaultModelos());
  }

  try {
    return sanitizeModelos(JSON.parse(fs.readFileSync(filePath, 'utf8')));
  } catch (error) {
    logger.warn('Nao foi possivel ler modelos de resposta:', error.message);
    return getDefaultModelos();
  }
}

function salvarModelos(modelos) {
  const sanitized = sanitizeModelos(modelos);
  fs.writeFileSync(getFilePath(), `${JSON.stringify(sanitized, null, 2)}\n`, 'utf8');
  logger.info(`Modelos de resposta salvos: ${sanitized.length}.`);
  return sanitized;
}

module.exports = {
  lerModelos,
  salvarModelos,
  getDefaultModelos
};
