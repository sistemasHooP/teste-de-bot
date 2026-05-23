const http = require('http');
const logger = require('./logger');
const config = require('./config');
const teste = require('./teste');
const menuConfig = require('./menuConfig');
const envManager = require('./envManager');
const startup = require('./startup');
const mensagensRepository = require('./repositories/mensagensRepository');
const { getStatus } = require('./status');
const { normalizeText } = require('./utils');

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
      if (body.length > 300000) {
        reject(new Error('Corpo da requisicao muito grande.'));
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
    '6': '/6',
    quiz: '/quiz',
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
      --bg: #f4f7f5;
      --surface: #fff;
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
    body { margin: 0; background: var(--bg); color: var(--text); font-family: Arial, Helvetica, sans-serif; }
    header { background: #12352b; color: white; padding: 18px 26px; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
    h1, h2, h3 { margin: 0; }
    h1 { font-size: 21px; }
    h2 { font-size: 17px; margin-bottom: 14px; }
    h3 { font-size: 15px; margin: 18px 0 10px; }
    main { width: min(1220px, calc(100% - 28px)); margin: 22px auto 42px; display: grid; gap: 16px; }
    .brand { display: flex; align-items: center; gap: 12px; }
    .mark { width: 38px; height: 38px; border-radius: 8px; background: var(--accent2); color: #12352b; display: grid; place-items: center; font-weight: 800; }
    .sub { color: #bfd2cb; font-size: 13px; margin-top: 2px; }
    .grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
    .split { display: grid; grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr); gap: 16px; }
    .panel, .metric, .option { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; box-shadow: var(--shadow); }
    .metric { padding: 16px; min-height: 108px; }
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
    textarea { min-height: 92px; resize: vertical; }
    button { border: 0; border-radius: 8px; min-height: 40px; padding: 9px 13px; background: var(--accent); color: white; font-weight: 700; cursor: pointer; }
    button.secondary { background: #e8eee9; color: var(--text); border: 1px solid var(--line); }
    button.warning { background: var(--warn); }
    button.danger { background: var(--danger); }
    button:disabled { opacity: 0.6; cursor: wait; }
    .pill { display: inline-flex; align-items: center; min-height: 28px; padding: 4px 10px; border-radius: 999px; font-size: 13px; font-weight: 800; background: #fff2d8; color: var(--warn); }
    .pill.ok { color: var(--accent); background: #dff3ec; }
    .pill.danger { color: var(--danger); background: #fde6e6; }
    .tabs { display: flex; flex-wrap: wrap; gap: 8px; }
    .tab-button { background: #e8eee9; color: var(--text); border: 1px solid var(--line); }
    .tab-button.active { background: var(--accent); color: white; border-color: var(--accent); }
    .tab-panel { display: none; }
    .tab-panel.active { display: grid; gap: 16px; }
    .logs { max-height: 330px; overflow: auto; background: #101714; color: #e6eee9; border-radius: 8px; padding: 14px; }
    pre { margin: 0; white-space: pre-wrap; word-break: break-word; font-family: Consolas, Monaco, monospace; font-size: 13px; }
    .answer { background: #f7faf8; border: 1px solid var(--line); border-radius: 8px; padding: 14px; min-height: 82px; margin-top: 12px; }
    .qr-box { display: grid; gap: 10px; place-items: center; min-height: 220px; background: #f7faf8; border: 1px dashed var(--line); border-radius: 8px; padding: 14px; text-align: center; }
    .qr-code { display: none; background: white; color: black; border: 10px solid white; border-radius: 4px; font-family: Consolas, "Courier New", monospace; font-size: 10px; line-height: 10px; letter-spacing: 0; white-space: pre; word-break: normal; overflow: auto; max-width: 100%; }
    .qr-code.active { display: block; }
    .security-banner { border-radius: 8px; padding: 12px 14px; border: 1px solid var(--line); background: #f7faf8; margin-bottom: 14px; }
    .security-banner strong { display: block; margin-bottom: 4px; }
    .security-banner.production { background: #fff8e8; border-color: #f3cf8d; }
    .security-banner.paused { background: #fde6e6; border-color: #efb2b2; }
    .save-bar { position: sticky; bottom: 0; background: rgba(244, 247, 245, 0.92); backdrop-filter: blur(8px); padding: 12px 0 0; }
    @media (max-width: 920px) { header { flex-direction: column; align-items: flex-start; } .grid, .split, .field-grid { grid-template-columns: 1fr; } }
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
      <div class="metric"><div class="label">Bot Ativo</div><div id="bot-ativo" class="value">...</div><div class="hint">Trava no .env</div></div>
      <div class="metric"><div class="label">Modo Teste</div><div id="modo-teste" class="value">...</div><div class="hint">Comandos controlados</div></div>
      <div class="metric"><div class="label">Permitidos</div><div id="permitidos" class="value">...</div><div class="hint">Whitelist atual</div></div>
    </section>

    <section class="panel">
      <div class="tabs">
        <button class="tab-button active" data-tab="controle">Controle</button>
        <button class="tab-button" data-tab="mensagens">Mensagens</button>
        <button class="tab-button" data-tab="menus">Menus</button>
        <button class="tab-button" data-tab="comportamento">Comportamento</button>
        <button class="tab-button" data-tab="logs">Logs</button>
      </div>
    </section>

    <section id="tab-controle" class="tab-panel active">
      <div class="split">
        <div class="panel">
          <h2>Controle do Bot</h2>
          <div id="security-banner" class="security-banner">
            <strong id="security-title">Carregando seguranca</strong>
            <span id="security-text">Aguarde...</span>
          </div>
          <div class="row">
            <button id="start">Iniciar Bot</button>
            <button id="restart" class="warning">Reiniciar WhatsApp</button>
            <button id="stop" class="danger">Parar WhatsApp</button>
            <button id="clear-session" class="danger">Apagar sessao WhatsApp</button>
            <button id="refresh" class="secondary">Atualizar</button>
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
            <input id="test-input" placeholder="Digite oi, menu, 1, 1.1, /agenda ou /quiz">
            <button id="test-button">Testar</button>
          </div>
          <div class="answer"><pre id="test-output">A resposta aparece aqui sem enviar nada pelo WhatsApp.</pre></div>
        </div>
      </div>
    </section>

    <section id="tab-mensagens" class="tab-panel">
      <div class="panel">
        <h2>Mensagens Personalizadas</h2>
        <div class="field-grid">
          <label>Titulo do menu<textarea id="menu-titulo"></textarea></label>
          <label>Texto abaixo do titulo<textarea id="menu-subtitulo"></textarea></label>
          <label>Palavras para voltar ao menu<input id="menu-palavras" placeholder="menu, inicio, voltar"></label>
          <label>Saudacoes<input id="menu-saudacoes" placeholder="oi, ola, bom dia"></label>
          <label>Instrucao<input id="menu-instrucao"></label>
          <label>Rodape<input id="menu-rodape"></label>
          <label>Mensagem generica<textarea id="menu-generica"></textarea></label>
          <label>Opcao invalida<textarea id="menu-invalida"></textarea></label>
          <label>Mensagem em atendimento humano<textarea id="menu-humano"></textarea></label>
        </div>
      </div>
    </section>

    <section id="tab-menus" class="tab-panel">
      <div class="panel">
        <h2>Menus e Submenus</h2>
        <div class="row">
          <button id="add-option" class="secondary">Adicionar Opcao</button>
          <button id="add-example" class="secondary">Adicionar Exemplo com Submenu</button>
        </div>
        <div id="options-editor"></div>
      </div>
    </section>

    <section id="tab-comportamento" class="tab-panel">
      <div class="panel">
        <h2>Comportamento e Seguranca</h2>
        <div class="field-grid">
          <label>Quando reenviar menu inicial
            <select id="intervalo-menu">
              <option value="1">Todo dia</option>
              <option value="2">A cada 2 dias</option>
              <option value="3">A cada 3 dias</option>
              <option value="7">A cada 7 dias</option>
            </select>
          </label>
          <label>Salvar historico de mensagens
            <select id="historico-ativo">
              <option value="false">Nao, modo leve</option>
              <option value="true">Sim</option>
            </select>
          </label>
          <label>Atender clientes reais fora da lista de teste
            <select id="responder-todos">
              <option value="false">Nao, manter seguro</option>
              <option value="true">Sim, producao segura</option>
            </select>
          </label>
          <label>Mostrar digitando
            <select id="digitando-ativo">
              <option value="false">Nao</option>
              <option value="true">Sim</option>
            </select>
          </label>
          <label>Janela para aceitar opcoes em minutos<input id="janela-menu" type="number" min="1" max="1440" step="1"></label>
          <label>Tempo digitando em ms<input id="tempo-digitando" type="number" min="0" step="100"></label>
          <label>Atraso extra em ms<input id="atraso-resposta" type="number" min="0" step="100"></label>
        </div>
        <h3>Modo de Uso</h3>
        <div class="field-grid">
          <label>Numeros permitidos para teste<input id="telefones-teste" placeholder="558499210586"></label>
          <label>Ao liberar producao
            <select id="remover-telefone-teste">
              <option value="true">Remover numero de teste</option>
              <option value="false">Manter numero de teste</option>
            </select>
          </label>
        </div>
        <div class="row" style="margin-top: 12px;">
          <button id="modo-teste-seguro" class="secondary">Ativar modo teste seguro</button>
          <button id="producao-segura" class="warning">Sair do teste e usar</button>
          <button id="limpar-telefones" class="secondary">Remover numeros de teste</button>
          <button id="desativar-bot" class="danger">Parar respostas automaticas</button>
        </div>
        <p class="hint">No modo seguro novo, numero de opcao so vale enquanto o menu daquele cliente esta ativo. Se a pessoa ignorar o menu e mandar outra coisa, o bot silencia esse cliente ate o proximo ciclo configurado.</p>
        <div class="row">
          <button id="clear-history" class="danger">Limpar Historico Antigo</button>
        </div>
      </div>
    </section>

    <section id="tab-logs" class="tab-panel">
      <div class="panel">
        <h2>Logs Recentes</h2>
        <div class="logs"><pre id="logs">Carregando...</pre></div>
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

  <script>
    var menuState = null;
    function el(id) { return document.getElementById(id); }
    function boolText(value) { return value ? 'Sim' : 'Nao'; }
    function splitList(value) { return String(value || '').split(',').map(function (item) { return item.trim(); }).filter(Boolean); }

    function activateTab(name) {
      document.querySelectorAll('.tab-button').forEach(function (button) {
        button.classList.toggle('active', button.dataset.tab === name);
      });
      document.querySelectorAll('.tab-panel').forEach(function (panel) {
        panel.classList.toggle('active', panel.id === 'tab-' + name);
      });
    }

    function setStatusPill(status) {
      var pill = el('status-pill');
      pill.textContent = status.ready ? 'Pronto' : status.whatsappStatus;
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

    async function loadStatus() {
      var response = await fetch('/api/status');
      var data = await response.json();
      var status = data.status;
      var seguranca = data.seguranca;
      setStatusPill(status);
      updateSecurityBanner(seguranca);
      updateQr(status);
      el('whatsapp-status').textContent = status.whatsappStatus;
      el('last-ready').textContent = 'Pronto em: ' + formatDate(status.lastReadyAt);
      el('bot-ativo').textContent = boolText(seguranca.botAtivo);
      el('modo-teste').textContent = boolText(seguranca.modoTeste);
      el('permitidos').textContent = seguranca.telefonesPermitidos.length ? seguranca.telefonesPermitidos.join(', ') : 'Nenhum';
      if (document.activeElement !== el('telefones-teste')) {
        el('telefones-teste').value = seguranca.telefonesPermitidos.join(', ');
      }
      el('auto-start-whatsapp').value = String(Boolean(seguranca.autoStartWhatsApp));
      el('startup-state').value = data.startup.enabled ? 'Ativado' : 'Desativado';
      el('runtime-info').textContent =
        'Uptime: ' + status.uptimeSeconds + 's | Reinicios: ' + status.restartCount +
        ' | Ultimo erro: ' + (status.lastError || 'nenhum');
      el('logs').textContent = data.logs.length ? data.logs.join('\\n') : 'Sem logs recentes.';
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
      el('save-status').textContent = 'Sessao apagada. Clique em Iniciar Bot para gerar um novo QR Code.';
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
      input.oninput = function () { updateField(path, list ? splitList(input.value) : input.value); };
    }

    function makeOption(numero) {
      return { numero: String(numero || '1'), titulo: 'Nova opcao', tipo: 'mensagem', mensagem: '', submenus: [] };
    }

    function renderOptions() {
      var root = el('options-editor');
      root.innerHTML = '';
      menuState.menu.opcoes.forEach(function (option, index) {
        root.appendChild(renderOption(option, menuState.menu.opcoes, index, ''));
      });
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
      grid.appendChild(createInput('Titulo', option.titulo, function (value) { option.titulo = value; }));
      grid.appendChild(createSelect('Tipo', option.tipo, function (value) { option.tipo = value; }));
      grid.appendChild(createTextarea('Mensagem', option.mensagem, function (value) { option.mensagem = value; }));
      var row = document.createElement('div');
      row.className = 'row';
      row.style.marginTop = '10px';
      var addSub = document.createElement('button');
      addSub.type = 'button';
      addSub.className = 'secondary';
      addSub.textContent = 'Adicionar Submenu';
      addSub.onclick = function () {
        option.tipo = 'submenu';
        option.submenus.push(makeOption(option.submenus.length + 1));
        renderOptions();
      };
      var remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'danger';
      remove.textContent = 'Remover';
      remove.onclick = function () {
        list.splice(index, 1);
        renderOptions();
      };
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
      ['mensagem', 'submenu', 'humano', 'quiz'].forEach(function (tipo) {
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

    async function loadConfig() {
      var response = await fetch('/api/config');
      menuState = await response.json();
      bindValue('menu-titulo', ['menu', 'titulo']);
      bindValue('menu-subtitulo', ['menu', 'subtitulo']);
      bindValue('menu-palavras', ['menu', 'palavrasChave'], true);
      bindValue('menu-saudacoes', ['menu', 'saudacoes'], true);
      bindValue('menu-instrucao', ['menu', 'instrucao']);
      bindValue('menu-rodape', ['menu', 'rodape']);
      bindValue('menu-generica', ['menu', 'respostaGenerica']);
      bindValue('menu-invalida', ['menu', 'respostaOpcaoInvalida']);
      bindValue('menu-humano', ['menu', 'respostaModoHumano']);
      el('digitando-ativo').value = String(Boolean(menuState.comportamento.digitandoAtivo));
      el('tempo-digitando').value = menuState.comportamento.tempoDigitandoMs;
      el('atraso-resposta').value = menuState.comportamento.atrasoRespostaMs;
      el('janela-menu').value = menuState.comportamento.janelaMenuMinutos || 30;
      el('intervalo-menu').value = String(menuState.comportamento.intervaloMenuDias);
      el('historico-ativo').value = String(Boolean(menuState.comportamento.historicoMensagensAtivo));
      el('responder-todos').value = String(Boolean(menuState.comportamento.responderTodosClientes));
      el('digitando-ativo').onchange = function () { menuState.comportamento.digitandoAtivo = el('digitando-ativo').value === 'true'; };
      el('tempo-digitando').oninput = function () { menuState.comportamento.tempoDigitandoMs = Number(el('tempo-digitando').value || 0); };
      el('atraso-resposta').oninput = function () { menuState.comportamento.atrasoRespostaMs = Number(el('atraso-resposta').value || 0); };
      el('janela-menu').oninput = function () { menuState.comportamento.janelaMenuMinutos = Number(el('janela-menu').value || 30); };
      el('intervalo-menu').onchange = function () { menuState.comportamento.intervaloMenuDias = Number(el('intervalo-menu').value); };
      el('historico-ativo').onchange = function () { menuState.comportamento.historicoMensagensAtivo = el('historico-ativo').value === 'true'; };
      el('responder-todos').onchange = function () { menuState.comportamento.responderTodosClientes = el('responder-todos').value === 'true'; };
      renderOptions();
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

    document.querySelectorAll('.tab-button').forEach(function (button) {
      button.addEventListener('click', function () { activateTab(button.dataset.tab); });
    });
    el('start').addEventListener('click', function () { callAction('/api/start-whatsapp', 'start'); });
    el('stop').addEventListener('click', function () { callAction('/api/stop-whatsapp', 'stop'); });
    el('restart').addEventListener('click', function () { callAction('/api/restart-whatsapp', 'restart'); });
    el('clear-session').addEventListener('click', apagarSessaoWhatsApp);
    el('refresh').addEventListener('click', loadStatus);
    el('startup-enable').addEventListener('click', function () { setStartup(true); });
    el('startup-disable').addEventListener('click', function () { setStartup(false); });
    el('auto-start-whatsapp').addEventListener('change', setAutoStartWhatsApp);
    el('modo-teste-seguro').addEventListener('click', ativarModoTesteSeguro);
    el('producao-segura').addEventListener('click', ativarProducaoSegura);
    el('limpar-telefones').addEventListener('click', limparTelefonesPermitidos);
    el('desativar-bot').addEventListener('click', desativarBot);
    el('test-button').addEventListener('click', testResponse);
    el('test-input').addEventListener('keydown', function (event) { if (event.key === 'Enter') testResponse(); });
    el('save-config').addEventListener('click', saveConfig);
    el('reload-config').addEventListener('click', loadConfig);
    el('reset-config').addEventListener('click', resetConfig);
    el('clear-history').addEventListener('click', clearHistory);
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
    loadStatus();
    loadConfig();
    setInterval(loadStatus, 5000);
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
        sendJson(response, 200, menuConfig.loadMenuConfig());
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/config') {
        const body = await readBody(request);
        sendJson(response, 200, menuConfig.saveMenuConfig(body));
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/config/reset') {
        sendJson(response, 200, menuConfig.resetMenuConfig());
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
