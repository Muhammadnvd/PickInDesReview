import sqlite3 from 'sqlite3';

const db = new sqlite3.Database('./products.db');

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
