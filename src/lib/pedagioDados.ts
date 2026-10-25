import "server-only";
import { cotacaoDoDia } from "@/lib/cotacao";
import { db } from "@/lib/db";
import { taxasPedagio, type RotaComPracas } from "@/lib/pedagio";

const uyuPorUsd = () => Number(process.env.COTACAO_UYU_POR_USD ?? 40);

export async function taxasDoDia() {
  return taxasPedagio(await cotacaoDoDia(), uyuPorUsd());
}

/** Rotas com as praças na ordem da ida. */
export async function rotasPedagio(): Promise<RotaComPracas[]> {
  const [rotas, pracas] = await Promise.all([
    db.rotaPedagio.findMany({ orderBy: { nome: "asc" } }),
    db.pracaPedagio.findMany(),
  ]);
  const porId = new Map(pracas.map((p) => [p.id, p]));
  return rotas.map((r) => ({
    id: r.id,
    nome: r.nome,
    km: r.km,
    paises: r.paises,
    pracas: r.pracas.flatMap((id) => {
      const p = porId.get(id);
      return p ? [{ id: p.id, pais: p.pais, rodovia: p.rodovia, nome: p.nome, moeda: p.moeda, tarifaEixo: p.tarifaEixo, tarifaFixa: p.tarifaFixa }] : [];
    }),
  }));
}
