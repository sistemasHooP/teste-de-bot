@echo off
setlocal
cd /d "%~dp0"
title Instalar Bot Renaly

echo Instalando Bot Renaly neste computador...
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo ERRO: Node.js nao foi encontrado.
  echo Instale o Node.js LTS 20 ou 22 e execute este instalador novamente.
  goto fim
)

where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo ERRO: npm nao foi encontrado.
  echo Reinstale o Node.js marcando a opcao para adicionar ao PATH.
  goto fim
)

echo Instalando dependencias...
set "NODE_OPTIONS=--use-system-ca"
call npm.cmd install

if errorlevel 1 (
  echo.
  echo ERRO: Nao foi possivel instalar as dependencias.
  echo Se aparecer erro do better-sqlite3, use Node.js LTS 20 ou 22.
  goto fim
)

echo.
echo Criando atalhos na Area de Trabalho...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$desktop=[Environment]::GetFolderPath('Desktop'); $shell=New-Object -ComObject WScript.Shell; $s=$shell.CreateShortcut((Join-Path $desktop 'Bot Renaly - Iniciar.lnk')); $s.TargetPath=(Join-Path '%~dp0' 'iniciar-bot-oculto.vbs'); $s.WorkingDirectory='%~dp0'; $s.Save(); $p=$shell.CreateShortcut((Join-Path $desktop 'Bot Renaly - Painel.lnk')); $p.TargetPath=(Join-Path '%~dp0' 'abrir-painel.bat'); $p.WorkingDirectory='%~dp0'; $p.Save(); $x=$shell.CreateShortcut((Join-Path $desktop 'Bot Renaly - Parar.lnk')); $x.TargetPath=(Join-Path '%~dp0' 'parar-bot.bat'); $x.WorkingDirectory='%~dp0'; $x.Save()"

echo.
echo Instalacao concluida.
echo Use o atalho "Bot Renaly - Iniciar" para abrir sem terminal.

:fim
echo.
echo Pressione qualquer tecla para fechar.
pause >nul
endlocal
