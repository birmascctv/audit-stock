import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const DB_FILE = path.join(__dirname, 'data', 'audit_store.json');

// Default Stores (Birmas Kuningan, Kwitang, Lebak Bulus, Sudirman)
const DEFAULT_STORES = [
  {
    id: 'birmas-kuningan',
    name: 'Birmas Kuningan',
    locationCode: 'BRM-KNG',
    esbBranchCode: 'ESB_KNG',
  },
  {
    id: 'birmas-kwitang',
    name: 'Birmas Kwitang',
    locationCode: 'BRM-KWT',
    esbBranchCode: 'ESB_KWT',
  },
  {
    id: 'birmas-lebak-bulus',
    name: 'Birmas Lebak Bulus',
    locationCode: 'BRM-LBB',
    esbBranchCode: 'ESB_LBB',
  },
  {
    id: 'birmas-sudirman',
    name: 'Birmas Sudirman',
    locationCode: 'BRM-SDR',
    esbBranchCode: 'ESB_SDR',
  },
];

// Default Products & Barcodes (Synchronized with WordPress Pods & ESB)
const DEFAULT_WP_PRODUCTS = [
  {
    id: 'wp-101',
    barcode: '8997026800122',
    sku: 'KULT-LYC-24',
    brand: 'Kulturale',
    varian: 'Lychee',
    productTitle: 'Kulturale Lychee Kaleng 330ml',
    packageType: 'Kaleng',
    volume: 330,
    unitVolume: 'ml',
    price: 35000,
    stockByStore: {
      'birmas-kuningan': 24,
      'birmas-kwitang': 24,
      'birmas-lebak-bulus': 20,
      'birmas-sudirman': 24,
    },
    wpStatus: 'publish',
    lastUpdated: new Date().toISOString(),
    source: 'wordpress',
  },
  {
    id: 'wp-102',
    barcode: '8997026800030',
    sku: 'KULT-MNG-24',
    brand: 'Kulturale',
    varian: 'Mango',
    productTitle: 'Kulturale Mango Kaleng 330ml',
    packageType: 'Kaleng',
    volume: 330,
    unitVolume: 'ml',
    price: 35000,
    stockByStore: {
      'birmas-kuningan': 24,
      'birmas-kwitang': 18,
      'birmas-lebak-bulus': 24,
      'birmas-sudirman': 20,
    },
    wpStatus: 'publish',
    lastUpdated: new Date().toISOString(),
    source: 'wordpress',
  },
  {
    id: 'wp-103',
    barcode: '8997026800078',
    sku: 'KULT-APL-24',
    brand: 'Kulturale',
    varian: 'Apple',
    productTitle: 'Kulturale Apple Kaleng 330ml',
    packageType: 'Kaleng',
    volume: 330,
    unitVolume: 'ml',
    price: 35000,
    stockByStore: {
      'birmas-kuningan': 24,
      'birmas-kwitang': 24,
      'birmas-lebak-bulus': 24,
      'birmas-sudirman': 24,
    },
    wpStatus: 'publish',
    lastUpdated: new Date().toISOString(),
    source: 'wordpress',
  },
  {
    id: 'wp-104',
    barcode: '8997026800016',
    sku: 'KULT-ORI-24',
    brand: 'Kulturale',
    varian: 'Original',
    productTitle: 'Kulturale Original Kaleng 330ml',
    packageType: 'Kaleng',
    volume: 330,
    unitVolume: 'ml',
    price: 35000,
    stockByStore: {
      'birmas-kuningan': 24,
      'birmas-kwitang': 22,
      'birmas-lebak-bulus': 24,
      'birmas-sudirman': 24,
    },
    wpStatus: 'publish',
    lastUpdated: new Date().toISOString(),
    source: 'wordpress',
  },
  {
    id: 'wp-105',
    barcode: '8993156000074',
    sku: 'ALB-STO-20',
    brand: 'Albens',
    varian: 'LL Stout',
    productTitle: 'Albens LL Stout Kaleng 330ml',
    packageType: 'Kaleng',
    volume: 330,
    unitVolume: 'ml',
    price: 45000,
    stockByStore: {
      'birmas-kuningan': 20,
      'birmas-kwitang': 20,
      'birmas-lebak-bulus': 16,
      'birmas-sudirman': 20,
    },
    wpStatus: 'publish',
    lastUpdated: new Date().toISOString(),
    source: 'wordpress',
  },
  {
    id: 'wp-106',
    barcode: '8993156668267',
    sku: 'ALB-AMA-20',
    brand: 'Albens',
    varian: 'Amarillo',
    productTitle: 'Albens Amarillo Kaleng 330ml',
    packageType: 'Kaleng',
    volume: 330,
    unitVolume: 'ml',
    price: 45000,
    stockByStore: {
      'birmas-kuningan': 20,
      'birmas-kwitang': 20,
      'birmas-lebak-bulus': 20,
      'birmas-sudirman': 18,
    },
    wpStatus: 'publish',
    lastUpdated: new Date().toISOString(),
    source: 'wordpress',
  },
  {
    id: 'wp-107',
    barcode: '8993156668229',
    sku: 'ALB-NAG-20',
    brand: 'Albens',
    varian: 'Naganini',
    productTitle: 'Albens Naganini Kaleng 330ml',
    packageType: 'Kaleng',
    volume: 330,
    unitVolume: 'ml',
    price: 45000,
    stockByStore: {
      'birmas-kuningan': 20,
      'birmas-kwitang': 19,
      'birmas-lebak-bulus': 20,
      'birmas-sudirman': 20,
    },
    wpStatus: 'publish',
    lastUpdated: new Date().toISOString(),
    source: 'wordpress',
  },
  {
    id: 'wp-12880',
    barcode: '5000213007624',
    sku: 'GUI-CAN-440',
    brand: 'Guinness',
    varian: 'Draught In Can',
    productTitle: 'Guinness Draught In Can 440ml',
    packageType: 'Kaleng',
    volume: 440,
    unitVolume: 'ml',
    price: 58000,
    stockByStore: {
      'birmas-kuningan': 24,
      'birmas-kwitang': 24,
      'birmas-lebak-bulus': 18,
      'birmas-sudirman': 24,
    },
    wpStatus: 'publish',
    lastUpdated: new Date().toISOString(),
    source: 'wordpress',
  },
  {
    id: 'wp-12877',
    barcode: '8801048951112',
    sku: 'CHAM-LYC-360',
    brand: 'Cham Joeun',
    varian: 'Lychee',
    productTitle: 'Cham Joeun Lychee Botol 360ml',
    packageType: 'Botol',
    volume: 360,
    unitVolume: 'ml',
    price: 104000,
    stockByStore: {
      'birmas-kuningan': 12,
      'birmas-kwitang': 12,
      'birmas-lebak-bulus': 12,
      'birmas-sudirman': 12,
    },
    wpStatus: 'publish',
    lastUpdated: new Date().toISOString(),
    source: 'wordpress',
  },
  {
    id: 'wp-12882',
    barcode: '8998888001011',
    sku: 'OT-AO-620',
    brand: 'Orang Tua',
    varian: 'AO',
    productTitle: 'Orang Tua AO Botol 620ml',
    packageType: 'Botol',
    volume: 620,
    unitVolume: 'ml',
    price: 65000,
    stockByStore: {
      'birmas-kuningan': 15,
      'birmas-kwitang': 15,
      'birmas-lebak-bulus': 10,
      'birmas-sudirman': 15,
    },
    wpStatus: 'publish',
    lastUpdated: new Date().toISOString(),
    source: 'wordpress',
  },
];

