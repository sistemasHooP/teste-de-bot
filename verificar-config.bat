@echo off
setlocal
cd /d "%~dp0"
title Verificar Configuracao Bot Renaly

node -e "const c=require('./src/config'); console.log('BOT_ATIVO=' + c.botAtivo); console.log('MODO_TESTE=' + c.modoTeste); console.log('APENAS_NUMEROS_PERMITIDOS=' + c.apenasNumerosPermitidos); console.log('TELEFONES_PERMITIDOS=' + (c.telefonesPermitidos.join(',') || 'nenhum')); console.log('NUMERO_5584999210586_PERMITIDO=' + c.isTelefonePermitido('5584999210586'));"

echo.
echo Pressione qualquer tecla para fechar esta janela.
pause >nul
endlocal
