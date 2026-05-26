const readline = require('readline');
const { initDatabase, closeDatabase } = require('./database');
const teste = require('./teste');
const { normalizeText } = require('./utils');

const telefoneTeste = 'teste-local';

function mostrarBoasVindas() {
  console.log('');
  console.log('Modo teste local do Bot Renaly');
  console.log('Digite /teste para ver os comandos.');
  console.log('Digite sair para encerrar.');
  console.log('');
}

function criarTerminal() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'voce> '
  });
}

function processarEntrada(texto) {
  const normalizado = normalizeText(texto);

  if (!normalizado) {
    return '';
  }

  return teste.obterRespostaTeste(telefoneTeste, texto) || 'Comando nao reconhecido. Digite /teste.';
}

function iniciar() {
  initDatabase();

  const terminal = criarTerminal();
  mostrarBoasVindas();

  terminal.prompt();

  terminal.on('line', (line) => {
    const texto = line.trim();

    if (normalizeText(texto) === 'sair') {
      terminal.close();
      return;
    }

    const resposta = processarEntrada(texto);

    if (resposta) {
      console.log('');
      console.log(`bot> ${resposta}`);
      console.log('');
    }

    terminal.prompt();
  });

  terminal.on('close', () => {
    closeDatabase();
    console.log('Teste local encerrado.');
    process.exit(0);
  });
}

iniciar();
