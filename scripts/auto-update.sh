#!/usr/bin/env bash
#
# Автообновление сайта: если origin/main ушёл вперёд — подтянуть и переразвернуть.
# Запускается кроном раз в несколько минут от пользователя momo:
#   */3 * * * * bash /home/momo/momo/scripts/auto-update.sh
#
# Когда новых коммитов нет, выходит мгновенно и ничего не трогает.
#
set -euo pipefail

cd "$(dirname "$0")/.."

# У крона минимальный PATH — node/npm/pm2 могут быть не видны без этого
export PATH=/usr/local/bin:/usr/bin:/bin

# Не позволяем двум обновлениям идти одновременно (пуш во время сборки)
LOCK=/tmp/momo-deploy.lock
exec 9>"$LOCK"
flock -n 9 || exit 0

git fetch origin main --quiet
LOCAL=$(git rev-parse @)
REMOTE=$(git rev-parse origin/main)
[ "$LOCAL" = "$REMOTE" ] && exit 0

mkdir -p logs
{
  echo "=== $(date '+%F %T') обновление ${LOCAL:0:7} -> ${REMOTE:0:7} ==="
  # Забираем код ДО запуска deploy.sh: bash читает скрипт в память при
  # старте, поэтому иначе выполнялась бы прошлая его версия — правки самого
  # скрипта применялись бы только со следующего обновления.
  git pull --ff-only
  bash scripts/deploy.sh
  echo "=== $(date '+%F %T') готово ==="
} >> logs/auto-update.log 2>&1

# Лог не должен расти бесконечно: держим последние ~500 КБ
if [ "$(stat -c%s logs/auto-update.log 2>/dev/null || echo 0)" -gt 524288 ]; then
  tail -c 262144 logs/auto-update.log > logs/auto-update.log.tmp
  mv logs/auto-update.log.tmp logs/auto-update.log
fi
