# Local Development Run Guide

## Node Version
The project requires **Node.js 18.0 or newer**. You can verify your current version with:
```
node --version
```
If you need to install or switch versions, consider using [nvm](https://github.com/nvm-sh/nvm) or the Windows port
[`nvm-windows`](https://github.com/coreybutler/nvm-windows).  Once Node is
installed, re‑run the following steps.

## Starting the Database

The backend talks to a PostgreSQL database.  Two convenient ways to bring the
database up are:

1. **Neon CLI** – If you have a Neon account and a project set up, you can
   start a temporary local instance with the CLI:
   ```bash
   neon connect <project-id> --database neon --ssl-mode disable
   ```
   Replace `<project-id>` with your project's ID.  This will output a
   connection URL that can be used by the app.

2. **Docker Compose** – The repository ships a ready‑to‑run compose file:
   ```bash
   docker-compose up -d
   ```
   The service listens on `5432` and uses the credentials in the `.env`
   file.  You can inspect the ports with `docker ps`.

## Environment Variables
The application expects the following variables to be present when it
starts:

| Variable | Purpose | Example |
|---|---|---|
| `IMPORT_MAX_SIZE` | Maximum size (bytes) for incoming import files | `10485760` *(10 MiB)* |
| `DATABASE_URL` | PostgreSQL connection string | `postgres://user:pass@localhost:5432/db` |
| `PORT` | HTTP port for the dev server | `5173` |
| `NODE_ENV` | Runtime environment (`development`, `production`, etc.) | `development` |

The project ships a `.env.example` file with defaults.  Copy it to `.env`
and adjust the values as needed:
```
cp .env.example .env
```  

### Optional Convenience
You can set `DEPLOY_ENV=dev` in `.env` to enable dev‑only features, but the
default configuration works out of the box.

## Launching the Development Server

Run the following command from the project root:
```
pnpm run dev
```
This starts a Hono‑based API server (watching for changes via `ts-node`
dev‑runtime) and an optional Vite front‑end if present.  The server will log a
health‑check URL at `http://localhost:5173/health`.  When the server is
running, you can open the API docs at
`http://localhost:5173/api/docs` or simply hit the health endpoint.

## Quick Test
Once the server is up, issue a quick curl request to confirm:
```
curl -i http://localhost:5173/health
```
You should receive a `200 OK` with a JSON `{ "status": "ok" }` response.

Happy hacking!