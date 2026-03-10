# Project Guidelines

## Code Style
- Use Node.js CommonJS only (`require`, `module.exports`), matching current backend files.
- Keep existing formatting style in backend JS: async/await, explicit `try/catch`, JSON error responses.
- Make minimal, surgical edits; avoid broad refactors.
- Reference patterns in `server.js`, `routes/*.js`, `services/*.js`.

## Architecture
- Core app is Express API + static frontend in `public/`.
- Startup flow in `server.js`: connect Redis/in-memory store, init Socket.IO, start SMTP listener, then HTTP server.
- Email ingest paths:
  - Webhook: `POST /api/webhook/mail`
  - SMTP: listener from `routes/smtp.js`
- Store inbox messages via `services/emailService.js` and emit realtime `new_email` events through `socket/socket.js`.

## Build and Test
- Install dependencies: `npm install`
- Run app: `npm start`
- Alternative run: `node server.js`
- There is no configured test script in `package.json`; do not assume a test framework.

## Project Conventions
- Keep users/domains in JSON config files: `data/users.json`, `data/domains.json` via `services/configService.js`.
- Keep mailbox data in Redis keys (or memory fallback) as defined in `services/emailService.js`:
  - `email:<mailbox>:messages`
  - `message:<id>:email`
- Preserve 24h TTL behavior for inbox messages unless explicitly requested.
- Preserve role-to-domain-tier rules in `services/permissionService.js`.

## Integration Points
- API modules mounted under `/api` and `/api/admin`:
  - `routes/auth.js`, `routes/domain.js`, `routes/email.js`, `routes/webhook.js`, `routes/admin.js`, `routes/system.js`, `routes/smtp.js`
- Frontend pages in `public/` call these APIs directly (`index.html`, `login.html`, `admin.html`).
- SMTP config uses env vars: `SMTP_HOST`, `SMTP_PORT`.
- Redis is optional via `USE_REDIS` and `REDIS_URL`.

## Security
- JWT auth/role checks are implemented in `middleware/auth.js`; keep `requireAuth` + `requireAdmin` on admin routes.
- Treat `data/users.json` as sensitive (contains credentials in this project model).
- Do not relax auth/CORS/domain-write behavior unless explicitly requested and documented.
- Update `.env.example` whenever new env variables are added.
