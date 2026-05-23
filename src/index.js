const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const { Client, LocalAuth } = require('whatsapp-web.js');
const config = require('./config');
const logger = require('./logger');
const { initDatabase, closeDatabase } = require('./database');
const { handleIncomingMessage, handleOutgoingMessage } = require('./atendimento');
const { ensureDirectoryExists } = require('./utils');
const { getStatus, updateStatus } = require('./status');
const { startInterface } = require('./interface');

let client = null;
let shuttingDown = false;
let restarting = false;
let readyWatchTimer = null;
let interfaceServer = null;

function getQrAscii(qr) {
  let output = '';
  qrcode.generate(qr, { small: true }, (value) => {
    output = value;
  });
  return output;
}

function getReadyTimeoutMs() {
  const value = Number(process.env.READY_TIMEOUT_MS || 90000);
  return Number.isFinite(value) && value >= 30000 ? value : 90000;
}

function createClient() {
  return new Client({
    authStrategy: new LocalAuth({
      clientId: config.botClientId,
      dataPath: config.paths.sessionDir
    }),
    takeoverOnConflict: true,
    takeoverTimeoutMs: 0,
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
  });
}

function clearReadyWatch() {
  if (readyWatchTimer) {
    clearTimeout(readyWatchTimer);
    readyWatchTimer = null;
  }
}

function scheduleReadyWatch(reason) {
  clearReadyWatch();

  readyWatchTimer = setTimeout(async () => {
    if (shuttingDown || restarting) {
      return;
    }

    logger.warn(`WhatsApp nao ficou pronto a tempo depois de ${reason}. Reiniciando cliente...`);
    await restartWhatsAppClient(`timeout aguardando ready depois de ${reason}`);
  }, getReadyTimeoutMs());
}

function registerClientEvents(whatsClient) {
  whatsClient.on('qr', (qr) => {
    clearReadyWatch();
    updateStatus({
      whatsappStatus: 'aguardando QR Code',
      ready: false,
      authenticated: false,
      lastQrAt: new Date().toISOString(),
      lastQrText: qr,
      lastQrAscii: getQrAscii(qr)
    });
    logger.info('QR Code recebido. Escaneie pelo WhatsApp do celular.');
    qrcode.generate(qr, { small: true });
  });

  whatsClient.on('authenticated', () => {
    updateStatus({
      whatsappStatus: 'autenticado',
      authenticated: true,
      ready: false,
      lastAuthenticatedAt: new Date().toISOString(),
      lastQrText: null,
      lastQrAscii: null
    });
    scheduleReadyWatch('autenticacao');
    logger.info('WhatsApp autenticado com sucesso.');
  });

  whatsClient.on('auth_failure', (message) => {
    updateStatus({
      whatsappStatus: 'falha de autenticacao',
      authenticated: false,
      ready: false,
      lastError: message
    });
    logger.error('Falha de autenticacao no WhatsApp:', message);
  });

  whatsClient.on('ready', () => {
    clearReadyWatch();
    updateStatus({
      whatsappStatus: 'pronto',
      authenticated: true,
      ready: true,
      initializing: false,
      restarting: false,
      lastReadyAt: new Date().toISOString(),
      lastQrText: null,
      lastQrAscii: null
    });
    logger.info('Bot conectado e pronto para atender.');
  });

  whatsClient.on('disconnected', (reason) => {
    clearReadyWatch();
    updateStatus({
      whatsappStatus: 'desconectado',
      ready: false,
      authenticated: false,
      initializing: false,
      lastDisconnectedAt: new Date().toISOString(),
      lastDisconnectedReason: reason
    });
    logger.warn('WhatsApp desconectado:', reason);
  });

  whatsClient.on('loading_screen', (percent, message) => {
    updateStatus({
      whatsappStatus: 'carregando',
      loadingPercent: percent,
      loadingMessage: message
    });
    logger.info(`WhatsApp carregando ${percent}%: ${message}`);
  });

  whatsClient.on('change_state', (state) => {
    updateStatus({
      whatsappStatus: `estado ${state}`
    });
    logger.info('Estado do WhatsApp:', state);
  });

  whatsClient.on('message', async (message) => {
    await handleIncomingMessage(whatsClient, message);
  });

  // O evento message_create permite capturar o comando /bot enviado manualmente por voce.
  whatsClient.on('message_create', async (message) => {
    await handleOutgoingMessage(whatsClient, message);
  });
}

async function initializeWhatsAppClient() {
  if (client) {
    logger.warn('Cliente WhatsApp ja existe. Use reiniciar se quiser recriar a conexao.');
    return;
  }

  updateStatus({
    whatsappStatus: 'inicializando',
    ready: false,
    initializing: true,
    lastError: null,
    lastQrText: null,
    lastQrAscii: null
  });

  client = createClient();
  registerClientEvents(client);
  scheduleReadyWatch('inicializacao');
  await client.initialize();
}

