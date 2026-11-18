// Aba Relatórios do gerente: todos os relatos com filtros, detalhe e exportação.
import { useDeferredValue, useState, type ReactNode } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Download, Keyboard, Mic, Search, X } from "lucide-react";
import { api, dataBR, dataHoraBR, hojeISO, isoDe, type FiltrosRelatos, type Relato } from "../api";
import { Aviso, Carregando, Faixa, estiloEntradaEscura } from "../ui";

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
    <>
      <Faixa titulo="Relatórios de visita" subtitulo="Tudo o que os vendedores enviaram pelo app."
        acao={
          <a href={api.urlExcel(filtros)} download
            className="inline-flex h-12 items-center gap-2 rounded-md bg-marca-700 px-5 font-titulo text-[13px] font-bold uppercase tracking-wider text-white hover:bg-marca-800">
            <Download className="size-4" aria-hidden /> Exportar Excel
          </a>
        }>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          <Filtro rotulo="De"><input type="date" value={inicio} max={fim || undefined} onChange={(e) => setInicio(e.target.value)} className={estiloEntradaEscura} /></Filtro>
          <Filtro rotulo="Até"><input type="date" value={fim} min={inicio || undefined} onChange={(e) => setFim(e.target.value)} className={estiloEntradaEscura} /></Filtro>
          <Filtro rotulo="Vendedor">
            <select value={vendedorId} onChange={(e) => setVendedorId(e.target.value ? Number(e.target.value) : "")} className={estiloEntradaEscura}>
              <option value="">Todos</option>
              {vendedores.map((v) => <option key={v.id} value={v.id}>{v.nome}{v.ativo ? "" : " (inativo)"}</option>)}
            </select>
          </Filtro>
          <Filtro rotulo="Cliente"><input value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="Gerdau" className={estiloEntradaEscura} /></Filtro>
          <Filtro rotulo="Buscar na ata">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-aco-500" aria-hidden />
              <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="tesoura rotativa" className={`${estiloEntradaEscura} pl-9`} />
            </div>
          </Filtro>
          <Filtro rotulo={" "}>
            <button onClick={limpar} className="h-11 w-full rounded-md bg-white/10 font-titulo text-[13px] font-bold uppercase tracking-wider text-white hover:bg-white/15">Limpar</button>
          </Filtro>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Metrica destaque rotulo="Relatos no período" valor={lista.data?.total} />
          <Metrica rotulo="Clientes visitados" valor={lista.data?.clientes} />
          <Metrica rotulo="Vendedores com relato" valor={lista.data?.vendedores} />
        </div>
      </Faixa>

      <div className="mx-auto -mt-4 max-w-7xl px-4 pb-10 md:px-8">
        {lista.isError && <Aviso>{(lista.error as Error).message}</Aviso>}
        {lista.isPending ? <Carregando /> : lista.data && (
          <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
            {lista.data.itens.length === 0 ? (
              <p className="p-10 text-center text-sm text-neutral-500">Nenhum relato encontrado com esses filtros.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-neutral-50">
                    <tr className="font-titulo text-[11px] uppercase tracking-wider text-neutral-500">
                      <th className="px-4 py-3 font-bold">Data</th>
                      <th className="px-4 py-3 font-bold">Vendedor</th>
                      <th className="px-4 py-3 font-bold">Cliente</th>
                      <th className="px-4 py-3 font-bold">Cidade</th>
                      <th className="px-4 py-3 font-bold">Contato</th>
                      <th className="hidden px-4 py-3 font-bold xl:table-cell">Ata</th>
                      <th className="w-10 px-4 py-3 font-bold" aria-label="Origem" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {lista.data.itens.map((r) => (
                      <tr key={r.id} onClick={() => setAberto(r)} tabIndex={0}
                        onKeyDown={(e) => e.key === "Enter" && setAberto(r)}
                        className="h-12 cursor-pointer hover:bg-marca-50/60 focus:bg-marca-50 focus:outline-none">
                        <td className="whitespace-nowrap px-4 tabular-nums">{dataBR(r.data)}</td>
                        <td className="whitespace-nowrap px-4">{r.vendedor_nome}</td>
                        <td className="px-4 font-semibold">{r.cliente}</td>
                        <td className="px-4">{r.cidade}</td>
                        <td className="px-4">{r.contato}</td>
                        <td className="hidden max-w-md truncate px-4 text-neutral-500 xl:table-cell">{r.ata}</td>
                        <td className="px-4 text-neutral-400" title={r.origem === "texto" ? "Relato por texto" : "Relato por voz"}>
                          {r.origem === "texto" ? <Keyboard className="size-4" aria-label="Texto" /> : <Mic className="size-4" aria-label="Voz" />}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {lista.data.total > lista.data.itens.length && (
              <p className="border-t border-neutral-100 px-4 py-3 text-xs text-neutral-500">
                Mostrando os {lista.data.itens.length} mais recentes de {lista.data.total}. Use os filtros ou exporte o Excel para ver todos.
              </p>
            )}
          </div>
        )}
      </div>

      {aberto && <Detalhe relato={aberto} aoFechar={() => setAberto(null)} />}
    </>
  );
}

function Metrica({ rotulo, valor, destaque }: { rotulo: string; valor?: number; destaque?: boolean }) {
  return (
    <div className={`flex h-24 flex-col justify-between rounded-xl border p-4 ${destaque ? "border-marca-700 bg-marca-700" : "border-white/10 bg-black/30"}`}>
      <p className={`text-xs ${destaque ? "text-marca-100" : "text-aco-500"}`}>{rotulo}</p>
      <p className="font-titulo text-[26px] font-extrabold leading-none tabular-nums text-white">{valor ?? "–"}</p>
    </div>
  );
}

function Filtro({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-xs font-semibold text-aco-500">{rotulo}</span>
      {children}
    </label>
  );
}

function Detalhe({ relato: r, aoFechar }: { relato: Relato; aoFechar: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-aco-900/50" onClick={aoFechar}>
      <aside role="dialog" aria-modal="true" aria-label={`Relato ${r.cliente}`}
        className="flex h-full w-full max-w-xl flex-col overflow-y-auto bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="escovado sticky top-0 flex items-start justify-between gap-4 px-6 py-5">
          <div>
            <h2 className="text-xl text-white">{r.cliente}</h2>
            <p className="text-sm text-aco-500">{[r.cidade, dataBR(r.data)].filter(Boolean).join(" · ")}</p>
          </div>
          <button onClick={aoFechar} className="flex size-9 items-center justify-center rounded-md bg-white/10 hover:bg-white/20" aria-label="Fechar">
            <X className="size-4" />
          </button>
        </div>
        <div className="space-y-6 px-6 py-5">
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <Item rotulo="Vendedor" valor={r.vendedor_nome} />
            <Item rotulo="Contato" valor={r.contato || "–"} />
            <Item rotulo="Registrado em" valor={dataHoraBR(r.criado_em)} />
            <Item rotulo="Origem" valor={r.origem === "texto" ? "Texto" : "Voz"} />
          </dl>
          <Bloco titulo="Ata de reunião"><p className="whitespace-pre-wrap leading-relaxed">{r.ata || "–"}</p></Bloco>
          {r.tem_audio && (
            <Bloco titulo="Áudio original"><audio controls preload="none" src={api.urlAudio(r.id)} className="w-full" /></Bloco>
          )}
          {r.transcricao && (
            <Bloco titulo={r.origem === "texto" ? "Texto digitado" : "Transcrição"}>
              <p className="whitespace-pre-wrap rounded-md bg-neutral-100 p-4 text-sm leading-relaxed text-neutral-700">{r.transcricao}</p>
            </Bloco>
          )}
        </div>
      </aside>
    </div>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 font-titulo text-[11px] font-bold uppercase tracking-wider text-marca-700">{titulo}</h3>
      {children}
    </section>
  );
}

function Item({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <dt className="text-xs text-neutral-500">{rotulo}</dt>
      <dd className="font-semibold">{valor}</dd>
    </div>
  );
}
