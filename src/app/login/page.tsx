import { imagemDoFundo } from "@/lib/fundoLogin";
import { Formulario } from "./Formulario";

export default async function Login({ searchParams }: { searchParams: Promise<{ fundo?: string }> }) {
  return <Formulario fundo={imagemDoFundo((await searchParams).fundo)} />;
}
