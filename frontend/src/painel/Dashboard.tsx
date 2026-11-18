// Aba Dashboard do gerente: indicadores de visitas por período, vendedor e cliente.
// Gráficos em HTML/CSS puro (sem biblioteca): série única no vermelho da marca,
// barras finas, valor na ponta e dica ao passar o mouse.
import { useDeferredValue, useMemo, useState, type ReactNode } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { AlertTriangle, CircleAlert, Download } from "lucide-react";
import { api, dataBR, hojeISO, isoDe, type Dashboard as Dados } from "../api";
import { Aviso, Cartao, Carregando, Faixa, estiloEntradaEscura } from "../ui";

const COR_SERIE = "#be0a0f"; // vermelho Açokorte (validado no guia de dataviz sobre fundo claro)
const DIAS_ALERTA = 30;

function diasAtras(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return isoDe(d);
}

const PERIODOS = [
  { rotulo: "30 dias", inicio: () => diasAtras(29) },
  { rotulo: "90 dias", inicio: () => diasAtras(89) },
  { rotulo: "Ano", inicio: () => `${new Date().getFullYear()}-01-01` },
];

const fmt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

export default function Dashboard() {
  const [inicio, setInicio] = useState(diasAtras(89));
  const [fim, setFim] = useState(hojeISO());
  const [vendedorId, setVendedorId] = useState<number | "">("");
  const [cliente, setCliente] = useState("");

  const filtros = { inicio, fim, vendedor_id: vendedorId, cliente: useDeferredValue(cliente) };
  const q = useQuery({
    queryKey: ["dashboard", filtros],
    queryFn: () => api.dashboard({ ...filtros, dias_alerta: DIAS_ALERTA }),
    placeholderData: keepPreviousData,
  });
  const usuarios = useQuery({ queryKey: ["usuarios"], queryFn: api.usuarios });
  const vendedores = (usuarios.data ?? []).filter((u) => u.perfil === "vendedor");

  return (
    <>
      <Faixa titulo="Dashboard de visitas" subtitulo="Quem está visitando, quais clientes e com que frequência."
        acao={
          <a href={api.urlExcel(filtros)} download
            className="inline-flex h-12 items-center gap-2 rounded-md bg-marca-700 px-5 font-titulo text-[13px] font-bold uppercase tracking-wider text-white hover:bg-marca-800">
            <Download className="size-4" aria-hidden /> Exportar Excel
          </a>
        }>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
          <Filtro rotulo="Período">
            <div className="grid h-11 grid-cols-3 gap-1 rounded-md bg-white/10 p-1" role="group" aria-label="Período rápido">
              {PERIODOS.map((p) => {
                const ativo = inicio === p.inicio() && fim === hojeISO();
                return (
                  <button key={p.rotulo} onClick={() => { setInicio(p.inicio()); setFim(hojeISO()); }} aria-pressed={ativo}
                    className={`rounded text-xs font-semibold ${ativo ? "bg-marca-600 text-white" : "text-aco-500 hover:text-white"}`}>
                    {p.rotulo}
                  </button>
                );
              })}
            </div>
          </Filtro>
          <Filtro rotulo="De"><input type="date" value={inicio} max={fim} onChange={(e) => setInicio(e.target.value)} className={estiloEntradaEscura} /></Filtro>
          <Filtro rotulo="Até"><input type="date" value={fim} min={inicio} onChange={(e) => setFim(e.target.value)} className={estiloEntradaEscura} /></Filtro>
          <Filtro rotulo="Vendedor">
            <select value={vendedorId} onChange={(e) => setVendedorId(e.target.value ? Number(e.target.value) : "")} className={estiloEntradaEscura}>
              <option value="">Todos</option>
              {vendedores.map((v) => <option key={v.id} value={v.id}>{v.nome}{v.ativo ? "" : " (inativo)"}</option>)}
            </select>
          </Filtro>
          <Filtro rotulo="Cliente"><input value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="Buscar cliente" className={estiloEntradaEscura} /></Filtro>
        </div>
        {q.data && <Kpis d={q.data} />}
      </Faixa>

      <div className="mx-auto -mt-4 max-w-7xl px-4 pb-10 md:px-8">
        {q.isError && <Aviso>{(q.error as Error).message}</Aviso>}
        {q.isPending ? <Carregando /> : q.data && <Conteudo d={q.data} />}
      </div>
    </>
  );
}

