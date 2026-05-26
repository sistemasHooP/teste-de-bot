const fs = require('fs');
const path = require('path');
const config = require('./config');
const logger = require('./logger');
const { getDatabase } = require('./database');
const { ensureDirectoryExists } = require('./utils');

function getBackupsDir() {
  const backupsDir = path.join(config.paths.rootDir, 'backups');
  ensureDirectoryExists(backupsDir);
  return backupsDir;
}

function getTimestampName() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function copyIfExists(sourcePath, destinationPath) {
  if (!fs.existsSync(sourcePath)) {
    return false;
  }

  ensureDirectoryExists(path.dirname(destinationPath));
  fs.copyFileSync(sourcePath, destinationPath);
  return true;
}

function getDirectorySize(targetPath) {
  if (!fs.existsSync(targetPath)) {
    return 0;
  }

  return fs.readdirSync(targetPath, { withFileTypes: true }).reduce((total, entry) => {
    const entryPath = path.join(targetPath, entry.name);
    return total + (entry.isDirectory() ? getDirectorySize(entryPath) : fs.statSync(entryPath).size);
  }, 0);
}

function copyDataFiles(destinationDir) {
  const dataBackupDir = path.join(destinationDir, 'data');
  ensureDirectoryExists(dataBackupDir);

  if (!fs.existsSync(config.paths.dataDir)) {
    return [];
  }

  return fs.readdirSync(config.paths.dataDir)
    .filter((fileName) => !fileName.startsWith('banco.sqlite'))
    .filter((fileName) => {
      const sourcePath = path.join(config.paths.dataDir, fileName);
      return fs.statSync(sourcePath).isFile();
    })
    .filter((fileName) => copyIfExists(
      path.join(config.paths.dataDir, fileName),
      path.join(dataBackupDir, fileName)
    ));
}

async function createBackup() {
  const backupName = getTimestampName();
  const backupDir = path.join(getBackupsDir(), backupName);
  const dataBackupDir = path.join(backupDir, 'data');

  ensureDirectoryExists(dataBackupDir);

  const copiedFiles = [];

  if (copyIfExists(config.envPath, path.join(backupDir, '.env'))) {
    copiedFiles.push('.env');
  }

  const databaseBackupPath = path.join(dataBackupDir, 'banco.sqlite');
  await getDatabase().backup(databaseBackupPath);
  copiedFiles.push('data/banco.sqlite');

  copyDataFiles(backupDir).forEach((fileName) => {
    copiedFiles.push(`data/${fileName}`);
  });

  const metadata = {
    nome: backupName,
    criadoEm: new Date().toISOString(),
    arquivos: copiedFiles
  };

  fs.writeFileSync(path.join(backupDir, 'metadata.json'), `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
  logger.info(`Backup criado em ${backupDir}`);

  return {
    ...metadata,
    caminho: backupDir,
    tamanhoBytes: getDirectorySize(backupDir)
  };
}

function readBackupEntry(entry, includeSize = true) {
  const backupDir = path.join(getBackupsDir(), entry.name);
  const metadataPath = path.join(backupDir, 'metadata.json');
  let metadata = {
    nome: entry.name,
    criadoEm: fs.statSync(backupDir).birthtime.toISOString(),
    arquivos: []
  };

  if (fs.existsSync(metadataPath)) {
    try {
      metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    } catch (error) {
      logger.warn(`Nao foi possivel ler metadata do backup ${entry.name}:`, error.message);
    }
  }

  return {
    ...metadata,
    caminho: backupDir,
    tamanhoBytes: includeSize ? getDirectorySize(backupDir) : null
  };
}

function getBackupDirs() {
  return fs.readdirSync(getBackupsDir(), { withFileTypes: true })
    .filter((entry) => entry.isDirectory());
}

function sortBackups(backups) {
  return backups.sort((a, b) => String(b.criadoEm).localeCompare(String(a.criadoEm)));
}

function listBackups() {
  return sortBackups(getBackupDirs().map((entry) => readBackupEntry(entry, true)));
}

function getLatestBackup() {
  const latest = sortBackups(getBackupDirs().map((entry) => readBackupEntry(entry, false)))[0];

  if (!latest) {
    return null;
  }

  return {
    ...latest,
    tamanhoBytes: getDirectorySize(latest.caminho)
  };
}

module.exports = {
  createBackup,
  listBackups,
  getLatestBackup
};
