import express from 'express';
import sqlite3 from 'sqlite3';
import multer from 'multer';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import AdmZip from 'adm-zip';
import bcryptjs from 'bcryptjs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = Number(process.env.PORT) || 3001;

// Trust reverse proxy (Render, etc.) so req.ip reflects real client IP
app.set('trust proxy', 1);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const distDir = path.join(__dirname, 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
}

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}
app.use('/uploads', express.static(uploadsDir));

function sanitizeSkuForFilename(sku) {
  return String(sku || '')
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '');
}

function getDownloadFileName(sku, filePath, fallbackExt = '.skp') {
  const cleanSku = sanitizeSkuForFilename(sku) || 'model';
  const ext = path.extname(String(filePath || '')).toLowerCase() || fallbackExt;
  return `${cleanSku}${ext}`;
}

function sanitizeUploadFilename(fileName) {
  const base = path.basename(String(fileName || '').trim());
  const sanitized = base
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '');
  return sanitized || `file-${Date.now()}`;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getUploadType(file) {
  if (!file || !file.fieldname) return 'file';
  if (file.fieldname === 'photos') return 'photo';
  if (file.fieldname.startsWith('image_')) return file.fieldname.replace('image_', '').toLowerCase();
  if (file.fieldname.startsWith('model_')) return file.fieldname.replace('model_', '').toLowerCase();
  return path.extname(file.originalname || '').replace('.', '').toLowerCase() || 'file';
}

function getNextUploadSequence(req, productDir, sku, uploadType) {
  if (!req._uploadSequenceCache) {
    req._uploadSequenceCache = {};
  }

  const cacheKey = `${sku}:${uploadType}`;
  if (req._uploadSequenceCache[cacheKey] == null) {
    let currentMax = 0;
    if (fs.existsSync(productDir)) {
      const matcher = new RegExp(`^${escapeRegExp(sku)}-${escapeRegExp(uploadType)}-(\\d+)\\.[^.]+$`, 'i');
      fs.readdirSync(productDir).forEach(fileName => {
        const match = fileName.match(matcher);
        if (!match) return;
        currentMax = Math.max(currentMax, parseInt(match[1], 10) || 0);
      });
    }
    req._uploadSequenceCache[cacheKey] = currentMax;
  }

  req._uploadSequenceCache[cacheKey] += 1;
  return String(req._uploadSequenceCache[cacheKey]).padStart(2, '0');
}

// Database setup
const db = new sqlite3.Database('./products.db', (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database.');
    createTables();
  }
});

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

function deleteUploadedFile(relativePath) {
  if (!relativePath) return;
  const absPath = path.join(uploadsDir, relativePath);
  try {
    if (fs.existsSync(absPath)) {
      fs.unlinkSync(absPath);
    }
  } catch (err) {
    console.warn(`Could not delete file ${relativePath}: ${err.message}`);
  }
}

function deleteUploadDirectory(relativeDir) {
  if (!relativeDir) return;
  const absDir = path.join(uploadsDir, relativeDir);
  try {
    if (fs.existsSync(absDir)) {
      fs.rmSync(absDir, { recursive: true, force: true });
    }
  } catch (err) {
    console.warn(`Could not delete directory ${relativeDir}: ${err.message}`);
  }
}

function findFirstSkpPath(dir) {
  if (!fs.existsSync(dir)) return null;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = findFirstSkpPath(fullPath);
      if (nested) return nested;
    } else if (entry.isFile() && path.extname(entry.name).toLowerCase() === '.skp') {
      return path.relative(uploadsDir, fullPath).replace(/\\/g, '/');
    }
  }
  return null;
}

function collectFilesRecursively(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  entries.forEach(entry => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectFilesRecursively(fullPath));
    } else if (entry.isFile()) {
      out.push(fullPath);
    }
  });
  return out;
}

