import type { Metadata } from "next";
import { Marca } from "@/components/Marca";
import { db } from "@/lib/db";
import { kmRestantes, lerRota, previsaoChegada, CHEGOU_KM, type PontoRota } from "@/lib/rastreio/linkRastreio";
import { posicaoDemo } from "@/lib/rastreio/rotas";
import { espelharSeDevido } from "@/lib/rastreio/wialon";
import { ehImei } from "@/lib/telemetria/posicoes";
import { MapaEntrega } from "./MapaEntrega";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Rastreo de carga · KM Cero", robots: { index: false, follow: false } };

const SEM_SINAL_MS = 30 * 60_000;

const T = {
  es: {
    encerrado: "Este enlace de seguimiento ya no está activo.", pede: "Pedí un enlace nuevo a la transportadora.",
    caminhao: "Camión", transporte: "Transporte", chegada: "Llegada estimada", faltam: "Faltan", chegou: "Llegó al destino",
    movimento: "En viaje", parado: "Detenido", semSinal: "Sin señal reciente", desligado: "Motor apagado", semPosicao: "Esperando la primera posición",
    atualizado: "Última posición", estimativa: "Estimación a 60 km/h de promedio; puede variar con paradas, aduana y tránsito.", atualiza: "La página se actualiza sola cada minuto.",
  },
  pt: {
    encerrado: "Este link de acompanhamento não está mais ativo.", pede: "Peça um link novo à transportadora.",
    caminhao: "Caminhão", transporte: "Transporte", chegada: "Chegada prevista", faltam: "Faltam", chegou: "Chegou ao destino",
    movimento: "Em viagem", parado: "Parado", semSinal: "Sem sinal recente", desligado: "Motor desligado", semPosicao: "Aguardando a primeira posição",
    atualizado: "Última posição", estimativa: "Estimativa a 60 km/h de média; pode variar com paradas, aduana e trânsito.", atualiza: "A página se atualiza sozinha a cada minuto.",
  },
};

/** Página pública do frete: o destinatário vê o caminhão, a rota e a previsão de chegada, sem login. */
export default async function Rastreio({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const agora = new Date();
  const v = /^[A-Za-z0-9_-]{16,40}$/.test(token) ? await db.viagem.findUnique({
    where: { linkToken: token },
    select: {
      origem: true, destino: true, paisDestino: true, linkExpiraEm: true, rota: true,
      caminhao: { select: { id: true, placa: true, rastreadorId: true, ultimaLat: true, ultimaLng: true, ultimaPosicaoEm: true, ultimaVelocidade: true, ultimaIgnicao: true, ultimaDirecao: true, cliente: { select: { nome: true } } } },
    },
  }) : null;
  const t = T[v?.paisDestino === "BR" ? "pt" : "es"];

  if (!v || !v.linkExpiraEm || v.linkExpiraEm <= agora) {
    return (
      <main className="rastreio-publico">
        <header><Marca tamanho={20} /></header>
        <section className="card"><h1>{t.encerrado}</h1><p className="muted">{t.pede}</p></section>
      </main>
    );
  }

  // Traz do Wialon a posição mais nova (no máximo uma vez por minuto para todos).
  await espelharSeDevido(db, agora).catch(() => undefined);
  const c = await db.caminhao.findUniqueOrThrow({ where: { id: v.caminhao.id }, select: { ultimaLat: true, ultimaLng: true, ultimaPosicaoEm: true, ultimaVelocidade: true, ultimaIgnicao: true, ultimaDirecao: true } })
    .catch(() => v.caminhao);

  let pos: { lat: number; lng: number; direcao: number; vel: number; em: Date; ignicao: boolean | null } | null = null;
  if (ehImei(v.caminhao.rastreadorId)) {
    if (c.ultimaLat != null && c.ultimaLng != null && c.ultimaPosicaoEm) {
      pos = { lat: c.ultimaLat, lng: c.ultimaLng, direcao: c.ultimaDirecao ?? 0, vel: c.ultimaVelocidade ?? 0, em: c.ultimaPosicaoEm, ignicao: c.ultimaIgnicao };
    }
  } else if (v.caminhao.rastreadorId) {
    const p = posicaoDemo(v.caminhao.id, agora);
    pos = { lat: p.lat, lng: p.lng, direcao: p.direcao, vel: p.velocidadeKmh, em: agora, ignicao: p.ignicao };
  }

  const rota = lerRota(v.rota);
  const km = pos && rota ? kmRestantes([pos.lat, pos.lng], rota) : null;
  const chegou = km != null && km <= CHEGOU_KM;
  const eta = km != null ? previsaoChegada(km, agora) : null;
  const fuso = v.paisDestino === "BR" ? "America/Sao_Paulo" : "America/Asuncion";
  const lingua = v.paisDestino === "BR" ? "pt-BR" : "es-PY";
  const hora = (d: Date) => d.toLocaleString(lingua, { timeZone: fuso, weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const situacao = !pos ? t.semPosicao
    : chegou ? t.chegou
    : agora.getTime() - pos.em.getTime() > SEM_SINAL_MS ? t.semSinal
    : pos.ignicao === false ? t.desligado
    : pos.vel > 3 ? t.movimento : t.parado;

  return (
    <main className="rastreio-publico">
      <header>
        <Marca tamanho={20} />
        <span className="muted">{t.transporte}: {v.caminhao.cliente.nome}</span>
      </header>
      <section className="card rastreio-resumo">
        <p className="rota-nome">{v.origem} → <b>{v.destino}</b></p>
        <div className="rastreio-numeros">
          <div><small>{t.caminhao}</small><b>{v.caminhao.placa}</b></div>
          <div><small>&nbsp;</small><b className={chegou ? "t-ok" : ""}>{situacao}</b></div>
          {eta && <div><small>{t.chegada}</small><b>{hora(eta)}</b></div>}
          {km != null && !chegou && <div><small>{t.faltam}</small><b>{Math.round(km).toLocaleString(lingua)} km</b></div>}
        </div>
        {pos && <p className="muted"><small>{t.atualizado}: {hora(pos.em)}</small></p>}
      </section>
      <MapaEntrega
        caminhao={pos ? { lat: pos.lat, lng: pos.lng, direcao: pos.direcao } : null}
        rota={rota as PontoRota[] | null}
      />
      <p className="muted"><small>{eta ? `${t.estimativa} ` : ""}{t.atualiza}</small></p>
    </main>
  );
}
