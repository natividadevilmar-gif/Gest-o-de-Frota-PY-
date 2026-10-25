import { redirect } from "next/navigation";
import { clienteAtual } from "@/lib/acesso";

// "Contrato" no menu: abre o contrato do cliente selecionado.
export default async function ContratoAtual() {
  const { cliente } = await clienteAtual();
  redirect(`/contrato/${cliente.id}`);
}
