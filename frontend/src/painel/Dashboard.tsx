// Aba Dashboard do gerente: indicadores de visitas por período, vendedor e cliente.
// Gráficos em HTML/CSS puro (sem biblioteca): barras finas, uma cor (série única),
// valor na ponta da barra e dica ao passar o mouse.
import { useDeferredValue, useMemo, useState, type ReactNode } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { AlertTriangle, CircleAlert } from "lucide-react";
import { api, dataBR, hojeISO, isoDe, type Dashboard as Dados } from "../api";
import { Aviso, Carregando, Entrada } from "../ui";

const COR_SERIE = "#2a78d6"; // categórica 1 (paleta validada do guia de dataviz)
const DIAS_ALERTA = 30;

function diasAtras(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return isoDe(d);
}

const PERIODOS = [
  { rotulo: "30 dias", inicio: () => diasAtras(29) },
  { rotulo: "90 dias", inicio: () => diasAtras(89) },
  { rotulo: "Este ano", inicio: () => `${new Date().getFullYear()}-01-01` },
];

const fmt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

export default function Dashboard() {
  const [inicio, setInicio] = useState(diasAtras(89));
  const [fim, setFim] = useState(hojeISO());
  const [vendedorId, setVendedorId] = useState<number | "">("");
  const [cliente, setCliente] = useState("");

  const filtros = { inicio, fim, vendedor_id: vendedorId, cliente: useDeferredValue(cliente), dias_alerta: DIAS_ALERTA };
  const q = useQuery({
    queryKey: ["dashboard", filtros],
    queryFn: () => api.dashboard(filtros),
    placeholderData: keepPreviousData,
  });
  const usuarios = useQuery({ queryKey: ["usuarios"], queryFn: api.usuarios });
  const vendedores = (usuarios.data ?? []).filter((u) => u.perfil === "vendedor");

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-slate-500">Quem está visitando, quais clientes e com que frequência.</p>
      </div>

      <div className="mb-6 flex flex-wrap items-end gap-3 rounded-xl bg-white p-4 ring-1 ring-slate-200">
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1" role="group" aria-label="Período rápido">
          {PERIODOS.map((p) => {
            const ativo = inicio === p.inicio() && fim === hojeISO();
            return (
              <button key={p.rotulo} onClick={() => { setInicio(p.inicio()); setFim(hojeISO()); }}
                aria-pressed={ativo}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${ativo ? "bg-white text-aco-800 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>
                {p.rotulo}
              </button>
            );
          })}
        </div>
        <Filtro rotulo="De"><Entrada type="date" value={inicio} max={fim} onChange={(e) => setInicio(e.target.value)} className="w-40" /></Filtro>
        <Filtro rotulo="Até"><Entrada type="date" value={fim} min={inicio} onChange={(e) => setFim(e.target.value)} className="w-40" /></Filtro>
        <Filtro rotulo="Vendedor">
          <select value={vendedorId} onChange={(e) => setVendedorId(e.target.value ? Number(e.target.value) : "")}
            className="w-48 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base focus:border-aco-600 focus:outline-none focus:ring-2 focus:ring-aco-100">
            <option value="">Todos</option>
            {vendedores.map((v) => <option key={v.id} value={v.id}>{v.nome}{v.ativo ? "" : " (inativo)"}</option>)}
          </select>
        </Filtro>
        <Filtro rotulo="Cliente"><Entrada value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="Gerdau" className="w-48" /></Filtro>
      </div>

      {q.isError && <Aviso>{(q.error as Error).message}</Aviso>}
      {q.isPending ? <Carregando /> : q.data && <Conteudo d={q.data} />}
    </div>
  );
}