const DEFAULT_WP_CONFIG = {
  wpUrl: 'https://demo-store.local',
  apiType: 'woocommerce',
  customEndpointPath: '/wp-json/birmas/v1/chiller-stocks',
  consumerKey: '',
  consumerSecret: '',
  isConnected: true,
  lastSyncedAt: new Date().toISOString(),
  selectedStoreId: 'birmas-kuningan',
  autoSyncIntervalSeconds: 30,
};

const DEFAULT_USERS = [
  {
    id: 'user-admin',
    username: 'admin',
    email: 'admin@birmas.id',
    password: 'admin123',
    name: 'Bertha Evania',
    role: 'Audit Supervisor',
  },
  {
    id: 'user-auditor',
    username: 'auditor',
    email: 'auditor@birmas.id',
    password: 'birmas2026',
    name: 'Store Auditor Staff',
    role: 'Store Auditor',
  },
];

function ensureDataDirectory() {
  const dir = path.dirname(DB_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function loadDatabase() {
  ensureDataDirectory();
  if (!fs.existsSync(DB_FILE)) {
    const initialDb = {
      stores: DEFAULT_STORES,
      wpConfig: DEFAULT_WP_CONFIG,
      products: DEFAULT_WP_PRODUCTS,
      auditState: {
        'birmas-kuningan': { counts: {}, scanLogs: [] },
        'birmas-kwitang': { counts: {}, scanLogs: [] },
        'birmas-lebak-bulus': { counts: {}, scanLogs: [] },
        'birmas-sudirman': { counts: {}, scanLogs: [] },
      },
      auditHistory: [],
      users: DEFAULT_USERS,
      lastSaved: new Date().toISOString(),
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialDb, null, 2), 'utf-8');
    return initialDb;
  }

  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!parsed.stores || parsed.stores.length === 0) parsed.stores = DEFAULT_STORES;
    if (!parsed.products || parsed.products.length === 0) parsed.products = DEFAULT_WP_PRODUCTS;
    if (!parsed.wpConfig) parsed.wpConfig = DEFAULT_WP_CONFIG;
    if (!parsed.auditState) parsed.auditState = {};
    if (!parsed.auditHistory) parsed.auditHistory = [];
    if (!parsed.users || parsed.users.length === 0) parsed.users = DEFAULT_USERS;
    return parsed;
  } catch (err) {
    console.error('Error reading DB_FILE, rebuilding defaults:', err);
    return {
      stores: DEFAULT_STORES,
      wpConfig: DEFAULT_WP_CONFIG,
      products: DEFAULT_WP_PRODUCTS,
      auditState: {},
      auditHistory: [],
      users: DEFAULT_USERS,
      lastSaved: new Date().toISOString(),
    };
  }
}

