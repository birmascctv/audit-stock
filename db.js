import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'birmas_audit.sqlite');

let dbInstance = null;

export function getDb() {
  if (!dbInstance) {
    dbInstance = new DatabaseSync(DB_PATH);
    initTables(dbInstance);
  }
  return dbInstance;
}

function initTables(db) {
  // 1. Stores Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS stores (
      id TEXT PRIMARY KEY,
      wp_id INTEGER,
      name TEXT NOT NULL,
      location_code TEXT,
      esb_branch_code TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 2. Products Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      barcode TEXT UNIQUE,
      sku TEXT,
      brand TEXT,
      varian TEXT,
      product_title TEXT,
      category TEXT,
      sub_category TEXT,
      default_unit TEXT,
      package_type TEXT,
      volume REAL,
      unit_volume TEXT,
      price REAL,
      wp_status TEXT DEFAULT 'publish',
      last_updated TEXT
    );
  `);

  // Migrate additional columns for existing tables
  try { db.exec(`ALTER TABLE products ADD COLUMN category TEXT;`); } catch (_) {}
  try { db.exec(`ALTER TABLE products ADD COLUMN sub_category TEXT;`); } catch (_) {}
  try { db.exec(`ALTER TABLE products ADD COLUMN default_unit TEXT;`); } catch (_) {}

  // 3. Store Stocks Table (relation between store and product)
  db.exec(`
    CREATE TABLE IF NOT EXISTS store_stocks (
      store_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      stock_qty REAL DEFAULT 0,
      available_qty REAL DEFAULT 0,
      booked_qty REAL DEFAULT 0,
      stock_value REAL DEFAULT 0,
      last_synced TEXT,
      PRIMARY KEY (store_id, product_id)
    );
  `);

  try { db.exec(`ALTER TABLE store_stocks ADD COLUMN available_qty REAL DEFAULT 0;`); } catch (_) {}
  try { db.exec(`ALTER TABLE store_stocks ADD COLUMN booked_qty REAL DEFAULT 0;`); } catch (_) {}
  try { db.exec(`ALTER TABLE store_stocks ADD COLUMN stock_value REAL DEFAULT 0;`); } catch (_) {}

  // 4. Audit Scans Table (live audit station scans)
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_scans (
      id TEXT PRIMARY KEY,
      store_id TEXT NOT NULL,
      barcode TEXT NOT NULL,
      brand TEXT,
      varian TEXT,
      scan_sequence INTEGER,
      auditor_name TEXT,
      timestamp TEXT NOT NULL
    );
  `);

  // 5. Audit History Table (completed audits)
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_history (
      id TEXT PRIMARY KEY,
      store_id TEXT NOT NULL,
      store_name TEXT,
      auditor_name TEXT,
      timestamp TEXT NOT NULL,
      completed_at TEXT,
      total_items INTEGER,
      variance_count INTEGER,
      accuracy REAL,
      records_json TEXT
    );
  `);

  // 6. Users Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT,
      password TEXT NOT NULL,
      name TEXT,
      role TEXT
    );
  `);

  // 7. App Configuration Table (for settings like wpUrl, selectedStoreId, etc.)
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_config (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  // Seed & sync required users: admin (admin666) and chrisna (auditor666)
  const upsertUser = db.prepare(`
    INSERT INTO users (id, username, email, password, name, role)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(username) DO UPDATE SET
      password = excluded.password,
      name = excluded.name,
      role = excluded.role;
  `);
  upsertUser.run('user-admin', 'admin', 'admin@birmas.id', 'admin666', 'Admin', 'admin');
  upsertUser.run('user-chrisna', 'chrisna', 'chrisna@birmas.id', 'auditor666', 'Chrisna', 'auditor');

  // Guarantee the 4 official stores requested: Kuningan, Sudirman, Kwitang, Lebak Bulus
  const upsertStore = db.prepare(`
    INSERT INTO stores (id, name, location_code, esb_branch_code)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      location_code = excluded.location_code,
      esb_branch_code = excluded.esb_branch_code;
  `);
  upsertStore.run('birmas-kuningan', 'Birmas Kuningan', 'BRM-KNG', 'KUNINGAN');
  upsertStore.run('birmas-sudirman', 'Birmas Sudirman', 'BRM-SDR', 'SUDIRMAN');
  upsertStore.run('birmas-kwitang', 'Birmas Kwitang', 'BRM-KWT', 'KWITANG');
  upsertStore.run('birmas-lebak-bulus', 'Birmas Lebak Bulus', 'BRM-LBB', 'LEBAKBULUS');

  // Purge any other test or duplicate stores
  db.exec(`
    DELETE FROM stores WHERE id NOT IN ('birmas-kuningan', 'birmas-sudirman', 'birmas-kwitang', 'birmas-lebak-bulus');
  `);

  // Purge any legacy mock barcodes from previous template versions
  db.exec(`
    DELETE FROM products WHERE id LIKE 'wp-10%';
    DELETE FROM products WHERE id LIKE 'esb-%';
    DELETE FROM store_stocks WHERE product_id LIKE 'esb-%';
    DELETE FROM products WHERE category IN ('PERLENGKAPAN OUTLET', 'ASSET', 'Asset', 'NON DEPRECIATED ASSET');
    DELETE FROM store_stocks WHERE product_id IN ('erp-276', 'erp-298', 'erp-254');
    UPDATE products SET barcode = NULL WHERE barcode IN (
      '8997026800122', '8997026800030', '8997026800078', '8997026800016',
      '8993156000074', '8993156668267', '8993156668229', '8998888001011',
      '8801048951112', '5000213007624'
    );
  `);

  // Seed default WP config if not present
  const wpUrl = db.prepare('SELECT value FROM app_config WHERE key = ?;').get('wp_url');
  if (!wpUrl) {
    const setConfigStmt = db.prepare('INSERT OR REPLACE INTO app_config (key, value) VALUES (?, ?);');
    setConfigStmt.run('wp_url', 'https://admin.birmas.id');
    setConfigStmt.run('custom_endpoint_path', '/wp-json/api/v1/product_stocks?per_page=100');
    setConfigStmt.run('auto_sync_interval_seconds', '30');
    setConfigStmt.run('is_connected', 'true');
    setConfigStmt.run('last_synced_at', new Date().toISOString());
  }

  cleanupLegacyWordPressData(db);
}

