# Relata Visita

App da ACOKORTE para os vendedores externos registrarem as visitas a clientes **falando**, sem preencher planilha.

O vendedor grava o relato (ou envia um áudio do WhatsApp). A OpenAI transcreve o áudio e a IA monta a ata com cliente, data, período, contato, assuntos, oportunidades, problemas, próximos passos e temperatura. O vendedor confere e envia, e a ata vira uma linha na planilha do coordenador na rede interna.

## Rodar localmente

Passo a passo completo: **[PASSO_A_PASSO.md](PASSO_A_PASSO.md)**.

```powershell
py -3.12 -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
copy .env.exemplo .env      # preencher chave OpenAI e caminho da planilha
.venv\Scripts\python teste_ambiente.py
iniciar.bat                 # abre http://localhost:8502
```

Sem `OPENAI_API_KEY` no `.env`, o app roda em **modo demo** (transcrição simulada).

## Estrutura

| Arquivo | Para que serve |
|---|---|
| `app.py` | App Streamlit (vendedor + aba coordenador) |
| `teste_ambiente.py` | Checa pacotes, `.env`, pasta da rede e chave da API |
| `iniciar.bat` | Sobe o app na porta 8502 |
| `.env.exemplo` | Modelo de configuração (o `.env` real não vai para o git) |
| `docs/Cronograma_Relata_Visita.xlsx` | Cronograma, custos e riscos |

## Segurança

O `.env` (chave da API), o `.venv` e a pasta `dados/` (áudios, fila de pendentes) estão no `.gitignore` e nunca devem ser commitados.