function getModelCandidatesFromDir(productDir) {
  const files = collectFilesRecursively(productDir)
    .map(absPath => ({
      absPath,
      ext: path.extname(absPath).toLowerCase(),
      mtimeMs: fs.statSync(absPath).mtimeMs
    }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  const findFirst = ext => files.find(file => file.ext === ext)?.absPath || null;
  return {
    SKP: findFirst('.skp'),
    OBJ: findFirst('.obj'),
    MTL: findFirst('.mtl'),
    '3DS': findFirst('.3ds'),
    STEP: findFirst('.step') || findFirst('.stp'),
    DWG: findFirst('.dwg')
  };
}

function getModelCandidatesFromFlatDir(dir) {
  if (!fs.existsSync(dir)) return {};

  const files = fs.readdirSync(dir, { withFileTypes: true })
    .filter(entry => entry.isFile())
    .map(entry => {
      const absPath = path.join(dir, entry.name);
      return {
        absPath,
        ext: path.extname(entry.name).toLowerCase(),
        mtimeMs: fs.statSync(absPath).mtimeMs
      };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  const findFirst = exts => files.find(file => exts.includes(file.ext))?.absPath || null;
  return {
    STEP: findFirst(['.step', '.stp']),
    DWG: findFirst(['.dwg'])
  };
}

function ensureObjMtlLink(objAbsPath, mtlAbsPath) {
  if (!objAbsPath || !mtlAbsPath) return;
  if (!fs.existsSync(objAbsPath) || !fs.existsSync(mtlAbsPath)) return;

  const mtlBaseName = path.basename(mtlAbsPath);
  let objText = '';
  try {
    objText = fs.readFileSync(objAbsPath, 'utf8');
  } catch {
    return;
  }

  const desired = `mtllib ${mtlBaseName}`;
  if (/^\s*mtllib\s+/im.test(objText)) {
    objText = objText.replace(/^\s*mtllib[^\r\n]*/im, desired);
  } else {
    objText = `${desired}\n${objText}`;
  }

  fs.writeFileSync(objAbsPath, objText, 'utf8');
}

async function extractModelArchiveToDir(archiveFilePath, productDir) {
  const ext = path.extname(String(archiveFilePath || '')).toLowerCase();

  if (ext === '.zip') {
    const zip = new AdmZip(archiveFilePath);
    zip.extractAllTo(productDir, true);
    return;
  }

  if (ext === '.rar') {
    const rarMod = await import('node-unrar-js');
    const createExtractorFromFile =
      rarMod.createExtractorFromFile ||
      rarMod.default?.createExtractorFromFile;

    if (!createExtractorFromFile) {
      throw new Error('RAR extractor is not available');
    }

    const extractor = await createExtractorFromFile({
      filepath: archiveFilePath,
      targetPath: productDir
    });

    const extracted = extractor.extract({});
    if (!extracted || !extracted.files) {
      throw new Error('RAR extraction failed: invalid extractor response');
    }

    // node-unrar-js uses lazy iterators; iterate fully to perform extraction and release internals.
    for (const _entry of extracted.files) {
      // no-op
    }

    return;
  }

  throw new Error('Unsupported archive format. Use .zip or .rar');
}

async function getArchiveDerivedModelMap(archiveFile) {
  if (!archiveFile || !archiveFile.path) return {};
  const archiveAbsPath = path.resolve(archiveFile.path);
  const productDir = path.dirname(archiveAbsPath);

  await extractModelArchiveToDir(archiveAbsPath, productDir);
  const candidates = getModelCandidatesFromDir(productDir);
  ensureObjMtlLink(candidates.OBJ, candidates.MTL);

  const modelMap = {};
  Object.entries(candidates).forEach(([format, absPath]) => {
    if (!absPath) return;
    modelMap[format] = path.relative(uploadsDir, absPath).replace(/\\/g, '/');
  });

  deleteUploadedFile(path.relative(uploadsDir, archiveAbsPath).replace(/\\/g, '/'));
  return modelMap;
}

// Create tables
function createTables() {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    role TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    brand TEXT,
    category TEXT,
    price REAL,
    description TEXT,
    dimensions TEXT,
    material TEXT,
    delivery TEXT,
    link TEXT,
    sku TEXT,
    stock INTEGER DEFAULT 0,
    download_count INTEGER DEFAULT 0,
    like_count INTEGER DEFAULT 0,
    link_click_count INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.get(`PRAGMA table_info(products)`, [], () => {
    db.all(`PRAGMA table_info(products)`, [], (err, columns) => {
      if (err) {
        console.error('Error reading products schema:', err.message);
        return;
      }
      const hasLink = columns.some(col => col.name === 'link');
      if (!hasLink) {
        db.run(`ALTER TABLE products ADD COLUMN link TEXT`);
      }
      const hasDimensions = columns.some(col => col.name === 'dimensions');
      if (!hasDimensions) {
        db.run(`ALTER TABLE products ADD COLUMN dimensions TEXT`);
      }
      const hasMaterial = columns.some(col => col.name === 'material');
      if (!hasMaterial) {
        db.run(`ALTER TABLE products ADD COLUMN material TEXT`);
      }
      const hasDelivery = columns.some(col => col.name === 'delivery');
      if (!hasDelivery) {
        db.run(`ALTER TABLE products ADD COLUMN delivery TEXT`);
      }
      const hasIsActive = columns.some(col => col.name === 'is_active');
      if (!hasIsActive) {
        db.run(`ALTER TABLE products ADD COLUMN is_active INTEGER DEFAULT 1`);
      }
      const hasDownloadCount = columns.some(col => col.name === 'download_count');
      if (!hasDownloadCount) {
        db.run(`ALTER TABLE products ADD COLUMN download_count INTEGER DEFAULT 0`);
      }
      const hasLikeCount = columns.some(col => col.name === 'like_count');
      if (!hasLikeCount) {
        db.run(`ALTER TABLE products ADD COLUMN like_count INTEGER DEFAULT 0`);
      }
      const hasLinkClickCount = columns.some(col => col.name === 'link_click_count');
      if (!hasLinkClickCount) {
        db.run(`ALTER TABLE products ADD COLUMN link_click_count INTEGER DEFAULT 0`);
      }
      const hasPriceUpdatedAt = columns.some(col => col.name === 'price_updated_at');
      if (!hasPriceUpdatedAt) {
        db.run(`ALTER TABLE products ADD COLUMN price_updated_at DATETIME`, [], () => {
          db.run(`UPDATE products SET price_updated_at = created_at WHERE price IS NOT NULL AND price_updated_at IS NULL`);
        });
      } else {
        db.run(`UPDATE products SET price_updated_at = created_at WHERE price IS NOT NULL AND price_updated_at IS NULL`);
      }
      const hasPriceFrom = columns.some(col => col.name === 'price_from');
      if (!hasPriceFrom) {
        db.run(`ALTER TABLE products ADD COLUMN price_from INTEGER DEFAULT 0`);
      }
    });
  });

  db.run(`CREATE TABLE IF NOT EXISTS product_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER,
    format TEXT,
    filename TEXT,
    filepath TEXT,
    FOREIGN KEY (product_id) REFERENCES products (id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS product_models (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER,
    format TEXT,
    filename TEXT,
    filepath TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products (id)
  )`);
}

// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const rawSku = req.body.sku || '';
    const sku = sanitizeSkuForFilename(rawSku) || `product-${Date.now()}`;
    const productDir = path.join(uploadsDir, sku);
    if (!fs.existsSync(productDir)) {
      fs.mkdirSync(productDir, { recursive: true });
    }
    cb(null, productDir);
  },
  filename: (req, file, cb) => {
    // Name files as sku-type-01.ext inside each SKU folder.
    const rawSku = req.body.sku || '';
    const sku = sanitizeSkuForFilename(rawSku) || `product-${Date.now()}`;
    const productDir = path.join(uploadsDir, sku);

    // Preserve texture filenames so MTL relative texture references resolve naturally.
    if (file.fieldname === 'model_texture') {
      const originalName = sanitizeUploadFilename(file.originalname);
      const ext = path.extname(originalName);
      const stem = path.basename(originalName, ext);
      let candidate = originalName;
      let suffix = 1;
      while (fs.existsSync(path.join(productDir, candidate))) {
        candidate = `${stem}-${suffix}${ext}`;
        suffix += 1;
      }
      cb(null, candidate);
      return;
    }

    const uploadType = getUploadType(file);
    const sequence = getNextUploadSequence(req, productDir, sku, uploadType);
    const ext = path.extname(file.originalname).toLowerCase();
    const filename = `${sku}-${uploadType}-${sequence}${ext}`;
    console.log(`Renaming file: ${file.originalname} -> ${filename} (SKU: ${rawSku}, field: ${file.fieldname})`);
    cb(null, filename);
  }
});

const upload = multer({ storage: storage });

// CSV-only multer instance for bulk import (memory storage, 2 MB cap)
const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const okMime = file.mimetype === 'text/csv' || file.mimetype === 'application/octet-stream';
    const okExt  = file.originalname.toLowerCase().endsWith('.csv');
    if (okMime || okExt) cb(null, true);
    else cb(new Error('Leidžiami tik CSV failai'));
  }
});

// API Routes

// Register endpoint
app.post('/api/register', async (req, res) => {
  const { email, password, name, phone, role } = req.body;

  // Validation
  if (!email || !password || !name || !role) {
    return res.status(400).json({ error: 'Missing required fields: email, password, name, role' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  if (!['dizaineris', 'tiekejas'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  try {
    // Hash password
    const salt = await bcryptjs.genSalt(10);
    const passwordHash = await bcryptjs.hash(password, salt);

    // Insert user
    db.run(
      `INSERT INTO users (email, password_hash, name, phone, role) VALUES (?, ?, ?, ?, ?)`,
      [email, passwordHash, name, phone || null, role],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(409).json({ error: 'Email already registered' });
          }
          return res.status(500).json({ error: 'Registration failed' });
        }
        res.json({ id: this.lastID, email, name, role });
      }
    );
  } catch (err) {
    res.status(500).json({ error: 'Registration error' });
  }
});

// Login endpoint
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  db.get('SELECT * FROM users WHERE email = ? AND is_active = 1', [email], async (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Login error' });
    }
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    try {
      const isValid = await bcryptjs.compare(password, user.password_hash);
      if (!isValid) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }
      res.json({ id: user.id, email: user.email, name: user.name, role: user.role });
    } catch (err) {
      res.status(500).json({ error: 'Login error' });
    }
  });
});

