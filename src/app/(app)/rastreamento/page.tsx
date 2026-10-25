import { clienteAtual } from "@/lib/acesso";
import { frotaNoMapa } from "@/lib/rastreio/dados";
import { diaNoParaguai } from "@/lib/rastreio/rotas";
import { MapaFrota } from "./MapaFrota";

export const dynamic = "force-dynamic";

export default async function Rastreamento() {
  const { cliente } = await clienteAtual();
  const frota = await frotaNoMapa(cliente.id);
  const hoje = diaNoParaguai(new Date()).toISOString().slice(0, 10);
  const demo = frota.some((c) => c.demo);
  return (
    <>
      <h1>Mapa ao vivo</h1>
      {demo && (
        <p className="aviso-demo">
          Os caminhões marcados como <b>demonstração</b> ainda não têm aparelho instalado: a posição deles é simulada numa rota real.
          Ao cadastrar o IMEI do rastreador em Caminhões e planos, o caminhão passa a mostrar a posição verdadeira.
        </p>
      )}
      <MapaFrota inicial={frota} hoje={hoje} />
    </>
  );
}
