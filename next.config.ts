import { execSync } from "node:child_process";
import type { NextConfig } from "next";

/*
  Версия развёрнутой сборки — коммит, из которого её собрали.

  Нужна, чтобы снаружи было видно, доехало ли обновление: правка данных или
  пустой коммит не меняют ни байта в бандлах, и по хешам файлов выкат
  неотличим от его отсутствия.
*/
function buildRevision(): string {
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    // Сборка из архива без .git — не повод падать
    return "unknown";
  }
}

const nextConfig: NextConfig = {
  env: {
    BUILD_REVISION: buildRevision(),
    BUILD_TIME: new Date().toISOString(),
  },
};

export default nextConfig;
