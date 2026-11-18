// Componentes visuais pequenos, compartilhados entre o app do vendedor e o painel.
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import { LoaderCircle, X } from "lucide-react";

type Variante = "primario" | "secundario" | "perigo" | "fantasma";

const variantes: Record<Variante, string> = {
  primario: "bg-aco-700 text-white hover:bg-aco-800 active:bg-aco-800",
  secundario: "bg-white text-slate-800 ring-1 ring-slate-300 hover:bg-slate-50",
  perigo: "bg-red-600 text-white hover:bg-red-700",
  fantasma: "text-slate-600 hover:bg-slate-100",
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
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition
        focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aco-600
        disabled:cursor-not-allowed disabled:opacity-60 ${variantes[variante]} ${className}`}
    >
      {carregando && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function Campo({ rotulo, children, dica }: { rotulo: string; children: ReactNode; dica?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{rotulo}</span>
      {children}
      {dica && <span className="mt-1 block text-xs text-slate-500">{dica}</span>}
    </label>
  );
}

const estiloEntrada =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 " +
  "placeholder:text-slate-400 focus:border-aco-600 focus:outline-none focus:ring-2 focus:ring-aco-100 " +
  "read-only:bg-slate-100 read-only:text-slate-600";

export function Entrada(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${estiloEntrada} ${props.className ?? ""}`} />;
}

export function AreaTexto(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${estiloEntrada} min-h-32 leading-relaxed ${props.className ?? ""}`} />;
}

export function Aviso({ tipo = "erro", children }: { tipo?: "erro" | "info" | "ok"; children: ReactNode }) {
  const cores = {
    erro: "bg-red-50 text-red-800 ring-red-200",
    info: "bg-aco-50 text-aco-800 ring-aco-100",
    ok: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  }[tipo];
  return (
    <div role={tipo === "erro" ? "alert" : "status"} className={`rounded-lg px-4 py-3 text-sm ring-1 ${cores}`}>
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-4 sm:items-center" onClick={aoFechar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold">{titulo}</h2>
          <button onClick={aoFechar} className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label="Fechar">
            <X className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Carregando() {
  return (
    <div className="flex h-full items-center justify-center p-10 text-slate-500">
      <LoaderCircle className="size-6 animate-spin" aria-label="Carregando" />
    </div>
  );
}