// Automatically purges old wp-* rows and preserves barcodes on ESB items
export function cleanupLegacyWordPressData(providedDb) {
  const db = providedDb || getDb();
  try {
    const wpProducts = db.prepare("SELECT * FROM products WHERE id LIKE 'wp-%' AND barcode IS NOT NULL;").all();
    const esbProducts = db.prepare("SELECT * FROM products WHERE id LIKE 'esb-%';").all();

    let migrated = 0;
    for (const wp of wpProducts) {
      const match = esbProducts.find(
        (esb) =>
          esb.brand?.toLowerCase() === wp.brand?.toLowerCase() &&
          (esb.varian?.toLowerCase().includes(wp.varian?.toLowerCase()) || wp.varian?.toLowerCase().includes(esb.varian?.toLowerCase()))
      );
      if (match && !match.barcode) {
        db.prepare('UPDATE products SET barcode = ? WHERE id = ?;').run(wp.barcode, match.id);
        migrated++;
      }
    }

    const delP = db.prepare("DELETE FROM products WHERE id LIKE 'wp-%' OR product_title = 'Birmas Product';").run();
    const delS = db.prepare("DELETE FROM store_stocks WHERE product_id LIKE 'wp-%';").run();
    console.log(`[DB Auto-Cleanup] Purged legacy WordPress duplicates. Migrated ${migrated} barcodes to ESB items.`);
    return { migratedBarcodes: migrated, deletedProducts: delP.changes, deletedStocks: delS.changes };
  } catch (err) {
    console.warn('[DB Cleanup Note]:', err.message);
    return { error: err.message };
  }
}

export function mapProductBarcode(productId, barcode) {
  const db = getDb();
  const clean = barcode.trim();
  db.prepare('UPDATE products SET barcode = NULL WHERE barcode = ?;').run(clean);
  db.prepare('UPDATE products SET barcode = ?, last_updated = ? WHERE id = ?;').run(clean, new Date().toISOString(), productId);
  return db.prepare('SELECT * FROM products WHERE id = ?;').get(productId);
}

