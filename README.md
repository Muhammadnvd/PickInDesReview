# PicInDes

PicInDes is a full-stack web app for interior design product discovery and sharing. It combines a product catalog, supplier links, project collections, PDF export, and admin/product management.

## Stack
- Frontend: HTML, CSS, vanilla JavaScript, Vite
- Backend: Node.js, Express
- Database: SQLite3
- File uploads: Multer
- 3D / model-related integrations are handled in the frontend app logic

## Main project files
- `index.html` — main app entry
- `script.js` — main frontend logic
- `style.css` — main styling
- `server.js` — Express API and SQLite integration
- `admin.html` — admin interface shell
- `public/admin.js` — admin panel client logic
- `.env.example` — example environment configuration

## Local setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Create an environment file from `.env.example`.
3. Set at least these values:
   ```env
   PORT=3001
   CORS_ORIGIN=http://localhost:5173
   ADMIN_USER=admin
   ADMIN_PASSWORD=your-password
   DATA_DIR=./data
   ```
4. Start the backend:
   ```bash
   npm run server
   ```
5. Start the frontend dev server in a second terminal:
   ```bash
   npm run dev
   ```

## Available scripts
- `npm run dev` — start Vite dev server
- `npm run server` — start Express backend
- `npm run build` — build frontend assets
- `npm run preview` — preview the production build
- `npm run seed:demo` — seed demo data
- `npm run db:clear` — clear product data
- `npm run db:import` — import products from a script

## Notes for reviewers
- This repository is a cleaned review copy.
- Runtime data such as the local database, uploads, backups, and temporary files are intentionally excluded.
- To run the project fully, a local data directory and sample data may need to be recreated.