// Gravação de áudio no navegador (MediaRecorder), com nível do microfone para as "ondas".
import { useCallback, useEffect, useRef, useState } from "react";

const TIPOS = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
export const DURACAO_MAX_S = 10 * 60; // relatos longos passam do limite de 25 MB e cansam a IA

export function extensaoDe(tipo: string): string {
  if (tipo.includes("mp4")) return ".mp4";
  if (tipo.includes("ogg")) return ".ogg";
  return ".webm";
}

export type EstadoGravacao = "parado" | "pedindo" | "gravando";

export function useGravador(aoTerminar: (audio: Blob) => void) {
  const [estado, setEstado] = useState<EstadoGravacao>("parado");
  const [segundos, setSegundos] = useState(0);
  const [niveis, setNiveis] = useState<number[]>(() => Array(24).fill(0.1));
  const [erro, setErro] = useState("");

  const rec = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const ctx = useRef<AudioContext | null>(null);
  const timer = useRef<number>(0);
  const anim = useRef<number>(0);
  const cancelado = useRef(false);
  const fim = useRef(aoTerminar);
  fim.current = aoTerminar;

  const liberar = useCallback(() => {
    window.clearInterval(timer.current);
    cancelAnimationFrame(anim.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    ctx.current?.close().catch(() => undefined);
    stream.current = null;
    ctx.current = null;
  }, []);

  useEffect(() => liberar, [liberar]);

  const parar = useCallback(() => {
    if (rec.current?.state === "recording") rec.current.stop();
  }, []);

  const iniciar = useCallback(async () => {
    setErro("");
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setErro("Este navegador não grava áudio. Use o Chrome (Android) ou o Safari (iPhone) atualizados.");
      return;
    }
    setEstado("pedindo");
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch {
      setEstado("parado");
      setErro("Não consegui usar o microfone. Libere o acesso ao microfone para este app nas configurações do celular.");
      return;
    }
    const tipo = TIPOS.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
    const gravador = new MediaRecorder(stream.current, tipo ? { mimeType: tipo } : undefined);
    const partes: Blob[] = [];
    cancelado.current = false;
    gravador.ondataavailable = (e) => {
      if (e.data.size) partes.push(e.data);
    };
    gravador.onstop = () => {
      liberar();
      setEstado("parado");
      if (!cancelado.current) fim.current(new Blob(partes, { type: gravador.mimeType || tipo || "audio/webm" }));
    };
    rec.current = gravador;

    // nível do microfone, para desenhar as barras
    try {
      ctx.current = new AudioContext();
      const analisador = ctx.current.createAnalyser();
      analisador.fftSize = 64;
      ctx.current.createMediaStreamSource(stream.current).connect(analisador);
      const buf = new Uint8Array(analisador.frequencyBinCount);
      const passo = () => {
        analisador.getByteFrequencyData(buf);
        const media = buf.reduce((a, b) => a + b, 0) / buf.length / 255;
        setNiveis((n) => [...n.slice(1), Math.max(0.08, Math.min(1, media * 2.2))]);
        anim.current = requestAnimationFrame(passo);
      };
      passo();
    } catch {
      /* sem ondas, mas grava normalmente */
    }

    setSegundos(0);
    const inicio = Date.now();
    timer.current = window.setInterval(() => {
      const s = Math.floor((Date.now() - inicio) / 1000);
      setSegundos(s);
      if (s >= DURACAO_MAX_S) gravador.stop();
    }, 250);
    gravador.start(1000);
    setEstado("gravando");
  }, [liberar]);

  const cancelar = useCallback(() => {
    cancelado.current = true;
    if (rec.current?.state === "recording") rec.current.stop();
    else liberar();
    setEstado("parado");
  }, [liberar]);

  return { estado, segundos, niveis, erro, iniciar, parar, cancelar };
}

export function relogio(s: number): string {
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
