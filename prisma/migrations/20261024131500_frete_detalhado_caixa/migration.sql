-- AlterTable
ALTER TABLE "Viagem" ADD COLUMN     "custosExtrasUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "dataEntrega" DATE,
ADD COLUMN     "documento" TEXT,
ADD COLUMN     "embarcador" TEXT,
ADD COLUMN     "moeda" TEXT NOT NULL DEFAULT 'USD',
ADD COLUMN     "motoristaId" TEXT,
ADD COLUMN     "observacao" TEXT,
ADD COLUMN     "paisDestino" TEXT NOT NULL DEFAULT 'PY',
ADD COLUMN     "paisOrigem" TEXT NOT NULL DEFAULT 'PY',
ADD COLUMN     "precoTonelada" DOUBLE PRECISION,
ADD COLUMN     "recebido" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "valorOriginal" DOUBLE PRECISION,
ADD COLUMN     "vencimento" DATE;

-- CreateTable
CREATE TABLE "CaixaInicial" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "mes" TEXT NOT NULL,
    "moeda" TEXT NOT NULL DEFAULT 'USD',
    "valorOriginal" DOUBLE PRECISION NOT NULL,
    "valorUsd" DOUBLE PRECISION NOT NULL,
    "observacao" TEXT,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaixaInicial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CaixaInicial_clienteId_mes_key" ON "CaixaInicial"("clienteId", "mes");

-- AddForeignKey
ALTER TABLE "Viagem" ADD CONSTRAINT "Viagem_motoristaId_fkey" FOREIGN KEY ("motoristaId") REFERENCES "Motorista"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaixaInicial" ADD CONSTRAINT "CaixaInicial_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Fretes de exemplo do cliente de demonstração ganham os novos detalhes.
UPDATE "Viagem" v SET
  "embarcador" = CASE v."carga" WHEN 'Soja' THEN 'Cooperativa Colonias Unidas' WHEN 'Milho' THEN 'Agrofértil S.A.' WHEN 'Fertilizante' THEN 'Fertilizantes del Este' ELSE 'Distribuidora Monday' END,
  "documento" = 'FAC 001-001-' || lpad((abs(hashtext(v."id")) % 100000)::text, 7, '0'),
  "precoTonelada" = round((v."freteUsd" / v."toneladas")::numeric, 2),
  "motoristaId" = c."motoristaId",
  "recebido" = v."data" < CURRENT_DATE - 4,
  "vencimento" = v."data" + 15
FROM "Caminhao" c JOIN "Cliente" cl ON cl."id" = c."clienteId"
WHERE c."id" = v."caminhaoId" AND cl."nome" = 'AVM Truck' AND v."embarcador" IS NULL;

INSERT INTO "CaixaInicial" ("id", "clienteId", "mes", "moeda", "valorOriginal", "valorUsd", "observacao", "atualizadoEm")
SELECT 'demo_caixa_' || to_char(CURRENT_DATE, 'YYYYMM'), cl."id", to_char(CURRENT_DATE, 'YYYY-MM'), 'USD', 25000, 25000, 'Banco + dinheiro no escritório', now()
FROM "Cliente" cl WHERE cl."nome" = 'AVM Truck'
ON CONFLICT DO NOTHING;


