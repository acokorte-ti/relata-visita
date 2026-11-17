@echo off
REM Sobe o Relata Visita e abre no navegador (http://localhost:8502)
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
    echo Ambiente .venv nao encontrado. Rode primeiro o PASSO 3 do PASSO_A_PASSO.md
    pause
    exit /b 1
)
".venv\Scripts\python.exe" -m streamlit run app.py --server.port 8502
pause
