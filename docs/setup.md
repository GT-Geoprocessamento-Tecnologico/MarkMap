# Instalação e configuração

## Requisitos

- Node.js 22 recomendado para paridade com CI;
- pnpm 9.15.9;
- Git;
- para integração local: PostgreSQL com PostGIS;
- para Android: JDK 21 + Android SDK;
- para iOS: macOS + Xcode.

## Instalação

```bash
corepack enable
pnpm install --frozen-lockfile
```

## Desenvolvimento web

```bash
pnpm dev
```

O Vite usa a porta `5173` e escuta interfaces de rede em desenvolvimento.

## API

A API lê variáveis server-side:

```env
NODE_ENV=development
HOST=127.0.0.1
PORT=3000
CORS_ORIGINS=http://localhost:5173
LOG_LEVEL=info
DATABASE_URL=
NEON_DB_URL=
S3_ENDPOINT=
S3_REGION=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_BUCKET=
```

`DATABASE_URL` e `NEON_DB_URL` são aliases aceitos pelo backend. Não exponha essas variáveis ao frontend.

## Frontend

Variáveis relevantes observadas no código:

- `VITE_API_URL`: base da API; padrão `/api/v1`;
- `VITE_API_MODE`: `mock` ou `live`; padrão atual `mock`.

## Banco local de desenvolvimento

O `.env.example` oferece PostgreSQL local de exemplo. Para testes PostGIS, use banco descartável; nunca rode testes destrutivos contra produção.

## Build

```bash
pnpm build
```
