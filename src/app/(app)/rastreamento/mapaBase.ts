import type * as Leaflet from "leaflet";

// Fundos do mapa (mapa de ruas ou imagem de satélite) e o andar suave dos caminhões, usados no mapa ao vivo e na Central.

const CHAVE_FUNDO = "kmcero-mapa-fundo";
const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services";

/** Põe no mapa a escolha entre "Mapa" e "Satélite" (com nomes de ruas e cidades por cima) e lembra a última usada. */
export function fundosDoMapa(L: typeof Leaflet, m: Leaflet.Map) {
  const fundos: Record<string, Leaflet.Layer> = {
    Mapa: L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }),
    Satélite: L.layerGroup([
      L.tileLayer(`${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`, { maxZoom: 19, attribution: "Imagens &copy; Esri, Maxar, Earthstar Geographics" }),
      L.tileLayer(`${ESRI}/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}`, { maxZoom: 19 }),
      L.tileLayer(`${ESRI}/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`, { maxZoom: 19 }),
    ]),
  };
  let escolhido = "Mapa";
  try {
    const salvo = localStorage.getItem(CHAVE_FUNDO);
    if (salvo && salvo in fundos) escolhido = salvo;
  } catch {
    // Sem acesso ao armazenamento do navegador: começa no mapa de ruas.
  }
  fundos[escolhido].addTo(m);
  L.control.layers(fundos, undefined, { collapsed: false, position: "topright" }).addTo(m);
  m.on("baselayerchange", (e: Leaflet.LayersControlEvent) => {
    try {
      localStorage.setItem(CHAVE_FUNDO, e.name);
    } catch {
      // Segue sem lembrar a escolha.
    }
  });
}

type Ponto = [number, number];
type Movel = { setLatLng(p: Ponto): unknown; getLatLng(): Leaflet.LatLng };
type Item = { camada: Movel; de: Ponto; para: Ponto; t0: number; dur: number; em: string | null };

const MAX_ANDAR_MS = 60_000;
const MIN_ANDAR_MS = 3_000;
/** Pulo maior que isso (ex.: sinal voltou depois de horas) vai direto, sem atravessar o mapa. */
const PULO_KM = 30;

function km(a: Ponto, b: Ponto) {
  const r = Math.PI / 180;
  const x = (b[1] - a[1]) * r * Math.cos(((a[0] + b[0]) / 2) * r);
  const y = (b[0] - a[0]) * r;
  return Math.hypot(x, y) * 6371;
}

/**
 * Faz o marcador andar do ponto onde está até a posição nova, no mesmo tempo que o caminhão levou
 * entre os dois sinais. Assim ele segue andando na tela até chegar o sinal seguinte, em vez de pular.
 */
export class Movimento {
  private itens = new Map<string, Item>();
  private quadro = 0;

  ir(id: string, camada: Movel, para: Ponto, em: string | null) {
    const a = this.itens.get(id);
    const agora = performance.now();
    if (!a || a.camada !== camada) {
      camada.setLatLng(para);
      this.itens.set(id, { camada, de: para, para, t0: agora, dur: 0, em });
      return;
    }
    if (a.para[0] === para[0] && a.para[1] === para[1]) return;
    const atual = camada.getLatLng();
    const de: Ponto = [atual.lat, atual.lng];
    const passo = a.em && em ? new Date(em).getTime() - new Date(a.em).getTime() : 0;
    const dur = km(de, para) > PULO_KM ? 0 : Math.min(Math.max(passo, MIN_ANDAR_MS), MAX_ANDAR_MS);
    Object.assign(a, { de, para, t0: agora, dur, em });
    if (!dur) camada.setLatLng(para);
    else this.animar();
  }

  esquecer(id: string) {
    this.itens.delete(id);
  }

  parar() {
    cancelAnimationFrame(this.quadro);
    this.quadro = 0;
    this.itens.clear();
  }

  private animar() {
    if (this.quadro) return;
    const passo = () => {
      const agora = performance.now();
      let falta = false;
      for (const a of this.itens.values()) {
        if (!a.dur) continue;
        const t = Math.min((agora - a.t0) / a.dur, 1);
        a.camada.setLatLng([a.de[0] + (a.para[0] - a.de[0]) * t, a.de[1] + (a.para[1] - a.de[1]) * t]);
        if (t < 1) falta = true;
        else a.dur = 0;
      }
      this.quadro = falta ? requestAnimationFrame(passo) : 0;
    };
    this.quadro = requestAnimationFrame(passo);
  }
}
