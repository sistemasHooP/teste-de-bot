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
  lastHealthCheckAt: null,
  lastHealthState: null,
  loadingPercent: null,
  loadingMessage: null,
  lastLoadingAt: null,
  campanha: {
    ativa: false,
    cancelando: false,
    status: 'parada',
    id: null,
    alvo: null,
    total: 0,
    enviados: 0,
    falhas: 0,
    ignorados: 0,
    atual: 0,
    numeroAtual: null,
    iniciadaEm: null,
    finalizadaEm: null,
    ultimaAtualizacao: null,
    mensagem: 'Nenhuma campanha em andamento.',
    erro: null,
    proximosSegundos: null
  }
};

function updateStatus(patch) {
  Object.assign(state, patch);
}

function updateCampaignStatus(patch) {
  Object.assign(state.campanha, patch, {
    ultimaAtualizacao: new Date().toISOString()
  });
}

function getCampaignStatus() {
  return {
    ...state.campanha
  };
}

function getStatus() {
  return {
    ...state,
    uptimeSeconds: Math.floor((Date.now() - startedAt.getTime()) / 1000)
  };
}

module.exports = {
  updateStatus,
  getStatus,
  updateCampaignStatus,
  getCampaignStatus
};
