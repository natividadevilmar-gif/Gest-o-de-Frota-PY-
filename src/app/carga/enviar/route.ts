import { clienteAtual, filtroCaminhoesDoMotorista, motoristaDaSessao } from "@/lib/acesso";
import { db } from "@/lib/db";
import { validarArquivo } from "@/lib/registroCarga";

/** Recebe a foto ou o vídeo da carga. A data e a hora gravadas são as do servidor, não as do celular. */
export async function POST(req: Request) {
  const { sessao, cliente } = await clienteAtual();
  const form = await req.formData().catch(() => null);
  const arquivo = form?.get("arquivo");
  if (!form || !(arquivo instanceof Blob)) return Response.json({ ok: false, erro: "Arquivo não recebido." }, { status: 400 });
  const tipo = String(form.get("tipo") ?? "");
  const v = validarArquivo(tipo, arquivo.type, arquivo.size);
  if (!v.ok) return Response.json({ ok: false, erro: v.erro }, { status: 400 });

  const motoristaId = await motoristaDaSessao(sessao);
  const caminhaoId = String(form.get("caminhaoId") ?? "");
  const caminhao = await db.caminhao.findFirst({
    where: { id: caminhaoId, clienteId: cliente.id, ...(await filtroCaminhoesDoMotorista(cliente.id, motoristaId)) },
    select: { id: true, motoristaId: true },
  });
  if (!caminhao) return Response.json({ ok: false, erro: "Caminhão não encontrado." }, { status: 400 });

  const numero = (k: string) => {
    const n = Number(form.get(k));
    return form.get(k) !== null && form.get(k) !== "" && Number.isFinite(n) ? n : null;
  };
  const lat = numero("lat");
  const lng = numero("lng");
  const gpsOk = lat !== null && lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  const duracao = numero("duracaoS");
  const precisao = numero("precisaoM");
  const obs = String(form.get("observacao") ?? "").trim().slice(0, 300);

  const r = await db.registroCarga.create({
    data: {
      clienteId: cliente.id,
      caminhaoId: caminhao.id,
      motoristaId: motoristaId || caminhao.motoristaId,
      usuarioId: sessao.usuarioId,
      tipo,
      formato: v.formato,
      conteudo: Buffer.from(await arquivo.arrayBuffer()),
      tamanho: arquivo.size,
      duracaoS: tipo === "video" && duracao !== null ? Math.round(Math.min(duracao, 60)) : null,
      lat: gpsOk ? lat : null,
      lng: gpsOk ? lng : null,
      precisaoM: gpsOk && precisao !== null ? Math.round(precisao) : null,
      observacao: obs || null,
    },
    select: { id: true, criadoEm: true },
  });
  return Response.json({ ok: true, id: r.id, criadoEm: r.criadoEm.toISOString() });
}

/** Só o cabeçalho Date: o celular acerta o carimbo pela hora do servidor. */
export function HEAD() {
  return new Response(null, { headers: { "Cache-Control": "no-store" } });
}
