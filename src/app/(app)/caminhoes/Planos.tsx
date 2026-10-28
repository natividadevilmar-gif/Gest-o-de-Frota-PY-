"use client";

import { useState } from "react";

type Plano = "BASICO" | "GESTAO" | "VIDEO";

// O que cada plano cobre. Cada plano inclui tudo do anterior.
const COBERTURA: Record<Plano, { nome: string; resumo: string; base?: Plano; itens: [string, string][] }> = {
  BASICO: {
    nome: "Básico",
    resumo: "Rastreamento e segurança do caminhão, 24 horas.",
    itens: [
      ["Rastreador próprio KM Cero", "Posição a cada poucos segundos, sem contratar outra empresa."],
      ["Mapa ao vivo", "Onde está, velocidade, motorista e o trajeto do dia."],
      ["Central de monitoramento", "Alertas de excesso, sem sinal, rodando de madrugada e cercas (pátio, cliente, fronteira)."],
      ["Comandos", "Pedir posição e status do aparelho e reiniciar o rastreador."],
      ["Painel da frota", "Km rodados, caminhões ativos e alertas do mês."],
      ["Fretes e caixa dos motoristas", "Frete de cada viagem e adiantamentos ao motorista."],
      ["Acesso dos motoristas", "Cada motorista entra pelo celular com PIN."],
    ],
  },
  GESTAO: {
    nome: "Gestão",
    resumo: "Para saber quanto custa e quanto rende cada caminhão.",
    base: "BASICO",
    itens: [
      ["Lançar despesa", "Motorista fotografa o recibo e o sistema lê o valor (guaranis, reais ou dólar)."],
      ["Custo por km", "Combustível, peças, pedágio, salário, seguro e depreciação por km rodado."],
      ["Consumo e motoristas", "Km/l pela rede CAN, marcha lenta, freadas e ranking dos motoristas."],
      ["Revisões", "Aviso de troca de óleo, filtros e pneus pelo km do caminhão."],
      ["Margem por viagem", "Frete menos custos: quanto cada viagem deu de lucro."],
      ["Relatórios em Excel", "Custo por km e despesas do mês para o contador."],
    ],
  },
  VIDEO: {
    nome: "Vídeo",
    resumo: "Ver o que aconteceu, não só saber que aconteceu.",
    base: "GESTAO",
    itens: [
      ["Duas ou quatro câmeras", "DualCam (estrada e cabine) ou MDVR de 4 câmeras: frente, cabine, lateral e ré ou carga."],
      ["Vídeo automático dos eventos", "Freada brusca, curva, excesso ou impacto gravam o vídeo sozinhos."],
      ["Vídeo no alerta", "Na Central, o alerta já vem com o botão Ver vídeo."],
      ["Foto ou vídeo na hora", "A central pede uma foto ou os últimos 10 segundos quando quiser."],
      ["Galeria por caminhão", "Fotos e vídeos dos últimos dias, com data, velocidade e local."],
    ],
  },
};

export function Planos({ precos, quantos, inicial }: { precos: Record<Plano, number>; quantos: Record<Plano, number>; inicial: Plano }) {
  const [aberto, setAberto] = useState<Plano>(inicial);
  const p = COBERTURA[aberto];
  return (
    <div className="card planos">
      <div className="card-h"><h2>O que cada plano cobre</h2><p>Toque em um plano para ver.</p></div>
      <div className="planos-botoes" role="tablist" aria-label="Planos">
        {(Object.keys(COBERTURA) as Plano[]).map((k) => (
          <button key={k} type="button" role="tab" aria-selected={aberto === k} aria-controls="plano-cobertura" className={`plano-btn plano-${k.toLowerCase()}`} onClick={() => setAberto(k)}>
            <b>{COBERTURA[k].nome}</b>
            <span>USD {precos[k]}<small>/mês por caminhão</small></span>
            <small>{quantos[k]} {quantos[k] === 1 ? "caminhão" : "caminhões"} neste plano</small>
          </button>
        ))}
      </div>
      <div id="plano-cobertura" role="tabpanel" className={`plano-cobertura plano-${aberto.toLowerCase()}`}>
        <p className="plano-resumo"><b>{p.nome}</b> · {p.resumo}</p>
        {p.base && <p className="plano-inclui">✓ Tudo do plano {COBERTURA[p.base].nome}{p.base === "GESTAO" ? " e do Básico" : ""}, mais:</p>}
        <ul>
          {p.itens.map(([t, d]) => (
            <li key={t}><span aria-hidden="true">✓</span><div><b>{t}</b><small>{d}</small></div></li>
          ))}
        </ul>
      </div>
    </div>
  );
}