// Stores Queries
export function getAllStores() {
  const db = getDb();
  // Filter strictly to the 4 official store locations requested: Kuningan, Sudirman, Kwitang, Lebak Bulus
  const rows = db.prepare(`
    SELECT id, wp_id as wpId, name, location_code as locationCode, esb_branch_code as esbBranchCode 
    FROM stores 
    WHERE id IN ('birmas-kuningan', 'birmas-sudirman', 'birmas-kwitang', 'birmas-lebak-bulus')
    ORDER BY name ASC;
  `).all();
  return rows;
}

export function saveStore(store) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO stores (id, wp_id, name, location_code, esb_branch_code)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      wp_id = coalesce(excluded.wp_id, stores.wp_id),
      name = excluded.name,
      location_code = coalesce(excluded.location_code, stores.location_code),
      esb_branch_code = coalesce(excluded.esb_branch_code, stores.esb_branch_code);
  `);
  stmt.run(store.id, store.wpId ?? null, store.name, store.locationCode ?? null, store.esbBranchCode ?? null);
}

export function deleteStore(id) {
  const db = getDb();
  db.prepare('DELETE FROM stores WHERE id = ?;').run(id);
  db.prepare('DELETE FROM store_stocks WHERE store_id = ?;').run(id);
  db.prepare('DELETE FROM audit_scans WHERE store_id = ?;').run(id);
}

// Products Queries
export function getAllProducts() {
  const db = getDb();
  const products = db.prepare(`
    SELECT 
      id, barcode, sku, brand, varian, 
      product_title as productTitle, 
      category,
      sub_category as subCategory,
      default_unit as defaultUnit,
      package_type as packageType, 
      volume, unit_volume as unitVolume, 
      price, wp_status as wpStatus, 
      last_updated as lastUpdated 
    FROM products ORDER BY brand ASC, varian ASC;
  `).all();

  // Attach stockByStore for each product
  const stocks = db.prepare('SELECT store_id, product_id, stock_qty FROM store_stocks;').all();
  const stockMap = {};
  for (const s of stocks) {
    if (!stockMap[s.product_id]) stockMap[s.product_id] = {};
    stockMap[s.product_id][s.store_id] = s.stock_qty;
  }

  return products.map(p => ({
    ...p,
    stockByStore: stockMap[p.id] || {},
    source: 'sqlite_backend',
  }));
}

export function saveProduct(product) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO products (
      id, barcode, sku, brand, varian, product_title, category, sub_category, default_unit, package_type, volume, unit_volume, price, wp_status, last_updated
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      barcode = coalesce(excluded.barcode, products.barcode),
      sku = coalesce(excluded.sku, products.sku),
      brand = excluded.brand,
      varian = excluded.varian,
      product_title = excluded.product_title,
      category = coalesce(excluded.category, products.category),
      sub_category = coalesce(excluded.sub_category, products.sub_category),
      default_unit = coalesce(excluded.default_unit, products.default_unit),
      package_type = excluded.package_type,
      volume = excluded.volume,
      unit_volume = excluded.unit_volume,
      price = excluded.price,
      wp_status = excluded.wp_status,
      last_updated = excluded.last_updated;
  `);

  stmt.run(
    product.id,
    product.barcode || null,
    product.sku || null,
    product.brand,
    product.varian,
    product.productTitle || `${product.brand} ${product.varian}`,
    product.category || null,
    product.subCategory || null,
    product.defaultUnit || null,
    product.packageType || 'Kaleng',
    product.volume ?? 330,
    product.unitVolume || 'ml',
    product.price ?? 0,
    product.wpStatus || 'publish',
    product.lastUpdated || new Date().toISOString()
  );

  // If product has stockByStore map, save each
  if (product.stockByStore) {
    for (const [storeId, qty] of Object.entries(product.stockByStore)) {
      setProductStock(storeId, product.id, qty);
    }
  }
}

