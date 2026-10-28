"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { BLOQUEIO_ATIVO, type TipoComando } from "@/lib/comandos/catalogo";
import type { CaminhaoComando, ComandoVista } from "@/lib/comandos/dados";
import { cancelarComando, pedirComando, type Resultado } from "./actions";

type Dados = { caminhoes: CaminhaoComando[]; comandos: ComandoVista[] };
type Catalogo = Record<TipoComando, { rotulo: string; descricao: string; texto: string }>;

const ABERTOS = ["pendente", "aguardando", "enviado"];
const STATUS: Record<string, { rotulo: string; pill: string }> = {
  pendente: { rotulo: "Na fila", pill: "info" },
  aguardando: { rotulo: "Esperando parar", pill: "warn" },
  enviado: { rotulo: "Enviado", pill: "info" },
  respondido: { rotulo: "Respondido", pill: "ok" },
  erro: { rotulo: "Sem resposta", pill: "bad" },
  cancelado: { rotulo: "Cancelado", pill: "" },
};
const SITUACAO: Record<string, string> = {
  movimento: "Em movimento", parado: "Parado ligado", desligado: "Desligado", "sem-sinal": "Sem sinal", aguardando: "Aguardando sinal", "sem-rastreador": "Sem rastreador",
};

const hora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Asuncion", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });

