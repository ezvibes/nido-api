# EZ Vibes Nido Client

This is the Vue 3 + TypeScript + Vite frontend for EZ Vibes Nido.

The client supports the concert discovery experience, Firebase authentication, ingestion upload UI, and admin review tooling for EZ Vibes members.

## Local Development

From the repository root:

```bash
npm install --prefix client
cp client/.env.example client/.env
npm run dev --prefix client
```

The local client runs at:

```text
http://localhost:5173
```

## Environment

Client env values are public browser configuration. Do not place private keys or service account credentials in `client/.env`.

Common values:

```env
VITE_API_BASE_URL=http://localhost:3001
VITE_ADMIN_EMAILS=admin@example.com
```

## Validation

```bash
npm run build --prefix client
```
