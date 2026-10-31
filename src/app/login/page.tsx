import { imagemDoFundo } from "@/lib/fundoLogin";
import { idiomaAtual } from "@/lib/i18n/atual";
import { Formulario } from "./Formulario";

export default async function Login({ searchParams }: { searchParams: Promise<{ fundo?: string }> }) {
  return <Formulario fundo={imagemDoFundo((await searchParams).fundo)} idioma={await idiomaAtual()} />;
}
