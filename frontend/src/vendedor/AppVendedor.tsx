// App do vendedor (identidade Açokorte, protótipo B "Aço escuro"):
// início -> (voz: instrução -> gravação -> formulário preenchido pela IA | texto: formulário em branco) -> enviado.
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ChevronRight, Keyboard, LoaderCircle, LogOut, Mic, Paperclip, Square } from "lucide-react";
import { api, dataBR, hojeISO, isoDe, type Rascunho } from "../api";
import { Simbolo } from "../marca";
import { useSessao } from "../sessao";
import { AreaTexto, Aviso, Botao, Campo, Entrada, Modal } from "../ui";
import { extensaoDe, relogio, useGravador } from "./gravador";

type Etapa = "inicio" | "gravar" | "processando" | "formulario" | "enviado";

interface Formulario extends Rascunho {
  data: string;
}

const INSTRUCAO =
  "Relate qual cliente foi visitado, a cidade, quem foi o contato com quem você conversou e qual o assunto tratado.";

function segundaFeira(): string {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return isoDe(d);
}

function primeiroDoMes(): string {
  const d = new Date();
  return isoDe(new Date(d.getFullYear(), d.getMonth(), 1));
}

export default function AppVendedor() {
  const { usuario, sair } = useSessao();
  const qc = useQueryClient();
  const chave = `relata_rascunho_${usuario!.id}`;

  const [etapa, setEtapa] = useState<Etapa>("inicio");
  const [instrucao, setInstrucao] = useState(false);
  const [erro, setErro] = useState("");
  const [form, setForm] = useState<Formulario | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [ultimoCliente, setUltimoCliente] = useState("");
  const arquivo = useRef<HTMLInputElement>(null);

  // Rascunho não enviado (app fechado no meio, sem sinal etc.) volta ao abrir
  useEffect(() => {
    const salvo = localStorage.getItem(chave);
    if (salvo) {
      try {
        setForm(JSON.parse(salvo));
        setEtapa("formulario");
      } catch {
        localStorage.removeItem(chave);
      }
    }
  }, [chave]);

  useEffect(() => {
    if (form) localStorage.setItem(chave, JSON.stringify(form));
  }, [form, chave]);

  const naInicial = etapa === "inicio" || etapa === "enviado";
  const recentes = useQuery({ queryKey: ["meus-relatos"], queryFn: () => api.relatos({ limite: 5 }), enabled: naInicial });
  const contagem = (inicio: string) => ({
    queryKey: ["meus-relatos-desde", inicio],
    queryFn: () => api.relatos({ inicio, limite: 1 }),
    enabled: naInicial,
  });
  const hoje = useQuery(contagem(hojeISO()));
  const semana = useQuery(contagem(segundaFeira()));
  const mes = useQuery(contagem(primeiroDoMes()));

  async function processar(audio: Blob, nome?: string) {
    setEtapa("processando");
    setErro("");
    try {
      const r = await api.transcrever(audio, nome ?? `relato${extensaoDe(audio.type)}`);
      setForm({ ...r, data: hojeISO() });
      setEtapa("formulario");
    } catch (e) {
      setErro((e as Error).message);
      setEtapa("gravar");
    }
  }

  const grav = useGravador((audio) => processar(audio));

  // Relato por texto: abre direto o formulário completo, em branco, para o vendedor preencher.
  function abrirFormularioEmBranco() {
    setErro("");
    setForm({ audio_id: "", transcricao: "", cliente: "", cidade: "", contato: "", ata: "", data: hojeISO() });
    setEtapa("formulario");
  }

  function escolherArquivo(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) processar(f, f.name);
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    if (!form.cliente.trim()) {
      setErro("Informe o cliente antes de enviar.");
      return;
    }
    setErro("");
    setEnviando(true);
    try {
      await api.enviarRelato(form);
      localStorage.removeItem(chave);
      setUltimoCliente(form.cliente);
      setForm(null);
      setEtapa("enviado");
      qc.invalidateQueries({ queryKey: ["meus-relatos"] });
      qc.invalidateQueries({ queryKey: ["meus-relatos-desde"] });
    } catch (err) {
      setErro(`${(err as Error).message} O relato continua salvo neste celular.`);
    } finally {
      setEnviando(false);
    }
  }

  function descartar() {
    const perde = form?.audio_id ? "O que foi gravado será perdido." : "O que foi preenchido será perdido.";
    if (!confirm(`Descartar este relato? ${perde}`)) return;
    localStorage.removeItem(chave);
    setForm(null);
    setErro("");
    setEtapa("inicio");
  }

  const voltarAoInicio = () => { grav.cancelar(); setErro(""); setEtapa("inicio"); };
  const set = (campo: keyof Formulario) => (e: { target: { value: string } }) =>
    setForm((f) => (f ? { ...f, [campo]: e.target.value } : f));

  const escura = etapa === "gravar" || etapa === "processando";
  const porTexto = etapa === "formulario" && !!form && !form.audio_id;
  const subtitulo = {
    inicio: "Vendedor externo", enviado: "Vendedor externo",
    gravar: grav.estado === "gravando" ? "Gravando…" : "Relato por voz", processando: "Montando o relatório…",
    formulario: porTexto ? "Relato por texto" : "Toque para corrigir",
  }[etapa];
  const tituloTopo = naInicial ? `Olá, ${usuario!.nome.split(" ")[0]}`
    : etapa === "formulario" ? (porTexto ? "Preencha o relatório" : "Confira o relatório") : "Relato de visita";

  return (
    <div className={`mx-auto flex min-h-full max-w-lg flex-col sm:my-6 sm:min-h-0 sm:overflow-hidden sm:rounded-3xl sm:shadow-lg ${escura ? "bg-aco-900" : "bg-neutral-100"}`}>
      {/* topo em aço escovado */}
      <header className="escovado flex-none">
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-4 pt-[max(1rem,env(safe-area-inset-top))]">
          <Simbolo altura={24} />
          <div className="min-w-0">
            <p className="truncate font-titulo text-[15px] font-bold">{tituloTopo}</p>
            <p className="text-xs text-aco-500">{subtitulo}</p>
          </div>
          <button onClick={sair} className="flex size-9 items-center justify-center rounded-md bg-white/10 hover:bg-white/15" aria-label="Sair">
            <LogOut className="size-4" />
          </button>
        </div>
        {naInicial && (
          <div className="grid grid-cols-3 gap-2 px-4 pb-4">
            <Numero rotulo="Hoje" valor={hoje.data?.total} />
            <Numero rotulo="Semana" valor={semana.data?.total} />
            <Numero rotulo="Mês" valor={mes.data?.total} />
          </div>
        )}
      </header>

      <main className="flex flex-1 flex-col gap-4 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {/* ---------------------------------------------------------- início */}
        {naInicial && (
          <>
            {etapa === "enviado" && (
              <div className="flex items-center gap-3 rounded-lg bg-emerald-50 px-4 py-3 text-emerald-800 ring-1 ring-emerald-200">
                <CheckCircle2 className="size-6 shrink-0" aria-hidden />
                <p className="text-sm">Relatório da visita à <strong>{ultimoCliente}</strong> enviado ao gerente.</p>
              </div>
            )}
            <p className="text-center font-titulo text-[13px] font-extrabold uppercase tracking-[0.12em] text-neutral-900">
              Iniciar relato de visita
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Quadrado cor="bg-marca-700 active:bg-marca-800" icone={<Mic className="size-7" />} rotulo="Por voz"
                descricao="Iniciar relato de visita por voz" aoClicar={() => setInstrucao(true)} />
              <Quadrado cor="bg-aco-800 active:bg-aco-900" icone={<Keyboard className="size-7" />} rotulo="Por texto"
                descricao="Iniciar relato de visita por texto" aoClicar={abrirFormularioEmBranco} />
            </div>

            <section>
              <h2 className="mb-2 font-titulo text-[11px] font-bold uppercase tracking-[0.12em] text-neutral-600">Últimos envios</h2>
              {recentes.data?.itens.length ? (
                <ul className="divide-y divide-neutral-200 overflow-hidden rounded-md border border-neutral-200 bg-white">
                  {recentes.data.itens.map((r) => (
                    <li key={r.id} className="grid h-11 grid-cols-[6px_1fr_auto] items-center gap-3 px-3 text-sm">
                      <span className="size-1.5 rounded-full bg-marca-700" aria-hidden />
                      <span className="truncate"><b>{r.cliente}</b>{r.cidade && <span className="text-neutral-500"> · {r.cidade}</span>}</span>
                      <span className="text-xs tabular-nums text-neutral-500">{dataBR(r.data).slice(0, 5)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-md border border-dashed border-neutral-300 bg-white px-4 py-6 text-center text-sm text-neutral-500">
                  Seus relatos enviados aparecem aqui.
                </p>
              )}
            </section>
          </>
        )}

        {/* ---------------------------------------------------------- gravação (tela escura) */}
        {escura && (
          <div className="flex flex-1 flex-col gap-4 text-white">
            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm leading-relaxed text-neutral-200">{INSTRUCAO}</div>
            {erro && <Aviso>{erro}</Aviso>}
            {grav.erro && <Aviso>{grav.erro}</Aviso>}

            <div className="flex flex-1 flex-col items-center justify-center gap-6 py-6">
              {etapa === "processando" ? (
                <>
                  <LoaderCircle className="size-14 animate-spin text-marca-600" aria-hidden />
                  <p className="text-center text-aco-500">Ouvindo seu relato e preenchendo o formulário…</p>
                </>
              ) : (
                <>
                  <p className="font-titulo text-5xl font-extrabold tabular-nums" aria-live="polite">{relogio(grav.segundos)}</p>
                  <div className="flex h-12 items-center gap-1" aria-hidden>
                    {grav.niveis.map((n, i) => (
                      <span key={i} className={`w-1.5 rounded-full ${grav.estado === "gravando" ? "bg-marca-600" : "bg-white/20"}`}
                        style={{ height: `${Math.round(n * 100)}%` }} />
                    ))}
                  </div>
                  <button onClick={grav.estado === "gravando" ? grav.parar : grav.iniciar} disabled={grav.estado === "pedindo"}
                    aria-label={grav.estado === "gravando" ? "Terminar gravação" : "Começar a gravar"}
                    className="flex size-28 items-center justify-center rounded-full bg-marca-600 shadow-[0_0_0_10px_rgb(227_38_43/0.22),0_0_0_22px_rgb(227_38_43/0.1)] transition active:scale-95 disabled:opacity-60">
                    {grav.estado === "gravando"
                      ? <Square className="size-9 fill-current" />
                      : <Mic className="size-11" />}
                  </button>
                  <p className="text-sm text-aco-500">
                    {grav.estado === "gravando" ? "Toque para terminar" : "Toque no microfone e comece a falar"}
                  </p>
                </>
              )}
            </div>

            {etapa === "gravar" && (
              <div className="grid grid-cols-2 gap-2">
                <Botao variante="claro" onClick={voltarAoInicio}>Cancelar</Botao>
                <Botao variante="claro" onClick={() => arquivo.current?.click()} disabled={grav.estado === "gravando"}>
                  <Paperclip className="size-4" aria-hidden /> Enviar áudio
                </Botao>
                <input ref={arquivo} type="file" accept="audio/*,.opus,.m4a" hidden onChange={escolherArquivo} />
              </div>
            )}
          </div>
        )}

        {/* ---------------------------------------------------------- conferir e enviar */}
        {etapa === "formulario" && form && (
          <form onSubmit={enviar} className="flex flex-1 flex-col gap-4">
            {porTexto && (
              <div className="rounded-md border-l-4 border-marca-700 bg-white px-4 py-3 text-sm leading-relaxed text-neutral-700">{INSTRUCAO}</div>
            )}
            {erro && <Aviso>{erro}</Aviso>}
            <div className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-3">
              <div className="grid grid-cols-2 gap-2">
                <Campo rotulo="Vendedor"><Entrada value={usuario!.nome} readOnly /></Campo>
                <Campo rotulo="Data"><Entrada type="date" value={form.data} onChange={set("data")} max={hojeISO()} required /></Campo>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Campo rotulo="Cliente"><Entrada value={form.cliente} onChange={set("cliente")} required autoFocus={porTexto} /></Campo>
                <Campo rotulo="Cidade"><Entrada value={form.cidade} onChange={set("cidade")} /></Campo>
              </div>
              <Campo rotulo="Contato"><Entrada value={form.contato} onChange={set("contato")} placeholder="Nome (setor)" /></Campo>
              <Campo rotulo="Ata de reunião">
                <AreaTexto value={form.ata} onChange={set("ata")} rows={porTexto ? 8 : 6}
                  placeholder={porTexto ? "O que foi tratado, pedidos, problemas e o que ficou combinado" : undefined} />
              </Campo>
              {form.transcricao && (
                <details className="rounded-md bg-neutral-100 px-3 py-2 text-sm text-neutral-600">
                  <summary className="cursor-pointer font-semibold">O que você falou</summary>
                  <p className="mt-2 leading-relaxed">{form.transcricao}</p>
                </details>
              )}
            </div>
            <div className="mt-auto grid grid-cols-2 gap-2">
              <Botao type="button" onClick={descartar}>Descartar</Botao>
              <Botao type="submit" variante="primario" carregando={enviando}>
                Enviar {!enviando && <ChevronRight className="size-4" aria-hidden />}
              </Botao>
            </div>
          </form>
        )}
      </main>

      <Modal aberto={instrucao} aoFechar={() => setInstrucao(false)} titulo="Antes de gravar">
        <p className="leading-relaxed text-neutral-700">{INSTRUCAO}</p>
        <Botao variante="primario" className="mt-6 w-full"
          onClick={() => { setInstrucao(false); setErro(""); setEtapa("gravar"); }}>
          OK
        </Botao>
      </Modal>
    </div>
  );
}

function Numero({ rotulo, valor }: { rotulo: string; valor?: number }) {
  return (
    <div className="rounded-md bg-white/[0.07] px-3 py-2">
      <p className="text-[11px] text-aco-500">{rotulo}</p>
      <p className="font-titulo text-xl font-extrabold tabular-nums">{valor ?? "–"}</p>
    </div>
  );
}

function Quadrado({ cor, icone, rotulo, descricao, aoClicar }: {
  cor: string;
  icone: ReactNode;
  rotulo: string;
  descricao: string;
  aoClicar: () => void;
}) {
  return (
    <button onClick={aoClicar} aria-label={descricao}
      className={`flex aspect-square flex-col items-center justify-center gap-3 rounded-xl p-3 text-white shadow-sm transition active:scale-[0.98] ${cor}`}>
      <span className="flex size-14 items-center justify-center rounded-full bg-white/15" aria-hidden>{icone}</span>
      <span className="font-titulo text-[13px] font-extrabold uppercase tracking-wider">{rotulo}</span>
    </button>
  );
}
