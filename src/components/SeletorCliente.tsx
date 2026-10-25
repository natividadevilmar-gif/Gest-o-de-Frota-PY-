"use client";

import { escolherCliente } from "@/app/(app)/empresa/actions";

export function SeletorCliente({ clientes, atual }: { clientes: { id: string; nome: string }[]; atual: string }) {
  return (
    // key: refaz o seletor quando o cliente muda, para ele nunca mostrar o anterior.
    <form key={atual} action={escolherCliente} className="form">
      <label htmlFor="cliente">
        Ver dados do cliente
        <select id="cliente" name="clienteId" defaultValue={atual} onChange={(e) => e.currentTarget.form?.requestSubmit()}>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
      </label>
      <noscript>
        <button type="submit">Abrir</button>
      </noscript>
    </form>
  );
}
