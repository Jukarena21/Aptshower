# Despliegue — Apartashower

App Node.js (Express + SQLite). Escucha en `PORT` (por defecto `3000`) y `0.0.0.0`.

## Variables de entorno

| Variable | Obligatorio | Descripción |
|----------|-------------|-------------|
| `PORT` | No | Puerto HTTP (muchas plataformas lo inyectan solas). |
| `DATA_DIR` | No | Carpeta donde guardar `registry.db`. Por defecto `./data` junto al código. En la nube, apunta a un **volumen persistente** (ej. `/var/data`). |
| `RESEED_CATALOG` | No | Si vale `1`, al arrancar **borra** ítems y recarga el catálogo por defecto. Solo para reset controlado. |

Liberar reserva: `POST /api/release-reservation` con JSON `{ "id": <número> }`. Health: `GET /api/health`.

---

## Publicar en internet (recomendado: Railway o Render)

### 0. Subir el código a GitHub

1. Crea un repositorio vacío en [github.com](https://github.com).
2. En la carpeta del proyecto (con `git` instalado):

```bash
git init
git add .
git commit -m "Apartashower"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/TU_REPO.git
git push -u origin main
```

(Si no quieres GitHub, muchas plataformas permiten subir un ZIP o usar Docker.)

### 1. Railway ([railway.app](https://railway.app))

1. Cuenta con GitHub → **New Project** → **Deploy from GitHub** → elige el repo.
2. Railway detecta Node: comando `npm start` (usa `package.json`).
3. **Variables**: no hace falta `PORT`; opcional `NODE_ENV=production`.
4. **Volumen (importante)**: en el servicio → **Settings** → **Volumes** → añade volumen montado en `/app/data` (o la ruta que uses) y variable **`DATA_DIR=/app/data`** (o la misma ruta de montaje). Sin volumen, las reservas se pierden al redeploy.
5. **Generate domain** en la pestaña **Networking** para obtener la URL pública.
6. Health check opcional: path `/api/health`.

### 2. Render ([render.com](https://render.com))

1. **New** → **Blueprint** (si usas `render.yaml` del repo) o **Web Service** conectando GitHub.
2. **Build**: `npm ci` · **Start**: `npm start`.
3. En **Advanced** → **Add disk** (según plan), monta por ejemplo en `/var/data` y define **`DATA_DIR=/var/data`**.
4. Sin disco persistente, cada deploy puede resetear la base (solo catálogo seed si la BD está vacía).

### 3. Fly.io ([fly.io](https://fly.io))

1. Instala `flyctl`, ejecuta `fly launch` en la carpeta del proyecto (detecta Dockerfile o Node).
2. Crea un volumen y monta en `/data`; pon **`DATA_DIR=/data`**.
3. `fly deploy`.

### 4. Docker en un VPS (DigitalOcean, Hetzner, etc.)

En el servidor:

```bash
docker build -t apartashower .
docker run -d --restart unless-stopped -p 80:3000 \
  -v apartashower-data:/app/data \
  -e NODE_ENV=production \
  --name apartashower \
  apartashower
```

Pon delante un dominio con **Caddy** o **nginx** con HTTPS si expones a internet.

---

## Docker (local)

```bash
docker build -t apartashower .
docker run -p 3000:3000 -v apartashower-data:/app/data apartashower
```

Abre `http://localhost:3000`.

---

## Nota de seguridad

Cualquiera puede **liberar** una reserva desde la web (diseño para amigos). En internet abierto, asume ese riesgo o restringe por red/VPN si lo necesitas.
