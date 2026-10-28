# Gestão de Frota PY

Plataforma de gestão de frota para transportadoras do Paraguai: custo por km, consumo e ranking de motoristas, plano de revisões e margem por viagem, com planos Básico, Gestão e Vídeo por caminhão.

Este é o MVP do módulo próprio. Rastreamento ao vivo, mapa e vídeo ficam na plataforma white-label e na nuvem do fabricante do MDVR; este sistema lê os dados deles e faz os cálculos.

## O que já funciona

- **Login e acessos:** equipe interna (`ADMIN`), gestor e operador da transportadora. Cada transportadora só vê a própria frota; toda consulta filtra pelo cliente da sessão.
- **Caminhões e planos:** cadastro com consumo de referência, odômetro, rastreador e custos fixos mensais. O plano de cada caminhão libera os módulos.
- **Lançar despesas:** combustível (diesel e Arla 32, com litros, preço por litro, posto, odômetro e tanque cheio), alimentação, pedágio, manutenção, borracharia e outros. Pelo celular dá para tirar foto do recibo ou falar a despesa: a leitura automática (Claude API) preenche o formulário e o usuário confere antes de lançar. A foto fica guardada junto da despesa.
- **Moeda local:** a despesa pode ser lançada em guaranis, reais ou dólares. O sistema converte para USD com a cotação do dia (buscada uma vez por dia, com opção de fixar à mão em "Minha empresa") e guarda o valor original e a cotação usada.
- **Custo por km:** despesas lançadas + custos fixos ÷ km do GPS, com relatório separado por tipo de gasto e planilha CSV. No mês em andamento os custos fixos entram proporcionais aos dias já passados.
- **Consumo:** km/l pela rede CAN (ou pelo método do tanque cheio nos abastecimentos), comparação com a referência do modelo, marcha lenta, excessos, frenagens e alerta de desvio quando o abastecido passa 3% do consumido.
- **Revisões:** itens por km ou por data, aviso com 1.000 km ou 15 dias de antecedência, falhas lidas da CAN. Registrar o serviço zera o intervalo e lança o custo como manutenção.
- **Margem por viagem:** frete menos custo por km × (km carregado + km vazio), e um simulador de frete com o frete mínimo por tonelada.
- **Minha empresa (interno):** clientes, caminhões por plano, mensalidades, atraso e bloqueio automático após 15 dias.
- **Telemetria:** contrato `FonteTelemetria` com um simulador e o Wialon (`src/lib/telemetria`). O script diário grava km, litros e eventos de cada caminhão.
- **Wialon:** com `WIALON_TOKEN` definido, o receptor traz a cada minuto as mensagens das unidades do Wialon para as posições, ligando cada unidade ao caminhão pelo IMEI. `WIALON_CLIENTES` limita a quais clientes isso vale (hoje, só a AVM Truck). Mapa, cercas, alertas e resumo diário usam esses dados como se viessem do receptor próprio. `npm run wialon` lista as unidades e mostra qual caminhão ficou ligado a cada uma.

## Rodar localmente

Requisitos: Node 22 e PostgreSQL 16.

```bash
cp .env.example .env        # ajuste DATABASE_URL e SESSION_SECRET
npm install
npm run db:migrate          # cria as tabelas
npm run db:seed             # dados de exemplo (apaga o que houver)
npm run dev                 # http://localhost:3000
```

Para ativar a leitura de recibos por foto e de despesas faladas, defina `ANTHROPIC_API_KEY` no `.env`. Sem a chave, os botões de foto e áudio não aparecem e o lançamento continua manual. O reconhecimento de voz usa o próprio navegador do celular (Chrome no Android, Safari no iPhone).

Logins de exemplo (senha `frota2026`):

- `admin@gestaodefrota.com.py`: equipe interna, vê todos os clientes
- `gestor@avmtruck.com.py`: gestor da AVM Truck, cliente de demonstração com 8 caminhões
- Motorista (só lança despesas): celular `0981123456`, PIN `123456`

Outros comandos:

```bash
npm test                    # testes dos cálculos (src/lib/indicadores.test.ts)
npm run lint                # verificação de tipos
npm run sync:telemetria     # importa o dia de ontem da fonte de telemetria
```

## Publicar (Vercel + Neon)

1. Importe o repositório em vercel.com/new e defina `SESSION_SECRET` (gere com `openssl rand -hex 32`).
2. Em Storage, crie um banco Neon e conecte ao projeto; ele define `DATABASE_URL`.
3. Cada deploy roda `npm run vercel-build`: aplica as migrações e, se o banco estiver vazio, cria os dados de exemplo.
4. Opcional: `ANTHROPIC_API_KEY` para ler recibos por foto e despesas faladas.

## Estrutura

| Caminho | O que tem |
| --- | --- |
| `prisma/schema.prisma` | Modelo de dados |
| `src/lib/indicadores.ts` | Todos os cálculos, sem banco, com testes |
| `src/lib/dados.ts` | Consultas que montam os indicadores de cada tela |
| `src/lib/acesso.ts` | Sessão, papel e cliente atual |
| `src/lib/telemetria/` | Adaptadores de rastreamento (simulador, Wialon) |
| `src/lib/rastreio/wialon.ts` | Cliente da Remote API do Wialon e espelho das posições |
| `src/app/(app)/` | Telas da plataforma |

## Próximos passos

1. Conferir com a conta Wialon real os nomes dos parâmetros CAN de cada modelo de rastreador (`src/lib/rastreio/wialon.ts`).
2. Integrar eventos e clipes do MDVR na tela de vídeo.
3. Telas em espanhol (o idioma do cliente já está no cadastro).
4. Cobrança automática e faturamento eletrônico SIFEN.
5. Hospedagem gerenciada com backups diários e o `sync:telemetria` agendado.

Valores em USD, sem IVA. Os números do banco de exemplo são inventados.
