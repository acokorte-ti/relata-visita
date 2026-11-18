"""Transcrição do áudio e extração dos campos do relato (OpenAI)."""
import json
import re
from datetime import date

from . import config

CAMPOS_IA = ("cliente", "cidade", "contato", "ata")

_TEXTO_DEMO = (
    "Hoje visitei a Gerdau em Ouro Branco, conversei com o Alex do setor de compras. "
    "Ele reclamou de dois dias de atraso na entrega das chapas do último pedido e pediu "
    "cotação de 20 toneladas de chapa grossa para dezembro. Fiquei de mandar a proposta "
    "até sexta e voltar lá na semana que vem."
)


def _cliente():
    from openai import OpenAI
    return OpenAI(api_key=config.OPENAI_API_KEY)


def transcrever(nome_arquivo: str, dados: bytes) -> str:
    if config.DEMO:
        return _TEXTO_DEMO
    if nome_arquivo.lower().endswith(".opus"):  # áudio do WhatsApp: a API aceita como .ogg
        nome_arquivo = nome_arquivo[:-5] + ".ogg"
    r = _cliente().audio.transcriptions.create(
        model=config.TRANSCRIBE_MODEL, file=(nome_arquivo, dados), language="pt",
        prompt="Relato de visita comercial de vendedor externo da ACOKORTE "
               "(aço, chapas, corte, dobra). Nomes de clientes, cidades e pessoas.")
    return r.text.strip()


PROMPT_EXTRACAO = """Você recebe a transcrição de um vendedor externo da ACOKORTE (aço: chapas, corte, dobra) relatando uma visita a cliente.
Hoje é {hoje}.
Responda SOMENTE um JSON com as chaves:
- cliente: nome da empresa visitada
- cidade: cidade do cliente
- contato: pessoa com quem o vendedor conversou no cliente, com o setor/cargo entre parênteses se foi dito. Ex.: "Alex (Compras)"
- ata: ata da reunião em português, objetiva, em frases curtas: o que foi tratado, problemas, oportunidades (produtos, volumes, prazos) e o que ficou combinado
Não invente: se a informação não foi dita, use "".

Transcrição:
\"\"\"{texto}\"\"\""""


def extrair_campos(texto: str) -> dict[str, str]:
    if config.DEMO:
        return {
            "cliente": "Gerdau",
            "cidade": "Ouro Branco",
            "contato": "Alex (Compras)",
            "ata": "Cliente reclamou de 2 dias de atraso na entrega das chapas do último pedido. "
                   "Pediu cotação de 20 t de chapa grossa para dezembro. "
                   "Vendedor vai enviar a proposta até sexta e voltar ao cliente na semana que vem.",
        }
    r = _cliente().chat.completions.create(
        model=config.LLM_MODEL, temperature=0,
        response_format={"type": "json_object"},
        messages=[{"role": "user", "content": PROMPT_EXTRACAO.format(
            hoje=date.today().strftime("%d/%m/%Y"), texto=texto)}])
    bruto = r.choices[0].message.content or ""
    try:
        dados = json.loads(bruto)
    except json.JSONDecodeError:
        m = re.search(r"\{.*\}", bruto, re.S)
        dados = json.loads(m.group(0)) if m else {}
    return {c: str(dados.get(c, "") or "").strip() for c in CAMPOS_IA}
