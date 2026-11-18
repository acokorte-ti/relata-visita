// App do vendedor: início -> (voz: instrução -> gravação | texto: escrever) -> formulário -> enviado.
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ChevronRight, Keyboard, LoaderCircle, LogOut, Mic, Paperclip, Sparkles, Square, X } from "lucide-react";
import { api, dataBR, hojeISO, isoDe, type Rascunho } from "../api";
import { useSessao } from "../sessao";
import { AreaTexto, Aviso, Botao, Campo, Entrada, Modal } from "../ui";
import { extensaoDe, relogio, useGravador } from "./gravador";

type Etapa = "inicio" | "gravar" | "processando" | "escrever" | "formulario" | "enviado";

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
  const [texto, setTexto] = useState("");
  const [montando, setMontando] = useState(false);
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

  const recentes = useQuery({
    queryKey: ["meus-relatos"],
    queryFn: () => api.relatos({ limite: 5 }),
    enabled: etapa === "inicio" || etapa === "enviado",
  });
  const semana = useQuery({
    queryKey: ["meus-relatos-semana"],
    queryFn: () => api.relatos({ inicio: segundaFeira(), limite: 1 }),
    enabled: etapa === "inicio" || etapa === "enviado",
  });

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

  async function montarDoTexto(e: FormEvent) {
    e.preventDefault();
    if (texto.trim().length < 15) {
      setErro("Escreva um pouco mais sobre a visita: cliente, cidade, contato e assunto.");
      return;
    }
    setErro("");
    setMontando(true);
    try {
      const r = await api.extrairTexto(texto);
      setForm({ ...r, data: hojeISO() });
      setTexto("");
      setEtapa("formulario");
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setMontando(false);
    }
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
      qc.invalidateQueries({ queryKey: ["meus-relatos-semana"] });
    } catch (err) {
      setErro(`${(err as Error).message} O relato continua salvo neste celular.`);
    } finally {
      setEnviando(false);
    }
  }

  function descartar() {
    if (!confirm("Descartar este relato? O que foi gravado será perdido.")) return;
    localStorage.removeItem(chave);
    setForm(null);
    setErro("");
    setEtapa("inicio");
  }

  const set = (campo: keyof Formulario) => (e: { target: { value: string } }) =>
    setForm((f) => (f ? { ...f, [campo]: e.target.value } : f));

  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-col bg-white sm:my-6 sm:min-h-0 sm:rounded-2xl sm:shadow-sm sm:ring-1 sm:ring-slate-200">
      <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <div>
          <p className="text-base font-semibold text-aco-800">Relata Visita</p>
          <p className="text-xs text-slate-500">{usuario!.nome}</p>
        </div>
        <button onClick={sair} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Sair">
          <LogOut className="size-5" />
        </button>
      </header>

      <main className="flex flex-1 flex-col px-5 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        {(etapa === "inicio" || etapa === "enviado") && (
          <>
            {etapa === "enviado" && (
              <div className="mb-5 flex items-center gap-3 rounded-xl bg-emerald-50 px-4 py-3 text-emerald-800 ring-1 ring-emerald-200">
                <CheckCircle2 className="size-6 shrink-0" aria-hidden />
                <p className="text-sm">Relatório da visita à <strong>{ultimoCliente}</strong> enviado ao gerente.</p>
              </div>
            )}
            <div className="rounded-xl bg-slate-50 px-4 py-3">
              <p className="text-xs text-slate-500">Relatos nesta semana</p>
              <p className="text-2xl font-semibold">{semana.data?.total ?? "–"}</p>
            </div>

            <section className="mt-6">
              <h2 className="mb-2 text-sm font-medium text-slate-500">Últimos envios</h2>
              {recentes.data?.itens.length ? (
                <ul className="divide-y divide-slate-100 rounded-xl ring-1 ring-slate-200">
                  {recentes.data.itens.map((r) => (
                    <li key={r.id} className="flex items-center justify-between px-4 py-3 text-sm">
                      <span className="truncate">
                        <span className="font-medium">{r.cliente}</span>
                        {r.cidade && <span className="text-slate-500"> · {r.cidade}</span>}
                      </span>
                      <span className="ml-3 shrink-0 text-xs text-slate-500">{dataBR(r.data)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">Seus relatos enviados aparecem aqui.</p>
              )}
            </section>

            <div className="mt-auto flex flex-col gap-3 pt-8">
              <button
                onClick={() => setInstrucao(true)}
                className="flex w-full flex-col items-center gap-2 rounded-2xl bg-aco-700 px-6 py-6 text-white shadow-sm transition active:scale-[0.98] active:bg-aco-800"
              >
                <Mic className="size-9" aria-hidden />
                <span className="text-base font-semibold tracking-wide">INICIAR RELATO DE VISITA POR VOZ</span>
              </button>
              <button
                onClick={() => { setErro(""); setEtapa("escrever"); }}
                className="flex w-full items-center justify-center gap-3 rounded-2xl bg-white px-6 py-5 text-aco-800 ring-2 ring-aco-700 transition active:scale-[0.98] active:bg-aco-50"
              >
                <Keyboard className="size-6" aria-hidden />
                <span className="text-base font-semibold tracking-wide">INICIAR RELATO DE VISITA POR TEXTO</span>
              </button>
            </div>
          </>
        )}

        {(etapa === "gravar" || etapa === "processando") && (
          <div className="flex flex-1 flex-col">
            <div className="rounded-xl bg-aco-50 px-4 py-3 text-sm leading-relaxed text-aco-800">{INSTRUCAO}</div>
            {erro && <div className="mt-4"><Aviso>{erro}</Aviso></div>}
            {grav.erro && <div className="mt-4"><Aviso>{grav.erro}</Aviso></div>}

            <div className="flex flex-1 flex-col items-center justify-center gap-6 py-8">
              {etapa === "processando" ? (
                <>
                  <LoaderCircle className="size-14 animate-spin text-aco-700" aria-hidden />
                  <p className="text-center text-slate-600">Ouvindo seu relato e preenchendo o formulário…</p>
                </>
              ) : (
                <>
                  <p className="text-4xl font-semibold tabular-nums" aria-live="polite">{relogio(grav.segundos)}</p>
                  <div className="flex h-12 items-center gap-1" aria-hidden>
                    {grav.niveis.map((n, i) => (
                      <span key={i} className={`w-1.5 rounded-full ${grav.estado === "gravando" ? "bg-aco-600" : "bg-slate-300"}`}
                        style={{ height: `${Math.round(n * 100)}%` }} />
                    ))}
                  </div>
                  {grav.estado === "gravando" ? (
                    <button onClick={grav.parar} aria-label="Terminar gravação"
                      className="flex size-24 items-center justify-center rounded-full bg-red-600 text-white shadow-lg ring-8 ring-red-100 transition active:scale-95">
                      <Square className="size-9 fill-current" />
                    </button>
                  ) : (
                    <button onClick={grav.iniciar} aria-label="Começar a gravar" disabled={grav.estado === "pedindo"}
                      className="flex size-24 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg ring-8 ring-emerald-100 transition active:scale-95 disabled:opacity-60">
                      <Mic className="size-11" />
                    </button>
                  )}
                  <p className="text-sm text-slate-500">
                    {grav.estado === "gravando" ? "Toque para terminar" : "Toque no microfone e comece a falar"}
                  </p>
                </>
              )}
            </div>

            {etapa === "gravar" && (
              <div className="flex items-center justify-between">
                <Botao variante="fantasma" onClick={() => { grav.cancelar(); setErro(""); setEtapa("inicio"); }}>
                  <X className="size-4" aria-hidden /> Cancelar
                </Botao>
                {grav.estado !== "gravando" && (
                  <>
                    <Botao variante="fantasma" onClick={() => arquivo.current?.click()}>
                      <Paperclip className="size-4" aria-hidden /> Enviar áudio
                    </Botao>
                    <input ref={arquivo} type="file" accept="audio/*,.opus,.m4a" hidden onChange={escolherArquivo} />
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {etapa === "escrever" && (
          <form onSubmit={montarDoTexto} className="flex flex-1 flex-col gap-4">
            <div className="rounded-xl bg-aco-50 px-4 py-3 text-sm leading-relaxed text-aco-800">{INSTRUCAO}</div>
            {erro && <Aviso>{erro}</Aviso>}
            <Campo rotulo="Relato da visita">
              <AreaTexto value={texto} onChange={(e) => setTexto(e.target.value)} rows={10} autoFocus
                placeholder="Visitei a Gerdau em Ouro Branco, falei com o Alex de compras. Ele pediu cotação de 20 t de chapa grossa…" />
            </Campo>
            <p className="text-xs text-slate-500">A IA separa o texto nos campos do relatório. Você confere antes de enviar.</p>
            <div className="mt-auto flex flex-col gap-2 pt-4">
              <Botao type="submit" variante="primario" carregando={montando} className="py-4 text-base">
                {!montando && <Sparkles className="size-5" aria-hidden />} Montar relatório
              </Botao>
              <Botao type="button" variante="fantasma" onClick={() => { setErro(""); setEtapa("inicio"); }}>
                Cancelar
              </Botao>
            </div>
          </form>
        )}

        {etapa === "formulario" && form && (
          <form onSubmit={enviar} className="flex flex-1 flex-col gap-4">
            <div>
              <h1 className="text-lg font-semibold">Confira o relatório</h1>
              <p className="text-sm text-slate-500">Toque em qualquer campo para corrigir.</p>
            </div>
            {erro && <Aviso>{erro}</Aviso>}
            <Campo rotulo="Nome do vendedor"><Entrada value={usuario!.nome} readOnly /></Campo>
            <Campo rotulo="Data"><Entrada type="date" value={form.data} onChange={set("data")} max={hojeISO()} required /></Campo>
            <Campo rotulo="Cliente"><Entrada value={form.cliente} onChange={set("cliente")} required /></Campo>
            <Campo rotulo="Cidade"><Entrada value={form.cidade} onChange={set("cidade")} /></Campo>
            <Campo rotulo="Contato"><Entrada value={form.contato} onChange={set("contato")} placeholder="Nome (setor)" /></Campo>
            <Campo rotulo="Ata de reunião"><AreaTexto value={form.ata} onChange={set("ata")} rows={7} /></Campo>
            {form.transcricao && (
              <details className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
                <summary className="cursor-pointer font-medium">{form.audio_id ? "O que você falou" : "O que você escreveu"}</summary>
                <p className="mt-2 leading-relaxed">{form.transcricao}</p>
              </details>
            )}
            <div className="mt-auto flex flex-col gap-2 pt-4">
              <Botao type="submit" variante="primario" carregando={enviando} className="py-4 text-base tracking-wide">
                ENVIAR RELATÓRIO <ChevronRight className="size-5" aria-hidden />
              </Botao>
              <Botao type="button" variante="fantasma" onClick={descartar}>Descartar</Botao>
            </div>
          </form>
        )}
      </main>

      <Modal aberto={instrucao} aoFechar={() => setInstrucao(false)} titulo="Antes de gravar">
        <p className="leading-relaxed text-slate-700">{INSTRUCAO}</p>
        <Botao variante="primario" className="mt-6 w-full py-3 text-base"
          onClick={() => { setInstrucao(false); setErro(""); setEtapa("gravar"); }}>
          OK
        </Botao>
      </Modal>
    </div>
  );
}
