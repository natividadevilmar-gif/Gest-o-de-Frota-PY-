"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { clienteAtual } from "@/lib/acesso";
import { db } from "@/lib/db";

/** Link do painel do fabricante do MDVR deste cliente. Só a KM Cero altera; vazio remove. */
export async function salvarPainelMdvr(form: FormData) {
  const { sessao, cliente } = await clienteAtual();
  if (sessao.papel !== "ADMIN") return;
  const url = z.union([z.literal(""), z.string().trim().url().startsWith("http")]).parse(String(form.get("mdvrUrl") ?? "").trim());
  await db.cliente.update({ where: { id: cliente.id }, data: { mdvrUrl: url || null } });
  revalidatePath("/video");
}
