Option Explicit

Dim shell, fso, pastaBot, comando

Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

pastaBot = fso.GetParentFolderName(WScript.ScriptFullName)
comando = """" & pastaBot & "\iniciar-bot-hidden.bat" & """"

shell.Run comando, 0, False
WScript.Sleep 4500
shell.Run "http://localhost:3333", 1, False
