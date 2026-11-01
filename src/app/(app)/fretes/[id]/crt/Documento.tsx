import { totalGastos, type DadosCrt } from "@/lib/crt";

const AVISO =
  "Las mercaderías consignadas en esta Carta de Porte fueron recibidas por el porteador aparentemente en buen estado, bajo las condiciones generales que figuran al dorso. / As mercadorias consignadas neste Conhecimento de Transporte foram recebidas pelo transportador aparentemente em bom estado, sob as condições gerais que figuram no verso.";

function Caixa({ n, es, pt, v, col, alto, children }: { n: string; es: string; pt: string; v?: string; col: number; alto?: boolean; children?: React.ReactNode }) {
  return (
    <div className="mic-c" style={{ gridColumn: `span ${col}` }}>
      <small><b>{n}</b> {es} / {pt}</small>
      {children ?? <p className={alto ? "mic-alto" : undefined}>{v || " "}</p>}
    </div>
  );
}

/** O CRT no desenho do ATIT (bilíngue espanhol/português), pronto para imprimir. */
export function Documento({ d }: { d: DadosCrt }) {
  const rem = d.pagador === "REMITENTE";
  const total = totalGastos(d);
  const linha = (rotulo: string, v: string) => (
    <tr><td>{rotulo}</td><td>{rem ? v : ""}</td><td>{rem && v ? d.moneda : ""}</td><td>{rem ? "" : v}</td><td>{!rem && v ? d.moneda : ""}</td></tr>
  );
  const totalTxt = total ? total.toFixed(2) : "";
  return (
    <article className="mic-doc">
      <div className="mic-grade">
        <div className="mic-c mic-titulo" style={{ gridColumn: "span 7" }}>
          <b>CRT</b>
          <span>Carta de Porte Internacional por Carretera</span>
          <span>Conhecimento de Transporte Internacional por Rodovia</span>
          <span className="crt-aviso">{AVISO}</span>
        </div>
        <Caixa n="2" es="Número" pt="Número" v={d.numero} col={5} />
        <Caixa n="1" es="Nombre y domicilio del remitente" pt="Nome e endereço do remetente" v={d.remitente} col={7} alto />
        <Caixa n="3" es="Nombre y domicilio del porteador" pt="Nome e endereço do transportador" col={5}>
          <p className="mic-alto">{d.porteador}{d.permiso && `\nPermiso / Licença Nº ${d.permiso}`}</p>
        </Caixa>
        <Caixa n="4" es="Nombre y domicilio del destinatario" pt="Nome e endereço do destinatário" v={d.destinatario} col={7} alto />
        <Caixa n="5" es="Nombre y domicilio del consignatario" pt="Nome e endereço do consignatário" v={d.consignatario} col={5} alto />
        <Caixa n="6" es="Notificar a" pt="Notificar a" v={d.notificar} col={7} />
        <Caixa n="7" es="Lugar y país de emisión" pt="Local e país de emissão" v={d.lugarEmision} col={5} />
        <Caixa n="8" es="Lugar, país y fecha en que el porteador se hace cargo de las mercaderías" pt="Local, país e data em que o transportador se responsabiliza pelas mercadorias" v={d.lugarCarga} col={7} />
        <Caixa n="9" es="Lugar, país y plazo de entrega" pt="Local, país e prazo de entrega" v={d.lugarEntrega} col={5} />
        <Caixa n="10" es="Porteadores sucesivos" pt="Transportadores sucessivos" v={d.porteadoresSucesivos} col={12} />
        <Caixa n="11" es="Cantidad y clase de bultos, marcas y números, tipo de mercaderías, contenedores y accesorios" pt="Quantidade e categoria de volumes, marcas e números, tipos de mercadorias, contêineres e acessórios" v={d.descripcion} col={7} alto />
        <div className="mic-c crt-pilha" style={{ gridColumn: "span 5" }}>
          <small><b>12</b> Peso bruto en kg / Peso bruto em kg</small>
          <p>{d.pesoBruto || " "}{d.pesoNeto && <span className="crt-sub">  ·  Peso neto / líquido: {d.pesoNeto}</span>}</p>
          <small><b>13</b> Volumen en m³ / Volume em m³</small>
          <p>{d.volumen || " "}</p>
          <small><b>14</b> Valor / Valor · Incoterms · Moneda / Moeda</small>
          <p>{[d.valor, d.incoterm, d.valor ? d.moneda : ""].filter(Boolean).join(" · ") || " "}</p>
        </div>
        <div className="mic-c" style={{ gridColumn: "span 7" }}>
          <small><b>15</b> Gastos a pagar / Despesas a pagar</small>
          <table className="crt-gastos">
            <colgroup><col style={{ width: "22%" }} /><col style={{ width: "26%" }} /><col style={{ width: "13%" }} /><col style={{ width: "26%" }} /><col style={{ width: "13%" }} /></colgroup>
            <thead><tr><th></th><th>Remitente / Remetente</th><th>Moneda</th><th>Destinatario / Destinatário</th><th>Moneda</th></tr></thead>
            <tbody>
              {linha("Flete / Frete", d.flete)}
              {linha("Seguro", d.seguro)}
              {linha("Otros / Outros", d.otros)}
              {linha("Total", totalTxt)}
            </tbody>
          </table>
        </div>
        <Caixa n="16" es="Declaración del valor de las mercaderías" pt="Declaração do valor das mercadorias" v={d.declaracionValor} col={5} />
        <Caixa n="17" es="Documentos anexos" pt="Documentos anexos" v={d.documentosAnexos} col={7} />
        <Caixa n="18" es="Instrucciones sobre formalidades de aduana" pt="Instruções sobre formalidades de alfândega" v={d.instruccionesAduana} col={5} />
        <Caixa n="19" es="Monto del flete externo" pt="Valor do frete externo" v={d.fleteExterno && `${d.fleteExterno} ${d.moneda}`} col={4} />
        <Caixa n="20" es="Monto de reembolso contra entrega" pt="Valor de reembolso contra entrega" v={d.reembolso} col={3} />
        <Caixa n="22" es="Declaraciones y observaciones del porteador" pt="Declarações e observações do transportador" v={d.observaciones} col={5} alto />
        <Caixa n="21" es="Nombre y firma del remitente o su representante" pt="Nome e assinatura do remetente ou seu representante" col={4}>
          <p className="mic-assina">Fecha / Data: {d.fechaEmision || "____/____/______"}</p>
        </Caixa>
        <Caixa n="23" es="Nombre, firma y sello del porteador o su representante" pt="Nome, assinatura e carimbo do transportador ou seu representante" col={4}>
          <p className="mic-assina">Fecha / Data: {d.fechaEmision || "____/____/______"}</p>
        </Caixa>
        <Caixa n="24" es="Nombre y firma del destinatario o su representante" pt="Nome e assinatura do destinatário ou seu representante" col={4}>
          <p className="mic-assina">Fecha / Data: ____/____/______</p>
        </Caixa>
      </div>
    </article>
  );
}
