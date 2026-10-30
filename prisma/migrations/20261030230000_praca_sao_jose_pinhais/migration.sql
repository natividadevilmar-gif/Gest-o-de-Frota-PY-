-- Praça de São José dos Pinhais (BR-277, Curitiba–Paranaguá), que faltava no cadastro.
INSERT INTO "PracaPedagio" ("id","pais","rodovia","nome","lat","lng","moeda","tarifaEixo","tarifaFixa","fonte","vigencia","atualizadoEm") VALUES
('br-sao-jose-pinhais','BR','BR-277','São José dos Pinhais',-25.53,-49.01,'BRL',24.00,NULL,'EPR Litoral Pioneiro, R$ 24,00 por eixo a partir de 28/08/2025 (Tribuna PR), confirmar','2025-08-28',now())
ON CONFLICT ("id") DO NOTHING;
