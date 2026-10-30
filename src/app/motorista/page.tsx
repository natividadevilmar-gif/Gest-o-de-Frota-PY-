import { fundoDoLogin } from "@/lib/fundoLogin";
import { Formulario } from "../login/Formulario";

// Link direto para motoristas: mesma entrada, com campos de celular e PIN.
export default async function LoginMotorista() {
  return <Formulario motorista fundo={await fundoDoLogin()} />;
}
