# Petlom

## Self-Hosting

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) (Docker Desktop on Windows/Mac, or Docker Engine + Docker Compose v2 on Linux)
- Ports 80 (and 443 for HTTPS) open on your server

### Deploy

**1. Get the code**

```bash
git clone https://github.com/PeterLombaers/petlom.git
cd petlom
```

**2. Create your configuration file**

```bash
cp .env.example .env
```

Open `.env` and fill in `JWT_SECRET_KEY` with a randomly generated secret:

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

Paste the output as the value. The other settings have safe defaults for Docker deployments.

**3. Start the application**

```bash
docker compose up -d --build
```

The first run downloads base images and builds the containers — this takes a few minutes.

**4. Create your moderator account** *(do this once)*

```bash
docker compose exec backend uv run python -m backend.create_moderator <username> <password>
```

Replace `<username>` and `<password>` with your chosen credentials.

**5. Open the app**

Go to `http://localhost` (or `http://<your-server-ip>` if running on a remote server).

---

### Enable HTTPS

Caddy automatically obtains and renews a TLS certificate from Let's Encrypt. No further configuration is needed. You only need to set the environment variable `CADDY_HOST` so that it knows for which domain to obtain the certificate.

Update `ALLOWED_ORIGINS` in `.env` if you use the development workflow against your production server.

---

### Update

Always back up your database before updating (see below).

```bash
git pull
docker compose build --no-cache
docker compose up -d
```

> **Note:** Database schema changes are applied automatically when new tables are added, but
> existing tables are not altered. If a release adds columns to an existing table, a migration step
> will be documented in the release notes.

---

### Database Backup

Copy the SQLite file out of the Docker volume without stopping the application:

```bash
mkdir -p backups
docker run --rm \
  -v petlom_petlom_db:/data \
  -v "$(pwd)/backups":/backup \
  alpine cp /data/petlom.db /backup/petlom_$(date +%Y%m%d).db
```

---

### View Logs

```bash
docker compose logs -f
docker compose logs -f backend
docker compose logs -f caddy
```

---

## Development

- Start the backend server: `uv run fastapi dev backend/main.py`
- Start the frontend server: `cd frontend && npm install && npm run dev`
- (Optional) Fill the database with fake data: `uv run python fill_db.py`

The frontend dev server proxies all `/api/*` requests to the backend at `http://localhost:8000`, so
both servers can run simultaneously without CORS issues.

There is a VSCode tasks file at https://gist.github.com/PeterLombaers/0f896b05ecdaba6ff718f815b323ce71 that you can use to run these commands. Simply add it to your `.vscode` folder, use `Ctrl+Shift+p` and select `Tasks: Run Task`.

## TypeScript API Client

The TypeScript API client is generated using `openapi-typescript`. It uses the OpenAPI definition
that FastAPI outputs to generate TypeScript types for the backend API. These types are located at
`frontend/src/client/schema.d.ts`. You never need to manually edit this file — instead run
`npm run generate-client` from the `frontend` directory, or use the corresponding VSCode Task.
