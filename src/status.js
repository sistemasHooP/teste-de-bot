const startedAt = new Date();

const state = {
  processStartedAt: startedAt.toISOString(),
  whatsappStatus: 'iniciando',
  ready: false,
  authenticated: false,
  initializing: false,
  restarting: false,
  restartCount: 0,
  lastQrAt: null,
  lastQrText: null,
  lastQrAscii: null,
  lastAuthenticatedAt: null,
  lastReadyAt: null,
  lastDisconnectedAt: null,
  lastDisconnectedReason: null,
  lastError: null,
  lastRestartAt: null,
  loadingPercent: null,
  loadingMessage: null
};

function updateStatus(patch) {
  Object.assign(state, patch);
}

function getStatus() {
  return {
    ...state,
    uptimeSeconds: Math.floor((Date.now() - startedAt.getTime()) / 1000)
  };
}

module.exports = {
  updateStatus,
  getStatus
};
