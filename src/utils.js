const fs = require('fs');

function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function getIsoNow() {
  return new Date().toISOString();
}

function getTodayKey() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  return formatter.format(now);
}

function normalizeText(text) {
  return String(text || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function extractTelefone(chatId) {
  return String(chatId || '').split('@')[0];
}

function isPrivateChatId(chatId) {
  if (typeof chatId !== 'string') {
    return false;
  }

  return chatId.endsWith('@c.us') || chatId.endsWith('@lid');
}

function getMessageBody(message) {
  return message && (message.body || (message._data && message._data.body) || '');
}

function getChatIdFromMessage(message) {
  if (!message) {
    return '';
  }

  const candidates = [
    message.to,
    message.from,
    message.id && message.id.remote,
    message._data && message._data.to && message._data.to._serialized,
    message._data && message._data.from && message._data.from._serialized
  ];

  return candidates.find(isPrivateChatId) || '';
}

function isMenuCommand(text) {
  return normalizeText(text) === 'menu';
}

function isBotCommand(text) {
  return String(text || '').trim().toLowerCase() === '/bot';
}

function isGreeting(text) {
  const normalized = normalizeText(text);
  return ['oi', 'ola', 'bom dia', 'boa tarde', 'boa noite'].includes(normalized);
}

function isValidMenuOption(text) {
  return ['1', '2', '3', '4', '5', '6'].includes(String(text || '').trim());
}

function safeMessageText(text) {
  const value = String(text || '').trim();
  return value || '[mensagem sem texto]';
}

module.exports = {
  ensureDirectoryExists,
  getIsoNow,
  getTodayKey,
  normalizeText,
  extractTelefone,
  isPrivateChatId,
  getMessageBody,
  getChatIdFromMessage,
  isMenuCommand,
  isBotCommand,
  isGreeting,
  isValidMenuOption,
  safeMessageText
};