// Get all products
app.get('/api/products', (req, res) => {
  const includeInactive = req.query.includeInactive === '1' || req.query.includeInactive === 'true';
  const whereClause = includeInactive ? '' : 'WHERE p.is_active = 1';
  db.all(`
    SELECT p.*, GROUP_CONCAT(pi.format || ':' || pi.filepath) as images
    FROM products p
    LEFT JOIN product_images pi ON p.id = pi.product_id
    ${whereClause}
    GROUP BY p.id
    ORDER BY p.created_at DESC, p.id DESC
  `, [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    // Parse images
    rows.forEach(row => {
      row.is_active = Number(row.is_active) === 1;
      if (row.images) {
        const imageMap = {};
        row.images.split(',').forEach(img => {
          const [format, filename] = img.split(':');
          imageMap[format] = filename;
        });
        row.images = imageMap;
      } else {
        row.images = {};
      }
    });
    
    // Fetch 3D models for each product
    if (rows.length === 0) {
      res.json([]);
      return;
    }

    let completed = 0;
    rows.forEach(row => {
      db.all(`SELECT format, filename, filepath FROM product_models WHERE product_id = ?`, [row.id], (err, models) => {
        if (err) {
          row.models = [];
        } else {
          const modelMap = {};
          models.forEach(model => {
            const format = String(model.format || '').trim().toUpperCase();
            if (!format) return;
            modelMap[format] = model.filepath || model.filename;
          });

          // Fast fallback for legacy disk-only files: detect only missing STEP/DWG,
          // and only in likely direct folders to avoid expensive recursive scans on each request.
          const missingFormats = [];
          if (!modelMap.STEP) missingFormats.push('STEP');
          if (!modelMap.DWG) missingFormats.push('DWG');

          if (missingFormats.length > 0) {
            const candidateDirs = [];
            const seenDirs = new Set();

            models.forEach(model => {
              const relativePath = String(model.filepath || '').trim();
              if (!relativePath) return;
              const absolutePath = path.resolve(uploadsDir, relativePath);
              const dir = path.dirname(absolutePath);
              if (!fs.existsSync(dir) || seenDirs.has(dir)) return;
              seenDirs.add(dir);
              candidateDirs.push(dir);
            });

            const skuDir = path.join(uploadsDir, sanitizeSkuForFilename(row.sku));
            if (fs.existsSync(skuDir) && !seenDirs.has(skuDir)) {
              seenDirs.add(skuDir);
              candidateDirs.push(skuDir);
            }

            for (const dir of candidateDirs) {
              const candidates = getModelCandidatesFromFlatDir(dir);

              if (!modelMap.STEP && candidates.STEP) {
                modelMap.STEP = path.relative(uploadsDir, candidates.STEP).replace(/\\/g, '/');
              }
              if (!modelMap.DWG && candidates.DWG) {
                modelMap.DWG = path.relative(uploadsDir, candidates.DWG).replace(/\\/g, '/');
              }

              if (modelMap.STEP && modelMap.DWG) break;
            }
          }

          row.models = modelMap;
        }
        completed++;
        if (completed === rows.length) {
          res.json(rows);
        }
      });
    });
    
    // If no products, return empty array
    if (rows.length === 0) {
      res.json(rows);
    }
  });
});

app.get('/api/products/:id/download/:format', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: 'Invalid product id' });
    return;
  }

  const allowedFormats = new Set(['SKP', 'OBJ', '3DS', 'MTL', 'STEP', 'DWG']);
  const format = String(req.params.format || '').trim().toUpperCase();
  if (!allowedFormats.has(format)) {
    res.status(400).json({ error: 'Unsupported model format' });
    return;
  }

  try {
    const products = await dbAll(`SELECT sku FROM products WHERE id = ? LIMIT 1`, [id]);
    if (products.length === 0) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    const sku = products[0].sku;
    const dbRows = await dbAll(
      `SELECT filepath FROM product_models WHERE product_id = ? AND UPPER(format) = ? LIMIT 1`,
      [id, format]
    );

    let relativePath = dbRows[0]?.filepath || null;

    if (!relativePath) {
      const allModelRows = await dbAll(`SELECT filepath FROM product_models WHERE product_id = ?`, [id]);
      const candidateDirs = new Set();

      allModelRows.forEach(row => {
        const p = String(row.filepath || '').trim();
        if (!p) return;
        const dir = path.dirname(path.resolve(uploadsDir, p));
        if (fs.existsSync(dir)) candidateDirs.add(dir);
      });

      const skuDir = path.join(uploadsDir, sanitizeSkuForFilename(sku));
      if (fs.existsSync(skuDir)) candidateDirs.add(skuDir);

      for (const dir of candidateDirs) {
        const candidates = getModelCandidatesFromDir(dir);
        if (candidates[format]) {
          relativePath = path.relative(uploadsDir, candidates[format]).replace(/\\/g, '/');
          break;
        }
      }
    }

    if (!relativePath) {
      res.status(404).json({ error: `${format} file not found` });
      return;
    }

    const absolutePath = path.resolve(uploadsDir, relativePath);
    const uploadsRoot = path.resolve(uploadsDir);
    if (!absolutePath.startsWith(uploadsRoot + path.sep) && absolutePath !== uploadsRoot) {
      res.status(400).json({ error: 'Invalid file path' });
      return;
    }
    if (!fs.existsSync(absolutePath)) {
      res.status(404).json({ error: 'File not found on disk' });
      return;
    }

    db.run(
      `UPDATE products SET download_count = COALESCE(download_count, 0) + 1 WHERE id = ?`,
      [id],
      updateErr => {
        if (updateErr) {
          res.status(500).json({ error: updateErr.message });
          return;
        }

        res.download(absolutePath, getDownloadFileName(sku, relativePath, `.${format.toLowerCase()}`));
      }
    );
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to download model' });
  }
});

app.post('/api/products/:id/like', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: 'Invalid product id' });
    return;
  }

  const shouldLike = Boolean(req.body && req.body.liked);
  const sql = shouldLike
    ? `UPDATE products SET like_count = COALESCE(like_count, 0) + 1 WHERE id = ?`
    : `UPDATE products SET like_count = CASE WHEN COALESCE(like_count, 0) > 0 THEN like_count - 1 ELSE 0 END WHERE id = ?`;

  db.run(sql, [id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (this.changes === 0) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    res.json({ message: shouldLike ? 'Product liked' : 'Product unliked' });
  });
});

