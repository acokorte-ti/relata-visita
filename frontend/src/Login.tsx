import { useState, type FormEvent } from "react";
import { Mic } from "lucide-react";
import { api } from "./api";
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
    <main className="flex min-h-full items-center justify-center p-6">
      <form onSubmit={entrar} className="w-full max-w-sm space-y-5 rounded-2xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-aco-700 text-white">
            <Mic className="size-7" aria-hidden />
          </span>
          <div>
            <h1 className="text-xl font-semibold">Relata Visita</h1>
            <p className="text-sm text-slate-500">ACOKORTE · entre com seu usuário</p>
          </div>
        </div>
        {erro && <Aviso>{erro}</Aviso>}
        <Campo rotulo="Usuário">
          <Entrada value={login} onChange={(e) => setLogin(e.target.value)} autoComplete="username"
            autoCapitalize="none" autoCorrect="off" required autoFocus />
        </Campo>
        <Campo rotulo="Senha">
          <Entrada type="password" value={senha} onChange={(e) => setSenha(e.target.value)}
            autoComplete="current-password" required />
        </Campo>
        <Botao type="submit" variante="primario" carregando={enviando} className="w-full py-3 text-base">
          Entrar
        </Botao>
      </form>
    </main>
  );
}
