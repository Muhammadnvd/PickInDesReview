import sqlite3 from 'sqlite3';
import path from 'path';

const dataDir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : process.cwd();
const dbPath = process.env.DB_PATH ? path.resolve(process.env.DB_PATH) : path.join(dataDir, 'products.db');

const db = new sqlite3.Database(dbPath);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

async function clearProducts() {
  await run('DELETE FROM product_images');
  await run('DELETE FROM product_models');
  await run('DELETE FROM products');
  await run("DELETE FROM sqlite_sequence WHERE name IN ('products', 'product_images', 'product_models')");
  console.log('Product tables cleared.');
}

clearProducts()
  .catch((err) => {
    console.error('Clear failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => {
    db.close();
  });
