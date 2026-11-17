# Passo a passo: desenvolver e testar o Relata Visita na sua máquina

Objetivo do teste: o app abre numa aba do navegador (`http://localhost:8502`), você grava ou envia um áudio, a API da OpenAI transcreve, a ata é montada e gravada numa planilha numa pasta da rede interna.

Os comandos são para **PowerShell** no Windows. Rode um bloco por vez.

---

## Passo 1: Pré-requisitos

Você vai precisar de:

- **Python 3.12** instalado (o `py` do Windows). Para conferir: `py -3.12 --version`. Se não tiver, instale pelo python.org e marque "Add to PATH".
- **Chrome ou Edge** e um microfone (o do notebook ou um headset).
- **Acesso de escrita** a uma pasta da rede, por exemplo `\\SERVIDOR\Comercial\Visitas`.
- **Acesso liberado** a `api.openai.com` na rede da empresa (porta 443).

## Passo 2: Criar a conta e a chave da API OpenAI

A assinatura do ChatGPT (Plus/Team) **não** inclui a API. São contas e cobranças separadas.

1. Acesse **platform.openai.com** e entre com o e-mail da empresa.
2. Em **Settings → Organization → Billing**, adicione um cartão e um crédito inicial (US$ 10 já sobra para o teste e o piloto).
3. Em **Settings → Limits**, defina um limite mensal (ex.: US$ 20) e um alerta por e-mail (ex.: US$ 10).
4. Em **Projects**, crie o projeto `atas-visita`.
5. Em **API keys → Create new secret key**, escolha o projeto `atas-visita` e copie a chave (`sk-...`). Ela só aparece uma vez.

A chave dá acesso à conta e gera custo. Nunca a coloque dentro do `app.py` nem a mande por e-mail ou WhatsApp. Ela fica só no arquivo `.env`.

## Passo 3: Clonar o repositório e montar o ambiente Python

Se ainda não tem a pasta (em outra máquina, por exemplo):

```powershell
cd C:\Users\eduardo.macedo\Documents
git clone https://github.com/acokorte-ti/relata-visita
```

```powershell
cd C:\Users\eduardo.macedo\Documents\relata-visita
py -3.12 -m venv .venv
```

```powershell
cd C:\Users\eduardo.macedo\Documents\relata-visita
.venv\Scripts\python -m pip install --upgrade pip
.venv\Scripts\python -m pip install -r requirements.txt
```

## Passo 4: Preparar a pasta da rede

Crie a pasta onde a planilha vai ficar. Não precisa criar o `visitas.xlsx`: o app cria o arquivo no primeiro envio, já com cabeçalho e filtro.

```powershell
mkdir \\SERVIDOR\Comercial\Visitas
mkdir \\SERVIDOR\Comercial\Visitas\audios
Test-Path \\SERVIDOR\Comercial\Visitas
```

