"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import type { CameraVista, MidiaVista } from "@/lib/video";
import { pedirComando, type Resultado } from "../comandos/actions";
import { QuadroDemo, VideoDemo } from "./CenaDemo";

type Dados = { cameras: CameraVista[]; midias: MidiaVista[]; pedidos: number };

const SITUACAO: Record<string, string> = { movimento: "Em movimento", parado: "Parado ligado", desligado: "Desligado", "sem-sinal": "Sem sinal", aguardando: "Aguardando sinal" };
const quando = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Asuncion", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const hojePy = () => new Date().toLocaleDateString("pt-BR", { timeZone: "America/Asuncion" });
const ehHoje = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Asuncion" }) === hojePy();

export function Video({ inicial, todos, caminhaoInicial, midiaInicial, podePedir, gatilhos }: {
  inicial: Dados; todos: boolean; caminhaoInicial: string | null; midiaInicial: string | null; podePedir: boolean; gatilhos: Record<string, string>;
}) {
  const [dados, setDados] = useState(inicial);
  const [cam, setCam] = useState<string | null>(caminhaoInicial);
  const [tipo, setTipo] = useState<"todos" | "video" | "foto">("todos");
  const [origem, setOrigem] = useState<"todos" | "eventos" | "pedidos">("todos");
  const [aberta, setAberta] = useState<string | null>(midiaInicial);
  const [resultado, setResultado] = useState<Resultado>(null);
  const [pendente, iniciar] = useTransition();

  const url = todos ? "/video/dados?todos=1" : "/video/dados";
  const atualizar = useCallback(async () => {
    const r = await fetch(url, { cache: "no-store" }).catch(() => null);
    if (r?.ok) setDados(await r.json());
  }, [url]);
  useEffect(() => {
    const id = setInterval(atualizar, dados.pedidos > 0 ? 2000 : 30_000);
    return () => clearInterval(id);
  }, [atualizar, dados.pedidos]);

  const midias = useMemo(
    () => dados.midias.filter((m) =>
      (!cam || m.caminhaoId === cam) && (tipo === "todos" || m.tipo === tipo) &&
      (origem === "todos" || (origem === "pedidos" ? m.gatilho === "pedido" : m.gatilho !== "pedido")),
    ),
    [dados.midias, cam, tipo, origem],
  );
  useEffect(() => {
    const fechar = (e: KeyboardEvent) => { if (e.key === "Escape") setAberta(null); };
    window.addEventListener("keydown", fechar);
    return () => window.removeEventListener("keydown", fechar);
  }, []);
  const atual = dados.midias.find((m) => m.id === aberta) ?? null;
  const hoje = dados.midias.filter((m) => ehHoje(m.data));
  const camSel = dados.cameras.find((c) => c.id === cam) ?? null;

  function pedir(c: CameraVista, t: "foto" | "video", camera: "frontal" | "cabine") {
    iniciar(async () => {
      const r = await pedirComando({ caminhaoId: c.id, tipo: t, camera });
      setResultado(r);
      await atualizar();
    });
  }

  return (
    <div className="video">
      <div className="central-kpis">
        <div className="ck"><b>{dados.cameras.filter((c) => c.online).length}/{dados.cameras.length}</b><span>Câmeras online</span></div>
        <div className="ck ck-alta"><b>{hoje.filter((m) => m.gatilho !== "pedido").length}</b><span>Eventos gravados hoje</span></div>
        <div className="ck"><b>{hoje.filter((m) => m.tipo === "video").length}</b><span>Vídeos hoje</span></div>
        <div className="ck"><b>{hoje.filter((m) => m.tipo === "foto").length}</b><span>Fotos hoje</span></div>
        {dados.pedidos > 0 && <div className="ck ck-media"><b>{dados.pedidos}</b><span>Pedidos chegando</span></div>}
      </div>

      <div className="cmd-corpo">
        <div className="card cmd-lista">
          <ul>
            <li>
              <button type="button" aria-current={!cam ? "true" : undefined} onClick={() => setCam(null)}>
                <span className="cmd-placa"><b>Todos os caminhões</b><small>{dados.midias.length} gravações nos últimos dias</small></span>
              </button>
            </li>
            {dados.cameras.map((c) => (
              <li key={c.id}>
                <button type="button" aria-current={c.id === cam ? "true" : undefined} onClick={() => setCam(c.id)}>
                  <span className={`ponto ponto-${c.situacao}`} />
                  <span className="cmd-placa">
                    <b>{c.placa}</b>
                    <small>{todos ? `${c.cliente} · ` : ""}{c.online ? "Câmera online" : "Câmera offline"} · {SITUACAO[c.situacao] ?? c.situacao}</small>
                  </span>
                  {c.midiasHoje > 0 && <span className="pill info">{c.midiasHoje}</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="cmd-detalhe">
          {camSel && podePedir && (
            <div className="card">
              <div className="cmd-topo">
                <div>
                  <h2>{camSel.placa}</h2>
                  <small>{camSel.modelo}{camSel.motorista ? ` · ${camSel.motorista}` : ""}{camSel.local ? ` · ${camSel.local}` : ""}</small>
                </div>
                <span className={`pill sit-${camSel.situacao}`}>{SITUACAO[camSel.situacao] ?? camSel.situacao} · {camSel.velocidadeKmh} km/h</span>
              </div>
              <div className="cmd-linha">
                <button type="button" disabled={pendente} onClick={() => pedir(camSel, "foto", "frontal")}>Foto da estrada</button>
                <button type="button" disabled={pendente} onClick={() => pedir(camSel, "foto", "cabine")}>Foto da cabine</button>
                <button type="button" disabled={pendente} onClick={() => pedir(camSel, "video", "frontal")}>Vídeo da estrada (10 s)</button>
                <button type="button" disabled={pendente} onClick={() => pedir(camSel, "video", "cabine")}>Vídeo da cabine (10 s)</button>
                <a href={`/comandos?caminhao=${camSel.id}`}>Comandos →</a>
              </div>
              {resultado && <p className={`pill ${resultado.ok ? "ok" : "bad"}`} role="status">{resultado.msg}{resultado.ok ? " Chega em alguns segundos." : ""}</p>}
            </div>
          )}

          <div className="card">
            <div className="cmd-linha video-filtros">
              <div className="alternar alternar-p" role="group" aria-label="Tipo">
                <button type="button" aria-current={tipo === "todos" ? "true" : undefined} onClick={() => setTipo("todos")}>Tudo</button>
                <button type="button" aria-current={tipo === "video" ? "true" : undefined} onClick={() => setTipo("video")}>Vídeos</button>
                <button type="button" aria-current={tipo === "foto" ? "true" : undefined} onClick={() => setTipo("foto")}>Fotos</button>
              </div>
              <div className="alternar alternar-p" role="group" aria-label="Origem">
                <button type="button" aria-current={origem === "todos" ? "true" : undefined} onClick={() => setOrigem("todos")}>Todas</button>
                <button type="button" aria-current={origem === "eventos" ? "true" : undefined} onClick={() => setOrigem("eventos")}>Eventos</button>
                <button type="button" aria-current={origem === "pedidos" ? "true" : undefined} onClick={() => setOrigem("pedidos")}>Pedidas</button>
              </div>
            </div>
            {midias.length === 0 ? <p className="note">Nenhuma gravação com esses filtros.</p> : (
              <ul className="galeria">
                {midias.map((m) => (
                  <li key={m.id}>
                    <button type="button" onClick={() => setAberta(m.id)} aria-label={`Abrir ${m.tipo} de ${m.placa}`}>
                      <Miniatura m={m} />
                      <span className="galeria-info">
                        <b>{m.placa} <small>{m.tipo === "video" ? (m.duracaoS ? `▶ ${m.duracaoS}s` : "▶ vídeo") : "foto"} · {m.camera === "cabine" ? "cabine" : "estrada"}</small></b>
                        <small className={m.gatilho === "pedido" ? undefined : "t-bad"}>{gatilhos[m.gatilho] ?? m.gatilho}</small>
                        <small>{quando(m.data)}{todos ? ` · ${m.cliente}` : ""}</small>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {atual && (
        <div className="visor" role="dialog" aria-modal="true" aria-label={`${atual.tipo === "video" ? "Vídeo" : "Foto"} de ${atual.placa}`} onClick={(e) => { if (e.target === e.currentTarget) setAberta(null); }}>
          <div className="visor-caixa">
            <div className="cmd-topo">
              <div>
                <h2>{atual.placa} · {gatilhos[atual.gatilho] ?? atual.gatilho}</h2>
                <small>
                  {quando(atual.data)} · câmera {atual.camera === "cabine" ? "da cabine" : "da estrada"}
                  {atual.velocidadeKmh != null ? ` · ${atual.velocidadeKmh} km/h` : ""}{todos ? ` · ${atual.cliente}` : ""}
                  {atual.demo ? " · demonstração" : ""}
                </small>
                {atual.ocorrencia && <small>Alerta: {atual.ocorrencia}</small>}
              </div>
              <button type="button" onClick={() => setAberta(null)} aria-label="Fechar">Fechar</button>
            </div>
            <Midia m={atual} />
            <div className="cmd-linha">
              {atual.lat != null && atual.lng != null && (
                <a href={`https://www.openstreetmap.org/?mlat=${atual.lat}&mlon=${atual.lng}#map=15/${atual.lat}/${atual.lng}`} target="_blank" rel="noreferrer">Ver no mapa</a>
              )}
              {!atual.demo && <a href={`/video/midia/${atual.id}?baixar=1`}>Baixar arquivo</a>}
              {atual.ocorrencia && <a href="/monitoramento">Abrir a central</a>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Miniatura({ m }: { m: MidiaVista }) {
  if (m.demo) return <QuadroDemo midia={m} className="galeria-img" />;
  if (m.tipo === "foto") return <img src={`/video/midia/${m.id}`} alt="" className="galeria-img" loading="lazy" />;
  if (m.formato === "video/mp4") return <video src={`/video/midia/${m.id}#t=0.5`} className="galeria-img" preload="metadata" muted />;
  return <span className="galeria-img galeria-vazia">Vídeo H.265</span>;
}

function Midia({ m }: { m: MidiaVista }) {
  if (m.demo) return m.tipo === "video" ? <VideoDemo midia={m} /> : <QuadroDemo midia={m} className="visor-midia" />;
  if (m.tipo === "foto") return <img src={`/video/midia/${m.id}`} alt={`Foto da câmera de ${m.placa}`} className="visor-midia" />;
  if (m.formato === "video/mp4") return <video src={`/video/midia/${m.id}`} className="visor-midia" controls autoPlay />;
  return <p className="note">Este vídeo veio em H.265 e o servidor não tinha o ffmpeg para converter. Baixe o arquivo para assistir no VLC.</p>;
}
