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

После каждого `git push` с рабочей машины — на сервере:

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

## ⚠️ Перед переключением домена

Фото товаров сейчас грузятся со **старого** сайта (`https://momo-eq.ru/uploads/…`).
В момент, когда домен начнёт указывать на новый сервер, старый сайт исчезнет
вместе с фотографиями — каталог останется с плейсхолдерами.

Поэтому **до** смены DNS выполните на рабочей машине:

```bash
node scripts/download-photos.mjs
```

Скрипт скачает 145 фото в `public/uploads/`. Затем поменяйте в `data/site.json`:

```json
"imageBase": "/uploads/"
```

и сделайте коммит с пушем — на сервере подхватится обычным `deploy.sh`.
