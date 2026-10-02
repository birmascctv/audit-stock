import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import * as db from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

let isEsbSyncing = false;

// Direct ESB Live Sync: Connects straight to ESB POS Cloud to fetch real store stock per branch
export async function runDirectESBSync() {
  if (isEsbSyncing) {
    console.log('[Direct ESB Sync] Sync already in progress, skipping.');
    return { success: false, message: 'Already syncing' };
  }
  isEsbSyncing = true;
  try {
    const token = process.env.ESB_BEARER_TOKEN || 'enAYShLVFFtWqFPmcd5nwkuJFmeVC5cG3pgwgShNpmmpRLzEPeRabbvG8zdm';
    const baseUrl = (process.env.ESB_BASE_URL || 'https://stg7.esb.co.id/api-fnb-backend-int/web').replace(/\/$/, '');
    const defaultVp = process.env.ESB_VISIT_PURPOSE_ID || '2';

    console.log(`[Direct ESB Sync] Connecting to ${baseUrl} ...`);
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 BirmasAudit/2.0',
    };

    // 1. Fetch live branches from ESB
    let branches = [];
    try {
      const res = await fetch(`${baseUrl}/extv1/branch`, { headers, signal: AbortSignal.timeout(15000) });
      if (res.ok) {
        branches = await res.json();
      }
    } catch (err) {
      console.warn('[Direct ESB Sync] Failed to fetch branches from ESB, using active branch list:', err.message);
    }

    if (!Array.isArray(branches) || branches.length === 0) {
      branches = [
        { branchCode: 'OUTS', branchName: 'Outlet Sudirman' },
        { branchCode: 'BRMT', branchName: 'Tebet' },
        { branchCode: 'BRMK', branchName: 'Kuningan' },
        { branchCode: 'BRMKG', branchName: 'Kelapa Gading' },
        { branchCode: 'BRMLB', branchName: 'Lebak Bulus' },
        { branchCode: 'BRMKW', branchName: 'Kwitang' },
        { branchCode: 'BBND', branchName: 'Bali Nusa Dua' },
      ];
    }

    const birmasBranchCodes = ['OUTS', 'BRMS', 'BRMT', 'BRMK', 'BRMKG', 'BRMLB', 'BRMKW', 'BBND', 'LR00'];
    const filteredBranches = branches.filter((b) =>
      birmasBranchCodes.includes(b.branchCode) ||
      b.branchName?.toLowerCase().includes('birmas') ||
      b.branchName?.toLowerCase().includes('sudirman')
    );
    const targetBranches = filteredBranches.length > 0 ? filteredBranches : [branches.find((b) => b.branchCode === 'OUTS') || branches[0]];

    console.log(`[Direct ESB Sync] Syncing ${targetBranches.length} Birmas branches in SQLite...`);
    const branchMap = new Map();
    for (const b of targetBranches) {
      const storeId = `birmas-${b.branchCode.toLowerCase()}`;
      db.saveStore({
        id: storeId,
        wpId: null,
        name: b.branchName ? (b.branchName.startsWith('Birmas') ? b.branchName : `Birmas ${b.branchName}`) : `Birmas ${b.branchCode}`,
        locationCode: b.branchCode,
        esbBranchCode: b.branchCode,
      });
      branchMap.set(b.branchCode, storeId);
    }

    // Preserve existing mapped barcodes in SQLite
    const existingProducts = db.getAllProducts();
    const barcodeMap = new Map();
    for (const p of existingProducts) {
      if (p.barcode) {
        barcodeMap.set(p.id, p.barcode);
        if (p.brand && p.varian) {
          const key = `${p.brand.toLowerCase()}-${p.varian.toLowerCase()}`;
          barcodeMap.set(key, p.barcode);
        }
      }
    }

    const productCatalog = new Map();
    let totalStockEntries = 0;

    // Helper to normalize ESB item titles and extract volume
    function normalizeMenu(rawName) {
      let name = (rawName || '').trim();
      name = name.replace(/^(\(\s*\d+\+\s*\)|\[\s*\d+\+\s*\])\s*/i, '');
      name = name.replace(/^\[[A-Za-z0-9_-]+\]\s*/, '');

      let volume = 330;
      const volMatch = name.match(/(\d+(?:\.\d+)?)\s*(ml|l|cl)/i);
      if (volMatch) {
        const val = parseFloat(volMatch[1]);
        const unit = volMatch[2].toLowerCase();
        volume = unit === 'l' ? val * 1000 : unit === 'cl' ? val * 10 : val;
      }

      let packageType = 'Botol';
      if (name.toLowerCase().includes('can') || name.toLowerCase().includes('kaleng')) {
        packageType = 'Kaleng';
      }

      const knownBrands = ['Bintang', 'Anker', 'Iceland', 'Albens', 'Orang Tua', 'Kulturale', 'Guinness', 'Prost', 'Siren', 'Vibe', 'Palapa', 'Red Bull', 'Kawa Kawa', 'Intisari', 'Atlas', 'Pu Tao Chee Chiew', 'Royal Brewhouse'];
      let brand = '';
      for (const b of knownBrands) {
        if (new RegExp(`\\b${b}\\b`, 'i').test(name)) {
          brand = b;
          break;
        }
      }
      if (!brand) {
        brand = name.split(/\s+/)[0] || 'Birmas';
        brand = brand.charAt(0).toUpperCase() + brand.slice(1).toLowerCase();
      }

      let varian = name;
      if (varian.toLowerCase().startsWith(brand.toLowerCase())) {
        varian = varian.slice(brand.length).trim();
      }
      if (!varian) varian = 'Standard';

      return { displayName: name, brand, varian, volume, packageType };
    }

    // 2. Fetch menu & stock per branch
    for (const b of branches) {
      try {
        let menuUrl = `${baseUrl}/extv1/menu?branchCode=${encodeURIComponent(b.branchCode)}&visitPurposeID=${defaultVp}`;
        let res = await fetch(menuUrl, { headers, signal: AbortSignal.timeout(20000) });
        if (!res.ok) {
          menuUrl = `${baseUrl}/extv1/menu?branchCode=${encodeURIComponent(b.branchCode)}&visitPurposeID=2`;
          res = await fetch(menuUrl, { headers, signal: AbortSignal.timeout(20000) });
        }
        if (!res.ok) continue;

        const categories = await res.json();
        if (!Array.isArray(categories)) continue;
        const storeId = branchMap.get(b.branchCode);

        for (const cat of categories) {
          for (const detail of (cat.menuCategoryDetails || [])) {
            for (const m of (detail.menus || [])) {
              const menuId = m.menuID;
              const rawName = (m.menuName || m.menuShortName || '').trim();
              if (!rawName) continue;

              const norm = normalizeMenu(rawName);
              const prodId = `esb-${menuId}`;
              const key = `${norm.brand.toLowerCase()}-${norm.varian.toLowerCase()}`;
              const barcode = barcodeMap.get(prodId) || barcodeMap.get(key) || null;
              const price = Number(m.sellPrice ?? m.price ?? 0);
              const qty = Number(m.qty ?? 0);

              if (!productCatalog.has(prodId)) {
                productCatalog.set(prodId, {
                  id: prodId,
                  barcode: barcode,
                  sku: String(m.menuCode || menuId),
                  brand: norm.brand,
                  varian: norm.varian,
                  productTitle: norm.displayName,
                  packageType: norm.packageType,
                  volume: norm.volume,
                  unitVolume: 'ml',
                  price: price,
                  wpStatus: 'publish',
                  lastUpdated: new Date().toISOString(),
                });
              }

              if (storeId) {
                db.setProductStock(storeId, prodId, qty);
                totalStockEntries++;
              }
            }
          }
        }
        console.log(`[Direct ESB Sync] Branch ${b.branchCode} (${b.branchName}) synced.`);
      } catch (err) {
        console.warn(`[Direct ESB Sync] Branch ${b.branchCode} sync error:`, err.message);
      }
    }

    // Save all deduplicated products into SQLite
    for (const prod of productCatalog.values()) {
      db.saveProduct(prod);
    }

    db.setConfig('last_esb_synced_at', new Date().toISOString());
    console.log(`[Direct ESB Sync] Success! Synced ${productCatalog.size} products & ${totalStockEntries} branch stocks.`);
    return {
      success: true,
      totalProducts: productCatalog.size,
      totalStockEntries,
      totalStores: branches.length,
    };
  } finally {
    isEsbSyncing = false;
  }
}

