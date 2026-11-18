# CLAUDE.md: Relata Visita

Contexto do projeto para o Claude Code. Leia este arquivo inteiro antes de mexer em qualquer coisa.

## 1. O que é e por que existe

**Relata Visita** é um app interno da **ACOKORTE** (empresa brasileira de soluções em corte e desgaste: facas, lâminas, tesouras e peças de desgaste para siderurgia, papel e celulose, sucata, madeira, borracha, plástico, óleo e gás; aço especial AK, bimetálico, sinterizado e metal duro; serviços de recondicionamento; ERP Mega sobre Oracle). Site: https://www.acokorte.com.br/

**Problema:** os vendedores externos visitam clientes e deveriam preencher uma planilha de visitas, mas não preenchem. É trabalhoso demais e o gerente de vendas fica sem saber o que foi tratado.

**Solução:** depois da visita, o vendedor abre o app no celular e **fala** um resumo, por exemplo: *"Hoje visitei a Gerdau em Ouro Branco, falei com o Alex de compras, ele reclamou do atraso da última entrega e pediu cotação de 12 lâminas de tesoura rotativa. Fico de mandar a proposta sexta."*

Fluxo do vendedor (app mobile, PWA):

1. Login com usuário e senha próprios (fica logado no celular).
2. Dois botões: **INICIAR RELATO DE VISITA POR VOZ** e **INICIAR RELATO DE VISITA POR TEXTO**. Os dois mostram a instrução *"Relate qual cliente foi visitado, a cidade, quem foi o contato com quem você conversou e qual o assunto tratado."*
3. Voz: botão de microfone (estilo WhatsApp), toca para gravar e toca para terminar; o servidor transcreve (`gpt-4o-mini-transcribe`) e extrai os campos com `gpt-4o-mini` (JSON).
4. Texto: abre direto o formulário completo em branco (com a instrução no topo) para o vendedor preencher campo a campo, sem IA.
5. Formulário editável: **Nome do vendedor** (do login, só leitura), **Data** (hoje, editável), **Cliente**, **Cidade**, **Contato** (pessoa do cliente), **Ata de reunião**.
6. **ENVIAR RELATÓRIO** → grava no banco.

Painel do gerente (web): aba **Dashboard** (indicadores, gráficos e alertas), aba **Relatórios** com todos os relatórios de todos os vendedores, filtro por período, vendedor, cliente e busca na ata, detalhe com áudio e transcrição, exportação para Excel e cadastro de vendedores (criar, nova senha, desativar).

**Usuários:** vendedores externos (pouca paciência para tecnologia, usam o celular na rua) e o gerente de vendas.

**Decisões já tomadas (18/11/2026):**

- **API da OpenAI na nuvem**, e não um Whisper local. O áudio sai da rede da empresa, e a diretoria precisa aprovar isso (LGPD).
- **PWA instalável**, não app nativo de loja. Um só código para app e painel.
- **Python + FastAPI** no servidor, **React + TypeScript + Vite + Tailwind** no frontend.
- **PostgreSQL** em produção (SQLite local no desenvolvimento e nos testes, pela mesma `DATABASE_URL`). O Excel é só exportação.
- O protótipo Streamlit (`app.py`, planilha na rede, fila de pendentes) foi **aposentado** e removido.

## 2. Repositório e pastas

| Item | Valor |
|---|---|
| Repositório | https://github.com/acokorte-ti/relata-visita (branch `main`) |
| Pasta local | `C:\Users\eduardo.macedo\Documents\relata-visita` |
| Máquina de dev | Windows 11, PowerShell, Python 3.12 via `py`, Node 26 |
| Ambiente Python | `.venv\` na raiz do repo (no `.gitignore`) |
| URL local | http://localhost:8502 (servidor entrega API + `frontend\dist`) |
| Dev do frontend | http://localhost:5173 (`npm run dev`, repassa `/api` para a 8502) |
| Produção (planejado) | `https://visitas.acokorte.com.br` |

