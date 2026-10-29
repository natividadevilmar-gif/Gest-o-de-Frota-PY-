"use client";

import { useRouter } from "next/navigation";
import { useRef } from "react";
import { escolherCliente } from "@/app/(app)/empresa/actions";

/** Lista de clientes ao lado do título (mapa e central): um cliente ou todos juntos. */
export function FiltroCliente({ clientes, atual, todos, caminho }: { clientes: { id: string; nome: string }[]; atual: string; todos: boolean; caminho: string }) {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  return (
    <form ref={form} key={`${atual}-${todos}`} action={escolherCliente} className="filtro-cliente">
      <input type="hidden" name="voltar" value={caminho} />
      <label>
        <span>Cliente</span>
        <select
          name="clienteId"
          defaultValue={todos ? "todos" : atual}
          onChange={(e) => (e.target.value === "todos" ? router.push(`${caminho}?todos=1`) : form.current?.requestSubmit())}
        >
          <option value="todos">Todos os clientes</option>
          {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      </label>
    </form>
  );
}
