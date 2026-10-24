"use client";

import Link from "next/link";
import { useState } from "react";

export type Cartao = { id: string; nome: string; placa: string | null; saldo: string; saldoNegativo: boolean; detalhe: string; aberto: boolean };

/** Um cartão por motorista com o saldo do caixa aberto; toca para ver o detalhe. */
export function CartoesMotoristas({ cartoes }: { cartoes: Cartao[] }) {
  const [busca, setBusca] = useState("");
  const termo = busca.trim().toLowerCase();
  const lista = termo ? cartoes.filter((c) => c.nome.toLowerCase().includes(termo) || c.placa?.toLowerCase().includes(termo)) : cartoes;
  return (
    <>
      {cartoes.length > 6 && (
        <input className="busca-motorista" type="search" placeholder="Buscar motorista ou placa" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar motorista ou placa" />
      )}
      <div className="cartoes-caixa">
        {lista.map((c) => (
          <Link key={c.id} href={`/caixa/${c.id}`} className={`cartao-caixa${c.aberto ? "" : " sem"}`}>
            <span className="nome">{c.nome}{c.placa && <small> · {c.placa}</small>}</span>
            <b className={c.aberto ? (c.saldoNegativo ? "t-bad" : "t-ok") : ""}>{c.saldo}</b>
            <small>{c.detalhe}</small>
          </Link>
        ))}
        {lista.length === 0 && <p className="note">Nenhum motorista encontrado.</p>}
      </div>
    </>
  );
}