export function Comandos({ inicial, todos, selecionadoInicial, papel, catalogo }: {
  inicial: Dados; todos: boolean; selecionadoInicial: string | null; papel: string; catalogo: Catalogo;
}) {
  const [dados, setDados] = useState(inicial);
  const [sel, setSel] = useState<string | null>(selecionadoInicial ?? inicial.caminhoes.find((c) => c.aparelho !== "nenhum")?.id ?? null);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"todos" | "bloqueados" | "camera">("todos");
  const [confirmando, setConfirmando] = useState<TipoComando | null>(null);
  const [motivo, setMotivo] = useState("");
  const [livre, setLivre] = useState("");
  const [camera, setCamera] = useState<"frontal" | "cabine">("frontal");
  const [resultado, setResultado] = useState<Resultado>(null);
  const [pendente, iniciar] = useTransition();

  const url = todos ? "/comandos/dados?todos=1" : "/comandos/dados";
  const atualizar = useCallback(async () => {
    const r = await fetch(url, { cache: "no-store" }).catch(() => null);
    if (r?.ok) setDados(await r.json());
  }, [url]);

  // Mais rápido enquanto houver comando esperando resposta.
  const temAberto = dados.comandos.some((c) => ABERTOS.includes(c.status));
  useEffect(() => {
    const id = setInterval(atualizar, temAberto ? 2000 : 15_000);
    return () => clearInterval(id);
  }, [atualizar, temAberto]);

  const lista = useMemo(() => {
    const q = busca.trim().toUpperCase();
    return dados.caminhoes.filter((c) =>
      (!q || c.placa.toUpperCase().includes(q) || (c.motorista ?? "").toUpperCase().includes(q)) &&
      (filtro === "todos" || (filtro === "bloqueados" ? c.bloqueado : c.camera)),
    );
  }, [dados.caminhoes, busca, filtro]);
  const cam = dados.caminhoes.find((c) => c.id === sel) ?? null;
  const historico = cam ? dados.comandos.filter((c) => c.caminhaoId === cam.id) : dados.comandos;
  const bloqueados = dados.caminhoes.filter((c) => c.bloqueado).length;
  const naFila = dados.comandos.filter((c) => ABERTOS.includes(c.status)).length;
  const gestor = papel === "ADMIN" || papel === "GESTOR";
  const motorNaFila = cam ? dados.comandos.find((c) => c.caminhaoId === cam.id && (c.tipo === "bloquear" || c.tipo === "desbloquear") && ABERTOS.includes(c.status)) : undefined;

  function enviar(tipo: TipoComando, extra: { motivo?: string; camera?: "frontal" | "cabine"; livre?: string } = {}) {
    if (!cam) return;
    iniciar(async () => {
      const r = await pedirComando({ caminhaoId: cam.id, tipo, ...extra });
      setResultado(r);
      if (r?.ok) { setConfirmando(null); setMotivo(""); setLivre(""); }
      await atualizar();
    });
  }

  const botao = (tipo: TipoComando, opcoes: { classe?: string; bloqueado?: string } = {}) => (
    <button
      type="button"
      className={`cmd ${opcoes.classe ?? ""}`}
      disabled={pendente || !!opcoes.bloqueado}
      title={opcoes.bloqueado ?? catalogo[tipo].descricao}
      onClick={() => (tipo === "bloquear" || tipo === "reiniciar" ? setConfirmando(confirmando === tipo ? null : tipo) : enviar(tipo))}
    >
      <b>{catalogo[tipo].rotulo}</b>
      <small>{opcoes.bloqueado ?? catalogo[tipo].descricao}</small>
    </button>
  );

  return (
    <div className="comandos">
      <div className="central-kpis">
        <div className="ck"><b>{dados.caminhoes.filter((c) => c.aparelho !== "nenhum").length}</b><span>Com rastreador</span></div>
        <div className="ck"><b>{dados.caminhoes.filter((c) => c.aparelho === "proprio").length}</b><span>Aparelho próprio</span></div>
        <div className="ck ck-alta"><b>{bloqueados}</b><span>Motor bloqueado</span></div>
        <div className="ck"><b>{naFila}</b><span>Comandos em andamento</span></div>
      </div>

      <div className="cmd-corpo">
        <div className="card cmd-lista">
          <input type="search" placeholder="Buscar placa ou motorista" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar caminhão" />
          <div className="alternar alternar-p" role="group" aria-label="Filtrar">
            <button type="button" aria-current={filtro === "todos" ? "true" : undefined} onClick={() => setFiltro("todos")}>Todos</button>
            <button type="button" aria-current={filtro === "bloqueados" ? "true" : undefined} onClick={() => setFiltro("bloqueados")}>Bloqueados {bloqueados}</button>
            <button type="button" aria-current={filtro === "camera" ? "true" : undefined} onClick={() => setFiltro("camera")}>Com câmera</button>
          </div>
          <ul>
            {lista.map((c) => (
              <li key={c.id}>
                <button type="button" aria-current={c.id === sel ? "true" : undefined} onClick={() => { setSel(c.id); setConfirmando(null); setResultado(null); }}>
                  <span className={`ponto ponto-${c.situacao}`} />
                  <span className="cmd-placa">
                    <b>{c.placa}</b>
                    <small>{todos ? `${c.cliente} · ` : ""}{c.bloqueado ? "Motor bloqueado" : c.aparelho === "nenhum" ? "Sem rastreador" : SITUACAO[c.situacao]}</small>
                  </span>
                  {c.bloqueado && <span className="pill bad">Bloqueado</span>}
                  {!c.bloqueado && c.aparelho === "demo" && <span className="tag-demo">demo</span>}
                </button>
              </li>
            ))}
            {lista.length === 0 && <li className="note">Nenhum caminhão encontrado.</li>}
          </ul>
        </div>

        <div className="cmd-detalhe">
          {!cam ? <div className="card"><p className="note">Escolha um caminhão na lista.</p></div> : (
            <div className="card">
              <div className="cmd-topo">
                <div>
                  <h2>{cam.placa} {cam.bloqueado && <span className="pill bad">Motor bloqueado</span>}</h2>
                  <small>{cam.modelo}{cam.motorista ? ` · ${cam.motorista}` : ""}{todos ? ` · ${cam.cliente}` : ""}</small>
                </div>
                <div className="cmd-estado">
                  <span className={`pill sit-${cam.situacao}`}>{SITUACAO[cam.situacao]}</span>
                  <small>{cam.velocidadeKmh} km/h{cam.local ? ` · ${cam.local}` : ""}</small>
                  <small>{cam.aparelho === "proprio" ? (cam.conectado ? "Aparelho conectado" : "Aparelho sem conexão: o comando sai quando ele voltar") : cam.aparelho === "demo" ? "Demonstração: a resposta é simulada" : "Sem rastreador instalado"}</small>
                </div>
              </div>

              {cam.aparelho === "nenhum" ? <p className="note">Cadastre o IMEI do rastreador em Caminhões e planos para enviar comandos.</p> : (
                <>
                  <h3>Motor</h3>
                  <div className="cmd-grade">
                    {cam.bloqueado
                      ? botao("desbloquear", { classe: "cmd-ok", bloqueado: !gestor ? "Só o gestor desbloqueia." : motorNaFila ? "Desbloqueio já pedido, esperando a resposta do aparelho." : undefined })
                      : !BLOQUEIO_ATIVO
                      ? <p className="note">O bloqueio do motor está desativado na plataforma.</p>
                      : botao("bloquear", {
                          classe: "cmd-perigo",
                          bloqueado: !gestor ? "Só o gestor bloqueia." : motorNaFila ? (motorNaFila.status === "aguardando" ? `Bloqueio pedido: esperando ${cam.placa} parar (agora a ${cam.velocidadeKmh} km/h).` : "Bloqueio pedido, esperando a resposta do aparelho.") : undefined,
                        })}
                  </div>
                  {confirmando === "bloquear" && (
                    <form className="cmd-confirmar" onSubmit={(e) => { e.preventDefault(); enviar("bloquear", { motivo }); }}>
                      <p><b>Bloquear o motor de {cam.placa}?</b> {cam.velocidadeKmh > 10 ? `Ele está a ${cam.velocidadeKmh} km/h: o bloqueio fica esperando até ele parar.` : "O motorista não consegue dar partida até o desbloqueio."}</p>
                      <label htmlFor="motivo">Motivo (fica no histórico)</label>
                      <textarea id="motivo" rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: suspeita de roubo, motorista confirmou" required minLength={5} />
                      <div className="cmd-linha">
                        <button type="submit" className="pri perigo" disabled={pendente || motivo.trim().length < 5}>Confirmar bloqueio</button>
                        <button type="button" onClick={() => setConfirmando(null)}>Voltar</button>
                      </div>
                    </form>
                  )}

                  <h3>Consultar</h3>
                  <div className="cmd-grade">
                    {botao("posicao")}
                    {botao("status")}
                    {botao("info")}
                    {botao("reiniciar", { bloqueado: gestor ? undefined : "Só o gestor reinicia o aparelho." })}
                  </div>
                  {confirmando === "reiniciar" && (
                    <div className="cmd-confirmar">
                      <p><b>Reiniciar o rastreador de {cam.placa}?</b> Ele fica cerca de 1 minuto sem enviar posição.</p>
                      <div className="cmd-linha">
                        <button type="button" className="pri" disabled={pendente} onClick={() => enviar("reiniciar")}>Reiniciar</button>
                        <button type="button" onClick={() => setConfirmando(null)}>Voltar</button>
                      </div>
                    </div>
                  )}

                  {cam.camera && (
                    <>
                      <h3>Câmeras</h3>
                      <div className="cmd-linha">
                        <div className="alternar alternar-p" role="group" aria-label="Câmera">
                          <button type="button" aria-current={camera === "frontal" ? "true" : undefined} onClick={() => setCamera("frontal")}>Estrada</button>
                          <button type="button" aria-current={camera === "cabine" ? "true" : undefined} onClick={() => setCamera("cabine")}>Cabine</button>
                        </div>
                        <button type="button" disabled={pendente} onClick={() => enviar("foto", { camera })}>Pedir foto</button>
                        <button type="button" disabled={pendente} onClick={() => enviar("video", { camera })}>Pedir vídeo (10 s)</button>
                        <a href={`/video?caminhao=${cam.id}`}>Ver fotos e vídeos →</a>
                      </div>
                    </>
                  )}

                  {papel === "ADMIN" && (
                    <form className="cmd-livre" onSubmit={(e) => { e.preventDefault(); enviar("livre", { livre }); }}>
                      <label htmlFor="livre">Comando livre (equipe KM Cero)</label>
                      <div className="cmd-linha">
                        <input id="livre" value={livre} onChange={(e) => setLivre(e.target.value)} placeholder="Ex.: getver" maxLength={200} />
                        <button type="submit" disabled={pendente || !livre.trim()}>Enviar</button>
                      </div>
                    </form>
                  )}
                </>
              )}
              {resultado && <p className={`pill ${resultado.ok ? "ok" : "bad"}`} role="status">{resultado.msg}</p>}
            </div>
          )}

          <div className="card">
            <h3>{cam ? `Histórico de ${cam.placa}` : "Últimos comandos"}</h3>
            {historico.length === 0 ? <p className="note">Nenhum comando enviado ainda.</p> : (
              <ul className="cmd-historico">
                {historico.map((h) => (
                  <li key={h.id}>
                    <div className="cmd-linha">
                      <b>{catalogo[h.tipo]?.rotulo ?? h.tipo}</b>
                      {!cam && <span>{h.placa}</span>}
                      <span className={`pill ${STATUS[h.status]?.pill ?? ""}`}>{STATUS[h.status]?.rotulo ?? h.status}</span>
                      {(h.status === "pendente" || h.status === "aguardando") && (
                        <button type="button" className="link-alerta" disabled={pendente} onClick={() => iniciar(async () => { await cancelarComando(h.id); await atualizar(); })}>Cancelar</button>
                      )}
                    </div>
                    <small>{hora(h.criadoEm)} · {h.criadoPor}{todos ? ` · ${h.cliente}` : ""} · <code>{h.texto}</code></small>
                    {h.motivo && <small>Motivo: {h.motivo}</small>}
                    {h.resposta && <small className="cmd-resposta">{h.resposta}</small>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
