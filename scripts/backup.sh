#!/usr/bin/env bash
#
# Локальный датированный бэкап папки данных MOMO (заказы, клиенты, промокоды,
# загруженные фото). Кладёт .tar.gz в <данные>/backups и хранит последние N.
#
# Крон раз в сутки от пользователя momo (данные лежат отдельно от кода):
#   30 3 * * * MOMO_DATA_DIR=/home/momo/momo-data bash /home/momo/momo/scripts/backup.sh >> /home/momo/momo/logs/backup.log 2>&1
#
# KEEP архивов по умолчанию 14 — при суточном запуске это две недели истории.
#
set -euo pipefail

cd "$(dirname "$0")/.."
# У крона минимальный PATH — tar/gzip/du могут быть не видны без этого.
export PATH=/usr/local/bin:/usr/bin:/bin

# Папка данных: та же, что читает сайт (MOMO_DATA_DIR). Без переменной — ./data
# рядом с кодом (локальный запуск).
DATA_DIR="${MOMO_DATA_DIR:-$(pwd)/data}"
BACKUP_DIR="$DATA_DIR/backups"
KEEP="${BACKUP_KEEP:-14}"

if [ ! -d "$DATA_DIR" ]; then
  echo "$(date '+%F %T') Папка данных не найдена: $DATA_DIR" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y-%m-%d_%H%M)"
ARCHIVE="$BACKUP_DIR/momo-data-$STAMP.tar.gz"

# Архивируем всё, кроме самой папки backups — иначе каждый новый бэкап тащил
# бы в себя все прежние и рос лавиной.
tar -czf "$ARCHIVE" -C "$DATA_DIR" --exclude=backups .
echo "$(date '+%F %T') Бэкап готов: $ARCHIVE ($(du -h "$ARCHIVE" | cut -f1))"

# Чистка: оставляем последние KEEP архивов (по времени), остальные удаляем.
ls -1t "$BACKUP_DIR"/momo-data-*.tar.gz 2>/dev/null | tail -n +"$((KEEP + 1))" |
  while read -r old; do
    rm -f "$old"
    echo "$(date '+%F %T') Удалён старый бэкап: $old"
  done
