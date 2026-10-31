import { idiomaAtual } from "@/lib/i18n/atual";
import { Formulario } from "../login/Formulario";

// Link direto para motoristas: mesma entrada, com campos de celular e PIN.
export default async function LoginMotorista() {
  return <Formulario motorista idioma={await idiomaAtual()} />;
}
