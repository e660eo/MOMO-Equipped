import fs from "node:fs";
import { currentDealer } from "@/lib/dealer-auth";
import { getSupportDocuments } from "@/lib/support-documents";
import { supportFileMime, supportFilePath } from "@/lib/support-files";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await currentDealer()) return new Response("Требуется вход", { status: 401 });
  const { id } = await params;
  const document = getSupportDocuments().find((item) => item.id === id && item.audience === "dealer");
  if (!document) return new Response("Файл не найден", { status: 404 });
  const target = supportFilePath(document.file, "dealer");
  if (!target) return new Response("Файл не найден", { status: 404 });
  try {
    const file = await fs.promises.readFile(target);
    return new Response(new Uint8Array(file), { headers: { "Content-Type": supportFileMime(document.file), "Content-Length": String(file.length), "Content-Disposition": `attachment; filename="dealer-file"; filename*=UTF-8''${encodeURIComponent(document.originalName)}`, "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" } });
  } catch {
    return new Response("Файл не найден", { status: 404 });
  }
}
