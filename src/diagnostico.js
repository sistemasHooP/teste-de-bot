const config = require('./config');
const menuConfig = require('./menuConfig');
const { getStatus } = require('./status');

function isPlaceholder(value) {
  const text = String(value || '').trim().toLowerCase();
  return !text || text.includes('colocar ') || text.includes('aqui');
}

function isUrl(value) {
  return /^https?:\/\//i.test(String(value || '').trim());
}

function addIssue(items, nivel, titulo, detalhe) {
  items.push({
    nivel,
    titulo,
    detalhe
  });
}

function validarEmpresa(items, currentConfig) {
  const empresa = currentConfig.empresa || config.empresa;

  if (isPlaceholder(empresa.endereco)) {
    addIssue(items, 'aviso', 'Endereco nao configurado', 'Preencha o endereco na aba Empresa.');
  }

  if (isPlaceholder(empresa.mapsUrl) || !isUrl(empresa.mapsUrl)) {
    addIssue(items, 'aviso', 'Google Maps nao configurado', 'Use um link valido na aba Empresa.');
  }

  if (isPlaceholder(empresa.minhaAgendaUrl) || !isUrl(empresa.minhaAgendaUrl)) {
    addIssue(items, 'erro', 'Link de agendamento ausente', 'Configure o link de agendamento antes de atender clientes reais.');
  }

  if (!config.catalogoServicos.length) {
    addIssue(items, 'aviso', 'Catalogo vazio', 'Cadastre pelo menos um servico no CATALOGO_SERVICOS.');
  }
}

function validarNumerosOpcoes(items, opcoes, caminho = 'menu principal') {
  const vistos = new Set();

  for (const opcao of opcoes) {
    const numero = String(opcao.numero || '').trim();
    const label = `${caminho} > opcao ${numero || '?'}`;

    if (!numero) {
      addIssue(items, 'erro', 'Opcao sem numero', `Revise ${label}.`);
    }

    if (vistos.has(numero)) {
      addIssue(items, 'erro', 'Numero de opcao duplicado', `O numero ${numero} aparece mais de uma vez em ${caminho}.`);
    }

    vistos.add(numero);

    if (!String(opcao.titulo || '').trim()) {
      addIssue(items, 'aviso', 'Opcao sem titulo', `Revise ${label}.`);
    }

    if (opcao.tipo === 'mensagem' && !String(opcao.mensagem || '').trim()) {
      addIssue(items, 'aviso', 'Resposta vazia', `${label} esta como mensagem, mas nao tem texto de resposta.`);
    }

    if (opcao.tipo === 'humano' && !String(opcao.mensagem || '').trim()) {
      addIssue(items, 'aviso', 'Atendimento humano sem mensagem', `${label} deveria avisar que um atendente sera chamado.`);
    }

    if (opcao.tipo === 'submenu' && (!opcao.submenus || !opcao.submenus.length)) {
      addIssue(items, 'aviso', 'Submenu vazio', `${label} esta como submenu, mas nao possui subopcoes.`);
    }

    if (opcao.submenus && opcao.submenus.length) {
      validarNumerosOpcoes(items, opcao.submenus, label);
    }
  }
}

function validarMenu(items, currentConfig) {
  const menu = currentConfig.menu;

  if (!menu.palavrasChave.map((item) => item.toLowerCase()).includes('menu')) {
    addIssue(items, 'aviso', 'Palavra menu removida', 'Mantenha "menu" nas palavras para voltar ao menu principal.');
  }

  if (!menu.opcoes.length) {
    addIssue(items, 'erro', 'Menu sem opcoes', 'Crie pelo menos uma opcao no menu principal.');
    return;
  }

  validarNumerosOpcoes(items, menu.opcoes);

  const temHumano = JSON.stringify(menu.opcoes).includes('"tipo":"humano"');
  if (!temHumano) {
    addIssue(items, 'aviso', 'Sem opcao de atendente', 'Mantenha uma opcao para falar com atendente.');
  }
}

function validarSeguranca(items, currentConfig) {
  if (!config.botAtivo) {
    addIssue(items, 'aviso', 'Bot automatico pausado', 'BOT_ATIVO esta false; nenhuma resposta automatica sera enviada.');
  }

  if (!config.modoTeste && currentConfig.comportamento.responderTodosClientes) {
    addIssue(items, 'aviso', 'Producao liberada', 'Confirme se endereco, agenda e mensagens estao revisados antes de atender clientes reais.');
  }

  if (config.modoTeste && !config.telefonesPermitidos.length) {
    addIssue(items, 'erro', 'Modo teste sem numero permitido', 'Adicione pelo menos um telefone permitido para testar.');
  }
}

function validarConexao(items) {
  const status = getStatus();

  if (status.ready) {
    addIssue(items, 'ok', 'WhatsApp conectado', 'O monitor de conexao ve o WhatsApp como pronto para responder.');
    return;
  }

  if (status.authenticated && !status.ready) {
    addIssue(items, 'aviso', 'WhatsApp autenticado, aguardando abrir', 'Se ficar assim por alguns minutos, o monitor tenta reparar a conexao sozinho.');
  }

  if (String(status.whatsappStatus || '').includes('carregando')) {
    addIssue(items, 'aviso', 'WhatsApp carregando', 'Se travar no carregamento, use Reparar Conexao antes de apagar a sessao.');
  }

  if (status.lastHealthState === 'erro') {
    addIssue(items, 'aviso', 'Monitor detectou falha', status.lastError || 'O monitor nao conseguiu consultar o estado do WhatsApp.');
  }
}

function gerarDiagnostico() {
  const items = [];
  const currentConfig = menuConfig.loadMenuConfig();

  validarConexao(items);
  validarEmpresa(items, currentConfig);
  validarMenu(items, currentConfig);
  validarSeguranca(items, currentConfig);

  if (!items.some((item) => item.nivel === 'erro' || item.nivel === 'aviso')) {
    addIssue(items, 'ok', 'Configuracao revisada', 'Nao encontrei pendencias importantes agora.');
  }

  return items;
}

function isBloqueioProducao(item) {
  if (!item || item.nivel !== 'erro') {
    return false;
  }

  return item.titulo !== 'Modo teste sem numero permitido';
}

function gerarBloqueiosProducao() {
  return gerarDiagnostico().filter(isBloqueioProducao);
}

module.exports = {
  gerarDiagnostico,
  gerarBloqueiosProducao
};
