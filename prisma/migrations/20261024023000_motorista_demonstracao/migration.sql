-- Acesso de demonstração do motorista Nelson Duarte (AVM Truck): celular 0981123456, PIN 123456.
INSERT INTO "Usuario" ("id", "email", "nome", "senhaHash", "papel", "clienteId", "motoristaId")
SELECT 'demo_motorista_avm', '0981123456', m."nome", '$2b$10$ZLp6F8eJAtpDEs0unsuVBeOdDti4MnaBWidpDUizB8tdw0YmK/3Vu', 'MOTORISTA', m."clienteId", m."id"
FROM "Motorista" m JOIN "Cliente" c ON c."id" = m."clienteId"
WHERE c."nome" = 'AVM Truck' AND m."nome" = 'Nelson Duarte'
  AND NOT EXISTS (SELECT 1 FROM "Usuario" WHERE "email" = '0981123456' OR "motoristaId" = m."id")
LIMIT 1;
