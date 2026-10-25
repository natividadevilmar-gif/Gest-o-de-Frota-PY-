-- AlterTable
ALTER TABLE "Caminhao" ADD COLUMN     "eixos" INTEGER NOT NULL DEFAULT 6;

-- AlterTable
ALTER TABLE "Viagem" ADD COLUMN     "rotaPedagioId" TEXT;

-- CreateTable
CREATE TABLE "PracaPedagio" (
    "id" TEXT NOT NULL,
    "pais" TEXT NOT NULL,
    "rodovia" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "moeda" TEXT NOT NULL,
    "tarifaEixo" DOUBLE PRECISION,
    "tarifaFixa" DOUBLE PRECISION,
    "sentido" TEXT,
    "fonte" TEXT NOT NULL,
    "vigencia" DATE NOT NULL,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PracaPedagio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RotaPedagio" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "origem" TEXT NOT NULL,
    "destino" TEXT NOT NULL,
    "paises" TEXT NOT NULL,
    "km" INTEGER NOT NULL,
    "pracas" TEXT[],

    CONSTRAINT "RotaPedagio_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Viagem" ADD CONSTRAINT "Viagem_rotaPedagioId_fkey" FOREIGN KEY ("rotaPedagioId") REFERENCES "RotaPedagio"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Praças com a tarifa de caminhão pesado (cavalo + carreta). Valores públicos levantados em 25/10/2026;
-- "estimado" na fonte quando não há tabela oficial publicada da praça. A equipe KM Cero corrige em /pedagios.
INSERT INTO "PracaPedagio" ("id","pais","rodovia","nome","lat","lng","moeda","tarifaEixo","tarifaFixa","fonte","vigencia","atualizadoEm") VALUES
-- Paraguai: Tape Porã (PY02/PY07, concessão), cat. 6-7 (5 e 6 eixos)
('py-ypacarai','PY','PY02','Ypacaraí',-25.405,-57.283,'PYG',NULL,74000,'MOPC, tarifa Tape Porã cat. 6-7 (5-6 eixos), mopc.gov.py','2025-07-06',now()),
('py-nueva-londres','PY','PY02','Nueva Londres',-25.405,-56.545,'PYG',NULL,74000,'MOPC, tarifa Tape Porã cat. 6-7 (5-6 eixos), mopc.gov.py','2025-07-06',now()),
('py-pastoreo','PY','PY02','Juan Manuel Frutos (Pastoreo, km 205,7)',-25.385,-55.83,'PYG',NULL,74000,'MOPC, tarifa Tape Porã cat. 6-7 (5-6 eixos), mopc.gov.py','2025-07-06',now()),
('py-minga-guazu','PY','PY02','Minga Guazú (km 305,7)',-25.49,-54.80,'PYG',NULL,74000,'MOPC, tarifa Tape Porã cat. 6-7 (5-6 eixos), mopc.gov.py','2025-07-06',now()),
-- Paraguai: MOPC Res. 2471/2025 (caminhão de mais de 3 eixos)
('py-ecovia','PY','Luque–San Bernardino','Ecovía',-25.30,-57.38,'PYG',NULL,58000,'MOPC Res. 2471/2025, mais de 3 eixos (La Nación, 02/01/2025)','2025-01-02',now()),
('py-caapucu','PY','PY01','Caapucú',-26.23,-57.18,'PYG',NULL,28000,'MOPC Res. 2471/2025, mais de 3 eixos (La Nación, 02/01/2025)','2025-01-02',now()),
-- Paraguai: demais postos MOPC (IP, 01/04/2026). Sem tabela publicada por posto: estimado igual a Caapucú.
('py-ita','PY','PY01','Itá',-25.50,-57.37,'PYG',NULL,28000,'Posto MOPC (IP 01/04/2026); tarifa estimada igual a Caapucú, confirmar','2025-01-02',now()),
('py-portal-itapua','PY','PY01','Portal de Itapúa',-27.10,-56.25,'PYG',NULL,28000,'Posto MOPC (IP 01/04/2026); tarifa estimada igual a Caapucú, confirmar','2025-01-02',now()),
('py-remanso','PY','PY09','Remanso',-25.17,-57.55,'PYG',NULL,28000,'Posto MOPC (IP 01/04/2026); tarifa estimada igual a Caapucú, confirmar','2025-01-02',now()),
('py-heroes-chaco','PY','PY09','Héroes del Chaco',-24.90,-57.85,'PYG',NULL,28000,'Posto MOPC (IP 01/04/2026); tarifa estimada igual a Caapucú, confirmar','2025-01-02',now()),
('py-pozo-colorado','PY','PY09','Pozo Colorado',-23.49,-58.80,'PYG',NULL,28000,'Posto MOPC (IP 01/04/2026); tarifa estimada igual a Caapucú, confirmar','2025-01-02',now()),
('py-emboscada','PY','PY03','Emboscada',-25.12,-57.36,'PYG',NULL,28000,'Posto MOPC (IP 01/04/2026); tarifa estimada igual a Caapucú, confirmar','2025-01-02',now()),
('py-25-diciembre','PY','PY03','25 de Diciembre',-24.70,-56.88,'PYG',NULL,28000,'Posto MOPC (IP 01/04/2026); tarifa estimada igual a Caapucú, confirmar','2025-01-02',now()),
('py-guayayvi','PY','PY03','Guayayví',-24.20,-56.40,'PYG',NULL,28000,'Posto MOPC (IP 01/04/2026); tarifa estimada igual a Caapucú, confirmar','2025-01-02',now()),
('py-rio-verde','PY','PY08','Río Verde',-23.95,-56.30,'PYG',NULL,28000,'Posto MOPC (IP 01/04/2026); tarifa estimada igual a Caapucú, confirmar','2025-01-02',now()),
('py-tacuara','PY','PY08','Tacuara',-24.40,-56.30,'PYG',NULL,28000,'Posto MOPC (IP 01/04/2026); tarifa estimada igual a Caapucú, confirmar','2025-01-02',now()),
('py-trinidad','PY','PY06','Trinidad',-27.13,-55.70,'PYG',NULL,28000,'Posto MOPC (IP 01/04/2026); tarifa estimada igual a Caapucú, confirmar','2025-01-02',now()),
('py-iruna','PY','PY06','Iruña',-25.90,-55.08,'PYG',NULL,28000,'Posto MOPC (IP 01/04/2026); tarifa estimada igual a Caapucú, confirmar','2025-01-02',now()),
('py-mayor-otano','PY','PY07','Mayor Otaño',-26.33,-54.67,'PYG',NULL,28000,'Posto MOPC (IP 01/04/2026); tarifa estimada igual a Caapucú, confirmar','2025-01-02',now()),
('py-horqueta','PY','PY05','Horqueta',-23.34,-57.05,'PYG',NULL,28000,'Posto MOPC (IP 01/04/2026); tarifa estimada igual a Caapucú, confirmar','2025-01-02',now()),
-- Uruguai: MTOP, categoria 6 (4 eixos ou mais), tarifa básica por passada
('uy-barra-santa-lucia','UY','Ruta 1 km 23,5','Barra de Santa Lucía',-34.78,-56.36,'UYU',NULL,527.78,'MTOP, cat. 6 tarifa básica (comunicado 05/06/2026, gub.uy)','2026-06-05',now()),
('uy-cufre','UY','Ruta 1 km 107,3','Cufré',-34.32,-57.10,'UYU',NULL,527.78,'MTOP, cat. 6 tarifa básica (comunicado 05/06/2026, gub.uy)','2026-06-05',now()),
('uy-mercedes','UY','Ruta 2 km 284,4','Mercedes',-33.25,-58.02,'UYU',NULL,527.78,'MTOP, cat. 6 tarifa básica (comunicado 05/06/2026, gub.uy)','2026-06-05',now()),
('uy-paso-puerto','UY','Ruta 3 km 245,2','Paso del Puerto',-32.82,-57.55,'UYU',NULL,527.78,'MTOP, cat. 6 tarifa básica (comunicado 05/06/2026, gub.uy)','2026-06-05',now()),
('uy-queguay','UY','Ruta 3 km 392,7','Queguay',-32.10,-57.95,'UYU',NULL,527.78,'MTOP, cat. 6 tarifa básica (comunicado 05/06/2026, gub.uy)','2026-06-05',now()),
('uy-mendoza','UY','Ruta 5 km 67,7','Mendoza',-34.30,-56.22,'UYU',NULL,527.78,'MTOP, cat. 6 tarifa básica (comunicado 05/06/2026, gub.uy)','2026-06-05',now()),
('uy-centenario','UY','Ruta 5 km 246,3','Centenario',-32.85,-56.45,'UYU',NULL,527.78,'MTOP, cat. 6 tarifa básica (comunicado 05/06/2026, gub.uy)','2026-06-05',now()),
('uy-manuel-diaz','UY','Ruta 5 km 423,2','Manuel Díaz',-31.42,-55.98,'UYU',NULL,527.78,'MTOP, cat. 6 tarifa básica (comunicado 05/06/2026, gub.uy)','2026-06-05',now()),
('uy-soca','UY','Ruta 8 km 50,5','Soca',-34.68,-55.70,'UYU',NULL,527.78,'MTOP, cat. 6 tarifa básica (comunicado 05/06/2026, gub.uy)','2026-06-05',now()),
('uy-cebollati','UY','Ruta 8 km 206,2','Cebollatí',-33.55,-54.75,'UYU',NULL,527.78,'MTOP, cat. 6 tarifa básica (comunicado 05/06/2026, gub.uy)','2026-06-05',now()),
('uy-capilla-cella','UY','Ruta 9 km 79,5','Capilla de Cella',-34.73,-55.30,'UYU',NULL,527.78,'MTOP, cat. 6 tarifa básica (comunicado 05/06/2026, gub.uy)','2026-06-05',now()),
('uy-garzon','UY','Ruta 9 km 191','Garzón',-34.55,-54.55,'UYU',NULL,527.78,'MTOP, cat. 6 tarifa básica (comunicado 05/06/2026, gub.uy)','2026-06-05',now()),
('uy-santa-lucia','UY','Ruta 11 km 81','Santa Lucía',-34.45,-56.40,'UYU',NULL,527.78,'MTOP, cat. 6 tarifa básica (comunicado 05/06/2026, gub.uy)','2026-06-05',now()),
('uy-pando','UY','Interbalnearia km 32,4','Pando',-34.80,-55.90,'UYU',NULL,527.78,'MTOP, cat. 6 tarifa básica (comunicado 05/06/2026, gub.uy)','2026-06-05',now()),
('uy-solis','UY','Interbalnearia km 81','Solís',-34.78,-55.45,'UYU',NULL,527.78,'MTOP, cat. 6 tarifa básica (comunicado 05/06/2026, gub.uy)','2026-06-05',now()),
-- Brasil: BR-277 e BR-163 no Paraná, tarifa por eixo de caminhão
('br-sao-miguel','BR','BR-277','São Miguel do Iguaçu',-25.35,-54.24,'BRL',15.74,NULL,'Lote 6 PR, estimado (Gazeta do Povo 12/2024 + reajuste), confirmar','2025-12-01',now()),
('br-ceu-azul','BR','BR-277','Céu Azul',-25.15,-53.85,'BRL',13.70,NULL,'Lote 6 PR, estimado (Gazeta do Povo 12/2024 + reajuste), confirmar','2025-12-01',now()),
('br-cascavel','BR','BR-277','Cascavel',-25.03,-53.35,'BRL',13.64,NULL,'Lote 6 PR, estimado (Gazeta do Povo 12/2024 + reajuste), confirmar','2025-12-01',now()),
('br-laranjeiras','BR','BR-277','Laranjeiras do Sul',-25.40,-52.40,'BRL',13.74,NULL,'Lote 6 PR, estimado (Gazeta do Povo 12/2024 + reajuste), confirmar','2025-12-01',now()),
('br-candoi','BR','BR-277','Candói',-25.57,-52.05,'BRL',14.52,NULL,'Lote 6 PR, estimado (Gazeta do Povo 12/2024 + reajuste), confirmar','2025-12-01',now()),
('br-prudentopolis','BR','BR-277','Prudentópolis',-25.21,-50.98,'BRL',15.08,NULL,'Lote 6 PR, estimado (Gazeta do Povo 12/2024 + reajuste), confirmar','2025-12-01',now()),
('br-irati','BR','BR-277','Irati',-25.47,-50.65,'BRL',11.50,NULL,'Reajuste ANTT a partir de 28/08/2026 (Rede CNT)','2026-08-28',now()),
('br-porto-amazonas','BR','BR-277','Porto Amazonas',-25.55,-49.89,'BRL',12.30,NULL,'Reajuste ANTT a partir de 28/08/2026 (Rede CNT)','2026-08-28',now()),
('br-purruna','BR','BR-277','São Luiz do Purunã',-25.45,-49.69,'BRL',9.80,NULL,'Reajuste ANTT a partir de 28/08/2026 (Rede CNT)','2026-08-28',now()),
('br-lindoeste','BR','BR-163','Lindoeste',-25.26,-53.58,'BRL',17.09,NULL,'R$ 136,72 para 8 eixos ÷ 8, estimado por eixo, confirmar','2025-12-01',now()),
-- Argentina: RN12 Misiones e RN14 Autovía del Mercosur
('ar-santa-ana','AR','RN12','Santa Ana',-27.37,-55.58,'ARS',NULL,7500,'Res. DNV 248/2026, cat. 5 (El Territorio, 24/02/2026); categoria do bitrem a confirmar','2026-02-26',now()),
('ar-colonia-victoria','AR','RN12','Colonia Victoria',-26.33,-54.62,'ARS',NULL,7500,'Res. DNV 248/2026, cat. 5 (El Territorio, 24/02/2026); categoria do bitrem a confirmar','2026-02-26',now()),
('ar-eldorado','AR','RN12','Eldorado',-26.42,-54.64,'ARS',NULL,7500,'Res. DNV 248/2026, cat. 5 (El Territorio, 24/02/2026); categoria do bitrem a confirmar','2026-02-26',now()),
('ar-piedritas','AR','RN14','Piedritas',-29.60,-57.15,'ARS',NULL,18723.83,'Autovía del Mercosur, cat. 5-6 manual (APF Digital, 04/09/2026)','2026-09-05',now()),
('ar-yerua','AR','RN14','Yeruá',-31.47,-58.20,'ARS',NULL,18723.83,'Autovía del Mercosur, cat. 5-6 manual (APF Digital, 04/09/2026)','2026-09-05',now());

-- Corredores, com as praças na ordem da ida.
INSERT INTO "RotaPedagio" ("id","nome","origem","destino","paises","km","pracas") VALUES
('asu-cde','Asunción → Ciudad del Este (PY02)','Asunción','Ciudad del Este','PY',327,ARRAY['py-ypacarai','py-nueva-londres','py-pastoreo','py-minga-guazu']),
('asu-enc','Asunción → Encarnación (PY01)','Asunción','Encarnación','PY',370,ARRAY['py-ita','py-caapucu','py-portal-itapua']),
('enc-cde','Encarnación → Ciudad del Este (PY06)','Encarnación','Ciudad del Este','PY',280,ARRAY['py-trinidad','py-iruna']),
('asu-chaco','Asunción → Pozo Colorado (Transchaco PY09)','Asunción','Pozo Colorado','PY',270,ARRAY['py-remanso','py-heroes-chaco','py-pozo-colorado']),
('asu-norte','Asunción → Yby Yaú (PY03)','Asunción','Yby Yaú','PY',330,ARRAY['py-emboscada','py-25-diciembre','py-guayayvi']),
('foz-ctba','Foz do Iguaçu → Curitiba (BR-277)','Foz do Iguaçu','Curitiba','BR',640,ARRAY['br-sao-miguel','br-ceu-azul','br-cascavel','br-laranjeiras','br-candoi','br-prudentopolis','br-irati','br-porto-amazonas','br-purruna']),
('asu-ctba','Asunción → Curitiba (PY02 + BR-277)','Asunción','Curitiba','PY,BR',970,ARRAY['py-ypacarai','py-nueva-londres','py-pastoreo','py-minga-guazu','br-sao-miguel','br-ceu-azul','br-cascavel','br-laranjeiras','br-candoi','br-prudentopolis','br-irati','br-porto-amazonas','br-purruna']),
('cascavel-clm','Cascavel → Capitão Leônidas Marques (BR-163)','Cascavel','Capitão Leônidas Marques','BR',90,ARRAY['br-lindoeste']),
('pos-iguazu','Posadas → Puerto Iguazú (RN12)','Posadas','Puerto Iguazú','AR',300,ARRAY['ar-santa-ana','ar-colonia-victoria','ar-eldorado']),
('pos-bsas','Posadas → Buenos Aires (RN14)','Posadas','Buenos Aires','AR',1050,ARRAY['ar-piedritas','ar-yerua']),
('asu-bsas','Asunción → Buenos Aires (PY01 + RN14)','Asunción','Buenos Aires','PY,AR',1420,ARRAY['py-ita','py-caapucu','py-portal-itapua','ar-piedritas','ar-yerua']),
('mvd-colonia','Montevideo → Colonia (Ruta 1)','Montevideo','Colonia','UY',177,ARRAY['uy-barra-santa-lucia','uy-cufre']),
('mvd-fray-bentos','Montevideo → Fray Bentos (Rutas 1 e 2)','Montevideo','Fray Bentos','UY',310,ARRAY['uy-barra-santa-lucia','uy-cufre','uy-mercedes']),
('mvd-salto','Montevideo → Salto (Rutas 1 e 3)','Montevideo','Salto','UY',500,ARRAY['uy-barra-santa-lucia','uy-paso-puerto','uy-queguay']),
('mvd-rivera','Montevideo → Rivera (Ruta 5)','Montevideo','Rivera','UY',500,ARRAY['uy-mendoza','uy-centenario','uy-manuel-diaz']),
('mvd-rio-branco','Montevideo → Río Branco (Ruta 8)','Montevideo','Río Branco','UY',420,ARRAY['uy-soca','uy-cebollati']),
('mvd-chuy','Montevideo → Chuy (Interbalnearia e Ruta 9)','Montevideo','Chuy','UY',340,ARRAY['uy-pando','uy-solis','uy-garzon']);
