# Passo a passo: desenvolver e testar o Relata Visita na sua máquina

Objetivo: subir o servidor em `http://localhost:8502`, entrar como vendedor, gravar um relato, enviar e ver o relatório no painel do gerente.

Os comandos são para **PowerShell** no Windows. Rode um bloco por vez.

---

## Passo 1: Pré-requisitos

- **Python 3.12** (`py -3.12 --version`). Se não tiver, instale pelo python.org e marque "Add to PATH".
- **Node.js 20 ou mais novo** (`node --version`). Se não tiver, instale a versão LTS pelo nodejs.org.
- **Chrome ou Edge** e um microfone.
- **Acesso liberado** a `api.openai.com` na rede da empresa (porta 443).
- **PostgreSQL**: só para produção. No desenvolvimento o app usa um banco SQLite local, sem instalar nada.

## Passo 2: Conta e chave da API OpenAI

A assinatura do ChatGPT (Plus/Team) **não** inclui a API. São contas e cobranças separadas.

1. Acesse **platform.openai.com** e entre com o e-mail da empresa.
2. Em **Settings → Organization → Billing**, adicione um cartão e um crédito inicial (US$ 10 sobra para teste e piloto).
3. Em **Settings → Limits**, defina um limite mensal (ex.: US$ 20) e um alerta (ex.: US$ 10).
4. Em **Projects**, crie o projeto `relata-visita`.
5. Em **API keys → Create new secret key**, escolha o projeto e copie a chave (`sk-...`). Ela só aparece uma vez.

A chave fica só no arquivo `.env`. Nunca no código, e-mail ou WhatsApp.

## Passo 3: Ambiente Python (servidor)

```powershell
cd C:\Users\eduardo.macedo\Documents\relata-visita
py -3.12 -m venv .venv
```

```powershell
cd C:\Users\eduardo.macedo\Documents\relata-visita
.venv\Scripts\python -m pip install --upgrade pip
.venv\Scripts\python -m pip install -r backend\requirements.txt
```

## Passo 4: Compilar o app e o painel (frontend)

```powershell
cd C:\Users\eduardo.macedo\Documents\relata-visita\frontend
npm install
npm run build
```

Isso gera a pasta `frontend\dist`, que o servidor entrega para o navegador. Rode `npm run build` de novo sempre que mudar algo em `frontend\src`.

## Passo 5: Configurar o `.env`

```powershell
cd C:\Users\eduardo.macedo\Documents\relata-visita
copy .env.exemplo .env
.venv\Scripts\python -c "import secrets; print(secrets.token_urlsafe(32))"
notepad .env
```

Cole a chave da OpenAI em `OPENAI_API_KEY` e o texto que o segundo comando imprimiu em `SECRET_KEY`. Salve.

Com `OPENAI_API_KEY` vazio, o app roda em **modo demo**: qualquer áudio vira um relato simulado da Gerdau. Serve para testar tudo sem gastar.

## Passo 6: Checar o ambiente

```powershell
cd C:\Users\eduardo.macedo\Documents\relata-visita
.venv\Scripts\python teste_ambiente.py
```

Todos os itens têm que sair `[OK]` (no modo demo, a linha da `OPENAI_API_KEY` sai `[ERRO]` de propósito).

Para testar a transcrição e a extração de um áudio real sem abrir o app:

```powershell
cd C:\Users\eduardo.macedo\Documents\relata-visita
.venv\Scripts\python teste_ambiente.py C:\Users\eduardo.macedo\Downloads\audio_teste.ogg
```

## Passo 7: Criar os usuários

O primeiro gerente é criado pelo terminal (a senha é pedida e não aparece na tela):

```powershell
cd C:\Users\eduardo.macedo\Documents\relata-visita\backend
..\.venv\Scripts\python -m app.cli criar-usuario --perfil gerente --login gerente --nome "Gerente de Vendas"
```

Os vendedores o gerente cadastra pelo painel, em **Vendedores → Novo usuário**.

Só para testar no modo demo, dá para criar usuários de teste prontos (as senhas estão em `backend\app\cli.py`, na lista `USUARIOS_DEMO`):

```powershell
cd C:\Users\eduardo.macedo\Documents\relata-visita\backend
..\.venv\Scripts\python -m app.cli semear-demo
```

## Passo 8: Subir o servidor

Dê dois cliques em **`iniciar.bat`**, ou rode:

```powershell
cd C:\Users\eduardo.macedo\Documents\relata-visita
.venv\Scripts\python -m uvicorn app.main:app --app-dir backend --port 8502
```

