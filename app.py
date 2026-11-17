"""
Relata Visita - atas de visita por voz (ACOKORTE)
Vendedor grava (ou sobe) um áudio contando a visita -> app transcreve ->
IA extrai os campos da ata -> vendedor confere -> grava no Excel do coordenador.

Rodar:  streamlit run app.py
Sem OPENAI_API_KEY o app roda em MODO DEMO (transcrição/extração simuladas).
"""
import io
import json
import os
import re
import threading
from datetime import datetime
from pathlib import Path

import pandas as pd
import streamlit as st
from openpyxl import Workbook, load_workbook
from openpyxl.styles import Alignment, Font, PatternFill

# ----------------------------------------------------------------- config
BASE = Path(__file__).parent
try:  # lê o arquivo .env da pasta do app (chave, caminho da planilha etc.)
    from dotenv import load_dotenv
    load_dotenv(BASE / ".env")
except ImportError:
    pass
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
TRANSCRIBE_MODEL = os.getenv("TRANSCRIBE_MODEL", "gpt-4o-mini-transcribe")  # ou whisper-1
LLM_MODEL = os.getenv("LLM_MODEL", "gpt-4o-mini")
XLSX_PATH = Path(os.getenv("VISITAS_XLSX", BASE / "dados" / "visitas.xlsx"))
AUDIO_DIR = Path(os.getenv("AUDIO_DIR", BASE / "dados" / "audios"))
COORD_SENHA = os.getenv("COORD_SENHA", "trocar")
VENDEDORES = [v.strip() for v in os.getenv(
    "VENDEDORES", "Selecione...,Vendedor 1,Vendedor 2,Vendedor 3").split(",")]
DEMO = not OPENAI_API_KEY

COLUNAS = [
    ("data_registro", "Registrado em"),
    ("vendedor", "Vendedor"),
    ("cliente", "Cliente"),
    ("data_visita", "Data da visita"),
    ("periodo", "Período"),
    ("contato", "Contato"),
    ("cargo_contato", "Cargo/Setor"),
    ("assuntos", "Assuntos tratados"),
    ("oportunidades", "Oportunidades / pedidos"),
    ("problemas", "Problemas / reclamações"),
    ("proximos_passos", "Próximos passos"),
    ("data_retorno", "Data de retorno"),
    ("temperatura", "Temperatura"),
    ("transcricao", "Transcrição completa"),
    ("audio", "Arquivo de áudio"),
]
CAMPOS_IA = [c for c, _ in COLUNAS
             if c not in ("data_registro", "vendedor", "transcricao", "audio")]
PERIODOS = ["", "Manhã", "Tarde", "Noite", "Dia todo"]
TEMPERATURAS = ["", "Quente", "Morno", "Frio"]

_lock = threading.Lock()


# ----------------------------------------------------------------- IA
def cliente_openai():
    from openai import OpenAI
    return OpenAI(api_key=OPENAI_API_KEY)


def transcrever(nome: str, dados: bytes) -> str:
    if DEMO:
        return ("Fui ao cliente Gerdau hoje na parte da manhã, falei com o Alex "
                "do setor de compras. Tratamos do atraso na entrega das chapas do "
                "pedido passado, ele reclamou de dois dias de atraso. Também pediu "
                "cotação de 20 toneladas de chapa grossa para dezembro. Fiquei de "
                "mandar a proposta até sexta e voltar lá na semana que vem.")
    # áudio do WhatsApp vem .opus; a API aceita como .ogg
    if nome.lower().endswith(".opus"):
        nome = nome[:-5] + ".ogg"
    r = cliente_openai().audio.transcriptions.create(
        model=TRANSCRIBE_MODEL, file=(nome, dados), language="pt",
        prompt="Relato de visita comercial de vendedor externo da ACOKORTE "
               "(aço, chapas, corte, dobra). Nomes de clientes e pessoas.")
    return r.text.strip()


