"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type ItemNav = { href: string; rotulo: string; bloqueadoPor?: string; grupo?: string };

export function Nav({ itens }: { itens: ItemNav[] }) {
  const atual = usePathname();
  return (
    <nav className="nav">
      {itens.map((i) => (
        <div key={i.href} style={{ display: "contents" }}>
          {i.grupo && <div className="navgrp">{i.grupo}</div>}
          <Link href={i.href} aria-current={atual.startsWith(i.href) ? "page" : undefined}>
            <span>{i.rotulo}</span>
            {i.bloqueadoPor && <span className="lock">{i.bloqueadoPor}</span>}
          </Link>
        </div>
      ))}
    </nav>
  );
}
