const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const { Client, LocalAuth } = require('whatsapp-web.js');
const config = require('./config');
const logger = require('./logger');
const { initDatabase, closeDatabase } = require('./database');
const { handleIncomingMessage, handleOutgoingMessage } = require('./atendimento');
const { ensureDirectoryExists } = require('./utils');
const { getStatus, updateStatus, updateCampaignStatus } = require('./status');
const { startInterface } = require('./interface');
const { processarCampanhaEmBackground, cancelarCampanha } = require('./campanha');
const menu = require('./menu');

let client = null;
let shuttingDown = false;
let restarting = false;
let initializingClient = false;
let readyWatchTimer = null;
let healthWatchTimer = null;
let interfaceServer = null;
let clientGeneration = 0;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getQrAscii(qr) {
  let output = '';
  qrcode.generate(qr, { small: true }, (value) => {
    output = value;
  });
  return output;
}

function getReadyTimeoutMs() {
  const value = Number(process.env.READY_TIMEOUT_MS || 180000);
  return Number.isFinite(value) && value >= 60000 ? value : 180000;
}

function getDestroyTimeoutMs() {
  const value = Number(process.env.DESTROY_TIMEOUT_MS || 15000);
  return Number.isFinite(value) && value >= 5000 ? value : 15000;
}

function getHealthWatchIntervalMs() {
  const value = Number(process.env.HEALTH_WATCH_INTERVAL_MS || 20000);
  return Number.isFinite(value) && value >= 10000 ? value : 20000;
}

function getIsoNow() {
  return new Date().toISOString();
}

function isOlderThan(value, ms) {
  if (!value) {
    return false;
  }

  const time = new Date(value).getTime();

  if (Number.isNaN(time)) {
    return false;
  }

  return Date.now() - time > ms;
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
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-extensions'
      ]
    }
  });
}

function clearReadyWatch() {
  if (readyWatchTimer) {
    clearTimeout(readyWatchTimer);
    readyWatchTimer = null;
  }
}

function scheduleReadyWatch(reason, generation = clientGeneration) {
  clearReadyWatch();

  readyWatchTimer = setTimeout(async () => {
    if (shuttingDown || restarting || !isCurrentGeneration(generation)) {
      return;
    }

    if (getStatus().ready) {
      return;
    }

    logger.warn(`WhatsApp nao ficou pronto a tempo depois de ${reason}. Reiniciando cliente...`);
    await recoverWhatsAppClient(`timeout aguardando ready depois de ${reason}`);
  }, getReadyTimeoutMs());
}

function isCurrentGeneration(generation) {
  return generation === clientGeneration;
}

function shouldRecoverStuckClient(status) {
  if (!client || status.ready || restarting || shuttingDown) {
    return null;
  }

  const timeout = getReadyTimeoutMs();

  if (status.authenticated && isOlderThan(status.lastAuthenticatedAt, timeout)) {
    return 'autenticado sem ficar pronto';
  }

  if (status.initializing && isOlderThan(status.lastLoadingAt || status.lastAuthenticatedAt, timeout)) {
    return 'inicializacao sem progresso';
  }

  if (String(status.whatsappStatus || '').includes('carregando') && isOlderThan(status.lastLoadingAt, timeout)) {
    return 'carregamento travado';
  }

  return null;
}

