import { exigirSessao } from "@/lib/acesso";
import { TrocarSenha } from "./TrocarSenha";

export default async function Senha() {
  const sessao = await exigirSessao();
  return (
    <>
      <h1>Minha senha</h1>
      <div className="card">
        <div className="card-h"><h2>Trocar senha</h2><p>{sessao.nome}</p></div>
        <TrocarSenha />
      </div>
    </>
  );
}
