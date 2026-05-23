const fs = require('fs');
const path = require('path');
const config = require('./config');
const logger = require('./logger');
const { ensureDirectoryExists } = require('./utils');

const startupFileName = 'Bot Renaly.vbs';
const legacyStartupFileName = 'Bot Renaly.bat';

function getStartupDir() {
  const appData = process.env.APPDATA;

  if (!appData) {
    return null;
  }

  return path.join(appData, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
}

function getStartupFilePath() {
  const startupDir = getStartupDir();
  return startupDir ? path.join(startupDir, startupFileName) : null;
}

function getLegacyStartupFilePath() {
  const startupDir = getStartupDir();
  return startupDir ? path.join(startupDir, legacyStartupFileName) : null;
}

function getStartupStatus() {
  const filePath = getStartupFilePath();
  const legacyFilePath = getLegacyStartupFilePath();

  return {
    supported: Boolean(filePath),
    enabled: Boolean((filePath && fs.existsSync(filePath)) || (legacyFilePath && fs.existsSync(legacyFilePath))),
    filePath,
    legacyFilePath
  };
}

function enableStartup() {
  const filePath = getStartupFilePath();

  if (!filePath) {
    throw new Error('Pasta de inicializacao do Windows nao encontrada.');
  }

  ensureDirectoryExists(path.dirname(filePath));

  const launcherPath = path.join(config.paths.rootDir, 'iniciar-bot-oculto.vbs');
  const content = [
    'Option Explicit',
    'Dim shell',
    'Set shell = CreateObject("WScript.Shell")',
    `shell.Run "wscript.exe ""${launcherPath}""", 0, False`,
    ''
  ].join('\r\n');

  fs.writeFileSync(filePath, content, 'utf8');

  const legacyFilePath = getLegacyStartupFilePath();
  if (legacyFilePath && fs.existsSync(legacyFilePath)) {
    fs.unlinkSync(legacyFilePath);
  }

  logger.info('Inicializacao com Windows ativada.');
  return getStartupStatus();
}

function disableStartup() {
  const filePath = getStartupFilePath();

  if (filePath && fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  const legacyFilePath = getLegacyStartupFilePath();
  if (legacyFilePath && fs.existsSync(legacyFilePath)) {
    fs.unlinkSync(legacyFilePath);
  }

  logger.info('Inicializacao com Windows desativada.');
  return getStartupStatus();
}

module.exports = {
  getStartupStatus,
  enableStartup,
  disableStartup
};
