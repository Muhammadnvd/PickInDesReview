/**
 * CLI bulk CSV importer — same validation/upsert logic as the admin API.
 *
 * Usage:
 *   node scripts/import-products.js path/to/products.csv
 *   node scripts/import-products.js path/to/products.csv --yes   (skip prompt)
 *
 * Required CSV columns: sku, name, price
 * Optional columns:     brand, category, description, dimensions, material,
 *                       delivery, link, stock, is_active
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const csvPath = process.argv[2];
const autoYes = process.argv.includes('--yes');

if (!csvPath) {
  console.error('Naudojimas: node scripts/import-products.js <kelias-prie-csv> [--yes]');
  process.exit(1);
}

const dbPath = path.join(__dirname, '..', 'products.db');
const db = new sqlite3.Database(dbPath, err => {
  if (err) { console.error('Nepavyko atidaryti DB:', err.message); process.exit(1); }
});

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) reject(err); else resolve(this);
    });
  });
}

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err); else resolve(rows || []);
    });
  });
}

// ── CSV parser (RFC-4180) ──────────────────────────────────────────────────────
function parseCsv(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const result = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const fields = [];
    let i = 0;
    while (i < line.length) {
      if (line[i] === '"') {
        let j = i + 1;
        let field = '';
        while (j < line.length) {
          if (line[j] === '"' && line[j + 1] === '"') { field += '"'; j += 2; }
          else if (line[j] === '"') { j++; break; }
          else { field += line[j++]; }
        }
        fields.push(field);
        if (j < line.length && line[j] === ',') j++;
        i = j;
      } else {
        const comma = line.indexOf(',', i);
        if (comma === -1) { fields.push(line.slice(i)); break; }
        fields.push(line.slice(i, comma));
        i = comma + 1;
      }
    }
    if (line.endsWith(',')) fields.push('');
    result.push(fields);
  }
  return result;
}

// ── Row normalizer / validator ─────────────────────────────────────────────────
function normalizeRow(rawFields, headers) {
  const raw = {};
  headers.forEach((h, i) => { raw[h] = String(rawFields[i] ?? '').trim(); });

  const errors = [];
  const warnings = [];

  if (!raw.sku) errors.push('SKU yra privalomas');
  if (!raw.name) errors.push('Pavadinimas (name) yra privalomas');

  const price = parseFloat(raw.price);
  if (!raw.price || !Number.isFinite(price) || price <= 0) {
    errors.push('Kaina (price) turi būti teigiamas skaičius');
  }

  const stock = parseInt(raw.stock, 10);
  const normalizedStock = Number.isFinite(stock) && stock >= 0 ? stock : 0;

  const isActiveRaw = (raw.is_active || '').toLowerCase();
  const normalizedIsActive = ['0', 'false', 'no', 'ne', 'neaktyvus'].includes(isActiveRaw) ? 0 : 1;

  if (raw.link && !/^https?:\/\//i.test(raw.link)) {
    warnings.push(`link nėra galiojantis URL: "${raw.link.slice(0, 60)}"`);
  }

  return {
    sku: raw.sku || null,
    name: raw.name || null,
    brand: raw.brand || null,
    category: raw.category || null,
    price: Number.isFinite(price) && price > 0 ? price : null,
    description: raw.description || null,
    dimensions: raw.dimensions || null,
    material: raw.material || null,
    delivery: raw.delivery || null,
    link: raw.link || null,
    stock: normalizedStock,
    is_active: normalizedIsActive,
    _errors: errors,
    _warnings: warnings
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  let text;
  try {
    text = fs.readFileSync(path.resolve(csvPath), 'utf8');
  } catch (err) {
    console.error('Nepavyko perskaityti failo:', err.message);
    process.exit(1);
  }

  const parsed = parseCsv(text);
  if (parsed.length < 2) {
    console.error('CSV failas tuščias arba turi tik antraštę.');
    process.exit(1);
  }

  const headers = parsed[0].map(h => h.trim().toLowerCase());
  const dataRows = parsed.slice(1);

  const missingRequired = ['sku', 'name', 'price'].filter(h => !headers.includes(h));
  if (missingRequired.length > 0) {
    console.error('Trūksta privalomų stulpelių:', missingRequired.join(', '));
    process.exit(1);
  }

  const normalized = dataRows.map((fields, i) => ({ _rowNum: i + 2, ...normalizeRow(fields, headers) }));

  const invalid = normalized.filter(r => r._errors.length > 0);
  const valid   = normalized.filter(r => r._errors.length === 0);

  if (invalid.length > 0) {
    console.log(`\n⚠️  ${invalid.length} eilučių su klaidomis (bus praleistos):`);
    invalid.forEach(r => {
      console.log(`  Eilutė ${r._rowNum} (${r.sku || '?'}): ${r._errors.join('; ')}`);
    });
  }

  valid.filter(r => r._warnings.length > 0).forEach(r => {
    r._warnings.forEach(w => console.warn(`  ⚠️  Eilutė ${r._rowNum}: ${w}`));
  });

  if (valid.length === 0) {
    console.error('\nNėra galiojančių eilučių. Importas atšauktas.');
    process.exit(1);
  }

  // Look up existing SKUs
  const skus = [...new Set(valid.map(r => r.sku))];
  const placeholders = skus.map(() => '?').join(',');
  const existing = await dbAll(`SELECT id, sku FROM products WHERE sku IN (${placeholders})`, skus);
  const existingMap = {};
  existing.forEach(r => { existingMap[r.sku] = r.id; });

  const toCreate = valid.filter(r => existingMap[r.sku] == null).length;
  const toUpdate = valid.filter(r => existingMap[r.sku] != null).length;

  console.log(`\nParuošta importuoti:`);
  console.log(`  Naujų produktų  : ${toCreate}`);
  console.log(`  Atnaujinimų     : ${toUpdate}`);
  console.log(`  Praleidžiama    : ${invalid.length}`);

  if (!autoYes) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise(resolve => rl.question('\nTęsti? (yes / no): ', resolve));
    rl.close();
    if (answer.trim().toLowerCase() !== 'yes') {
      console.log('Atšaukta.');
      process.exit(0);
    }
  }

  // Transactional upsert
  await dbRun('BEGIN');
  let created = 0;
  let updated = 0;

  try {
    for (const row of valid) {
      if (existingMap[row.sku] != null) {
        await dbRun(
          `UPDATE products SET name=?, brand=?, category=?, price=?,
           description=?, dimensions=?, material=?, delivery=?, link=?, stock=?, is_active=?
           WHERE id=?`,
          [row.name, row.brand, row.category, row.price,
           row.description, row.dimensions, row.material, row.delivery, row.link,
           row.stock, row.is_active, existingMap[row.sku]]
        );
        updated++;
      } else {
        const r = await dbRun(
          `INSERT INTO products
           (name, brand, category, price, price_updated_at, description, dimensions,
            material, delivery, link, sku, stock, is_active)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [row.name, row.brand, row.category, row.price,
           row.price != null ? new Date().toISOString() : null,
           row.description, row.dimensions, row.material, row.delivery,
           row.link, row.sku, row.stock, row.is_active]
        );
        existingMap[row.sku] = r.lastID;
        created++;
      }
    }
    await dbRun('COMMIT');
  } catch (err) {
    try { await dbRun('ROLLBACK'); } catch { /* ignore */ }
    console.error('\nImportas nepavyko, visi pakeitimai atšaukti:', err.message);
    process.exit(1);
  }

  console.log(`\n✓ Importas baigtas — sukurta: ${created}, atnaujinta: ${updated}`);
  db.close();
}

main().catch(err => { console.error(err); process.exit(1); });
