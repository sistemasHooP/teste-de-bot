const fs = require('fs');
const path = require('path');
const config = require('./config');
const logger = require('./logger');
const salmo = require('./salmo');
const palavraBiblica = require('./palavraBiblica');
const { ensureDirectoryExists, normalizeText } = require('./utils');

const menuConfigPath = path.join(config.paths.dataDir, 'menu-config.json');

function getDefaultEmpresaConfig() {
  return {
    nome: config.empresa.nome,
    telefone: '',
    endereco: config.empresa.endereco,
    pontoReferencia: config.empresa.pontoReferencia,
    mapsUrl: config.empresa.mapsUrl,
    minhaAgendaUrl: config.empresa.minhaAgendaUrl,
    horarioFuncionamento: config.empresa.horarioFuncionamento,
    instagram: '',
    email: ''
  };
}

function getDefaultMenuConfig() {
  return {
    empresa: getDefaultEmpresaConfig(),
    salmo: {
      mensagemAntes: '{saudacao}! Aqui e o bot da {empresa}.\n\nEnquanto voce aguarda, vou te enviar o salmo do dia:\n\n{salmo_do_dia}',
      mensagemDepois: 'Que essa palavra traga paz para o seu dia.'
    },
    comportamento: {
      digitandoAtivo: false,
      tempoDigitandoMs: 1200,
      atrasoRespostaMs: 0,
      intervaloMenuDias: 1,
      janelaMenuMinutos: 30,
      historicoMensagensAtivo: false,
      responderTodosClientes: false,
      recepcaoAntesMenuAtiva: true,
      atrasoMenuInicialMs: 2500,
      mensagemAutomaticaAposMenuAtiva: false,
      mensagemAutomaticaAposMenuTexto: 'Enquanto voce aguarda, vou te enviar uma mensagem especial de hoje.',
      mensagemAutomaticaAposMenuTipo: 'salmo',
      mensagemAutomaticaAposMenuAtrasoMs: 1500,
      mensagemAutomaticaEsperaAtiva: false,
      mensagemAutomaticaEsperaTexto: 'Enquanto voce aguarda, vou te enviar uma mensagem especial de hoje.',
      mensagemAutomaticaEsperaTipo: 'biblia',
      mensagemAutomaticaEsperaAtrasoMs: 1500
    },
    menu: {
      titulo: 'Ola! Seja bem-vindo(a) a {empresa}.',
      subtitulo: 'Como posso te ajudar hoje?',
      instrucao: 'Digite uma das opcoes abaixo:',
      rodape: 'Digite menu a qualquer momento para ver essas opcoes novamente.',
      mensagemRecepcaoAntesMenu:
        '{saudacao}! Aqui e o bot da {empresa}.\n\n' +
        'Nosso pessoal esta um pouco ocupado agora, mas assim que possivel alguem chama voce para atender.\n\n' +
        'Enquanto isso, vou te enviar nosso menu de opcoes.',
      palavrasChave: ['menu', 'voltar', 'inicio'],
      saudacoes: ['oi', 'ola', 'bom dia', 'boa tarde', 'boa noite'],
      respostaGenerica:
        'Para continuar, digite uma das opcoes do menu ou digite menu para ver novamente.',
      respostaOpcaoInvalida:
        'Nao encontrei essa opcao. Digite uma das opcoes do menu ou digite menu para ver novamente.',
      respostaModoHumano:
        'Seu atendimento esta com um atendente no momento.\n\nPara retornar ao menu automatico, aguarde a reativacao pelo responsavel.',
      opcoes: [
        {
          numero: '1',
          titulo: 'Catalogo de servicos',
          tipo: 'mensagem',
          mensagem:
            'Catalogo de servicos da {empresa}:\n\n' +
            '{catalogo_servicos}' +
            '\n\nPara agendamento, volte ao menu e escolha a opcao de agendamento on-line.',
          submenus: []
        },
        {
          numero: '2',
          titulo: 'Endereco',
          tipo: 'mensagem',
          mensagem:
            'Endereco da {empresa}:\n\n{endereco}\n\n' +
            'Ponto de referencia:\n{ponto_referencia}\n\n' +
            'Google Maps:\n{maps_url}',
          submenus: []
        },
        {
          numero: '3',
          titulo: 'Fazer agendamento on-line',
          tipo: 'mensagem',
          mensagem:
            'Para fazer seu agendamento on-line, acesse:\n\n{agendamento_url}\n\n' +
            'Pelo link voce podera escolher o servico, a data e o horario disponiveis diretamente no app MinhaAgenda.',
          submenus: []
        },
        {
          numero: '4',
          titulo: 'Horario de funcionamento',
          tipo: 'mensagem',
          mensagem: 'Horario de funcionamento:\n\n{horario_funcionamento}',
          submenus: []
        },
        {
          numero: '5',
          titulo: 'Falar com um atendente',
          tipo: 'humano',
          mensagem:
            'Certo! Vou chamar um atendente para te ajudar.\n\nAguarde um momento, por favor.',
          submenus: []
        },
        {
          numero: '6',
          titulo: 'Salmo do dia',
          tipo: 'salmo',
          mensagem: '',
          submenus: []
        }
      ]
    }
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeList(values, fallback = []) {
  const list = Array.isArray(values) ? values : fallback;
  return list.map((item) => String(item || '').trim()).filter(Boolean);
}

function normalizeTextValue(value, fallback = '') {
  const text = String(value || '').trim();
  return text || fallback;
}

function normalizeNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

function normalizeInteger(value, fallback, allowedValues) {
  const number = Math.round(normalizeNumber(value, fallback));

  if (Array.isArray(allowedValues) && !allowedValues.includes(number)) {
    return fallback;
  }

  return number;
}

function getAllowedOptionTypes() {
  return ['mensagem', 'submenu', 'humano', 'salmo'];
}

function normalizeAutomaticContentType(value) {
  return ['salmo', 'biblia'].includes(value) ? value : 'nenhuma';
}

function sanitizeOption(option, fallbackNumero = '1') {
  if (option && option.tipo === 'quiz') {
    return null;
  }

  const tipo = getAllowedOptionTypes().includes(option && option.tipo)
    ? option.tipo
    : 'mensagem';
  const submenus = Array.isArray(option && option.submenus)
    ? option.submenus
        .map((submenu, index) => sanitizeOption(submenu, String(index + 1)))
        .filter(Boolean)
    : [];

  return {
    numero: String((option && option.numero) || fallbackNumero).trim() || fallbackNumero,
    titulo: String((option && option.titulo) || 'Nova opcao').trim() || 'Nova opcao',
    tipo,
    mensagem: String((option && option.mensagem) || ''),
    submenus
  };
}

function getNextOptionNumber(options) {
  const used = new Set((options || []).map((option) => String(option.numero || '').trim()));
  let next = 1;

  while (used.has(String(next))) {
    next++;
  }

  return String(next);
}

function ensureSalmoOption(opcoes, source) {
  const recursos = source.recursos || {};
  const hasSalmo = opcoes.some((option) => option.tipo === 'salmo');

  if (!hasSalmo && !recursos.salmoDoDiaAdicionado) {
    opcoes.push({
      numero: getNextOptionNumber(opcoes),
      titulo: 'Salmo do dia',
      tipo: 'salmo',
      mensagem: '',
      submenus: []
    });
  }

  return opcoes;
}

function sanitizeEmpresa(empresa) {
  const defaults = getDefaultEmpresaConfig();
  const source = empresa && typeof empresa === 'object' ? empresa : {};

  return {
    nome: normalizeTextValue(source.nome, defaults.nome),
    telefone: String(source.telefone || defaults.telefone || '').trim(),
    endereco: normalizeTextValue(source.endereco, defaults.endereco),
    pontoReferencia: normalizeTextValue(source.pontoReferencia, defaults.pontoReferencia),
    mapsUrl: normalizeTextValue(source.mapsUrl, defaults.mapsUrl),
    minhaAgendaUrl: normalizeTextValue(source.minhaAgendaUrl, defaults.minhaAgendaUrl),
    horarioFuncionamento: normalizeTextValue(source.horarioFuncionamento, defaults.horarioFuncionamento),
    instagram: String(source.instagram || defaults.instagram || '').trim(),
    email: String(source.email || defaults.email || '').trim()
  };
}

function sanitizeSalmo(salmoConfig) {
  const defaults = getDefaultMenuConfig().salmo;
  const source = salmoConfig && typeof salmoConfig === 'object' ? salmoConfig : {};

  return {
    mensagemAntes: String(source.mensagemAntes || defaults.mensagemAntes),
    mensagemDepois: String(source.mensagemDepois || defaults.mensagemDepois)
  };
}

function sanitizeMenuConfig(rawConfig) {
  const defaults = getDefaultMenuConfig();
  const source = rawConfig && typeof rawConfig === 'object' ? rawConfig : {};
  const comportamento = source.comportamento || {};
  const menu = source.menu || {};
  const opcoes = (Array.isArray(menu.opcoes)
    ? menu.opcoes.map((option, index) => sanitizeOption(option, String(index + 1)))
    : clone(defaults.menu.opcoes)).filter(Boolean);

  return {
    recursos: {
      salmoDoDiaAdicionado: true
    },
    empresa: sanitizeEmpresa(source.empresa),
    salmo: sanitizeSalmo(source.salmo),
    comportamento: {
      digitandoAtivo: Boolean(comportamento.digitandoAtivo),
      tempoDigitandoMs: normalizeNumber(comportamento.tempoDigitandoMs, 1200),
      atrasoRespostaMs: normalizeNumber(comportamento.atrasoRespostaMs, 0),
      intervaloMenuDias: normalizeInteger(comportamento.intervaloMenuDias, 1, [1, 2, 3, 7]),
      janelaMenuMinutos: Math.max(1, Math.min(1440, normalizeInteger(comportamento.janelaMenuMinutos, 30))),
      historicoMensagensAtivo: Boolean(comportamento.historicoMensagensAtivo),
      responderTodosClientes: Boolean(comportamento.responderTodosClientes),
      recepcaoAntesMenuAtiva: comportamento.recepcaoAntesMenuAtiva !== false,
      atrasoMenuInicialMs: Math.max(0, Math.min(30000, normalizeNumber(comportamento.atrasoMenuInicialMs, 2500))),
      mensagemAutomaticaAposMenuAtiva: Boolean(comportamento.mensagemAutomaticaAposMenuAtiva),
      mensagemAutomaticaAposMenuTexto: String(
        comportamento.mensagemAutomaticaAposMenuTexto ||
        defaults.comportamento.mensagemAutomaticaAposMenuTexto
      ),
      mensagemAutomaticaAposMenuTipo: comportamento.mensagemAutomaticaAposMenuTipo === 'salmo' ? 'salmo' : 'nenhuma',
      mensagemAutomaticaAposMenuAtrasoMs: Math.max(
        0,
        Math.min(30000, normalizeNumber(comportamento.mensagemAutomaticaAposMenuAtrasoMs, 1500))
      ),
      mensagemAutomaticaEsperaAtiva: Boolean(comportamento.mensagemAutomaticaEsperaAtiva),
      mensagemAutomaticaEsperaTexto: String(
        comportamento.mensagemAutomaticaEsperaTexto ||
        defaults.comportamento.mensagemAutomaticaEsperaTexto
      ),
      mensagemAutomaticaEsperaTipo: normalizeAutomaticContentType(comportamento.mensagemAutomaticaEsperaTipo),
      mensagemAutomaticaEsperaAtrasoMs: Math.max(
        0,
        Math.min(30000, normalizeNumber(comportamento.mensagemAutomaticaEsperaAtrasoMs, 1500))
      )
    },
    menu: {
      titulo: String(menu.titulo || defaults.menu.titulo),
      subtitulo: String(menu.subtitulo || defaults.menu.subtitulo),
      instrucao: String(menu.instrucao || defaults.menu.instrucao),
      rodape: String(menu.rodape || defaults.menu.rodape),
      mensagemRecepcaoAntesMenu: String(menu.mensagemRecepcaoAntesMenu || defaults.menu.mensagemRecepcaoAntesMenu),
      palavrasChave: normalizeList(menu.palavrasChave, defaults.menu.palavrasChave),
      saudacoes: normalizeList(menu.saudacoes, defaults.menu.saudacoes),
      respostaGenerica: String(menu.respostaGenerica || defaults.menu.respostaGenerica),
      respostaOpcaoInvalida: String(menu.respostaOpcaoInvalida || defaults.menu.respostaOpcaoInvalida),
      respostaModoHumano: String(menu.respostaModoHumano || defaults.menu.respostaModoHumano),
      opcoes: ensureSalmoOption(opcoes, source)
    }
  };
}

function buildTagMap(currentConfig) {
  const current = currentConfig || loadMenuConfig();
  const empresa = sanitizeEmpresa(current.empresa);
  const salmoDia = salmo.getSalmoDoDia();
  const palavraDia = palavraBiblica.getPalavraBiblicaDoDia();
  const dataAtual = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(new Date());

  return {
    '{saudacao}': getSaudacaoAtual(),
    '{empresa}': empresa.nome,
    '{empresa_nome}': empresa.nome,
    '{telefone}': empresa.telefone,
    '{endereco}': empresa.endereco,
    '{ponto_referencia}': empresa.pontoReferencia,
    '{maps_url}': empresa.mapsUrl,
    '{agendamento_url}': empresa.minhaAgendaUrl,
    '{minha_agenda_url}': empresa.minhaAgendaUrl,
    '{horario_funcionamento}': empresa.horarioFuncionamento,
    '{instagram}': empresa.instagram,
    '{email}': empresa.email,
    '{catalogo_servicos}': config.catalogoServicos.map((servico) => `- ${servico}`).join('\n'),
    '{data}': dataAtual,
    '{salmo_referencia}': salmoDia.referencia,
    '{salmo_mensagem}': salmoDia.mensagem,
    '{salmo_do_dia}': `${salmoDia.referencia}\n${salmoDia.mensagem}`,
    '{palavra_biblica_referencia}': palavraDia.referencia,
    '{palavra_biblica_mensagem}': palavraDia.mensagem,
    '{palavra_biblica}': `${palavraDia.referencia}\n${palavraDia.mensagem}`
  };
}

function aplicarTags(texto, currentConfig) {
  let output = String(texto || '');
  const tags = buildTagMap(currentConfig);

  for (const tag of Object.keys(tags)) {
    output = output.split(tag).join(tags[tag] || '');
  }

  return output;
}

function getTagsDisponiveis() {
  return [
    { tag: '{saudacao}', descricao: 'Bom dia, Boa tarde ou Boa noite' },
    { tag: '{empresa}', descricao: 'Nome da empresa' },
    { tag: '{telefone}', descricao: 'Telefone da empresa' },
    { tag: '{endereco}', descricao: 'Endereco da empresa' },
    { tag: '{ponto_referencia}', descricao: 'Ponto de referencia' },
    { tag: '{maps_url}', descricao: 'Link do Google Maps' },
    { tag: '{agendamento_url}', descricao: 'Link de agendamento on-line' },
    { tag: '{horario_funcionamento}', descricao: 'Horario de funcionamento' },
    { tag: '{instagram}', descricao: 'Instagram' },
    { tag: '{email}', descricao: 'E-mail' },
    { tag: '{catalogo_servicos}', descricao: 'Catalogo de servicos em lista' },
    { tag: '{data}', descricao: 'Data atual' },
    { tag: '{salmo_referencia}', descricao: 'Referencia do salmo do dia' },
    { tag: '{salmo_mensagem}', descricao: 'Mensagem do salmo do dia' },
    { tag: '{salmo_do_dia}', descricao: 'Referencia e mensagem do salmo' },
    { tag: '{palavra_biblica_referencia}', descricao: 'Referencia da palavra biblica' },
    { tag: '{palavra_biblica_mensagem}', descricao: 'Mensagem biblica de espera' },
    { tag: '{palavra_biblica}', descricao: 'Referencia e mensagem biblica' }
  ];
}

function ensureMenuConfigFile() {
  ensureDirectoryExists(config.paths.dataDir);

  if (!fs.existsSync(menuConfigPath)) {
    saveMenuConfig(getDefaultMenuConfig());
  }
}

function loadMenuConfig() {
  try {
    ensureMenuConfigFile();
    const raw = fs.readFileSync(menuConfigPath, 'utf8');
    return sanitizeMenuConfig(JSON.parse(raw));
  } catch (error) {
    logger.error('Erro ao carregar menu-config.json. Usando padrao:', error);
    return getDefaultMenuConfig();
  }
}

function saveMenuConfig(nextConfig) {
  const sanitized = sanitizeMenuConfig(nextConfig);
  ensureDirectoryExists(config.paths.dataDir);
  fs.writeFileSync(menuConfigPath, `${JSON.stringify(sanitized, null, 2)}\n`, 'utf8');
  return sanitized;
}

function resetMenuConfig() {
  return saveMenuConfig(getDefaultMenuConfig());
}

function getNormalizedKeywords(values) {
  return normalizeList(values).map(normalizeText);
}

function isMenuTrigger(text) {
  const currentConfig = loadMenuConfig();
  const normalized = normalizeText(text);
  return getNormalizedKeywords(currentConfig.menu.palavrasChave).includes(normalized);
}

function isGreeting(text) {
  const currentConfig = loadMenuConfig();
  const normalized = normalizeText(text);
  return getNormalizedKeywords(currentConfig.menu.saudacoes).includes(normalized);
}

function buildOptionsLines(options, prefix = '') {
  const currentConfig = loadMenuConfig();

  return options.map((option) => {
    const number = prefix ? `${prefix}.${option.numero}` : option.numero;
    return `${number} - ${aplicarTags(option.titulo, currentConfig)}`;
  });
}

function buildMainMenu() {
  const currentConfig = loadMenuConfig();
  const lines = [
    aplicarTags(currentConfig.menu.titulo, currentConfig),
    '',
    aplicarTags(currentConfig.menu.subtitulo, currentConfig),
    '',
    aplicarTags(currentConfig.menu.instrucao, currentConfig),
    '',
    ...buildOptionsLines(currentConfig.menu.opcoes),
    '',
    aplicarTags(currentConfig.menu.rodape, currentConfig)
  ];

  return lines.filter((line, index, array) => line || array[index - 1]).join('\n');
}

function getSaudacaoAtual() {
  const hour = Number(new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    hour12: false
  }).format(new Date()));

  if (hour >= 5 && hour < 12) {
    return 'Bom dia';
  }

  if (hour >= 12 && hour < 18) {
    return 'Boa tarde';
  }

  return 'Boa noite';
}

