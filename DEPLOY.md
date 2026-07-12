# Deploy on Hostinger KVM1

This app runs as a **single Node process** (TanStack Start / Nitro) with **SQLite** on disk — ideal for KVM1 RAM limits.

## 1. Server prep

```bash
# Ubuntu/Debian on Hostinger KVM1
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx build-essential python3
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm i -g pm2
```

## 2. App install

```bash
sudo mkdir -p /var/www/buildesk /var/lib/buildesk
sudo chown -R $USER:$USER /var/www/buildesk /var/lib/buildesk
cd /var/www/buildesk
git clone <your-repo-url> .
npm ci
```

Create `/var/www/buildesk/.env`:

```env
NODE_ENV=production
DATABASE_URL=file:/var/lib/buildesk/buildesk.db
SESSION_SECRET=<generate-a-long-random-string>
```

```bash
npm run db:push
npm run db:seed
npm run build
```

## 3. PM2

```bash
pm2 start .output/server/index.mjs --name buildesk --env production
pm2 save
pm2 startup
```

App listens on **port 3000** by default.

## 4. Nginx + HTTPS

`/etc/nginx/sites-available/buildesk`:

```nginx
server {
  listen 80;
  server_name your.domain.com;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/buildesk /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d your.domain.com
```

## 5. SQLite backup (optional nightly)

```bash
sudo crontab -e
# 0 2 * * * sqlite3 /var/lib/buildesk/buildesk.db ".backup '/var/lib/buildesk/backup-$(date +\%F).db'"
```

## 6. Updates

**Preferred:** push to `main` — see [AUTODEPLOY.md](./AUTODEPLOY.md) (GitHub Actions → SSH → PM2).

Manual:

```bash
cd /var/www/buildesk
git pull
bash scripts/deploy.sh
```

Do **not** re-run `db:seed` on an existing DB (it skips if users exist). To fully reset: stop PM2, delete `/var/lib/buildesk/buildesk.db*`, then `db:push` + `db:seed`.

## Demo login

- Email: `aditya@buildesk.com`
- Password: `buildesk123`

## Local development

```bash
cp .env.example .env
npm run db:setup   # push schema + seed
npm run dev        # http://localhost:3000
```
