import { sair } from "../login/actions";

export default function Bloqueado() {
  return (
    <main className="center">
      <div className="card login">
        <h1>Acesso suspenso</h1>
        <p>
          A mensalidade da sua empresa está com mais de 15 dias de atraso, por isso o acesso à plataforma foi suspenso. Os
          rastreadores continuam gravando e nada se perde.
        </p>
        <p className="muted">Fale com a KM Cero para regularizar e o acesso volta na hora.</p>
        <form action={sair}>
          <button type="submit">Sair</button>
        </form>
      </div>
    </main>
  );
}