async function runHealthCheck() {
  if (shuttingDown || restarting || !client) {
    return;
  }

  let status = getStatus();
  const stuckReason = shouldRecoverStuckClient(status);

  if (stuckReason) {
    logger.warn(`Monitor de conexao detectou travamento: ${stuckReason}.`);
    await recoverWhatsAppClient(`monitor de conexao: ${stuckReason}`);
    return;
  }

  if (initializingClient) {
    return;
  }

  if (!status.ready) {
    return;
  }

  try {
    const state = typeof client.getState === 'function' ? await client.getState() : null;
    const patch = {
      lastHealthCheckAt: getIsoNow(),
      lastHealthState: state || 'desconhecido'
    };

    if (state === 'CONNECTED' && !status.ready) {
      Object.assign(patch, {
        whatsappStatus: 'pronto',
        authenticated: true,
        ready: true,
        initializing: false,
        restarting: false,
        lastReadyAt: getIsoNow(),
        lastQrText: null,
        lastQrAscii: null
      });
      clearReadyWatch();
      logger.info('Monitor de conexao corrigiu status para pronto.');
    }

    updateStatus(patch);
    status = getStatus();

    if (status.ready && state && !['CONNECTED', 'OPENING', 'PAIRING'].includes(state)) {
      logger.warn(`Monitor de conexao encontrou estado inesperado: ${state}.`);
      await recoverWhatsAppClient(`estado inesperado no monitor: ${state}`);
    }
  } catch (error) {
    updateStatus({
      lastHealthCheckAt: getIsoNow(),
      lastHealthState: 'erro',
      lastError: error.message
    });
    logger.warn('Monitor de conexao falhou ao consultar estado:', error.message);
    await recoverWhatsAppClient(`monitor nao conseguiu consultar estado: ${error.message}`);
  }
}

function startHealthWatchdog() {
  if (healthWatchTimer) {
    return;
  }

  runHealthCheck()
    .catch((error) => logger.error('Erro no monitor de conexao:', error));

  healthWatchTimer = setInterval(() => {
    runHealthCheck()
      .catch((error) => logger.error('Erro no monitor de conexao:', error));
  }, getHealthWatchIntervalMs());
}

function stopHealthWatchdog() {
  if (healthWatchTimer) {
    clearInterval(healthWatchTimer);
    healthWatchTimer = null;
  }
}

function registerClientEvents(whatsClient, generation) {
  whatsClient.on('qr', (qr) => {
    if (!isCurrentGeneration(generation)) return;
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
    if (!isCurrentGeneration(generation)) return;
    const currentStatus = getStatus();
    updateStatus({
      whatsappStatus: currentStatus.ready ? 'pronto' : 'autenticado',
      authenticated: true,
      ready: currentStatus.ready,
      lastAuthenticatedAt: getIsoNow(),
      lastQrText: null,
      lastQrAscii: null
    });
    if (!currentStatus.ready) {
      scheduleReadyWatch('autenticacao', generation);
    }
    logger.info('WhatsApp autenticado com sucesso.');
  });

  whatsClient.on('auth_failure', (message) => {
    if (!isCurrentGeneration(generation)) return;
    updateStatus({
      whatsappStatus: 'falha de autenticacao',
      authenticated: false,
      ready: false,
      lastError: message
    });
    logger.error('Falha de autenticacao no WhatsApp:', message);
  });

  whatsClient.on('ready', () => {
    if (!isCurrentGeneration(generation)) return;
    clearReadyWatch();
    updateStatus({
      whatsappStatus: 'pronto',
      authenticated: true,
      ready: true,
      initializing: false,
      restarting: false,
      lastReadyAt: getIsoNow(),
      lastQrText: null,
      lastQrAscii: null
    });
    logger.info('Bot conectado e pronto para atender.');
  });

  whatsClient.on('disconnected', (reason) => {
    if (!isCurrentGeneration(generation)) return;
    clearReadyWatch();
    updateStatus({
      whatsappStatus: 'desconectado',
      ready: false,
      authenticated: false,
      initializing: false,
      lastDisconnectedAt: getIsoNow(),
      lastDisconnectedReason: reason
    });
    logger.warn('WhatsApp desconectado:', reason);

    if (!shuttingDown && !restarting) {
      setTimeout(() => {
        if (!shuttingDown && client) {
          recoverWhatsAppClient(`desconexao detectada: ${reason}`)
            .catch((error) => logger.error('Erro ao recuperar apos desconexao:', error));
        }
      }, 5000);
    }
  });

  whatsClient.on('loading_screen', (percent, message) => {
    if (!isCurrentGeneration(generation)) return;
    const currentStatus = getStatus();

    updateStatus({
      whatsappStatus: currentStatus.ready ? 'pronto' : 'carregando',
      loadingPercent: percent,
      loadingMessage: message,
      lastLoadingAt: getIsoNow()
    });

    if (!currentStatus.ready) {
      scheduleReadyWatch(`carregamento ${percent}%`, generation);
    }

    logger.info(`WhatsApp carregando ${percent}%: ${message}`);
  });

  whatsClient.on('change_state', (state) => {
    if (!isCurrentGeneration(generation)) return;
    const currentStatus = getStatus();
    updateStatus(currentStatus.ready
      ? { lastHealthState: state, lastHealthCheckAt: getIsoNow() }
      : { whatsappStatus: `estado ${state}`, lastHealthState: state, lastHealthCheckAt: getIsoNow() });
    logger.info('Estado do WhatsApp:', state);
  });

  whatsClient.on('message', async (message) => {
    if (!isCurrentGeneration(generation)) return;
    await handleIncomingMessage(whatsClient, message);
  });

  // O evento message_create permite capturar o comando /bot enviado manualmente por voce.
  whatsClient.on('message_create', async (message) => {
    if (!isCurrentGeneration(generation)) return;
    await handleOutgoingMessage(whatsClient, message);
  });
}

