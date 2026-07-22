# Развёртывание на VPS (AdminVPS)

Инструкция для Ubuntu / Debian. Для AlmaLinux/CentOS отличаются только команды
установки пакетов (`dnf` вместо `apt`) — остальное идентично.

Итоговая схема: **Nginx** принимает 80/443 → проксирует на **Next.js** (127.0.0.1:3000),
процесс держит **PM2**, сертификат выпускает **certbot**.

---

## 1. Подключиться к серверу

```bash
ssh root@IP_СЕРВЕРА
```

## 2. Базовая подготовка

```bash
apt update && apt upgrade -y
apt install -y curl git nginx ufw

# Файрвол: наружу только SSH и веб
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable
```

## 3. Node.js 22 LTS

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs
node -v    # должно быть v22.x
npm -v
```

## 4. Отдельный пользователь для сайта

Гонять приложение от root небезопасно.

```bash
adduser --disabled-password --gecos "" momo
usermod -aG www-data momo
su - momo
```

## 5. Забрать код

Репозиторий приватный, поэтому нужен **deploy key** — ключ только на чтение.

```bash
# от пользователя momo
ssh-keygen -t ed25519 -C "momo-vps" -f ~/.ssh/id_ed25519 -N ""
cat ~/.ssh/id_ed25519.pub
```

Скопируйте вывод и добавьте на GitHub:
**репозиторий → Settings → Deploy keys → Add deploy key** (галочку «Allow write access» ставить НЕ нужно).

```bash
git clone git@github.com:e660eo/MOMO-Equipped.git ~/momo
cd ~/momo
```

## 6. Собрать и запустить

```bash
npm ci
npm run build

sudo npm install -g pm2      # если pm2 ещё не стоит
mkdir -p logs
pm2 start ecosystem.config.cjs
pm2 save
```

Автозапуск после перезагрузки сервера:

```bash
pm2 startup systemd -u momo --hp /home/momo
# выполните команду, которую напечатает pm2 (её нужно запустить от root)
```

Проверка, что приложение отвечает локально:

```bash
curl -I http://127.0.0.1:3000     # ожидаем HTTP/1.1 200 OK
```

## 7. Nginx

```bash
exit    # вернуться в root

cp /home/momo/momo/deploy/nginx.conf.example /etc/nginx/sites-available/momo
nano /etc/nginx/sites-available/momo     # заменить server_name на свой домен или IP

ln -s /etc/nginx/sites-available/momo /etc/nginx/sites-enabled/momo
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

Теперь сайт открывается по IP сервера.

## 8. SSL (после переключения домена)

Сертификат выпускается только когда домен уже указывает на этот сервер.

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d momo-eq.ru -d www.momo-eq.ru
```

Certbot сам допишет конфиг Nginx и настроит автопродление.

---

## Обновление сайта

### Автоматическое (настроено)

Крон под пользователем `momo` раз в 3 минуты запускает
`scripts/auto-update.sh`: если в origin/main появились новые коммиты —
подтягивает, пересобирает и перезапускает без простоя. Когда новых коммитов
нет, скрипт выходит мгновенно.

Установка (один раз, под `momo`):

```bash
( crontab -l 2>/dev/null; echo '*/3 * * * * bash /home/momo/momo/scripts/auto-update.sh' ) | crontab -
crontab -l    # проверить, что строка появилась
```

Журнал обновлений: `~/momo/logs/auto-update.log`.
Отключить: `crontab -e` и удалить строку.

### Ручное (если нужно прямо сейчас)

```bash
su - momo
cd ~/momo
bash scripts/deploy.sh
```

Скрипт забирает код, ставит зависимости, пересобирает и перезапускает без простоя.

---

## Полезные команды

```bash
pm2 status              # состояние приложения
pm2 logs momo           # логи в реальном времени
pm2 reload momo         # перезапуск без простоя
systemctl status nginx  # состояние Nginx
tail -f /var/log/nginx/error.log
```

---

## Панель управления: папка данных и пароль

Панель (`/admin`) правит каталог прямо на сервере, поэтому данные лежат
**вне репозитория**: `deploy.sh` начинается с `git pull --ff-only`, и файлы
внутри `data/` каждое обновление затирались бы вместе с правками.

Настраивается один раз, под пользователем `momo`:

```bash
su - momo
mkdir -p ~/momo-data
```

Пропишите путь к ней и задайте пароль:

```bash
cd ~/momo
echo 'MOMO_DATA_DIR=/home/momo/momo-data' >> .env.local
node scripts/admin-password.mjs
```

Скрипт спросит пароль дважды (нажатия видны звёздочками) и сам допишет хеш
с секретом сессий в `.env.local`, выставив файлу права `600`. Переносить
длинные строки руками не нужно — при копировании в них легко потерять символ.
Сам пароль нигде не сохраняется: восстановить его нельзя, можно только задать
новый тем же скриптом. Нужны строки на экран (например, для другого сервера) —
запустите с флагом `--print`.

Файл `.env.local` не в git — обновления сайта его не трогают. Осталось
перезапустить приложение, чтобы оно увидело переменные:

```bash
pm2 reload momo --update-env
```

После этого заходите на `https://momo-eq.ru/admin`.

Пока переменные не заданы, сайт работает на данных из репозитория как раньше,
а панель честно пишет, что не настроена, и ничего не сохраняет.

### Что лежит в папке данных

```
~/momo-data/
  products.json, categories.json, brands.json, news.json, bundles.json, site.json
  uploads/    — фото, загруженные через панель
  backups/    — последние 20 копий каждого файла, пишутся перед каждой правкой
```

Файлы появляются сами при первом обращении — копией из репозитория. Исходные
145 снимков каталога остаются в коде (`public/uploads`) и отдаются тем же
адресом `/media/…`, копировать их никуда не нужно.

### Резервная копия

```bash
tar czf ~/momo-data-$(date +%F).tar.gz -C /home/momo momo-data
```

Восстановление — распаковать архив обратно в `/home/momo` и перезапустить:
`pm2 reload momo`. Откатить одну неудачную правку можно из `backups/`:
скопировать нужную копию поверх файла и сделать `pm2 reload momo`.
