const fs = require('fs');
const path = require('path');
const config = require('./config');
const logger = require('./logger');
const { ensureDirectoryExists, normalizeText } = require('./utils');

const menuConfigPath = path.join(config.paths.dataDir, 'menu-config.json');

function getDefaultMenuConfig() {
  return {
    comportamento: {
      digitandoAtivo: false,
      tempoDigitandoMs: 1200,
      atrasoRespostaMs: 0,
      intervaloMenuDias: 1,
      janelaMenuMinutos: 30,
      historicoMensagensAtivo: false,
      responderTodosClientes: false
    },
    menu: {
      titulo: `Ola! Seja bem-vindo(a) a ${config.empresa.nome}.`,
      subtitulo: 'Como posso te ajudar hoje?',
      instrucao: 'Digite uma das opcoes abaixo:',
      rodape: 'Digite menu a qualquer momento para ver essas opcoes novamente.',
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
            `Catalogo de servicos da ${config.empresa.nome}:\n\n` +
            config.catalogoServicos.map((servico) => `- ${servico}`).join('\n') +
            '\n\nPara agendamento, volte ao menu e escolha a opcao de agendamento on-line.',
          submenus: []
        },
        {
          numero: '2',
          titulo: 'Endereco',
          tipo: 'mensagem',
          mensagem:
            `Endereco da ${config.empresa.nome}:\n\n${config.empresa.endereco}\n\n` +
            `Ponto de referencia:\n${config.empresa.pontoReferencia}\n\n` +
            `Google Maps:\n${config.empresa.mapsUrl}`,
          submenus: []
        },
        {
          numero: '3',
          titulo: 'Fazer agendamento on-line',
          tipo: 'mensagem',
          mensagem:
            `Para fazer seu agendamento on-line, acesse:\n\n${config.empresa.minhaAgendaUrl}\n\n` +
            'Pelo link voce podera escolher o servico, a data e o horario disponiveis diretamente no app MinhaAgenda.',
          submenus: []
        },
        {
          numero: '4',
          titulo: 'Horario de funcionamento',
          tipo: 'mensagem',
          mensagem: `Horario de funcionamento:\n\n${config.empresa.horarioFuncionamento}`,
          submenus: []
        },
        {
          numero: '5',
          titulo: 'Falar com um atendente',
          tipo: 'humano',
          mensagem:
            'Certo! Vou chamar um atendente para te ajudar.\n\nAguarde um momento, por favor.\n\nEnquanto isso, se quiser, voce pode digitar 6 para jogar um quiz rapido.',
          submenus: []
        },
        {
          numero: '6',
          titulo: 'Quiz rapido enquanto aguarda',
          tipo: 'quiz',
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

function sanitizeOption(option, fallbackNumero = '1') {
  const tipo = ['mensagem', 'submenu', 'humano', 'quiz'].includes(option && option.tipo)
    ? option.tipo
    : 'mensagem';

  return {
    numero: String((option && option.numero) || fallbackNumero).trim() || fallbackNumero,
    titulo: String((option && option.titulo) || 'Nova opcao').trim() || 'Nova opcao',
    tipo,
    mensagem: String((option && option.mensagem) || ''),
    submenus: Array.isArray(option && option.submenus)
      ? option.submenus.map((submenu, index) => sanitizeOption(submenu, String(index + 1)))
      : []
  };
}

function sanitizeMenuConfig(rawConfig) {
  const defaults = getDefaultMenuConfig();
  const source = rawConfig && typeof rawConfig === 'object' ? rawConfig : {};
  const comportamento = source.comportamento || {};
  const menu = source.menu || {};

  return {
    comportamento: {
      digitandoAtivo: Boolean(comportamento.digitandoAtivo),
      tempoDigitandoMs: normalizeNumber(comportamento.tempoDigitandoMs, 1200),
      atrasoRespostaMs: normalizeNumber(comportamento.atrasoRespostaMs, 0),
      intervaloMenuDias: normalizeInteger(comportamento.intervaloMenuDias, 1, [1, 2, 3, 7]),
      janelaMenuMinutos: Math.max(1, Math.min(1440, normalizeInteger(comportamento.janelaMenuMinutos, 30))),
      historicoMensagensAtivo: Boolean(comportamento.historicoMensagensAtivo),
      responderTodosClientes: Boolean(comportamento.responderTodosClientes)
    },
    menu: {
      titulo: String(menu.titulo || defaults.menu.titulo),
      subtitulo: String(menu.subtitulo || defaults.menu.subtitulo),
      instrucao: String(menu.instrucao || defaults.menu.instrucao),
      rodape: String(menu.rodape || defaults.menu.rodape),
      palavrasChave: normalizeList(menu.palavrasChave, defaults.menu.palavrasChave),
      saudacoes: normalizeList(menu.saudacoes, defaults.menu.saudacoes),
      respostaGenerica: String(menu.respostaGenerica || defaults.menu.respostaGenerica),
      respostaOpcaoInvalida: String(menu.respostaOpcaoInvalida || defaults.menu.respostaOpcaoInvalida),
      respostaModoHumano: String(menu.respostaModoHumano || defaults.menu.respostaModoHumano),
      opcoes: Array.isArray(menu.opcoes)
        ? menu.opcoes.map((option, index) => sanitizeOption(option, String(index + 1)))
        : clone(defaults.menu.opcoes)
    }
  };
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
  return options.map((option) => {
    const number = prefix ? `${prefix}.${option.numero}` : option.numero;
    return `${number} - ${option.titulo}`;
  });
}

function buildMainMenu() {
  const currentConfig = loadMenuConfig();
  const lines = [
    currentConfig.menu.titulo,
    '',
    currentConfig.menu.subtitulo,
    '',
    currentConfig.menu.instrucao,
    '',
    ...buildOptionsLines(currentConfig.menu.opcoes),
    '',
    currentConfig.menu.rodape
  ];

  return lines.filter((line, index, array) => line || array[index - 1]).join('\n');
}

function buildSubmenu(option, pathValue) {
  const currentConfig = loadMenuConfig();
  const lines = [
    option.mensagem || option.titulo,
    '',
    'Digite uma das opcoes abaixo:',
    '',
    ...buildOptionsLines(option.submenus, pathValue),
    '',
    currentConfig.menu.rodape
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
      mensagem: option.mensagem
    };
  }

  if (option.tipo === 'quiz') {
    return {
      tipo: 'quiz',
      mensagem: option.mensagem
    };
  }

  return {
    tipo: 'mensagem',
    mensagem: option.mensagem
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
  loadMenuConfig,
  saveMenuConfig,
  resetMenuConfig,
  isMenuTrigger,
  isGreeting,
  buildMainMenu,
  getOptionResponse,
  getBehavior,
  getSafety
};
