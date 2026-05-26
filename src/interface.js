const http = require('http');
const logger = require('./logger');
const config = require('./config');
const teste = require('./teste');
const menuConfig = require('./menuConfig');
const envManager = require('./envManager');
const startup = require('./startup');
const mensagensRepository = require('./repositories/mensagensRepository');
const clientesRepository = require('./repositories/clientesRepository');
const { getStatus } = require('./status');
const { getTodayKey, normalizeText } = require('./utils');
const gerenciadorListas = require('./gerenciadorListas');
const backup = require('./backup');
const diagnostico = require('./diagnostico');
const { lerHistoricoCampanhas } = require('./campanha');

function getPort() {
  const port = Number(process.env.INTERFACE_PORT || 3333);
  return Number.isFinite(port) && port > 0 ? port : 3333;
}

function sendJson(response, statusCode, data) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  response.end(JSON.stringify(data));
}

function sendHtml(response, html) {
  response.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  response.end(html);
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';

    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 20971520) {
        reject(new Error('Corpo da requisicao muito grande. Maximo 20MB.'));
      }
    });

    request.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
  });
}

function normalizarComandoTeste(texto) {
  const valor = String(texto || '').trim();

  if (valor.startsWith('/')) {
    return valor;
  }

  if (/^\d+(\.\d+)*$/.test(valor)) {
    return `/${valor}`;
  }

  const atalhos = {
    oi: '/ola',
    ola: '/ola',
    menu: '/menu',
    '1': '/1',
    catalogo: '/catalogo',
    '2': '/2',
    endereco: '/endereco',
    '3': '/3',
    agenda: '/agenda',
    agendamento: '/agenda',
    '4': '/4',
    horario: '/horario',
    '5': '/5',
    atendente: '/atendente',
    salmo: '/salmo',
    'salmo do dia': '/salmo',
    teste: '/teste'
  };

  return atalhos[normalizeText(valor)] || valor;
}

function getSnapshot() {
  return {
    status: getStatus(),
    seguranca: {
      botAtivo: config.botAtivo,
      modoTeste: config.modoTeste,
      autoStartWhatsApp: config.autoStartWhatsApp,
      apenasNumerosPermitidos: config.apenasNumerosPermitidos,
      telefonesPermitidos: config.telefonesPermitidos,
      responderTodosClientes: menuConfig.getSafety().responderTodosClientes
    },
    startup: startup.getStartupStatus(),
    operacao: {
      clientesModoHumano: clientesRepository.contarModoHumano(),
      clientesTotal: clientesRepository.contarClientes(),
      ultimoBackup: backup.getLatestBackup(),
      resumoDia: clientesRepository.getResumoDia(getTodayKey())
    },
    diagnostico: diagnostico.gerarDiagnostico(),
    empresa: {
      nome: config.empresa.nome
    },
    logs: logger.getRecentLogs(90)
  };
}

function atualizarResponderTodosClientes(ativo) {
  const currentConfig = menuConfig.loadMenuConfig();
  currentConfig.comportamento.responderTodosClientes = Boolean(ativo);
  return menuConfig.saveMenuConfig(currentConfig);
}