O último comando tem que responder `True`. Prefira o caminho UNC (`\\SERVIDOR\...`) a uma unidade mapeada (`V:\`). Quando o app for para um servidor, a unidade mapeada pode não existir lá.

## Passo 5: Configurar o arquivo `.env`

```powershell
cd C:\Users\eduardo.macedo\Documents\relata-visita
copy .env.exemplo .env
notepad .env
```

Preencha os campos e salve:

```
OPENAI_API_KEY=sk-...sua chave...
VISITAS_XLSX=\\SERVIDOR\Comercial\Visitas\visitas.xlsx
AUDIO_DIR=\\SERVIDOR\Comercial\Visitas\audios
COORD_SENHA=uma_senha_sua
VENDEDORES=Selecione...,Eduardo (teste),Vendedor 1,Vendedor 2
```

Se deixar `OPENAI_API_KEY` vazio, o app roda em **modo demo**, com um texto simulado. Serve para testar a planilha da rede sem gastar nada.

## Passo 6: Checar o ambiente antes de abrir o app

```powershell
cd C:\Users\eduardo.macedo\Documents\relata-visita
.venv\Scripts\python teste_ambiente.py
```

O script confere os pacotes, o `.env`, se a pasta da rede existe e aceita escrita, se a planilha está livre e se a chave funciona (faz uma chamada mínima, de menos de US$ 0,001). Todos os itens têm que sair `[OK]`.

Também dá para testar a transcrição de um áudio antes de abrir o app:

```powershell
cd C:\Users\eduardo.macedo\Documents\relata-visita
.venv\Scripts\python teste_ambiente.py C:\Users\eduardo.macedo\Downloads\audio_teste.ogg
```

## Passo 7: Abrir o app no navegador

Dê dois cliques em **`iniciar.bat`**, ou rode:

```powershell
cd C:\Users\eduardo.macedo\Documents\relata-visita
.venv\Scripts\python -m streamlit run app.py --server.port 8502
```

O navegador abre em `http://localhost:8502`. Na primeira gravação, o navegador pede permissão para usar o microfone: clique em **Permitir**. O microfone funciona em `localhost` mesmo sem HTTPS.

A barra lateral mostra se o app está em modo IA ou demo, o caminho da planilha e se a pasta da rede foi encontrada. Para parar o app, aperte `Ctrl+C` no terminal ou feche a janela preta.

## Passo 8: Roteiro de testes

Marque cada teste depois de conferir o resultado no `visitas.xlsx` da rede.

| # | Teste | Como fazer | Resultado esperado |
|---|---|---|---|
| T1 | Modo demo | `.env` sem chave, enviar qualquer áudio | Linha "Gerdau" na planilha da rede |
| T2 | Gravação pelo microfone | Chave preenchida, gravar: *"Fui na Gerdau hoje de manhã, falei com o Alex de compras, ele pediu cotação de 20 toneladas de chapa e reclamou de atraso. Fico de mandar proposta sexta."* | Campos preenchidos certo, data de hoje, sexta convertida para a data real |
| T3 | Áudio do WhatsApp | No WhatsApp Web, baixe um áudio (.ogg/.opus) e envie no app | Transcreve normal |
| T4 | Áudio com barulho | Gravar no carro ou com a janela aberta | Transcrição aceitável. Anote os erros para ajustar o prompt |
| T5 | Data relativa | Dizer "ontem à tarde" ou "na segunda" | Data convertida para dd/mm/aaaa |
| T6 | Informação faltando | Não falar o nome do contato | Campo vazio, a IA não inventa |
| T7 | Planilha aberta no Excel | Abra o `visitas.xlsx` no Excel e envie uma ata | Aviso amarelo, ata vai para a fila. Feche o Excel e clique em "Tentar gravar agora" (ou envie a próxima): a linha entra |
| T8 | Rede fora | Desconecte o cabo/VPN e envie | Ata vai para a fila. Volte a rede e reenvie |
| T9 | Coordenador | Aba Coordenador, digite a senha | Tabela, filtro por vendedor, busca e download do Excel |
| T10 | Custo | platform.openai.com → **Usage** | Centavos de dólar por dia de teste |

Enquanto o app estiver em uso, o coordenador deve ver as visitas pela aba Coordenador ou pelo botão de download. Se ele deixar o `visitas.xlsx` aberto no Excel, o arquivo fica travado e as atas acumulam na fila (`dados\pendentes.jsonl`) até alguém fechar a planilha.

## Passo 9: Desenvolver e ajustar

- **Ver as mudanças:** edite o `app.py` no VS Code e salve. No navegador, clique em **Rerun** no canto superior direito, ou marque **"Always rerun"** para recarregar sozinho.
- **Melhorar a extração:** o texto que diz à IA o que tirar do áudio é o `PROMPT_EXTRACAO`. Ali você coloca nomes de produtos, siglas e regras da ACOKORTE.
- **Melhorar a transcrição:** o parâmetro `prompt=` dentro de `transcrever()` serve para isso. Coloque nomes de clientes e produtos que a transcrição erra, por exemplo "Gerdau, Usiminas, chapa xadrez, bobina".
- **Mudar campos da ata:** altere a lista `COLUNAS` e o formulário. Mudar colunas exige começar uma planilha nova: renomeie a antiga e o app cria outra no próximo envio.
- **Trocar modelo:** no `.env`, use `TRANSCRIBE_MODEL=gpt-4o-transcribe` para mais precisão (custa o dobro) ou `whisper-1`.
- **Erros:** as mensagens aparecem no terminal onde o Streamlit está rodando.

## Passo 10 (opcional): Testar pelo celular na rede interna

Com o app rodando, descubra o IP da sua máquina:

```powershell
ipconfig | findstr IPv4
```

No celular, conectado ao Wi-Fi da empresa, abra `http://SEU_IP:8502`. **Enviar arquivo** funciona assim. **Gravar pelo microfone não funciona**, porque o navegador do celular só libera o microfone em HTTPS. Para isso será preciso publicar com HTTPS (Nginx, igual ao portal), que é a etapa seguinte do cronograma.

Se o Windows pedir, libere o Python no Firewall para "Redes privadas".

---

## Problemas comuns

| Sintoma | Causa provável | Solução |
|---|---|---|
| `py` não é reconhecido | Python não instalado ou fora do PATH | Instalar o Python 3.12 marcando "Add to PATH" |
| Barra lateral: "Pasta da planilha não encontrada" | Caminho errado no `.env` ou sem acesso à rede | Testar `Test-Path` no PowerShell com o mesmo caminho |
| `PermissionError` / ata na fila | Planilha aberta no Excel por alguém | Fechar a planilha e clicar em "Tentar gravar agora" |
| `401 Incorrect API key` | Chave errada ou com espaço sobrando | Copiar a chave de novo para o `.env`, sem aspas |
| `429 insufficient_quota` | Sem crédito ou limite estourado | Billing: adicionar crédito ou subir o limite |
| `Connection error` / timeout | Firewall ou proxy bloqueando | Liberar `api.openai.com:443` |
| Botão de gravar não aparece ou não grava | Microfone bloqueado no navegador | Cadeado na barra de endereço → Microfone → Permitir |
| Áudio maior que 25 MB | Relato muito longo | Gravar em partes (3 a 5 min já é bastante) |
