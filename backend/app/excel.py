"""Exportação dos relatos para Excel (o que o gerente baixa no painel)."""
import io
from collections.abc import Iterable

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill

from .models import Relato

COLUNAS = [  # (título, largura)
    ("Data", 12), ("Vendedor", 20), ("Cliente", 28), ("Cidade", 18),
    ("Contato", 24), ("Ata de reunião", 80), ("Registrado em", 17), ("Origem", 9),
]


def gerar_xlsx(relatos: Iterable[Relato]) -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = "Relatos"
    ws.append([t for t, _ in COLUNAS])
    for cel in ws[1]:
        cel.font = Font(bold=True, color="FFFFFF")
        cel.fill = PatternFill("solid", fgColor="1F4E78")
        cel.alignment = Alignment(vertical="center")
    for i, (_, largura) in enumerate(COLUNAS, start=1):
        ws.column_dimensions[ws.cell(1, i).column_letter].width = largura
    for r in relatos:
        ws.append([r.data, r.vendedor.nome, r.cliente, r.cidade, r.contato, r.ata, r.criado_em,
                   "Texto" if r.origem == "texto" else "Voz"])
        linha = ws.max_row
        ws.cell(linha, 1).number_format = "DD/MM/YYYY"
        ws.cell(linha, 7).number_format = "DD/MM/YYYY HH:MM"
        for cel in ws[linha]:
            cel.alignment = Alignment(vertical="top", wrap_text=True)
    ws.freeze_panes = "A2"
    ws.auto_filter.ref = ws.dimensions
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()
