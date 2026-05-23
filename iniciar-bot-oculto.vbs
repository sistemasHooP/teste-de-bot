Option Explicit

Dim shell, fso, pastaBot, comando

Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

pastaBot = fso.GetParentFolderName(WScript.ScriptFullName)
comando = "cmd.exe /c cd /d """ & pastaBot & """ && (netstat -ano | findstr "":3333"" >nul && exit /b 0 || npm start)"

shell.Run comando, 0, False
WScript.Sleep 3500
shell.Run "http://localhost:3333", 1, False
