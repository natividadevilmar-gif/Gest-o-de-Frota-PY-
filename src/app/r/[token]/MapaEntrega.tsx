"use client";

import "leaflet/dist/leaflet.css";
import type * as Leaflet from "leaflet";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { fundosDoMapa } from "@/app/(app)/rastreamento/mapaBase";

type Ponto = [number, number];

/** Mapa da página pública: rota prevista, destino e o caminhão. Recarrega os dados a cada minuto. */
export function MapaEntrega({ caminhao, rota }: { caminhao: { lat: number; lng: number; direcao: number } | null; rota: Ponto[] | null }) {
  const caixa = useRef<HTMLDivElement>(null);
  const mapa = useRef<{ m: Leaflet.Map; L: typeof Leaflet; marca: Leaflet.Marker | null; ajustado: boolean } | null>(null);
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), 60_000);
    return () => clearInterval(id);
  }, [router]);

  useEffect(() => {
    let vivo = true;
    import("leaflet").then((L) => {
      if (!vivo || !caixa.current || mapa.current) return;
      const m = L.map(caixa.current, { zoomControl: true }).setView([-25.3, -57.6], 6);
      fundosDoMapa(L, m);
      if (rota) {
        L.polyline(rota, { color: "#0e7490", weight: 5, opacity: 0.8 }).addTo(m);
        L.circleMarker(rota[0], { radius: 6, color: "#fff", weight: 2, fillColor: "#64748b", fillOpacity: 1 }).addTo(m);
        L.marker(rota.at(-1)!, { icon: L.divIcon({ className: "", html: '<div class="mk-destino">🏁</div>', iconSize: [28, 28], iconAnchor: [6, 26] }) }).addTo(m);
      }
      mapa.current = { m, L, marca: null, ajustado: false };
      setTimeout(() => m.invalidateSize(), 0);
      desenhar();
    });
    return () => { vivo = false; mapa.current?.m.remove(); mapa.current = null; };
    // O mapa nasce uma vez; as posições novas entram pelo efeito de baixo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function desenhar() {
    const s = mapa.current;
    if (!s) return;
    if (caminhao) {
      const p: Ponto = [caminhao.lat, caminhao.lng];
      const html = `<div class="mk-entrega" style="transform:rotate(${caminhao.direcao}deg)"><svg viewBox="0 0 24 24" width="30" height="30"><circle cx="12" cy="12" r="10" fill="#0e7490" stroke="#fff" stroke-width="2"/><path d="M12 5 17 16 12 13.5 7 16Z" fill="#fff"/></svg></div>`;
      const icone = s.L.divIcon({ className: "", html, iconSize: [30, 30], iconAnchor: [15, 15] });
      if (s.marca) s.marca.setLatLng(p).setIcon(icone);
      else s.marca = s.L.marker(p, { icon: icone, zIndexOffset: 1000 }).addTo(s.m);
    }
    if (!s.ajustado) {
      const pontos: Ponto[] = [...(rota ?? []), ...(caminhao ? [[caminhao.lat, caminhao.lng] as Ponto] : [])];
      if (pontos.length > 1) s.m.fitBounds(s.L.latLngBounds(pontos), { padding: [30, 30] });
      else if (pontos.length === 1) s.m.setView(pontos[0], 12);
      s.ajustado = true;
    }
  }

  useEffect(desenhar);

  return <div ref={caixa} className="mapa-entrega" />;
}