export function setProductStock(storeId, productId, qty) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO store_stocks (store_id, product_id, stock_qty, last_synced)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(store_id, product_id) DO UPDATE SET
      stock_qty = excluded.stock_qty,
      last_synced = excluded.last_synced;
  `);
  stmt.run(storeId, productId, Number(qty || 0), new Date().toISOString());
}

// Scans Queries
export function getScansByStore(storeId) {
  const db = getDb();
  return db.prepare(`
    SELECT 
      id, store_id as storeId, barcode, brand, varian, 
      scan_sequence as scanSequence, auditor_name as auditorName, timestamp 
    FROM audit_scans 
    WHERE store_id = ? 
    ORDER BY timestamp DESC;
  `).all(storeId);
}

export function getAllScanLogs() {
  const db = getDb();
  return db.prepare(`
    SELECT 
      id, store_id as storeId, barcode, brand, varian, 
      scan_sequence as scanSequence, auditor_name as auditorName, timestamp 
    FROM audit_scans 
    ORDER BY timestamp DESC;
  `).all();
}

export function saveScan(scan) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO audit_scans (id, store_id, barcode, brand, varian, scan_sequence, auditor_name, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?);
  `);
  stmt.run(
    scan.id || `scan-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    scan.storeId,
    scan.barcode,
    scan.brand || '',
    scan.varian || '',
    scan.scanSequence ?? 1,
    scan.auditorName || 'Auditor',
    scan.timestamp || new Date().toISOString()
  );
}

export function clearScansByStore(storeId) {
  const db = getDb();
  db.prepare('DELETE FROM audit_scans WHERE store_id = ?;').run(storeId);
}

// Audit History Queries
export function getAllAuditHistory() {
  const db = getDb();
  const rows = db.prepare(`
    SELECT 
      id, store_id as storeId, store_name as storeName, auditor_name as auditorName,
      timestamp, completed_at as completedAt, total_items as totalItems,
      variance_count as varianceCount, accuracy, records_json as recordsJson
    FROM audit_history 
    ORDER BY timestamp DESC;
  `).all();

  return rows.map(r => ({
    id: r.id,
    storeId: r.storeId,
    storeName: r.storeName,
    auditorName: r.auditorName,
    timestamp: r.timestamp,
    completedAt: r.completedAt,
    totalItems: r.totalItems,
    varianceCount: r.varianceCount,
    accuracy: r.accuracy,
    records: r.recordsJson ? JSON.parse(r.recordsJson) : [],
  }));
}

export function saveAuditHistoryRecord(record) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO audit_history (
      id, store_id, store_name, auditor_name, timestamp, completed_at, total_items, variance_count, accuracy, records_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      total_items = excluded.total_items,
      variance_count = excluded.variance_count,
      accuracy = excluded.accuracy,
      records_json = excluded.records_json;
  `);

  stmt.run(
    record.id || `audit-${Date.now()}`,
    record.storeId || '',
    record.storeName || '',
    record.auditorName || '',
    record.timestamp || new Date().toISOString(),
    record.completedAt || new Date().toISOString(),
    record.totalItems ?? 0,
    record.varianceCount ?? 0,
    record.accuracy ?? 100,
    JSON.stringify(record.records || [])
  );
}

// Users Queries
export function getAllUsers() {
  const db = getDb();
  return db.prepare('SELECT id, username, email, name, role FROM users;').all();
}

export function getUserByUsername(username) {
  const db = getDb();
  return db.prepare('SELECT * FROM users WHERE username = ?;').get(username);
}

// App Config Queries
export function getConfig(key, defaultValue = '') {
  const db = getDb();
  const row = db.prepare('SELECT value FROM app_config WHERE key = ?;').get(key);
  return row ? row.value : defaultValue;
}

export function setConfig(key, value) {
  const db = getDb();
  db.prepare('INSERT OR REPLACE INTO app_config (key, value) VALUES (?, ?);').run(key, String(value));
}

export function getWpConfig() {
  return {
    wpUrl: getConfig('wp_url', 'https://admin.birmas.id'),
    apiType: 'pods',
    customEndpointPath: getConfig('custom_endpoint_path', '/wp-json/api/v1/product_stocks?per_page=100'),
    consumerKey: '',
    consumerSecret: '',
    isConnected: getConfig('is_connected', 'true') === 'true',
    lastSyncedAt: getConfig('last_synced_at', new Date().toISOString()),
    selectedStoreId: getConfig('selected_store_id', ''),
    autoSyncIntervalSeconds: parseInt(getConfig('auto_sync_interval_seconds', '30'), 10),
  };
}
