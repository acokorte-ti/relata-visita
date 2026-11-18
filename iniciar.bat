@echo off
REM Sobe o Relata Visita em http://localhost:8502 (app do vendedor e painel do gerente)
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
    echo Ambiente .venv nao encontrado. Siga o Passo 3 do PASSO_A_PASSO.md
    pause
    exit /b 1
)
if not exist "frontend\dist\index.html" (
    echo Frontend nao compilado. Siga o Passo 4 do PASSO_A_PASSO.md
    pause
    exit /b 1
)
start "" http://localhost:8502
".venv\Scripts\python.exe" -m uvicorn app.main:app --app-dir backend --port 8502
pause