function getHtml() {
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Bot Renaly</title>
  <style>
    :root {
      --bg: #eef3f5;
      --surface: #fff;
      --surface-soft: #f5f9f7;
      --surface-strong: #e6f2ed;
      --text: #1c2621;
      --muted: #68736d;
      --line: #dce5df;
      --accent: #0b7a5a;
      --accent2: #f2b84b;
      --danger: #a82727;
      --warn: #9b5c00;
      --shadow: 0 12px 34px rgba(20, 34, 27, 0.08);
    }
    * { box-sizing: border-box; }
    body { margin: 0; background: linear-gradient(180deg, #e4edf2 0, var(--bg) 210px); color: var(--text); font-family: Arial, Helvetica, sans-serif; }
    header { background: var(--surface); color: var(--text); padding: 16px 26px; display: flex; align-items: center; justify-content: space-between; gap: 16px; border-bottom: 1px solid var(--line); box-shadow: 0 2px 8px rgba(20, 34, 27, 0.06); position: sticky; top: 0; z-index: 20; }
    h1, h2, h3 { margin: 0; }
    h1 { font-size: 21px; }
    h2 { font-size: 17px; margin-bottom: 14px; }
    h3 { font-size: 15px; margin: 18px 0 10px; }
    main { width: min(1280px, calc(100% - 28px)); margin: 22px auto 42px; display: grid; gap: 16px; }
    .brand { display: flex; align-items: center; gap: 12px; }
    .mark { width: 42px; height: 42px; border-radius: 10px; background: var(--accent); color: white; display: grid; place-items: center; font-weight: 800; }
    .sub { color: var(--muted); font-size: 13px; margin-top: 2px; }
    .grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 14px; }
    .split { display: grid; grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr); gap: 16px; }
    .app-shell { display: grid; grid-template-columns: 230px minmax(0, 1fr); gap: 16px; align-items: start; }
    .workspace { display: grid; gap: 16px; min-width: 0; }
    .sidebar { position: sticky; top: 92px; padding: 12px; }
    .sidebar-title { color: var(--muted); font-size: 12px; text-transform: uppercase; font-weight: 800; letter-spacing: 0.04em; padding: 5px 7px 10px; }
    .panel, .metric, .option { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; box-shadow: var(--shadow); }
    .metric { padding: 16px; min-height: 108px; }
    .metric { background: linear-gradient(135deg, #ffffff 0%, #f7fbf9 100%); }
    .panel { padding: 18px; }
    .option { padding: 14px; margin: 12px 0; box-shadow: none; }
    .children { border-left: 3px solid #dfe9e3; margin-left: 10px; padding-left: 14px; }
    .label { color: var(--muted); font-size: 12px; text-transform: uppercase; font-weight: 700; }
    .value { margin-top: 8px; font-size: 22px; font-weight: 800; overflow-wrap: anywhere; }
    .hint { color: var(--muted); font-size: 13px; margin-top: 6px; overflow-wrap: anywhere; }
    .row { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
    .field-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    label { display: grid; gap: 6px; color: var(--muted); font-size: 13px; font-weight: 700; }
    input, textarea, select { width: 100%; border: 1px solid var(--line); border-radius: 8px; background: white; color: var(--text); font: inherit; padding: 10px 12px; }
    input, select { min-height: 42px; }
    input[type="checkbox"] { width: 18px; height: 18px; min-height: 0; padding: 0; margin: 0; vertical-align: middle; accent-color: var(--accent); }
    textarea { min-height: 92px; resize: vertical; }
    button { border: 0; border-radius: 8px; min-height: 40px; padding: 9px 13px; background: var(--accent); color: white; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; }
    button.secondary { background: #e8eee9; color: var(--text); border: 1px solid var(--line); }
    button.warning { background: var(--warn); }
    button.danger { background: var(--danger); }
    button:disabled { opacity: 0.6; cursor: wait; }
    .pill { display: inline-flex; align-items: center; min-height: 28px; padding: 4px 10px; border-radius: 999px; font-size: 13px; font-weight: 800; background: #fff2d8; color: var(--warn); }
    .pill.ok { color: var(--accent); background: #dff3ec; }
    .pill.danger { color: var(--danger); background: #fde6e6; }
    .tabs { display: grid; gap: 7px; }
    .tab-button { background: #edf3ef; color: var(--text); border: 1px solid var(--line); width: 100%; justify-content: flex-start; text-align: left; }
    .tab-button.active { background: var(--accent); color: white; border-color: var(--accent); }
    .tab-panel { display: none; }
    .tab-panel.active { display: grid; gap: 16px; }
    .logs { max-height: 330px; overflow: auto; background: #101714; color: #e6eee9; border-radius: 8px; padding: 14px; }
    pre { margin: 0; white-space: pre-wrap; word-break: break-word; font-family: Consolas, Monaco, monospace; font-size: 13px; }
    .answer { background: var(--surface-soft); border: 1px solid var(--line); border-radius: 8px; padding: 14px; min-height: 82px; margin-top: 12px; }
    .qr-box { display: grid; gap: 10px; place-items: center; min-height: 220px; background: #f7faf8; border: 1px dashed var(--line); border-radius: 8px; padding: 14px; text-align: center; }
    .qr-code { display: none; background: white; color: black; border: 10px solid white; border-radius: 4px; font-family: Consolas, "Courier New", monospace; font-size: 10px; line-height: 10px; letter-spacing: 0; white-space: pre; word-break: normal; overflow: auto; max-width: 100%; }
    .qr-code.active { display: block; }
    .security-banner { border-radius: 8px; padding: 12px 14px; border: 1px solid var(--line); background: #f7faf8; margin-bottom: 14px; }
    .security-banner strong { display: block; margin-bottom: 4px; }
    .security-banner.production { background: #fff8e8; border-color: #f3cf8d; }
    .security-banner.paused { background: #fde6e6; border-color: #efb2b2; }
    .checklist { display: grid; gap: 8px; margin-top: 12px; }
    .check-item { display: flex; align-items: flex-start; gap: 8px; color: var(--muted); font-size: 13px; }
    .check-dot { width: 9px; height: 9px; border-radius: 999px; background: var(--accent); margin-top: 4px; flex: 0 0 auto; }
    .check-dot.warn { background: var(--warn); }
    .check-dot.danger { background: var(--danger); }
    .diagnostic-list { display: grid; gap: 10px; }
    .diagnostic-item { border: 1px solid var(--line); border-left: 4px solid var(--accent); border-radius: 8px; padding: 10px; background: #f7faf8; }
    .diagnostic-item.aviso { border-left-color: var(--warn); background: #fff8e8; }
    .diagnostic-item.erro { border-left-color: var(--danger); background: #fde6e6; }
    .diagnostic-item strong { display: block; margin-bottom: 3px; }
    .menu-preview { min-height: 260px; max-height: 440px; overflow: auto; }
    .progress-wrap { width: 100%; height: 14px; border-radius: 999px; background: #e8eee9; overflow: hidden; border: 1px solid var(--line); }
    .progress-bar { width: 0%; height: 100%; background: var(--accent); transition: width 0.25s ease; }
    .table-wrap { max-height: 300px; overflow: auto; border: 1px solid var(--line); border-radius: 8px; background: white; }
    .table-wrap.compact { max-height: 220px; }
    .simple-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .simple-table th, .simple-table td { padding: 9px 10px; border-bottom: 1px solid var(--line); text-align: left; }
    .simple-table th { background: #f4f7f5; color: var(--muted); font-size: 12px; text-transform: uppercase; position: sticky; top: 0; }
    .check-cell { width: 44px; text-align: center !important; }
    .table-action { min-height: 30px; padding: 5px 9px; font-size: 12px; }
    .action-band { border: 1px solid var(--line); border-radius: 8px; background: #f7faf8; padding: 14px; margin-top: 14px; }
    .action-band h3 { margin-top: 0; }
    .message-builder { display: grid; gap: 14px; }
    .message-card { border: 1px solid #cfe2d9; border-radius: 8px; background: var(--surface-soft); padding: 14px; }
    .message-card.primary { background: var(--surface-strong); border-color: #badbce; }
    .message-card h3 { margin-top: 0; color: #24483c; }
    .message-card textarea, .message-card input { background: white; }
    .section-title { display: flex; align-items: center; gap: 8px; margin: 18px 0 10px; }
    .section-title h2, .section-title h3 { margin: 0; }
    .field-title { display: inline-flex; align-items: center; gap: 6px; color: var(--muted); font-size: 13px; font-weight: 700; }
    .help-btn { width: 24px; height: 24px; min-height: 24px; padding: 0; border-radius: 999px; background: #e8eee9; color: var(--accent); border: 1px solid var(--line); font-weight: 800; }
    .hidden { display: none !important; }
    .tag-grid { display: grid; gap: 10px; }
    .tag-item { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; align-items: stretch; }
    .tag-copy { justify-content: space-between; gap: 10px; background: #edf3ef; color: var(--text); border: 1px solid var(--line); min-height: 46px; width: 100%; }
    .tag-copy code { color: var(--accent); font-weight: 800; }
    .tag-copy span { color: var(--muted); font-size: 12px; font-weight: 700; text-align: right; }
    .tag-float-button { position: fixed; right: 18px; bottom: 86px; z-index: 50; box-shadow: var(--shadow); }
    .tag-float-panel { display: none; position: fixed; right: 18px; bottom: 136px; width: min(420px, calc(100vw - 36px)); max-height: min(620px, calc(100vh - 180px)); overflow: auto; z-index: 50; background: var(--surface); border: 1px solid var(--line); border-radius: 8px; box-shadow: 0 20px 54px rgba(20, 34, 27, 0.18); padding: 14px; }
    .tag-float-panel.active { display: block; }
    .tag-panel-header { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 8px; }
    .menu-layout { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(340px, 0.65fr); gap: 16px; align-items: start; }
    .option .field-grid { grid-template-columns: 90px minmax(0, 1fr) 170px; }
    .wide-field { grid-column: 1 / -1; }
    .option textarea { min-height: 150px; }
    .whatsapp-preview { background: #e7ddd3; border: 1px solid var(--line); border-radius: 8px; padding: 18px; margin-top: 12px; }
    .whatsapp-bubble { width: min(430px, 100%); background: #dcf8c6; border-radius: 8px; padding: 10px; box-shadow: 0 2px 8px rgba(20, 34, 27, 0.10); }
    .whatsapp-image { display: none; width: 100%; max-height: 280px; object-fit: cover; border-radius: 6px; margin-bottom: 8px; background: #c9d7ce; }
    .button-row { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-top: 10px; }
    .split-actions { justify-content: space-between; }
    .left-actions { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
    .button-row .primary-action { background: var(--accent); }
    .status-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin: 12px 0; }
    .mini-metric { background: #f7faf8; border: 1px solid var(--line); border-radius: 8px; padding: 10px; }
    .mini-metric strong { display: block; font-size: 20px; margin-top: 4px; }
    .save-bar { position: sticky; bottom: 0; background: rgba(244, 247, 245, 0.92); backdrop-filter: blur(8px); padding: 12px 0 0; }
    @media (max-width: 1100px) { .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 920px) {
      header { flex-direction: column; align-items: flex-start; }
      .grid, .split, .field-grid, .status-grid, .app-shell, .tag-grid, .menu-layout { grid-template-columns: 1fr; }
      .sidebar { position: static; }
      .tabs { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
  </style>
</head>
<body>
  <header>
    <div class="brand">
      <div class="mark">RB</div>
      <div>
        <h1>Bot Renaly</h1>
        <div class="sub">Interface local de atendimento WhatsApp</div>
      </div>
    </div>
    <span id="status-pill" class="pill">Carregando</span>
  </header>

  <main>
    <section class="grid">
      <div class="metric"><div class="label">WhatsApp</div><div id="whatsapp-status" class="value">...</div><div id="last-ready" class="hint">...</div></div>
      <div class="metric"><div class="label">Bot Ativo</div><div id="bot-ativo" class="value">...</div><div class="hint">Respostas automaticas</div></div>
      <div class="metric"><div class="label">Modo Teste</div><div id="modo-teste" class="value">...</div><div class="hint">Protecao de teste</div></div>
      <div class="metric"><div class="label">Permitidos</div><div id="permitidos" class="value">...</div><div class="hint">Whitelist atual</div></div>
      <div class="metric"><div class="label">Modo Humano</div><div id="modo-humano-total" class="value">0</div><div class="hint">Clientes pausados</div></div>
    </section>

    <section class="app-shell">
      <aside class="panel sidebar">
        <div class="sidebar-title">Modulos do sistema</div>
        <div class="tabs">
        <button class="tab-button active" data-tab="controle">Controle</button>
        <button class="tab-button" data-tab="empresa">Empresa</button>
        <button class="tab-button" data-tab="atendimentos">Atendimentos</button>
        <button class="tab-button" data-tab="mensagens">Mensagens</button>
        <button class="tab-button" data-tab="menus">Menus</button>
        <button class="tab-button" data-tab="comportamento">Comportamento</button>
        <button class="tab-button" data-tab="salmo">Salmo do Dia</button>
        <button class="tab-button" data-tab="campanhas">Campanhas</button>
        <button class="tab-button" data-tab="logs">Logs</button>
        </div>
      </aside>

      <div class="workspace">

    <section id="tab-controle" class="tab-panel active">
      <div class="split">
        <div class="panel">
          <h2>Controle do Bot</h2>
          <div id="security-banner" class="security-banner">
            <strong id="security-title">Carregando seguranca</strong>
            <span id="security-text">Aguarde...</span>
          </div>
          <div class="checklist" id="production-checklist"></div>
          <div class="action-band">
            <h3>Operacao diaria</h3>
            <div class="row">
              <button id="start">Iniciar Bot</button>
              <button id="refresh" class="secondary">Atualizar Status</button>
              <button id="stop" class="danger">Parar WhatsApp</button>
            </div>
          </div>
          <div class="action-band">
            <h3>Manutencao da conexao</h3>
            <div class="row">
              <button id="recover" class="warning">Reparar Conexao</button>
              <button id="restart" class="warning">Reiniciar WhatsApp</button>
              <button id="clear-session" class="danger">Apagar Sessao WhatsApp</button>
            </div>
            <p class="hint">Use apagar sessao apenas quando precisar gerar um novo QR Code.</p>
          </div>
          <p class="hint" id="runtime-info"></p>
          <h3>Windows</h3>
          <div class="row">
            <button id="startup-enable" class="secondary">Iniciar com Windows</button>
            <button id="startup-disable" class="secondary">Remover da inicializacao</button>
          </div>
          <div class="field-grid" style="margin-top: 12px;">
            <label>Iniciar WhatsApp ao abrir o programa
              <select id="auto-start-whatsapp">
                <option value="false">Nao</option>
                <option value="true">Sim</option>
              </select>
            </label>
            <label>Status da inicializacao<input id="startup-state" readonly></label>
          </div>
          <h3>Backup</h3>
          <div class="row">
            <button id="create-backup" class="secondary">Criar Backup Agora</button>
            <button id="refresh-backups" class="secondary">Atualizar Backups</button>
          </div>
          <p class="hint" id="backup-status">Ultimo backup: carregando...</p>
          <div class="table-wrap compact">
            <table class="simple-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Tamanho</th>
                </tr>
              </thead>
              <tbody id="backups-tbody"></tbody>
            </table>
          </div>
        </div>
        <div class="panel">
          <h2>Conexao WhatsApp</h2>
          <div class="qr-box">
            <pre id="qr-code" class="qr-code"></pre>
            <div id="qr-empty" class="hint">Quando o WhatsApp pedir conexao, o QR Code aparece aqui.</div>
          </div>
          <p id="qr-info" class="hint"></p>
          <h3>Teste de Resposta</h3>
          <div class="row">
            <input id="test-input" placeholder="Digite oi, menu, 1, 1.1, /agenda ou /salmo">
            <button id="test-button">Testar</button>
          </div>
          <div class="answer"><pre id="test-output">A resposta aparece aqui sem enviar nada pelo WhatsApp.</pre></div>
        </div>
      </div>
      <div class="panel">
        <h2>Clientes em Modo Humano</h2>
        <p class="hint">Quando o cliente escolhe falar com atendente, ele aparece aqui e o bot automatico fica pausado para esse numero.</p>
        <div class="row" style="margin-bottom: 12px;">
          <button id="refresh-humanos" class="secondary">Atualizar Lista</button>
        </div>
        <div class="table-wrap compact">
          <table class="simple-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Telefone</th>
                <th>Atualizado</th>
                <th>Acao</th>
              </tr>
            </thead>
            <tbody id="humanos-tbody"></tbody>
          </table>
        </div>
      </div>
      <div class="panel">
        <h2>Diagnostico do Sistema</h2>
        <div id="diagnostico-list" class="diagnostic-list"></div>
      </div>
    </section>

    <section id="tab-empresa" class="tab-panel">
      <div class="split">
        <div class="panel">
          <h2>Dados da Empresa</h2>
          <p class="hint">Esses dados alimentam as tags usadas nas mensagens do bot.</p>
          <div class="field-grid">
            <label>Nome da empresa<input id="empresa-nome" placeholder="Renaly Basilio Estetica"></label>
            <label>Telefone da empresa<input id="empresa-telefone" placeholder="(84) 99999-9999"></label>
            <label style="grid-column: 1 / -1;">Endereco<input id="empresa-endereco" placeholder="Rua, numero, bairro, cidade"></label>
            <label>Ponto de referencia<input id="empresa-ponto" placeholder="Proximo a..."></label>
            <label>Horario de funcionamento<input id="empresa-horario" placeholder="Segunda a sexta: 08h as 18h"></label>
            <label>Link do Google Maps<input id="empresa-maps" placeholder="https://maps.google.com/..."></label>
            <label>Link de agendamento<input id="empresa-agenda" placeholder="https://..."></label>
            <label>Instagram<input id="empresa-instagram" placeholder="@empresa"></label>
            <label>E-mail<input id="empresa-email" placeholder="contato@empresa.com"></label>
          </div>
        </div>
        <div class="panel">
          <h2>Tags Rapidas</h2>
          <p class="hint">Use o botao Copiar para copiar a tag ou Inserir para colocar no campo de texto selecionado.</p>
          <div id="tags-list" class="tag-grid"></div>
          <div class="answer"><pre>{saudacao}! Aqui e o bot da {empresa}.

Nosso endereco: {endereco}
Agende aqui: {agendamento_url}</pre></div>
        </div>
      </div>
    </section>

    <section id="tab-mensagens" class="tab-panel">
      <div class="panel">
        <h2>Mensagens Personalizadas</h2>
        <div class="message-builder">
          <div class="message-card primary">
            <h3>1. Recepcao antes do menu</h3>
            <label>Mensagem enviada primeiro<textarea id="menu-recepcao" placeholder="{saudacao}! Aqui e o bot da {empresa}."></textarea></label>
          </div>

          <div class="message-card">
            <h3>2. Cabecalho do menu</h3>
            <div class="field-grid">
              <label>Titulo do menu principal<textarea id="menu-titulo"></textarea></label>
              <label>Texto abaixo do titulo<textarea id="menu-subtitulo"></textarea></label>
            </div>
          </div>

          <div class="message-card">
            <h3>3. Textos dentro do menu</h3>
            <div class="field-grid">
              <label>Texto antes das opcoes<input id="menu-instrucao"></label>
              <label>Texto final do menu<input id="menu-rodape"></label>
            </div>
          </div>

          <div class="message-card">
            <h3>4. Palavras de chamada</h3>
            <div class="field-grid">
              <label>Palavras para voltar ao menu<input id="menu-palavras" placeholder="menu, inicio, voltar"></label>
              <label>Saudacoes<input id="menu-saudacoes" placeholder="oi, ola, bom dia"></label>
            </div>
          </div>

          <div class="message-card">
            <h3>5. Respostas ainda usadas pelo bot</h3>
            <div class="field-grid">
              <label>Numero/opcao invalida<textarea id="menu-invalida"></textarea></label>
              <label style="grid-column: 1 / -1;">Atendimento humano<textarea id="menu-humano"></textarea></label>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section id="tab-atendimentos" class="tab-panel">
      <div class="panel">
        <h2>Atendimentos Recentes</h2>
        <div class="status-grid">
          <div class="mini-metric"><span class="label">Novos Hoje</span><strong id="dia-clientes-novos">0</strong></div>
          <div class="mini-metric"><span class="label">Atualizados Hoje</span><strong id="dia-clientes-atualizados">0</strong></div>
          <div class="mini-metric"><span class="label">Modo Humano</span><strong id="dia-modo-humano">0</strong></div>
          <div class="mini-metric"><span class="label">Data</span><strong id="dia-data">-</strong></div>
        </div>
        <div class="field-grid">
          <label>Pesquisar
            <input id="atendimentos-search" placeholder="Nome ou telefone">
          </label>
          <label>Status
            <select id="atendimentos-status">
              <option value="todos">Todos</option>
              <option value="humano">Modo humano</option>
              <option value="automatico">Automatico</option>
              <option value="silenciado">Silenciado</option>
            </select>
          </label>
        </div>
        <div class="row" style="margin: 12px 0;">
          <button id="refresh-atendimentos" class="secondary">Atualizar Atendimentos</button>
        </div>
        <div class="table-wrap">
          <table class="simple-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Telefone</th>
                <th>Status</th>
                <th>Ultimo menu</th>
                <th>Atualizado</th>
                <th>Acao</th>
              </tr>
            </thead>
            <tbody id="atendimentos-tbody"></tbody>
          </table>
        </div>
      </div>
    </section>

    <section id="tab-menus" class="tab-panel">
      <div class="menu-layout">
        <div class="panel">
          <div class="section-title" style="margin-top: 0;">
            <h2>Menus e Submenus</h2>
            <button type="button" class="help-btn" data-help="Aqui voce muda numero, titulo e tipo de cada opcao. Para transformar o atendente em opcao 1, edite o numero da opcao Falar com atendente para 1 e ajuste os outros numeros para nao repetir.">?</button>
          </div>
          <div class="row">
            <button id="add-option" class="secondary">Adicionar Opcao</button>
            <button id="add-example" class="secondary">Adicionar Exemplo com Submenu</button>
          </div>
          <div id="options-editor"></div>
        </div>
        <div class="panel">
          <h2>Previa do Menu</h2>
          <div class="answer menu-preview"><pre id="menu-preview">Carregando previa...</pre></div>
          <h3>Avisos do Menu</h3>
          <div id="menu-alerts" class="diagnostic-list"></div>
        </div>
      </div>
    </section>

    <section id="tab-comportamento" class="tab-panel">
      <div class="panel">
        <h2>Comportamento e Seguranca</h2>
        <div class="field-grid">
          <label><span class="field-title">Quando reenviar recepcao e menu inicial <button type="button" class="help-btn" data-help="Define de quanto em quanto tempo o bot pode enviar novamente a recepcao e o menu para o mesmo cliente. Em producao, use Todo dia para atender a primeira mensagem do dia.">?</button></span>
            <select id="intervalo-menu">
              <option value="1">Todo dia</option>
              <option value="2">A cada 2 dias</option>
              <option value="3">A cada 3 dias</option>
              <option value="7">A cada 7 dias</option>
            </select>
          </label>
          <label><span class="field-title">Salvar historico de mensagens <button type="button" class="help-btn" data-help="Se estiver como Nao, o bot fica mais leve e nao guarda o texto das conversas antigas. Clientes e configuracoes continuam salvos.">?</button></span>
            <select id="historico-ativo">
              <option value="false">Nao, modo leve</option>
              <option value="true">Sim</option>
            </select>
          </label>
          <label><span class="field-title">Atender clientes reais fora da lista de teste <button type="button" class="help-btn" data-help="Quando estiver Sim e o modo teste estiver desligado, o bot responde clientes reais que enviarem mensagem primeiro. Deixe Nao enquanto estiver testando.">?</button></span>
            <select id="responder-todos">
              <option value="false">Nao, manter seguro</option>
              <option value="true">Sim, producao segura</option>
            </select>
          </label>
          <label><span class="field-title">Mostrar digitando <button type="button" class="help-btn" data-help="Faz o WhatsApp mostrar o status digitando antes do bot responder. Ajuda a parecer mais natural, mas pode adicionar uma pequena espera.">?</button></span>
            <select id="digitando-ativo">
              <option value="false">Nao</option>
              <option value="true">Sim</option>
            </select>
          </label>
          <label><span class="field-title">Enviar mensagem antes do menu <button type="button" class="help-btn" data-help="Envia primeiro a mensagem de recepcao, por exemplo Bom dia, aqui e o bot da empresa. Depois da pausa, envia o menu.">?</button></span>
            <select id="recepcao-menu-ativa">
              <option value="true">Sim</option>
              <option value="false">Nao</option>
            </select>
          </label>
          <label><span class="field-title">Janela para aceitar opcoes em minutos <button type="button" class="help-btn" data-help="Tempo em que numeros do menu, como 1 ou 5, ficam valendo para aquele cliente. Depois disso, numeros soltos sao ignorados por seguranca.">?</button></span><input id="janela-menu" type="number" min="1" max="1440" step="1"></label>
          <label><span class="field-title">Tempo digitando em ms <button type="button" class="help-btn" data-help="Quanto tempo o bot fica mostrando digitando antes de enviar a resposta. 1000 ms equivale a 1 segundo.">?</button></span><input id="tempo-digitando" type="number" min="0" step="100"></label>
          <label><span class="field-title">Atraso extra em ms <button type="button" class="help-btn" data-help="Pausa adicional aplicada antes de cada resposta automatica. Use 0 se quiser resposta mais rapida.">?</button></span><input id="atraso-resposta" type="number" min="0" step="100"></label>
          <label><span class="field-title">Espera entre recepcao e menu em ms <button type="button" class="help-btn" data-help="Pausa entre a mensagem de recepcao e o menu inicial. Exemplo: 3000 ms equivale a 3 segundos.">?</button></span><input id="atraso-menu-inicial" type="number" min="0" max="30000" step="500"></label>
        </div>
        <div class="section-title">
          <h3>Extra depois do menu inicial</h3>
          <button type="button" class="help-btn" data-help="Use quando quiser enviar uma mensagem extra logo depois do menu inicial. Se escolher Salmo do Dia, o campo abaixo pode usar a tag {salmo_do_dia}; se nao usar, o bot acrescenta o salmo ao final.">?</button>
        </div>
        <div class="field-grid">
          <label><span class="field-title">O que enviar depois do menu <button type="button" class="help-btn" data-help="Escolha se o bot deve enviar nada, um texto simples ou um salmo logo depois do menu inicial.">?</button></span>
            <select id="apos-menu-modo">
              <option value="nenhum">Nao enviar nada</option>
              <option value="texto">Texto simples</option>
              <option value="salmo">Salmo do Dia</option>
            </select>
          </label>
          <label><span class="field-title">Espera depois do menu em ms <button type="button" class="help-btn" data-help="Pausa antes de enviar o extra depois do menu inicial. Exemplo: 1500 ms equivale a 1,5 segundo.">?</button></span><input id="apos-menu-atraso" type="number" min="0" max="30000" step="500"></label>
          <label id="apos-menu-texto-wrap" style="grid-column: 1 / -1;"><span class="field-title"><span id="apos-menu-texto-label">Texto simples</span> <button type="button" class="help-btn" data-help="Se o modo for Texto simples, envia exatamente este texto. Se o modo for Salmo do Dia, use {salmo_do_dia} para escolher onde o salmo entra; sem a tag, o salmo vai ao final.">?</button></span><textarea id="apos-menu-texto"></textarea></label>
        </div>
        <div class="section-title">
          <h3>Extra ao chamar atendente</h3>
          <button type="button" class="help-btn" data-help="Use quando o cliente escolher a opcao Falar com atendente. O bot responde a mensagem do atendente e, depois da espera configurada, envia este extra.">?</button>
        </div>
        <div class="field-grid">
          <label><span class="field-title">O que enviar depois de chamar atendente <button type="button" class="help-btn" data-help="Define se o bot envia uma mensagem extra depois que o cliente escolhe falar com atendente. Isso acontece antes de pausar o automatico.">?</button></span>
            <select id="espera-modo">
              <option value="nenhum">Nao enviar nada</option>
              <option value="texto">Texto simples</option>
              <option value="biblia">Palavra Biblica de Espera</option>
              <option value="salmo">Salmo do Dia</option>
            </select>
          </label>
          <label><span class="field-title">Espera antes da mensagem em ms <button type="button" class="help-btn" data-help="Pausa antes de enviar o extra quando o cliente pede atendente. Exemplo: 1500 ms equivale a 1,5 segundo.">?</button></span><input id="espera-atraso" type="number" min="0" max="30000" step="500"></label>
          <label id="espera-texto-wrap" style="grid-column: 1 / -1;"><span class="field-title"><span id="espera-texto-label">Texto simples</span> <button type="button" class="help-btn" data-help="No modo Texto simples, envia exatamente este texto. No modo Palavra Biblica de Espera, este texto aparece antes da palavra biblica. Se escolher Salmo do Dia, o texto vem da aba Salmo do Dia.">?</button></span><textarea id="espera-texto"></textarea></label>
        </div>
        <h3>Modo de Uso</h3>
        <div class="field-grid">
          <label><span class="field-title">Numeros permitidos para teste <button type="button" class="help-btn" data-help="Lista de numeros ou IDs permitidos enquanto o modo teste estiver ligado. Separe por virgula. Contatos @lid tambem podem ser adicionados aqui.">?</button></span><input id="telefones-teste" placeholder="558499210586"></label>
          <label><span class="field-title">Ao liberar producao <button type="button" class="help-btn" data-help="Escolha se quer limpar a lista de teste ao clicar em Sair do teste e usar. Normalmente, remover e mais seguro.">?</button></span>
            <select id="remover-telefone-teste">
              <option value="true">Remover numero de teste</option>
              <option value="false">Manter numero de teste</option>
            </select>
          </label>
        </div>
        <div class="row" style="margin-top: 12px;">
          <button id="modo-teste-seguro" class="secondary">Ativar modo teste seguro</button>
          <button type="button" class="help-btn" data-help="Liga BOT_ATIVO, MODO_TESTE e limita respostas aos numeros permitidos. Use durante testes.">?</button>
          <button id="producao-segura" class="warning">Sair do teste e usar</button>
          <button type="button" class="help-btn" data-help="Desliga o modo teste e permite atender clientes reais que chamarem primeiro. Revise empresa, menu e agendamento antes.">?</button>
          <button id="limpar-telefones" class="secondary">Remover numeros de teste</button>
          <button type="button" class="help-btn" data-help="Apaga a lista de numeros permitidos para teste. Use quando for liberar producao ou limpar testes antigos.">?</button>
          <button id="limpar-silencios" class="secondary">Destravar Clientes Silenciados</button>
          <button type="button" class="help-btn" data-help="Remove o silencio aplicado em clientes que ignoraram o menu, permitindo que sejam atendidos novamente.">?</button>
          <button id="desativar-bot" class="danger">Parar respostas automaticas</button>
          <button type="button" class="help-btn" data-help="Desliga as respostas automaticas do bot sem desconectar o WhatsApp. Use se precisar pausar tudo.">?</button>
        </div>
        <p class="hint">Em producao, numero de opcao so vale enquanto o menu daquele cliente esta ativo. Se a pessoa ignorar o menu e mandar outra coisa, o bot silencia esse cliente ate o proximo ciclo configurado. Em modo teste, numeros permitidos nao sao silenciados para facilitar os testes.</p>
        <div class="row">
          <button id="clear-history" class="danger">Limpar Historico Antigo</button>
          <button type="button" class="help-btn" data-help="Remove mensagens antigas salvas no banco. Nao apaga clientes, menus ou configuracoes.">?</button>
        </div>
      </div>
    </section>

    <section id="tab-salmo" class="tab-panel">
      <div class="split">
        <div class="panel">
          <div class="section-title" style="margin-top: 0;">
            <h2>Salmo do Dia</h2>
            <button type="button" class="help-btn" data-help="Esta aba define o texto do Salmo do Dia usado no menu e no envio manual. O extra do atendente pode usar uma Palavra Biblica de Espera separada.">?</button>
          </div>
          <p class="hint">Envio manual para clientes que ja interagiram com o bot. Este envio ignora o silencio do menu, mas continua sendo um envio um a um com pausa.</p>
          <div class="field-grid">
            <label>Publico
              <select id="salmo-alvo">
                <option value="teste">Apenas numeros de teste</option>
                <option value="todos">Clientes que ja interagiram</option>
              </select>
            </label>
            <label>Pausa minima entre envios
              <select id="salmo-delay-min">
                <option value="10000">10 segundos</option>
                <option value="20000">20 segundos</option>
                <option value="30000">30 segundos</option>
              </select>
            </label>
            <label>Pausa maxima entre envios
              <select id="salmo-delay-max">
                <option value="25000">25 segundos</option>
                <option value="45000">45 segundos</option>
                <option value="60000">60 segundos</option>
              </select>
            </label>
          </div>
          <h3>Mensagem da Clinica</h3>
          <p class="hint">Use a tag <code>{salmo_do_dia}</code> para escolher exatamente onde o salmo entra. Se nao usar essa tag, o bot coloca o salmo automaticamente entre os dois textos.</p>
          <div class="field-grid">
            <label style="grid-column: 1 / -1;">Texto do salmo com tag opcional<textarea id="salmo-mensagem-antes"></textarea></label>
            <label style="grid-column: 1 / -1;">Texto final depois do salmo<textarea id="salmo-mensagem-depois"></textarea></label>
          </div>
          <div class="row" style="margin-top: 12px;">
            <button id="btn-enviar-salmo" class="warning">Enviar Salmo do Dia</button>
            <button id="btn-cancelar-salmo" class="danger">Cancelar Envio</button>
          </div>
          <p class="hint">Use este recurso com cuidado: ele deve ser usado apenas para pessoas que ja falaram com a clinica e aceitam receber mensagens.</p>
        </div>
        <div class="panel">
          <h2>Previa no WhatsApp</h2>
          <div class="whatsapp-preview">
            <div class="whatsapp-bubble">
              <pre id="salmo-preview">Carregando previa...</pre>
            </div>
          </div>
          <p id="salmo-estimativa" class="hint"></p>
          <div class="status-grid">
            <div class="mini-metric"><span class="label">Total</span><strong id="salmo-total">0</strong></div>
            <div class="mini-metric"><span class="label">Enviados</span><strong id="salmo-enviados">0</strong></div>
            <div class="mini-metric"><span class="label">Falhas</span><strong id="salmo-falhas">0</strong></div>
            <div class="mini-metric"><span class="label">Ignorados</span><strong id="salmo-ignorados">0</strong></div>
          </div>
          <div class="progress-wrap"><div id="salmo-progress" class="progress-bar"></div></div>
          <p id="salmo-status" class="hint">Nenhum envio de salmo em andamento.</p>
        </div>
      </div>
    </section>

    <section id="tab-campanhas" class="tab-panel">
      <div class="panel">
        <h2>Campanha Segura</h2>
        <p class="hint">Use apenas para contatos que autorizaram receber mensagens. O envio e feito um a um, com pausa entre cada contato.</p>
        <div class="field-grid">
          <label>Publico da campanha
            <select id="campanha-alvo">
              <option value="teste">Apenas numeros de teste</option>
              <option value="lista_salva">Lista salva</option>
              <option value="personalizado">Colar numeros manualmente</option>
              <option value="todos">Clientes salvos no banco</option>
            </select>
          </label>
          <label id="label-campanha-lista-salva">Lista salva
            <select id="campanha-lista-salva"></select>
          </label>
          <label>Pausa minima entre envios
            <select id="campanha-delay-min">
              <option value="10000">10 segundos</option>
              <option value="20000">20 segundos</option>
              <option value="30000">30 segundos</option>
            </select>
          </label>
          <label>Pausa maxima entre envios
            <select id="campanha-delay-max">
              <option value="25000">25 segundos</option>
              <option value="45000">45 segundos</option>
              <option value="60000">60 segundos</option>
            </select>
          </label>
          <label id="label-campanha-lista" style="grid-column: 1 / -1;">Numeros manuais
            <textarea id="campanha-lista" placeholder="5584999999999&#10;5584888888888"></textarea>
          </label>
          <label style="grid-column: 1 / -1;">Mensagem
            <textarea id="campanha-texto" placeholder="Digite a mensagem da campanha"></textarea>
          </label>
          <label style="grid-column: 1 / -1;">Imagem opcional
            <input type="file" id="campanha-imagem" accept="image/png,image/jpeg,image/jpg">
          </label>
        </div>
        <h3>Previa antes de enviar</h3>
        <div class="whatsapp-preview">
          <div class="whatsapp-bubble">
            <img id="campanha-preview-imagem" class="whatsapp-image" alt="Previa da imagem da campanha">
            <pre id="campanha-preview">Preencha a campanha para ver a previa.</pre>
          </div>
        </div>
        <p id="campanha-estimativa" class="hint"></p>
        <div class="row" style="margin-top: 12px;">
          <button id="btn-disparar-campanha" class="warning">Iniciar Campanha</button>
          <button id="btn-cancelar-campanha" class="danger">Cancelar Campanha</button>
          <button id="btn-duplicar-campanha" class="secondary">Duplicar Ultima Campanha</button>
        </div>
        <div class="status-grid">
          <div class="mini-metric"><span class="label">Total</span><strong id="camp-total">0</strong></div>
          <div class="mini-metric"><span class="label">Enviados</span><strong id="camp-enviados">0</strong></div>
          <div class="mini-metric"><span class="label">Falhas</span><strong id="camp-falhas">0</strong></div>
          <div class="mini-metric"><span class="label">Ignorados</span><strong id="camp-ignorados">0</strong></div>
        </div>
        <div class="progress-wrap"><div id="camp-progress" class="progress-bar"></div></div>
        <p id="campanha-status" class="hint">Nenhuma campanha em andamento.</p>
        <h3>Relatorio da campanha</h3>
        <div class="answer"><pre id="campanha-relatorio">Nenhuma campanha executada nesta sessao.</pre></div>
        <div class="row" style="margin-top: 12px;">
          <button id="btn-copiar-relatorio-campanha" class="secondary">Copiar Relatorio</button>
          <button id="btn-exportar-relatorio-campanha" class="secondary">Exportar Relatorio</button>
        </div>
        <h3>Ultimas campanhas</h3>
        <div class="table-wrap compact">
          <table class="simple-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Status</th>
                <th>Publico</th>
                <th>Enviados</th>
                <th>Falhas</th>
                <th>Ignorados</th>
              </tr>
            </thead>
            <tbody id="campanhas-historico-tbody"></tbody>
          </table>
        </div>
      </div>

      <div class="panel">
        <h2>Listas de Contatos</h2>
        <p class="hint">Use em ordem: carregue a base, escolha ou crie uma lista e depois adicione contatos nessa lista.</p>

        <div class="action-band">
          <h3>1. Base de contatos</h3>
          <p class="hint">Aqui fica sua planilha geral. A base nao envia campanha sozinha; ela serve apenas para montar listas menores.</p>
          <div class="field-grid">
            <label>Planilha CSV
              <input type="file" id="csv-file" accept=".csv,text/csv">
            </label>
            <label>Pesquisar na base
              <input id="search-csv" placeholder="Nome ou numero">
            </label>
          </div>
          <div class="button-row" style="margin: 12px 0;">
            <button id="btn-carregar-csv" class="secondary">Importar CSV para Base</button>
            <button id="btn-limpar-base" class="danger">Limpar Base</button>
            <span id="contador-selecao" class="pill">0 selecionados</span>
          </div>
          <div class="table-wrap compact">
            <table class="simple-table">
              <thead>
                <tr>
                  <th class="check-cell"><input type="checkbox" id="selecionar-todos-csv"></th>
                  <th>Nome</th>
                  <th>Telefone</th>
                  <th>WhatsApp provavel</th>
                </tr>
              </thead>
              <tbody id="csv-tbody"></tbody>
            </table>
          </div>
        </div>

        <div class="action-band">
          <h3>2. Lista para campanha</h3>
          <p class="hint">Escolha uma lista salva ou digite um novo nome. Para criar ou atualizar, marque contatos na base e adicione aqui.</p>
          <div class="field-grid" style="margin-top: 12px;">
            <label>Nome da lista
              <input id="nome-lista" placeholder="Ex: clientes limpeza de pele">
            </label>
            <label>Listas salvas
              <select id="listas-salvas"></select>
            </label>
          </div>
          <div class="button-row split-actions">
            <div class="left-actions">
              <button id="btn-add-selecionados-lista" class="primary-action">Adicionar Contatos Marcados</button>
            </div>
            <button id="btn-excluir-lista" class="danger">Excluir Lista</button>
          </div>
          <h3>Clientes dentro da lista selecionada</h3>
          <div class="table-wrap compact">
            <table class="simple-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Telefone salvo</th>
                  <th>WhatsApp provavel</th>
                  <th>Acao</th>
                </tr>
              </thead>
              <tbody id="lista-detalhe-tbody"></tbody>
            </table>
          </div>
        </div>

        <div class="action-band">
          <h3>3. Cliente manual</h3>
          <p class="hint">Use quando quiser cadastrar um cliente que nao esta na planilha.</p>
          <div class="field-grid" style="margin-top: 12px;">
            <label>Nome
              <input id="manual-nome" placeholder="Nome do cliente">
            </label>
            <label>Telefone
              <input id="manual-telefone" placeholder="Ex: 84999210586">
            </label>
          </div>
          <div class="button-row">
            <button id="btn-add-manual-base" class="secondary">Salvar na Base Geral</button>
            <button id="btn-add-manual-lista" class="primary-action">Adicionar Manual na Lista</button>
          </div>
        </div>
        <p id="listas-status" class="hint"></p>
      </div>
    </section>

    <section id="tab-logs" class="tab-panel">
      <div class="panel">
        <h2>Logs Recentes</h2>
        <div class="logs"><pre id="logs">Carregando...</pre></div>
      </div>
    </section>
      </div>
    </section>

    <section class="save-bar">
      <div class="row">
        <button id="save-config">Salvar Personalizacao</button>
        <button id="reload-config" class="secondary">Recarregar</button>
        <button id="reset-config" class="danger">Restaurar padrao seguro</button>
        <span id="save-status" class="hint"></span>
      </div>
    </section>
  </main>

  <button id="tag-float-button" class="tag-float-button" type="button">Tags</button>
  <aside id="tag-float-panel" class="tag-float-panel">
    <div class="tag-panel-header">
      <strong>Tags para mensagens</strong>
      <button id="tag-float-close" type="button" class="secondary table-action">Fechar</button>
    </div>
    <p class="hint">Copie uma tag ou insira no campo de texto selecionado.</p>
    <div id="tags-floating-list" class="tag-grid"></div>
  </aside>

  <script>
    var menuState = null;
    var csvBase = [];
    var csvFiltrado = [];
    var selecionadosCsv = {};
    var listasSalvasCache = [];
    var atendimentosCache = [];
    var clientesTotalCache = 0;
    var csvResumoUltimaImportacao = null;
    var ultimaCampanhaConfig = null;
    var campoTextoAtivo = null;
    var campanhaPreviewImageUrl = null;
    var campanhaPreviewFile = null;
    function el(id) { return document.getElementById(id); }
    function boolText(value) { return value ? 'Sim' : 'Nao'; }
    function splitList(value) { return String(value || '').split(',').map(function (item) { return item.trim(); }).filter(Boolean); }
    function escapeHtml(value) {
      return String(value || '').replace(/[&<>"']/g, function (char) {
        return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char];
      });
    }

    function somenteDigitos(value) {
      return String(value || '').replace(/\\D/g, '');
    }

    function telefoneWhatsappProvavel(value) {
      var numero = somenteDigitos(value);
      if (numero.length === 13 && numero.indexOf('55') === 0) {
        return numero.slice(0, 4) + numero.slice(5);
      }
      if (numero.length === 11 && numero.indexOf('55') !== 0) {
        return numero.slice(0, 2) + numero.slice(3);
      }
      return numero;
    }

    function normalizarContatoLocal(contato) {
      var telefone = somenteDigitos(contato && contato.telefone);
      return {
        nome: String(contato && contato.nome ? contato.nome : '').trim(),
        telefone: telefone,
        whatsappProvavel: telefoneWhatsappProvavel(telefone),
        origem: String(contato && contato.origem ? contato.origem : '').trim() || 'manual'
      };
    }

    function observarCampoTextoAtivo() {
      document.addEventListener('focusin', function (event) {
        var target = event.target;
        if (!target || target.readOnly) return;
        var inputType = String(target.type || 'text').toLowerCase();
        var aceitaTexto = ['text', 'search', 'url', 'tel', 'email', ''].includes(inputType);
        if (target.tagName === 'TEXTAREA' || (target.tagName === 'INPUT' && aceitaTexto)) {
          campoTextoAtivo = target;
        }
      });
    }

    async function copiarTexto(texto) {
      try {
        if (!navigator.clipboard || !navigator.clipboard.writeText) {
          throw new Error('Clipboard indisponivel.');
        }

        await navigator.clipboard.writeText(texto);
      } catch (error) {
        var helper = document.createElement('textarea');
        helper.value = texto;
        helper.setAttribute('readonly', 'readonly');
        helper.style.position = 'fixed';
        helper.style.left = '-9999px';
        document.body.appendChild(helper);
        helper.select();
        document.execCommand('copy');
        helper.remove();
      }

      el('save-status').textContent = 'Tag copiada: ' + texto;
    }

    function inserirTag(tag) {
      if (!campoTextoAtivo || document.body.contains(campoTextoAtivo) === false) {
        copiarTexto(tag);
        return;
      }

      var start = campoTextoAtivo.selectionStart || campoTextoAtivo.value.length;
      var end = campoTextoAtivo.selectionEnd || campoTextoAtivo.value.length;
      campoTextoAtivo.value = campoTextoAtivo.value.slice(0, start) + tag + campoTextoAtivo.value.slice(end);
      campoTextoAtivo.focus();
      campoTextoAtivo.selectionStart = campoTextoAtivo.selectionEnd = start + tag.length;
      campoTextoAtivo.dispatchEvent(new Event('input', { bubbles: true }));
    }

    function renderTagContainer(containerId, tags) {
      var container = el(containerId);
      if (!container) return;

      container.innerHTML = (tags || []).map(function (item) {
        return '<div class="tag-item"><button type="button" class="tag-copy" data-tag="' + escapeHtml(item.tag) + '">' +
          '<code>' + escapeHtml(item.tag) + '</code><span>' + escapeHtml(item.descricao) + '</span></button>' +
          '<button type="button" class="secondary table-action tag-insert" data-tag="' + escapeHtml(item.tag) + '">Inserir</button></div>';
      }).join('');
    }

    function renderTagsDisponiveis(tags) {
      renderTagContainer('tags-list', tags);
      renderTagContainer('tags-floating-list', tags);

      document.querySelectorAll('.tag-copy').forEach(function (button) {
        button.addEventListener('click', function () { copiarTexto(button.dataset.tag); });
      });
      document.querySelectorAll('.tag-insert').forEach(function (button) {
        button.addEventListener('click', function () { inserirTag(button.dataset.tag); });
      });
    }

    function toggleTagPanel(force) {
      var panel = el('tag-float-panel');
      var active = typeof force === 'boolean' ? force : !panel.classList.contains('active');
      panel.classList.toggle('active', active);
    }

    function activateTab(name) {
      document.querySelectorAll('.tab-button').forEach(function (button) {
        button.classList.toggle('active', button.dataset.tab === name);
      });
      document.querySelectorAll('.tab-panel').forEach(function (panel) {
        panel.classList.toggle('active', panel.id === 'tab-' + name);
      });
    }

    function formatStatusLabel(value) {
      var text = String(value || '').trim();
      return text ? text.charAt(0).toUpperCase() + text.slice(1) : 'Sem status';
    }

    function setStatusPill(status) {
      var pill = el('status-pill');
      pill.textContent = status.ready ? 'Pronto' : formatStatusLabel(status.whatsappStatus);
      pill.className = 'pill ' + (status.ready ? 'ok' : status.whatsappStatus === 'parado' ? 'danger' : '');
    }

    function updateSecurityBanner(seguranca) {
      var banner = el('security-banner');
      banner.className = 'security-banner';

      if (!seguranca.botAtivo) {
        banner.classList.add('paused');
        el('security-title').textContent = 'Bot pausado';
        el('security-text').textContent = 'Nenhuma resposta automatica sera enviada.';
        return;
      }

      if (seguranca.modoTeste || !seguranca.responderTodosClientes) {
        el('security-title').textContent = 'Modo teste seguro';
        el('security-text').textContent = 'O bot responde apenas numeros permitidos ou contatos liberados.';
        return;
      }

      banner.classList.add('production');
      el('security-title').textContent = 'Producao segura ativa';
      el('security-text').textContent = 'O bot atende clientes reais que enviarem mensagem primeiro, com janela de menu e sem disparo em massa.';
    }

    function updateQr(status) {
      var qr = el('qr-code');
      var empty = el('qr-empty');

      if (status.lastQrAscii && !status.ready) {
        qr.textContent = status.lastQrAscii;
        qr.classList.add('active');
        empty.style.display = 'none';
        el('qr-info').textContent = 'Abra o WhatsApp no celular, entre em Aparelhos conectados e escaneie este QR Code.';
        return;
      }

      qr.textContent = '';
      qr.classList.remove('active');
      empty.style.display = 'block';
      el('qr-info').textContent = status.ready ? 'WhatsApp conectado.' : 'Sem QR Code pendente no momento.';
    }

    function formatDate(value) { return value ? new Date(value).toLocaleString() : 'Sem registro'; }
    function formatBytes(value) {
      var bytes = Number(value || 0);
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1048576) return Math.round(bytes / 1024) + ' KB';
      return (bytes / 1048576).toFixed(1) + ' MB';
    }

    function renderChecklist(seguranca, status) {
      var items = [
        {
          texto: status.ready ? 'WhatsApp conectado e pronto.' : 'WhatsApp ainda nao esta pronto.',
          tipo: status.ready ? 'ok' : 'warn'
        },
        {
          texto: seguranca.botAtivo ? 'Bot automatico ativo.' : 'Bot automatico pausado.',
          tipo: seguranca.botAtivo ? 'ok' : 'danger'
        },
        {
          texto: seguranca.modoTeste ? 'Modo teste ligado: respostas limitadas aos numeros permitidos.' : 'Modo teste desligado.',
          tipo: seguranca.modoTeste ? 'warn' : 'ok'
        },
        {
          texto: seguranca.responderTodosClientes ? 'Producao liberada para clientes reais que chamarem primeiro.' : 'Producao ainda bloqueada para clientes fora da lista.',
          tipo: seguranca.responderTodosClientes ? 'warn' : 'ok'
        }
      ];

      el('production-checklist').innerHTML = items.map(function (item) {
        var dotClass = item.tipo === 'ok' ? 'check-dot' : 'check-dot ' + item.tipo;
        return '<div class="check-item"><span class="' + dotClass + '"></span><span>' + escapeHtml(item.texto) + '</span></div>';
      }).join('');
    }

    function renderDiagnosticList(targetId, items) {
      var target = el(targetId);
      if (!target) return;
      target.innerHTML = (items && items.length ? items : [{ nivel: 'ok', titulo: 'Tudo certo', detalhe: 'Nenhum aviso no momento.' }])
        .map(function (item) {
          return '<div class="diagnostic-item ' + escapeHtml(item.nivel || 'ok') + '"><strong>' +
            escapeHtml(item.titulo || 'Aviso') + '</strong><span>' + escapeHtml(item.detalhe || '') + '</span></div>';
        }).join('');
    }

    async function loadStatus() {
      var response = await fetch('/api/status');
      var data = await response.json();
      var status = data.status;
      var seguranca = data.seguranca;
      var operacao = data.operacao || {};
      setStatusPill(status);
      updateSecurityBanner(seguranca);
      renderChecklist(seguranca, status);
      renderDiagnosticList('diagnostico-list', data.diagnostico || []);
      updateQr(status);
      el('whatsapp-status').textContent = formatStatusLabel(status.whatsappStatus);
      el('last-ready').textContent = 'Pronto em: ' + formatDate(status.lastReadyAt);
      el('bot-ativo').textContent = boolText(seguranca.botAtivo);
      el('modo-teste').textContent = boolText(seguranca.modoTeste);
      el('permitidos').textContent = seguranca.telefonesPermitidos.length ? seguranca.telefonesPermitidos.join(', ') : 'Nenhum';
      el('modo-humano-total').textContent = operacao.clientesModoHumano || 0;
      clientesTotalCache = operacao.clientesTotal || 0;
      if (operacao.resumoDia) {
        el('dia-clientes-novos').textContent = operacao.resumoDia.clientesNovos || 0;
        el('dia-clientes-atualizados').textContent = operacao.resumoDia.clientesAtualizados || 0;
        el('dia-modo-humano').textContent = operacao.resumoDia.clientesModoHumano || 0;
        el('dia-data').textContent = operacao.resumoDia.data || '-';
      }
      el('backup-status').textContent = operacao.ultimoBackup
        ? 'Ultimo backup: ' + formatDate(operacao.ultimoBackup.criadoEm) + ' (' + formatBytes(operacao.ultimoBackup.tamanhoBytes) + ')'
        : 'Ultimo backup: nenhum backup criado ainda.';
      if (document.activeElement !== el('telefones-teste')) {
        el('telefones-teste').value = seguranca.telefonesPermitidos.join(', ');
      }
      el('auto-start-whatsapp').value = String(Boolean(seguranca.autoStartWhatsApp));
      el('startup-state').value = data.startup.enabled ? 'Ativado' : 'Desativado';
      el('runtime-info').textContent =
        'Uptime: ' + status.uptimeSeconds + 's | Reinicios: ' + status.restartCount +
        ' | Monitor: ' + (status.lastHealthState || 'sem teste') +
        ' em ' + formatDate(status.lastHealthCheckAt) +
        ' | Ultimo erro: ' + (status.lastError || 'nenhum');
      el('logs').textContent = data.logs.length ? data.logs.join('\\n') : 'Sem logs recentes.';
      updateCampanhaStatus(status.campanha || {});
      updateSalmoPreview();
    }

    async function callAction(path, buttonId) {
      var button = el(buttonId);
      button.disabled = true;
      try {
        await fetch(path, { method: 'POST' });
        await loadStatus();
      } finally {
        button.disabled = false;
      }
    }

    async function postJson(path, body) {
      var response = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {})
      });

      if (!response.ok) {
        var errorData = await response.json().catch(function () { return {}; });
        throw new Error(errorData.erro || 'Falha na acao solicitada.');
      }

      return response.json();
    }

    async function setStartup(enabled) {
      await fetch(enabled ? '/api/startup/enable' : '/api/startup/disable', { method: 'POST' });
      await loadStatus();
    }

    async function setAutoStartWhatsApp() {
      await postJson('/api/autostart-whatsapp', { enabled: el('auto-start-whatsapp').value === 'true' });
      await loadStatus();
    }

    async function ativarModoTesteSeguro() {
      await postJson('/api/security/test-mode', { telefones: el('telefones-teste').value });
      await loadStatus();
      await loadConfig();
      el('save-status').textContent = 'Modo teste seguro ativado.';
    }

    async function ativarProducaoSegura() {
      var diagnosticoAtual = await fetch('/api/diagnostico').then(function (response) { return response.json(); });
      var bloqueios = diagnosticoAtual.filter(function (item) {
        return item.nivel === 'erro' && item.titulo !== 'Modo teste sem numero permitido';
      });

      if (bloqueios.length) {
        alert('Antes de sair do modo teste, corrija estes pontos:\\n\\n' + bloqueios.map(function (item) {
          return '- ' + item.titulo + ': ' + item.detalhe;
        }).join('\\n'));
        renderDiagnosticList('diagnostico-list', diagnosticoAtual);
        return;
      }

      if (!confirm('Sair do modo teste e liberar para clientes reais que enviarem mensagem primeiro?')) return;
      await postJson('/api/security/production', {
        removerTelefonesTeste: el('remover-telefone-teste').value === 'true'
      });
      await loadStatus();
      await loadConfig();
      el('save-status').textContent = 'Producao segura ativada.';
    }

    async function limparTelefonesPermitidos() {
      if (!confirm('Remover todos os numeros de teste da lista permitida?')) return;
      await postJson('/api/security/clear-allowed', {});
      await loadStatus();
      el('save-status').textContent = 'Numeros de teste removidos.';
    }

    async function limparClientesSilenciados() {
      var result = await postJson('/api/clientes/limpar-silencios', {});
      await loadAtendimentos();
      await loadStatus();
      el('save-status').textContent = 'Clientes destravados: ' + (result.removidos || 0) + '.';
    }

    async function desativarBot() {
      if (!confirm('Parar todas as respostas automaticas do bot?')) return;
      await postJson('/api/security/disable-bot', {});
      await loadStatus();
      el('save-status').textContent = 'Respostas automaticas desativadas.';
    }

    async function apagarSessaoWhatsApp() {
      if (!confirm('Apagar a sessao do WhatsApp deste PC? Depois sera necessario escanear um novo QR Code.')) return;
      await fetch('/api/clear-whatsapp-session', { method: 'POST' });
      await loadStatus();
      el('save-status').textContent = 'Sessao apagada. Aguarde o QR Code aparecer e escaneie pelo WhatsApp do celular.';
    }

    async function recuperarConexaoWhatsApp() {
      if (!confirm('Tentar recuperar a conexao sem apagar a sessao do WhatsApp?')) return;
      await fetch('/api/recover-whatsapp', { method: 'POST' });
      await loadStatus();
      el('save-status').textContent = 'Recuperacao iniciada. Aguarde o status do WhatsApp atualizar.';
    }

    async function testResponse() {
      var response = await fetch('/api/teste', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: el('test-input').value })
      });
      var data = await response.json();
      el('test-output').textContent = data.resposta || 'Sem resposta para esse comando.';
    }

    function updateCampanhaStatus(campanha) {
      if (!el('campanha-status')) return;
      var total = Number(campanha.total || 0);
      var atual = Number(campanha.atual || 0);
      var progresso = total > 0 ? Math.min(100, Math.round((atual / total) * 100)) : 0;
      el('camp-total').textContent = total;
      el('camp-enviados').textContent = campanha.enviados || 0;
      el('camp-falhas').textContent = campanha.falhas || 0;
      el('camp-ignorados').textContent = campanha.ignorados || 0;
      el('camp-progress').style.width = progresso + '%';
      el('campanha-status').textContent =
        formatStatusLabel(campanha.status || 'parada') + ' - ' + (campanha.mensagem || 'Nenhuma campanha em andamento.');
      if (campanha.numeroAtual) {
        el('campanha-status').textContent += ' Numero atual: ' + campanha.numeroAtual + '.';
      }
      if (campanha.proximosSegundos) {
        el('campanha-status').textContent += ' Proximo envio em cerca de ' + campanha.proximosSegundos + 's.';
      }
      el('btn-disparar-campanha').disabled = Boolean(campanha.ativa);
      el('btn-cancelar-campanha').disabled = !campanha.ativa || Boolean(campanha.cancelando);
      el('campanha-relatorio').textContent = buildCampanhaRelatorio(campanha);

      if (el('salmo-status')) {
        el('salmo-total').textContent = total;
        el('salmo-enviados').textContent = campanha.enviados || 0;
        el('salmo-falhas').textContent = campanha.falhas || 0;
        el('salmo-ignorados').textContent = campanha.ignorados || 0;
        el('salmo-progress').style.width = progresso + '%';
        el('salmo-status').textContent =
          formatStatusLabel(campanha.status || 'parada') + ' - ' +
          (campanha.mensagem || 'Nenhum envio de salmo em andamento.');
        if (campanha.numeroAtual) {
          el('salmo-status').textContent += ' Numero atual: ' + campanha.numeroAtual + '.';
        }
        if (campanha.proximosSegundos) {
          el('salmo-status').textContent += ' Proximo envio em cerca de ' + campanha.proximosSegundos + 's.';
        }
        el('btn-enviar-salmo').disabled = Boolean(campanha.ativa);
        el('btn-cancelar-salmo').disabled = !campanha.ativa || Boolean(campanha.cancelando);
      }
    }

    function buildCampanhaRelatorio(campanha) {
      if (!campanha || (!campanha.id && !campanha.iniciadaEm)) {
        return 'Nenhuma campanha executada nesta sessao.';
      }

      return [
        'Status: ' + formatStatusLabel(campanha.status || 'parada'),
        'Publico: ' + (campanha.alvo || '-'),
        'Iniciada em: ' + formatDate(campanha.iniciadaEm),
        'Finalizada em: ' + formatDate(campanha.finalizadaEm),
        'Total: ' + (campanha.total || 0),
        'Enviados: ' + (campanha.enviados || 0),
        'Falhas: ' + (campanha.falhas || 0),
        'Ignorados: ' + (campanha.ignorados || 0),
        'Mensagem: ' + (campanha.mensagem || '-'),
        'Erro: ' + (campanha.erro || 'nenhum')
      ].join('\\n');
    }

    async function copiarRelatorioCampanha() {
      var texto = el('campanha-relatorio').textContent || '';

      try {
        await navigator.clipboard.writeText(texto);
        el('campanha-status').textContent = 'Relatorio copiado para a area de transferencia.';
      } catch (error) {
        alert(texto);
      }
    }

    async function loadHistoricoCampanhas() {
      var response = await fetch('/api/campanhas/historico');
      var historico = await response.json();
      el('campanhas-historico-tbody').innerHTML = historico.length ? historico.map(function (item) {
        return '<tr><td>' + escapeHtml(formatDate(item.iniciadaEm)) + '</td><td>' +
          escapeHtml(formatStatusLabel(item.status || '-')) + '</td><td>' + escapeHtml(item.alvo || '-') +
          '</td><td>' + escapeHtml(item.enviados || 0) + '</td><td>' +
          escapeHtml(item.falhas || 0) + '</td><td>' + escapeHtml(item.ignorados || 0) + '</td></tr>';
      }).join('') : '<tr><td colspan="6">Nenhuma campanha no historico.</td></tr>';
    }

    function onCampanhaAlvoChange() {
      var alvo = el('campanha-alvo').value;
      el('label-campanha-lista').style.display = alvo === 'personalizado' ? 'grid' : 'none';
      el('label-campanha-lista-salva').style.display = alvo === 'lista_salva' ? 'grid' : 'none';
      updateCampanhaPreview();
    }

    function getListaSalvaSelecionadaParaCampanha() {
      var nomeLista = el('campanha-lista-salva').value;
      return listasSalvasCache.find(function (lista) { return lista.nome === nomeLista; }) || null;
    }

    function getQuantidadeEstimativaCampanha() {
      var alvo = el('campanha-alvo').value;

      if (alvo === 'teste') {
        return splitList(el('telefones-teste').value).length;
      }

      if (alvo === 'personalizado') {
        return splitList(el('campanha-lista').value.replace(/\\n/g, ',')).length;
      }

      if (alvo === 'lista_salva') {
        var lista = getListaSalvaSelecionadaParaCampanha();
        return lista ? lista.contatos.length : 0;
      }

      return null;
    }

    function formatDuration(ms) {
      if (!Number.isFinite(ms) || ms <= 0) return '0s';
      var seconds = Math.round(ms / 1000);
      var minutes = Math.floor(seconds / 60);
      var rest = seconds % 60;
      return minutes > 0 ? minutes + 'min ' + rest + 's' : rest + 's';
    }

    function updateCampanhaPreviewImage() {
      var image = el('campanha-preview-imagem');
      var fileInput = el('campanha-imagem');
      var file = fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;

      if (file === campanhaPreviewFile) {
        return;
      }

      campanhaPreviewFile = file;

      if (campanhaPreviewImageUrl) {
        URL.revokeObjectURL(campanhaPreviewImageUrl);
        campanhaPreviewImageUrl = null;
      }

      if (!file) {
        image.style.display = 'none';
        image.removeAttribute('src');
        return;
      }

      campanhaPreviewImageUrl = URL.createObjectURL(file);
      image.src = campanhaPreviewImageUrl;
      image.style.display = 'block';
    }

    function updateCampanhaPreview() {
      var alvo = el('campanha-alvo').value;
      var texto = el('campanha-texto').value.trim();
      var temImagem = Boolean(el('campanha-imagem').files && el('campanha-imagem').files[0]);
      var quantidade = getQuantidadeEstimativaCampanha();
      var minDelay = Number(el('campanha-delay-min').value || 10000);
      var maxDelay = Number(el('campanha-delay-max').value || 25000);
      var enviosComPausa = Math.max(0, (quantidade || 0) - 1);
      var minTempo = enviosComPausa * minDelay;
      var maxTempo = enviosComPausa * maxDelay;

      el('campanha-preview').textContent = [
        'Publico: ' + alvo,
        'Quantidade estimada: ' + (quantidade === null ? 'clientes salvos no banco' : quantidade),
        'Imagem: ' + (temImagem ? 'sim' : 'nao'),
        '',
        texto || '[sem texto, apenas imagem]'
      ].join('\\n');

      el('campanha-estimativa').textContent = quantidade === null
        ? 'Estimativa de tempo: calculada ao iniciar, pois depende dos clientes salvos no banco.'
        : 'Estimativa de tempo entre envios: de ' + formatDuration(minTempo) + ' ate ' + formatDuration(maxTempo) + '.';
      updateCampanhaPreviewImage();
    }

    function getCampanhaFormConfig() {
      return {
        alvo: el('campanha-alvo').value,
        texto: el('campanha-texto').value.trim(),
        numerosPersonalizados: splitList(el('campanha-lista').value.replace(/\\n/g, ',')),
        nomeLista: el('campanha-lista-salva').value,
        delayMinMs: Number(el('campanha-delay-min').value || 10000),
        delayMaxMs: Number(el('campanha-delay-max').value || 25000)
      };
    }

    function atualizarEstadoDuplicarCampanha() {
      el('btn-duplicar-campanha').disabled = !ultimaCampanhaConfig;
    }

    function salvarUltimaCampanhaConfig(config) {
      ultimaCampanhaConfig = config;

      try {
        localStorage.setItem('ultimaCampanhaConfig', JSON.stringify(config));
      } catch (error) {
        console.warn('Nao foi possivel salvar a ultima campanha no navegador.', error);
      }

      atualizarEstadoDuplicarCampanha();
    }

    function carregarUltimaCampanhaConfig() {
      try {
        var salvo = localStorage.getItem('ultimaCampanhaConfig');
        ultimaCampanhaConfig = salvo ? JSON.parse(salvo) : null;
      } catch (error) {
        ultimaCampanhaConfig = null;
      }

      atualizarEstadoDuplicarCampanha();
    }

    function aplicarCampanhaConfig(config) {
      if (!config) return;

      el('campanha-alvo').value = config.alvo || 'teste';
      el('campanha-texto').value = config.texto || '';
      el('campanha-lista').value = (config.numerosPersonalizados || []).join('\\n');
      el('campanha-lista-salva').value = config.nomeLista || '';
      el('campanha-delay-min').value = String(config.delayMinMs || 10000);
      el('campanha-delay-max').value = String(config.delayMaxMs || 25000);
      onCampanhaAlvoChange();
    }

    function duplicarUltimaCampanha() {
      if (!ultimaCampanhaConfig) {
        alert('Ainda nao existe uma campanha anterior para duplicar.');
        return;
      }

      aplicarCampanhaConfig(ultimaCampanhaConfig);
      el('campanha-status').textContent = 'Ultima campanha duplicada. Revise a previa antes de enviar.';
    }

    function getRelatorioCampanhaFilename() {
      var stamp = new Date().toISOString().slice(0, 16).replace('T', '-').replace(':', '-');
      return 'relatorio-campanha-' + stamp + '.txt';
    }

    function exportarRelatorioCampanha() {
      var texto = el('campanha-relatorio').textContent || '';

      if (!texto.trim() || texto.includes('Nenhuma campanha executada')) {
        alert('Nenhum relatorio de campanha disponivel para exportar.');
        return;
      }

      var blob = new Blob([texto], { type: 'text/plain;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var link = document.createElement('a');
      link.href = url;
      link.download = getRelatorioCampanhaFilename();
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      el('campanha-status').textContent = 'Relatorio exportado.';
    }

    function readImageAsBase64(file) {
      return new Promise(function (resolve, reject) {
        if (!file) {
          resolve(null);
          return;
        }
        var reader = new FileReader();
        reader.onload = function () { resolve(reader.result); };
        reader.onerror = function () { reject(new Error('Nao foi possivel ler a imagem.')); };
        reader.readAsDataURL(file);
      });
    }

    async function executarDisparoCampanha() {
      var alvo = el('campanha-alvo').value;
      var texto = el('campanha-texto').value.trim();
      var fileInput = el('campanha-imagem');
      var file = fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
      var numerosPersonalizados = splitList(el('campanha-lista').value.replace(/\\n/g, ','));
      var nomeLista = el('campanha-lista-salva').value;

      if (!texto && !file) {
        alert('Informe uma mensagem ou selecione uma imagem.');
        return;
      }
      if (alvo === 'personalizado' && !numerosPersonalizados.length) {
        alert('Cole pelo menos um numero para a campanha personalizada.');
        return;
      }
      if (alvo === 'lista_salva' && !nomeLista) {
        alert('Escolha uma lista salva.');
        return;
      }
      if (alvo === 'todos' && !confirm('Atencao: enviar para todos os clientes salvos aumenta o risco de bloqueio. Continue apenas se esses contatos autorizaram receber mensagens.')) {
        return;
      }
      updateCampanhaPreview();
      if (!confirm('Revise a campanha antes de enviar:\\n\\n' + el('campanha-preview').textContent + '\\n\\n' +
        el('campanha-estimativa').textContent + '\\n\\nIniciar campanha agora? O envio sera um por um, com pausas de seguranca.')) {
        return;
      }

      try {
        var imagemBase64 = await readImageAsBase64(file);
        var configCampanha = getCampanhaFormConfig();
        salvarUltimaCampanhaConfig(configCampanha);
        await postJson('/api/campanha/disparar', {
          alvo: configCampanha.alvo,
          texto: configCampanha.texto,
          imagemBase64: imagemBase64,
          numerosPersonalizados: configCampanha.numerosPersonalizados,
          nomeLista: configCampanha.nomeLista,
          delayMinMs: configCampanha.delayMinMs,
          delayMaxMs: configCampanha.delayMaxMs
        });
        el('campanha-status').textContent = 'Campanha iniciada. O status vai atualizar automaticamente.';
        fileInput.value = '';
        updateCampanhaPreview();
      } catch (error) {
        alert(error.message);
      }
    }

    async function cancelarCampanhaAtual() {
      await postJson('/api/campanha/cancelar', {});
      await loadStatus();
      await loadHistoricoCampanhas();
    }

    async function executarEnvioSalmo() {
      var alvo = el('salmo-alvo').value;

      updateSalmoPreview();

      if (alvo === 'todos' && !confirm('Enviar o salmo do dia para clientes que ja interagiram? Use apenas para quem aceita receber mensagens da clinica.')) {
        return;
      }

      if (!confirm('Revise a previa antes de enviar:\\n\\n' + el('salmo-preview').textContent + '\\n\\n' +
        el('salmo-estimativa').textContent + '\\n\\nIniciar envio agora?')) {
        return;
      }

      try {
        await postJson('/api/salmo/enviar', {
          alvo: alvo,
          delayMinMs: Number(el('salmo-delay-min').value || 10000),
          delayMaxMs: Number(el('salmo-delay-max').value || 25000)
        });
        el('salmo-status').textContent = 'Envio de salmo iniciado. O status vai atualizar automaticamente.';
      } catch (error) {
        alert(error.message);
      }
    }

    function parseCsvLine(line) {
      var result = [];
      var current = '';
      var inQuotes = false;
      for (var i = 0; i < line.length; i++) {
        var ch = line[i];
        var next = line[i + 1];
        if (ch === '"' && inQuotes && next === '"') {
          current += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = !inQuotes;
        } else if ((ch === ',' || ch === ';') && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += ch;
        }
      }
      result.push(current.trim());
      return result;
    }

    function parseCsv(text) {
      var lines = String(text || '').split(/\\r?\\n/).filter(function (line) { return line.trim(); });
      if (!lines.length) return [];
      var headers = parseCsvLine(lines[0]).map(function (item) { return item.trim().toLowerCase(); });
      var phoneIndex = headers.findIndex(function (h) { return ['telefone', 'celular', 'whatsapp', 'numero', 'phone'].includes(h); });
      var nameIndex = headers.findIndex(function (h) { return ['nome', 'name', 'cliente'].includes(h); });
      var start = phoneIndex >= 0 ? 1 : 0;
      if (phoneIndex < 0) phoneIndex = 0;
      if (nameIndex < 0) nameIndex = phoneIndex === 0 ? 1 : 0;
      var totalLidas = lines.slice(start).length;
      var invalidos = 0;
      var duplicados = 0;
      var mapa = {};

      lines.slice(start).forEach(function (line) {
        var cols = parseCsvLine(line);
        var contato = normalizarContatoLocal({
          nome: cols[nameIndex] || '',
          telefone: String(cols[phoneIndex] || '').replace(/\\D/g, ''),
          origem: 'csv'
        });
        var chave = contato.whatsappProvavel || contato.telefone;

        if (contato.telefone.length < 10) {
          invalidos++;
          return;
        }

        if (mapa[chave]) {
          duplicados++;
          return;
        }

        mapa[chave] = contato;
      });

      var contatos = Object.keys(mapa).map(function (chave) { return mapa[chave]; });
      csvResumoUltimaImportacao = {
        total: totalLidas,
        validos: contatos.length,
        invalidos: invalidos,
        duplicados: duplicados
      };
      return contatos;
    }

    function renderCsvTable() {
      var termo = (el('search-csv').value || '').toLowerCase();
      csvFiltrado = csvBase.filter(function (contato) {
        return !termo ||
          String(contato.nome || '').toLowerCase().includes(termo) ||
          String(contato.telefone || '').includes(termo);
      });
      var limiteTela = 250;
      var visiveis = csvFiltrado.slice(0, limiteTela);
      el('csv-tbody').innerHTML = visiveis.map(function (contato) {
        var checked = selecionadosCsv[contato.telefone] ? 'checked' : '';
        var whats = contato.whatsappProvavel || telefoneWhatsappProvavel(contato.telefone);
        return '<tr><td class="check-cell"><input type="checkbox" class="csv-check" data-telefone="' + contato.telefone + '" ' + checked + '></td><td>' +
          escapeHtml(contato.nome || '-') + '</td><td>' + escapeHtml(contato.telefone) + '</td><td>' + escapeHtml(whats || '-') + '</td></tr>';
      }).join('') + (csvFiltrado.length > limiteTela
        ? '<tr><td colspan="4">Mostrando os primeiros ' + limiteTela + ' de ' + csvFiltrado.length + ' contato(s). Use a pesquisa para filtrar.</td></tr>'
        : '');
      document.querySelectorAll('.csv-check').forEach(function (checkbox) {
        checkbox.addEventListener('change', function () {
          selecionadosCsv[checkbox.dataset.telefone] = checkbox.checked;
          atualizarContadorSelecao();
        });
      });
      atualizarContadorSelecao();
    }

    function atualizarContadorSelecao() {
      var total = Object.keys(selecionadosCsv).filter(function (telefone) { return selecionadosCsv[telefone]; }).length;
      el('contador-selecao').textContent = total + ' selecionado(s) de ' + csvFiltrado.length;
    }

    async function carregarBaseSalva() {
      var response = await fetch('/api/base');
      csvBase = await response.json();
      selecionadosCsv = {};
      renderCsvTable();
    }

    async function carregarCSV() {
      var file = el('csv-file').files && el('csv-file').files[0] ? el('csv-file').files[0] : null;
      if (!file) {
        alert('Selecione um arquivo CSV.');
        return;
      }
      var text = await file.text();
      var contatos = parseCsv(text);
      if (!contatos.length) {
        alert('Nenhum contato valido encontrado no CSV.');
        return;
      }
      await postJson('/api/base/salvar', { contatos: contatos });
      el('listas-status').textContent = csvResumoUltimaImportacao
        ? 'Base CSV salva com ' + csvResumoUltimaImportacao.validos + ' contato(s). Duplicados ignorados: ' +
          csvResumoUltimaImportacao.duplicados + '. Invalidos ignorados: ' + csvResumoUltimaImportacao.invalidos + '.'
        : 'Base CSV salva com ' + contatos.length + ' contato(s).';
      await carregarBaseSalva();
    }

    async function limparBaseCSV() {
      if (!confirm('Limpar a base CSV salva? As listas ja salvas continuam.')) return;
      await postJson('/api/base/limpar', {});
      await carregarBaseSalva();
    }

    function getContatosSelecionados() {
      var telefones = Object.keys(selecionadosCsv).filter(function (telefone) { return selecionadosCsv[telefone]; });
      return csvBase.filter(function (contato) { return telefones.includes(contato.telefone); });
    }

    async function carregarListasSalvas(nomePreferido) {
      var response = await fetch('/api/listas');
      listasSalvasCache = await response.json();
      var selecionadaAntes = nomePreferido || el('listas-salvas').value;
      var options = listasSalvasCache.map(function (lista) {
        return '<option value="' + escapeHtml(lista.nome) + '">' + escapeHtml(lista.nome) + ' (' + lista.contatos.length + ')</option>';
      }).join('');
      el('listas-salvas').innerHTML = options || '<option value="">Nenhuma lista salva</option>';
      el('campanha-lista-salva').innerHTML = options || '<option value="">Nenhuma lista salva</option>';
      if (selecionadaAntes) {
        el('listas-salvas').value = selecionadaAntes;
        el('campanha-lista-salva').value = selecionadaAntes;
      }
      var listaAtual = getListaSelecionada();
      el('nome-lista').value = listaAtual ? listaAtual.nome : '';
      renderListaDetalhe();
    }

    function getListaSelecionada() {
      var nome = el('listas-salvas').value;
      return listasSalvasCache.find(function (lista) { return lista.nome === nome; }) || null;
    }

    function renderListaDetalhe() {
      var tbody = el('lista-detalhe-tbody');
      if (!tbody) return;
      var lista = getListaSelecionada();
      if (!lista || !lista.contatos.length) {
        tbody.innerHTML = '<tr><td colspan="4">Nenhuma lista selecionada ou lista vazia.</td></tr>';
        return;
      }
      tbody.innerHTML = lista.contatos.map(function (contato) {
        var whats = contato.whatsappProvavel || telefoneWhatsappProvavel(contato.telefone);
        return '<tr><td>' + escapeHtml(contato.nome || '-') + '</td><td>' + escapeHtml(contato.telefone) +
          '</td><td>' + escapeHtml(whats || '-') + '</td><td><button class="danger table-action remover-lista-contato" data-telefone="' +
          escapeHtml(contato.telefone) + '">Remover</button></td></tr>';
      }).join('');
      document.querySelectorAll('.remover-lista-contato').forEach(function (button) {
        button.addEventListener('click', function () { removerContatoDaLista(button.dataset.telefone); });
      });
    }

    async function salvarContatosNaListaAtual(contatos) {
      var lista = getListaSelecionada();
      var nome = lista ? lista.nome : el('nome-lista').value.trim();
      var atuais = lista ? lista.contatos.slice() : [];
      var mapa = {};
      atuais.concat(contatos).map(normalizarContatoLocal).filter(function (contato) {
        return contato.telefone.length >= 10;
      }).forEach(function (contato) {
        mapa[contato.whatsappProvavel || contato.telefone] = contato;
      });
      var finalContatos = Object.keys(mapa).map(function (chave) { return mapa[chave]; });
      if (!nome) {
        alert('Informe ou selecione uma lista.');
        return;
      }
      if (!finalContatos.length) {
        alert('A lista precisa ter pelo menos um contato.');
        return;
      }
      await postJson('/api/listas/salvar', { nome: nome, contatos: finalContatos });
      await carregarListasSalvas(nome);
      renderListaDetalhe();
    }

    async function removerContatoDaLista(telefone) {
      var lista = getListaSelecionada();
      if (!lista) return;
      var contatos = lista.contatos.filter(function (contato) { return contato.telefone !== telefone; });
      if (!contatos.length) {
        if (!confirm('Remover o ultimo contato e deixar a lista vazia? A lista sera excluida.')) return;
        await postJson('/api/listas/excluir', { nome: lista.nome });
      } else {
        await postJson('/api/listas/salvar', { nome: lista.nome, contatos: contatos });
      }
      await carregarListasSalvas(lista.nome);
    }

    async function adicionarClienteManualNaBase() {
      var contato = normalizarContatoLocal({
        nome: el('manual-nome').value,
        telefone: el('manual-telefone').value,
        origem: 'manual'
      });
      if (contato.telefone.length < 10) {
        alert('Informe um telefone valido.');
        return;
      }
      var mapa = {};
      csvBase.concat([contato]).map(normalizarContatoLocal).forEach(function (item) {
        mapa[item.whatsappProvavel || item.telefone] = item;
      });
      await postJson('/api/base/salvar', { contatos: Object.keys(mapa).map(function (chave) { return mapa[chave]; }) });
      el('manual-nome').value = '';
      el('manual-telefone').value = '';
      await carregarBaseSalva();
      el('listas-status').textContent = 'Cliente manual adicionado na base.';
    }

    async function adicionarClienteManualNaLista() {
      var contato = normalizarContatoLocal({
        nome: el('manual-nome').value,
        telefone: el('manual-telefone').value,
        origem: 'manual'
      });
      if (contato.telefone.length < 10) {
        alert('Informe um telefone valido.');
        return;
      }
      await salvarContatosNaListaAtual([contato]);
      el('manual-nome').value = '';
      el('manual-telefone').value = '';
      el('listas-status').textContent = 'Cliente manual adicionado na lista.';
    }

    async function adicionarSelecionadosNaListaAtual() {
      var contatos = getContatosSelecionados();
      if (!contatos.length) {
        alert('Selecione pelo menos um contato da base.');
        return;
      }
      await salvarContatosNaListaAtual(contatos);
      el('listas-status').textContent = 'Contatos selecionados adicionados na lista atual.';
    }

    async function excluirListaSalva() {
      var nome = el('listas-salvas').value;
      if (!nome || !confirm('Excluir a lista "' + nome + '"?')) return;
      await postJson('/api/listas/excluir', { nome: nome });
      await carregarListasSalvas();
    }

    function updateField(path, value) {
      var target = menuState;
      for (var i = 0; i < path.length - 1; i++) target = target[path[i]];
      target[path[path.length - 1]] = value;
    }

    function readPath(path) {
      var target = menuState;
      for (var i = 0; i < path.length; i++) target = target[path[i]];
      return target;
    }

    function bindValue(id, path, list) {
      var input = el(id);
      var target = readPath(path);
      input.value = list ? target.join(', ') : target;
      input.oninput = function () {
        updateField(path, list ? splitList(input.value) : input.value);
        updateMenuPreview();
        updateSalmoPreview();
      };
    }

    function makeOption(numero) {
      return { numero: String(numero || '1'), titulo: 'Nova opcao', tipo: 'mensagem', mensagem: '', submenus: [] };
    }

    function cloneOption(option) {
      return JSON.parse(JSON.stringify(option || makeOption('1')));
    }

    function getNextOptionNumber(list) {
      var usados = {};
      (list || []).forEach(function (item) { usados[String(item.numero || '').trim()] = true; });
      var next = 1;
      while (usados[String(next)]) next++;
      return String(next);
    }

    function makeEditorButton(text, className, onClick, disabled) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = className || 'secondary';
      button.textContent = text;
      button.disabled = Boolean(disabled);
      button.onclick = onClick;
      return button;
    }

    function renderOptions() {
      var root = el('options-editor');
      root.innerHTML = '';
      menuState.menu.opcoes.forEach(function (option, index) {
        root.appendChild(renderOption(option, menuState.menu.opcoes, index, ''));
      });
      updateMenuPreview();
    }

    function renderOption(option, list, index, prefix) {
      var wrap = document.createElement('div');
      wrap.className = 'option';
      var pathLabel = prefix ? prefix + '.' + option.numero : option.numero;
      var header = document.createElement('h3');
      header.textContent = 'Opcao ' + pathLabel;
      wrap.appendChild(header);
      var grid = document.createElement('div');
      grid.className = 'field-grid';
      wrap.appendChild(grid);
      grid.appendChild(createInput('Numero', option.numero, function (value) { option.numero = value; renderOptions(); }));
      grid.appendChild(createInput('Titulo', option.titulo, function (value) { option.titulo = value; updateMenuPreview(); }));
      grid.appendChild(createSelect('Tipo', option.tipo, function (value) { option.tipo = value; updateMenuPreview(); }));
      var mensagemField = createTextarea('Mensagem', option.mensagem, function (value) { option.mensagem = value; updateMenuPreview(); });
      mensagemField.className = 'wide-field';
      grid.appendChild(mensagemField);
      var row = document.createElement('div');
      row.className = 'row';
      row.style.marginTop = '10px';
      var moveUp = makeEditorButton('Subir', 'secondary', function () {
        if (index <= 0) return;
        var atual = list[index];
        list[index] = list[index - 1];
        list[index - 1] = atual;
        renderOptions();
      }, index <= 0);
      var moveDown = makeEditorButton('Descer', 'secondary', function () {
        if (index >= list.length - 1) return;
        var atual = list[index];
        list[index] = list[index + 1];
        list[index + 1] = atual;
        renderOptions();
      }, index >= list.length - 1);
      var duplicate = makeEditorButton('Duplicar', 'secondary', function () {
        var copy = cloneOption(option);
        copy.numero = getNextOptionNumber(list);
        copy.titulo = copy.titulo + ' copia';
        list.splice(index + 1, 0, copy);
        renderOptions();
      });
      var addSub = makeEditorButton('Adicionar Submenu', 'secondary', function () {
        option.tipo = 'submenu';
        option.submenus.push(makeOption(option.submenus.length + 1));
        renderOptions();
      });
      var remove = makeEditorButton('Remover', 'danger', function () {
        if (!confirm('Remover esta opcao do menu?')) return;
        list.splice(index, 1);
        renderOptions();
      });
      row.appendChild(moveUp);
      row.appendChild(moveDown);
      row.appendChild(duplicate);
      row.appendChild(addSub);
      row.appendChild(remove);
      wrap.appendChild(row);
      if (option.submenus && option.submenus.length) {
        var children = document.createElement('div');
        children.className = 'children';
        option.submenus.forEach(function (child, childIndex) {
          children.appendChild(renderOption(child, option.submenus, childIndex, pathLabel));
        });
        wrap.appendChild(children);
      }
      return wrap;
    }

    function createInput(labelText, value, onChange) {
      var label = document.createElement('label');
      label.textContent = labelText;
      var input = document.createElement('input');
      input.value = value || '';
      input.oninput = function () { onChange(input.value); };
      label.appendChild(input);
      return label;
    }

    function createTextarea(labelText, value, onChange) {
      var label = document.createElement('label');
      label.textContent = labelText;
      var input = document.createElement('textarea');
      input.value = value || '';
      input.oninput = function () { onChange(input.value); };
      label.appendChild(input);
      return label;
    }

    function createSelect(labelText, value, onChange) {
      var label = document.createElement('label');
      label.textContent = labelText;
      var input = document.createElement('select');
      ['mensagem', 'submenu', 'humano', 'salmo'].forEach(function (tipo) {
        var option = document.createElement('option');
        option.value = tipo;
        option.textContent = tipo;
        input.appendChild(option);
      });
      input.value = value || 'mensagem';
      input.onchange = function () { onChange(input.value); };
      label.appendChild(input);
      return label;
    }

    function buildOptionsLinesLocal(options, prefix) {
      return (options || []).map(function (option) {
        var numero = prefix ? prefix + '.' + option.numero : option.numero;
        return numero + ' - ' + aplicarTagsLocal(option.titulo);
      });
    }

    function aplicarTagsLocal(texto) {
      var empresa = menuState && menuState.empresa ? menuState.empresa : {};
      var salmoAtual = menuState && menuState.salmoAtual ? menuState.salmoAtual : {};
      var palavraBiblicaAtual = menuState && menuState.palavraBiblicaAtual ? menuState.palavraBiblicaAtual : {};
      var tags = {
        '{saudacao}': 'Bom dia',
        '{empresa}': empresa.nome || '',
        '{empresa_nome}': empresa.nome || '',
        '{telefone}': empresa.telefone || '',
        '{endereco}': empresa.endereco || '',
        '{ponto_referencia}': empresa.pontoReferencia || '',
        '{maps_url}': empresa.mapsUrl || '',
        '{agendamento_url}': empresa.minhaAgendaUrl || '',
        '{minha_agenda_url}': empresa.minhaAgendaUrl || '',
        '{horario_funcionamento}': empresa.horarioFuncionamento || '',
        '{instagram}': empresa.instagram || '',
        '{email}': empresa.email || '',
        '{salmo_referencia}': salmoAtual.referencia || '',
        '{salmo_mensagem}': salmoAtual.mensagem || '',
        '{salmo_do_dia}': ((salmoAtual.referencia || '') + '\\n' + (salmoAtual.mensagem || '')).trim(),
        '{palavra_biblica_referencia}': palavraBiblicaAtual.referencia || '',
        '{palavra_biblica_mensagem}': palavraBiblicaAtual.mensagem || '',
        '{palavra_biblica}': ((palavraBiblicaAtual.referencia || '') + '\\n' + (palavraBiblicaAtual.mensagem || '')).trim()
      };
      var output = String(texto || '');
      Object.keys(tags).forEach(function (tag) {
        output = output.split(tag).join(tags[tag]);
      });
      return output;
    }

    function buildSalmoPreviewLocal() {
      var salmoConfig = menuState && menuState.salmo ? menuState.salmo : {};
      var salmoAtual = menuState && menuState.salmoAtual ? menuState.salmoAtual : {};
      var temTagManual = /\\{salmo_(do_dia|referencia|mensagem)\\}/.test(String(salmoConfig.mensagemAntes || '')) ||
        /\\{salmo_(do_dia|referencia|mensagem)\\}/.test(String(salmoConfig.mensagemDepois || ''));

      if (temTagManual) {
        return [
          aplicarTagsLocal(salmoConfig.mensagemAntes || ''),
          '',
          aplicarTagsLocal(salmoConfig.mensagemDepois || '')
        ].filter(function (line, index, array) {
          return line || array[index - 1];
        }).join('\\n');
      }

      var lines = [
        aplicarTagsLocal(salmoConfig.mensagemAntes || ''),
        '',
        salmoAtual.referencia || '{salmo_referencia}',
        salmoAtual.mensagem || '{salmo_mensagem}',
        '',
        aplicarTagsLocal(salmoConfig.mensagemDepois || '')
      ];

      return lines.filter(function (line, index, array) {
        return line || array[index - 1];
      }).join('\\n');
    }

    function getQuantidadeEstimativaSalmo() {
      var alvo = el('salmo-alvo').value;

      if (alvo === 'teste') {
        return splitList(el('telefones-teste').value).length;
      }

      return clientesTotalCache || atendimentosCache.length;
    }

    function updateSalmoPreview() {
      if (!el('salmo-preview') || !menuState) return;
      el('salmo-preview').textContent = buildSalmoPreviewLocal();
      el('salmo-estimativa').textContent =
        'Estimativa: ' + getQuantidadeEstimativaSalmo() +
        ' contato(s). Este envio nao muda o ciclo do menu e nao destrava silencio.';
    }

    function getModoAutomatico(ativo, tipo) {
      if (!ativo) return 'nenhum';
      if (tipo === 'biblia') return 'biblia';
      return tipo === 'salmo' ? 'salmo' : 'texto';
    }

    function setModoAutomatico(scope, modo) {
      if (!menuState || !menuState.comportamento) return;
      var configCampos = scope === 'apos'
        ? {
            ativo: 'mensagemAutomaticaAposMenuAtiva',
            tipo: 'mensagemAutomaticaAposMenuTipo',
            select: 'apos-menu-modo',
            texto: 'apos-menu-texto-wrap',
            label: 'apos-menu-texto-label'
          }
        : {
            ativo: 'mensagemAutomaticaEsperaAtiva',
            tipo: 'mensagemAutomaticaEsperaTipo',
            select: 'espera-modo',
            texto: 'espera-texto-wrap',
            label: 'espera-texto-label'
      };
      var value = modo || el(configCampos.select).value;
      menuState.comportamento[configCampos.ativo] = value !== 'nenhum';

      if (scope === 'apos') {
        menuState.comportamento[configCampos.tipo] = value === 'salmo' ? 'salmo' : 'nenhuma';
        el(configCampos.texto).classList.toggle('hidden', value === 'nenhum');
        el(configCampos.label).textContent = value === 'salmo'
          ? 'Mensagem personalizada antes do salmo'
          : 'Texto simples';
        return;
      }

      menuState.comportamento[configCampos.tipo] =
        value === 'salmo' || value === 'biblia' ? value : 'nenhuma';
      el(configCampos.texto).classList.toggle('hidden', value !== 'texto' && value !== 'biblia');
      el(configCampos.label).textContent = value === 'biblia'
        ? 'Mensagem antes da palavra biblica'
        : 'Texto simples';
    }

    function atualizarModosAutomaticos() {
      setModoAutomatico('apos');
      setModoAutomatico('espera');
    }

    function buildMenuPreviewLocal() {
      if (!menuState || !menuState.menu) return '';
      var menu = menuState.menu;
      var lines = [
        aplicarTagsLocal(menu.titulo),
        '',
        aplicarTagsLocal(menu.subtitulo),
        '',
        aplicarTagsLocal(menu.instrucao),
        '',
      ].concat(buildOptionsLinesLocal(menu.opcoes, '')).concat([
        '',
        aplicarTagsLocal(menu.rodape)
      ]);

      return lines.filter(function (line, index, array) {
        return line || array[index - 1];
      }).join('\\n');
    }

    function validarMenuLocal() {
      var avisos = [];

      function add(nivel, titulo, detalhe) {
        avisos.push({ nivel: nivel, titulo: titulo, detalhe: detalhe });
      }

      function validarOpcoes(opcoes, caminho) {
        var vistos = {};
        (opcoes || []).forEach(function (opcao) {
          var numero = String(opcao.numero || '').trim();
          var label = caminho + ' > opcao ' + (numero || '?');

          if (!numero) add('erro', 'Opcao sem numero', label);
          if (vistos[numero]) add('erro', 'Numero duplicado', 'O numero ' + numero + ' aparece mais de uma vez em ' + caminho + '.');
          vistos[numero] = true;

          if (!String(opcao.titulo || '').trim()) add('aviso', 'Opcao sem titulo', label);
          if (opcao.tipo === 'mensagem' && !String(opcao.mensagem || '').trim()) add('aviso', 'Mensagem vazia', label + ' nao tem resposta.');
          if (opcao.tipo === 'submenu' && (!opcao.submenus || !opcao.submenus.length)) add('aviso', 'Submenu vazio', label + ' nao tem subopcoes.');
          if (opcao.submenus && opcao.submenus.length) validarOpcoes(opcao.submenus, label);
        });
      }

      if (!menuState || !menuState.menu || !menuState.menu.opcoes.length) {
        add('erro', 'Menu sem opcoes', 'Crie pelo menos uma opcao.');
      } else {
        validarOpcoes(menuState.menu.opcoes, 'menu principal');
      }

      if (!avisos.length) {
        add('ok', 'Menu sem avisos', 'A estrutura atual do menu parece pronta.');
      }

      return avisos;
    }

    function updateMenuPreview() {
      if (!el('menu-preview') || !menuState) return;
      el('menu-preview').textContent = buildMenuPreviewLocal();
      renderDiagnosticList('menu-alerts', validarMenuLocal());
    }

    async function loadConfig() {
      var response = await fetch('/api/config');
      menuState = await response.json();
      menuState.empresa = menuState.empresa || {};
      menuState.salmo = menuState.salmo || {};
      renderTagsDisponiveis(menuState.tagsDisponiveis || []);
      bindValue('empresa-nome', ['empresa', 'nome']);
      bindValue('empresa-telefone', ['empresa', 'telefone']);
      bindValue('empresa-endereco', ['empresa', 'endereco']);
      bindValue('empresa-ponto', ['empresa', 'pontoReferencia']);
      bindValue('empresa-maps', ['empresa', 'mapsUrl']);
      bindValue('empresa-agenda', ['empresa', 'minhaAgendaUrl']);
      bindValue('empresa-horario', ['empresa', 'horarioFuncionamento']);
      bindValue('empresa-instagram', ['empresa', 'instagram']);
      bindValue('empresa-email', ['empresa', 'email']);
      bindValue('menu-titulo', ['menu', 'titulo']);
      bindValue('menu-subtitulo', ['menu', 'subtitulo']);
      bindValue('menu-recepcao', ['menu', 'mensagemRecepcaoAntesMenu']);
      bindValue('menu-palavras', ['menu', 'palavrasChave'], true);
      bindValue('menu-saudacoes', ['menu', 'saudacoes'], true);
      bindValue('menu-instrucao', ['menu', 'instrucao']);
      bindValue('menu-rodape', ['menu', 'rodape']);
      bindValue('menu-invalida', ['menu', 'respostaOpcaoInvalida']);
      bindValue('menu-humano', ['menu', 'respostaModoHumano']);
      bindValue('salmo-mensagem-antes', ['salmo', 'mensagemAntes']);
      bindValue('salmo-mensagem-depois', ['salmo', 'mensagemDepois']);
      el('digitando-ativo').value = String(Boolean(menuState.comportamento.digitandoAtivo));
      el('tempo-digitando').value = menuState.comportamento.tempoDigitandoMs;
      el('atraso-resposta').value = menuState.comportamento.atrasoRespostaMs;
      el('janela-menu').value = menuState.comportamento.janelaMenuMinutos || 30;
      el('atraso-menu-inicial').value = menuState.comportamento.atrasoMenuInicialMs || 2500;
      el('intervalo-menu').value = String(menuState.comportamento.intervaloMenuDias);
      el('historico-ativo').value = String(Boolean(menuState.comportamento.historicoMensagensAtivo));
      el('responder-todos').value = String(Boolean(menuState.comportamento.responderTodosClientes));
      el('recepcao-menu-ativa').value = String(menuState.comportamento.recepcaoAntesMenuAtiva !== false);
      el('apos-menu-modo').value = getModoAutomatico(
        menuState.comportamento.mensagemAutomaticaAposMenuAtiva,
        menuState.comportamento.mensagemAutomaticaAposMenuTipo
      );
      el('apos-menu-atraso').value = menuState.comportamento.mensagemAutomaticaAposMenuAtrasoMs || 1500;
      el('apos-menu-texto').value = menuState.comportamento.mensagemAutomaticaAposMenuTexto || '';
      el('espera-modo').value = getModoAutomatico(
        menuState.comportamento.mensagemAutomaticaEsperaAtiva,
        menuState.comportamento.mensagemAutomaticaEsperaTipo
      );
      el('espera-atraso').value = menuState.comportamento.mensagemAutomaticaEsperaAtrasoMs || 1500;
      el('espera-texto').value = menuState.comportamento.mensagemAutomaticaEsperaTexto || '';
      el('digitando-ativo').onchange = function () { menuState.comportamento.digitandoAtivo = el('digitando-ativo').value === 'true'; };
      el('tempo-digitando').oninput = function () { menuState.comportamento.tempoDigitandoMs = Number(el('tempo-digitando').value || 0); };
      el('atraso-resposta').oninput = function () { menuState.comportamento.atrasoRespostaMs = Number(el('atraso-resposta').value || 0); };
      el('janela-menu').oninput = function () { menuState.comportamento.janelaMenuMinutos = Number(el('janela-menu').value || 30); };
      el('atraso-menu-inicial').oninput = function () { menuState.comportamento.atrasoMenuInicialMs = Number(el('atraso-menu-inicial').value || 0); };
      el('intervalo-menu').onchange = function () { menuState.comportamento.intervaloMenuDias = Number(el('intervalo-menu').value); };
      el('historico-ativo').onchange = function () { menuState.comportamento.historicoMensagensAtivo = el('historico-ativo').value === 'true'; };
      el('responder-todos').onchange = function () { menuState.comportamento.responderTodosClientes = el('responder-todos').value === 'true'; };
      el('recepcao-menu-ativa').onchange = function () { menuState.comportamento.recepcaoAntesMenuAtiva = el('recepcao-menu-ativa').value === 'true'; };
      el('apos-menu-modo').onchange = function () { setModoAutomatico('apos'); };
      el('apos-menu-atraso').oninput = function () { menuState.comportamento.mensagemAutomaticaAposMenuAtrasoMs = Number(el('apos-menu-atraso').value || 0); };
      el('apos-menu-texto').oninput = function () { menuState.comportamento.mensagemAutomaticaAposMenuTexto = el('apos-menu-texto').value; };
      el('espera-modo').onchange = function () { setModoAutomatico('espera'); };
      el('espera-atraso').oninput = function () { menuState.comportamento.mensagemAutomaticaEsperaAtrasoMs = Number(el('espera-atraso').value || 0); };
      el('espera-texto').oninput = function () { menuState.comportamento.mensagemAutomaticaEsperaTexto = el('espera-texto').value; };
      atualizarModosAutomaticos();
      renderOptions();
      updateMenuPreview();
      updateSalmoPreview();
    }

    async function saveConfig() {
      el('save-status').textContent = 'Salvando...';
      var response = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(menuState)
      });
      menuState = await response.json();
      renderOptions();
      updateSalmoPreview();
      await loadStatus();
      el('save-status').textContent = 'Salvo. As proximas mensagens ja usam esta configuracao.';
    }

    async function resetConfig() {
      if (!confirm('Restaurar configuracao segura padrao?')) return;
      var response = await fetch('/api/config/reset', { method: 'POST' });
      menuState = await response.json();
      await loadConfig();
      el('save-status').textContent = 'Padrao seguro restaurado.';
    }

    async function clearHistory() {
      if (!confirm('Limpar historico antigo de mensagens? Clientes e configuracoes continuam salvos.')) return;
      var response = await fetch('/api/mensagens/limpar', { method: 'POST' });
      var data = await response.json();
      el('save-status').textContent = 'Historico limpo. Registros removidos: ' + data.removidos;
    }

    async function loadBackups() {
      var response = await fetch('/api/backups');
      var backups = await response.json();
      el('backups-tbody').innerHTML = backups.length ? backups.map(function (item) {
        return '<tr><td>' + escapeHtml(formatDate(item.criadoEm)) + '</td><td>' +
          escapeHtml(formatBytes(item.tamanhoBytes)) + '</td></tr>';
      }).join('') : '<tr><td colspan="2">Nenhum backup criado ainda.</td></tr>';
    }

    async function criarBackupAgora() {
      var button = el('create-backup');
      button.disabled = true;
      el('backup-status').textContent = 'Criando backup...';

      try {
        var backupCriado = await postJson('/api/backup/criar', {});
        el('backup-status').textContent =
          'Backup criado em ' + formatDate(backupCriado.criadoEm) + ' (' + formatBytes(backupCriado.tamanhoBytes) + ').';
        await loadBackups();
        await loadStatus();
      } catch (error) {
        el('backup-status').textContent = error.message;
        alert(error.message);
      } finally {
        button.disabled = false;
      }
    }

    async function loadModoHumano() {
      var response = await fetch('/api/clientes/modo-humano');
      var clientes = await response.json();
      el('humanos-tbody').innerHTML = clientes.length ? clientes.map(function (cliente) {
        return '<tr><td>' + escapeHtml(cliente.nome || '-') + '</td><td>' +
          escapeHtml(cliente.telefone) + '</td><td>' + escapeHtml(formatDate(cliente.atualizado_em)) +
          '</td><td><button class="secondary table-action reativar-humano" data-telefone="' +
          escapeHtml(cliente.telefone) + '">Reativar bot</button></td></tr>';
      }).join('') : '<tr><td colspan="4">Nenhum cliente em modo humano.</td></tr>';

      document.querySelectorAll('.reativar-humano').forEach(function (button) {
        button.addEventListener('click', function () { reativarClienteHumano(button.dataset.telefone); });
      });
    }

    async function reativarClienteHumano(telefone) {
      if (!confirm('Reativar o bot automatico para ' + telefone + '?')) return;
      await postJson('/api/clientes/reativar-bot', { telefone: telefone });
      await loadModoHumano();
      await loadAtendimentos();
      await loadStatus();
    }

    function getClienteStatus(cliente) {
      if (cliente.modo_humano === 1) {
        return 'humano';
      }

      if (cliente.bot_silenciado_ate_data) {
        return 'silenciado';
      }

      return 'automatico';
    }

    function getClienteStatusLabel(status) {
      if (status === 'humano') return 'Modo humano';
      if (status === 'silenciado') return 'Silenciado';
      return 'Automatico';
    }

    async function loadAtendimentos() {
      var response = await fetch('/api/clientes/recentes');
      atendimentosCache = await response.json();
      renderAtendimentos();
      updateSalmoPreview();
    }

    function renderAtendimentos() {
      var termo = String(el('atendimentos-search').value || '').toLowerCase();
      var statusFiltro = el('atendimentos-status').value;
      var filtrados = atendimentosCache.filter(function (cliente) {
        var status = getClienteStatus(cliente);
        var texto = String(cliente.nome || '').toLowerCase() + ' ' + String(cliente.telefone || '');
        var bateBusca = !termo || texto.includes(termo);
        var bateStatus = statusFiltro === 'todos' || statusFiltro === status;
        return bateBusca && bateStatus;
      });

      el('atendimentos-tbody').innerHTML = filtrados.length ? filtrados.map(function (cliente) {
        var status = getClienteStatus(cliente);
        var acao = status === 'humano'
          ? '<button class="secondary table-action reativar-atendimento" data-telefone="' + escapeHtml(cliente.telefone) + '">Reativar</button>'
          : '-';

        return '<tr><td>' + escapeHtml(cliente.nome || '-') + '</td><td>' + escapeHtml(cliente.telefone) +
          '</td><td>' + escapeHtml(getClienteStatusLabel(status)) + '</td><td>' +
          escapeHtml(cliente.ultimo_menu_data || '-') + '</td><td>' +
          escapeHtml(formatDate(cliente.atualizado_em)) + '</td><td>' + acao + '</td></tr>';
      }).join('') : '<tr><td colspan="6">Nenhum atendimento encontrado.</td></tr>';

      document.querySelectorAll('.reativar-atendimento').forEach(function (button) {
        button.addEventListener('click', function () { reativarClienteHumano(button.dataset.telefone); });
      });
    }

    document.querySelectorAll('.tab-button').forEach(function (button) {
      button.addEventListener('click', function () { activateTab(button.dataset.tab); });
    });
    document.querySelectorAll('.help-btn').forEach(function (button) {
      button.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        alert(button.dataset.help || 'Sem explicacao cadastrada.');
      });
    });
    el('start').addEventListener('click', function () { callAction('/api/start-whatsapp', 'start'); });
    el('stop').addEventListener('click', function () { callAction('/api/stop-whatsapp', 'stop'); });
    el('restart').addEventListener('click', function () { callAction('/api/restart-whatsapp', 'restart'); });
    el('recover').addEventListener('click', recuperarConexaoWhatsApp);
    el('clear-session').addEventListener('click', apagarSessaoWhatsApp);
    el('refresh').addEventListener('click', loadStatus);
    el('startup-enable').addEventListener('click', function () { setStartup(true); });
    el('startup-disable').addEventListener('click', function () { setStartup(false); });
    el('auto-start-whatsapp').addEventListener('change', setAutoStartWhatsApp);
    el('create-backup').addEventListener('click', criarBackupAgora);
    el('refresh-backups').addEventListener('click', loadBackups);
    el('refresh-humanos').addEventListener('click', loadModoHumano);
    el('refresh-atendimentos').addEventListener('click', loadAtendimentos);
    el('atendimentos-search').addEventListener('input', renderAtendimentos);
    el('atendimentos-status').addEventListener('change', renderAtendimentos);
    el('tag-float-button').addEventListener('click', function () { toggleTagPanel(); });
    el('tag-float-close').addEventListener('click', function () { toggleTagPanel(false); });
    el('modo-teste-seguro').addEventListener('click', ativarModoTesteSeguro);
    el('producao-segura').addEventListener('click', ativarProducaoSegura);
    el('limpar-telefones').addEventListener('click', limparTelefonesPermitidos);
    el('limpar-silencios').addEventListener('click', limparClientesSilenciados);
    el('desativar-bot').addEventListener('click', desativarBot);
    el('test-button').addEventListener('click', testResponse);
    el('test-input').addEventListener('keydown', function (event) { if (event.key === 'Enter') testResponse(); });
    el('save-config').addEventListener('click', saveConfig);
    el('reload-config').addEventListener('click', loadConfig);
    el('reset-config').addEventListener('click', resetConfig);
    el('clear-history').addEventListener('click', clearHistory);
    el('campanha-alvo').addEventListener('change', onCampanhaAlvoChange);
    el('campanha-texto').addEventListener('input', updateCampanhaPreview);
    el('campanha-lista').addEventListener('input', updateCampanhaPreview);
    el('campanha-lista-salva').addEventListener('change', updateCampanhaPreview);
    el('campanha-delay-min').addEventListener('change', updateCampanhaPreview);
    el('campanha-delay-max').addEventListener('change', updateCampanhaPreview);
    el('campanha-imagem').addEventListener('change', updateCampanhaPreview);
    el('telefones-teste').addEventListener('input', function () {
      updateCampanhaPreview();
      updateSalmoPreview();
    });
    el('salmo-alvo').addEventListener('change', updateSalmoPreview);
    el('salmo-delay-min').addEventListener('change', updateSalmoPreview);
    el('salmo-delay-max').addEventListener('change', updateSalmoPreview);
    el('btn-enviar-salmo').addEventListener('click', executarEnvioSalmo);
    el('btn-cancelar-salmo').addEventListener('click', cancelarCampanhaAtual);
    el('btn-disparar-campanha').addEventListener('click', executarDisparoCampanha);
    el('btn-cancelar-campanha').addEventListener('click', cancelarCampanhaAtual);
    el('btn-copiar-relatorio-campanha').addEventListener('click', copiarRelatorioCampanha);
    el('btn-duplicar-campanha').addEventListener('click', duplicarUltimaCampanha);
    el('btn-exportar-relatorio-campanha').addEventListener('click', exportarRelatorioCampanha);
    el('btn-carregar-csv').addEventListener('click', carregarCSV);
    el('btn-limpar-base').addEventListener('click', limparBaseCSV);
    el('search-csv').addEventListener('input', renderCsvTable);
    el('btn-excluir-lista').addEventListener('click', excluirListaSalva);
    el('listas-salvas').addEventListener('change', function () {
      var lista = getListaSelecionada();
      el('nome-lista').value = lista ? lista.nome : '';
      renderListaDetalhe();
    });
    el('btn-add-manual-base').addEventListener('click', adicionarClienteManualNaBase);
    el('btn-add-manual-lista').addEventListener('click', adicionarClienteManualNaLista);
    el('btn-add-selecionados-lista').addEventListener('click', adicionarSelecionadosNaListaAtual);
    el('selecionar-todos-csv').addEventListener('change', function () {
      csvFiltrado.forEach(function (contato) {
        selecionadosCsv[contato.telefone] = el('selecionar-todos-csv').checked;
      });
      renderCsvTable();
    });
    el('add-option').addEventListener('click', function () {
      menuState.menu.opcoes.push(makeOption(menuState.menu.opcoes.length + 1));
      renderOptions();
    });
    el('add-example').addEventListener('click', function () {
      menuState.menu.opcoes.push({
        numero: String(menuState.menu.opcoes.length + 1),
        titulo: 'Tratamentos faciais',
        tipo: 'submenu',
        mensagem: 'Escolha um tratamento facial:',
        submenus: [
          { numero: '1', titulo: 'Limpeza de pele', tipo: 'mensagem', mensagem: 'A limpeza de pele ajuda na higienizacao profunda e remocao de impurezas.', submenus: [] },
          { numero: '2', titulo: 'Peeling', tipo: 'mensagem', mensagem: 'O peeling deve ser avaliado conforme o tipo de pele e objetivo do tratamento.', submenus: [] }
        ]
      });
      renderOptions();
    });
    observarCampoTextoAtivo();
    loadStatus();
    loadConfig();
    loadBackups();
    loadModoHumano();
    loadAtendimentos();
    loadHistoricoCampanhas();
    carregarUltimaCampanhaConfig();
    onCampanhaAlvoChange();
    carregarBaseSalva();
    carregarListasSalvas().then(updateCampanhaPreview);
    setInterval(loadStatus, 5000);
    setInterval(loadModoHumano, 15000);
    setInterval(loadAtendimentos, 20000);
    setInterval(loadHistoricoCampanhas, 30000);
  </script>
</body>
</html>`;
}

function startInterface(actions) {
  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, `http://${request.headers.host}`);

      if (request.method === 'GET' && url.pathname === '/') {
        sendHtml(response, getHtml());
        return;
      }

      if (request.method === 'GET' && url.pathname === '/api/status') {
        sendJson(response, 200, getSnapshot());
        return;
      }

      if (request.method === 'GET' && url.pathname === '/api/config') {
        const currentConfig = menuConfig.loadMenuConfig();
        sendJson(response, 200, {
          ...currentConfig,
          tagsDisponiveis: menuConfig.getTagsDisponiveis(),
          salmoAtual: menuConfig.getSalmoAtual(),
          palavraBiblicaAtual: menuConfig.getPalavraBiblicaAtual()
        });
        return;
      }

      if (request.method === 'GET' && url.pathname === '/api/diagnostico') {
        sendJson(response, 200, diagnostico.gerarDiagnostico());
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/config') {
        const body = await readBody(request);
        const savedConfig = menuConfig.saveMenuConfig(body);
        sendJson(response, 200, {
          ...savedConfig,
          tagsDisponiveis: menuConfig.getTagsDisponiveis(),
          salmoAtual: menuConfig.getSalmoAtual(),
          palavraBiblicaAtual: menuConfig.getPalavraBiblicaAtual()
        });
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/config/reset') {
        await backup.createBackup();
        const resetConfig = menuConfig.resetMenuConfig();
        sendJson(response, 200, {
          ...resetConfig,
          tagsDisponiveis: menuConfig.getTagsDisponiveis(),
          salmoAtual: menuConfig.getSalmoAtual(),
          palavraBiblicaAtual: menuConfig.getPalavraBiblicaAtual()
        });
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/mensagens/limpar') {
        sendJson(response, 200, { removidos: mensagensRepository.limparHistorico() });
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/startup/enable') {
        sendJson(response, 200, startup.enableStartup());
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/startup/disable') {
        sendJson(response, 200, startup.disableStartup());
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/autostart-whatsapp') {
        const body = await readBody(request);
        envManager.atualizarAutoStartWhatsApp(Boolean(body.enabled));
        sendJson(response, 200, getSnapshot());
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/security/test-mode') {
        const body = await readBody(request);
        atualizarResponderTodosClientes(false);
        envManager.ativarModoTesteSeguro(String(body.telefones || '').trim());
        sendJson(response, 200, getSnapshot());
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/security/production') {
        const body = await readBody(request);
        const bloqueios = diagnostico.gerarBloqueiosProducao();

        if (bloqueios.length) {
          sendJson(response, 400, {
            erro: `Corrija o diagnostico antes de liberar producao: ${bloqueios.map((item) => item.titulo).join(', ')}.`,
            bloqueios
          });
          return;
        }

        await backup.createBackup();
        atualizarResponderTodosClientes(true);
        envManager.ativarProducaoSegura(Boolean(body.removerTelefonesTeste));
        sendJson(response, 200, getSnapshot());
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/security/clear-allowed') {
        envManager.limparTelefonesPermitidos();
        sendJson(response, 200, getSnapshot());
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/security/disable-bot') {
        envManager.desativarBot();
        sendJson(response, 200, getSnapshot());
        return;
      }

      if (request.method === 'GET' && url.pathname === '/api/backups') {
        sendJson(response, 200, backup.listBackups());
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/backup/criar') {
        sendJson(response, 200, await backup.createBackup());
        return;
      }

      if (request.method === 'GET' && url.pathname === '/api/clientes/modo-humano') {
        sendJson(response, 200, clientesRepository.listarModoHumano());
        return;
      }

      if (request.method === 'GET' && url.pathname === '/api/clientes/recentes') {
        sendJson(response, 200, clientesRepository.listarRecentes());
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/clientes/reativar-bot') {
        const body = await readBody(request);
        const telefone = String(body.telefone || '').replace(/\D/g, '');

        if (!telefone) {
          sendJson(response, 400, { erro: 'Informe o telefone do cliente.' });
          return;
        }

        clientesRepository.desativarModoHumano(telefone);
        sendJson(response, 200, { ok: true, telefone });
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/clientes/limpar-silencios') {
        sendJson(response, 200, { ok: true, removidos: clientesRepository.limparSilencios() });
        return;
      }

      if (request.method === 'GET' && url.pathname === '/api/base') {
        sendJson(response, 200, gerenciadorListas.lerBaseContatos());
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/base/salvar') {
        const body = await readBody(request);
        sendJson(response, 200, gerenciadorListas.salvarBaseContatos(body.contatos));
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/base/limpar') {
        sendJson(response, 200, gerenciadorListas.limparBaseContatos());
        return;
      }

      if (request.method === 'GET' && url.pathname === '/api/listas') {
        sendJson(response, 200, gerenciadorListas.lerListas());
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/listas/salvar') {
        const body = await readBody(request);
        sendJson(response, 200, gerenciadorListas.salvarLista(body.nome, body.contatos));
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/listas/excluir') {
        const body = await readBody(request);
        sendJson(response, 200, gerenciadorListas.excluirLista(body.nome));
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/salmo/enviar') {
        const body = await readBody(request);

        if (!actions.enviarSalmoDia) {
          sendJson(response, 500, { erro: 'Acao de salmo do dia nao esta configurada.' });
          return;
        }

        if (!getStatus().ready) {
          sendJson(response, 400, { erro: 'WhatsApp nao esta pronto. Conecte o WhatsApp antes de enviar o salmo do dia.' });
          return;
        }

        if (config.modoTeste && (body.alvo || 'teste') !== 'teste') {
          sendJson(response, 400, { erro: 'Modo teste ativo: envie o salmo apenas para os numeros de teste.' });
          return;
        }

        actions.enviarSalmoDia(body)
          .catch((error) => logger.error('Erro no envio de salmo em background:', error));
        sendJson(response, 200, { ok: true, mensagem: 'Envio de salmo iniciado.' });
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/campanha/disparar') {
        const body = await readBody(request);

        if (!actions.dispararCampanha) {
          sendJson(response, 500, { erro: 'Acao de campanha nao esta configurada.' });
          return;
        }

        actions.dispararCampanha(body)
          .catch((error) => logger.error('Erro na campanha em background:', error));
        sendJson(response, 200, { ok: true, mensagem: 'Campanha iniciada.' });
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/campanha/cancelar') {
        if (actions.cancelarCampanha) {
          sendJson(response, 200, actions.cancelarCampanha());
          return;
        }

        sendJson(response, 200, { ok: false });
        return;
      }

      if (request.method === 'GET' && url.pathname === '/api/campanhas/historico') {
        sendJson(response, 200, lerHistoricoCampanhas());
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/start-whatsapp') {
        await actions.startWhatsApp('inicio solicitado pela interface');
        sendJson(response, 200, { ok: true });
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/stop-whatsapp') {
        await actions.stopWhatsApp('parada solicitada pela interface');
        sendJson(response, 200, { ok: true });
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/restart-whatsapp') {
        await actions.restartWhatsApp('reinicio solicitado pela interface');
        sendJson(response, 200, { ok: true });
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/recover-whatsapp') {
        await actions.recoverWhatsApp('recuperacao solicitada pela interface');
        sendJson(response, 200, { ok: true });
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/clear-whatsapp-session') {
        await actions.clearWhatsAppSession('acao solicitada pela interface');
        sendJson(response, 200, { ok: true });
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/teste') {
        const body = await readBody(request);
        const comando = normalizarComandoTeste(body.texto);
        const resposta = teste.obterRespostaTeste('teste-interface', comando);
        sendJson(response, 200, { resposta });
        return;
      }

      sendJson(response, 404, { erro: 'Rota nao encontrada.' });
    } catch (error) {
      logger.error('Erro na interface:', error);
      sendJson(response, 500, { erro: error.message });
    }
  });

  const port = getPort();

  server.listen(port, '127.0.0.1', () => {
    logger.info(`Interface local disponivel em http://localhost:${port}`);
  });

  server.on('error', (error) => {
    logger.error('Erro ao iniciar interface local:', error);
  });

  return server;
}

module.exports = {
  startInterface
};