PROMPT_EXTRACAO = """Você recebe a transcrição de um vendedor externo relatando uma visita a cliente.
Hoje é {hoje} ({dia_semana}). Converta datas relativas ("hoje", "ontem", "sexta") para dd/mm/aaaa.
Responda SOMENTE um JSON com as chaves:
cliente, data_visita (dd/mm/aaaa), periodo (Manhã|Tarde|Noite|Dia todo|""),
contato (nome da pessoa), cargo_contato, assuntos (resumo objetivo em tópicos curtos separados por "; "),
oportunidades (cotações, pedidos, volumes, valores), problemas (reclamações, atrasos, qualidade),
proximos_passos (o que o vendedor ficou de fazer), data_retorno (dd/mm/aaaa ou ""),
temperatura (Quente|Morno|Frio - chance de negócio).
Não invente: se a informação não foi dita, use "".

Transcrição:
\"\"\"{texto}\"\"\""""


def extrair_campos(texto: str) -> dict:
    hoje = datetime.now()
    if DEMO:
        return {
            "cliente": "Gerdau", "data_visita": hoje.strftime("%d/%m/%Y"),
            "periodo": "Manhã", "contato": "Alex", "cargo_contato": "Compras",
            "assuntos": "Atraso na entrega do último pedido; nova cotação de chapa grossa",
            "oportunidades": "Cotação de 20 t de chapa grossa para dezembro",
            "problemas": "Reclamação de 2 dias de atraso na entrega das chapas",
            "proximos_passos": "Enviar proposta até sexta; nova visita semana que vem",
            "data_retorno": "", "temperatura": "Quente",
        }
    dias = ["segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"]
    prompt = PROMPT_EXTRACAO.format(hoje=hoje.strftime("%d/%m/%Y"),
                                    dia_semana=dias[hoje.weekday()], texto=texto)
    r = cliente_openai().chat.completions.create(
        model=LLM_MODEL, temperature=0,
        response_format={"type": "json_object"},
        messages=[{"role": "user", "content": prompt}])
    bruto = r.choices[0].message.content
    try:
        dados = json.loads(bruto)
    except json.JSONDecodeError:
        m = re.search(r"\{.*\}", bruto, re.S)
        dados = json.loads(m.group(0)) if m else {}
    return {c: str(dados.get(c, "") or "") for c in CAMPOS_IA}


# ----------------------------------------------------------------- Excel
def _criar_planilha():
    XLSX_PATH.parent.mkdir(parents=True, exist_ok=True)
    wb = Workbook()
    ws = wb.active
    ws.title = "Visitas"
    ws.append([t for _, t in COLUNAS])
    for cel in ws[1]:
        cel.font = Font(bold=True, color="FFFFFF")
        cel.fill = PatternFill("solid", fgColor="1F4E78")
        cel.alignment = Alignment(vertical="center", wrap_text=True)
    larguras = [17, 16, 22, 12, 10, 16, 16, 50, 40, 40, 40, 12, 11, 70, 28]
    for i, w in enumerate(larguras, start=1):
        ws.column_dimensions[ws.cell(1, i).column_letter].width = w
    ws.freeze_panes = "A2"
    ws.auto_filter.ref = ws.dimensions
    wb.save(XLSX_PATH)


PENDENTES = BASE / "dados" / "pendentes.jsonl"  # fila local se a planilha estiver travada


def _ler_pendentes() -> list:
    if not PENDENTES.exists():
        return []
    return [json.loads(l) for l in PENDENTES.read_text(encoding="utf-8").splitlines() if l.strip()]


def _gravar_no_excel(regs: list):
    if not XLSX_PATH.exists():
        _criar_planilha()
    wb = load_workbook(XLSX_PATH)
    ws = wb["Visitas"]
    for reg in regs:
        ws.append([reg.get(c, "") for c, _ in COLUNAS])
        for cel in ws[ws.max_row]:
            cel.alignment = Alignment(vertical="top", wrap_text=True)
    ws.auto_filter.ref = ws.dimensions
    wb.save(XLSX_PATH)