```
relata-visita/
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI: rotas + entrega o frontend (SPA)
│   │   ├── config.py        # lê o .env da raiz
│   │   ├── db.py, models.py # SQLAlchemy: Usuario, Relato
│   │   ├── schemas.py       # Pydantic (entrada/saída da API)
│   │   ├── seguranca.py     # Argon2, cookie assinado, limite de tentativas, perfis
│   │   ├── ia.py            # transcrever() + extrair_campos() (OpenAI / modo demo)
│   │   ├── excel.py         # exportação .xlsx
│   │   ├── migracoes.py     # roda o Alembic no startup
│   │   ├── cli.py           # criar-usuario, semear-demo
│   │   └── routers/         # auth.py, relatos.py, usuarios.py, dashboard.py
│   ├── alembic/versions/    # migrações (0001_inicial, 0002_origem_relato)
│   ├── tests/               # pytest (modo demo + SQLite temporário)
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── main.tsx         # rotas: login, / (vendedor), /painel/* (gerente)
│   │   ├── api.ts           # cliente da API + tipos + datas
│   │   ├── sessao.tsx, ui.tsx, Login.tsx
│   │   ├── vendedor/        # AppVendedor.tsx, gravador.ts (MediaRecorder)
│   │   └── painel/          # Painel.tsx, Dashboard.tsx, Relatorios.tsx, Vendedores.tsx
│   ├── public/              # ícones da PWA
│   └── vite.config.ts       # PWA (manifest + service worker), proxy /api
├── teste_ambiente.py        # checa pacotes, .env, banco, pasta dos áudios, chave (e transcreve um áudio)
├── iniciar.bat              # sobe o servidor na porta 8502
├── .env.exemplo
├── PASSO_A_PASSO.md         # instalação + roteiro de testes T1-T13
├── README.md
├── docs/Cronograma_Relata_Visita.xlsx
└── dados/                   # (gitignored) relata.db (SQLite de dev), audios/
```

## 3. Configuração (`.env` na raiz)

| Variável | Padrão | Observação |
|---|---|---|
| `OPENAI_API_KEY` | vazio | Vazio = **modo demo** (transcrição e extração simuladas) |
| `TRANSCRIBE_MODEL` | `gpt-4o-mini-transcribe` | Alternativas: `gpt-4o-transcribe`, `whisper-1` |
| `LLM_MODEL` | `gpt-4o-mini` | Extração dos campos |
| `DATABASE_URL` | SQLite em `dados/relata.db` | Produção: `postgresql+psycopg://usuario:senha@host:5432/relata_visita` |
| `AUDIO_DIR` | `dados/audios` | Áudios originais; `temp/` guarda rascunhos (apagados após 24 h) |
| `SECRET_KEY` | aleatória por execução | **Obrigatória em produção**, senão cada reinício desloga todos |
| `SESSAO_DIAS` | `30` | Validade do login |
| `COOKIE_SEGURO` | `0` | `1` em produção (HTTPS) |

## 4. Como rodar

Detalhes em `PASSO_A_PASSO.md`. Resumo:

```powershell
cd C:\Users\eduardo.macedo\Documents\relata-visita
.venv\Scripts\python -m pip install -r backend\requirements.txt
```

```powershell
cd C:\Users\eduardo.macedo\Documents\relata-visita\frontend
npm install
npm run build
```

```powershell
cd C:\Users\eduardo.macedo\Documents\relata-visita\backend
..\.venv\Scripts\python -m app.cli semear-demo
..\.venv\Scripts\python -m pytest -q
```

```powershell
cd C:\Users\eduardo.macedo\Documents\relata-visita
.venv\Scripts\python -m uvicorn app.main:app --app-dir backend --port 8502
```

Usuários de teste do modo demo: lista `USUARIOS_DEMO` em `backend/app/cli.py` (o comando recusa rodar fora do modo demo/SQLite).

## 5. Como o código funciona

**API** (`/api/docs` mostra tudo):

- `POST /api/auth/login` | `logout` | `GET /api/auth/eu`. Cookie `relata_sessao` assinado (itsdangerous), `httpOnly`, `SameSite=Strict`. O token leva `id` + `versao_sessao`; trocar senha ou desativar incrementa a versão e derruba as sessões. 5 falhas em 15 min por login+IP → 429.
- `POST /api/relatos/transcrever` (multipart `audio`): valida formato e 25 MB, salva em `AUDIO_DIR/temp/{usuario_id}_{uuid}{ext}`, transcreve, extrai e devolve o rascunho com `audio_id`.
- `POST /api/relatos/extrair` (JSON `texto`, mín. 15 caracteres): a IA separa um texto livre nos campos e devolve o rascunho, com `audio_id` vazio. **Hoje o app não usa** (o relato por texto abre o formulário em branco); ficou disponível caso se queira voltar a ter uma caixa de texto livre.
- `POST /api/relatos`: grava o relato. `origem` = `voz` se veio com áudio, senão `texto`. O `audio_id` só é aceito se for do próprio usuário (regex + prefixo), e o arquivo vai de `temp/` para `AUDIO_DIR/{data}_{login}_{cliente}{ext}`.
- `GET /api/relatos` (filtros `inicio`, `fim`, `cliente`, `vendedor_id`, `busca`, `limite`): o vendedor só vê os próprios; o gerente vê todos. Devolve também `total`, `clientes` e `vendedores` do filtro.
- `GET /api/relatos/{id}`, `/{id}/audio`, `/exportar.xlsx` (só gerente).
- `GET /api/dashboard` (só gerente; filtros `inicio`, `fim` — padrão últimos 90 dias —, `vendedor_id`, `cliente`, `dias_alerta`=30): resumo (visitas, clientes, vendedores visitando de ativos, médias, voz × texto), visitas por semana, por vendedor (inclui ativos com 0), top 10 clientes, quem visitou cada cliente, clientes sem visita há `dias_alerta`+ dias (todo o histórico). Agrega em Python, juntando grafias do mesmo cliente (caixa e espaços).
- `/api/usuarios` (só gerente): listar, criar, alterar (nome, perfil, ativo, senha). O gerente não pode desativar nem rebaixar a si mesmo.

