@echo off
setlocal
cd /d "%~dp0"
title Teste Local Bot Renaly

node src\teste-local.js

echo.
echo Pressione qualquer tecla para fechar esta janela.
pause >nul
endlocal