def salvar_visita(reg: dict) -> bool:
    """Grava na planilha da rede. Se ela estiver aberta no Excel (travada) ou a
    rede cair, guarda em dados/pendentes.jsonl e tenta de novo no próximo envio.
    Retorna True se foi para a planilha, False se ficou na fila."""
    with _lock:
        fila = _ler_pendentes() + [reg]
        try:
            _gravar_no_excel(fila)
        except (PermissionError, OSError) as e:
            PENDENTES.parent.mkdir(parents=True, exist_ok=True)
            with PENDENTES.open("a", encoding="utf-8") as f:
                f.write(json.dumps(reg, ensure_ascii=False) + "\n")
            st.session_state["erro_planilha"] = str(e)
            return False
        PENDENTES.unlink(missing_ok=True)
        return True


def reenviar_pendentes() -> bool:
    with _lock:
        fila = _ler_pendentes()
        if not fila:
            return True
        try:
            _gravar_no_excel(fila)
        except (PermissionError, OSError) as e:
            st.session_state["erro_planilha"] = str(e)
            return False
        PENDENTES.unlink(missing_ok=True)
        return True


def ler_visitas() -> pd.DataFrame:
    vazio = pd.DataFrame(columns=[t for _, t in COLUNAS])
    if not XLSX_PATH.exists():
        return vazio
    try:
        return pd.read_excel(XLSX_PATH, sheet_name="Visitas", dtype=str).fillna("")
    except (PermissionError, OSError) as e:
        st.error(f"Não consegui ler a planilha: {e}")
        return vazio


# ----------------------------------------------------------------- UI
st.set_page_config(page_title="Relata Visita", page_icon="🎙️", layout="centered")
st.title("🎙️ Relata Visita")
st.caption("Conte como foi a visita. A ata vai direto para o coordenador.")
if DEMO:
    st.warning("MODO DEMO: sem OPENAI_API_KEY, a transcrição e a extração são simuladas.")

with st.sidebar:
    st.subheader("Configuração")
    st.write("**IA:**", "DEMO (sem chave)" if DEMO else f"OpenAI · {TRANSCRIBE_MODEL} + {LLM_MODEL}")
    st.write("**Planilha:**")
    st.code(str(XLSX_PATH), language=None)
    pasta_ok = XLSX_PATH.parent.exists()
    if not pasta_ok:
        st.error("Pasta da planilha não encontrada (rede fora ou caminho errado).")
    elif XLSX_PATH.exists():
        st.success("Planilha encontrada.")
    else:
        st.info("Pasta ok. A planilha será criada no 1º envio.")
    pend = _ler_pendentes()
    if pend:
        st.warning(f"{len(pend)} visita(s) aguardando gravação na planilha.")
        if st.button("Tentar gravar agora"):
            if reenviar_pendentes():
                st.success("Pendentes gravadas na planilha.")
                st.rerun()
            else:
                st.error("Ainda travada. Feche a planilha no Excel e tente de novo.")

aba_vend, aba_coord = st.tabs(["Registrar visita", "Coordenador"])

