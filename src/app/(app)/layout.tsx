import Link from "next/link";
import { Bandeira, EstiloTema } from "@/components/Bandeira";
import { Marca } from "@/components/Marca";
import { Nav, type EntradaNav, type ItemNav } from "@/components/Nav";
import { SeletorCliente } from "@/components/SeletorCliente";
import { VoltarInicio } from "@/components/VoltarInicio";
import { clienteOpcional } from "@/lib/acesso";
import { db } from "@/lib/db";
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
  { m: "custos", href: "/despesas", rotulo: "Lançar despesa", menu: "Financeiro" },
  { m: "painel", href: "/fretes", rotulo: "Fretes e margem", menu: "Financeiro" },
  { m: "painel", href: "/pedagios", rotulo: "Pedágios", menu: "Financeiro" },
  { m: "painel", href: "/caixa", rotulo: "Caixa dos motoristas", menu: "Financeiro" },
  { m: "caminhoes", href: "/caminhoes", rotulo: "Caminhões e planos", menu: "Frota" },
  { m: "caminhoes", href: "/contrato", rotulo: "Contrato", menu: "Frota" },
  { m: "caminhoes", href: "/motoristas", rotulo: "Acesso dos motoristas", menu: "Frota" },
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
  const libera = (m: Modulo) => planos.some((p) => planoPermite(p, m));

  // O motorista vê o menu no idioma escolhido por ele.
  const es = sessao.papel === "MOTORISTA" && ((await db.usuario.findUnique({ where: { id: sessao.usuarioId }, select: { idioma: true } }))?.idioma ?? cliente?.idioma) === "es";
  const admin = sessao.papel === "ADMIN";
  const visiveis = sessao.papel === "MOTORISTA" ? MODULOS.filter((x) => x.href === "/despesas") : sessao.papel === "OPERADOR" ? MODULOS.filter((x) => x.href !== "/contrato") : MODULOS;
  // O motorista só lança despesa: o item fica à vista.
  const soUm = visiveis.length === 1;
  const entradas: EntradaNav[] = admin ? [{ href: "/empresa", rotulo: "Empresa" }] : [];
  for (const x of visiveis) {
    const item: ItemNav = {
      href: x.href,
      rotulo: es && x.href === "/despesas" ? "Cargar gasto" : admin && x.href === "/painel" ? "Painel do cliente" : x.href === "/monitoramento" ? "Central" : x.rotulo,
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
          conta={
            <form action={sair} className="nav-conta-lista">
              <div className="nav-quem">
                <strong>{cliente?.nome ?? "Nenhum cliente cadastrado"}</strong>
                <small>{cliente ? `${cliente.cidade} · ${planos.length} caminhões · ` : ""}{sessao.nome}</small>
              </div>
              <Link href="/senha">{es ? "Cambiar PIN" : "Trocar senha"}</Link>
              <button className="sair" type="submit">{es ? "Salir" : "Sair"}</button>
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
