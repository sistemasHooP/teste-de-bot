@echo off
setlocal
cd /d "%~dp0"

if not exist "logs\" mkdir "logs"

echo [%date% %time%] Reiniciando bot pelo atalho principal.>> "logs\launcher.log"

powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'node.exe' -and ($_.CommandLine -like '*src/index.js*' -or $_.CommandLine -like '*bot-renaly*') } | ForEach-Object { Add-Content -Path 'logs\launcher.log' -Value ('Encerrando processo antigo PID ' + $_.ProcessId); Stop-Process -Id $_.ProcessId -Force }" >> "logs\launcher.log" 2>&1

timeout /t 1 /nobreak >nul

set "NODE_OPTIONS=--use-system-ca"
call npm.cmd start >> "logs\bot-hidden.log" 2>&1

echo [%date% %time%] Bot encerrado.>> "logs\launcher.log"
endlocal
