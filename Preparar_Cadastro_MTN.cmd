@echo off
setlocal
title MTN - Preparar cadastro online
set "MTN_PROJECT=C:\Users\User\OneDrive\Desktop\MTN\mtn-cadastro-online"
if not exist "%MTN_PROJECT%\package.json" (
 echo A pasta do projeto nao foi encontrada neste computador.
 pause
 exit /b 1
)
cd /d "%MTN_PROJECT%"
set "MTN_NODE_DIR=%MTN_PROJECT%\..\tools\node-v24.19.0-win-x64"
if not exist "%MTN_NODE_DIR%\node.exe" (
 echo Nao foi encontrado o Node portatil usado neste projeto.
 pause
 exit /b 1
)
set "PATH=%MTN_NODE_DIR%;%MTN_PROJECT%\..\tools\portable-git\cmd;%PATH%"
set "npm_config_cache=%MTN_PROJECT%\.sites-runtime\npm-cache"
set "npm_config_fetch_retries=0"
if not exist ".sites-runtime" mkdir ".sites-runtime"
set "MTN_LOG=%MTN_PROJECT%\.sites-runtime\preparacao-windows.log"
echo MTN - Preparacao iniciada em %date% %time% > "%MTN_LOG%"
echo Este procedimento prepara somente a pasta do cadastro online.
echo Nao publica o site nem altera Olist ou Nuvemshop.
echo.
echo [1/5] Testando conexao normal do Windows...
"%MTN_NODE_DIR%\node.exe" -e "Promise.all(['registry.npmjs.org','git.chatgpt-team.site'].map(async h=>{const r=await fetch('https://'+h,{signal:AbortSignal.timeout(15000)});console.log(h+': HTTP '+r.status)})).catch(e=>{console.error(e.cause?.code||e.message);process.exitCode=1})" >> "%MTN_LOG%" 2>&1
if errorlevel 1 goto failed
echo [2/5] Instalando os componentes do projeto...
call "%MTN_NODE_DIR%\npm.cmd" run install:ci >> "%MTN_LOG%" 2>&1
if errorlevel 1 goto failed
echo [3/5] Conferindo o codigo...
call "%MTN_NODE_DIR%\npm.cmd" run check:source >> "%MTN_LOG%" 2>&1
if errorlevel 1 goto failed
echo [4/5] Executando os testes...
call "%MTN_NODE_DIR%\npm.cmd" test >> "%MTN_LOG%" 2>&1
if errorlevel 1 goto failed
echo [5/5] Compilando o sistema...
call "%MTN_NODE_DIR%\npm.cmd" run build >> "%MTN_LOG%" 2>&1
if errorlevel 1 goto failed
echo OK_INSTALACAO_TESTES_BUILD > ".sites-runtime\resultado-preparacao.txt"
echo.
echo Preparacao concluida. A publicacao e a sincronizacao ainda nao foram feitas.
echo Volte a conversa e informe: PREPAROU.
pause
exit /b 0
:failed
echo FALHA_PREPARACAO > ".sites-runtime\resultado-preparacao.txt"
echo.
echo A preparacao parou. O diagnostico ficou em:
echo %MTN_LOG%
echo Volte a conversa e informe: PAROU.
pause
exit /b 1
