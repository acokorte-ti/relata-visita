import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, UserPlus } from "lucide-react";
import { api, iniciais, type Perfil, type Usuario } from "../api";
import { useSessao } from "../sessao";
import { Aviso, Botao, Campo, Carregando, Entrada, Faixa, Modal } from "../ui";

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
    <>
      <Faixa titulo="Vendedores" subtitulo="Quem pode entrar no app. Cada um tem usuário e senha próprios."
        acao={
          <Botao variante="primario" onClick={() => setNovo(true)}>
            <UserPlus className="size-4" aria-hidden /> Novo usuário
          </Botao>
        } />
      <div className="mx-auto -mt-4 max-w-7xl px-4 pb-10 md:px-8">
        {erro && <div className="mb-4"><Aviso>{erro}</Aviso></div>}
        {usuarios.isPending ? <Carregando /> : (
          <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
            <ul className="divide-y divide-neutral-100">
              {usuarios.data?.map((u) => (
                <li key={u.id} className="grid grid-cols-[40px_minmax(0,1fr)] items-center gap-x-4 gap-y-3 px-4 py-3 sm:grid-cols-[40px_minmax(0,1fr)_repeat(2,9.5rem)]">
                  <span className={`flex size-10 items-center justify-center rounded-full font-titulo text-xs font-extrabold ${
                    !u.ativo ? "bg-neutral-200 text-neutral-400" : u.perfil === "gerente" ? "bg-aco-900 text-white" : "bg-marca-700 text-white"}`} aria-hidden>
                    {iniciais(u.nome)}
                  </span>
                  <div className="min-w-0">
                    <p className={`truncate font-semibold ${u.ativo ? "" : "text-neutral-400 line-through"}`}>{u.nome}</p>
                    <p className="text-xs text-neutral-500">
                      {u.login} · {u.perfil === "gerente" ? "Gerente" : "Vendedor"}{u.ativo ? "" : " · inativo"}
                    </p>
                  </div>
                  <Botao variante="secundario" className="col-start-2 sm:col-start-auto" onClick={() => setSenhaDe(u)}>
                    <KeyRound className="size-4" aria-hidden /> Senha
                  </Botao>
                  {u.id !== eu?.id ? (
                    <Botao variante={u.ativo ? "secundario" : "primario"} carregando={alternar.isPending && alternar.variables?.id === u.id}
                      className="col-start-2 sm:col-start-auto"
                      onClick={() => {
                        if (!u.ativo || confirm(`Desativar ${u.nome}? Essa pessoa não vai conseguir mais entrar no app.`)) {
                          setErro("");
                          alternar.mutate(u);
                        }
                      }}>
                      {u.ativo ? "Desativar" : "Reativar"}
                    </Botao>
                  ) : <span className="hidden sm:block" />}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <NovoUsuario aberto={novo} aoFechar={() => setNovo(false)} />
      <NovaSenha usuario={senhaDe} aoFechar={() => setSenhaDe(null)} />
    </>
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
            className="h-11 w-full rounded-md border border-neutral-300 bg-white px-3 text-base focus:border-marca-700 focus:outline-none focus:ring-2 focus:ring-marca-100">
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
