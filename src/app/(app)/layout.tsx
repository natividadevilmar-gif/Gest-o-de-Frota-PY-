import Link from "next/link";
import { Bandeira, EstiloTema } from "@/components/Bandeira";
import { Marca } from "@/components/Marca";
import { Nav, type ItemNav } from "@/components/Nav";
import { SeletorCliente } from "@/components/SeletorCliente";
import { VoltarInicio } from "@/components/VoltarInicio";
import { clienteOpcional } from "@/lib/acesso";
import { db } from "@/lib/db";
import { NOME_PLANO, planoMinimo, planoPermite, type Modulo, type Plano } from "@/lib/indicadores";
import { sair } from "../login/actions";

const MODULOS: { m: Modulo; href: string; rotulo: string }[] = [
  { m: "painel", href: "/painel", rotulo: "Painel" },
  { m: "custos", href: "/despesas", rotulo: "Lançar despesa" },
  { m: "painel", href: "/fretes", rotulo: "Fretes e margem" },
  { m: "painel", href: "/caixa", rotulo: "Caixa dos motoristas" },
  { m: "caminhoes", href: "/caminhoes", rotulo: "Caminhões e planos" },
  { m: "caminhoes", href: "/motoristas", rotulo: "Acesso dos motoristas" },
  { m: "custos", href: "/custos", rotulo: "Custo por km" },
  { m: "consumo", href: "/consumo", rotulo: "Consumo e motoristas" },
  { m: "revisoes", href: "/revisoes", rotulo: "Revisões" },
  { m: "viagens", href: "/viagens", rotulo: "Margem por viagem" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { sessao, cliente } = await clienteOpcional();
  const planos = cliente
    ? (await db.caminhao.findMany({ where: { clienteId: cliente.id }, select: { plano: true } })).map((c) => c.plano as Plano)
    : [];
  const libera = (m: Modulo) => planos.some((p) => planoPermite(p, m));

  // O motorista vê o menu no idioma escolhido por ele.
  const es = sessao.papel === "MOTORISTA" && ((await db.usuario.findUnique({ where: { id: sessao.usuarioId }, select: { idioma: true } }))?.idioma ?? cliente?.idioma) === "es";
  const itens: ItemNav[] = (sessao.papel === "MOTORISTA" ? MODULOS.filter((x) => x.href === "/despesas") : MODULOS).map((x, i) => ({
    href: x.href,
    rotulo: es && x.href === "/despesas" ? "Cargar gasto" : x.rotulo,
    grupo: i === 0 ? "Frota" : undefined,
    bloqueadoPor: libera(x.m) ? undefined : NOME_PLANO[planoMinimo(x.m)],
  }));
  if (sessao.papel === "ADMIN") itens.push({ href: "/empresa", rotulo: "Minha empresa", grupo: "Sua operação" });

  const clientes = sessao.papel === "ADMIN" ? await db.cliente.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true } }) : [];

  return (
    <div className="app">
      <EstiloTema pais={cliente?.pais ?? "PY"} />
      <aside className="side">
        <div className="logo">
          <Marca />
          <Bandeira pais={cliente?.pais ?? "PY"} />
        </div>
        <Nav itens={itens} />
        <form action={sair}>
          <Link className="sair-link" href="/senha">{es ? "Cambiar PIN" : "Trocar senha"}</Link>
          <button className="sair" type="submit">{es ? "Salir" : "Sair"}</button>
        </form>
      </aside>
      <div className="main">
        <header className="top">
          <div>
            <strong>{cliente?.nome ?? "Nenhum cliente cadastrado"}</strong>
            <div className="sub">
              {cliente ? `${cliente.cidade} · ${planos.length} caminhões · ` : ""}
              {sessao.nome}
            </div>
          </div>
          {sessao.papel === "ADMIN" && cliente && <SeletorCliente clientes={clientes} atual={cliente.id} />}
        </header>
        <div className="content">{sessao.papel !== "MOTORISTA" && <VoltarInicio />}{children}</div>
      </div>
    </div>
  );
}
