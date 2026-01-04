
  # Quiz Creation Web App

  This is a code bundle for Quiz Creation Web App. The original project is available at https://www.figma.com/design/cvGeTFNxgKu52OYNbuyUd1/Quiz-Creation-Web-App.

  ## Prerequisites

  - Node.js 18+
  - PostgreSQL 14+

  ## Frontend (Vite)

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.

  ## Backend (Node.js + TypeScript + Prisma)

  Backend lives under `server/`.

  1. `cd server`
  2. `npm i`
  3. Copy env file: `cp .env.example .env`
  4. Update `.env` (DB URL, JWT secrets, email provider, frontend origin)
  5. Run migrations: `npx prisma migrate dev`
  6. Generate client: `npx prisma generate`
  7. Seed sample data: `npm run seed`
  8. Start API server: `npm run dev`

  The API server runs on `http://localhost:4000` by default.

  ### Notes

  - Cookie session is used (`httpOnly` JWT). For state-changing requests with a session cookie, send `X-CSRF-Token` header matching the `csrf_token` cookie.
  - `FRONTEND_ORIGIN` controls CORS.
  - Email sending supports Resend/SendGrid via environment variables. `EMAIL_PROVIDER=console` logs emails to stdout for local dev.
  - Seed creates an ADMIN account with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` from `.env`.

  ### API Docs

  See `server/docs/api.md`.
  
