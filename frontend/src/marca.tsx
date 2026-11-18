// Logo da Açokorte. O símbolo (elipse com o K) é o arquivo enviado pela empresa,
// salvo em frontend/public/simbolo-acokorte.png. O nome "AçoKorte" é escrito em
// Raleway com versaletes, como no logo do site.
export const SIMBOLO_URL = "/simbolo-acokorte.png";
const PROPORCAO = 169 / 124; // largura / altura do símbolo recortado

/** Logo completo (símbolo + "AçoKorte") num chip branco, para fundos escuros. */
export function Logo({ altura = 26, className = "" }: { altura?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center justify-center gap-2 rounded-md bg-white ${className}`}
      style={{ height: altura + 18, paddingInline: 12 }}>
      <img src={SIMBOLO_URL} alt="" style={{ height: altura, width: altura * PROPORCAO }} />
      <span className="font-titulo font-extrabold leading-none text-neutral-900 [font-variant:small-caps]"
        style={{ fontSize: altura * 0.95, letterSpacing: "0.01em" }}>
        AçoKorte
      </span>
    </span>
  );
}

/** Só o símbolo, num chip branco. */
export function Simbolo({ altura = 26, className = "" }: { altura?: number; className?: string }) {
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-md bg-white ${className}`}
      style={{ height: altura + 14, width: altura * PROPORCAO + 14 }}>
      <img src={SIMBOLO_URL} alt="Açokorte" style={{ height: altura, width: altura * PROPORCAO }} />
    </span>
  );
}
