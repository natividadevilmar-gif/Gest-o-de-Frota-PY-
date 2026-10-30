-- Preço do diesel por país para o simulador de frete.
CREATE TABLE "PrecoDiesel" (
    "pais" TEXT NOT NULL,
    "moeda" TEXT NOT NULL,
    "valor" DOUBLE PRECISION NOT NULL,
    "fonte" TEXT NOT NULL,
    "vigencia" DATE NOT NULL,
    "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrecoDiesel_pkey" PRIMARY KEY ("pais")
);

-- Preços de outubro de 2026. Argentina e Chile em dólar (média do mês), sem cotação diária do peso.
INSERT INTO "PrecoDiesel" ("pais", "moeda", "valor", "fonte", "vigencia") VALUES
  ('PY', 'PYG', 9285, 'Petropar, diésel común (ABC Color, 28/10/2026)', '2026-10-28'),
  ('BR', 'BRL', 7.44, 'Diesel S-10, média nacional Ticket Log (outubro/2026)', '2026-10-30'),
  ('AR', 'USD', 1.63, 'Gasoil, média do país (Economía y Energía, outubro/2026)', '2026-10-23'),
  ('UY', 'UYU', 62.79, 'Gasoil 50S, ANCAP (outubro/2026)', '2026-10-01'),
  ('CL', 'USD', 1.46, 'Petróleo diésel, média do país (Economía y Energía, outubro/2026)', '2026-10-23');
