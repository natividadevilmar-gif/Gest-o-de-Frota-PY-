"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirAdmin } from "@/lib/acesso";
import { db } from "@/lib/db";

const contrato = z.object({
  id: z.string().min(1),
  planoContratado: z.enum(["BASICO", "GESTAO", "VIDEO"]),
  caminhoesContratados: z.coerce.number().int().min(1).max(2000),
  prazoMeses: z.coerce.number().int().min(1).max(60),
  diaVencimento: z.coerce.number().int().min(1).max(28),
  endereco: z.string().trim().max(200).optional(),
  contratoInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function atualizarContrato(form: FormData) {
  await exigirAdmin();
  const p = contrato.parse(Object.fromEntries(form));
  await db.cliente.update({
    where: { id: p.id },
    data: { ...p, id: undefined, endereco: p.endereco || null, contratoInicio: new Date(`${p.contratoInicio}T12:00:00Z`) },
  });
  revalidatePath(`/contrato/${p.id}`);
}