// ==========================================
// MY ESB ERP INVENTORY SYNC ENGINE
// Pulls directly from My ESB ERP (Stock Period List)
// ==========================================
let isErpSyncing = false;

const DEFAULT_ERP_COOKIE = `_csrf-esb-fnb-backend=f78ccb84cefe055a764612525d2f74062e83a7c0a022538d86aa4fae44216c71a%3A2%3A%7Bi%3A0%3Bs%3A21%3A%22_csrf-esb-fnb-backend%22%3Bi%3A1%3Bs%3A32%3A%22L4gJX2eDfoa3DbPJAvw5vRJ89C12jNGn%22%3B%7D; PHPSESSID=t4vll2k1onjef4pmhma58f4bb0; _jwt-token=6610caad01882c9402616a0929ee9dfa964c4e662ad1643bde5be6fd8c0701c3a%3A2%3A%7Bi%3A0%3Bs%3A10%3A%22_jwt-token%22%3Bi%3A1%3Bs%3A373%3A%22eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdXRob3JpemVkIjp0cnVlLCJjb21wYW55Q29kZSI6IkJSTSIsImNvbXBhbnlJRCI6NTk3MSwiY29tcGFueU5hbWUiOiJQVC4gQmlybWFzIE1lcnViYWggUGVyc2Vwc2kiLCJkYk5hbWUiOiJmbmJfYnJtIiwiZXhwIjoxNzkwOTU1MDE0LCJmdWxsTmFtZSI6IlBoaWxsaXAiLCJzZXJ2ZXJDb2RlIjoiZ2xvYmFsMyIsInVzZXJSb2xlSUQiOjEsInVzZXJuYW1lIjoiQlJNUGhpbGxpcCJ9.j1zACEId80wffGXPNaJMGXA9A39dnOjngStrNCEHbVQ%22%3B%7D; _identity=18b2dc04b4c5721f9b9c31dd6309b0068ae32ae914af34d8ade231f4cc8f8542a%3A2%3A%7Bi%3A0%3Bs%3A9%3A%22_identity%22%3Bi%3A1%3Bs%3A28%3A%22%5B%22BRMPhillip%22%2Cnull%2C31104000%5D%22%3B%7D;`;
const DEFAULT_ERP_CSRF = 'YG3zBCat5kSNTL7OxAYsz9Az4Rt7B2fsyYtF8Y3WYCQsWZROfp-DAOsj3_2AZHyFkUWWLg1VLdTwyHTD55gnSg==';

