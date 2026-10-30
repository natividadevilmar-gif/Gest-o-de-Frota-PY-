// Imagem de satélite do lugar onde está o caminhão, para alertas e painéis.

const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services";

/** Endereços das imagens (satélite e estradas) de uns 3 km em volta do ponto. */
export function imagensDoLocal(lat: number, lng: number) {
  const dy = 0.008, dx = dy * 2 / Math.cos((lat * Math.PI) / 180);
  const q = `bbox=${lng - dx},${lat - dy},${lng + dx},${lat + dy}&bboxSR=4326&imageSR=3857&size=480,240&f=image`;
  return {
    satelite: `${ESRI}/World_Imagery/MapServer/export?${q}&format=jpg`,
    estradas: `${ESRI}/Reference/World_Transportation/MapServer/export?${q}&format=png32&transparent=true`,
    mapa: `https://www.google.com/maps?q=${lat},${lng}`,
  };
}

/** A mesma imagem em HTML puro, para o balão do Leaflet. */
export function fotoLocalHtml(lat: number, lng: number, placa: string) {
  const i = imagensDoLocal(lat, lng);
  const p = placa.replace(/[<>&"]/g, "");
  return `<b>${p}</b><a class="oc-foto" href="${i.mapa}" target="_blank" rel="noreferrer"><img src="${i.satelite}" alt="Imagem de satélite onde está ${p}"><img src="${i.estradas}" alt=""><i></i><small>${lat.toFixed(5)}, ${lng.toFixed(5)} · abrir no mapa</small></a>`;
}

/** Imagem de satélite (Esri) de uns 3 km em volta do caminhão, com as estradas e o ponto marcado. */
export function FotoLocal({ lat, lng, placa }: { lat: number; lng: number; placa: string }) {
  const i = imagensDoLocal(lat, lng);
  return (
    <a className="oc-foto" href={i.mapa} target="_blank" rel="noreferrer" title="Abrir no Google Maps">
      <img src={i.satelite} alt={`Imagem de satélite onde está ${placa}`} loading="lazy" />
      <img src={i.estradas} alt="" loading="lazy" />
      <i aria-hidden="true" />
      <small>{lat.toFixed(5)}, {lng.toFixed(5)} · abrir no mapa</small>
    </a>
  );
}