app.post('/api/products/:id/link-click', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: 'Invalid product id' });
    return;
  }

  db.run(
    `UPDATE products SET link_click_count = COALESCE(link_click_count, 0) + 1 WHERE id = ?`,
    [id],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      if (this.changes === 0) {
        res.status(404).json({ error: 'Product not found' });
        return;
      }
      res.json({ message: 'Link click recorded' });
    }
  );
});

// Add new product
app.post('/api/products', upload.fields([
  { name: 'image_jpg', maxCount: 1 },
  { name: 'image_png', maxCount: 1 },
  { name: 'image_svg', maxCount: 1 },
  { name: 'photos', maxCount: 10 },
  { name: 'model_skp', maxCount: 1 },
  { name: 'model_obj', maxCount: 1 },
  { name: 'model_mtl', maxCount: 1 },
  { name: 'model_3ds', maxCount: 1 },
  { name: 'model_step', maxCount: 1 },
  { name: 'model_dwg', maxCount: 1 },
  { name: 'model_texture', maxCount: 40 },
  { name: 'model_archive', maxCount: 1 }
]), (req, res) => {
  const { name, brand, category, price, description, dimensions, material, delivery, link, sku, stock } = req.body;
  
  // Validate SKU is provided
  if (!sku || !sku.trim()) {
    res.status(400).json({ error: 'SKU yra būtinas laukas' });
    return;
  }

  // Validate price is provided
  const parsedPrice = parseFloat(price);
  if (!parsedPrice || parsedPrice <= 0) {
    res.status(400).json({ error: 'Kaina yra būtinas laukas' });
    return;
  }
  db.run(`INSERT INTO products (name, brand, category, price, price_from, price_updated_at, description, dimensions, material, delivery, link, sku, stock) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [name, brand, category, parsedPrice, req.body.price_from === '1' ? 1 : 0, parsedPrice ? new Date().toISOString() : null, description, dimensions || null, material || null, delivery || null, link || null, sku, parseInt(stock) || 0],
    async function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }

      const productId = this.lastID;

      try {

      // Handle image uploads — accept both legacy single fields and new multi-photo field
      const images = [];
      ['jpg', 'png', 'svg'].forEach(format => {
        const fieldName = `image_${format}`;
        if (req.files[fieldName]) {
          const file = req.files[fieldName][0];
          const relativePath = path.relative(uploadsDir, file.path).replace(/\\/g, '/');
          images.push({
            product_id: productId,
            format: format.toUpperCase(),
            filename: file.filename,
            filepath: relativePath
          });
        }
      });
      // Multi-photo gallery field
      if (req.files['photos']) {
        req.files['photos'].forEach((file, idx) => {
          const relativePath = path.relative(uploadsDir, file.path).replace(/\\/g, '/');
          images.push({
            product_id: productId,
            format: idx === 0 ? 'MAIN' : `PHOTO_${idx}`,
            filename: file.filename,
            filepath: relativePath
          });
        });
      }

      // Insert images
      if (images.length > 0) {
        const stmt = db.prepare(`INSERT INTO product_images (product_id, format, filename, filepath) VALUES (?, ?, ?, ?)`);
        images.forEach(img => {
          stmt.run([img.product_id, img.format, img.filename, img.filepath]);
        });
        stmt.finalize();
      }

      // Handle 3D model uploads (manual files + optional archive auto-detection)
      const modelPathsByFormat = {};
      const modelFormats = {
        model_skp: 'SKP',
        model_obj: 'OBJ',
        model_mtl: 'MTL',
        model_3ds: '3DS',
        model_step: 'STEP',
        model_dwg: 'DWG'
      };
      Object.entries(modelFormats).forEach(([fieldName, format]) => {
        if (!req.files[fieldName]) return;
        const file = req.files[fieldName][0];
        modelPathsByFormat[format] = path.relative(uploadsDir, file.path).replace(/\\/g, '/');
      });

      const archiveFile = req.files?.model_archive?.[0];
      if (archiveFile) {
        const archiveMap = await getArchiveDerivedModelMap(archiveFile);
        Object.entries(archiveMap).forEach(([format, relativePath]) => {
          if (!modelPathsByFormat[format]) modelPathsByFormat[format] = relativePath;
        });
      }

      const models = Object.entries(modelPathsByFormat).map(([format, relativePath]) => ({
        product_id: productId,
        format,
        filename: path.basename(relativePath),
        filepath: relativePath
      }));

      // Insert 3D models
      if (models.length > 0) {
        const stmt = db.prepare(`INSERT INTO product_models (product_id, format, filename, filepath) VALUES (?, ?, ?, ?)`);
        models.forEach(model => {
          stmt.run([model.product_id, model.format, model.filename, model.filepath]);
        });
        stmt.finalize();
      }

      res.json({ id: productId, message: 'Product added successfully' });
      } catch (processingError) {
        console.error('Create product processing failed:', processingError);
        res.status(500).json({ error: 'Product processing failed', details: processingError.message });
      }
    });
});

// Update product metadata (no file changes)
app.patch('/api/products/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { name, brand, category, price, description, dimensions, material, delivery, link, sku, stock } = req.body;
  db.run(
    `UPDATE products SET name=?, brand=?, category=?, price=?, description=?, dimensions=?, material=?, delivery=?, link=?, sku=?, stock=? WHERE id=?`,
    [name, brand, category, parseFloat(price) || null, description, dimensions || null, material || null, delivery || null, link || null, sku, parseInt(stock) || 0, id],
    function(err) {
      if (err) { res.status(500).json({ error: err.message }); return; }
      if (this.changes === 0) { res.status(404).json({ error: 'Product not found' }); return; }
      res.json({ message: 'Product updated' });
    }
  );
});

app.patch('/api/products/:id/status', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const isActive = req.body.is_active ? 1 : 0;

  db.run(
    `UPDATE products SET is_active = ? WHERE id = ?`,
    [isActive, id],
    function(err) {
      if (err) { res.status(500).json({ error: err.message }); return; }
      if (this.changes === 0) { res.status(404).json({ error: 'Product not found' }); return; }
      res.json({ message: isActive ? 'Product activated' : 'Product deactivated' });
    }
  );
});

// Edit product metadata + media (photos and SKP)
app.post('/api/products/:id/edit', upload.fields([
  { name: 'photos', maxCount: 10 },
  { name: 'model_skp', maxCount: 1 },
  { name: 'model_obj', maxCount: 1 },
  { name: 'model_mtl', maxCount: 1 },
  { name: 'model_3ds', maxCount: 1 },
  { name: 'model_step', maxCount: 1 },
  { name: 'model_dwg', maxCount: 1 },
  { name: 'model_texture', maxCount: 40 },
  { name: 'model_archive', maxCount: 1 }
]), async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: 'Invalid product id' });
    return;
  }

  const {
    name,
    brand,
    category,
    price,
    description,
    dimensions,
    material,
    delivery,
    link,
    sku,
    stock,
    photo_order
  } = req.body;

  try {
    const newPrice = parseFloat(price) || null;
    const existingProduct = await dbAll(`SELECT price FROM products WHERE id = ?`, [id]);
    const oldPrice = existingProduct.length ? (existingProduct[0].price || null) : null;
    const priceChanged = newPrice !== oldPrice;

    await dbRun(
      `UPDATE products SET name=?, brand=?, category=?, price=?, price_from=?, price_updated_at=CASE WHEN ? THEN ? ELSE price_updated_at END, description=?, dimensions=?, material=?, delivery=?, link=?, sku=?, stock=? WHERE id=?`,
      [name, brand, category, newPrice, req.body.price_from === '1' ? 1 : 0, priceChanged ? 1 : 0, priceChanged ? new Date().toISOString() : null, description, dimensions || null, material || null, delivery || null, link || null, sku, parseInt(stock) || 0, id]
    );

    const previousImages = await dbAll(
      `SELECT filepath FROM product_images WHERE product_id = ?`,
      [id]
    );
    const previousImagePaths = new Set(previousImages.map(r => r.filepath).filter(Boolean));

    const uploadedPhotos = (req.files && req.files.photos) ? req.files.photos : [];
    const newPhotoPaths = uploadedPhotos.map(file => path.relative(uploadsDir, file.path).replace(/\\/g, '/'));

    let orderedPaths = [];
    let orderTokens = [];
    try {
      orderTokens = photo_order ? JSON.parse(photo_order) : [];
      if (!Array.isArray(orderTokens)) orderTokens = [];
    } catch {
      orderTokens = [];
    }

    if (orderTokens.length > 0) {
      orderTokens.forEach(token => {
        if (typeof token !== 'string') return;
        if (token.startsWith('existing:')) {
          const p = token.slice('existing:'.length);
          if (previousImagePaths.has(p)) orderedPaths.push(p);
        } else if (token.startsWith('new:')) {
          const idx = parseInt(token.slice('new:'.length), 10);
          if (Number.isInteger(idx) && idx >= 0 && idx < newPhotoPaths.length) {
            orderedPaths.push(newPhotoPaths[idx]);
          }
        }
      });
    } else {
      // Fallback: keep all existing, then append new
      orderedPaths = [...previousImagePaths, ...newPhotoPaths];
    }

    // Replace image rows with new order
    await dbRun(`DELETE FROM product_images WHERE product_id = ?`, [id]);
    for (let idx = 0; idx < orderedPaths.length; idx++) {
      const p = orderedPaths[idx];
      await dbRun(
        `INSERT INTO product_images (product_id, format, filename, filepath) VALUES (?, ?, ?, ?)`,
        [id, idx === 0 ? 'MAIN' : `PHOTO_${idx}`, path.basename(p), p]
      );
    }

    // Delete removed files from disk (only paths that were previously in DB and no longer kept)
    previousImagePaths.forEach(p => {
      if (!orderedPaths.includes(p)) deleteUploadedFile(p);
    });

    // Replace specific model formats when new files are uploaded.
    const modelPathsByFormat = {};
    const editableModelFormats = {
      model_skp: 'SKP',
      model_obj: 'OBJ',
      model_mtl: 'MTL',
      model_3ds: '3DS',
      model_step: 'STEP',
      model_dwg: 'DWG'
    };

    for (const [fieldName, format] of Object.entries(editableModelFormats)) {
      if (!(req.files && req.files[fieldName] && req.files[fieldName][0])) continue;

      const newModelFile = req.files[fieldName][0];
      const newModelPath = path.relative(uploadsDir, newModelFile.path).replace(/\\/g, '/');
      modelPathsByFormat[format] = newModelPath;
    }

    const archiveFile = req.files?.model_archive?.[0];
    if (archiveFile) {
      const archiveMap = await getArchiveDerivedModelMap(archiveFile);
      Object.entries(archiveMap).forEach(([format, relativePath]) => {
        if (!modelPathsByFormat[format]) modelPathsByFormat[format] = relativePath;
      });
    }

    for (const [format, newModelPath] of Object.entries(modelPathsByFormat)) {

      const oldRows = await dbAll(
        `SELECT filepath FROM product_models WHERE product_id = ? AND format = ?`,
        [id, format]
      );

      await dbRun(`DELETE FROM product_models WHERE product_id = ? AND format = ?`, [id, format]);
      await dbRun(
        `INSERT INTO product_models (product_id, format, filename, filepath) VALUES (?, ?, ?, ?)`,
        [id, format, path.basename(newModelPath), newModelPath]
      );

      oldRows.forEach(r => deleteUploadedFile(r.filepath));
    }

    res.json({ message: 'Product updated with media' });
  } catch (error) {
    console.error('Edit product failed:', error);
    res.status(500).json({ error: 'Edit product failed', details: error.message });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: 'Invalid product id' });
    return;
  }

  try {
    const products = await dbAll(`SELECT sku FROM products WHERE id = ?`, [id]);
    if (products.length === 0) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    const assetRows = await dbAll(
      `SELECT filepath FROM product_images WHERE product_id = ?
       UNION ALL
       SELECT filepath FROM product_models WHERE product_id = ?`,
      [id, id]
    );

    const uploadDirs = new Set();
    assetRows.forEach(row => {
      const filePath = String(row.filepath || '').trim();
      if (!filePath) return;
      deleteUploadedFile(filePath);
      const dirName = path.dirname(filePath).replace(/\\/g, '/');
      if (dirName && dirName !== '.') uploadDirs.add(dirName);
    });

    const skuDir = sanitizeSkuForFilename(products[0].sku || '');
    if (skuDir) uploadDirs.add(skuDir);

    await dbRun(`DELETE FROM product_images WHERE product_id = ?`, [id]);
    await dbRun(`DELETE FROM product_models WHERE product_id = ?`, [id]);
    const result = await dbRun(`DELETE FROM products WHERE id = ?`, [id]);

    uploadDirs.forEach(dir => deleteUploadDirectory(dir));

    if (result.changes === 0) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    res.json({ message: 'Product deleted' });
  } catch (error) {
    console.error('Delete product failed:', error);
    res.status(500).json({ error: 'Delete product failed', details: error.message });
  }
});

if (fs.existsSync(distDir)) {
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads') || req.path === '/admin') {
      next();
      return;
    }
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

// ══════════════════════════════════════════════════════════
// ADMIN PANEL
// ══════════════════════════════════════════════════════════

const isProduction = process.env.NODE_ENV === 'production';
const ADMIN_USER = process.env.ADMIN_USER || null;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || null;

if (!ADMIN_USER || !ADMIN_PASSWORD) {
  console.warn('[admin] ADMIN_USER / ADMIN_PASSWORD env vars not set — admin routes disabled.');
} else {
  // Token store: Map<token, expiresAt>
  const adminSessions = new Map();
  const TOKEN_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

  // Rate limiter: Map<ip, { count, lockedUntil }>
  const loginAttempts = new Map();
  const MAX_ATTEMPTS = 5;
  const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

  function purgeExpiredAdminTokens() {
    const now = Date.now();
    for (const [token, expiresAt] of adminSessions) {
      if (now > expiresAt) adminSessions.delete(token);
    }
  }

  // Timing-safe string comparison — always runs in constant time regardless of length match
  function timingSafeEqual(a, b) {
    const aBuf = Buffer.from(String(a));
    const bBuf = Buffer.from(String(b));
    // Use a dummy buffer of bBuf length so timingSafeEqual never throws on length mismatch,
    // then AND with the actual length check.
    const dummy = Buffer.alloc(bBuf.length);
    const match = crypto.timingSafeEqual(
      aBuf.length === bBuf.length ? aBuf : dummy,
      bBuf
    );
    return match && aBuf.length === bBuf.length;
  }

  function requireAdmin(req, res, next) {
    purgeExpiredAdminTokens();
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!token || !adminSessions.has(token)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
  }

  // Serve admin.html with security headers
  const adminHtmlPath = path.join(__dirname, 'admin.html');
  app.get('/admin', (req, res) => {
    if (!fs.existsSync(adminHtmlPath)) {
      return res.status(404).send('Not found');
    }
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self'; connect-src 'self'"
    );
    res.sendFile(adminHtmlPath);
  });

  // POST /api/admin/login
  app.post('/api/admin/login', (req, res) => {
    const ip = req.ip || 'unknown';
    const now = Date.now();

    // Rate limit check
    const attempt = loginAttempts.get(ip);
    if (attempt && attempt.lockedUntil && now < attempt.lockedUntil) {
      return res.status(429).json({ error: 'Per daug bandymų. Bandykite po 15 min.' });
    }

    const { username, password } = req.body;

    const userMatch = timingSafeEqual(username || '', ADMIN_USER);
    const passMatch = timingSafeEqual(password || '', ADMIN_PASSWORD);

    if (!userMatch || !passMatch) {
      // Increment rate limit counter
      const entry = loginAttempts.get(ip) || { count: 0, lockedUntil: null };
      entry.count += 1;
      if (entry.count >= MAX_ATTEMPTS) {
        entry.lockedUntil = now + LOCKOUT_MS;
      }
      loginAttempts.set(ip, entry);
      return res.status(401).json({ error: 'Neteisingi prisijungimo duomenys' });
    }

    // Success — reset rate limit, issue token
    loginAttempts.delete(ip);
    const token = crypto.randomUUID();
    adminSessions.set(token, now + TOKEN_TTL_MS);
    res.json({ token });
  });

  // POST /api/admin/logout
  app.post('/api/admin/logout', (req, res) => {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (token) adminSessions.delete(token);
    res.json({ ok: true });
  });

  // GET /api/admin/stats
  app.get('/api/admin/stats', requireAdmin, async (req, res) => {
    try {
      const row = await new Promise((resolve, reject) => {
        db.get(`
          SELECT
            COUNT(*) AS total_products,
            SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS active_products,
            COALESCE(SUM(download_count), 0) AS total_downloads,
            COALESCE(SUM(like_count), 0) AS total_likes,
            COALESCE(SUM(link_click_count), 0) AS total_link_clicks
          FROM products
        `, [], (err, r) => { if (err) reject(err); else resolve(r); });
      });
      const usersRow = await new Promise((resolve, reject) => {
        db.get(`
          SELECT
            COUNT(*) AS total_users,
            SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS active_users
          FROM users
        `, [], (err, r) => { if (err) reject(err); else resolve(r); });
      });
      res.json({ ...row, ...usersRow });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/admin/products
  app.get('/api/admin/products', requireAdmin, (req, res) => {
    db.all(`
        SELECT p.id, p.name, p.brand, p.category, p.price, p.sku, p.stock,
          p.price_from, p.description, p.dimensions, p.material, p.delivery, p.link,
             p.is_active, p.download_count, p.like_count, p.link_click_count, p.created_at,
             COUNT(DISTINCT pi.id) AS image_count
      FROM products p
      LEFT JOIN product_images pi ON p.id = pi.product_id
      GROUP BY p.id
      ORDER BY p.created_at DESC, p.id DESC
    `, [], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      rows.forEach(r => { r.is_active = Number(r.is_active) === 1; });
      res.json(rows);
    });
  });

  // PATCH /api/admin/products/:id
  app.patch('/api/admin/products/:id', requireAdmin, (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

    const {
      name,
      brand,
      category,
      price,
      description,
      dimensions,
      material,
      delivery,
      link,
      sku,
      stock,
      is_active
    } = req.body || {};

    const cleanName = String(name || '').trim();
    const cleanCategory = String(category || '').trim();
    const cleanSku = String(sku || '').trim();

    if (!cleanName || !cleanCategory || !cleanSku) {
      return res.status(400).json({ error: 'Missing required fields: name, category, sku' });
    }

    db.run(
      `UPDATE products
       SET name = ?, brand = ?, category = ?, price = ?, price_from = ?, description = ?,
           dimensions = ?, material = ?, delivery = ?, link = ?, sku = ?,
           stock = ?, is_active = ?
       WHERE id = ?`,
      [
        cleanName,
        String(brand || '').trim() || null,
        cleanCategory,
        Number.isFinite(Number(price)) ? Number(price) : null,
        (req.body || {}).price_from ? 1 : 0,
        String(description || '').trim() || null,
        String(dimensions || '').trim() || null,
        String(material || '').trim() || null,
        String(delivery || '').trim() || null,
        String(link || '').trim() || null,
        cleanSku,
        Number.isFinite(parseInt(stock, 10)) ? parseInt(stock, 10) : 0,
        is_active ? 1 : 0,
        id
      ],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Not found' });
        res.json({ ok: true });
      }
    );
  });

  // POST /api/admin/products/:id/media
  app.post('/api/admin/products/:id/media', requireAdmin, upload.fields([
    { name: 'photos', maxCount: 10 },
    { name: 'model_skp', maxCount: 1 },
    { name: 'model_obj', maxCount: 1 },
    { name: 'model_mtl', maxCount: 1 },
    { name: 'model_3ds', maxCount: 1 },
    { name: 'model_step', maxCount: 1 },
    { name: 'model_dwg', maxCount: 1 },
    { name: 'model_texture', maxCount: 40 },
    { name: 'model_archive', maxCount: 1 }
  ]), async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: 'Invalid product id' });
      return;
    }

    try {
      const products = await dbAll(`SELECT id FROM products WHERE id = ?`, [id]);
      if (products.length === 0) {
        res.status(404).json({ error: 'Product not found' });
        return;
      }

      const uploadedPhotos = (req.files && req.files.photos) ? req.files.photos : [];
      const replacePhotos = String(req.body.replace_photos || '') === '1';

      if (uploadedPhotos.length > 0) {
        if (replacePhotos) {
          const oldRows = await dbAll(`SELECT filepath FROM product_images WHERE product_id = ?`, [id]);
          await dbRun(`DELETE FROM product_images WHERE product_id = ?`, [id]);
          oldRows.forEach(row => deleteUploadedFile(row.filepath));
        }

        const countRows = await dbAll(`SELECT COUNT(*) AS c FROM product_images WHERE product_id = ?`, [id]);
        let startIndex = Number(countRows[0]?.c || 0);

        for (let idx = 0; idx < uploadedPhotos.length; idx++) {
          const file = uploadedPhotos[idx];
          const relativePath = path.relative(uploadsDir, file.path).replace(/\\/g, '/');
          const ordinal = startIndex + idx;
          await dbRun(
            `INSERT INTO product_images (product_id, format, filename, filepath) VALUES (?, ?, ?, ?)`,
            [id, ordinal === 0 ? 'MAIN' : `PHOTO_${ordinal}`, file.filename, relativePath]
          );
        }
      }

      const modelPathsByFormat = {};
      const editableModelFormats = {
        model_skp: 'SKP',
        model_obj: 'OBJ',
        model_mtl: 'MTL',
        model_3ds: '3DS',
        model_step: 'STEP',
        model_dwg: 'DWG'
      };

      for (const [fieldName, format] of Object.entries(editableModelFormats)) {
        if (!(req.files && req.files[fieldName] && req.files[fieldName][0])) continue;
        const modelFile = req.files[fieldName][0];
        modelPathsByFormat[format] = path.relative(uploadsDir, modelFile.path).replace(/\\/g, '/');
      }

      const archiveFile = req.files?.model_archive?.[0];
      if (archiveFile) {
        const archiveMap = await getArchiveDerivedModelMap(archiveFile);
        Object.entries(archiveMap).forEach(([format, relativePath]) => {
          if (!modelPathsByFormat[format]) modelPathsByFormat[format] = relativePath;
        });
      }

      for (const [format, newModelPath] of Object.entries(modelPathsByFormat)) {
        const oldRows = await dbAll(
          `SELECT filepath FROM product_models WHERE product_id = ? AND format = ?`,
          [id, format]
        );

        await dbRun(`DELETE FROM product_models WHERE product_id = ? AND format = ?`, [id, format]);
        await dbRun(
          `INSERT INTO product_models (product_id, format, filename, filepath) VALUES (?, ?, ?, ?)`,
          [id, format, path.basename(newModelPath), newModelPath]
        );

        oldRows.forEach(row => deleteUploadedFile(row.filepath));
      }

      res.json({ ok: true });
    } catch (error) {
      console.error('Admin media update failed:', error);
      res.status(500).json({ error: 'Media update failed', details: error.message });
    }
  });

  // PATCH /api/admin/products/:id/status
  app.patch('/api/admin/products/:id/status', requireAdmin, (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });
    const isActive = req.body.is_active ? 1 : 0;
    db.run(`UPDATE products SET is_active = ? WHERE id = ?`, [isActive, id], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Not found' });
      res.json({ ok: true });
    });
  });

  // DELETE /api/admin/products/:id
  app.delete('/api/admin/products/:id', requireAdmin, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });
    try {
      const products = await dbAll(`SELECT sku FROM products WHERE id = ?`, [id]);
      if (products.length === 0) return res.status(404).json({ error: 'Not found' });

      const assetRows = await dbAll(
        `SELECT filepath FROM product_images WHERE product_id = ?
         UNION ALL
         SELECT filepath FROM product_models WHERE product_id = ?`,
        [id, id]
      );

      const uploadDirs = new Set();
      assetRows.forEach(row => {
        const filePath = String(row.filepath || '').trim();
        if (!filePath) return;
        deleteUploadedFile(filePath);
        const dirName = path.dirname(filePath).replace(/\\/g, '/');
        if (dirName && dirName !== '.') uploadDirs.add(dirName);
      });

      const skuDir = sanitizeSkuForFilename(products[0].sku || '');
      if (skuDir) uploadDirs.add(skuDir);

      await dbRun(`DELETE FROM product_images WHERE product_id = ?`, [id]);
      await dbRun(`DELETE FROM product_models WHERE product_id = ?`, [id]);
      const result = await dbRun(`DELETE FROM products WHERE id = ?`, [id]);

      uploadDirs.forEach(dir => deleteUploadDirectory(dir));

      if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/admin/users
  app.get('/api/admin/users', requireAdmin, (req, res) => {
    db.all(
      `SELECT id, email, name, phone, role, is_active, created_at FROM users ORDER BY created_at DESC`,
      [],
      (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        rows.forEach(r => { r.is_active = Number(r.is_active) === 1; });
        res.json(rows);
      }
    );
  });

  // PATCH /api/admin/users/:id/status
  app.patch('/api/admin/users/:id/status', requireAdmin, (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });
    const isActive = req.body.is_active ? 1 : 0;
    db.run(`UPDATE users SET is_active = ? WHERE id = ?`, [isActive, id], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Not found' });
      res.json({ ok: true });
    });
  });

  // PATCH /api/admin/users/:id
  app.patch('/api/admin/users/:id', requireAdmin, (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim();
    const phone = req.body.phone == null ? null : String(req.body.phone).trim();
    const role = String(req.body.role || '').trim();
    const isActive = req.body.is_active ? 1 : 0;

    if (!name || !email || !role) {
      return res.status(400).json({ error: 'Missing required fields: name, email, role' });
    }
    if (!['dizaineris', 'tiekejas'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    db.run(
      `UPDATE users SET name = ?, email = ?, phone = ?, role = ?, is_active = ? WHERE id = ?`,
      [name, email, phone || null, role, isActive, id],
      function(err) {
        if (err) {
          if (String(err.message || '').includes('UNIQUE constraint failed')) {
            return res.status(409).json({ error: 'Email already in use' });
          }
          return res.status(500).json({ error: err.message });
        }
        if (this.changes === 0) return res.status(404).json({ error: 'Not found' });
        res.json({ ok: true });
      }
    );
  });

  // ══════════════════════════════════════════════════════════
  // BULK CSV IMPORT
  // ══════════════════════════════════════════════════════════

  // CSV columns the importer accepts
  const CSV_REQUIRED_HEADERS = ['sku', 'name', 'price'];
  const IMPORT_PREVIEW_TTL_MS = 30 * 60 * 1000; // 30 minutes
  const CSV_MAX_ROWS = 2000;

  // In-memory store for pending previews: Map<token, { rows, expiresAt }>
  const importPreviews = new Map();

  function purgeCsvPreviews() {
    const now = Date.now();
    for (const [token, entry] of importPreviews) {
      if (now > entry.expiresAt) importPreviews.delete(token);
    }
  }

  /**
   * RFC-4180-compatible CSV parser.  Handles quoted fields and escaped double-quotes.
   * Returns an array of string[] rows (first row is headers).
   */
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
      // Trailing comma adds one empty field — push it
      if (line.endsWith(',')) fields.push('');
      result.push(fields);
    }
    return result;
  }

  /**
   * Map raw CSV fields onto product columns, validate, and return a normalized row.
   * Returns { sku, name, brand, category, price, description, dimensions, material,
   *           delivery, link, stock, is_active, _rowNum, _errors[], _warnings[] }
   */
  function normalizeImportRow(rawFields, headers) {
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

    const priceFromRaw = (raw.price_from || '').toLowerCase();
    const normalizedPriceFrom = ['1', 'true', 'yes', 'taip', 'nuo'].includes(priceFromRaw) ? 1 : 0;

    return {
      sku: raw.sku || null,
      name: raw.name || null,
      brand: raw.brand || null,
      category: raw.category || null,
      price: Number.isFinite(price) && price > 0 ? price : null,
      price_from: normalizedPriceFrom,
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

  // POST /api/admin/import/preview
  app.post('/api/admin/import/preview', requireAdmin, csvUpload.single('csv'), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'CSV failas neįkeltas' });
    }

    let text;
    try {
      text = req.file.buffer.toString('utf8');
    } catch {
      return res.status(400).json({ error: 'Nepavyko perskaityti failo' });
    }

    const parsedRows = parseCsv(text);
    if (parsedRows.length === 0) {
      return res.status(400).json({ error: 'CSV failas tuščias' });
    }

    const rawHeaders = parsedRows[0].map(h => h.trim().toLowerCase());
    const dataRows = parsedRows.slice(1);

    if (dataRows.length === 0) {
      return res.status(400).json({ error: 'CSV neturi duomenų eilučių' });
    }
    if (dataRows.length > CSV_MAX_ROWS) {
      return res.status(400).json({ error: `Maksimalus eilučių skaičius — ${CSV_MAX_ROWS}` });
    }

    const missingRequired = CSV_REQUIRED_HEADERS.filter(h => !rawHeaders.includes(h));
    if (missingRequired.length > 0) {
      return res.status(400).json({ error: `Trūksta privalomų stulpelių: ${missingRequired.join(', ')}` });
    }

    const normalized = dataRows.map((fields, i) => ({
      _rowNum: i + 2,
      ...normalizeImportRow(fields, rawHeaders)
    }));

    const skus = [...new Set(normalized.map(r => r.sku).filter(Boolean))];
    let existingSkus = new Set();
    if (skus.length > 0) {
      try {
        const placeholders = skus.map(() => '?').join(',');
        const rows = await dbAll(`SELECT sku FROM products WHERE sku IN (${placeholders})`, skus);
        existingSkus = new Set(rows.map(r => r.sku));
      } catch (err) {
        return res.status(500).json({ error: 'DB klaida: ' + err.message });
      }
    }

    const preview = normalized.map(r => ({
      ...r,
      _action: r._errors.length > 0 ? 'skip' : (existingSkus.has(r.sku) ? 'update' : 'create')
    }));

    const validRows = preview.filter(r => r._errors.length === 0);
    const invalidRows = preview.filter(r => r._errors.length > 0);

    purgeCsvPreviews();
    const token = crypto.randomUUID();
    importPreviews.set(token, {
      rows: validRows,
      expiresAt: Date.now() + IMPORT_PREVIEW_TTL_MS
    });

    res.json({
      token,
      total: preview.length,
      valid: validRows.length,
      invalid: invalidRows.length,
      toCreate: validRows.filter(r => r._action === 'create').length,
      toUpdate: validRows.filter(r => r._action === 'update').length,
      preview: preview.map(r => ({
        _rowNum: r._rowNum,
        sku: r.sku,
        name: r.name,
        brand: r.brand,
        category: r.category,
        price: r.price,
        stock: r.stock,
        is_active: r.is_active,
        _action: r._action,
        _errors: r._errors,
        _warnings: r._warnings
      }))
    });
  });

  // POST /api/admin/import/apply
  app.post('/api/admin/import/apply', requireAdmin, async (req, res) => {
    const { token } = req.body || {};
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Trūksta importo žetono (token)' });
    }

    purgeCsvPreviews();
    const entry = importPreviews.get(token);
    if (!entry) {
      return res.status(400).json({ error: 'Importo žetonas nebegalioja arba nerastas. Pakartokite peržiūrą.' });
    }
    importPreviews.delete(token);

    const rows = entry.rows;
    if (rows.length === 0) {
      return res.json({ created: 0, updated: 0, failed: 0, details: [] });
    }

    const skus = [...new Set(rows.map(r => r.sku))];
    let existingMap = {};
    try {
      const placeholders = skus.map(() => '?').join(',');
      const existing = await dbAll(`SELECT id, sku FROM products WHERE sku IN (${placeholders})`, skus);
      existing.forEach(r => { existingMap[r.sku] = r.id; });
    } catch (err) {
      return res.status(500).json({ error: 'DB klaida: ' + err.message });
    }

    const results = { created: 0, updated: 0, failed: 0, details: [] };

    await dbRun('BEGIN');
    try {
      for (const row of rows) {
        if (existingMap[row.sku] != null) {
          const id = existingMap[row.sku];
          await dbRun(
            `UPDATE products SET name=?, brand=?, category=?, price=?, price_from=?,
             description=?, dimensions=?, material=?, delivery=?, link=?, stock=?, is_active=?
             WHERE id=?`,
            [row.name, row.brand, row.category, row.price, row.price_from,
             row.description, row.dimensions, row.material, row.delivery, row.link,
             row.stock, row.is_active, id]
          );
          results.updated++;
          results.details.push({ sku: row.sku, action: 'updated', rowNum: row._rowNum });
        } else {
          const r = await dbRun(
            `INSERT INTO products
             (name, brand, category, price, price_from, price_updated_at, description, dimensions,
              material, delivery, link, sku, stock, is_active)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [row.name, row.brand, row.category, row.price, row.price_from,
             row.price != null ? new Date().toISOString() : null,
             row.description, row.dimensions, row.material, row.delivery,
             row.link, row.sku, row.stock, row.is_active]
          );
          existingMap[row.sku] = r.lastID; // deduplicate if SKU appears twice in CSV
          results.created++;
          results.details.push({ sku: row.sku, action: 'created', rowNum: row._rowNum });
        }
      }
      await dbRun('COMMIT');
    } catch (txErr) {
      try { await dbRun('ROLLBACK'); } catch { /* ignore secondary error */ }
      return res.status(500).json({
        error: 'Importas nepavyko, visos pakeitimai atšaukti: ' + txErr.message
      });
    }

    res.json(results);
  });
}

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