**IA** (`ia.py`): `transcrever()` usa `language="pt"` e um `prompt` de vocabulário, e renomeia `.opus` para `.ogg`. `PROMPT_EXTRACAO` pede JSON com `cliente`, `cidade`, `contato` ("Nome (Setor)") e `ata`. Regra: **não inventar**, o que não foi dito fica `""`.

**Frontend:** `AppVendedor.tsx` controla as etapas (início → gravar → processando → formulário → enviado; "Por texto" vai do início direto ao formulário em branco). O rascunho fica no `localStorage` até ser enviado, então não se perde se o app fechar ou cair a internet. `gravador.ts` usa `MediaRecorder` (webm/opus no Android, mp4 no iPhone), com limite de 10 min e barras de nível do microfone. Tem também "Enviar áudio" para arquivos do WhatsApp. `Dashboard.tsx` desenha os gráficos em HTML/CSS puro (sem biblioteca): série única na cor `#2a78d6` (validada no guia de dataviz), barras finas com valor na ponta e dica ao passar o mouse.

## 5.1 Identidade visual (protótipo B "Aço escuro", aprovado em 18/11/2026)

Referência: `docs/prototipos/prototipo-b-aco-escuro.html` (o A, "Industrial claro", ficou só como alternativa).

- **Cores** (tokens Tailwind em `frontend/src/index.css`): vermelho `marca-700` `#BE0A0F` (botões, destaque, série dos gráficos), `marca-600` `#E3262B` (vermelho do logo, sobre fundo escuro), `marca-800`, `marca-50/100`; aço `aco-900` `#1B1C1E`, `aco-800`, `aco-700`, `aco-500` (texto secundário no escuro); `grafite` `#3B3B3B`. Fundo da página `neutral-100`.
- **Fontes:** Raleway 700/800 (`font-titulo`) em títulos, botões e rótulos em maiúsculas; Open Sans no texto. Carregadas do Google Fonts no `index.html`.
- **Textura:** classe `.escovado` (aço escovado do topo do site, só CSS) nos topos, faixas do painel, cabeçalhos de modal e detalhe.
- **Logo:** símbolo enviado pela empresa em `frontend/public/simbolo-acokorte.png` (recortado, fundo transparente). `frontend/src/marca.tsx` tem `Simbolo` e `Logo` (símbolo + "AçoKorte" em Raleway com versaletes), sempre num chip branco. Ícones da PWA (`icone-192.png`, `icone-512.png`, `icone-maskable-512.png`, `apple-touch-icon.png`) foram gerados a partir do mesmo símbolo. Se o marketing mandar o vetorial (SVG), trocar o PNG e regenerar os ícones.
- **Simetria:** botão `h-12` (48 px), campo `h-11` (44 px), raio `rounded-md`, cartões `rounded-xl`, espaçamentos múltiplos de 8 px, colunas sempre iguais (`grid-cols-2`/`-3`/`-6`), indicadores com 120 px de altura. Componentes prontos em `ui.tsx`: `Botao` (primario, secundario, claro, fantasma), `Campo`, `Entrada`, `AreaTexto`, `estiloEntradaEscura`, `Modal`, `Cartao`, `Faixa`.
- **Vendedor:** topo escovado com símbolo, saudação e números (hoje, semana, mês); "Iniciar relato de visita" com dois quadrados iguais (Por voz vermelho, Por texto aço); gravação em tela escura.
- **Painel:** barra superior `aco-900` com abas (ativa sublinhada em vermelho) e avatar; cada página começa com `Faixa` escovada (título, ação, filtros e indicadores) e cartões brancos logo abaixo.

