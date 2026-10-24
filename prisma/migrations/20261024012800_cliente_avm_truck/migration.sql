-- Dados de demonstração: o cliente completo passa a se chamar AVM Truck,
-- com as cores do Paraguai. Não altera nada se esses registros não existirem.
UPDATE "Cliente" SET "nome" = 'AVM Truck', "ruc" = '80012345-6', "pais" = 'PY' WHERE "nome" = 'Transportes Monday S.A.';
UPDATE "Cliente" SET "pais" = 'PY' WHERE "nome" = 'Agrotransporte Naranjal';
UPDATE "Usuario" SET "email" = 'gestor@avmtruck.com.py', "nome" = 'Gestor AVM Truck'
  WHERE "email" = 'gestor@transportesmonday.com.py'
    AND NOT EXISTS (SELECT 1 FROM "Usuario" WHERE "email" = 'gestor@avmtruck.com.py');
