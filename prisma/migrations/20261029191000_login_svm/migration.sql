-- O login do gestor acompanha o novo nome do cliente (SVM Trucks). A senha não muda.
UPDATE "Usuario" SET "email" = 'gestor@svmtrucks.com.py'
  WHERE "email" = 'gestor@avmtruck.com.py'
    AND NOT EXISTS (SELECT 1 FROM "Usuario" WHERE "email" = 'gestor@svmtrucks.com.py');
