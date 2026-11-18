import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, UserPlus } from "lucide-react";
import { api, type Perfil, type Usuario } from "../api";
import { useSessao } from "../sessao";
import { Aviso, Botao, Campo, Carregando, Entrada, Modal } from "../ui";

export default function Vendedores() {
  const qc = useQueryClient();
  const { usuario: eu } = useSessao();
  const usuarios = useQuery({ queryKey: ["usuarios"], queryFn: api.usuarios });
  const [novo, setNovo] = useState(false);
  const [senhaDe, setSenhaDe] = useState<Usuario | null>(null);
  const [erro, setErro] = useState("");

  const alternar = useMutation({
    mutationFn: (u: Usuario) => api.alterarUsuario(u.id, { ativo: !u.ativo }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["usuarios"] }),
    onError: (e) => setErro((e as Error).message),
  });

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Vendedores</h1>
          <p className="text-sm text-slate-500">Quem pode entrar no app. Cada um tem usuário e senha próprios.</p>
        </div>
        <Botao variante="primario" onClick={() => setNovo(true)}>
          <UserPlus className="size-4" aria-hidden /> Novo usuário
        </Botao>
      </div>
      {erro && <div className="mb-4"><Aviso>{erro}</Aviso></div>}
      {usuarios.isPending ? <Carregando /> : (
        <div className="overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
          <ul className="divide-y divide-slate-100">
            {usuarios.data?.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className={`font-medium ${u.ativo ? "" : "text-slate-400 line-through"}`}>{u.nome}</p>
                  <p className="text-xs text-slate-500">
                    {u.login} · {u.perfil === "gerente" ? "Gerente" : "Vendedor"}{u.ativo ? "" : " · inativo"}
                  </p>
                </div>
                <Botao variante="fantasma" onClick={() => setSenhaDe(u)}>
                  <KeyRound className="size-4" aria-hidden /> Nova senha
                </Botao>
                {u.id !== eu?.id && (
                  <Botao variante="secundario" carregando={alternar.isPending && alternar.variables?.id === u.id}
                    onClick={() => {
                      if (!u.ativo || confirm(`Desativar ${u.nome}? Ele não vai conseguir mais entrar no app.`)) {
                        setErro("");
                        alternar.mutate(u);
                      }
                    }}>
                    {u.ativo ? "Desativar" : "Reativar"}
                  </Botao>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      <NovoUsuario aberto={novo} aoFechar={() => setNovo(false)} />
      <NovaSenha usuario={senhaDe} aoFechar={() => setSenhaDe(null)} />
    </div>
  );
}

function NovoUsuario({ aberto, aoFechar }: { aberto: boolean; aoFechar: () => void }) {
  const qc = useQueryClient();
  const [dados, setDados] = useState({ nome: "", login: "", senha: "", perfil: "vendedor" as Perfil });
  const [erro, setErro] = useState("");
  const criar = useMutation({
    mutationFn: () => api.criarUsuario(dados),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["usuarios"] });
      setDados({ nome: "", login: "", senha: "", perfil: "vendedor" });
      aoFechar();
    },
    onError: (e) => setErro((e as Error).message),
  });
  const salvar = (e: FormEvent) => { e.preventDefault(); setErro(""); criar.mutate(); };
  return (
    <Modal aberto={aberto} aoFechar={aoFechar} titulo="Novo usuário">
      <form onSubmit={salvar} className="space-y-4">
        {erro && <Aviso>{erro}</Aviso>}
        <Campo rotulo="Nome"><Entrada value={dados.nome} onChange={(e) => setDados({ ...dados, nome: e.target.value })} required autoFocus /></Campo>
        <Campo rotulo="Usuário (login)" dica="Letras, números, ponto ou traço. Ex.: carlos.souza">
          <Entrada value={dados.login} onChange={(e) => setDados({ ...dados, login: e.target.value })}
            pattern="[a-zA-Z0-9._\-]{3,60}" autoCapitalize="none" required />
        </Campo>
        <Campo rotulo="Senha inicial" dica="Pelo menos 8 caracteres. Passe para o vendedor pessoalmente.">
          <Entrada type="text" value={dados.senha} onChange={(e) => setDados({ ...dados, senha: e.target.value })}
            minLength={8} autoComplete="new-password" required />
        </Campo>
        <Campo rotulo="Perfil">
          <select value={dados.perfil} onChange={(e) => setDados({ ...dados, perfil: e.target.value as Perfil })}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base">
            <option value="vendedor">Vendedor (usa o app no celular)</option>
            <option value="gerente">Gerente (vê o painel)</option>
          </select>
        </Campo>
        <Botao type="submit" variante="primario" carregando={criar.isPending} className="w-full">Criar usuário</Botao>
      </form>
    </Modal>
  );
}

function NovaSenha({ usuario, aoFechar }: { usuario: Usuario | null; aoFechar: () => void }) {
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState(false);
  const salvar = useMutation({
    mutationFn: () => api.alterarUsuario(usuario!.id, { senha }),
    onSuccess: () => { setOk(true); setSenha(""); },
    onError: (e) => setErro((e as Error).message),
  });
  const fechar = () => { setOk(false); setErro(""); setSenha(""); aoFechar(); };
  return (
    <Modal aberto={!!usuario} aoFechar={fechar} titulo={`Nova senha para ${usuario?.nome ?? ""}`}>
      {ok ? (
        <div className="space-y-4">
          <Aviso tipo="ok">Senha trocada. As sessões abertas desse usuário foram encerradas.</Aviso>
          <Botao className="w-full" onClick={fechar}>Fechar</Botao>
        </div>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); setErro(""); salvar.mutate(); }} className="space-y-4">
          {erro && <Aviso>{erro}</Aviso>}
          <Campo rotulo="Nova senha" dica="Pelo menos 8 caracteres.">
            <Entrada type="text" value={senha} onChange={(e) => setSenha(e.target.value)} minLength={8}
              autoComplete="new-password" required autoFocus />
          </Campo>
          <Botao type="submit" variante="primario" carregando={salvar.isPending} className="w-full">Salvar senha</Botao>
        </form>
      )}
    </Modal>
  );
}
