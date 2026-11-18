import { useDeferredValue, useState, type ReactNode } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Download, Search, X } from "lucide-react";
import { api, dataBR, dataHoraBR, hojeISO, isoDe, type FiltrosRelatos, type Relato } from "../api";
import { Aviso, Carregando, Entrada } from "../ui";

function primeiroDiaDoMes(): string {
  const d = new Date();
  return isoDe(new Date(d.getFullYear(), d.getMonth(), 1));
}

export default function Relatorios() {
  const [inicio, setInicio] = useState(primeiroDiaDoMes());
  const [fim, setFim] = useState(hojeISO());
  const [vendedorId, setVendedorId] = useState<number | "">("");
  const [cliente, setCliente] = useState("");
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState<Relato | null>(null);

  const filtros: FiltrosRelatos = {
    inicio, fim, vendedor_id: vendedorId,
    cliente: useDeferredValue(cliente), busca: useDeferredValue(busca),
  };
  const lista = useQuery({
    queryKey: ["relatos", filtros],
    queryFn: () => api.relatos({ ...filtros, limite: 500 }),
    placeholderData: keepPreviousData,
  });
  const usuarios = useQuery({ queryKey: ["usuarios"], queryFn: api.usuarios });
  const vendedores = (usuarios.data ?? []).filter((u) => u.perfil === "vendedor");

  const limpar = () => {
    setInicio(primeiroDiaDoMes()); setFim(hojeISO()); setVendedorId(""); setCliente(""); setBusca("");
  };

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Relatórios de visita</h1>
          <p className="text-sm text-slate-500">Tudo o que os vendedores enviaram pelo app.</p>
        </div>
        <a href={api.urlExcel(filtros)} download
          className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-slate-800 ring-1 ring-slate-300 hover:bg-slate-50">
          <Download className="size-4" aria-hidden /> Exportar Excel
        </a>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Metrica rotulo="Relatos no período" valor={lista.data?.total} />
        <Metrica rotulo="Clientes visitados" valor={lista.data?.clientes} />
        <Metrica rotulo="Vendedores com relato" valor={lista.data?.vendedores} />
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 rounded-xl bg-white p-4 ring-1 ring-slate-200 md:grid-cols-3 2xl:grid-cols-[repeat(2,minmax(10rem,auto))_repeat(2,minmax(0,1fr))_minmax(0,1.4fr)_auto]">
        <Filtro rotulo="De"><Entrada type="date" value={inicio} max={fim || undefined} onChange={(e) => setInicio(e.target.value)} /></Filtro>
        <Filtro rotulo="Até"><Entrada type="date" value={fim} min={inicio || undefined} onChange={(e) => setFim(e.target.value)} /></Filtro>
        <Filtro rotulo="Vendedor">
          <select value={vendedorId} onChange={(e) => setVendedorId(e.target.value ? Number(e.target.value) : "")}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base focus:border-aco-600 focus:outline-none focus:ring-2 focus:ring-aco-100">
            <option value="">Todos</option>
            {vendedores.map((v) => <option key={v.id} value={v.id}>{v.nome}{v.ativo ? "" : " (inativo)"}</option>)}
          </select>
        </Filtro>
        <Filtro rotulo="Cliente"><Entrada value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="Gerdau" /></Filtro>
        <Filtro rotulo="Buscar na ata">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <Entrada value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="chapa grossa" className="pl-9" />
          </div>
        </Filtro>
        <div className="col-span-2 flex items-end md:col-span-1">
          <button onClick={limpar} className="rounded-lg px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-100">Limpar</button>
        </div>
      </div>

      {lista.isError && <Aviso>{(lista.error as Error).message}</Aviso>}
      {lista.isPending ? <Carregando /> : lista.data && (
        <div className="overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
          {lista.data.itens.length === 0 ? (
            <p className="p-10 text-center text-sm text-slate-500">Nenhum relato encontrado com esses filtros.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Data</th>
                    <th className="px-4 py-3 font-medium">Vendedor</th>
                    <th className="px-4 py-3 font-medium">Cliente</th>
                    <th className="px-4 py-3 font-medium">Cidade</th>
                    <th className="px-4 py-3 font-medium">Contato</th>
                    <th className="hidden px-4 py-3 font-medium xl:table-cell">Ata</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lista.data.itens.map((r) => (
                    <tr key={r.id} onClick={() => setAberto(r)} tabIndex={0}
                      onKeyDown={(e) => e.key === "Enter" && setAberto(r)}
                      className="cursor-pointer hover:bg-aco-50/60 focus:bg-aco-50 focus:outline-none">
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums">{dataBR(r.data)}</td>
                      <td className="whitespace-nowrap px-4 py-3">{r.vendedor_nome}</td>
                      <td className="px-4 py-3 font-medium">{r.cliente}</td>
                      <td className="px-4 py-3">{r.cidade}</td>
                      <td className="px-4 py-3">{r.contato}</td>
                      <td className="hidden max-w-md truncate px-4 py-3 text-slate-500 xl:table-cell">{r.ata}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {lista.data.total > lista.data.itens.length && (
            <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
              Mostrando os {lista.data.itens.length} mais recentes de {lista.data.total}. Use os filtros ou exporte o Excel para ver todos.
            </p>
          )}
        </div>
      )}

      {aberto && <Detalhe relato={aberto} aoFechar={() => setAberto(null)} />}
    </div>
  );
}

function Metrica({ rotulo, valor }: { rotulo: string; valor?: number }) {
  return (
    <div className="rounded-xl bg-white px-4 py-3 ring-1 ring-slate-200">
      <p className="text-xs text-slate-500">{rotulo}</p>
      <p className="text-2xl font-semibold tabular-nums">{valor ?? "–"}</p>
    </div>
  );
}

function Filtro({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-xs font-medium text-slate-500">{rotulo}</span>
      {children}
    </label>
  );
}

function Detalhe({ relato: r, aoFechar }: { relato: Relato; aoFechar: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/40" onClick={aoFechar}>
      <aside role="dialog" aria-modal="true" aria-label={`Relato ${r.cliente}`}
        className="flex h-full w-full max-w-xl flex-col overflow-y-auto bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 flex items-start justify-between gap-4 border-b border-slate-100 bg-white px-6 py-5">
          <div>
            <h2 className="text-xl font-semibold">{r.cliente}</h2>
            <p className="text-sm text-slate-500">{[r.cidade, dataBR(r.data)].filter(Boolean).join(" · ")}</p>
          </div>
          <button onClick={aoFechar} className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label="Fechar">
            <X className="size-5" />
          </button>
        </div>
        <div className="space-y-6 px-6 py-5">
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <Item rotulo="Vendedor" valor={r.vendedor_nome} />
            <Item rotulo="Contato" valor={r.contato || "–"} />
            <Item rotulo="Registrado em" valor={dataHoraBR(r.criado_em)} />
          </dl>
          <section>
            <h3 className="mb-2 text-sm font-medium text-slate-500">Ata de reunião</h3>
            <p className="whitespace-pre-wrap leading-relaxed">{r.ata || "–"}</p>
          </section>
          {r.tem_audio && (
            <section>
              <h3 className="mb-2 text-sm font-medium text-slate-500">Áudio original</h3>
              <audio controls preload="none" src={api.urlAudio(r.id)} className="w-full" />
            </section>
          )}
          {r.transcricao && (
            <section>
              <h3 className="mb-2 text-sm font-medium text-slate-500">Transcrição</h3>
              <p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">{r.transcricao}</p>
            </section>
          )}
        </div>
      </aside>
    </div>
  );
}

function Item({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{rotulo}</dt>
      <dd className="font-medium">{valor}</dd>
    </div>
  );
}
