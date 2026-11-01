import type { DadosMic } from "@/lib/micDta";

const DECLARACAO =
  "Declaramos que las informaciones presentadas en este documento expresan la verdad, que los datos referentes a las mercaderías fueron transcriptos exactamente conforme a la declaración del remitente, las cuales son de su exclusiva responsabilidad, y que esta operación obedece a lo dispuesto en el Convenio sobre Transporte Internacional Terrestre.";

function Caixa({ n, es, pt, v, col, alto, children }: { n: string; es: string; pt: string; v?: string; col: number; alto?: boolean; children?: React.ReactNode }) {
  return (
    <div className="mic-c" style={{ gridColumn: `span ${col}` }}>
      <small><b>{n}</b> {es} / {pt}</small>
      {children ?? <p className={alto ? "mic-alto" : undefined}>{v || " "}</p>}
    </div>
  );
}

/** O formulário MIC/DTA no desenho oficial (bilíngue espanhol/português), pronto para imprimir. */
export function Documento({ d }: { d: DadosMic }) {
  return (
    <article className="mic-doc">
      <div className="mic-grade">
        <div className="mic-c mic-titulo" style={{ gridColumn: "span 7" }}>
          <b>MIC/DTA</b>
          <span>Manifiesto Internacional de Carga por Carretera / Declaración de Tránsito Aduanero</span>
          <span>Manifesto Internacional de Carga Rodoviária / Declaração de Trânsito Aduaneiro</span>
        </div>
        <Caixa n="3" es="Tránsito aduanero" pt="Trânsito aduaneiro" col={2}>
          <p>{d.transito === "SI" ? "☒ Sí/Sim  ☐ No/Não" : "☐ Sí/Sim  ☒ No/Não"}</p>
        </Caixa>
        <Caixa n="4" es="Nº" pt="Nº" v={d.numero} col={3} />
        <Caixa n="1" es="Nombre y domicilio del porteador" pt="Nome e endereço do transportador" col={7}>
          <p className="mic-alto">{d.porteador}{d.permiso && `\nPermiso / Licença Nº ${d.permiso}`}</p>
        </Caixa>
        <Caixa n="5" es="Hoja" pt="Folha" v={d.hoja} col={2} />
        <Caixa n="6" es="Fecha de emisión" pt="Data de emissão" v={d.fechaEmision} col={3} />
        <Caixa n="2" es="Rol de contribuyente" pt="Cadastro de contribuinte" v={d.porteadorRuc} col={7} />
        <Caixa n="7" es="Aduana, ciudad y país de partida" pt="Alfândega, cidade e país de partida" v={d.aduanaPartida} col={5} />
        <Caixa n="9" es="Camión original: nombre y domicilio del propietario" pt="Caminhão original: nome e endereço do proprietário" v={d.propietario} col={7} alto />
        <Caixa n="8" es="Ciudad y país de destino final" pt="Cidade e país de destino final" v={d.destinoFinal} col={5} />
        <Caixa n="10" es="Rol de contribuyente" pt="Cadastro de contribuinte" v={d.propietarioRuc} col={4} />
        <Caixa n="11" es="Placa de camión" pt="Placa do caminhão" v={d.placa} col={3} />
        <Caixa n="12" es="Marca y número" pt="Marca e número" v={d.marcaNumero} col={5} />
        <Caixa n="13" es="Capacidad de arrastre (t)" pt="Capacidade de tração (t)" v={d.capacidad} col={3} />
        <Caixa n="14" es="Año" pt="Ano" v={d.ano} col={2} />
        <Caixa n="15" es="Semirremolque / Remolque: placa" pt="Semirreboque / Reboque: placa" v={d.remolque} col={7} />
        <Caixa n="16–22" es="Camión sustituto" pt="Caminhão substituto" v=" " col={12} />
        <Caixa n="23" es="Nº carta de porte" pt="Nº do conhecimento" v={d.crt} col={3} />
        <Caixa n="24" es="Aduana de destino" pt="Alfândega de destino" v={d.aduanaDestino} col={5} />
        <Caixa n="25" es="Moneda" pt="Moeda" v={d.moneda} col={2} />
        <Caixa n="26" es="Origen de las mercaderías" pt="Origem das mercadorias" v={d.origenMercaderias} col={2} />
        <Caixa n="27" es="Valor FOT" pt="Valor FOT" v={d.valorFot} col={3} />
        <Caixa n="28" es="Flete en US$" pt="Frete em US$" v={d.flete} col={3} />
        <Caixa n="29" es="Seguro en US$" pt="Seguro em US$" v={d.seguro} col={2} />
        <Caixa n="32" es="Peso bruto (kg)" pt="Peso bruto (kg)" v={d.pesoBruto} col={4} />
        <Caixa n="30" es="Tipo de bultos" pt="Tipo dos volumes" v={d.tipoBultos} col={4} />
        <Caixa n="31" es="Cantidad de bultos" pt="Quantidade de volumes" v={d.cantidadBultos} col={4} />
        <Caixa n="37" es="Número de precintos" pt="Número dos lacres" v={d.precintos} col={4} />
        <Caixa n="33" es="Remitente" pt="Remetente" v={d.remitente} col={4} alto />
        <Caixa n="34" es="Destinatario" pt="Destinatário" v={d.destinatario} col={4} alto />
        <Caixa n="35" es="Consignatario" pt="Consignatário" v={d.consignatario} col={4} alto />
        <Caixa n="36" es="Documentos anexos" pt="Documentos anexos" v={d.documentosAnexos} col={12} />
        <Caixa n="38" es="Marcas y números de los bultos, descripción de las mercaderías" pt="Marcas e números dos volumes, descrição das mercadorias" v={d.descripcion} col={12} alto />
        <Caixa n="39" es="Firma y sello del porteador" pt="Assinatura e carimbo do transportador" col={6}>
          <p className="mic-declara">{DECLARACAO}</p>
          <p className="mic-assina">Fecha / Data: ____/____/______</p>
        </Caixa>
        <Caixa n="40" es="Nº DTA, ruta y plazo de transporte" pt="Nº DTA, rota e prazo de transporte" v={d.rutaPlazo} col={6} alto />
        <Caixa n="41" es="Firma y sello de la Aduana de partida" pt="Assinatura e carimbo da Alfândega de partida" col={12}>
          <p className="mic-assina">Fecha / Data: ____/____/______</p>
        </Caixa>
      </div>
    </article>
  );
}
