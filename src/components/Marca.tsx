/** Logo KM Cero: velocímetro e o nome. "KM" e o fundo do arco usam a cor do texto onde o logo está. */
export function Marca({ tamanho = 22 }: { tamanho?: number }) {
  return (
    <span className="marca" style={{ fontSize: tamanho }}>
      <svg viewBox="0 0 144 92" aria-hidden="true" style={{ height: "1.25em", width: "auto" }}>
        <path d="M16 80 A56 56 0 1 1 128 80" fill="none" stroke="currentColor" strokeOpacity=".28" strokeWidth="14" strokeLinecap="round" />
        <path d="M16 80 A56 56 0 0 1 100 32" fill="none" stroke="#22D3EE" strokeWidth="14" strokeLinecap="round" />
        <path d="M72 80 L108 38" stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
        <circle cx="72" cy="80" r="10" fill="currentColor" />
      </svg>
      <span className="marca-nome">KM<b>CERO</b></span>
    </span>
  );
}
