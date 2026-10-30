"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export type ItemNav = { href: string; rotulo: string; bloqueadoPor?: string; grupo?: string };
/** Um item solto na barra ou um menu que abre com os itens dele. */
export type EntradaNav = ItemNav | { menu: string; itens: ItemNav[] };

/** Barra de navegação no topo (como no Wialon): as telas principais à vista e o resto em menus. */
export function Nav({ entradas, conta }: { entradas: EntradaNav[]; conta: React.ReactNode }) {
  const atual = usePathname();
  const [aberto, setAberto] = useState<string | null>(null);
  const barra = useRef<HTMLElement>(null);
  const ativo = (href: string) => atual.startsWith(href);

  // Fecha o menu ao trocar de tela e ao clicar fora dele.
  useEffect(() => setAberto(null), [atual]);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => { if (!barra.current?.contains(e.target as Node)) setAberto(null); };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [aberto]);

  const link = (i: ItemNav) => (
    <Link key={i.href} href={i.href} aria-current={ativo(i.href) ? "page" : undefined}>
      <span>{i.rotulo}</span>
      {i.bloqueadoPor && <span className="lock">{i.bloqueadoPor}</span>}
    </Link>
  );
  const menu = (nome: string, conteudo: React.ReactNode, marcado = false, direita = false) => (
    <div key={nome} className={`nav-menu${direita ? " nav-direita" : ""}`} onMouseEnter={() => setAberto(nome)} onMouseLeave={() => setAberto(null)}>
      <button type="button" className={marcado ? "nav-botao marcado" : "nav-botao"} aria-expanded={aberto === nome} onClick={() => setAberto(aberto === nome ? null : nome)}>
        {nome} <span aria-hidden="true">▾</span>
      </button>
      {aberto === nome && <div className="nav-lista">{conteudo}</div>}
    </div>
  );

  return (
    <nav className="nav" ref={barra}>
      {entradas.map((e) => ("menu" in e ? menu(e.menu, e.itens.map(link), e.itens.some((i) => ativo(i.href))) : link(e)))}
      <div className="nav-conta">{menu("Conta", conta, false, true)}</div>
    </nav>
  );
}
