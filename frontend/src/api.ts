// Cliente da API do Relata Visita. O cookie de sessão vai junto (mesma origem).

export type Perfil = "vendedor" | "gerente";

export interface Usuario {
  id: number;
  nome: string;
  login: string;
  perfil: Perfil;
  ativo: boolean;
}

export interface Rascunho {
  audio_id: string;
  transcricao: string;
  cliente: string;
  cidade: string;
  contato: string;
  ata: string;
}

export interface Relato {
  id: number;
  data: string; // aaaa-mm-dd
  vendedor_id: number;
  vendedor_nome: string;
  cliente: string;
  cidade: string;
  contato: string;
  ata: string;
  transcricao: string;
  tem_audio: boolean;
  origem: "voz" | "texto";
  criado_em: string;
}

export interface RelatoLista {
  itens: Relato[];
  total: number;
  clientes: number;
  vendedores: number;
}

export interface FiltrosRelatos {
  inicio?: string;
  fim?: string;
  cliente?: string;
  vendedor_id?: number | "";
  busca?: string;
  limite?: number;
}

export interface Dashboard {
  resumo: {
    relatos: number;
    clientes: number;
    vendedores_com_relato: number;
    vendedores_ativos: number;
    media_por_vendedor: number;
    por_voz: number;
    por_texto: number;
    dias_no_periodo: number;
  };
  por_semana: { inicio: string; total: number }[];
  por_vendedor: { vendedor_id: number; nome: string; total: number; clientes: number; ultima: string | null }[];
  top_clientes: { cliente: string; total: number; vendedores: string[]; ultima: string }[];
  cliente_vendedor: { cliente: string; vendedor: string; total: number; ultima: string }[];
  clientes_sem_visita: { cliente: string; ultima: string; dias: number; vendedor: string }[];
}

export class ErroApi extends Error {
  constructor(public status: number, mensagem: string) {
    super(mensagem);
  }
}

async function pedir<T>(url: string, init: RequestInit = {}): Promise<T> {
  let r: Response;
  try {
    r = await fetch(url, { credentials: "same-origin", ...init });
  } catch {
    throw new ErroApi(0, "Sem conexão com o servidor. Verifique a internet e tente de novo.");
  }
  if (!r.ok) {
    let msg = "Algo deu errado. Tente de novo.";
    try {
      const corpo = await r.json();
      if (typeof corpo.detail === "string") msg = corpo.detail;
      else if (Array.isArray(corpo.detail)) msg = corpo.detail[0]?.msg?.replace(/^Value error, /, "") ?? msg;
    } catch {
      /* resposta sem JSON */
    }
    throw new ErroApi(r.status, msg);
  }
  if (r.status === 204) return undefined as T;
  return r.json() as Promise<T>;
}

const json = (metodo: string, corpo: unknown): RequestInit => ({
  method: metodo,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(corpo),
});

export function query(filtros: FiltrosRelatos): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(filtros)) {
    if (v !== undefined && v !== "" && v !== null) p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

export const api = {
  eu: () => pedir<Usuario>("/api/auth/eu"),
  login: (login: string, senha: string) => pedir<Usuario>("/api/auth/login", json("POST", { login, senha })),
  logout: () => pedir<void>("/api/auth/logout", { method: "POST" }),
  status: () => pedir<{ ok: boolean; demo: boolean }>("/api/status"),

  transcrever: (audio: Blob, nome: string) => {
    const fd = new FormData();
    fd.append("audio", audio, nome);
    return pedir<Rascunho>("/api/relatos/transcrever", { method: "POST", body: fd });
  },
  extrairTexto: (texto: string) => pedir<Rascunho>("/api/relatos/extrair", json("POST", { texto })),
  dashboard: (f: FiltrosRelatos & { dias_alerta?: number }) => pedir<Dashboard>(`/api/dashboard${query(f)}`),
  enviarRelato: (r: Omit<Rascunho, "audio_id"> & { audio_id: string; data: string }) =>
    pedir<Relato>("/api/relatos", json("POST", r)),
  relatos: (f: FiltrosRelatos) => pedir<RelatoLista>(`/api/relatos${query(f)}`),
  urlExcel: (f: FiltrosRelatos) => `/api/relatos/exportar.xlsx${query(f)}`,
  urlAudio: (id: number) => `/api/relatos/${id}/audio`,

  usuarios: () => pedir<Usuario[]>("/api/usuarios"),
  criarUsuario: (u: { nome: string; login: string; senha: string; perfil: Perfil }) =>
    pedir<Usuario>("/api/usuarios", json("POST", u)),
  alterarUsuario: (id: number, u: Partial<{ nome: string; ativo: boolean; senha: string; perfil: Perfil }>) =>
    pedir<Usuario>(`/api/usuarios/${id}`, json("PATCH", u)),
};

/** Iniciais para o avatar: só palavras com maiúscula ("Gerente de Vendas" -> "GV"). */
export function iniciais(nome: string): string {
  const palavras = nome.split(/\s+/).filter((p) => /^[A-ZÀ-Ý]/.test(p));
  return (palavras.length ? palavras : [nome]).slice(0, 2).map((p) => p[0].toUpperCase()).join("");
}

// ------------------------------------------------ datas
export function hojeISO(): string {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export function isoDe(d: Date): string {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export function dataBR(iso: string): string {
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

export function dataHoraBR(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}
