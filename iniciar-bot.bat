@echo off
setlocal
cd /d "%~dp0"
title Bot Renaly Basilio Estetica

where node >nul 2>nul
if errorlevel 1 (
  echo ERRO: Node.js nao foi encontrado.
  echo Instale o Node.js LTS 20 ou 22 e tente novamente.
  goto fim
)

where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo ERRO: npm nao foi encontrado.
  echo Reinstale o Node.js marcando a opcao para adicionar ao PATH.
  goto fim
)

if not exist "node_modules\" (
  echo Primeira execucao: instalando dependencias...
  echo.
  set "NODE_OPTIONS=--use-system-ca"
  call npm.cmd install

  if errorlevel 1 (
    echo.
    echo ERRO: Nao foi possivel instalar as dependencias.
    echo Se aparecer erro do better-sqlite3, instale o Node.js LTS 20 ou 22.
    goto fim
  )
)

wscript.exe "%~dp0iniciar-bot-oculto.vbs"
exit /b 0

:fim
echo.
echo Pressione qualquer tecla para fechar esta janela.
pause >nul
endlocal
