# REST API Backend (Node.js + PostgreSQL)

Production REST API backend service for product inventory management & user authentication.

## Features
- **Database**: Real hosted PostgreSQL integration (`pg` pool) with automatic table creation & seeding.
- **Authentication**: JWT-based user registration (`/api/auth/register`), login (`/api/auth/login`), and profile verification (`/api/auth/me`).
- **Products CRUD**: Full filtering, search, pagination, detailed view, create, update, and delete endpoints.
- **CORS**: Configurable cross-origin resource sharing for frontend deployment.

## Environment Variables
- `PORT`: Server port (default: `5000`)
- `DATABASE_URL`: PostgreSQL connection URL (from Render/Railway)
- `JWT_SECRET`: Secret key for JWT signing
- `FRONTEND_URL`: Public URL of deployed frontend app (for CORS restriction)

## Local Development
```bash
npm install
npm run dev
```