async function startWhatsAppClient(reason) {
  if (client) {
    logger.warn(`Inicio ignorado: cliente WhatsApp ja esta ativo. Motivo: ${reason}`);
    return;
  }

  logger.info(`Iniciando cliente WhatsApp: ${reason}`);
  await initializeWhatsAppClient();
}

async function destroyWhatsAppClient() {
  clearReadyWatch();

  if (!client) {
    return;
  }

  try {
    await client.destroy();
  } catch (error) {
    logger.error('Erro ao destruir cliente WhatsApp:', error);
  } finally {
    client = null;
  }
}

async function restartWhatsAppClient(reason) {
  if (restarting || shuttingDown) {
    return;
  }

  restarting = true;
  updateStatus({
    whatsappStatus: 'reiniciando',
    ready: false,
    initializing: false,
    restarting: true,
    lastRestartAt: new Date().toISOString()
  });
  logger.warn(`Reiniciando cliente WhatsApp: ${reason}`);

  try {
    await destroyWhatsAppClient();
    updateStatus({
      restartCount: getStatus().restartCount + 1
    });
    await initializeWhatsAppClient();
  } catch (error) {
    updateStatus({
      whatsappStatus: 'erro ao reiniciar',
      lastError: error.message,
      restarting: false
    });
    logger.error('Erro ao reiniciar cliente WhatsApp:', error);
  } finally {
    restarting = false;
  }
}

async function stopWhatsAppClient(reason) {
  if (shuttingDown) {
    return;
  }

  logger.warn(`Parando cliente WhatsApp: ${reason}`);
  await destroyWhatsAppClient();
  updateStatus({
    whatsappStatus: 'parado',
    ready: false,
    authenticated: false,
    initializing: false,
    restarting: false,
    lastQrText: null,
    lastQrAscii: null
  });
}

function assertPathInsideProject(targetPath) {
  const root = path.resolve(config.paths.rootDir);
  const resolved = path.resolve(targetPath);

  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error(`Caminho fora do projeto: ${resolved}`);
  }

  return resolved;
}

async function removeDirectorySafely(targetPath) {
  const resolved = assertPathInsideProject(targetPath);

  if (fs.existsSync(resolved)) {
    await fs.promises.rm(resolved, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 500
    });
  }
}

async function clearWhatsAppSession(reason) {
  logger.warn(`Apagando sessao WhatsApp: ${reason}`);
  await destroyWhatsAppClient();

  await removeDirectorySafely(path.join(config.paths.sessionDir, `session-${config.botClientId}`));
  await removeDirectorySafely(config.paths.sessionDir);
  await removeDirectorySafely(path.join(config.paths.rootDir, '.wwebjs_cache'));

  updateStatus({
    whatsappStatus: 'sessao apagada',
    ready: false,
    authenticated: false,
    initializing: false,
    restarting: false,
    lastQrText: null,
    lastQrAscii: null,
    lastDisconnectedAt: new Date().toISOString(),
    lastDisconnectedReason: 'sessao apagada pela interface'
  });
}

async function shutdown(signal) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  logger.info(`Encerrando bot por sinal ${signal}...`);

  try {
    clearReadyWatch();

    if (interfaceServer) {
      await new Promise((resolve) => interfaceServer.close(resolve));
    }

    await destroyWhatsAppClient();
  } catch (error) {
    logger.error('Erro ao encerrar bot:', error);
  } finally {
    closeDatabase();
    process.exit(0);
  }
}

async function main() {
  try {
    ensureDirectoryExists(config.paths.dataDir);
    ensureDirectoryExists(config.paths.logsDir);
    initDatabase();

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('uncaughtException', (error) => {
      logger.error('Erro nao tratado:', error);
    });
    process.on('unhandledRejection', (reason) => {
      logger.error('Promise rejeitada sem tratamento:', reason);
    });

    logger.info(`Iniciando bot da ${config.empresa.nome}...`);
    logger.info(
      `Seguranca: BOT_ATIVO=${config.botAtivo} MODO_TESTE=${config.modoTeste} APENAS_NUMEROS_PERMITIDOS=${config.apenasNumerosPermitidos} TELEFONES_PERMITIDOS=${config.telefonesPermitidos.join(',') || 'nenhum'}`
    );

    updateStatus({
      whatsappStatus: 'parado',
      ready: false,
      authenticated: false,
      initializing: false,
      restarting: false
    });

    interfaceServer = startInterface({
      startWhatsApp: startWhatsAppClient,
      stopWhatsApp: stopWhatsAppClient,
      restartWhatsApp: restartWhatsAppClient,
      clearWhatsAppSession
    });

    if (config.autoStartWhatsApp) {
      setTimeout(() => {
        startWhatsAppClient('inicio automatico configurado')
          .catch((error) => logger.error('Erro no inicio automatico do WhatsApp:', error));
      }, 1000);
    }
  } catch (error) {
    updateStatus({
      whatsappStatus: 'erro ao iniciar',
      lastError: error.message
    });
    logger.error('Falha ao iniciar o bot:', error);
    closeDatabase();
    process.exit(1);
  }
}

main();