function buildMensagemRecepcaoAntesMenu() {
  const currentConfig = loadMenuConfig();
  return aplicarTags(currentConfig.menu.mensagemRecepcaoAntesMenu, currentConfig);
}

function hasSalmoPlacementTag(texto) {
  return /\{salmo_(do_dia|referencia|mensagem)\}/.test(String(texto || ''));
}

function buildSalmoDoDiaMensagem(currentConfig = loadMenuConfig()) {
  const salmoDia = salmo.getSalmoDoDia();
  const salmoConfig = sanitizeSalmo(currentConfig.salmo);
  const hasManualPlacement =
    hasSalmoPlacementTag(salmoConfig.mensagemAntes) ||
    hasSalmoPlacementTag(salmoConfig.mensagemDepois);

  if (hasManualPlacement) {
    const lines = [
      aplicarTags(salmoConfig.mensagemAntes, currentConfig),
      '',
      aplicarTags(salmoConfig.mensagemDepois, currentConfig)
    ];

    return lines.filter((line, index, array) => line || array[index - 1]).join('\n');
  }

  const lines = [
    aplicarTags(salmoConfig.mensagemAntes, currentConfig),
    '',
    salmoDia.referencia,
    salmoDia.mensagem,
    '',
    aplicarTags(salmoConfig.mensagemDepois, currentConfig)
  ];

  return lines.filter((line, index, array) => line || array[index - 1]).join('\n');
}