function saveDatabase(db) {
  try {
    ensureDataDirectory();
    db.lastSaved = new Date().toISOString();
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save to DB_FILE:', err);
  }
}

// Background sync runner
async function runBackgroundWordPressSync(db) {
  const url = db.wpConfig?.wpUrl;
  if (!url || url.includes('demo-store.local')) return;

  const endpoint = `${url.replace(/\/$/, '')}${db.wpConfig.customEndpointPath || '/wp-json/birmas/v1/chiller-stocks'}`;
  try {
    const response = await fetch(endpoint, {
      headers: {
        'Accept': 'application/json',
        ...(db.wpConfig.appPassword ? { 'Authorization': `Basic ${Buffer.from(db.wpConfig.appPassword).toString('base64')}` } : {}),
      },
    });

    if (response.ok) {
      const json = await response.json();
      const rawItems = Array.isArray(json)
        ? json
        : Array.isArray(json.products)
        ? json.products
        : Array.isArray(json.data)
        ? json.data
        : [];

      if (rawItems.length > 0) {
        let updatedCount = 0;
        for (const item of rawItems) {
          // Helper to extract string or value from Pods field
          const extractField = (f) => {
            if (f === null || f === undefined) return '';
            if (Array.isArray(f) && f.length > 0) return extractField(f[0]);
            if (typeof f === 'object') return (f.value ?? f.rendered ?? f.post_title ?? f.name ?? f.slug ?? '').toString();
            return f.toString();
          };

          // 1. Resolve Location from Pods (supports location array with post_title, post_name, branch_code_esb, outlet_code)
          let locationRaw = '';
          if (Array.isArray(item.location) && item.location.length > 0) {
            const locObj = item.location[0];
            locationRaw = `${locObj.post_title || ''} ${locObj.post_name || ''} ${locObj.branch_code_esb || ''} ${locObj.outlet_code || ''}`.toLowerCase();
          } else {
            locationRaw = extractField(item.location || item.meta?.location || item.branch).toLowerCase();
          }

          // Match store location
          let targetStore = db.stores.find((s) => {
            const sName = s.name.toLowerCase();
            const sId = s.id.toLowerCase();
            const sCode = s.locationCode.toLowerCase();
            const sEsb = (s.esbBranchCode || '').toLowerCase();
            return (
              locationRaw.includes(sName) ||
              locationRaw.includes(sId) ||
              (sCode && locationRaw.includes(sCode)) ||
              (sEsb && locationRaw.includes(sEsb))
            );
          });

          // Auto-create store if location object exists but not matched yet
          if (!targetStore && Array.isArray(item.location) && item.location.length > 0) {
            const locObj = item.location[0];
            const newStoreId = `birmas-${(locObj.post_name || locObj.post_title || 'branch').toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
            targetStore = {
              id: newStoreId,
              name: locObj.post_title || 'Birmas Branch',
              locationCode: locObj.outlet_code ? `BRM-${locObj.outlet_code.toUpperCase()}` : `BRM-${newStoreId.substring(7, 10).toUpperCase()}`,
              esbBranchCode: locObj.branch_code_esb || '',
            };
            db.stores.push(targetStore);
            if (!db.auditState[newStoreId]) {
              db.auditState[newStoreId] = { counts: {}, scanLogs: [] };
            }
          }

          const storeId = targetStore ? targetStore.id : (db.wpConfig.selectedStoreId || db.stores[0]?.id || 'birmas-kuningan');

          // 2. Resolve Variant & Product Details
          let variantObj = null;
          let productObj = null;
          if (Array.isArray(item.product_variant) && item.product_variant.length > 0) {
            variantObj = item.product_variant[0];
            if (Array.isArray(variantObj.product) && variantObj.product.length > 0) {
              productObj = variantObj.product[0];
            }
          }

          const variantId = variantObj?.ID ? `wp-${variantObj.ID}` : (item.id ? `wp-${item.id}` : '');
          const productTitle = productObj?.post_title || extractField(item.product_variant_title) || extractField(item.variant_title) || extractField(item.title) || 'Birmas Product';
          const variantName = variantObj?.variant || extractField(item.variant) || 'Standard';
          const barcode = extractField(item.barcode || variantObj?.barcode || item.meta?.barcode || item.code).trim();
          const sku = extractField(item.sku || variantObj?.sku || item.meta?.sku).trim();
          const brand = productTitle.split(' ')[0] || extractField(item.brand) || 'Birmas';
          const price = Number(variantObj?.regular_price ?? item.regular_price ?? item.price ?? 0);
          const volume = Number(variantObj?.volume ?? item.volume ?? 330);
          const unitVolume = variantObj?.unit_volume ?? item.unit_volume ?? 'ml';

          // 3. Resolve Stock
          let stockVal = 0;
          if (typeof item.stock === 'object' && item.stock !== null) {
            stockVal = Number(item.stock.value ?? item.stock.rendered ?? 0);
          } else {
            stockVal = Number(item.stock ?? item.stock_qty ?? item.quantity ?? item.qty ?? item.meta?.stock ?? 0);
          }

          // 4. Find existing product by ID, barcode, SKU, or Title
          let existing = null;
          if (variantId) {
            existing = db.products.find((p) => p.id === variantId);
          }
          if (!existing && barcode) {
            existing = db.products.find((p) => p.barcode === barcode);
          }
          if (!existing && sku) {
            existing = db.products.find((p) => p.sku === sku);
          }
          if (!existing && productTitle) {
            const tLower = productTitle.toLowerCase();
            existing = db.products.find((p) =>
              p.productTitle.toLowerCase() === tLower ||
              tLower.includes(p.varian.toLowerCase()) ||
              p.productTitle.toLowerCase().includes(tLower)
            );
          }

          if (existing) {
            if (!existing.stockByStore) existing.stockByStore = {};
            existing.stockByStore[storeId] = stockVal;
            if (barcode && !existing.barcode) existing.barcode = barcode;
            if (sku && !existing.sku) existing.sku = sku;
            if (price && !existing.price) existing.price = price;
            existing.lastUpdated = new Date().toISOString();
            updatedCount++;
          } else if (productTitle || barcode) {
            // Auto-create new product from Pods
            const newProd = {
              id: variantId || `wp-${item.id || Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
              barcode: barcode || `BC-${Date.now().toString().slice(-6)}`,
              sku: sku || `SKU-${Date.now().toString().slice(-4)}`,
              brand: brand,
              varian: variantName !== 'Standard' ? variantName : productTitle,
              productTitle: productTitle,
              packageType: variantObj?.variant || 'Kaleng',
              volume: volume,
              unitVolume: unitVolume,
              price: price,
              stockByStore: {
                [storeId]: stockVal,
              },
              wpStatus: 'publish',
              lastUpdated: new Date().toISOString(),
              source: 'wordpress_pods',
            };
            db.products.push(newProd);
            updatedCount++;
          }
        }

        db.wpConfig.lastSyncedAt = new Date().toISOString();
        saveDatabase(db);
        console.log(`[WordPress Pods Sync] Successfully synced/updated ${updatedCount} stock items from WordPress Pods`);
      }
    }
  } catch (err) {
    console.warn('[Auto-Sync Checker] Periodic sync note:', err.message);
  }
}

