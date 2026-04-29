In produ# Database & API Documentation

## Setup

### Start the Backend Server
```bash
npm run server
```
The server runs on `http://localhost:3001`

### Database
- **Type**: SQLite3
- **File**: `products.db` (created automatically on first run)

## Database Schema

### `products` Table
Stores core product information:

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Primary key, auto-increment |
| `name` | TEXT | Product name (required) |
| `brand` | TEXT | Manufacturer/brand |
| `category` | TEXT | Product category (e.g., "Kėdės", "Apšvietimas") |
| `price` | REAL | Price in EUR (**required**, must be > 0) |
| `price_updated_at` | DATETIME | Timestamp of last price change (auto-set on create; updated on edit when price changes) |
| `description` | TEXT | Product description |
| `dimensions` | TEXT | Product dimensions |
| `material` | TEXT | Material |
| `delivery` | TEXT | Delivery info |
| `link` | TEXT | Partner/store URL |
| `sku` | TEXT | SKU code (**required**) |
| `stock` | INTEGER | Units in stock (default: 0) |
| `download_count` | INTEGER | Total model downloads (default: 0) |
| `like_count` | INTEGER | Total likes (default: 0) |
| `link_click_count` | INTEGER | Total partner link clicks (default: 0) |
| `is_active` | INTEGER | 1 = visible in catalog, 0 = hidden (default: 1) |
| `created_at` | DATETIME | Timestamp (auto-set) |

### `product_images` Table
Stores 2D models in 3 formats (JPG, PNG, SVG):

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Primary key |
| `product_id` | INTEGER | Foreign key to `products.id` |
| `format` | TEXT | Image format (JPG, PNG, SVG) |
| `filename` | TEXT | Saved filename |
| `filepath` | TEXT | Full file path |

## API Endpoints

### GET `/api/products`
Retrieve all products with their images.

**Response:**
```json
[
  {
    "id": 1,
    "name": "Loom Lounge Chair",
    "brand": "Muuto",
    "category": "Kėdės",
    "price": 1290,
    "price_updated_at": "2026-04-26T10:00:00.000Z",
    "description": "Modern lounge chair",
    "sku": "MUU-LLC-OAK-01",
    "stock": 3,
    "created_at": "2026-04-14T10:00:00.000Z",
    "images": {
      "JPG": "image-jpg-12345.jpg",
      "PNG": "image-png-12345.png",
      "SVG": "image-svg-12345.svg"
    }
  }
]
```

### POST `/api/products`
Add a new product with 2D models.

**Request (multipart/form-data):**
```
- name: string (required)
- brand: string
- category: string
- price: number (**required**, must be > 0)
- description: string
- sku: string (**required**)
- stock: number
- image_jpg: File
- image_png: File
- image_svg: File
```

**Response:**
```json
{
  "id": 1,
  "message": "Product added successfully"
}
```

### GET `/uploads/:filename`
Serve uploaded image files.

**Example:**
```
GET http://localhost:3001/uploads/image-jpg-12345.jpg
```

## File Structure

```
project/
├── server.js              # Express server
├── products.db            # SQLite database (auto-created)
├── uploads/               # Product images directory (auto-created)
│   ├── image-jpg-12345.jpg
│   ├── image-png-12345.png
│   └── image-svg-12345.svg
├── index.html            # Frontend
├── script.js             # Frontend JS with addNewProduct() function
└── package.json
```

## Frontend Integration

The add product page (`#add-product`) has a form that submits to the backend. The function `addNewProduct()` handles:
1. Collecting form data (product info + images)
2. Sending POST request to `/api/products`
3. Displaying success/error toast
4. Resetting form and navigating back

### Access the Add Product Page
- Login as supplier in the app
- Click "+ Pridėti naują" in the Supplier Account
- Or navigate to `go('add-product')`

## Example cURL Request

```bash
curl -X POST http://localhost:3001/api/products \
  -F "name=Loom Chair" \
  -F "brand=Muuto" \
  -F "category=Kėdės" \
  -F "price=1290" \
  -F "sku=MUU-001" \
  -F "stock=5" \
  -F "description=Modern chair" \
  -F "image_jpg=@chair.jpg" \
  -F "image_png=@chair.png" \
  -F "image_svg=@chair.svg"
```

## Notes

- `price` and `sku` are required fields — the backend returns HTTP 400 and the frontend shows an error toast if either is missing
- `price_updated_at` is set automatically when a product is created and updated whenever the price value changes during an edit; existing products without this value are backfilled with `created_at` on every server startup
- The price update date is displayed in the product catalog card and product detail page as small grey text: *(Kaina atnaujinta: YYYY-MM-DD)* / *(Price updated: YYYY-MM-DD)*
- All images are optional but recommended (JPG, PNG, SVG)
- Files are stored in `/uploads/` and served as static assets
- Database queries include image data grouped by format
- CORS is enabled for frontend/backend communication on `localhost:3001`
