import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { registerSW } from "virtual:pwa-register";
import "./index.css";
import { useSessao } from "./sessao";
import { Carregando } from "./ui";
import Login from "./Login";
import AppVendedor from "./vendedor/AppVendedor";
import Painel from "./painel/Painel";

registerSW({ immediate: true });

const qc = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false } } });

function Rotas() {
  const { usuario, carregando } = useSessao();
  if (carregando) return <Carregando />;
  if (!usuario) return <Login />;
  const inicial = usuario.perfil === "gerente" ? "/painel" : "/";
  return (
    <Routes>
      <Route path="/" element={usuario.perfil === "gerente" ? <Navigate to="/painel" replace /> : <AppVendedor />} />
      <Route path="/relatar" element={<AppVendedor />} />
      <Route
        path="/painel/*"
        element={usuario.perfil === "gerente" ? <Painel /> : <Navigate to="/" replace />}
      />
      <Route path="*" element={<Navigate to={inicial} replace />} />
    </Routes>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <Rotas />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
