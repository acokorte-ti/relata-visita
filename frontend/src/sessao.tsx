// Quem está logado. Busca /api/auth/eu uma vez e compartilha com o app todo.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ErroApi, type Usuario } from "./api";

export function useSessao() {
  const qc = useQueryClient();
  const q = useQuery<Usuario | null>({
    queryKey: ["eu"],
    queryFn: async () => {
      try {
        return await api.eu();
      } catch (e) {
        if (e instanceof ErroApi && e.status === 401) return null;
        throw e;
      }
    },
    staleTime: 5 * 60_000,
    retry: false,
  });
  return {
    usuario: q.data ?? null,
    carregando: q.isPending,
    definir: (u: Usuario | null) => qc.setQueryData(["eu"], u),
    sair: async () => {
      await api.logout().catch(() => undefined);
      qc.clear();
      qc.setQueryData(["eu"], null);
    },
  };
}
