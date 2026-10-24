import Link from "next/link";
import { NOME_PLANO, planoMinimo, type Modulo } from "@/lib/indicadores";
import type { SituacaoRevisao } from "@/lib/indicadores";

export function Placa({ placa }: { placa: string }) {
  return <span className="plate">{placa}</span>;
}

export function Kpi({ rotulo, valor, unidade, sub }: { rotulo: string; valor: string; unidade?: string; sub?: React.ReactNode }) {
  return (
    <div className="card kpi">
      <span className="lbl">{rotulo}</span>
      <b>
        {valor}
        {unidade && <small>{unidade}</small>}
      </b>
      {sub && <span className="sub">{sub}</span>}
    </div>
  );
}

const ROTULO_SITUACAO: Record<SituacaoRevisao, [string, string]> = {
  vencida: ["bad", "Vencida"],
  proxima: ["warn", "Próxima"],
  em_dia: ["ok", "Em dia"],
};

export function PillRevisao({ situacao }: { situacao: SituacaoRevisao }) {
  const [cls, txt] = ROTULO_SITUACAO[situacao];
  return <span className={`pill ${cls}`}>{txt}</span>;
}

export function PlanoNecessario({ modulo, titulo }: { modulo: Modulo; titulo: string }) {
  const p = NOME_PLANO[planoMinimo(modulo)];
  return (
    <div className="card" style={{ maxWidth: 640, padding: 28 }}>
      <span className="tag">Plano {p}</span>
      <h2>{titulo} faz parte do plano {p}</h2>
      <p className="muted" style={{ margin: 0 }}>
        Nenhum caminhão desta frota está no plano {p} ou acima. Suba o plano de pelo menos um caminhão para liberar esta tela.
      </p>
      <Link className="btn" href="/caminhoes">Ver caminhões e planos</Link>
    </div>
  );
}

export function SeletorMes({ mes, caminho }: { mes: string; caminho: string }) {
  return (
    <form className="form" action={caminho}>
      <label htmlFor="mes">
        Mês
        <input id="mes" name="mes" type="month" defaultValue={mes} />
      </label>
      <button type="submit">Ver mês</button>
    </form>
  );
}
