"use client";

import { useEffect, useState } from "react";

type PedidoInstalacao = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> };

// O Chrome avisa só uma vez, logo ao abrir a página, que dá para instalar: guardamos o aviso
// aqui para o botão do menu Conta usar depois.
let pedido: PedidoInstalacao | null = null;
const ouvintes = new Set<() => void>();

/** Fica no layout escutando o aviso de instalação do navegador. Não mostra nada. */
export function OuvirInstalacao() {
  useEffect(() => {
    const guardar = (e: Event) => { e.preventDefault(); pedido = e as PedidoInstalacao; ouvintes.forEach((f) => f()); };
    window.addEventListener("beforeinstallprompt", guardar);
    return () => window.removeEventListener("beforeinstallprompt", guardar);
  }, []);
  return null;
}

/** Item do menu Conta: instala a KM Cero como aplicativo, ou explica como fazer no iPhone. */
export function InstalarApp() {
  const [, atualizar] = useState(0);
  const [instalado, setInstalado] = useState(false);
  useEffect(() => {
    setInstalado(window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true);
    const f = () => atualizar((n) => n + 1);
    ouvintes.add(f);
    return () => { ouvintes.delete(f); };
  }, []);
  if (instalado) return null;
  return (
    <button type="button" className="nav-instalar" onClick={async () => {
      if (pedido) {
        await pedido.prompt();
        pedido = null;
        return;
      }
      const iphone = /iphone|ipad|ipod/i.test(navigator.userAgent);
      alert(iphone
        ? "No iPhone: abra a KM Cero no Safari, toque em Compartilhar (o quadrado com a seta para cima) e depois em \"Adicionar à Tela de Início\"."
        : "No Chrome: toque no menu ⋮ (no canto de cima) e depois em \"Instalar app\" ou \"Adicionar à tela inicial\".");
    }}>📱 Instalar no celular</button>
  );
}