async function startServer() {
  const app = express();
  app.use(express.json());

  const db = loadDatabase();

  // Background Auto-Checker (runs every 30 seconds)
  setInterval(() => {
    runBackgroundWordPressSync(db);
  }, 30000);

  // 1. Stores API
  app.get('/api/stores', (req, res) => {
    res.json(db.stores);
  });

  app.post('/api/stores', (req, res) => {
    const { name, locationCode, esbBranchCode } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Store name is required' });
    }
    const id = req.body.id || `birmas-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    const newStore = {
      id,
      name,
      locationCode: locationCode || `BRM-${id.substring(7, 10).toUpperCase()}`,
      esbBranchCode: esbBranchCode || `ESB_${id.substring(7, 10).toUpperCase()}`,
    };
    db.stores.push(newStore);
    if (!db.auditState[id]) {
      db.auditState[id] = { counts: {}, scanLogs: [] };
    }
    saveDatabase(db);
    res.json({ success: true, store: newStore, stores: db.stores });
  });

  app.delete('/api/stores/:id', (req, res) => {
    const { id } = req.params;
    db.stores = db.stores.filter((s) => s.id !== id);
    saveDatabase(db);
    res.json({ success: true, stores: db.stores });
  });

  // 2. Products API
  app.get('/api/products', (req, res) => {
    res.json(db.products);
  });

  // 3. Add or match new barcode
  app.post('/api/products/match-barcode', (req, res) => {
    const payload = req.body;
    if (!payload.barcode || !payload.brand || !payload.varian) {
      return res.status(400).json({ error: 'Barcode, Brand, and Varian are required' });
    }

    const cleanBarcode = payload.barcode.trim();
    const existingIndex = db.products.findIndex((p) => p.barcode === cleanBarcode);

    const productItem = {
      id: payload.wpId || `wp-${Date.now()}`,
      barcode: cleanBarcode,
      sku: payload.sku || `SKU-${payload.brand.toUpperCase()}-${Date.now().toString().slice(-4)}`,
      brand: payload.brand,
      varian: payload.varian,
      productTitle: payload.productTitle || `${payload.brand} ${payload.varian}`,
      packageType: payload.packageType || 'Kaleng',
      volume: payload.volume || 330,
      unitVolume: payload.unitVolume || 'ml',
      price: payload.price || 0,
      stockByStore: payload.stockByStore || {
        'birmas-kuningan': 0,
        'birmas-kwitang': 0,
        'birmas-lebak-bulus': 0,
        'birmas-sudirman': 0,
      },
      wpStatus: 'publish',
      lastUpdated: new Date().toISOString(),
      source: payload.wpId ? 'wordpress' : 'manual',
    };

    if (existingIndex >= 0) {
      db.products[existingIndex] = productItem;
    } else {
      db.products.push(productItem);
    }

    saveDatabase(db);
    res.json({
      success: true,
      message: `Barcode ${cleanBarcode} saved successfully for ${productItem.brand} ${productItem.varian}`,
      product: productItem,
    });
  });

  app.delete('/api/products/match-barcode/:barcode', (req, res) => {
    const { barcode } = req.params;
    db.products = db.products.filter((p) => p.barcode !== barcode);
    saveDatabase(db);
    res.json({ success: true, message: `Barcode ${barcode} removed` });
  });

  // 4. Audit State per store
  app.get('/api/audit/state', (req, res) => {
    const storeId = (req.query.storeId) || 'birmas-kuningan';
    if (!db.auditState[storeId]) {
      db.auditState[storeId] = { counts: {}, scanLogs: [] };
      saveDatabase(db);
    }
    const state = db.auditState[storeId];
    res.json({
      storeId,
      counts: state.counts,
      scanLogs: state.scanLogs,
      totalScans: Object.values(state.counts).reduce((a, b) => a + b, 0),
    });
  });

  // 5. Send physical scan
  app.post('/api/audit/scan', (req, res) => {
    const { barcode, storeId = 'birmas-kuningan', auditorName = 'Auditor' } = req.body;
    if (!barcode) {
      return res.status(400).json({ error: 'Barcode is required' });
    }

    const clean = barcode.trim();
    const product = db.products.find((p) => p.barcode === clean);

    if (!db.auditState[storeId]) {
      db.auditState[storeId] = { counts: {}, scanLogs: [] };
    }

    if (!product) {
      return res.status(404).json({
        success: false,
        message: `Barcode ${clean} is not registered in the database.`,
        unknownBarcode: clean,
      });
    }

    const currentCount = db.auditState[storeId].counts[clean] || 0;
    const newCount = currentCount + 1;
    db.auditState[storeId].counts[clean] = newCount;

    const scanEvent = {
      id: `scan-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      barcode: clean,
      brand: product.brand,
      varian: product.varian,
      scanSequence: newCount,
      storeId,
      auditorName,
    };
    db.auditState[storeId].scanLogs.unshift(scanEvent);

    saveDatabase(db);

    const wpExpected = (product.stockByStore && product.stockByStore[storeId]) ?? 0;
    const discrepancy = newCount - wpExpected;

    res.json({
      success: true,
      message: `${product.brand} ${product.varian} counted (${newCount}/${wpExpected})`,
      product,
      scannedCount: newCount,
      wpExpected,
      discrepancy,
      status: discrepancy === 0 ? 'matched' : discrepancy < 0 ? 'missing' : 'surplus',
      scanEvent,
    });
  });

  // 6. Manual Adjust Count
  app.post('/api/audit/adjust', (req, res) => {
    const { barcode, storeId = 'birmas-kuningan', count, delta } = req.body;
    if (!barcode) return res.status(400).json({ error: 'Barcode required' });

    if (!db.auditState[storeId]) {
      db.auditState[storeId] = { counts: {}, scanLogs: [] };
    }

    const current = db.auditState[storeId].counts[barcode] || 0;
    let nextCount = current;
    if (typeof count === 'number') {
      nextCount = Math.max(0, count);
    } else if (typeof delta === 'number') {
      nextCount = Math.max(0, current + delta);
    }

    db.auditState[storeId].counts[barcode] = nextCount;
    saveDatabase(db);
    res.json({ success: true, count: nextCount });
  });

  // 7. Reset audit for store
  app.post('/api/audit/reset', (req, res) => {
    const { storeId = 'birmas-kuningan' } = req.body;
    db.auditState[storeId] = { counts: {}, scanLogs: [] };
    saveDatabase(db);
    res.json({ success: true, message: `Physical count reset for ${storeId}` });
  });

  // 8. Finalize Audit
  app.post('/api/audit/finalize', (req, res) => {
    const audit = req.body;
    if (!audit.storeId) return res.status(400).json({ error: 'Store ID required' });

    const auditRecord = {
      id: audit.id || `audit-${Date.now()}`,
      storeId: audit.storeId,
      storeName: audit.storeName || 'Birmas Store',
      auditorName: audit.auditorName || 'Auditor',
      startedAt: audit.startedAt || new Date().toISOString(),
      completedAt: new Date().toISOString(),
      totalExpected: audit.totalExpected || 0,
      totalScanned: audit.totalScanned || 0,
      matchedCount: audit.matchedCount || 0,
      missingCount: audit.missingCount || 0,
      surplusCount: audit.surplusCount || 0,
      items: audit.items || [],
      pushedToWordPress: Boolean(audit.pushedToWordPress),
      notes: audit.notes || '',
    };

    db.auditHistory.unshift(auditRecord);

    if (audit.pushedToWordPress && audit.items) {
      audit.items.forEach((item) => {
        const prod = db.products.find((p) => p.barcode === item.barcode);
        if (prod && prod.stockByStore) {
          prod.stockByStore[audit.storeId] = item.scannedCount;
        }
      });
    }

    db.auditState[audit.storeId] = { counts: {}, scanLogs: [] };
    saveDatabase(db);

    res.json({
      success: true,
      message: 'Audit signed off and persisted',
      audit: auditRecord,
    });
  });

  // 9. Audit History
  app.get('/api/audit/history', (req, res) => {
    res.json(db.auditHistory);
  });

  app.delete('/api/audit/history', (req, res) => {
    db.auditHistory = [];
    saveDatabase(db);
    res.json({ success: true, message: 'Audit history cleared' });
  });

  // 10. WordPress / ESB Config
  app.get('/api/wordpress/config', (req, res) => {
    res.json(db.wpConfig);
  });

  app.post('/api/wordpress/config', (req, res) => {
    db.wpConfig = { ...db.wpConfig, ...req.body };
    saveDatabase(db);
    res.json({ success: true, config: db.wpConfig });
  });

  // 11. Sync WordPress data
  app.post('/api/wordpress/sync', async (req, res) => {
    try {
      if (req.body && Object.keys(req.body).length > 0) {
        db.wpConfig = { ...db.wpConfig, ...req.body };
      }
      await runBackgroundWordPressSync(db);
      res.json({
        success: true,
        message: 'Synchronized with WordPress Pods & ESB',
        data: db.products,
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // 12. Instant Webhook from ESB / WordPress
  app.post('/api/esb/webhook', (req, res) => {
    const { location, variant_title, stock } = req.body;
    console.log('[ESB Webhook Received]:', req.body);

    if (variant_title) {
      const locKey = (location || '').toLowerCase();
      const targetStore = db.stores.find((s) => s.id === locKey || s.locationCode.toLowerCase() === locKey || s.name.toLowerCase().includes(locKey));
      const storeId = targetStore ? targetStore.id : 'birmas-kuningan';

      const existing = db.products.find((p) => p.varian.toLowerCase() === variant_title.toLowerCase() || p.productTitle === variant_title);
      if (existing) {
        existing.stockByStore[storeId] = Number(stock) || 0;
        existing.lastUpdated = new Date().toISOString();
        saveDatabase(db);
      }
    }

    res.json({ success: true, receivedAt: new Date().toISOString() });
  });

  // 13. Auth endpoints
  app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password required' });
    }

    const cleanUser = username.trim().toLowerCase();
    const user = db.users.find((u) => u.username.toLowerCase() === cleanUser || u.email.toLowerCase() === cleanUser);

    if (!user || user.password !== password) {
      return res.status(401).json({ success: false, message: 'Invalid username or password' });
    }

    const safeUser = { id: user.id, username: user.username, name: user.name, email: user.email, role: user.role };
    res.json({ success: true, message: `Welcome back, ${user.name}`, user: safeUser });
  });

  // 14. Database health & system status
  app.get('/api/database/status', (req, res) => {
    const stats = fs.existsSync(DB_FILE) ? fs.statSync(DB_FILE) : null;
    res.json({
      status: 'healthy',
      dbFile: DB_FILE,
      fileSizeKB: stats ? Math.round(stats.size / 1024) : 0,
      totalProducts: db.products.length,
      totalStores: db.stores.length,
      totalAuditsArchived: db.auditHistory.length,
      lastSaved: db.lastSaved,
      autoSyncEnabled: true,
      autoSyncIntervalSeconds: 30,
    });
  });

  // Vite Dev Middlewares or Production Static Serving
  const isProduction = process.env.NODE_ENV === 'production';
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Birmas Server] Running at http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
