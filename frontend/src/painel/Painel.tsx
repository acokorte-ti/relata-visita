// Painel web do gerente (protótipo B): barra superior escura com abas e conteúdo abaixo.
import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { ChartColumn, FileText, LogOut, Users } from "lucide-react";
import { iniciais } from "../api";
import { Logo, Simbolo } from "../marca";
import { useSessao } from "../sessao";
import Dashboard from "./Dashboard";
import Relatorios from "./Relatorios";
import Vendedores from "./Vendedores";

const itens = [
  { para: "/painel/dashboard", rotulo: "Dashboard", Icone: ChartColumn },
  { para: "/painel/relatorios", rotulo: "Relatórios", Icone: FileText },
  { para: "/painel/vendedores", rotulo: "Vendedores", Icone: Users },
];

export default function Painel() {
  const { usuario, sair } = useSessao();
  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-30 bg-aco-900 text-white">
        <div className="mx-auto grid h-16 max-w-7xl grid-cols-[auto_1fr_auto] items-center gap-4 px-4 md:grid-cols-[220px_1fr_220px] md:px-8">
          <span className="hidden md:block"><Logo altura={24} /></span>
          <span className="md:hidden"><Simbolo altura={22} /></span>
          <nav className="flex h-full justify-center gap-1 overflow-x-auto">
            {itens.map(({ para, rotulo, Icone }) => (
              <NavLink key={para} to={para}
                className={({ isActive }) =>
                  `flex items-center gap-2 border-b-[3px] px-3 font-titulo text-[13px] font-bold uppercase tracking-wider md:px-5 ${
                    isActive ? "border-marca-600 text-white" : "border-transparent text-aco-500 hover:text-white"}`}>
                <Icone className="size-4" aria-hidden /> <span className="hidden sm:inline">{rotulo}</span>
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center justify-end gap-3">
            <span className="hidden truncate text-sm lg:inline">{usuario?.nome}</span>
            <span className="flex size-9 items-center justify-center rounded-full bg-marca-600 font-titulo text-xs font-extrabold" aria-hidden>
              {iniciais(usuario?.nome ?? "")}
            </span>
            <button onClick={sair} className="flex size-9 items-center justify-center rounded-md bg-white/10 hover:bg-white/15" aria-label="Sair">
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </header>
      <main className="min-w-0 flex-1">
        <Routes>
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="relatorios" element={<Relatorios />} />
          <Route path="vendedores" element={<Vendedores />} />
          <Route path="*" element={<Navigate to="dashboard" replace />} />
        </Routes>
      </main>
    </div>
  );
}
