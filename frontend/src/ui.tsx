// Componentes visuais compartilhados (identidade Açokorte, protótipo B).
// Medidas únicas para manter tudo simétrico: botão 48 px, campo 44 px, raio 6 px.
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import { LoaderCircle, X } from "lucide-react";

type Variante = "primario" | "secundario" | "claro" | "perigo" | "fantasma";

const variantes: Record<Variante, string> = {
  primario: "bg-marca-700 text-white hover:bg-marca-800",
  secundario: "bg-white text-neutral-900 ring-1 ring-inset ring-neutral-300 hover:bg-neutral-50",
  claro: "bg-white/10 text-white hover:bg-white/15", // sobre fundo escuro
  perigo: "bg-marca-800 text-white hover:bg-marca-700",
  fantasma: "text-neutral-600 hover:bg-neutral-200/60",
};

export function Botao({
  variante = "secundario",
  carregando,
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; carregando?: boolean }) {
  return (
    <button
      {...props}
      disabled={props.disabled || carregando}
      className={`inline-flex h-12 items-center justify-center gap-2 rounded-md px-5 font-titulo text-[13px] font-bold uppercase tracking-wider transition
        focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca-600
        disabled:cursor-not-allowed disabled:opacity-60 ${variantes[variante]} ${className}`}
    >
      {carregando && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function Campo({ rotulo, children, dica, escuro }: { rotulo: string; children: ReactNode; dica?: string; escuro?: boolean }) {
  return (
    <label className="block min-w-0">
      <span className={`mb-1 block text-xs font-semibold ${escuro ? "text-aco-500" : "text-neutral-600"}`}>{rotulo}</span>
      {children}
      {dica && <span className="mt-1 block text-xs text-neutral-500">{dica}</span>}
    </label>
  );
}

const estiloEntrada =
  "w-full rounded-md border border-neutral-300 bg-white px-3 text-base text-neutral-900 " +
  "placeholder:text-neutral-400 focus:border-marca-700 focus:outline-none focus:ring-2 focus:ring-marca-100 " +
  "read-only:bg-neutral-100 read-only:text-neutral-500";

export function Entrada(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`h-11 ${estiloEntrada} ${props.className ?? ""}`} />;
}

export function AreaTexto(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${estiloEntrada} min-h-32 py-2.5 leading-relaxed ${props.className ?? ""}`} />;
}

/** Entrada e seletor para usar sobre o fundo de aço escovado. */
export const estiloEntradaEscura =
  "h-11 w-full rounded-md border border-white/15 bg-white/10 px-3 text-base text-white placeholder:text-aco-500 " +
  "focus:border-marca-600 focus:outline-none focus:ring-2 focus:ring-marca-600/30 [color-scheme:dark]";

export function Aviso({ tipo = "erro", children }: { tipo?: "erro" | "info" | "ok"; children: ReactNode }) {
  const cores = {
    erro: "bg-marca-50 text-marca-800 ring-marca-100",
    info: "bg-neutral-100 text-neutral-700 ring-neutral-200",
    ok: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  }[tipo];
  return (
    <div role={tipo === "erro" ? "alert" : "status"} className={`rounded-md px-4 py-3 text-sm ring-1 ${cores}`}>
      {children}
    </div>
  );
}

export function Modal({ aberto, aoFechar, titulo, children }: {
  aberto: boolean;
  aoFechar: () => void;
  titulo: string;
  children: ReactNode;
}) {
  if (!aberto) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-aco-900/60 p-4 sm:items-center" onClick={aoFechar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="escovado flex items-center justify-between gap-4 px-6 py-4">
          <h2 className="text-lg text-white">{titulo}</h2>
          <button onClick={aoFechar} className="flex size-8 items-center justify-center rounded-md bg-white/10 text-white hover:bg-white/20" aria-label="Fechar">
            <X className="size-4" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

/** Cartão branco com título, subtítulo e selo opcional (padrão do painel). */
export function Cartao({ titulo, subtitulo, selo, children, className = "" }: {
  titulo: string;
  subtitulo?: string;
  selo?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-neutral-200 bg-white p-6 ${className}`}>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base">{titulo}</h2>
          {subtitulo && <p className="text-xs text-neutral-500">{subtitulo}</p>}
        </div>
        {selo && <span className="rounded bg-neutral-100 px-2 py-1 font-titulo text-[11px] font-bold uppercase tracking-wider text-neutral-500">{selo}</span>}
      </div>
      {children}
    </section>
  );
}

/** Faixa de aço escovado no topo das páginas do painel. */
export function Faixa({ titulo, subtitulo, acao, children }: {
  titulo: string;
  subtitulo: string;
  acao?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="escovado px-4 pb-10 pt-8 md:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl text-white md:text-[28px]">{titulo}</h1>
            <p className="text-sm text-aco-500">{subtitulo}</p>
          </div>
          {acao}
        </div>
        {children}
      </div>
    </div>
  );
}

export function Carregando({ escuro }: { escuro?: boolean }) {
  return (
    <div className={`flex h-full items-center justify-center p-10 ${escuro ? "text-aco-500" : "text-neutral-500"}`}>
      <LoaderCircle className="size-6 animate-spin" aria-label="Carregando" />
    </div>
  );
}
