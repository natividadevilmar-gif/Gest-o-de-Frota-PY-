"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Tabela larga com a barra de rolagem lateral presa no pé da tela, enquanto a tabela estiver
 * à vista: não é preciso descer até o fim da tabela para arrastar para a direita.
 */
export function RolagemFixa({ children }: { children: React.ReactNode }) {
  const caixa = useRef<HTMLDivElement>(null);
  const barra = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(0);
  const [precisa, setPrecisa] = useState(false);

  useEffect(() => {
    const c = caixa.current;
    if (!c) return;
    const medir = () => {
      setLargura(c.scrollWidth);
      setPrecisa(c.scrollWidth > c.clientWidth + 1);
    };
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(c);
    if (c.firstElementChild) obs.observe(c.firstElementChild);
    return () => obs.disconnect();
  }, []);

  // As duas rolagens andam juntas: arrastar a barra presa move a tabela, e vice-versa.
  const seguir = (de: HTMLDivElement | null, para: HTMLDivElement | null) => {
    if (de && para && Math.abs(para.scrollLeft - de.scrollLeft) > 1) para.scrollLeft = de.scrollLeft;
  };

  return (
    <>
      <div className="tw tw-fixa" ref={caixa} onScroll={() => seguir(caixa.current, barra.current)}>{children}</div>
      {precisa && (
        <div className="tw-barra" ref={barra} onScroll={() => seguir(barra.current, caixa.current)} aria-hidden="true">
          <div style={{ width: largura, height: 1 }} />
        </div>
      )}
    </>
  );
}
