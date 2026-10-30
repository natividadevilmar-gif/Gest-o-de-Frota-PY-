import { fundoDoLogin } from "@/lib/fundoLogin";
import { Formulario } from "./Formulario";

export default async function Login() {
  return <Formulario fundo={await fundoDoLogin()} />;
}
