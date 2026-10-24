import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

// Lê uma despesa a partir da foto de um recibo ou de uma frase falada pelo
// motorista ou gestor, e devolve os campos do formulário já preenchidos.
// O usuário sempre confere antes de lançar: nada é gravado aqui.

export const DespesaLida = z.object({
  categoria: z.enum(["DIESEL", "ARLA32", "ALIMENTACAO", "PEDAGIO", "MANUTENCAO", "PNEUS", "OUTROS"]),
  valor: z.number().nullable().describe("Valor total, na moeda em que foi pago"),
  moeda: z.enum(["USD", "PYG", "BRL"]).nullable(),
  litros: z.number().nullable(),
  precoLitro: z.number().nullable().describe("Preço por litro na moeda do recibo"),
  posto: z.string().nullable().describe("Nome do posto ou estabelecimento"),
  data: z.string().nullable().describe("Data no formato AAAA-MM-DD"),
  odometroKm: z.number().nullable(),
  placa: z.string().nullable().describe("Placa do caminhão, se aparecer"),
  descricao: z.string().nullable(),
});

export type DespesaLida = z.infer<typeof DespesaLida>;

export type MidiaRecibo = { base64: string; tipo: "image/jpeg" | "image/png" | "image/webp" | "image/gif" };

const INSTRUCOES = `Você lê despesas de caminhões de transportadoras do Paraguai, a partir da foto de um recibo ou de uma frase falada em português ou espanhol.
Extraia os campos pedidos. Regras:
- Combustível diesel é DIESEL; Arla 32 (AdBlue, urea) é ARLA32. Pedágio/peaje é PEDAGIO. Peças, oficina, óleo e filtros são MANUTENCAO. Borracharia, gomería, conserto ou troca de pneu é PNEUS. Refeição, lanche, restaurante, comedor, almoço e janta são ALIMENTACAO.
- Informe o valor e a moeda exatamente como pagos; não converta. A conversão para dólar é feita pelo sistema.
- Recibos paraguaios costumam vir em guaranis (Gs., ₲, PYG); guaranis não têm centavos e usam ponto como separador de milhar (2.500.000 = dois milhões e meio).
- Na fala, "dólares" é USD; "guaranis", "mil" ou "milhões" sem moeda dita é PYG; "reais" é BRL. "Dois milhões e meio" = 2500000.
- Use null para o que não aparecer. Não invente valores.
- Datas em AAAA-MM-DD. Se o ano não aparecer, use o ano da data de hoje informada.`;

export function leitorConfigurado() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export async function lerDespesa(entrada: { imagem?: MidiaRecibo; texto?: string }, contexto: { hoje: string }) {
  const client = new Anthropic();
  const conteudo: Anthropic.Beta.BetaContentBlockParam[] = [];
  if (entrada.imagem) {
    conteudo.push({ type: "image", source: { type: "base64", media_type: entrada.imagem.tipo, data: entrada.imagem.base64 } });
  }
  conteudo.push({
    type: "text",
    text: [
      `Hoje é ${contexto.hoje}.`,
      entrada.texto ? `Frase do usuário: "${entrada.texto}"` : "Leia o recibo da imagem.",
    ].join("\n"),
  });

  const resposta = await client.beta.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: INSTRUCOES,
    output_config: { effort: "low", format: betaZodOutputFormat(DespesaLida) },
    messages: [{ role: "user", content: conteudo }],
  });

  if (resposta.stop_reason === "refusal") throw new Error("Não foi possível ler esta despesa.");
  if (!resposta.parsed_output) throw new Error("A leitura não devolveu os campos esperados.");
  return resposta.parsed_output;
}
