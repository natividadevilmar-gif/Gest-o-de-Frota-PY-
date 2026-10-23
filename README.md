# Gestão de Frota PY

Plataforma de gestão de frota para transportadoras do Paraguai: custo por km, consumo e ranking de motoristas, plano de revisões e margem por viagem, com planos Básico, Gestão e Vídeo por caminhão.

Este é o MVP do módulo próprio. Rastreamento ao vivo, mapa e vídeo ficam na plataforma white-label e na nuvem do fabricante do MDVR; este sistema lê os dados deles e faz os cálculos.

## O que já funciona

- **Login e acessos:** equipe interna (`ADMIN`), gestor e operador da transportadora. Cada transportadora só vê a própria frota; toda consulta filtra pelo cliente da sessão.
- **Caminhões e planos:** cadastro com consumo de referência, odômetro, rastreador e custos fixos mensais. O plano de cada caminhão libera os módulos.
- **Custo por km:** despesas lançadas + custos fixos ÷ km do GPS, com a composição por categoria. No mês em andamento os custos fixos entram proporcionais aos dias já passados.
- **Consumo:** km/l pela rede CAN, comparação com a referência do modelo, marcha lenta, excessos, frenagens e alerta de desvio quando o abastecido passa 3% do consumido.
- **Revisões:** itens por km ou por data, aviso com 1.000 km ou 15 dias de antecedência, falhas lidas da CAN. Registrar o serviço zera o intervalo e lança o custo como manutenção.
- **Margem por viagem:** frete menos custo por km × (km carregado + km vazio), e um simulador de frete com o frete mínimo por tonelada.
- **Minha empresa (interno):** clientes, caminhões por plano, mensalidades, atraso e bloqueio automático após 15 dias.
- **Telemetria:** contrato `FonteTelemetria` com um simulador e um esqueleto para o white-label (`src/lib/telemetria`). O script diário grava km, litros e eventos de cada caminhão.

## Rodar localmente

Requisitos: Node 22 e PostgreSQL 16.

```bash
cp .env.example .env        # ajuste DATABASE_URL e SESSION_SECRET
npm install
npm run db:migrate          # cria as tabelas
npm run db:seed             # dados de exemplo (apaga o que houver)
npm run dev                 # http://localhost:3000
```

Logins de exemplo (senha `frota2026`):

- `admin@gestaodefrota.com.py`: equipe interna, vê todos os clientes
- `gestor@transportesmonday.com.py`: gestor de uma transportadora com 8 caminhões

Outros comandos:

```bash
npm test                    # testes dos cálculos (src/lib/indicadores.test.ts)
npm run lint                # verificação de tipos
npm run sync:telemetria     # importa o dia de ontem da fonte de telemetria
```

## Estrutura

| Caminho | O que tem |
| --- | --- |
| `prisma/schema.prisma` | Modelo de dados |
| `src/lib/indicadores.ts` | Todos os cálculos, sem banco, com testes |
| `src/lib/dados.ts` | Consultas que montam os indicadores de cada tela |
| `src/lib/acesso.ts` | Sessão, papel e cliente atual |
| `src/lib/telemetria/` | Adaptadores de rastreamento (simulador, white-label) |
| `src/app/(app)/` | Telas da plataforma |

## Próximos passos

1. Escolher o white-label e implementar `src/lib/telemetria/wialon.ts` (ou o adaptador do fornecedor escolhido).
2. Integrar eventos e clipes do MDVR na tela de vídeo.
3. Telas em espanhol (o idioma do cliente já está no cadastro).
4. Cobrança automática e faturamento eletrônico SIFEN.
5. Hospedagem gerenciada com backups diários e o `sync:telemetria` agendado.

Valores em USD, sem IVA. Os números do banco de exemplo são inventados.