function getSalmoAtual() {
  return salmo.getSalmoDoDia();
}

function getPalavraBiblicaAtual() {
  return palavraBiblica.getPalavraBiblicaDoDia();
}

function buildSubmenu(option, pathValue) {
  const currentConfig = loadMenuConfig();
  const lines = [
    aplicarTags(option.mensagem || option.titulo, currentConfig),
    '',
    'Digite uma das opcoes abaixo:',
    '',
    ...buildOptionsLines(option.submenus, pathValue),
    '',
    aplicarTags(currentConfig.menu.rodape, currentConfig)
  ];

  return lines.filter((line, index, array) => line || array[index - 1]).join('\n');
}

function findOptionByPath(pathValue, options = loadMenuConfig().menu.opcoes) {
  const parts = String(pathValue || '').trim().split('.').filter(Boolean);
  let currentOptions = options;
  let currentOption = null;
  const matchedPath = [];

  for (const part of parts) {
    currentOption = currentOptions.find((option) => option.numero === part);

    if (!currentOption) {
      return null;
    }

    matchedPath.push(currentOption.numero);
    currentOptions = currentOption.submenus || [];
  }

  return currentOption
    ? {
        option: currentOption,
        path: matchedPath.join('.')
      }
    : null;
}

function findFirstOptionPathByType(tipo, options = loadMenuConfig().menu.opcoes, prefix = '') {
  for (const option of options || []) {
    const optionPath = prefix ? `${prefix}.${option.numero}` : option.numero;

    if (option.tipo === tipo) {
      return optionPath;
    }

    const childPath = findFirstOptionPathByType(tipo, option.submenus || [], optionPath);

    if (childPath) {
      return childPath;
    }
  }

  return null;
}

