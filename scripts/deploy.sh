#!/usr/bin/env bash
#
# Обновление сайта на сервере: забрать код, пересобрать, перезапустить.
# Запускать из корня проекта на сервере:  bash scripts/deploy.sh
#
set -euo pipefail

cd "$(dirname "$0")/.."

echo "→ Забираем изменения из git…"
git pull --ff-only

# Ставим ВСЕ зависимости: typescript и tailwind лежат в devDependencies,
# без них `next build` не пройдёт. Урезать до --omit=dev здесь нельзя.
echo "→ Ставим зависимости (ровно как в lock-файле)…"
npm ci --no-audit --no-fund

# Каталог на сервере живёт вне git. Версионная миграция добавляет новые
# поступления до сборки, чтобы они сразу попали в статические страницы.
echo "→ Применяем обновления каталога…"
node scripts/apply-catalog-update.mjs

echo "→ Собираем прод-версию отдельно от работающего сайта…"
# Версия уезжает в мета-теги страниц: по ней снаружи видно, какая сборка
# развёрнута — правки данных и пустые коммиты бандлы не меняют.
REVISION="$(git rev-parse --short HEAD)"
RELEASE_ROOT="$(pwd)/.next-releases"
BUILD_DIR=".next-build"
RELEASE_DIR=".next-releases/${REVISION}-$(date -u +%Y%m%d%H%M%S)"
mkdir -p "$RELEASE_ROOT"

# Сборщик всегда пишет во временную папку, которую работающий процесс никогда
# не использует. После успеха целиком переносим её в уникальный каталог релиза.
case "$(pwd)/$BUILD_DIR" in
  "$(pwd)"/.next-build) rm -rf -- "$BUILD_DIR" ;;
  *) echo "Небезопасный путь сборки: $BUILD_DIR" >&2; exit 1 ;;
esac
case "$(pwd)/$RELEASE_DIR" in
  "$RELEASE_ROOT"/*) ;;
  *) echo "Небезопасный путь релиза: $RELEASE_DIR" >&2; exit 1 ;;
esac

BUILD_REVISION="$REVISION" NEXT_DIST_DIR="$BUILD_DIR" npm run build
test -f "$BUILD_DIR/BUILD_ID"
mv "$BUILD_DIR" "$RELEASE_DIR"

echo "→ Перезапускаем приложение…"
PREVIOUS_DIST="$(pm2 jlist 2>/dev/null | node -e '
  let raw=""; process.stdin.on("data", c => raw += c); process.stdin.on("end", () => {
    try {
      const app = JSON.parse(raw).find(item => item.name === "momo");
      process.stdout.write(
        app?.pm2_env?.NEXT_DIST_DIR || app?.pm2_env?.env?.NEXT_DIST_DIR || ".next"
      );
    } catch { process.stdout.write(".next"); }
  });
')"
export NEXT_DIST_DIR="$RELEASE_DIR"
if pm2 describe momo >/dev/null 2>&1; then
  # Старый процесс продолжает читать PREVIOUS_DIST; новая папка уже полностью
  # собрана. Поэтому во время build больше нет сотен рестартов и 502.
  pm2 reload momo --update-env
else
  pm2 start ecosystem.config.cjs
  pm2 save
fi

echo "→ Проверяем новую версию…"
healthy=0
for _ in $(seq 1 20); do
  if curl -fsS --max-time 3 http://127.0.0.1:3000/api/health >/dev/null; then
    healthy=1
    break
  fi
  sleep 1
done

if [ "$healthy" -ne 1 ]; then
  echo "Новая версия не прошла проверку, возвращаем предыдущую сборку…" >&2
  export NEXT_DIST_DIR="$PREVIOUS_DIST"
  pm2 reload momo --update-env
  exit 1
fi

# Храним текущую и две предыдущие версии для быстрого отката.
mapfile -t old_releases < <(
  find "$RELEASE_ROOT" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' |
    sort -nr | tail -n +4 | cut -d' ' -f2-
)
for old in "${old_releases[@]}"; do
  case "$old" in "$RELEASE_ROOT"/*) rm -rf -- "$old" ;; esac
done

echo
echo "Готово. Статус:"
pm2 status momo