function Conteudo({ d }: { d: Dados }) {
  const r = d.resumo;
  const semanas = Math.max(1, r.dias_no_periodo / 7);
  const porCliente = useMemo(() => agruparPorCliente(d.cliente_vendedor), [d.cliente_vendedor]);
  const semRelato = d.por_vendedor.filter((v) => v.total === 0).length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <Kpi rotulo="Visitas no período" valor={r.relatos}
          detalhe={r.relatos ? `${r.por_voz} por voz · ${r.por_texto} por texto` : undefined} />
        <Kpi rotulo="Clientes visitados" valor={r.clientes} />
        <Kpi rotulo="Vendedores visitando" valor={`${r.vendedores_com_relato} de ${r.vendedores_ativos}`}
          detalhe={semRelato ? `${semRelato} sem nenhuma visita` : "todos com visita"} />
        <Kpi rotulo="Média por vendedor" valor={fmt.format(r.media_por_vendedor)} detalhe="visitas no período" />
        <Kpi rotulo="Média por semana" valor={fmt.format(r.relatos / semanas)} detalhe="visitas da equipe" />
        <Kpi rotulo={`Sem visita há ${DIAS_ALERTA}+ dias`} valor={d.clientes_sem_visita.length} detalhe="clientes" />
      </div>

      <Cartao titulo="Visitas por semana" subtitulo="Total da equipe em cada semana (segunda a domingo)">
        <Colunas dados={d.por_semana.map((s) => ({ rotulo: dataBR(s.inicio).slice(0, 5), valor: s.total, dica: `Semana de ${dataBR(s.inicio)}` }))} />
      </Cartao>

      <div className="grid gap-6 lg:grid-cols-2">
        <Cartao titulo="Quem visitou mais" subtitulo="Visitas por vendedor no período">
          <Barras vazio="Nenhum vendedor cadastrado."
            dados={d.por_vendedor.map((v) => ({
              rotulo: v.nome, valor: v.total,
              dica: v.total ? `${v.clientes} cliente(s) · última em ${dataBR(v.ultima!)}` : "Nenhuma visita no período",
            }))} />
        </Cartao>
        <Cartao titulo="Clientes mais visitados" subtitulo="Os 10 com mais visitas no período">
          <Barras vazio="Nenhuma visita no período."
            dados={d.top_clientes.map((c) => ({
              rotulo: c.cliente, valor: c.total, dica: `Por: ${c.vendedores.join(", ")} · última em ${dataBR(c.ultima)}`,
            }))} />
        </Cartao>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Cartao titulo="Quem visitou cada cliente" subtitulo="Vendedores e número de visitas por cliente no período">
          {porCliente.length === 0 ? <Vazio>Nenhuma visita no período.</Vazio> : (
            <Tabela cabecalho={["Cliente", "Vendedores", "Visitas", "Última"]}>
              {porCliente.map((c) => (
                <tr key={c.cliente}>
                  <td className="py-2.5 pr-3 font-medium">{c.cliente}</td>
                  <td className="py-2.5 pr-3">
                    <div className="flex flex-wrap gap-1">
                      {c.vendedores.map((v) => (
                        <span key={v.vendedor} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                          {v.vendedor} <span className="tabular-nums text-slate-500">· {v.total}</span>
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">{c.total}</td>
                  <td className="whitespace-nowrap py-2.5 tabular-nums text-slate-600">{dataBR(c.ultima)}</td>
                </tr>
              ))}
            </Tabela>
          )}
        </Cartao>

        <Cartao titulo={`Clientes sem visita há ${DIAS_ALERTA}+ dias`} subtitulo="Pela última visita registrada, considerando todo o histórico">
          {d.clientes_sem_visita.length === 0 ? <Vazio>Todos os clientes foram visitados nos últimos {DIAS_ALERTA} dias.</Vazio> : (
            <Tabela cabecalho={["Cliente", "Última visita", "Dias", "Último vendedor"]}>
              {d.clientes_sem_visita.map((c) => (
                <tr key={c.cliente}>
                  <td className="py-2.5 pr-3 font-medium">{c.cliente}</td>
                  <td className="whitespace-nowrap py-2.5 pr-3 tabular-nums text-slate-600">{dataBR(c.ultima)}</td>
                  <td className="py-2.5 pr-3"><Status dias={c.dias} /></td>
                  <td className="py-2.5">{c.vendedor}</td>
                </tr>
              ))}
            </Tabela>
          )}
        </Cartao>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ peças

function agruparPorCliente(linhas: Dados["cliente_vendedor"]) {
  const mapa = new Map<string, { cliente: string; total: number; ultima: string; vendedores: { vendedor: string; total: number }[] }>();
  for (const l of linhas) {
    const c = mapa.get(l.cliente) ?? { cliente: l.cliente, total: 0, ultima: l.ultima, vendedores: [] };
    c.total += l.total;
    if (l.ultima > c.ultima) c.ultima = l.ultima;
    c.vendedores.push({ vendedor: l.vendedor, total: l.total });
    mapa.set(l.cliente, c);
  }
  return [...mapa.values()].sort((a, b) => b.total - a.total || a.cliente.localeCompare(b.cliente, "pt-BR"));
}

function Filtro({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-500">{rotulo}</span>
      {children}
    </label>
  );
}

function Kpi({ rotulo, valor, detalhe }: { rotulo: string; valor: number | string; detalhe?: string }) {
  return (
    <div className="rounded-xl bg-white px-4 py-3 ring-1 ring-slate-200">
      <p className="text-xs text-slate-500">{rotulo}</p>
      <p className="mt-0.5 text-2xl font-semibold tabular-nums text-slate-900">{valor}</p>
      {detalhe && <p className="mt-0.5 text-xs text-slate-500">{detalhe}</p>}
    </div>
  );
}

function Cartao({ titulo, subtitulo, children }: { titulo: string; subtitulo: string; children: ReactNode }) {
  return (
    <section className="rounded-xl bg-white p-5 ring-1 ring-slate-200">
      <h2 className="text-base font-semibold text-slate-900">{titulo}</h2>
      <p className="mb-4 text-xs text-slate-500">{subtitulo}</p>
      {children}
    </section>
  );
}

function Vazio({ children }: { children: ReactNode }) {
  return <p className="py-8 text-center text-sm text-slate-500">{children}</p>;
}

function Tabela({ cabecalho, children }: { cabecalho: string[]; children: ReactNode }) {
  return (
    <div className="max-h-96 overflow-y-auto">
      <table className="w-full text-left text-sm">
        <thead className="sticky top-0 bg-white text-xs text-slate-500">
          <tr>
            {cabecalho.map((h) => (
              <th key={h} className={`border-b border-slate-200 pb-2 pr-3 font-medium ${h === "Visitas" ? "text-right" : ""}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    </div>
  );
}

function Status({ dias }: { dias: number }) {
  const critico = dias >= DIAS_ALERTA * 2;
  const Icone = critico ? CircleAlert : AlertTriangle;
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium tabular-nums ${critico ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-800"}`}>
      <Icone className="size-3.5" aria-hidden /> {dias} dias · {critico ? "crítico" : "atenção"}
    </span>
  );
}

function escalaBonita(max: number): number[] {
  if (max <= 0) return [0, 1];
  const bruto = max / 4;
  const pot = 10 ** Math.floor(Math.log10(bruto));
  const passo = Math.max(1, Math.round([1, 2, 5, 10].map((m) => m * pot).find((p) => p >= bruto)!));
  const ticks = [0];
  while (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + passo);
  return ticks;
}

interface Ponto {
  rotulo: string;
  valor: number;
  dica: string;
}

/** Barras horizontais (série única): rótulo à esquerda, valor na ponta. */
function Barras({ dados, vazio }: { dados: Ponto[]; vazio: string }) {
  const [foco, setFoco] = useState<number | null>(null);
  if (dados.length === 0) return <Vazio>{vazio}</Vazio>;
  const max = Math.max(1, ...dados.map((d) => d.valor));
  return (
    <ul className="space-y-1" aria-label="Gráfico de barras">
      {dados.map((d, i) => (
        <li key={d.rotulo + i} className="relative grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] items-center gap-3 rounded-md px-1 py-1 hover:bg-slate-50"
          onMouseEnter={() => setFoco(i)} onMouseLeave={() => setFoco(null)} tabIndex={0}
          onFocus={() => setFoco(i)} onBlur={() => setFoco(null)}
          aria-label={`${d.rotulo}: ${d.valor}. ${d.dica}`}>
          <span className="truncate text-sm text-slate-700" title={d.rotulo}>{d.rotulo}</span>
          <span className="flex items-center gap-2">
            <span className="h-4 rounded-r-[4px]" aria-hidden
              style={{ width: `${(d.valor / max) * 85}%`, minWidth: d.valor ? 4 : 0, background: COR_SERIE }} />
            <span className="text-sm font-medium tabular-nums text-slate-900">{d.valor}</span>
          </span>
          {foco === i && (
            <span role="tooltip" className="pointer-events-none absolute right-2 top-full z-10 mt-1 max-w-xs rounded-lg bg-slate-900 px-3 py-2 text-xs text-white shadow-lg">
              <strong className="block">{d.rotulo}: {d.valor} visita(s)</strong>{d.dica}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Colunas por semana (série única), com grade leve e dica ao passar o mouse. */
function Colunas({ dados }: { dados: Ponto[] }) {
  const [foco, setFoco] = useState<number | null>(null);
  const ticks = escalaBonita(Math.max(0, ...dados.map((d) => d.valor)));
  const topo = ticks[ticks.length - 1];
  const mostrarRotulo = (i: number) => dados.length <= 14 || i % Math.ceil(dados.length / 12) === 0;
  return (
    <div>
      <div className="relative flex h-56 pl-8">
        {ticks.map((t) => (
          <div key={t} className="absolute left-8 right-0 border-t border-slate-100" style={{ bottom: `${(t / topo) * 100}%` }}>
            <span className="absolute -left-8 -top-2 w-6 text-right text-[11px] tabular-nums text-slate-400">{t}</span>
          </div>
        ))}
        <div className="relative flex flex-1 items-end gap-0.5" role="img"
          aria-label={`Visitas por semana: ${dados.map((d) => `${d.dica}, ${d.valor}`).join("; ")}`}>
          {dados.map((d, i) => (
            <div key={d.dica} className="relative flex h-full flex-1 items-end justify-center"
              onMouseEnter={() => setFoco(i)} onMouseLeave={() => setFoco(null)}>
              <div className="w-full max-w-6 rounded-t-[4px] transition-opacity"
                style={{ height: `${(d.valor / topo) * 100}%`, minHeight: d.valor ? 3 : 0, background: COR_SERIE, opacity: foco === null || foco === i ? 1 : 0.45 }} />
              {foco === i && (
                <span role="tooltip" className={`pointer-events-none absolute bottom-full z-10 mb-2 whitespace-nowrap rounded-lg bg-slate-900 px-3 py-2 text-xs text-white shadow-lg ${
                  i > dados.length * 0.7 ? "right-0" : i < dados.length * 0.3 ? "left-0" : ""}`}>
                  <strong className="block">{d.valor} visita(s)</strong>{d.dica}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-1 flex gap-0.5 pl-8">
        {dados.map((d, i) => (
          <span key={d.dica} className="flex-1 text-center text-[11px] tabular-nums text-slate-400">{mostrarRotulo(i) ? d.rotulo : ""}</span>
        ))}
      </div>
    </div>
  );
}
