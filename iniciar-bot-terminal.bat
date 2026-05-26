@echo off
setlocal
cd /d "%~dp0"
title Bot Renaly Basilio Estetica

echo Iniciando o bot da Renaly Basilio Estetica...
echo Interface local: http://localhost:3333
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo ERRO: Node.js nao foi encontrado.
  echo Instale o Node.js LTS e tente novamente.
  goto fim
)

where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo ERRO: npm nao foi encontrado.
  echo Reinstale o Node.js marcando a opcao para adicionar ao PATH.
  goto fim
)

if not exist "node_modules\" (
  echo Dependencias nao encontradas. Instalando agora...
  echo.
  set "NODE_OPTIONS=--use-system-ca"
  call npm.cmd install

  if errorlevel 1 (
    echo.
    echo ERRO: Nao foi possivel instalar as dependencias.
    echo Se aparecer erro do better-sqlite3, instale o Node.js LTS 22 ou 20.
    goto fim
  )

  echo.
)

echo Verificando se existe uma instancia antiga aberta...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'node.exe' -and ($_.CommandLine -like '*src/index.js*' -or $_.CommandLine -like '*bot-renaly*') } | ForEach-Object { Write-Host ('Encerrando processo antigo PID ' + $_.ProcessId); Stop-Process -Id $_.ProcessId -Force }"
echo.

start "" cmd /c "timeout /t 4 >nul && start http://localhost:3333"

call npm.cmd start

if errorlevel 1 (
  echo.
  echo O bot encerrou com erro. Verifique as mensagens acima.
)

:fim
echo.
echo Pressione qualquer tecla para fechar esta janela.
pause >nul
endlocal
