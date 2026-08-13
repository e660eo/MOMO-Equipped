import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { uploadsDir } from "./store";
import { ExpectedError } from "./errors";

const MAX_AUDIO_BYTES = 30 * 1024 * 1024;
const AUDIO_TYPES: Record<string, string> = {
  "audio/mpeg": ".mp3",
  "audio/mp3": ".mp3",
  "audio/wav": ".wav",
  "audio/x-wav": ".wav",
  "audio/wave": ".wav",
  "audio/vnd.wave": ".wav",
  "audio/ogg": ".ogg",
  "audio/mp4": ".m4a",
  "audio/x-m4a": ".m4a",
};

export class AudioError extends ExpectedError {}

export function validateProductAudio(file: File): string {
  const extension = AUDIO_TYPES[file.type.toLowerCase()];
  if (!extension) {
    throw new AudioError("Поддерживаются MP3, WAV, OGG и M4A.");
  }
  if (file.size > MAX_AUDIO_BYTES) {
    throw new AudioError("Аудиозапись больше 30 МБ — сожмите её или загрузите MP3.");
  }
  if (file.size < 1_024) {
    throw new AudioError("Аудиозапись слишком маленькая или повреждена.");
  }
  return extension;
}

export async function saveProductAudio(file: File): Promise<string> {
  const extension = validateProductAudio(file);
  const dir = uploadsDir();
  await fs.promises.mkdir(dir, { recursive: true });
  const name = `${crypto.randomUUID()}${extension}`;
  await fs.promises.writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
  return name;
}

export async function deleteProductAudio(name: string): Promise<void> {
  if (!/^[A-Za-z0-9._-]+\.(?:mp3|wav|ogg|m4a)$/i.test(name)) return;
  await fs.promises.rm(path.join(uploadsDir(), name), { force: true });
}
