import { useState, type FormEvent } from "react";
import { api } from "./api";
import { Logo } from "./marca";
import { useSessao } from "./sessao";
import { Aviso, Botao, Campo, Entrada } from "./ui";

export default function Login() {
  const { definir } = useSessao();
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function entrar(e: FormEvent) {
    e.preventDefault();
    setErro("");
    setEnviando(true);
    try {
      definir(await api.login(login.trim(), senha));
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="flex min-h-full flex-col bg-neutral-100 sm:items-center sm:justify-center sm:p-6">
      <div className="flex w-full flex-1 flex-col overflow-hidden bg-white sm:max-w-sm sm:flex-none sm:rounded-2xl sm:shadow-sm sm:ring-1 sm:ring-neutral-200">
        <div className="escovado flex h-60 flex-col items-center justify-center gap-4 [clip-path:polygon(0_0,100%_0,100%_82%,0_100%)]">
          <Logo altura={36} />
          <p className="font-titulo text-xs font-bold uppercase tracking-[0.18em] text-aco-500">Relata Visita</p>
        </div>
        <form onSubmit={entrar} className="flex flex-1 flex-col gap-4 p-6 pt-2">
          {erro && <Aviso>{erro}</Aviso>}
          <Campo rotulo="Usuário">
            <Entrada value={login} onChange={(e) => setLogin(e.target.value)} autoComplete="username"
              autoCapitalize="none" autoCorrect="off" required autoFocus />
          </Campo>
          <Campo rotulo="Senha">
            <Entrada type="password" value={senha} onChange={(e) => setSenha(e.target.value)}
              autoComplete="current-password" required />
          </Campo>
          <Botao type="submit" variante="primario" carregando={enviando} className="mt-2 w-full">
            Entrar
          </Botao>
        </form>
      </div>
    </main>
  );
}
