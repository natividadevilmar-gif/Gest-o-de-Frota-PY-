import { InstalarApp } from "@/components/InstalarApp";
import Link from "next/link";
import { Bandeira, EstiloTema } from "@/components/Bandeira";
import { Marca } from "@/components/Marca";
import { Nav, type EntradaNav, type ItemNav } from "@/components/Nav";
import { SeletorCliente } from "@/components/SeletorCliente";
import { VoltarInicio } from "@/components/VoltarInicio";
import { clienteOpcional } from "@/lib/acesso";
import { db } from "@/lib/db";
import { idiomaAtual } from "@/lib/i18n/atual";
import { NOME_PLANO, planoMinimo, planoPermite, type Modulo, type Plano } from "@/lib/indicadores";
import { sair } from "../login/actions";

/** menu: em qual menu da barra do topo o item fica; sem menu, fica à vista na barra. */
const MODULOS: { m: Modulo; href: string; rotulo: string; menu?: string }[] = [
  { m: "painel", href: "/painel", rotulo: "Painel" },
  { m: "painel", href: "/rastreamento", rotulo: "Mapa ao vivo" },
  { m: "painel", href: "/monitoramento", rotulo: "Central de monitoramento" },
  { m: "painel", href: "/telemetria", rotulo: "Telemetria" },
  { m: "painel", href: "/comandos", rotulo: "Comandos" },
  { m: "video", href: "/video", rotulo: "Vídeo" },
  { m: "despesas", href: "/despesas", rotulo: "Lançar despesa", menu: "Financeiro" },
  { m: "painel", href: "/fretes", rotulo: "Fretes e margem", menu: "Financeiro" },
  { m: "painel", href: "/pedagios", rotulo: "Pedágios", menu: "Financeiro" },
  { m: "painel", href: "/caixa", rotulo: "Caixa dos motoristas", menu: "Financeiro" },
  { m: "caminhoes", href: "/caminhoes", rotulo: "Caminhões e planos", menu: "Frota" },
  { m: "caminhoes", href: "/contrato", rotulo: "Contrato", menu: "Frota" },
  { m: "caminhoes", href: "/motoristas", rotulo: "Acesso dos motoristas", menu: "Frota" },
  { m: "painel", href: "/cargas", rotulo: "Fotos da carga", menu: "Frota" },
  { m: "custos", href: "/custos", rotulo: "Custo por km", menu: "Financeiro" },
  { m: "consumo", href: "/consumo", rotulo: "Consumo e motoristas", menu: "Frota" },
  { m: "revisoes", href: "/revisoes", rotulo: "Revisões", menu: "Frota" },
  { m: "viagens", href: "/viagens", rotulo: "Margem por viagem", menu: "Financeiro" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { sessao, cliente } = await clienteOpcional();
  const planos = cliente
    ? (await db.caminhao.findMany({ where: { clienteId: cliente.id }, select: { plano: true } })).map((c) => c.plano as Plano)
    : [];
  // Revisões também abre quando o admin montou o plano de demonstração para o cliente.
  const demoRevisoes = cliente ? (await db.itemRevisao.count({ where: { demo: true, caminhao: { clienteId: cliente.id } } })) > 0 : false;
  const libera = (m: Modulo) => (m === "revisoes" && demoRevisoes) || planos.some((p) => planoPermite(p, m));

  // Os textos do menu ficam em português; o Tradutor (layout raiz) mostra no idioma escolhido.
  const idioma = await idiomaAtual();
  const admin = sessao.papel === "ADMIN";
  const visiveis = sessao.papel === "MOTORISTA" ? MODULOS.filter((x) => x.href === "/despesas") : sessao.papel === "OPERADOR" ? MODULOS.filter((x) => x.href !== "/contrato") : MODULOS;
  // O motorista só lança despesa: o item fica à vista.
  const soUm = visiveis.length === 1;
  const entradas: EntradaNav[] = admin ? [{ href: "/empresa", rotulo: "Empresa" }] : [];
  for (const x of visiveis) {
    const item: ItemNav = {
      href: x.href,
      rotulo: admin && x.href === "/painel" ? "Painel do cliente" : x.rotulo,
      bloqueadoPor: libera(x.m) ? undefined : NOME_PLANO[planoMinimo(x.m)],
    };
    const nomeMenu = soUm ? undefined : x.menu;
    if (!nomeMenu) { entradas.push(item); continue; }
    const m = entradas.find((e): e is { menu: string; itens: ItemNav[] } => "menu" in e && e.menu === nomeMenu);
    if (m) m.itens.push(item);
    else entradas.push({ menu: nomeMenu, itens: [item] });
  }

  const clientes = sessao.papel === "ADMIN" ? await db.cliente.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true } }) : [];

  return (
    <div className="app">
      <EstiloTema pais={cliente?.pais ?? "PY"} />
      <header className="barra">
        <div className="logo">
          <Marca tamanho={18} />
          <Bandeira pais={cliente?.pais ?? "PY"} />
        </div>
        <Nav
          entradas={entradas}
          idioma={idioma}
          conta={
            <form action={sair} className="nav-conta-lista">
              <div className="nav-quem">
                <strong>{cliente?.nome ?? "Nenhum cliente cadastrado"}</strong>
                <small>{cliente ? `${cliente.cidade} · ${planos.length} caminhões · ` : ""}{sessao.nome}</small>
              </div>
              <InstalarApp />
              <Link href="/senha">{sessao.papel === "MOTORISTA" ? "Trocar PIN" : "Trocar senha"}</Link>
              <button className="sair" type="submit">Sair</button>
            </form>
          }
        />
        {admin && cliente && <SeletorCliente clientes={clientes} atual={cliente.id} />}
      </header>
      <div className="main">
        <div className="content">{sessao.papel !== "MOTORISTA" && <VoltarInicio inicio={admin ? "/empresa" : "/painel"} />}{children}</div>
      </div>
    </div>
  );
}