async function initializeWhatsAppClient() {
  if (client || initializingClient) {
    logger.warn('Cliente WhatsApp ja existe. Use reiniciar se quiser recriar a conexao.');
    return;
  }

  initializingClient = true;
  updateStatus({
    whatsappStatus: 'inicializando',
    ready: false,
    initializing: true,
    lastError: null,
    lastQrText: null,
    lastQrAscii: null
  });

  clientGeneration++;
  const generation = clientGeneration;
  client = createClient();
  registerClientEvents(client, generation);
  scheduleReadyWatch('inicializacao', generation);

  try {
    await client.initialize();
  } catch (error) {
    clearReadyWatch();
    updateStatus({
      whatsappStatus: 'erro ao inicializar',
      ready: false,
      authenticated: false,
      initializing: false,
      lastError: error.message
    });
    logger.error('Erro ao inicializar cliente WhatsApp:', error);
    await destroyWhatsAppClient();
  } finally {
    initializingClient = false;
  }
}

async function startWhatsAppClient(reason) {
  if (client) {
    if (!getStatus().ready) {
      logger.warn(`Cliente WhatsApp existe, mas nao esta pronto. Tentando recuperar. Motivo: ${reason}`);
      recoverWhatsAppClient(`inicio solicitado com cliente travado: ${reason}`)
        .catch((error) => logger.error('Erro ao recuperar cliente:', error));
      return;
    }

    logger.warn(`Inicio ignorado: cliente WhatsApp ja esta pronto. Motivo: ${reason}`);
    return;
  }

  logger.info(`Iniciando cliente WhatsApp: ${reason}`);
  initializeWhatsAppClient()
    .catch((error) => logger.error('Erro ao iniciar cliente WhatsApp:', error));
}