- `http://localhost:8502`: entre como **vendedor** para ver o app; como **gerente** você cai direto no painel.
- No computador, aperte `F12` e ative o modo celular (ícone de celular) para ver o app no tamanho do telefone.
- Na primeira gravação, o navegador pede o microfone: clique em **Permitir**. Em `localhost` funciona sem HTTPS.
- Para parar, `Ctrl+C` no terminal ou feche a janela preta.

## Passo 9: Roteiro de testes

| # | Teste | Como fazer | Resultado esperado |
|---|---|---|---|
| T1 | Modo demo | `.env` sem chave, gravar qualquer coisa | Formulário preenchido com "Gerdau", envia e aparece no painel |
| T2 | Gravação real | Com chave, gravar: *"Hoje visitei a Gerdau em Ouro Branco, falei com o Alex de compras, ele pediu cotação de 20 toneladas de chapa grossa e reclamou de atraso. Fico de mandar a proposta sexta."* | Cliente, cidade, contato e ata certos; data de hoje |
| T3 | Áudio do WhatsApp | Na tela de gravação, **Enviar áudio** com um .ogg/.opus | Transcreve normal |
| T4 | Barulho | Gravar no carro ou com a janela aberta | Transcrição aceitável. Anote os erros para ajustar o prompt |
| T5 | Informação faltando | Não falar a cidade | Campo vazio, a IA não inventa |
| T6 | Correção | Mudar um campo antes de enviar | O painel mostra o valor corrigido |
| T7 | Sem internet | Desligar a rede e clicar em **ENVIAR RELATÓRIO** | Mensagem de erro; o relato continua salvo no celular. Volte a rede e envie |
| T8 | Login | Senha errada 5 vezes | Bloqueio de 15 minutos |
| T9 | Vendedor desativado | Gerente desativa o vendedor no painel | O vendedor é deslogado e não entra mais |
| T10 | Painel | Filtros de data, vendedor, cliente, busca; abrir um relato; ouvir o áudio; **Exportar Excel** | Tudo bate com o que foi enviado |
| T11 | Relato por texto | **INICIAR RELATO DE VISITA POR TEXTO**, digitar o relato, **Montar relatório** | Campos preenchidos pela IA (no modo demo, o texto vai para a ata), envia e aparece no painel |
| T12 | Dashboard | Painel → **Dashboard**, trocar período, vendedor e cliente | Números, gráficos e tabelas mudam com o filtro; "Sem visita há 30+ dias" lista clientes esquecidos |
| T13 | Custo | platform.openai.com → **Usage** | Centavos de dólar por dia de teste |

## Passo 10: Desenvolver e ajustar

- **Testes automáticos** (rodam em modo demo, sem gastar):

  ```powershell
  cd C:\Users\eduardo.macedo\Documents\relata-visita\backend
  ..\.venv\Scripts\python -m pytest -q
  ```

- **Frontend com recarga automática:** com o servidor rodando (Passo 8), abra outro terminal:

  ```powershell
  cd C:\Users\eduardo.macedo\Documents\relata-visita\frontend
  npm run dev
  ```

  e use `http://localhost:5173`. Cada vez que salvar um arquivo em `frontend\src`, a tela atualiza sozinha.

- **Melhorar a extração:** `PROMPT_EXTRACAO` em `backend\app\ia.py`. Coloque produtos, siglas e regras da ACOKORTE.
- **Melhorar a transcrição:** o `prompt=` dentro de `transcrever()` no mesmo arquivo. Coloque nomes de clientes e produtos que a transcrição erra, ex.: "Gerdau, Usiminas, chapa xadrez, bobina".
- **Mudar campos:** altere `backend\app\models.py`, crie uma migração nova em `backend\alembic\versions\` e ajuste `schemas.py`, `excel.py` e o formulário em `frontend\src\vendedor\AppVendedor.tsx`.
- **Trocar modelo:** no `.env`, `TRANSCRIBE_MODEL=gpt-4o-transcribe` (mais preciso, custa o dobro) ou `whisper-1`.
- **Documentação da API:** `http://localhost:8502/api/docs`.

## Passo 11 (opcional): Testar pelo celular

O navegador do celular **só libera o microfone em HTTPS**. Em `http://SEU_IP:8502` o app abre, mas só dá para usar **Enviar áudio**. A gravação no celular fica para a publicação em `https://visitas.acokorte.com.br` (Nginx com HTTPS, igual ao portal), que é a próxima etapa do cronograma.

```powershell
ipconfig | findstr IPv4
```

Para acessar de outro aparelho, suba o servidor com `--host 0.0.0.0` e, se o Windows pedir, libere o Python no Firewall para "Redes privadas".
