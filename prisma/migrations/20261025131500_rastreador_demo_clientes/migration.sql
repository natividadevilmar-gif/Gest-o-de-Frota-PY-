-- Rastreadores de demonstração para os caminhões de exemplo dos clientes de demonstração,
-- para o Mapa ao vivo mostrar a frota de qualquer cliente escolhido na apresentação.
-- Só caminhões "Exemplo" sem rastreador; caminhões reais cadastrados depois não são tocados.
UPDATE "Caminhao" c
SET "rastreadorId" = 'SIM-' || right(c."clienteId", 4) || '-' || replace(c.placa, ' ', '')
FROM "Cliente" cl
WHERE cl.id = c."clienteId"
  AND c."rastreadorId" IS NULL
  AND c.modelo = 'Exemplo'
  AND cl.nome IN ('Agrotransporte Naranjal', 'Combustibles del Este', 'Cooperativa San Alberto', 'Fletes Los Cedrales', 'Logística Itapúa');
