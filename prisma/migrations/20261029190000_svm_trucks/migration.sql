-- O cliente AVM Truck passa a se chamar SVM Trucks. Os logins continuam os mesmos.
UPDATE "Cliente" SET "nome" = 'SVM Trucks' WHERE "nome" = 'AVM Truck';
UPDATE "Usuario" SET "nome" = 'Gestor SVM Trucks' WHERE "nome" = 'Gestor AVM Truck';
