' Windows: double-click to start Rulebook Studio without a console window.
' (A desktop shortcut to this file is created automatically on the first start.)
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
folder = fso.GetParentFolderName(WScript.ScriptFullName)
shell.CurrentDirectory = folder
On Error Resume Next
shell.Run "cmd /c node """ & folder & "\scripts\launch.mjs""", 0, False
If Err.Number <> 0 Then
  MsgBox "Node.js is not installed. Install it from https://nodejs.org (the LTS version), then try again.", 48, "Rulebook Studio"
End If
