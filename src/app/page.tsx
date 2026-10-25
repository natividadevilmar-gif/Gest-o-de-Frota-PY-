import { redirect } from "next/navigation";
import { exigirSessao } from "@/lib/acesso";

export default async function Inicio() {
  const s = await exigirSessao();
  redirect(s.papel === "ADMIN" ? "/empresa" : s.papel === "MOTORISTA" ? "/despesas" : "/painel");
}