function Kpis({ d }: { d: Dados }) {
  const r = d.resumo;
  const semanas = Math.max(1, r.dias_no_periodo / 7);
  const semRelato = d.por_vendedor.filter((v) => v.total === 0).length;
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
      <Kpi destaque rotulo="Visitas no período" valor={r.relatos} detalhe={`${r.por_voz} voz · ${r.por_texto} texto`} />
      <Kpi rotulo="Clientes visitados" valor={r.clientes} detalhe="no período" />
      <Kpi rotulo="Vendedores visitando" valor={`${r.vendedores_com_relato} de ${r.vendedores_ativos}`}
        detalhe={semRelato ? `${semRelato} sem visita` : "todos com visita"} />
      <Kpi rotulo="Média por vendedor" valor={fmt.format(r.media_por_vendedor)} detalhe="visitas no período" />
      <Kpi rotulo="Média por semana" valor={fmt.format(r.relatos / semanas)} detalhe="visitas da equipe" />
      <Kpi rotulo={`Sem visita há ${DIAS_ALERTA}+ dias`} valor={d.clientes_sem_visita.length} detalhe="clientes" />
    </div>
  );
}

function Conteudo({ d }: { d: Dados }) {
  const porCliente = useMemo(() => agruparPorCliente(d.cliente_vendedor), [d.cliente_vendedor]);
  return (
    <div className="flex flex-col gap-6">
      <Cartao titulo="Visitas por semana" subtitulo="Total da equipe em cada semana (segunda a domingo)" selo={`${d.por_semana.length} semanas`}>
        <Colunas dados={d.por_semana.map((s) => ({ rotulo: dataBR(s.inicio).slice(0, 5), valor: s.total, dica: `Semana de ${dataBR(s.inicio)}` }))} />
      </Cartao>

      <div className="grid gap-6 lg:grid-cols-2">
        <Cartao titulo="Quem visitou mais" subtitulo="Ranking de vendedores no período" selo="Vendedores">
          <Ranking vazio="Nenhum vendedor cadastrado."
            dados={d.por_vendedor.map((v) => ({
              rotulo: v.nome, valor: v.total,
              dica: v.total ? `${v.clientes} cliente(s) · última em ${dataBR(v.ultima!)}` : "Nenhuma visita no período",
            }))} />
        </Cartao>
        <Cartao titulo="Clientes mais visitados" subtitulo="Os 10 com mais visitas no período" selo="Clientes">
          <Ranking vazio="Nenhuma visita no período."
            dados={d.top_clientes.map((c) => ({
              rotulo: c.cliente, valor: c.total, dica: `Por: ${c.vendedores.join(", ")} · última em ${dataBR(c.ultima)}`,
            }))} />
        </Cartao>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Cartao titulo="Quem visitou cada cliente" subtitulo="Vendedores e número de visitas por cliente no período" selo="Cobertura">
          {porCliente.length === 0 ? <Vazio>Nenhuma visita no período.</Vazio> : (
            <Tabela cabecalho={["Cliente", "Vendedores", "Visitas", "Última"]}>
              {porCliente.map((c) => (
                <tr key={c.cliente}>
                  <td className="py-2.5 pr-3 font-semibold">{c.cliente}</td>
                  <td className="py-2.5 pr-3">
                    <div className="flex flex-wrap gap-1">
                      {c.vendedores.map((v) => (
                        <span key={v.vendedor} className="rounded bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700">
                          {v.vendedor} <span className="tabular-nums text-neutral-500">· {v.total}</span>
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">{c.total}</td>
                  <td className="whitespace-nowrap py-2.5 tabular-nums text-neutral-600">{dataBR(c.ultima)}</td>
                </tr>
              ))}
            </Tabela>
          )}
        </Cartao>

        <Cartao titulo={`Clientes sem visita há ${DIAS_ALERTA}+ dias`} subtitulo="Pela última visita registrada, em todo o histórico" selo="Alerta">
          {d.clientes_sem_visita.length === 0 ? <Vazio>Todos os clientes foram visitados nos últimos {DIAS_ALERTA} dias.</Vazio> : (
            <Tabela cabecalho={["Cliente", "Última visita", "Situação", "Último vendedor"]}>
              {d.clientes_sem_visita.map((c) => (
                <tr key={c.cliente}>
                  <td className="py-2.5 pr-3 font-semibold">{c.cliente}</td>
                  <td className="whitespace-nowrap py-2.5 pr-3 tabular-nums text-neutral-600">{dataBR(c.ultima)}</td>
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
    <label className="block min-w-0">
      <span className="mb-1 block text-xs font-semibold text-aco-500">{rotulo}</span>
      {children}
    </label>
  );
}

function Kpi({ rotulo, valor, detalhe, destaque }: { rotulo: string; valor: number | string; detalhe: string; destaque?: boolean }) {
  return (
    <div className={`flex h-[120px] flex-col justify-between rounded-xl border p-4 ${
      destaque ? "border-marca-700 bg-marca-700" : "border-white/10 bg-black/30"}`}>
      <p className={`min-h-[2.6em] text-xs leading-[1.3] ${destaque ? "text-marca-100" : "text-aco-500"}`}>{rotulo}</p>
      <p className="whitespace-nowrap font-titulo text-[26px] font-extrabold leading-none tabular-nums text-white">{valor}</p>
      <p className={`text-[11px] ${destaque ? "text-marca-100" : "text-aco-500"}`}>{detalhe}</p>
    </div>
  );
}

function Vazio({ children }: { children: ReactNode }) {
  return <p className="py-8 text-center text-sm text-neutral-500">{children}</p>;
}

function Tabela({ cabecalho, children }: { cabecalho: string[]; children: ReactNode }) {
  return (
    <div className="max-h-96 overflow-y-auto">
      <table className="w-full text-left text-sm">
        <thead className="sticky top-0 bg-white">
          <tr>
            {cabecalho.map((h) => (
              <th key={h} className={`border-b border-neutral-200 pb-2 pr-3 font-titulo text-[11px] font-bold uppercase tracking-wider text-neutral-500 ${h === "Visitas" ? "text-right" : ""}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">{children}</tbody>
      </table>
    </div>
  );
}

function Status({ dias }: { dias: number }) {
  const critico = dias >= DIAS_ALERTA * 2;
  const Icone = critico ? CircleAlert : AlertTriangle;
  return (
    <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-bold tabular-nums ${critico ? "bg-marca-50 text-marca-800" : "bg-amber-50 text-amber-800"}`}>
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

/** Ranking (série única): posição, nome, barra fina e valor; o 1º lugar em vermelho. */
function Ranking({ dados, vazio }: { dados: Ponto[]; vazio: string }) {
  const [foco, setFoco] = useState<number | null>(null);
  if (dados.length === 0) return <Vazio>{vazio}</Vazio>;
  const max = Math.max(1, ...dados.map((d) => d.valor));
  return (
    <ol className="divide-y divide-neutral-100" aria-label="Ranking">
      {dados.map((d, i) => (
        <li key={d.rotulo + i} tabIndex={0}
          className="relative grid grid-cols-[28px_minmax(0,1fr)_40px] items-center gap-x-3 gap-y-1.5 rounded py-2 outline-none hover:bg-neutral-50 focus-visible:bg-neutral-50"
          onMouseEnter={() => setFoco(i)} onMouseLeave={() => setFoco(null)} onFocus={() => setFoco(i)} onBlur={() => setFoco(null)}
          aria-label={`${i + 1}º ${d.rotulo}: ${d.valor}. ${d.dica}`}>
          <span className={`row-span-2 flex size-7 items-center justify-center rounded-full font-titulo text-xs font-extrabold ${
            i === 0 && d.valor > 0 ? "bg-marca-700 text-white" : "bg-neutral-200 text-grafite"}`}>{i + 1}</span>
          <span className="truncate text-sm font-semibold" title={d.rotulo}>{d.rotulo}</span>
          <b className="row-span-2 text-right font-titulo text-base font-extrabold tabular-nums text-neutral-900">{d.valor}</b>
          <span className="h-1.5 rounded-full bg-neutral-100" aria-hidden>
            <span className="block h-full rounded-full" style={{ width: `${(d.valor / max) * 100}%`, background: COR_SERIE }} />
          </span>
          {foco === i && (
            <span role="tooltip" className="pointer-events-none absolute right-12 top-full z-10 mt-1 max-w-xs rounded-md bg-aco-900 px-3 py-2 text-xs text-white shadow-lg">
              <strong className="block">{d.rotulo}: {d.valor} visita(s)</strong>{d.dica}
            </span>
          )}
        </li>
      ))}
    </ol>
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
          <div key={t} className="absolute left-8 right-0 border-t border-neutral-200" style={{ bottom: `${(t / topo) * 100}%` }}>
            <span className="absolute -left-8 -top-2 w-6 text-right text-[11px] tabular-nums text-neutral-400">{t}</span>
          </div>
        ))}
        <div className="relative flex flex-1 items-end gap-1.5" role="img"
          aria-label={`Visitas por semana: ${dados.map((d) => `${d.dica}, ${d.valor}`).join("; ")}`}>
          {dados.map((d, i) => (
            <div key={d.dica} className="relative flex h-full flex-1 items-end justify-center"
              onMouseEnter={() => setFoco(i)} onMouseLeave={() => setFoco(null)}>
              <div className="w-full max-w-6 rounded-t transition-opacity"
                style={{ height: `${(d.valor / topo) * 100}%`, minHeight: d.valor ? 3 : 0, background: COR_SERIE, opacity: foco === null || foco === i ? 1 : 0.45 }} />
              {foco === i && (
                <span role="tooltip" className={`pointer-events-none absolute bottom-full z-10 mb-2 whitespace-nowrap rounded-md bg-aco-900 px-3 py-2 text-xs text-white shadow-lg ${
                  i > dados.length * 0.7 ? "right-0" : i < dados.length * 0.3 ? "left-0" : ""}`}>
                  <strong className="block">{d.valor} visita(s)</strong>{d.dica}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-1 flex gap-1.5 pl-8">
        {dados.map((d, i) => (
          <span key={d.dica} className="flex-1 text-center text-[11px] tabular-nums text-neutral-400">{mostrarRotulo(i) ? d.rotulo : ""}</span>
        ))}
      </div>
    </div>
  );
}