function getOptionResponse(text) {
  const match = findOptionByPath(text);

  if (!match) {
    return null;
  }

  const { option, path: optionPath } = match;

  if (option.tipo === 'submenu') {
    return {
      tipo: 'submenu',
      mensagem: buildSubmenu(option, optionPath)
    };
  }

  if (option.tipo === 'humano') {
    return {
      tipo: 'humano',
      mensagem: aplicarTags(option.mensagem, loadMenuConfig())
    };
  }

  if (option.tipo === 'salmo') {
    return {
      tipo: 'salmo',
      mensagem: aplicarTags(option.mensagem, loadMenuConfig())
    };
  }

  return {
    tipo: 'mensagem',
    mensagem: aplicarTags(option.mensagem, loadMenuConfig())
  };
}

function getBehavior() {
  return loadMenuConfig().comportamento;
}

function getSafety() {
  const behavior = getBehavior();

  return {
    responderTodosClientes: behavior.responderTodosClientes
  };
}

module.exports = {
  getDefaultMenuConfig,
  getDefaultEmpresaConfig,
  loadMenuConfig,
  saveMenuConfig,
  resetMenuConfig,
  aplicarTags,
  getTagsDisponiveis,
  isMenuTrigger,
  isGreeting,
  buildMainMenu,
  buildMensagemRecepcaoAntesMenu,
  buildSalmoDoDiaMensagem,
  getSalmoAtual,
  getPalavraBiblicaAtual,
  findFirstOptionPathByType,
  getOptionResponse,
  getBehavior,
  getSafety
};
