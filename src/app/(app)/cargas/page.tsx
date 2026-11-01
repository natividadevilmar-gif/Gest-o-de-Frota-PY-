import Link from "next/link";
import { Placa } from "@/components/ui";
import { clienteAtual } from "@/lib/acesso";
import { db } from "@/lib/db";
import { num } from "@/lib/formato";

const DIAS = 30;

const quando = (d: Date) =>
  d.toLocaleString("pt-BR", { timeZone: "America/Asuncion", weekday: "short", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });

/** Fotos e vídeos da carga enviados pelos motoristas, com a data e a hora do servidor. */
export default async function Cargas({ searchParams }: { searchParams: Promise<{ caminhao?: string }> }) {
  const { cliente } = await clienteAtual();
  const filtro = (await searchParams).caminhao;
  const caminhoes = await db.caminhao.findMany({ where: { clienteId: cliente.id }, orderBy: { placa: "asc" }, select: { id: true, placa: true } });
  const caminhao = caminhoes.find((c) => c.id === filtro);
  const desde = new Date(Date.now() - DIAS * 86_400_000);
  const registros = await db.registroCarga.findMany({
    where: { clienteId: cliente.id, criadoEm: { gte: desde }, ...(caminhao ? { caminhaoId: caminhao.id } : {}) },
    orderBy: { criadoEm: "desc" },
    take: 120,
    select: {
      id: true, tipo: true, duracaoS: true, tamanho: true, lat: true, lng: true, precisaoM: true, observacao: true, criadoEm: true,
      caminhao: { select: { placa: true } }, motorista: { select: { nome: true } },
    },
  });

  return (
    <>
      <div className="card-h">
        <h1>Fotos da carga</h1>
        <form className="form" style={{ alignItems: "flex-end" }}>
          <label>Caminhão
            <select name="caminhao" defaultValue={caminhao?.id ?? ""}>
              <option value="">Todos</option>
              {caminhoes.map((c) => <option key={c.id} value={c.id}>{c.placa}</option>)}
            </select>
          </label>
          <button type="submit">Ver</button>
        </form>
      </div>
      <div className="card">
        <div className="card-h">
          <h2>Últimos {DIAS} dias · {registros.length} {registros.length === 1 ? "envio" : "envios"}</h2>
          <p>A data e a hora são as do servidor na chegada do arquivo: o celular do motorista não consegue alterar. <Link href="/despesas#carga">Enviar uma agora</Link></p>
        </div>
        {registros.length === 0 ? (
          <p className="note">Nenhuma foto ou vídeo de carga ainda. O motorista envia pelo celular, na tela de despesas, no botão &quot;Foto e vídeo da carga&quot;.</p>
        ) : (
          <ul className="cargas-grade">
            {registros.map((r) => (
              <li key={r.id}>
                {r.tipo === "foto" ? (
                  <a href={`/carga/${r.id}`} target="_blank" rel="noopener"><img src={`/carga/${r.id}`} alt={`Foto da carga de ${r.caminhao.placa}`} loading="lazy" /></a>
                ) : (
                  <video src={`/carga/${r.id}`} controls playsInline preload="metadata" />
                )}
                <div className="cargas-info">
                  <b><Placa placa={r.caminhao.placa} /> {r.motorista?.nome ?? ""}</b>
                  <span>{r.tipo === "foto" ? "📷" : `🎥 ${r.duracaoS ? `${r.duracaoS}s · ` : ""}`} {quando(r.criadoEm)}</span>
                  {r.observacao && <span>“{r.observacao}”</span>}
                  <small>
                    {r.lat != null && r.lng != null
                      ? <a href={`https://www.google.com/maps?q=${r.lat},${r.lng}`} target="_blank" rel="noopener">ver local no mapa</a>
                      : "sem local (GPS do celular desligado)"}
                    {r.precisaoM != null && ` · ±${num(r.precisaoM)} m`}
                    {" · "}<a href={`/carga/${r.id}?baixar=1`}>baixar</a>
                  </small>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
