import sqlite3 from 'sqlite3';

const demoSeedProducts = [
  {
    name: 'Loom Lounge Chair',
    brand: 'Muuto',
    category: 'Kėdės',
    price: 1290,
    description: 'Patogi poilsio kėdė šiuolaikiniams interjerams.',
    link: 'https://example.com/muuto-loom-lounge-chair',
    sku: 'DEMO-KED-001',
    stock: 3
  },
  {
    name: 'Arco Floor Lamp',
    brand: 'Flos',
    category: 'Apšvietimas',
    price: 2840,
    description: 'Ikoninis toršeras su marmuro pagrindu.',
    link: 'https://example.com/flos-arco-floor-lamp',
    sku: 'DEMO-APS-002',
    stock: 2
  },
  {
    name: 'Pavilion Corner Sofa',
    brand: 'Carl Hansen',
    category: 'Sofos ir foteliai',
    price: 4650,
    description: 'Modulinė kampinė sofa premium erdvėms.',
    link: 'https://example.com/carl-hansen-pavilion-corner-sofa',
    sku: 'DEMO-SOF-003',
    stock: 1
  },
  {
    name: 'About A Chair AAC22',
    brand: 'HAY',
    category: 'Kėdės',
    price: 380,
    description: 'Universalus modelis restoranams ir biurams.',
    link: 'https://example.com/hay-aac22',
    sku: 'DEMO-KED-004',
    stock: 12
  },
  {
    name: 'String System Shelf',
    brand: 'String',
    category: 'Stalai ir lentynos',
    price: 890,
    description: 'Lanksti lentynų sistema su moduline struktūra.',
    link: 'https://example.com/string-system-shelf',
    sku: 'DEMO-STL-005',
    stock: 4
  }
];

const db = new sqlite3.Database('./products.db');

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

async function seed() {
  await run('DELETE FROM product_images');
  await run('DELETE FROM product_models');
  await run('DELETE FROM products');
  await run("DELETE FROM sqlite_sequence WHERE name IN ('products', 'product_images', 'product_models')");

  for (const product of demoSeedProducts) {
    await run(
      `INSERT INTO products (name, brand, category, price, description, link, sku, stock)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        product.name,
        product.brand,
        product.category,
        product.price,
        product.description,
        product.link,
        product.sku,
        product.stock
      ]
    );
  }

  console.log(`Demo seed completed: ${demoSeedProducts.length} products`);
}

seed()
  .catch((err) => {
    console.error('Demo seed failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => {
    db.close();
  });
