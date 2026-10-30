-- A SVM Trucks já abre com o plano de revisões de demonstração montado (o mesmo do botão do admin).
WITH cam AS (
  SELECT c.id, c."odometroKm" AS odo, (ROW_NUMBER() OVER (ORDER BY c.placa) - 1)::int AS i
  FROM "Caminhao" c JOIN "Cliente" cl ON cl.id = c."clienteId"
  WHERE cl.nome ILIKE '%svm%' AND NOT c."baseCombustivel"
    AND NOT EXISTS (SELECT 1 FROM "ItemRevisao" r WHERE r."caminhaoId" = c.id AND r.demo)
),
modelo(j, nome, intervalo) AS (
  VALUES (0, 'Troca de óleo do motor e filtro', 20000), (1, 'Filtros de ar e de combustível', 40000), (2, 'Freios: lonas e tambores', 60000)
),
uso AS (SELECT ARRAY[1.06, 0.96, 0.72, 0.45, 0.2, 0.88, 0.6, 0.33]::float8[] AS u, ARRAY[-6, 9, 140, 45, 260, 12, 75, 190] AS d)
INSERT INTO "ItemRevisao" (id, "caminhaoId", nome, gatilho, "intervaloKm", "ultimoKm", vencimento, resolvido, demo)
SELECT 'demo' || md5(cam.id || modelo.nome), cam.id, modelo.nome, 'KM'::"Gatilho", modelo.intervalo,
       GREATEST(0, ROUND(cam.odo - uso.u[((cam.i + modelo.j * 3) % 8) + 1] * modelo.intervalo))::int, NULL::date, false, true
FROM cam, modelo, uso
UNION ALL
SELECT 'demo' || md5(cam.id || 'dinatran'), cam.id, 'Habilitação DINATRAN', 'DATA'::"Gatilho", NULL::int, NULL::int,
       CURRENT_DATE + uso.d[(cam.i % 8) + 1], false, true
FROM cam, uso;