async function destroyWhatsAppClient() {
  clearReadyWatch();
  initializingClient = false;

  if (!client) {
    return;
  }

  const currentClient = client;
  client = null;
  clientGeneration++;

  try {
    if (typeof currentClient.removeAllListeners === 'function') {
      currentClient.removeAllListeners();
    }

    await Promise.race([
      currentClient.destroy(),
      sleep(getDestroyTimeoutMs()).then(() => {
        throw new Error('Timeout ao destruir cliente WhatsApp.');
      })
    ]);
  } catch (error) {
    logger.error('Erro ao destruir cliente WhatsApp:', error);

    try {
      if (currentClient.pupBrowser && typeof currentClient.pupBrowser.close === 'function') {
        await Promise.race([
          currentClient.pupBrowser.close(),
          sleep(5000)
        ]);
      }
    } catch (browserError) {
      logger.warn('Nao foi possivel fechar o navegador interno:', browserError.message);
    }
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
    authenticated: false,
    initializing: false,
    restarting: true,
    lastRestartAt: getIsoNow()
  });
  logger.warn(`Reiniciando cliente WhatsApp: ${reason}`);

  try {
    await destroyWhatsAppClient();
    updateStatus({
      restartCount: getStatus().restartCount + 1
    });
    initializeWhatsAppClient()
      .catch((error) => logger.error('Erro ao iniciar apos reinicio:', error));
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

async function clearWhatsAppCache() {
  await removeDirectorySafely(path.join(config.paths.rootDir, '.wwebjs_cache'));
}

async function recoverWhatsAppClient(reason) {
  if (restarting || shuttingDown) {
    return;
  }

  restarting = true;
  updateStatus({
    whatsappStatus: 'recuperando conexao',
    ready: false,
    authenticated: false,
    initializing: false,
    restarting: true,
    lastRestartAt: getIsoNow()
  });
  logger.warn(`Recuperando conexao WhatsApp: ${reason}`);

  try {
    await destroyWhatsAppClient();
    await clearWhatsAppCache();
    updateStatus({
      restartCount: getStatus().restartCount + 1
    });
    initializeWhatsAppClient()
      .catch((error) => logger.error('Erro ao inicializar na recuperacao:', error));
  } catch (error) {
    updateStatus({
      whatsappStatus: 'erro ao recuperar',
      lastError: error.message,
      restarting: false
    });
    logger.error('Erro ao recuperar cliente WhatsApp:', error);
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
    lastDisconnectedAt: getIsoNow(),
    lastDisconnectedReason: 'sessao apagada pela interface'
  });

  initializeWhatsAppClient()
    .catch((error) => logger.error('Erro ao iniciar WhatsApp apos apagar sessao:', error));
}

async function shutdown(signal) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  logger.info(`Encerrando bot por sinal ${signal}...`);

  try {
    clearReadyWatch();
    stopHealthWatchdog();

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
    startHealthWatchdog();

    interfaceServer = startInterface({
      startWhatsApp: startWhatsAppClient,
      stopWhatsApp: stopWhatsAppClient,
      restartWhatsApp: restartWhatsAppClient,
      recoverWhatsApp: recoverWhatsAppClient,
      clearWhatsAppSession,
      dispararCampanha: async (payload) => {
        if (!client || !getStatus().ready) {
          updateCampaignStatus({
            ativa: false,
            status: 'erro',
            erro: 'WhatsApp nao esta pronto.',
            mensagem: 'Conecte o WhatsApp antes de iniciar a campanha.'
          });
          throw new Error('WhatsApp nao esta pronto. Conecte o WhatsApp antes de iniciar a campanha.');
        }

        await processarCampanhaEmBackground(client, payload);
      },
      enviarSalmoDia: async (payload) => {
        const alvo = payload.alvo || 'teste';

        if (!client || !getStatus().ready) {
          updateCampaignStatus({
            ativa: false,
            status: 'erro',
            erro: 'WhatsApp nao esta pronto.',
            mensagem: 'Conecte o WhatsApp antes de enviar o salmo do dia.'
          });
          throw new Error('WhatsApp nao esta pronto. Conecte o WhatsApp antes de enviar o salmo do dia.');
        }

        if (config.modoTeste && alvo !== 'teste') {
          throw new Error('Modo teste ativo: o salmo do dia so pode ser enviado para os numeros de teste.');
        }

        await processarCampanhaEmBackground(client, {
          alvo,
          texto: menu.getSalmoDoDiaMensagem(),
          delayMinMs: payload.delayMinMs || 10000,
          delayMaxMs: payload.delayMaxMs || 25000
        });
      },
      cancelarCampanha
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