-- Mais fretes de exemplo do mês para a demonstração da AVM Truck (seis por caminhão).
INSERT INTO "Viagem" ("id","caminhaoId","data","origem","destino","carga","toneladas","freteUsd","kmCarregado","kmVazio","embarcador","paisOrigem","paisDestino","precoTonelada","documento","custosExtrasUsd","recebido","motoristaId","vencimento")
SELECT x.id, c."id", CURRENT_DATE + x.dia, x.o, x.d, x.carga, x.ton, x.frete, x.km, x.vazio, x.emb, x.po, x.pd, x.pt, x.doc, x.extras, x.rec, c."motoristaId", CURRENT_DATE + x.dia + 15
FROM (VALUES
('demo_frete_01','AABN 389',-1,'Santa Rita','Porto de Villeta','Soja',31,634.88,470,94,'Cooperativa Colonias Unidas','PY','PY',20.48,'FAC 001-002-0004501',40,false),
('demo_frete_02','AABN 389',-7,'Naranjal','Ciudad del Este','Milho',33,360.03,160,160,'Agrofértil S.A.','PY','PY',10.91,'FAC 001-002-0004502',0,true),
('demo_frete_03','AABN 389',-9,'Santa Rita','Paranaguá','Soja',28,1674.12,780,780,'Cargill Paraguay','PY','BR',59.79,'FAC 001-002-0004503',120,true),
('demo_frete_04','AABN 389',-13,'San Alberto','Encarnación','Fertilizante',33,591.69,255,255,'Fertilizantes del Este','PY','PY',17.93,'FAC 001-002-0004504',0,true),
('demo_frete_05','AABN 389',-18,'Foz do Iguaçu','Santa Rita','Fertilizante',33,265.98,210,42,'Fertilizantes del Este','BR','PY',8.06,'FAC 001-002-0004505',120,true),
('demo_frete_06','AABN 389',-22,'Hernandarias','Posadas','Carga geral',30,702.60,330,330,'Distribuidora Monday','PY','AR',23.42,'FAC 001-002-0004506',80,true),
('demo_frete_07','AACX 904',-3,'Hernandarias','Posadas','Carga geral',30,761.10,330,330,'Distribuidora Monday','PY','AR',25.37,'FAC 001-002-0004507',120,false),
('demo_frete_08','AACX 904',-5,'Santa Rosa del Monday','Porto de Villeta','Trigo',30,1237.80,505,505,'Molinos del Paraná','PY','PY',41.26,'FAC 001-002-0004508',0,false),
('demo_frete_09','AACX 904',-9,'Ciudad del Este','Cascavel','Contêiner',28,625.80,270,270,'Logística Tres Fronteras','PY','BR',22.35,'FAC 001-002-0004509',80,true),
('demo_frete_10','AACX 904',-14,'Santa Rita','Porto de Villeta','Soja',30,985.80,470,470,'Cooperativa Colonias Unidas','PY','PY',32.86,'FAC 001-002-0004510',0,true),
('demo_frete_11','AACX 904',-17,'Naranjal','Ciudad del Este','Milho',33,231.99,160,32,'Agrofértil S.A.','PY','PY',7.03,'FAC 001-002-0004511',0,true),
('demo_frete_12','AACX 904',-22,'Santa Rita','Paranaguá','Soja',30,1854.90,780,780,'Cargill Paraguay','PY','BR',61.83,'FAC 001-002-0004512',120,true),
('demo_frete_13','AAFR 218',-1,'Santa Rita','Paranaguá','Soja',32,1752.00,780,780,'Cargill Paraguay','PY','BR',54.75,'FAC 001-002-0004513',80,false),
('demo_frete_14','AAFR 218',-6,'San Alberto','Encarnación','Fertilizante',32,580.48,255,255,'Fertilizantes del Este','PY','PY',18.14,'FAC 001-002-0004514',0,false),
('demo_frete_15','AAFR 218',-11,'Foz do Iguaçu','Santa Rita','Fertilizante',28,285.88,210,42,'Fertilizantes del Este','BR','PY',10.21,'FAC 001-002-0004515',80,true),
('demo_frete_16','AAFR 218',-14,'Hernandarias','Posadas','Carga geral',31,743.38,330,330,'Distribuidora Monday','PY','AR',23.98,'FAC 001-002-0004516',120,true),
('demo_frete_17','AAFR 218',-18,'Santa Rosa del Monday','Porto de Villeta','Trigo',32,1127.68,505,505,'Molinos del Paraná','PY','PY',35.24,'FAC 001-002-0004517',0,true),
('demo_frete_18','AAFR 218',-23,'Ciudad del Este','Cascavel','Contêiner',28,634.76,270,270,'Logística Tres Fronteras','PY','BR',22.67,'FAC 001-002-0004518',120,true),
('demo_frete_19','AAGT 507',-3,'Ciudad del Este','Cascavel','Contêiner',32,640.00,270,270,'Logística Tres Fronteras','PY','BR',20.0,'FAC 001-002-0004519',120,false),
('demo_frete_20','AAGT 507',-7,'Santa Rita','Porto de Villeta','Soja',28,588.28,470,94,'Cooperativa Colonias Unidas','PY','PY',21.01,'FAC 001-002-0004520',0,true),
('demo_frete_21','AAGT 507',-9,'Naranjal','Ciudad del Este','Milho',32,356.80,160,160,'Agrofértil S.A.','PY','PY',11.15,'FAC 001-002-0004521',0,true),
('demo_frete_22','AAGT 507',-13,'Santa Rita','Paranaguá','Soja',32,1735.68,780,780,'Cargill Paraguay','PY','BR',54.24,'FAC 001-002-0004522',80,true),
('demo_frete_23','AAGT 507',-17,'San Alberto','Encarnación','Fertilizante',32,613.44,255,255,'Fertilizantes del Este','PY','PY',19.17,'FAC 001-002-0004523',0,true),
('demo_frete_24','AAGT 507',-22,'Foz do Iguaçu','Santa Rita','Fertilizante',33,453.09,210,210,'Fertilizantes del Este','BR','PY',13.73,'FAC 001-002-0004524',80,true),
('demo_frete_25','AAHM 331',-1,'Foz do Iguaçu','Santa Rita','Fertilizante',32,284.48,210,42,'Fertilizantes del Este','BR','PY',8.89,'FAC 001-002-0004525',120,false),
('demo_frete_26','AAHM 331',-7,'Hernandarias','Posadas','Carga geral',30,443.10,330,66,'Distribuidora Monday','PY','AR',14.77,'FAC 001-002-0004526',80,true),
('demo_frete_27','AAHM 331',-11,'Santa Rosa del Monday','Porto de Villeta','Trigo',31,1200.94,505,505,'Molinos del Paraná','PY','PY',38.74,'FAC 001-002-0004527',0,true),
('demo_frete_28','AAHM 331',-15,'Ciudad del Este','Cascavel','Contêiner',33,357.39,270,54,'Logística Tres Fronteras','PY','BR',10.83,'FAC 001-002-0004528',120,true),
('demo_frete_29','AAHM 331',-18,'Santa Rita','Porto de Villeta','Soja',33,621.39,470,94,'Cooperativa Colonias Unidas','PY','PY',18.83,'FAC 001-002-0004529',40,true),
('demo_frete_30','AAHM 331',-23,'Naranjal','Ciudad del Este','Milho',32,379.20,160,160,'Agrofértil S.A.','PY','PY',11.85,'FAC 001-002-0004530',0,true),
('demo_frete_31','AAJP 146',-2,'Naranjal','Ciudad del Este','Milho',28,340.20,160,160,'Agrofértil S.A.','PY','PY',12.15,'FAC 001-002-0004531',0,false),
('demo_frete_32','AAJP 146',-5,'Santa Rita','Paranaguá','Soja',28,1621.20,780,780,'Cargill Paraguay','PY','BR',57.9,'FAC 001-002-0004532',120,false),
('demo_frete_33','AAJP 146',-11,'San Alberto','Encarnación','Fertilizante',30,608.40,255,255,'Fertilizantes del Este','PY','PY',20.28,'FAC 001-002-0004533',0,true),
('demo_frete_34','AAJP 146',-13,'Foz do Iguaçu','Santa Rita','Fertilizante',28,294.84,210,42,'Fertilizantes del Este','BR','PY',10.53,'FAC 001-002-0004534',80,true),
('demo_frete_35','AAJP 146',-18,'Hernandarias','Posadas','Carga geral',31,445.16,330,66,'Distribuidora Monday','PY','AR',14.36,'FAC 001-002-0004535',80,true),
('demo_frete_36','AAJP 146',-22,'Santa Rosa del Monday','Porto de Villeta','Trigo',28,745.08,505,101,'Molinos del Paraná','PY','PY',26.61,'FAC 001-002-0004536',0,true),
('demo_frete_37','AAKD 672',-3,'Santa Rosa del Monday','Porto de Villeta','Trigo',32,1130.24,505,505,'Molinos del Paraná','PY','PY',35.32,'FAC 001-002-0004537',40,false),
('demo_frete_38','AAKD 672',-7,'Ciudad del Este','Cascavel','Contêiner',31,572.26,270,270,'Logística Tres Fronteras','PY','BR',18.46,'FAC 001-002-0004538',120,true),
('demo_frete_39','AAKD 672',-9,'Santa Rita','Porto de Villeta','Soja',30,693.90,470,94,'Cooperativa Colonias Unidas','PY','PY',23.13,'FAC 001-002-0004539',0,true),
('demo_frete_40','AAKD 672',-13,'Naranjal','Ciudad del Este','Milho',33,348.81,160,160,'Agrofértil S.A.','PY','PY',10.57,'FAC 001-002-0004540',0,true),
('demo_frete_41','AAKD 672',-17,'Santa Rita','Paranaguá','Soja',33,1921.92,780,780,'Cargill Paraguay','PY','BR',58.24,'FAC 001-002-0004541',80,true),
('demo_frete_42','AAKD 672',-21,'San Alberto','Encarnación','Fertilizante',33,330.00,255,51,'Fertilizantes del Este','PY','PY',10.0,'FAC 001-002-0004542',40,true),
('demo_frete_43','AALS 755',-1,'San Alberto','Encarnación','Fertilizante',30,376.80,255,51,'Fertilizantes del Este','PY','PY',12.56,'FAC 001-002-0004543',0,false),
('demo_frete_44','AALS 755',-5,'Foz do Iguaçu','Santa Rita','Fertilizante',33,438.90,210,210,'Fertilizantes del Este','BR','PY',13.3,'FAC 001-002-0004544',80,false),
('demo_frete_45','AALS 755',-10,'Hernandarias','Posadas','Carga geral',32,712.00,330,330,'Distribuidora Monday','PY','AR',22.25,'FAC 001-002-0004545',120,true),
('demo_frete_46','AALS 755',-13,'Santa Rosa del Monday','Porto de Villeta','Trigo',31,629.61,505,101,'Molinos del Paraná','PY','PY',20.31,'FAC 001-002-0004546',0,true),
('demo_frete_47','AALS 755',-18,'Ciudad del Este','Cascavel','Contêiner',30,647.70,270,270,'Logística Tres Fronteras','PY','BR',21.59,'FAC 001-002-0004547',120,true),
('demo_frete_48','AALS 755',-23,'Santa Rita','Porto de Villeta','Soja',33,593.01,470,94,'Cooperativa Colonias Unidas','PY','PY',17.97,'FAC 001-002-0004548',0,true)
) AS x(id, placa, dia, o, d, carga, ton, frete, km, vazio, emb, po, pd, pt, doc, extras, rec)
JOIN "Caminhao" c ON c."placa" = x.placa
JOIN "Cliente" cl ON cl."id" = c."clienteId" AND cl."nome" = 'AVM Truck'
ON CONFLICT ("id") DO NOTHING;
