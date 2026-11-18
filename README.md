# Relata Visita

App da ACOKORTE para os vendedores externos relatarem as visitas a clientes **falando**, sem preencher planilha.

- **App do vendedor (celular, PWA):** login e dois botões: **POR VOZ** (grava a fala e a IA preenche o formulário com vendedor, data, cliente, cidade, contato e ata de reunião, para o vendedor conferir e corrigir) e **POR TEXTO** (abre o mesmo formulário em branco para preencher). Depois, **ENVIAR**.
- **Painel do gerente (web):** dashboard (visitas por semana, quem visitou mais, clientes mais visitados, quem visitou cada cliente, clientes sem visita há 30+ dias), todos os relatórios de todos os vendedores, filtro por data, vendedor, cliente e busca na ata, áudio original, exportação para Excel e cadastro de vendedores.

Transcrição e extração pela API da OpenAI (`gpt-4o-mini-transcribe` + `gpt-4o-mini`). Sem chave, roda em **modo demo**.

## Rodar localmente

Passo a passo completo: **[PASSO_A_PASSO.md](PASSO_A_PASSO.md)**.

```powershell
py -3.12 -m venv .venv
.venv\Scripts\python -m pip install -r backend\requirements.txt
cd frontend; npm install; npm run build; cd ..
copy .env.exemplo .env
.venv\Scripts\python teste_ambiente.py
iniciar.bat                 # abre http://localhost:8502
```

## Estrutura

| Pasta / arquivo | Para que serve |
|---|---|
| `backend/app/` | API em FastAPI: login, relatos, usuários, IA (`ia.py`), Excel (`excel.py`) |
| `backend/alembic/` | Migrações do banco (rodam sozinhas ao subir o servidor) |
| `backend/tests/` | Testes automáticos (`pytest`) |
| `frontend/src/vendedor/` | Telas do celular (gravação e formulário) |
| `frontend/src/painel/` | Painel do gerente |
| `teste_ambiente.py` | Checa pacotes, `.env`, banco, pasta dos áudios e chave da API |
| `iniciar.bat` | Sobe o servidor na porta 8502 |
| `.env.exemplo` | Modelo de configuração (o `.env` real não vai para o git) |
| `docs/Cronograma_Relata_Visita.xlsx` | Cronograma, custos e riscos |

## Segurança

O `.env` (chave da API, `SECRET_KEY`), o `.venv`, `node_modules` e a pasta `dados/` (banco local e áudios) estão no `.gitignore` e nunca devem ser commitados. Senhas são guardadas com Argon2 e o login usa cookie `httpOnly`.
