@echo off
setlocal
cd /d "%~dp0"
title Parar Bot Renaly

echo Procurando processo do bot...

powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'node.exe' -and ($_.CommandLine -like '*src/index.js*' -or $_.CommandLine -like '*bot-renaly*') } | ForEach-Object { Write-Host ('Encerrando PID ' + $_.ProcessId); Stop-Process -Id $_.ProcessId -Force }"

echo.
echo Pronto. Se nenhum PID apareceu, o bot nao estava rodando.
echo Pressione qualquer tecla para fechar esta janela.
pause >nul
endlocal
