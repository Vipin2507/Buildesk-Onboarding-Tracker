# Auto-deploy (GitHub Actions → Hostinger KVM1)

Push to `main` builds and deploys this app to your VPS over SSH, then restarts PM2.

| Item | Value |
| --- | --- |
| Server | `200.97.166.244` |
| SSH | `root@200.97.166.244` |
| App path | `/var/www/buildesk` |
| SQLite | `/var/lib/buildesk/buildesk.db` |
| Process | PM2 name `buildesk` on port `3000` |
| Trigger | Push to `main` + manual **Run workflow** |

---

## One-time VPS setup

SSH in:

```bash
ssh root@200.97.166.244
```

### 1. System packages

```bash
apt update
apt install -y nginx certbot python3-certbot-nginx build-essential git curl
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs
npm i -g pm2
```

### 2. App directories + clone

```bash
mkdir -p /var/www/buildesk /var/lib/buildesk
cd /var/www/buildesk

# Replace with your GitHub repo URL
git clone git@github.com:YOUR_ORG/buildesk-compass-main.git .
# or: git clone https://github.com/YOUR_ORG/buildesk-compass-main.git .
```

If the VPS needs to `git pull` a **private** repo, add a deploy key:

```bash
ssh-keygen -t ed25519 -C "buildesk-vps" -f /root/.ssh/buildesk_deploy -N ""
cat /root/.ssh/buildesk_deploy.pub
# → GitHub repo → Settings → Deploy keys → Add (read-only)

cat >> /root/.ssh/config <<'EOF'
Host github.com
  IdentityFile /root/.ssh/buildesk_deploy
  IdentitiesOnly yes
EOF
```

Then clone/pull with SSH.

### 3. Production env

```bash
cat > /var/www/buildesk/.env <<'EOF'
NODE_ENV=production
DATABASE_URL=file:/var/lib/buildesk/buildesk.db
SESSION_SECRET=f707ac77238e129c17ac243cdc8026d4abe020d745d043bba358c1a3bf4092a5
EOF

# Generate a secret:
# openssl rand -hex 32
```

Keep `.env` on the server only — never commit it.

### 4. First install + start

```bash
cd /var/www/buildesk

# Must have .env with DATABASE_URL before db commands
cat > .env <<'EOF'
NODE_ENV=production
DATABASE_URL=file:/var/lib/buildesk/buildesk.db
SESSION_SECRET=REPLACE_WITH_LONG_RANDOM_STRING
# Leave COOKIE_SECURE unset while using http://IP. After HTTPS: COOKIE_SECURE=true
EOF

npm ci
npm run db:setup    # db:push (create tables) + db:seed — do NOT seed before push
npm run build
pm2 start .output/server/index.mjs --name buildesk
pm2 save
pm2 startup
```

If you already ran seed and saw `no such table: users`:

```bash
cd /var/www/buildesk
# confirm DATABASE_URL points at the real file
grep DATABASE_URL .env
npm run db:push     # creates users and all other tables
npm run db:seed
```

### 5. Nginx (+ HTTPS when you have a domain)

```bash
cat > /etc/nginx/sites-available/buildesk <<'EOF'
server {
  listen 80;
  server_name _;

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
EOF

ln -sf /etc/nginx/sites-available/buildesk /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

With a domain:

```bash
# edit server_name your.domain.com in the nginx file, then:
certbot --nginx -d your.domain.com
```

Until DNS is ready, open `http://200.97.166.244` (ensure Hostinger firewall allows 80/443).

### 6. Deploy key for GitHub Actions (CI → VPS)

On your **laptop** (not the VPS), generate a key used only for deploys:

```bash
ssh-keygen -t ed25519 -C "github-actions-buildesk" -f ./buildesk_gha_deploy -N ""
```

Install the **public** key on the VPS:

```bash
ssh root@200.97.166.244 "mkdir -p ~/.ssh && chmod 700 ~/.ssh"
cat buildesk_gha_deploy.pub | ssh root@200.97.166.244 "cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
```

Test:

```bash
ssh -i ./buildesk_gha_deploy root@200.97.166.244 "echo ok && node -v && pm2 -v"
```

Keep `buildesk_gha_deploy` (private) for GitHub Secrets — do not commit it.

---

## GitHub repository secrets

Repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Example | Notes |
| --- | --- | --- |
| `VPS_HOST` | `200.97.166.244` | |
| `VPS_USER` | `root` | Prefer a non-root deploy user later |
| `VPS_SSH_KEY` | *(full private key)* | Contents of `buildesk_gha_deploy` |
| `VPS_APP_DIR` | `/var/www/buildesk` | Optional; defaults to `/var/www/buildesk` |

Paste the **entire** private key into `VPS_SSH_KEY`, including:

```text
-----BEGIN OPENSSH PRIVATE KEY-----
...
-----END OPENSSH PRIVATE KEY-----
```

---

## Workflow

File: [`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml)

1. On push to `main` (or manual run): checkout → `npm ci` → `typecheck`
2. SSH into the VPS
3. `git fetch` + `reset --hard origin/main`
4. Run [`scripts/deploy.sh`](./scripts/deploy.sh): `npm ci` → `db:push` → `build` → `pm2 restart buildesk`

**Does not** re-run `db:seed` (seed skips when users already exist).

---

## Day-to-day use

```bash
git push origin main
```

Watch: GitHub → **Actions** → **Deploy to Hostinger VPS**.

Manual deploy: Actions → Deploy → **Run workflow**.

---

## Verify on the server

```bash
ssh root@200.97.166.244
pm2 status
pm2 logs buildesk --lines 50
curl -sI http://127.0.0.1:3000 | head
```

---

## Rollback

```bash
ssh root@200.97.166.244
cd /var/www/buildesk
git log --oneline -5
git reset --hard <good-commit-sha>
bash scripts/deploy.sh
```

Or revert on GitHub and push to `main` again.

---

## SQLite backups (recommended)

```bash
crontab -e
```

```cron
0 2 * * * sqlite3 /var/lib/buildesk/buildesk.db ".backup '/var/lib/buildesk/backup-$(date +\%F).db'"
```

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| SSH permission denied | Public key not in `authorized_keys`; secret missing newlines |
| `git fetch` auth failed | VPS deploy key / HTTPS token for private repo |
| `better-sqlite3` build fails | Install `build-essential` on VPS; Node 22 |
| PM2 not found | `npm i -g pm2` as the same user Actions SSHs as |
| Site 502 | `pm2 logs buildesk`; check Nginx → `127.0.0.1:3000` |
| Schema drift | `cd /var/www/buildesk && npm run db:push` |
| `Sign in required` after login on `http://IP` | Cookie was `Secure` (HTTPS-only). Ensure `.env` does **not** set `COOKIE_SECURE=true` until HTTPS is on; rebuild/restart PM2. Clear site cookies and sign in again. |
| Login works but data sync fails | Same as above — session cookie not sent on HTTP |
| PM2 not picking up `.env` | Ensure `/var/www/buildesk/.env` exists; app loads it when opening SQLite. After editing `.env`: `pm2 restart buildesk --update-env` |

---

## Security notes

- Prefer a dedicated `deploy` user instead of `root` once things are stable.
- Rotate the Actions SSH key if it leaks.
- Never put `SESSION_SECRET` or private keys in the repo.
- Restrict Hostinger firewall to ports `22`, `80`, `443`.

See also: [DEPLOY.md](./DEPLOY.md) for manual deploy details.
