# CLAUDE.md: Relata Visita

Contexto do projeto para o Claude Code. Leia este arquivo inteiro antes de mexer em qualquer coisa.

## 1. O que é e por que existe

**Relata Visita** é um app interno da **ACOKORTE** (empresa de aço: chapas, corte, dobra; ERP Mega sobre Oracle).

**Problema:** os vendedores externos visitam clientes e deveriam preencher uma planilha de visitas, mas não preenchem. É trabalhoso demais e o coordenador de vendas fica sem saber o que foi tratado.

**Solução:** depois da visita, o vendedor abre o app no celular e **fala** um resumo, por exemplo: *"Fui na Gerdau dia 17/11 de manhã, falei com o Alex de compras, tratamos do atraso da última entrega e ele pediu cotação de 20 t de chapa grossa. Fico de mandar a proposta sexta."*

O app então:

1. Transcreve o áudio com a API da OpenAI (`gpt-4o-mini-transcribe`).
2. Extrai os campos da ata com um LLM (`gpt-4o-mini`, resposta em JSON): cliente, data da visita, período, contato, cargo, assuntos, oportunidades, problemas, próximos passos, data de retorno e temperatura (Quente/Morno/Frio).
3. Mostra a ata preenchida para o vendedor **conferir e corrigir**.
4. Grava uma linha numa **planilha Excel numa pasta da rede interna**, que é o relatório do coordenador.
5. Tem uma aba **Coordenador**, com senha, para ver, filtrar e baixar o Excel.

**Usuários:** vendedores externos (pouca paciência para tecnologia, usam o celular na rua) e o coordenador de vendas.

**Decisão já tomada:** usar a **API da OpenAI na nuvem**, e não um Whisper local. O áudio sai da rede da empresa, e a diretoria precisa aprovar isso (LGPD).

## 2. Repositório e pastas