export async function runDirectESBERPSync(options = {}) {
  if (isErpSyncing) {
    return { success: false, message: 'ERP Stock sync is already running in background' };
  }
  isErpSyncing = true;
  try {
    const savedCookie = db.getConfig('esb_erp_cookie');
    const savedCsrf = db.getConfig('esb_erp_csrf');
    const cookie = options.cookie || savedCookie || DEFAULT_ERP_COOKIE;
    const csrf = options.csrf || savedCsrf || DEFAULT_ERP_CSRF;

    if (options.cookie) db.setConfig('esb_erp_cookie', options.cookie);
    if (options.csrf) db.setConfig('esb_erp_csrf', options.csrf);

    const today = new Date().toISOString().split('T')[0];

    // Branch configuration in ESB ERP
    const branches = [
      { branchId: 3, locationId: 5, storeId: 'birmas-kuningan', name: 'BIRMAS KUNINGAN' },
    ];

    // Ensure Kuningan exists in stores table
    const existingStores = db.getAllStores();
    if (!existingStores.some((s) => s.id === 'birmas-kuningan')) {
      db.saveStore({
        id: 'birmas-kuningan',
        name: 'Birmas Kuningan',
        locationCode: 'KUNINGAN',
        esbBranchCode: 'KUNINGAN',
      });
    }

    const existingProducts = db.getAllProducts();
    const barcodeMap = new Map();
    for (const p of existingProducts) {
      if (p.barcode) {
        barcodeMap.set(p.id, p.barcode);
        if (p.productTitle) barcodeMap.set(p.productTitle.toLowerCase().trim(), p.barcode);
      }
    }

    let totalSyncedProducts = 0;
    const sampleItems = [];

    for (const b of branches) {
      for (let page = 1; page <= 15; page++) {
        const url = `https://erp.esb.co.id/stock-period?StockCardForm%5BcategoryTypeID%5D%5B%5D=1&StockCardForm%5BbranchID%5D=${b.branchId}&StockCardForm%5BlocationID%5D%5B%5D=${b.locationId}&StockCardForm%5BstockDate%5D=${today}&_pjax=%23search-pjax&page=${page}`;
        const res = await fetch(url, {
          headers: {
            cookie,
            'x-csrf-token': csrf,
            'x-pjax': 'true',
            'x-pjax-container': '#search-pjax',
            'x-requested-with': 'XMLHttpRequest',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/154.0.0.0',
          },
          signal: AbortSignal.timeout(15000),
        });

        if (!res.ok) {
          console.warn(`[ESB ERP Sync] Page ${page} failed with status ${res.status}`);
          break;
        }

        const html = await res.text();
        const rows = html.match(/<tr[^>]*data-key[^>]*>[\s\S]*?<\/tr>/gi) || [];
        if (rows.length === 0) break;

        for (const r of rows) {
          const cells = [];
          for (const m of r.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)) {
            cells.push(m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim());
          }
          if (cells.length >= 10 && cells[0] !== '#') {
            const idMatch = r.match(/productID%22%3A(\d+)/i) || r.match(/"productID":(\d+)/i);
            const productId = idMatch ? idMatch[1] : `erp-${totalSyncedProducts + 1}`;
            const prodName = cells[3];
            const prodCode = cells[4];
            const category = cells[5];
            const subCategory = cells[6];
            const defaultUnit = cells[7];
            const stockQty = parseFloat(cells[9]?.replace(/\./g, '').replace(',', '.')) || 0;
            const availableQty = parseFloat(cells[11]?.replace(/\./g, '').replace(',', '.')) || 0;
            const price = parseFloat(cells[12]?.replace(/\./g, '').replace(',', '.')) || 0;

            const prodId = `erp-${productId}`;
            const existingBarcode = barcodeMap.get(prodId) || barcodeMap.get(prodName.toLowerCase().trim()) || null;

            let brand = subCategory || 'Birmas';
            let varian = prodName;
            if (varian.toLowerCase().startsWith(brand.toLowerCase())) {
              varian = varian.slice(brand.length).trim();
            }

            db.saveProduct({
              id: prodId,
              barcode: existingBarcode,
              sku: prodCode || `SKU-${productId}`,
              brand: brand,
              varian: varian || prodName,
              productTitle: prodName,
              category: category,
              subCategory: subCategory,
              defaultUnit: defaultUnit,
              packageType: defaultUnit === 'CAN' ? 'Kaleng' : 'Botol',
              volume: prodName.includes('620') ? 620 : 330,
              unitVolume: 'ml',
              price: price,
              wpStatus: 'publish',
              lastUpdated: new Date().toISOString(),
            });

            db.setProductStock(b.storeId, prodId, availableQty);
            totalSyncedProducts++;
            if (sampleItems.length < 5) {
              sampleItems.push({ id: prodId, name: prodName, availableQty });
            }
          }
        }
      }
    }

    db.setConfig('last_esb_erp_synced_at', new Date().toISOString());
    console.log(`[ESB ERP Sync] Success! Synced ${totalSyncedProducts} items from My ESB Stock List.`);
    return {
      success: true,
      totalSyncedProducts,
      sampleItems,
      lastSyncedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error('[ESB ERP Sync] Error:', err);
    return { success: false, message: err.message };
  } finally {
    isErpSyncing = false;
  }
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // Ensure SQLite tables are initialized
  db.getDb();

  // 1. Stores API
  app.get('/api/stores', (req, res) => {
    res.json(db.getAllStores());
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
    db.saveStore(newStore);
    res.json({ success: true, store: newStore, stores: db.getAllStores() });
  });

  app.delete('/api/stores/:id', (req, res) => {
    const { id } = req.params;
    db.deleteStore(id);
    res.json({ success: true, stores: db.getAllStores() });
  });

  // 2. Products API
  app.get('/api/products', (req, res) => {
    res.json(db.getAllProducts());
  });

  // 3. Add or match new barcode
  app.post('/api/products/match-barcode', (req, res) => {
    const payload = req.body;
    if (!payload.barcode) {
      return res.status(400).json({ error: 'Barcode is required' });
    }

    const cleanBarcode = payload.barcode.trim();
    const all = db.getAllProducts();
    const existing = (payload.productId || payload.wpId)
      ? all.find(p => p.id === (payload.productId || payload.wpId))
      : null;

    const productItem = {
      id: existing ? existing.id : (payload.wpId || `prod-${Date.now()}`),
      barcode: cleanBarcode,
      sku: existing?.sku || payload.sku || `SKU-${Date.now().toString().slice(-4)}`,
      brand: existing?.brand || payload.brand || 'Birmas',
      varian: existing?.varian || payload.varian || cleanBarcode,
      productTitle: existing?.productTitle || payload.productTitle || `${existing?.brand || payload.brand || 'Birmas'} ${existing?.varian || payload.varian || cleanBarcode}`,
      packageType: existing?.packageType || payload.packageType || 'Botol',
      volume: existing?.volume || payload.volume || 330,
      unitVolume: existing?.unitVolume || payload.unitVolume || 'ml',
      price: existing?.price !== undefined ? existing.price : (payload.price || 0),
      stockByStore: existing?.stockByStore || payload.stockByStore || {},
      wpStatus: 'publish',
      lastUpdated: new Date().toISOString(),
    };

    db.saveProduct(productItem);

    res.json({
      success: true,
      message: `Barcode ${cleanBarcode} linked successfully to ${productItem.productTitle || productItem.varian}`,
      product: productItem,
    });
  });

  app.delete('/api/products/match-barcode/:barcode', (req, res) => {
    const { barcode } = req.params;
    const all = db.getAllProducts();
    const prod = all.find(p => p.barcode === barcode);
    if (prod) {
      const sqliteDb = db.getDb();
      sqliteDb.prepare('DELETE FROM products WHERE id = ?;').run(prod.id);
      sqliteDb.prepare('DELETE FROM store_stocks WHERE product_id = ?;').run(prod.id);
    }
    res.json({ success: true, message: `Barcode ${barcode} removed from SQLite` });
  });

  // 4. Audit State per store
  app.get('/api/audit/state', (req, res) => {
    const stores = db.getAllStores();
    const storeId = (req.query.storeId) || (stores[0]?.id || 'birmas-sudirman');
    const scans = db.getScansByStore(storeId);
    
    // Calculate counts per barcode
    const counts = {};
    for (const s of scans) {
      counts[s.barcode] = (counts[s.barcode] || 0) + 1;
    }

    res.json({
      storeId,
      counts,
      scanLogs: scans,
      totalScans: scans.length,
    });
  });

  // 5. Send physical scan
  app.post('/api/audit/scan', (req, res) => {
    const stores = db.getAllStores();
    const { barcode, storeId = (stores[0]?.id || 'birmas-sudirman'), auditorName = 'Auditor' } = req.body;
    if (!barcode) {
      return res.status(400).json({ error: 'Barcode is required' });
    }

    const clean = barcode.trim();
    const products = db.getAllProducts();
    const product = products.find((p) => p.barcode === clean);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: `Barcode ${clean} is not registered in the database.`,
        unknownBarcode: clean,
      });
    }

    const scans = db.getScansByStore(storeId);
    const currentCount = scans.filter(s => s.barcode === clean).length;
    const newCount = currentCount + 1;

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

    db.saveScan(scanEvent);

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
    const { barcode, storeId = 'birmas-sudirman', count, delta } = req.body;
    if (!barcode) return res.status(400).json({ error: 'Barcode required' });

    const scans = db.getScansByStore(storeId);
    const barcodeScans = scans.filter(s => s.barcode === barcode);
    const current = barcodeScans.length;
    
    let targetCount = current;
    if (typeof count === 'number') {
      targetCount = Math.max(0, count);
    } else if (typeof delta === 'number') {
      targetCount = Math.max(0, current + delta);
    }

    if (targetCount > current) {
      const diff = targetCount - current;
      const products = db.getAllProducts();
      const product = products.find(p => p.barcode === barcode);
      for (let i = 0; i < diff; i++) {
        db.saveScan({
          storeId,
          barcode,
          brand: product?.brand || '',
          varian: product?.varian || '',
          scanSequence: current + i + 1,
          auditorName: 'Adjusted',
        });
      }
    } else if (targetCount < current) {
      const sqliteDb = db.getDb();
      const toDelete = current - targetCount;
      const scanIdsToDelete = barcodeScans.slice(0, toDelete).map(s => `'${s.id}'`).join(',');
      if (scanIdsToDelete) {
        sqliteDb.exec(`DELETE FROM audit_scans WHERE id IN (${scanIdsToDelete});`);
      }
    }

    res.json({ success: true, count: targetCount });
  });

  // 7. Reset audit for store
  app.post('/api/audit/reset', (req, res) => {
    const stores = db.getAllStores();
    const { storeId = (stores[0]?.id || 'birmas-sudirman') } = req.body;
    db.clearScansByStore(storeId);
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
      timestamp: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      totalItems: audit.totalScanned || 0,
      varianceCount: audit.missingCount || 0,
      accuracy: audit.accuracy || 100,
      records: audit.items || [],
    };

    db.saveAuditHistoryRecord(auditRecord);

    // Update stock in SQLite if pushed
    if (audit.pushedToWordPress && audit.items) {
      const allProducts = db.getAllProducts();
      audit.items.forEach((item) => {
        const prod = allProducts.find((p) => p.barcode === item.barcode);
        if (prod) {
          db.setProductStock(audit.storeId, prod.id, item.scannedCount);
        }
      });
    }

    // Clear active scans for this store
    db.clearScansByStore(audit.storeId);

    res.json({
      success: true,
      message: 'Audit signed off and persisted in SQLite history',
      audit: auditRecord,
    });
  });

  // 9. Audit History
  app.get('/api/audit/history', (req, res) => {
    res.json(db.getAllAuditHistory());
  });

  app.delete('/api/audit/history', (req, res) => {
    const sqliteDb = db.getDb();
    sqliteDb.exec('DELETE FROM audit_history;');
    res.json({ success: true, message: 'Audit history cleared in SQLite' });
  });

  // 10. WordPress / ESB Config
  app.get('/api/wordpress/config', (req, res) => {
    res.json(db.getWpConfig());
  });

  app.post('/api/wordpress/config', (req, res) => {
    if (req.body.wpUrl) db.setConfig('wp_url', req.body.wpUrl);
    if (req.body.customEndpointPath) db.setConfig('custom_endpoint_path', req.body.customEndpointPath);
    if (req.body.selectedStoreId) db.setConfig('selected_store_id', req.body.selectedStoreId);
    res.json({ success: true, config: db.getWpConfig() });
  });

  // 11. Sync data (ESB POS Exclusive)
  app.post('/api/wordpress/sync', async (req, res) => {
    try {
      const result = await runDirectESBSync();
      res.json({
        success: true,
        message: 'Synchronized live catalog from ESB POS',
        data: db.getAllProducts(),
        ...result,
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // 12. Cleanup legacy WordPress duplicates
  app.post('/api/esb/cleanup-duplicates', (req, res) => {
    try {
      const result = db.cleanupLegacyWordPressData();
      res.json({ success: true, message: 'Cleaned up duplicate WordPress data from database', ...result });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 13. Direct ESB Live Sync (POS Menu)
  app.post('/api/esb/sync-direct', async (req, res) => {
    try {
      const result = await runDirectESBSync();
      res.json({
        success: true,
        message: 'Successfully synchronized directly with ESB POS',
        ...result,
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 13b. Direct My ESB ERP Inventory Stock Sync (Stock Period List)
  app.post('/api/esb/sync-erp', async (req, res) => {
    try {
      const result = await runDirectESBERPSync(req.body || {});
      res.json({
        success: true,
        message: `Successfully synchronized ${result.totalSyncedProducts || 0} real inventory items from My ESB ERP (Kuningan)`,
        ...result,
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/esb/erp-config', (req, res) => {
    res.json({
      hasCustomCookie: !!db.getConfig('esb_erp_cookie'),
      lastSyncedAt: db.getConfig('last_esb_erp_synced_at') || null,
    });
  });

  app.post('/api/esb/erp-config', (req, res) => {
    const { cookie, csrf } = req.body;
    if (cookie) db.setConfig('esb_erp_cookie', cookie);
    if (csrf) db.setConfig('esb_erp_csrf', csrf);
    res.json({ success: true, message: 'Updated My ESB ERP session credentials' });
  });

  // 14. Instant Webhook from ESB / WordPress
  app.post('/api/esb/webhook', (req, res) => {
    const { location, variant_title, stock } = req.body;
    console.log('[ESB Webhook Received]:', req.body);

    if (variant_title) {
      const stores = db.getAllStores();
      const locKey = (location || '').toLowerCase();
      const targetStore = stores.find((s) => s.id === locKey || s.locationCode?.toLowerCase() === locKey || s.name.toLowerCase().includes(locKey));
      const storeId = targetStore ? targetStore.id : (stores[0]?.id || 'birmas-sudirman');

      const products = db.getAllProducts();
      const existing = products.find((p) => p.varian?.toLowerCase() === variant_title.toLowerCase() || p.productTitle === variant_title);
      if (existing) {
        db.setProductStock(storeId, existing.id, Number(stock) || 0);
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
    const user = db.getUserByUsername(cleanUser);

    if (!user || user.password !== password) {
      return res.status(401).json({ success: false, message: 'Invalid username or password' });
    }

    const safeUser = { id: user.id, username: user.username, name: user.name, email: user.email, role: user.role };
    res.json({ success: true, message: `Welcome back, ${user.name}`, user: safeUser });
  });

  // 14. Database health & system status
  app.get('/api/database/status', (req, res) => {
    const dbPath = path.join(__dirname, 'data', 'birmas_audit.sqlite');
    const stats = fs.existsSync(dbPath) ? fs.statSync(dbPath) : null;
    const stores = db.getAllStores();
    const products = db.getAllProducts();
    const history = db.getAllAuditHistory();

    res.json({
      status: 'healthy',
      engine: 'SQLite (Relational Tables)',
      dbFile: dbPath,
      fileSizeKB: stats ? Math.round(stats.size / 1024) : 0,
      totalProducts: products.length,
      totalStores: stores.length,
      totalAuditsArchived: history.length,
      lastSaved: new Date().toISOString(),
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
    console.log(`[Birmas Server] SQLite Tables Ready at http://localhost:${PORT}`);
    // Run initial ESB sync after 3 seconds, then every 10 minutes
    setTimeout(() => {
      runDirectESBSync().catch((e) => console.warn('[Initial ESB Sync Error]:', e.message));
    }, 3000);

    const ESB_AUTO_SYNC_INTERVAL_MS = 10 * 60 * 1000;
    setInterval(() => {
      console.log('[Auto-Sync] Running scheduled 10-minute background sync from ESB Cloud...');
      runDirectESBSync().catch((e) => console.warn('[Periodic ESB Sync Error]:', e.message));
    }, ESB_AUTO_SYNC_INTERVAL_MS);
  });
}

if (process.argv.includes('--sync-esb')) {
  console.log('[CLI] Connecting directly to ESB Production (core-api.esb.co.id)...');
  runDirectESBSync().then((res) => {
    const stores = db.getAllStores();
    const products = db.getAllProducts();
    console.log(`[CLI] Direct ESB Sync complete! Total products in SQLite: ${products.length}, Stores: ${stores.length}, Stock entries: ${res.totalStockEntries}`);
    process.exit(0);
  }).catch((err) => {
    console.error('[CLI] Direct ESB Sync failed:', err);
    process.exit(1);
  });
} else if (process.argv.includes('--sync')) {
  console.log('[CLI] Connecting directly to ESB to sync products into SQLite tables...');
  runDirectESBSync().then(() => {
    const stores = db.getAllStores();
    const products = db.getAllProducts();
    console.log(`[CLI] ESB Sync finished! Total products in SQLite: ${products.length}, Stores in SQLite: ${stores.length}`);
    process.exit(0);
  }).catch((err) => {
    console.error('[CLI] Sync failed:', err);
    process.exit(1);
  });
} else {
  startServer().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}
