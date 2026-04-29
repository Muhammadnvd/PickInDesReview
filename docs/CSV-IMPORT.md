# Bulk CSV Product Import

## CSV Format

### Required columns
| Column | Description |
|--------|-------------|
| `sku`  | Unique product code — used as the upsert key |
| `name` | Product name |
| `price`| Price in EUR (positive decimal, e.g. `299.00`) |

### Optional columns
| Column        | Description |
|---------------|-------------|
| `brand`       | Manufacturer / brand name |
| `category`    | Category label (free text) |
| `description` | Short product description |
| `dimensions`  | e.g. `75 × 78 × 72 cm` |
| `material`    | e.g. `Oak / Fabric` |
| `delivery`    | e.g. `8–12 weeks` |
| `link`        | Product URL (must start with `https://`) |
| `stock`       | Integer stock quantity (defaults to `0`) |
| `is_active`   | `1` = active (default), `0` / `false` / `no` = inactive |

### Template

Download from the Admin UI **CSV Importas** tab, or copy this header line and fill in your rows:

```
sku,name,brand,category,price,description,dimensions,material,delivery,link,stock,is_active
EXAMPLE-001,Pavyzdinis produktas,Gamintojas,Kėdės,299.00,Aprašymas,80x60x90 cm,Medis,4-6 sav.,https://example.com,5,1
```

### Encoding & formatting rules
- File must be **UTF-8** encoded
- First row must be the header (column names, case-insensitive)
- Fields containing commas or line breaks must be **quoted** with double-quotes (`"`)
- Escaped double-quotes inside quoted fields: `""` → `"`
- Both `LF` and `CRLF` line endings are accepted
- Maximum **2 000 data rows** per import

---

## Duplicate SKU behaviour (upsert)

| Situation | Action |
|-----------|--------|
| SKU does **not** exist in the database | Row is **inserted** as a new product |
| SKU **already exists** in the database | Mutable fields are **updated** (name, brand, category, price, description, dimensions, material, delivery, link, stock, is_active) |
| Row has validation errors | Row is **skipped** — shown in preview, never written |

Stats counters (`download_count`, `like_count`, `link_click_count`) are never overwritten by an import.

---

## Admin UI — step by step

1. Open `/admin` and log in.
2. Click the **CSV Importas** tab in the top navigation.
3. *(Optional)* Click **↓ atsisiųsti šabloną** to download a starter CSV.
4. Choose your `.csv` file and click **Peržiūrėti**.
5. Review the preview table:
   - **Kurti** (green) — new product will be inserted
   - **Atnaujinti** (blue) — existing SKU will be updated
   - **Praleisti** (red) — row has errors and will be skipped
6. Fix any errors in your CSV and re-upload if needed.
7. Once satisfied, click **Patvirtinti ir importuoti**.
8. The result banner shows how many rows were created, updated, or failed.

> **Note:** the confirmation token expires after **30 minutes**. If it expires, upload the file again to generate a new preview.

---

## CLI import

Useful for server-side scripting or scheduled jobs.

```bash
# With confirmation prompt
node scripts/import-products.js path/to/products.csv

# Skip the confirmation prompt (e.g. in a script)
node scripts/import-products.js path/to/products.csv --yes

# Via npm script
npm run db:import -- path/to/products.csv --yes
```

The CLI uses the same validation and upsert logic as the API. It prints a per-row error summary before asking for confirmation, then applies all valid rows inside a single SQLite transaction.

---

## API endpoints (admin-authenticated)

Both endpoints require a `Authorization: Bearer <token>` header obtained from `POST /api/admin/login`.

### `POST /api/admin/import/preview`

Accepts a `multipart/form-data` request with a single `csv` field (max 2 MB).

**Success response `200`:**
```json
{
  "token": "uuid",
  "total": 10,
  "valid": 8,
  "invalid": 2,
  "toCreate": 5,
  "toUpdate": 3,
  "preview": [
    {
      "_rowNum": 2,
      "sku": "SKU001",
      "name": "Chair",
      "price": 299,
      "stock": 3,
      "is_active": 1,
      "_action": "create",
      "_errors": [],
      "_warnings": []
    }
  ]
}
```

`_action` values: `"create"` | `"update"` | `"skip"`

### `POST /api/admin/import/apply`

```json
{ "token": "<token from preview>" }
```

**Success response `200`:**
```json
{ "created": 5, "updated": 3, "failed": 0, "details": [...] }
```

The token is single-use and expires 30 minutes after the preview call. The entire batch is applied inside one SQLite transaction — if anything fails, all changes are rolled back.

---

## Error reference

| Error message | Cause |
|---------------|-------|
| `Trūksta privalomų stulpelių: sku, name, price` | One or more required header columns are missing |
| `CSV neturi duomenų eilučių` | File has only a header row |
| `Maksimalus eilučių skaičius — 2000` | File exceeds the row limit; split and import in batches |
| `Importo žetonas nebegalioja` | 30-minute preview window expired; re-upload to get a new token |
| `Importas nepavyko, visos pakeitimai atšaukti` | DB error mid-transaction; no rows were written |

---

## Safety checklist

1. **Back up** `products.db` before a large import (`npm run db:clear` is irreversible).
2. Always **preview first** — check the Praleisti count before confirming.
3. Rows with errors are skipped silently during apply; fix them and re-import.
4. Media files (photos, 3D models) are **not** handled by CSV import — upload them via the product edit modal after import.
