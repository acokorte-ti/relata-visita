import io
from datetime import date, datetime

from openpyxl import load_workbook

from conftest import AUDIO_FALSO, criar, entrar


def _enviar_relato(client, **extra):
    r = client.post("/api/relatos/transcrever",
                    files={"audio": ("gravacao.webm", AUDIO_FALSO, "audio/webm")})
    assert r.status_code == 200, r.text
    rasc = r.json()
    corpo = {"data": date.today().isoformat(), "cliente": rasc["cliente"],
             "cidade": rasc["cidade"], "contato": rasc["contato"], "ata": rasc["ata"],
             "transcricao": rasc["transcricao"], "audio_id": rasc["audio_id"], **extra}
    return client.post("/api/relatos", json=corpo)


# ------------------------------------------------------------------ login
def test_login_e_sessao(client):
    criar("carlos")
    assert client.get("/api/auth/eu").status_code == 401
    r = entrar(client, "Carlos")  # login não diferencia maiúsculas
    assert r.status_code == 200
    assert "senha_hash" not in r.json()
    assert client.get("/api/auth/eu").json()["login"] == "carlos"
    client.post("/api/auth/logout")
    client.cookies.clear()
    assert client.get("/api/auth/eu").status_code == 401


def test_senha_errada_e_bloqueio(client):
    criar("carlos")
    for _ in range(5):
        assert entrar(client, "carlos", "errada").status_code == 401
    assert entrar(client, "carlos").status_code == 429  # bloqueado mesmo com a senha certa


def test_vendedor_desativado_perde_sessao(client):
    criar("gerente", "gerente")
    v = criar("carlos")
    entrar(client, "carlos")
    cookie_vendedor = dict(client.cookies)
    entrar(client, "gerente")
    assert client.patch(f"/api/usuarios/{v.id}", json={"ativo": False}).status_code == 200
    client.cookies.clear()
    client.cookies.update(cookie_vendedor)
    assert client.get("/api/auth/eu").status_code == 401
    assert entrar(client, "carlos").status_code == 401


# ------------------------------------------------------------------ relatos
def test_fluxo_vendedor(client):
    criar("carlos")
    entrar(client, "carlos")
    r = _enviar_relato(client)
    assert r.status_code == 201, r.text
    rel = r.json()
    assert rel["cliente"] == "Gerdau" and rel["cidade"] == "Ouro Branco"
    assert rel["vendedor_nome"] == "Carlos" and rel["tem_audio"]
    # hora local do servidor (não UTC), senão o painel mostra o horário errado
    criado = datetime.fromisoformat(rel["criado_em"])
    assert abs((datetime.now() - criado).total_seconds()) < 60
    assert client.get(f"/api/relatos/{rel['id']}/audio").content == AUDIO_FALSO
    assert client.get("/api/relatos").json()["total"] == 1


def test_cliente_obrigatorio(client):
    criar("carlos")
    entrar(client, "carlos")
    assert _enviar_relato(client, cliente="   ").status_code == 422


def test_audio_de_outro_vendedor_e_recusado(client):
    criar("carlos")
    criar("marina")
    entrar(client, "carlos")
    audio_id = client.post("/api/relatos/transcrever",
                           files={"audio": ("a.webm", AUDIO_FALSO, "audio/webm")}).json()["audio_id"]
    entrar(client, "marina")
    r = client.post("/api/relatos", json={"data": "2026-11-18", "cliente": "X", "audio_id": audio_id})
    assert r.status_code == 400
    r = client.post("/api/relatos", json={"data": "2026-11-18", "cliente": "X",
                                          "audio_id": "../../etc/passwd"})
    assert r.status_code == 400


def test_formato_e_audio_vazio(client):
    criar("carlos")
    entrar(client, "carlos")
    r = client.post("/api/relatos/transcrever", files={"audio": ("a.txt", b"x" * 5000, "text/plain")})
    assert r.status_code == 415
    r = client.post("/api/relatos/transcrever", files={"audio": ("a.webm", b"x", "audio/webm")})
    assert r.status_code == 422


def test_vendedor_ve_so_os_proprios(client):
    criar("carlos")
    criar("marina")
    entrar(client, "carlos")
    id_carlos = _enviar_relato(client).json()["id"]
    entrar(client, "marina")
    _enviar_relato(client, cliente="Usiminas")
    lista = client.get("/api/relatos").json()
    assert [i["cliente"] for i in lista["itens"]] == ["Usiminas"]
    assert client.get(f"/api/relatos/{id_carlos}").status_code == 404
    assert client.get("/api/relatos/exportar.xlsx").status_code == 403
    assert client.get("/api/usuarios").status_code == 403


# ------------------------------------------------------------------ painel do gerente
def test_painel_filtros_e_excel(client):
    criar("gerente", "gerente")
    criar("carlos")
    v2 = criar("marina")
    entrar(client, "carlos")
    _enviar_relato(client, data="2026-11-01")
    _enviar_relato(client, cliente="Metalúrgica Sul", data="2026-11-10")
    entrar(client, "marina")
    _enviar_relato(client, cliente="Usiminas", data="2026-11-15", ata="Pediu chapa grossa")

    entrar(client, "gerente")
    todos = client.get("/api/relatos").json()
    assert (todos["total"], todos["clientes"], todos["vendedores"]) == (3, 3, 2)
    assert todos["itens"][0]["cliente"] == "Usiminas"  # mais recente primeiro

    assert client.get("/api/relatos", params={"inicio": "2026-11-05"}).json()["total"] == 2
    assert client.get("/api/relatos", params={"fim": "2026-11-05"}).json()["total"] == 1
    assert client.get("/api/relatos", params={"cliente": "gerd"}).json()["total"] == 1
    assert client.get("/api/relatos", params={"vendedor_id": v2.id}).json()["total"] == 1

    r = client.get("/api/relatos/exportar.xlsx", params={"inicio": "2026-11-05"})
    assert r.status_code == 200
    ws = load_workbook(io.BytesIO(r.content))["Relatos"]
    assert ws.max_row == 3  # cabeçalho + 2
    assert ws["C2"].value == "Usiminas"


def test_gerente_cadastra_vendedor(client):
    g = criar("gerente", "gerente")
    entrar(client, "gerente")
    r = client.post("/api/usuarios", json={"nome": "Ana Lima", "login": "Ana.Lima", "senha": "curta"})
    assert r.status_code == 422
    r = client.post("/api/usuarios", json={"nome": "Ana Lima", "login": "Ana.Lima", "senha": "senha-boa-123"})
    assert r.status_code == 201 and r.json()["login"] == "ana.lima"
    assert client.post("/api/usuarios", json={"nome": "Outra", "login": "ana.lima",
                                              "senha": "senha-boa-123"}).status_code == 409
    assert client.patch(f"/api/usuarios/{g.id}", json={"ativo": False}).status_code == 400
    assert entrar(client, "ana.lima", "senha-boa-123").status_code == 200


def test_status_e_spa(client):
    assert client.get("/api/status").json() == {"ok": True, "demo": True}
    assert client.get("/api/nao-existe").status_code == 404
