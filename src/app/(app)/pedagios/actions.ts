"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirAdmin } from "@/lib/acesso";
import { db } from "@/lib/db";

const tarifa = z.object({
  id: z.string().min(1),
  valor: z.coerce.number().positive(),
  fonte: z.string().trim().min(3).max(200),
  vigencia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  lat: z.coerce.number().min(-60).max(0),
  lng: z.coerce.number().min(-80).max(-30),
});

/** Só a KM Cero corrige tarifa: o valor vale para todos os clientes. */
export async function atualizarTarifa(form: FormData) {
  await exigirAdmin();
  const p = tarifa.parse(Object.fromEntries(form));
  const atual = await db.pracaPedagio.findUniqueOrThrow({ where: { id: p.id }, select: { tarifaEixo: true } });
  await db.pracaPedagio.update({
    where: { id: p.id },
    data: {
      ...(atual.tarifaEixo != null ? { tarifaEixo: p.valor } : { tarifaFixa: p.valor }),
      fonte: p.fonte,
      lat: p.lat,
      lng: p.lng,
      vigencia: new Date(`${p.vigencia}T00:00:00Z`),
    },
  });
  revalidatePath("/pedagios");
}
