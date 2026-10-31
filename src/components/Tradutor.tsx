"use client";

import { useEffect } from "react";
import type { IdiomaTraduzido } from "@/lib/i18n/idiomas";
import type { Tradutor as FuncaoTradutor } from "@/lib/i18n/traduzir";

// As telas são escritas em português. Em outro idioma, este componente troca
// os textos da página pelos do dicionário depois que o React monta a tela, e
// continua trocando o que aparecer depois (navegação, mapa, mensagens).
const ATRIBUTOS = ["placeholder", "title", "aria-label", "alt"];
const PULAR = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "CODE", "PRE", "svg"]);

export function Tradutor({ idioma }: { idioma: IdiomaTraduzido }) {
  useEffect(() => {
    let parar = false;
    let observador: MutationObserver | null = null;
    const raiz = document.documentElement;
    const confirmar = window.confirm;
    const avisar = window.alert;

    void Promise.all([import("@/lib/i18n/frases"), import("@/lib/i18n/traduzir")]).then(([{ FRASES }, { criarTradutor }]) => {
      if (parar) return;
      const t: FuncaoTradutor = criarTradutor(FRASES, idioma);
      // Último texto que este componente escreveu em cada nó, para não traduzir duas vezes.
      const escrito = new WeakMap<Node, string>();
      const escritoAttr = new WeakMap<Element, Map<string, string>>();

      const pular = (el: Element | null): boolean => {
        for (let e = el; e; e = e.parentElement) {
          if (PULAR.has(e.tagName) || e.getAttribute("translate") === "no" || (e as HTMLElement).isContentEditable) return true;
        }
        return false;
      };
      const texto = (n: Text) => {
        const v = n.nodeValue;
        if (!v || escrito.get(n) === v || !/\p{L}/u.test(v)) return;
        const r = t(v);
        if (r === null || r === v) return;
        escrito.set(n, r);
        n.nodeValue = r;
      };
      const atributo = (el: Element, nome: string) => {
        const v = el.getAttribute(nome);
        if (!v) return;
        const feitos = escritoAttr.get(el) ?? new Map<string, string>();
        if (feitos.get(nome) === v) return;
        const r = t(v);
        if (r === null || r === v) return;
        feitos.set(nome, r);
        escritoAttr.set(el, feitos);
        el.setAttribute(nome, r);
      };
      const elemento = (el: Element) => {
        if (pular(el)) return;
        for (const a of ATRIBUTOS) atributo(el, a);
        if (el instanceof HTMLInputElement && (el.type === "submit" || el.type === "button")) atributo(el, "value");
        const it = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
          acceptNode: (n) => (n.nodeType === 1 && (PULAR.has((n as Element).tagName) || (n as Element).getAttribute("translate") === "no") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
        });
        for (let n = it.nextNode(); n; n = it.nextNode()) {
          if (n.nodeType === 3) texto(n as Text);
          else for (const a of ATRIBUTOS) atributo(n as Element, a);
        }
      };

      const titulo = document.title && t(document.title);
      if (titulo) document.title = titulo;
      elemento(document.body);
      raiz.removeAttribute("data-traduzindo");

      observador = new MutationObserver((mudancas) => {
        for (const m of mudancas) {
          if (m.type === "characterData") {
            if (m.target.nodeType === 3 && !pular(m.target.parentElement)) texto(m.target as Text);
          } else if (m.type === "attributes") {
            const el = m.target as Element;
            const botao = el instanceof HTMLInputElement && (el.type === "submit" || el.type === "button");
            // value só nos botões: o valor de um campo é dado do usuário.
            if (m.attributeName && (m.attributeName !== "value" || botao) && !pular(el)) atributo(el, m.attributeName);
          } else {
            m.addedNodes.forEach((n) => {
              if (n.nodeType === 1) elemento(n as Element);
              else if (n.nodeType === 3 && !pular(n.parentElement)) texto(n as Text);
            });
          }
        }
      });
      observador.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...ATRIBUTOS, "value"] });
      // O título muda a cada tela.
      const cabeca = document.querySelector("title");
      if (cabeca) observador.observe(cabeca, { childList: true, characterData: true, subtree: true });

      window.confirm = (msg?: string) => confirmar.call(window, msg ? (t(msg) ?? msg) : msg);
      window.alert = (msg?: unknown) => avisar.call(window, typeof msg === "string" ? (t(msg) ?? msg) : msg);
    }).catch(() => raiz.removeAttribute("data-traduzindo"));

    return () => {
      parar = true;
      observador?.disconnect();
      window.confirm = confirmar;
      window.alert = avisar;
    };
  }, [idioma]);
  return null;
}
