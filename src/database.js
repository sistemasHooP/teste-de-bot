const Database = require('better-sqlite3');
const config = require('./config');
const logger = require('./logger');
const { ensureDirectoryExists } = require('./utils');

let db = null;

function createTables(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS clientes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telefone TEXT UNIQUE NOT NULL,
      nome TEXT,
      modo_humano INTEGER DEFAULT 0,
      ultimo_menu_data TEXT,
      criado_em TEXT,
      atualizado_em TEXT
    );

    CREATE TABLE IF NOT EXISTS mensagens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telefone TEXT NOT NULL,
      direcao TEXT NOT NULL,
      mensagem TEXT NOT NULL,
      criado_em TEXT
    );

    CREATE TABLE IF NOT EXISTS quiz_estado (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telefone TEXT UNIQUE NOT NULL,
      pergunta_atual INTEGER DEFAULT 0,
      pontos INTEGER DEFAULT 0,
      ativo INTEGER DEFAULT 0,
      atualizado_em TEXT
    );
  `);
}

function ensureColumn(database, tableName, columnName, columnDefinition) {
  const columns = database.prepare(`PRAGMA table_info(${tableName})`).all();
  const exists = columns.some((column) => column.name === columnName);

  if (!exists) {
    database.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`);
  }
}

function runMigrations(database) {
  ensureColumn(database, 'clientes', 'menu_ativo', 'INTEGER DEFAULT 0');
  ensureColumn(database, 'clientes', 'menu_ativo_data', 'TEXT');
  ensureColumn(database, 'clientes', 'menu_ativo_expira_em', 'TEXT');
  ensureColumn(database, 'clientes', 'bot_silenciado_ate_data', 'TEXT');
}

function initDatabase() {
  if (db) {
    return db;
  }

  try {
    ensureDirectoryExists(config.paths.dataDir);

    db = new Database(config.paths.databasePath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    createTables(db);
    runMigrations(db);
    logger.info('Banco SQLite inicializado em', config.paths.databasePath);

    return db;
  } catch (error) {
    logger.error('Erro ao inicializar banco SQLite:', error);
    throw error;
  }
}

function getDatabase() {
  return db || initDatabase();
}

function closeDatabase() {
  if (!db) {
    return;
  }

  try {
    db.close();
    db = null;
    logger.info('Banco SQLite fechado.');
  } catch (error) {
    logger.error('Erro ao fechar banco SQLite:', error);
  }
}

module.exports = {
  initDatabase,
  getDatabase,
  closeDatabase
};