with aba_vend:
    vendedor = st.selectbox("Vendedor", VENDEDORES)
    st.caption("Conte: cliente, data/período, com quem falou, o que foi tratado, "
               "oportunidades, problemas e o que ficou combinado.")
    gravado = st.audio_input("Gravar relato")
    with st.expander("…ou enviar um áudio (WhatsApp, gravador do celular)"):
        enviado = st.file_uploader("Arquivo de áudio",
                                   type=["mp3", "m4a", "ogg", "opus", "wav", "webm", "mp4", "aac"])
    audio = gravado or enviado

    if audio and st.button("Transcrever e montar ata", type="primary",
                           disabled=vendedor == VENDEDORES[0]):
        dados = audio.getvalue()
        nome = getattr(audio, "name", None) or "gravacao.wav"
        if len(dados) > 25 * 1024 * 1024:
            st.error("Áudio maior que 25 MB. Grave relatos mais curtos.")
            st.stop()
        try:
            with st.spinner("Transcrevendo…"):
                texto = transcrever(nome, dados)
            with st.spinner("Montando a ata…"):
                campos = extrair_campos(texto)
        except Exception as e:  # noqa: BLE001
            st.error(f"Falha na IA: {e}")
            st.stop()
        st.session_state.rascunho = {"transcricao": texto, **campos,
                                     "_audio": dados, "_nome": nome}
    if vendedor == VENDEDORES[0]:
        st.info("Selecione o vendedor para continuar.")

    rasc = st.session_state.get("rascunho")
    if rasc:
        st.subheader("Confira a ata antes de enviar")
        with st.form("ata"):
            c1, c2 = st.columns(2)
            cliente = c1.text_input("Cliente*", rasc["cliente"])
            contato = c2.text_input("Contato", rasc["contato"])
            data_visita = c1.text_input("Data da visita*", rasc["data_visita"])
            cargo = c2.text_input("Cargo/Setor", rasc["cargo_contato"])
            per = rasc["periodo"] if rasc["periodo"] in PERIODOS else ""
            periodo = c1.selectbox("Período", PERIODOS, index=PERIODOS.index(per))
            tmp = rasc["temperatura"] if rasc["temperatura"] in TEMPERATURAS else ""
            temperatura = c2.selectbox("Temperatura", TEMPERATURAS,
                                       index=TEMPERATURAS.index(tmp))
            assuntos = st.text_area("Assuntos tratados", rasc["assuntos"])
            oport = st.text_area("Oportunidades / pedidos", rasc["oportunidades"])
            probl = st.text_area("Problemas / reclamações", rasc["problemas"])
            passos = st.text_area("Próximos passos", rasc["proximos_passos"])
            retorno = st.text_input("Data de retorno", rasc["data_retorno"])
            with st.expander("Transcrição completa"):
                transc = st.text_area("Texto", rasc["transcricao"], height=180)
            ok = st.form_submit_button("✅ Enviar para o coordenador", type="primary")

        if ok:
            if not cliente.strip() or not data_visita.strip():
                st.error("Cliente e data da visita são obrigatórios.")
            else:
                agora = datetime.now()
                AUDIO_DIR.mkdir(parents=True, exist_ok=True)
                ext = Path(rasc["_nome"]).suffix or ".wav"
                slug = re.sub(r"[^A-Za-z0-9]+", "_", f"{vendedor}_{cliente}")[:40]
                arq = AUDIO_DIR / f"{agora:%Y%m%d_%H%M%S}_{slug}{ext}"
                arq.write_bytes(rasc["_audio"])
                gravou = salvar_visita({
                    "data_registro": agora.strftime("%d/%m/%Y %H:%M"),
                    "vendedor": vendedor, "cliente": cliente, "data_visita": data_visita,
                    "periodo": periodo, "contato": contato, "cargo_contato": cargo,
                    "assuntos": assuntos, "oportunidades": oport, "problemas": probl,
                    "proximos_passos": passos, "data_retorno": retorno,
                    "temperatura": temperatura, "transcricao": transc, "audio": arq.name,
                })
                del st.session_state["rascunho"]
                if gravou:
                    st.success(f"Visita à {cliente} registrada na planilha. Obrigado!")
                    st.balloons()
                else:
                    st.warning(f"Visita à {cliente} salva, mas a planilha está aberta/travada "
                               "ou a rede caiu. Ela fica na fila e será gravada no próximo envio "
                               f"(ou pelo botão na barra lateral). Detalhe: "
                               f"{st.session_state.get('erro_planilha', '')}")

with aba_coord:
    if st.text_input("Senha do coordenador", type="password") != COORD_SENHA:
        st.info("Informe a senha para ver o relatório.")
    else:
        df = ler_visitas()
        st.metric("Visitas registradas", len(df))
        if not df.empty:
            f1, f2 = st.columns(2)
            vend = f1.multiselect("Vendedor", sorted(df["Vendedor"].unique()))
            busca = f2.text_input("Buscar cliente / texto")
            if vend:
                df = df[df["Vendedor"].isin(vend)]
            if busca:
                mask = df.apply(lambda r: busca.lower() in " ".join(r).lower(), axis=1)
                df = df[mask]
            st.dataframe(df.drop(columns=["Transcrição completa", "Arquivo de áudio"]),
                         hide_index=True)
            st.bar_chart(df["Vendedor"].value_counts())
        if XLSX_PATH.exists():
            st.download_button("⬇️ Baixar Excel completo", XLSX_PATH.read_bytes(),
                               file_name=f"visitas_{datetime.now():%Y%m%d}.xlsx")