## 6. Estado atual (18/11/2026)

**Feito:**

- [x] Backend FastAPI com login por usuário, perfis vendedor/gerente, relatos, exportação Excel e migrações.
- [x] PWA do vendedor e painel do gerente, testados no navegador em modo demo (login, instrução, envio de áudio, formulário editável, envio, painel com filtros, detalhe e vendedores).
- [x] `teste_ambiente.py`, `iniciar.bat`, `PASSO_A_PASSO.md` e README atualizados.
- [x] Relato por texto (botão próprio) e aba Dashboard do gerente, testados no navegador. 13 testes `pytest` passando.
- [x] Gravação pelo microfone testada pelo usuário no Chrome em `localhost` (18/11).
- [x] Identidade visual da Açokorte aplicada (protótipo B) no app e no painel.

**Pendente:**

- [ ] **Gravação no celular** (Android e iPhone) só depois do HTTPS.
- [ ] **Ainda não testado com a API real.** Falta a conta em platform.openai.com (billing, limite e chave do projeto `relata-visita`).
- [ ] PostgreSQL não está instalado na máquina de dev. O código foi testado só com SQLite.
- [ ] Busca na ata usa `ILIKE` (não acha plural/acento diferente). Trocar por full-text search do PostgreSQL em português quando migrar.

## 7. Próximos passos

1. **Teste com áudios reais:** ajustar `PROMPT_EXTRACAO` e o `prompt=` da transcrição com o vocabulário da ACOKORTE. Meta: relatório certo em 9 de 10 áudios.
2. **Deploy em produção:** PostgreSQL, `visitas.acokorte.com.br` atrás do **Nginx com HTTPS** (igual ao portal de dados), serviço systemd com uvicorn, `SECRET_KEY` e `COOKIE_SEGURO=1`, backup diário do banco e dos áudios. **O microfone do celular só funciona em HTTPS.**
3. **Cliente do Mega:** autocompletar e validar o cliente na tabela `GLO_AGENTES` do ERP Mega (Oracle, só leitura, `python-oracledb`) e gravar o código do cliente. Confirmar com o usuário a conexão, os filtros de organização e as colunas antes de escrever a query.
4. **Envio sem sinal:** guardar o áudio no celular (IndexedDB) quando não houver internet e transcrever depois.
5. **Envio ao gerente:** e-mail com resumo diário das visitas.
6. **Robustez:** log de custo por chamada (minutos de áudio e tokens).
7. Piloto com 2 ou 3 vendedores por 2 semanas, ajustes, treinamento e go-live (a planilha manual sai de uso).

## 8. Regras e convenções para trabalhar neste projeto

- **Idioma:** tudo em **português do Brasil**, tanto a UI e as mensagens quanto os comentários e a documentação. Nomes de funções e variáveis também em português.
- **Comandos:** sempre para **PowerShell no Windows**, em blocos separados e completos, prontos para copiar e colar. Nada de comandos Linux para a máquina local.
- **Segredos:** **nunca** commitar `.env`, chave da API, `SECRET_KEY`, `.venv/`, `node_modules/`, `frontend/dist/` ou `dados/`. Conferir o `.gitignore` antes de cada commit.
- **Público:** os vendedores não são técnicos. A UI tem que ser mínima: gravar, conferir, enviar. Não adicionar campos obrigatórios além de Cliente e Data.
- **Banco:** mudou um modelo em `models.py`? Crie uma migração nova em `backend/alembic/versions/` (nunca edite a `0001` depois que for para produção). As migrações rodam sozinhas ao subir o servidor.
- **Permissões:** toda rota nova de dados precisa de `usuario_atual` ou `exigir_gerente`, e o vendedor só pode ver os próprios relatos. Coloque um teste para isso.
- **Limites da API:** áudio de no máximo **25 MB**. Formatos aceitos: mp3, m4a, ogg, wav, webm, mp4 (`.opus` precisa ser renomeado para `.ogg`).
- **Custo estimado:** cerca de US$ 0,01 por relato de 3 min, ou uns US$ 8 a 10 por mês para 10 vendedores. Manter o limite de gasto configurado na conta OpenAI.
- **Antes de mudanças grandes** (banco Mega, deploy, mudança de campos), apresente o plano e espere aprovação.
- **Testes:** `pytest` no backend roda em modo demo com SQLite temporário (veja `tests/conftest.py`). Depois de mexer no frontend, rode `npm run build` (o `tsc` checa os tipos).
- **Commits:** mensagens curtas em português, por exemplo `feat: login por vendedor` ou `fix: filtro de data`.
