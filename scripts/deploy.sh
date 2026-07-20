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

echo "→ Собираем прод-версию…"
npm run build

echo "→ Перезапускаем приложение…"
if pm2 describe momo >/dev/null 2>&1; then
  # reload — без простоя: старый процесс живёт, пока не поднимется новый
  pm2 reload momo --update-env
else
  pm2 start ecosystem.config.cjs
  pm2 save
fi

echo
echo "Готово. Статус:"
pm2 status momo
