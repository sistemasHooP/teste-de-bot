const fs = require('fs');
const path = require('path');

const logsDir = path.resolve(__dirname, '..', 'logs');
const recentLogs = [];
const maxRecentLogs = 200;

function ensureLogsDir() {
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
}

function getLogFilePath() {
  const dateKey = new Date().toISOString().slice(0, 10);
  return path.join(logsDir, `bot-${dateKey}.log`);
}

function formatValue(value) {
  if (value instanceof Error) {
    return value.stack || value.message;
  }

  if (typeof value === 'object' && value !== null) {
    try {
      return JSON.stringify(value);
    } catch (error) {
      return String(value);
    }
  }

  return String(value);
}

function write(level, values) {
  ensureLogsDir();

  const line = `[${new Date().toISOString()}] [${level}] ${values.map(formatValue).join(' ')}`;
  recentLogs.push(line);

  if (recentLogs.length > maxRecentLogs) {
    recentLogs.shift();
  }

  if (level === 'ERROR') {
    console.error(line);
  } else if (level === 'WARN') {
    console.warn(line);
  } else {
    console.log(line);
  }

  try {
    fs.appendFileSync(getLogFilePath(), `${line}\n`, 'utf8');
  } catch (error) {
    console.error('[LOGGER_ERROR]', error.message);
  }
}

module.exports = {
  info: (...values) => write('INFO', values),
  warn: (...values) => write('WARN', values),
  error: (...values) => write('ERROR', values),
  getRecentLogs: (limit = 80) => recentLogs.slice(-limit)
};
