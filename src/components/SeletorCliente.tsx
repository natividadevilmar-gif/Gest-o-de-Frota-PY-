"use client";

import { escolherCliente } from "@/app/(app)/empresa/actions";

export function SeletorCliente({ clientes, atual }: { clientes: { id: string; nome: string }[]; atual: string }) {
  return (
    <form action={escolherCliente} className="form">
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
        <button type="submit">Ver</button>
      </noscript>
    </form>
  );
}
