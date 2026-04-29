# PickInDes Prototype

This workspace contains a static prototype based on your attached `pickindes-v3.html` draft.

## Files
- `index.html` — main website entry
- `style.css` — extracted styles
- `script.js` — extracted functionality and interactions
- `pickindes-v3.html` — original draft copy

## How to run
1. Open `index.html` in your browser.
2. Or run a local server if you prefer, e.g. using VS Code Live Server or a simple Python/Node server.

## Notes
- The site is a static HTML prototype with internal demo interactions.
- Images are loaded from Unsplash and the external Google Fonts link is included.

## Build setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Start development server:
   ```bash
   npm run dev
   ```
3. Start backend server (in a new terminal):
   ```bash
   npm run server
   ```
4. Build for production:
   ```bash
   npm run build
   ```
5. Preview the production build:
   ```bash
   npm run preview
   ```

## Database & Product Management

**Backend**: Node.js + Express  
**Database**: SQLite3 (stored as `products.db`)  
**File uploads**: Saved to `uploads/` directory

The backend API runs on `http://localhost:3001` and provides:
- `GET /api/products` — Retrieve all products
- `POST /api/products` — Add new product with 2D models (JPG, PNG, SVG)

### Product schema
- Product info: name, brand, category, price, description, SKU, stock
- 2D Models: Support for JPG, PNG, SVG formats
- Uploaded files are stored and served from `/uploads/` directory
## Run servers
 in powershel
 cd D:\programavimas\PicInDes
 npm run server
 npm run dev