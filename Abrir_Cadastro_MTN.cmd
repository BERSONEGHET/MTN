@echo off
setlocal
title MTN - Previa local do cadastro
set "MTN_PROJECT=C:\Users\User\OneDrive\Desktop\MTN\mtn-cadastro-online"
if not exist "%MTN_PROJECT%\scripts\preview-local.mjs" (
 echo A pasta do cadastro MTN nao foi encontrada.
 pause
 exit /b 1
)
cd /d "%MTN_PROJECT%"
set "MTN_NODE_DIR=%MTN_PROJECT%\..\tools\node-v24.19.0-win-x64"
set "PATH=%MTN_NODE_DIR%;%PATH%"
echo Esta e uma PREVIA LOCAL. Os dados ficam neste computador.
echo Mantenha esta janela aberta enquanto estiver usando a tabela.
echo.
"%MTN_NODE_DIR%\node.exe" scripts\preview-local.mjs
if errorlevel 1 (
 echo.
 echo A previa parou. Informe a ultima mensagem exibida.
 pause
)
