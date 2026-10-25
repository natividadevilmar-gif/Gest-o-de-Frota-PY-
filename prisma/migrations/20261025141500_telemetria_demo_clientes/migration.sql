-- Histórico de telemetria de demonstração (últimos ~60 dias) para os caminhões "Exemplo"
-- dos clientes de demonstração, que já aparecem rodando no Mapa ao vivo.
-- Valores fixos por caminhão e dia (derivados do id), sem tocar caminhões reais.
WITH dias AS (
  SELECT d::date AS dia FROM generate_series(date '2026-08-25', date '2026-10-24', interval '1 day') d
),
base AS (
  SELECT c.id, c.plano, d.dia,
         abs(('x' || substr(md5(c.id || d.dia::text), 1, 8))::bit(32)::int) AS r1,
         abs(('x' || substr(md5(d.dia::text || c.id), 1, 8))::bit(32)::int) AS r2
  FROM "Caminhao" c
  JOIN "Cliente" cl ON cl.id = c."clienteId"
  CROSS JOIN dias d
  WHERE c.modelo = 'Exemplo' AND c."rastreadorId" LIKE 'SIM-%'
    AND cl.nome IN ('Agrotransporte Naranjal', 'Combustibles del Este', 'Cooperativa San Alberto', 'Fletes Los Cedrales', 'Logística Itapúa')
),
km AS (
  SELECT *, CASE WHEN extract(dow FROM dia) = 0 THEN r1 % 60 ELSE 220 + r1 % 260 END AS km FROM base
)
INSERT INTO "TelemetriaDia" (id, "caminhaoId", data, km, "litrosCan", "odometroKm", "marchaLentaPct", "excessosVelocidade", "frenagensBruscas", "rpmAltoPct")
SELECT 'demo_tel_' || md5(id || dia::text), id, dia, km,
       CASE WHEN plano = 'BASICO' THEN NULL ELSE round((km / (2.3 + (r2 % 50) / 100.0))::numeric, 1) END,
       250000 + (abs(('x' || substr(md5(id), 1, 8))::bit(32)::int) % 300000)
         + sum(km) OVER (PARTITION BY id ORDER BY dia),
       round((3 + (r2 % 120) / 10.0)::numeric, 1),
       CASE WHEN r2 % 10 < 3 THEN 1 + r2 % 3 ELSE 0 END,
       CASE WHEN r1 % 4 = 0 THEN 1 + r1 % 2 ELSE 0 END,
       round(((r1 % 100) / 10.0)::numeric, 1)
FROM km
ON CONFLICT ("caminhaoId", data) DO NOTHING;

-- Odômetro do caminhão acompanha o último dia de telemetria.
UPDATE "Caminhao" c
SET "odometroKm" = t.odo
FROM (SELECT "caminhaoId", max("odometroKm") AS odo FROM "TelemetriaDia" GROUP BY "caminhaoId") t
WHERE t."caminhaoId" = c.id AND c.modelo = 'Exemplo' AND c."odometroKm" < t.odo;
