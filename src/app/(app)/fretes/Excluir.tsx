"use client";

import { excluirFrete } from "./actions";

export function ExcluirFrete({ id, rota }: { id: string; rota: string }) {
  return (
    <form action={excluirFrete} onSubmit={(e) => { if (!confirm(`Excluir o frete ${rota}?`)) e.preventDefault(); }}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="link">excluir</button>
    </form>
  );
}
