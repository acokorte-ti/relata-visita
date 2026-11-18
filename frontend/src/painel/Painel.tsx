// Painel web do gerente: menu lateral + páginas Relatórios e Vendedores.
import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { FileText, LogOut, Mic, Users } from "lucide-react";
import { useSessao } from "../sessao";
import Relatorios from "./Relatorios";
import Vendedores from "./Vendedores";

const itens = [
  { para: "/painel/relatorios", rotulo: "Relatórios", Icone: FileText },
  { para: "/painel/vendedores", rotulo: "Vendedores", Icone: Users },
];

export default function Painel() {
  const { usuario, sair } = useSessao();
  return (
    <div className="flex min-h-full flex-col md:flex-row">
      <aside className="flex shrink-0 flex-row items-center gap-2 border-b border-slate-200 bg-white px-4 py-3 md:w-60 md:flex-col md:items-stretch md:border-b-0 md:border-r md:px-4 md:py-6">
        <div className="flex items-center gap-2 md:mb-6 md:px-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-aco-700 text-white">
            <Mic className="size-4" aria-hidden />
          </span>
          <span className="hidden font-semibold text-aco-800 sm:inline">Relata Visita</span>
        </div>
        <nav className="flex flex-1 flex-row gap-1 md:flex-col">
          {itens.map(({ para, rotulo, Icone }) => (
            <NavLink key={para} to={para}
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
                  isActive ? "bg-aco-50 text-aco-800" : "text-slate-600 hover:bg-slate-100"}`}>
              <Icone className="size-4" aria-hidden /> {rotulo}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-2 md:mt-auto md:border-t md:border-slate-100 md:px-2 md:pt-4">
          <span className="hidden min-w-0 flex-1 truncate text-sm text-slate-600 md:block">{usuario?.nome}</span>
          <button onClick={sair} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Sair">
            <LogOut className="size-4" />
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-8">
        <Routes>
          <Route path="relatorios" element={<Relatorios />} />
          <Route path="vendedores" element={<Vendedores />} />
          <Route path="*" element={<Navigate to="relatorios" replace />} />
        </Routes>
      </main>
    </div>
  );
}