| Item | Valor |
|---|---|
| Repositório | https://github.com/acokorte-ti/relata-visita (branch `main`) |
| Pasta local | `C:\Users\eduardo.macedo\Documents\relata-visita` |
| Nome antigo (não usar) | `transcritor-vendedores` / "Atas de Visita" |
| Máquina de dev | Windows 11, PowerShell, Python 3.12 via `py` |
| Ambiente Python | `.venv\` dentro da pasta do repo (no `.gitignore`) |
| Planilha (teste) | pasta da rede via caminho UNC, ex.: `\\SERVIDOR\Comercial\Visitas\visitas.xlsx` (definida no `.env`) |
| Áudios originais | `AUDIO_DIR` do `.env` (rede ou `dados\audios`) |
| URL local | http://localhost:8502 |

```
relata-visita/
├── app.py                 # app Streamlit (vendedor + aba coordenador)
├── teste_ambiente.py      # checa pacotes, .env, pasta da rede, chave da API (e transcreve um áudio se passar o caminho)
├── iniciar.bat            # sobe o app na porta 8502
├── requirements.txt       # streamlit, openai, openpyxl, pandas, python-dotenv
├── .env.exemplo           # modelo de configuração -> copiar para .env
├── PASSO_A_PASSO.md       # guia de instalação + roteiro de testes T1-T10 + problemas comuns
├── README.md
├── CLAUDE.md              # este arquivo
├── docs/
│   └── Cronograma_Relata_Visita.xlsx   # cronograma (Gantt), custos da API, riscos
└── dados/                 # (gitignored) audios/, pendentes.jsonl, planilha local se VISITAS_XLSX não definido
```

## 3. Configuração (`.env`)

O `.env` é lido com `python-dotenv` pela pasta do `app.py`, com valores sem aspas.

| Variável | Padrão | Observação |
|---|---|---|
| `OPENAI_API_KEY` | vazio | Vazio = **modo demo** (transcrição e extração simuladas) |
| `TRANSCRIBE_MODEL` | `gpt-4o-mini-transcribe` | Alternativas: `gpt-4o-transcribe`, `whisper-1` |
| `LLM_MODEL` | `gpt-4o-mini` | Extração dos campos |
| `VISITAS_XLSX` | `dados/visitas.xlsx` | Caminho UNC da planilha na rede |
| `AUDIO_DIR` | `dados/audios` | |
| `COORD_SENHA` | `trocar` | Senha da aba Coordenador |
| `VENDEDORES` | `Selecione...,Vendedor 1,...` | Separados por vírgula. O 1º item é o placeholder |

## 4. Como rodar

```powershell
cd C:\Users\eduardo.macedo\Documents\relata-visita
py -3.12 -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
```

```powershell
cd C:\Users\eduardo.macedo\Documents\relata-visita
copy .env.exemplo .env
notepad .env
```

```powershell
cd C:\Users\eduardo.macedo\Documents\relata-visita
.venv\Scripts\python teste_ambiente.py
```

```powershell
cd C:\Users\eduardo.macedo\Documents\relata-visita
.venv\Scripts\python -m streamlit run app.py --server.port 8502
```

Detalhes e roteiro de testes: `PASSO_A_PASSO.md`.

## 5. Como o código funciona (app.py)

- **Config** no topo: `load_dotenv`, constantes e `DEMO = not OPENAI_API_KEY`.
- **`COLUNAS`:** lista (chave, título) que define as colunas da planilha e a ordem. `CAMPOS_IA` são os campos que o LLM preenche.
- **`transcrever(nome, bytes)`:** chama `audio.transcriptions.create` com `language="pt"` e um `prompt` de vocabulário. Renomeia `.opus` (áudio do WhatsApp) para `.ogg` antes de enviar.
- **`PROMPT_EXTRACAO` + `extrair_campos(texto)`:** usa `response_format=json_object` e `temperature=0`. Recebe a data de hoje e o dia da semana para converter "hoje", "ontem" e "sexta" em dd/mm/aaaa. A regra é **não inventar**: o que não foi dito fica `""`.
- **Excel (`openpyxl`):** `_criar_planilha()` cria a aba `Visitas` com cabeçalho formatado, filtro e painel congelado. `salvar_visita()` faz append da linha.
- **Fila de pendentes:** se a planilha estiver **aberta no Excel** (o Windows trava o arquivo, `PermissionError`) ou a rede cair, a ata vai para `dados/pendentes.jsonl`. No próximo envio, ou pelo botão "Tentar gravar agora" na barra lateral, tudo é regravado de uma vez. Já foi testado.
- **UI:**
  - **Aba "Registrar visita":** selectbox do vendedor, `st.audio_input` (microfone) ou `st.file_uploader`, botão "Transcrever e montar ata", formulário de revisão e envio.
  - **Aba "Coordenador":** senha, tabela com filtro por vendedor e busca, gráfico por vendedor e download do Excel.
  - **Barra lateral:** modo IA ou demo, caminho da planilha, status da pasta da rede e quantidade de pendentes.

## 6. Estado atual (17/11/2026)

**Feito:**

- [x] Protótipo funcional (`app.py`), testado em modo demo com Streamlit AppTest: envio, gravação no Excel, fila com planilha travada e aba do coordenador.
- [x] `.env`, `teste_ambiente.py`, `iniciar.bat`, `PASSO_A_PASSO.md`.
- [x] Cronograma, custos e riscos em `docs/Cronograma_Relata_Visita.xlsx`.
- [x] Repositório criado e renomeado para `relata-visita`.

**Pendente:**

- [ ] **Ainda não testado com a API real.** Falta criar a conta em platform.openai.com, com billing, limite mensal e chave do projeto `relata-visita`.
- [ ] Definir a pasta real da rede para a planilha e testar escrita.
- [ ] Rodar o roteiro de testes T1-T10 do `PASSO_A_PASSO.md` com áudios reais (barulho de carro, sotaque, nomes de clientes).

## 7. Próximos passos (ordem do cronograma)

1. **Teste com áudios reais:** ajustar o `PROMPT_EXTRACAO` e o `prompt=` da transcrição com o vocabulário da ACOKORTE (clientes, produtos, siglas). Meta: ata correta em 9 de 10 áudios.
2. **Login individual por vendedor:** hoje é só um selectbox, sem autenticação. O portal de dados da empresa já usa login em Streamlit e pode servir de referência.
3. **Cliente do Mega:** autocompletar e validar o cliente na tabela `GLO_AGENTES` do ERP Mega (Oracle) e gravar o código do cliente junto com o nome. Confirmar com o usuário a conexão, os filtros de organização e as colunas antes de escrever a query.
4. **Envio ao coordenador:** e-mail com resumo diário das visitas, além do Excel.
5. **Robustez:** tratamento de erros e log de custo por chamada (minutos de áudio e tokens).
6. **Deploy em produção:** subdomínio `visitas.acokorte.com.br` atrás do **Nginx com HTTPS**, igual ao portal de dados que já existe, mais um serviço systemd. **O microfone do celular só funciona em HTTPS** (em localhost funciona sem).
7. Piloto com 2 ou 3 vendedores por 2 semanas, ajustes, treinamento e go-live (a planilha manual sai de uso).

## 8. Regras e convenções para trabalhar neste projeto

- **Idioma:** tudo em **português do Brasil**, tanto a UI e as mensagens quanto os comentários e a documentação.
- **Comandos:** sempre para **PowerShell no Windows**, em blocos separados e completos, prontos para copiar e colar. Nada de comandos Linux para a máquina local.
- **Segredos:** **nunca** commitar `.env`, chave da API, `.venv/` ou `dados/`. Conferir o `.gitignore` antes de cada commit.
- **Público:** os vendedores não são técnicos. A UI tem que ser mínima: gravar, conferir, enviar. Não adicionar campos obrigatórios além de Cliente e Data.
- **Colunas da planilha:** se `COLUNAS` mudar, a planilha existente fica com o cabeçalho incompatível. É preciso avisar o usuário e criar uma planilha nova (renomear a antiga).
- **Limites da API:** áudio de no máximo **25 MB**. Formatos aceitos: mp3, m4a, ogg, wav, webm, mp4 (`.opus` precisa ser renomeado para `.ogg`).
- **Custo estimado:** cerca de US$ 0,01 por relato de 3 min, ou uns US$ 8 a 10 por mês para 10 vendedores. Manter o limite de gasto configurado na conta OpenAI.
- **Antes de mudanças grandes** (login, banco Mega, deploy), apresente o plano e espere aprovação.
- **Testes:** dá para testar o fluxo sem chave (modo demo) com `streamlit.testing.v1.AppTest`, simulando `st.session_state["rascunho"]`.
- **Commits:** mensagens curtas em português, por exemplo `feat: login por vendedor` ou `fix: fila de pendentes`.
