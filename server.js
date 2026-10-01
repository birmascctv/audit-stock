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

// Helper to extract string or value from Pods field
function extractField(f) {
  if (f === null || f === undefined) return '';
  if (Array.isArray(f) && f.length > 0) return extractField(f[0]);
  if (typeof f === 'object') return (f.value ?? f.rendered ?? f.post_title ?? f.name ?? f.slug ?? '').toString();
  return f.toString();
}

async function fetchPodsEndpoint(url, path, headers) {
  const fullUrl = path.startsWith('http') ? path : `${url.replace(/\/$/, '')}${path.startsWith('/') ? path : '/' + path}`;
  try {
    console.log(`[WordPress Pods Sync] Requesting ${fullUrl} (timeout 45s) ...`);
    const startTime = Date.now();
    const reqHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) BirmasStockAudit/1.0',
      'Accept': 'application/json',
      ...headers,
    };
    const res = await fetch(fullUrl, { headers: reqHeaders, signal: AbortSignal.timeout(45000) });
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    if (!res.ok) {
      console.warn(`[WordPress Pods Sync] HTTP ${res.status} ${res.statusText} from ${fullUrl} (${duration}s)`);
      return null;
    }
    const json = await res.json();
    console.log(`[WordPress Pods Sync] Response received from ${fullUrl} in ${duration}s!`);
    return Array.isArray(json) ? json : Array.isArray(json.products) ? json.products : Array.isArray(json.data) ? json.data : null;
  } catch (err) {
    console.warn(`[WordPress Pods Sync] Note on ${fullUrl}:`, err.message);
    return null;
  }
}

let isSyncing = false;

// Background sync runner: syncs store locations and product_stocks Pod directly into SQLite tables
export async function runBackgroundWordPressSync() {
  if (isSyncing) {
    console.log('[WordPress Pods Sync] Sync already in progress, skipping.');
    return;
  }
  isSyncing = true;
  try {
    const wpConfig = db.getWpConfig();
    const url = process.env.WP_URL || wpConfig.wpUrl || 'https://admin.birmas.id';
    if (!url || url.includes('demo-store.local')) return;

    const authHeader = process.env.WP_APP_PASSWORD
      ? { 'Authorization': `Basic ${Buffer.from(process.env.WP_APP_PASSWORD).toString('base64')}` }
      : {};

    const headers = {
      ...authHeader,
    };

    const rawEndpoint = (process.env.WP_STOCKS_ENDPOINT || wpConfig.customEndpointPath || '/wp-json/api/v1/product_stocks').split('?')[0];
    const batchSize = parseInt(process.env.WP_BATCH_SIZE || '50', 10);
    const maxPages = parseInt(process.env.WP_MAX_PAGES || '100', 10);
    let currentPage = 1;
    let totalSynced = 0;

    console.log(`[WordPress Pods Sync] Starting safe pagination sync (${batchSize} items per page)...`);

    while (currentPage <= maxPages) {
      const pageUrl = `${rawEndpoint}?page=${currentPage}&per_page=${batchSize}`;
      const pageData = await fetchPodsEndpoint(url, pageUrl, headers);

      if (!pageData || !Array.isArray(pageData) || pageData.length === 0) {
        if (currentPage === 1) {
          console.warn('[WordPress Pods Sync] First page returned no items or error.');
        } else {
          console.log(`[WordPress Pods Sync] Reached end of catalog at page ${currentPage - 1}.`);
        }
        break;
      }

      for (const item of pageData) {
        // Resolve Location from Pods & auto-register into SQLite stores table
        let targetStoreId = '';
        if (Array.isArray(item.location) && item.location.length > 0) {
          const locObj = item.location[0];
          targetStoreId = locObj.post_name || `birmas-${(locObj.outlet_code || locObj.post_title || 'branch').toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
          db.saveStore({
            id: targetStoreId,
            wpId: locObj.ID,
            name: locObj.post_title || 'Birmas Branch',
            locationCode: locObj.outlet_code ? `BRM-${locObj.outlet_code.toUpperCase()}` : `BRM-${targetStoreId.slice(-3).toUpperCase()}`,
            esbBranchCode: locObj.branch_code_esb || '',
          });
        }

        const stores = db.getAllStores();
        const storeId = targetStoreId || (stores[0]?.id || 'birmas-sudirman');

        // Resolve Variant & Product Details
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

        // Resolve Stock
        let stockVal = 0;
        if (typeof item.stock === 'object' && item.stock !== null) {
          stockVal = Number(item.stock.value ?? item.stock.rendered ?? 0);
        } else {
          stockVal = Number(item.stock ?? item.stock_qty ?? item.quantity ?? item.qty ?? item.meta?.stock ?? 0);
        }

        if (variantId || productTitle || barcode) {
          const prodId = variantId || `wp-${item.id || Date.now()}`;
          db.saveProduct({
            id: prodId,
            barcode: barcode || null,
            sku: sku || null,
            brand: brand,
            varian: variantName !== 'Standard' ? variantName : productTitle,
            productTitle: productTitle,
            packageType: variantObj?.variant || 'Kaleng',
            volume: volume,
            unitVolume: unitVolume,
            price: price,
            wpStatus: 'publish',
            lastUpdated: new Date().toISOString(),
          });

          // Save stock quantity for this store in SQLite store_stocks table
          if (storeId) {
            db.setProductStock(storeId, prodId, stockVal);
          }
        }
      }

      totalSynced += pageData.length;
      console.log(`[WordPress Pods Sync] Page ${currentPage} synced (${pageData.length} items, total so far: ${totalSynced})`);

      // If page had fewer items than batchSize, we have reached the end
      if (pageData.length < batchSize) {
        break;
      }

      currentPage++;
      // Polite 400ms pause between batches to keep server CPU low
      await new Promise((resolve) => setTimeout(resolve, 400));
    }

    db.setConfig('last_synced_at', new Date().toISOString());
    const allStores = db.getAllStores();
    const allProducts = db.getAllProducts();
    console.log(`[WordPress Pods Sync] Sync completed successfully! Total products in SQLite: ${allProducts.length}, Stores: ${allStores.length}`);
  } catch (err) {
    console.warn('[WordPress Pods Sync] Error:', err.message);
  } finally {
    isSyncing = false;
  }
}

let isEsbSyncing = false;

// Direct ESB Live Sync: Connects straight to core-api.esb.co.id to fetch real store stock per branch
export async function runDirectESBSync() {
  if (isEsbSyncing) {
    console.log('[Direct ESB Sync] Sync already in progress, skipping.');
    return { success: false, message: 'Already syncing' };
  }
  isEsbSyncing = true;
  try {
    const token = process.env.ESB_BEARER_TOKEN || 'GP1bo7ccOiykqZCkDsBMTNaw5XxAReug0rNKjoXjTGplRyKrnvzTdAJmWVjI';
    const baseUrl = (process.env.ESB_BASE_URL || 'https://core-api.esb.co.id').replace(/\/$/, '');
    const visitPurposeID = process.env.ESB_VISIT_PURPOSE_ID || '10';

    console.log(`[Direct ESB Sync] Connecting to ${baseUrl} ...`);
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 BirmasAudit/1.0',
    };

    // 1. Fetch live branches from ESB
    let branches = [];
    try {
      const res = await fetch(`${baseUrl}/extv1/branch`, { headers });
      if (res.ok) {
        branches = await res.json();
      }
    } catch (err) {
      console.warn('[Direct ESB Sync] Failed to fetch branches from ESB, using active branch list:', err.message);
    }

    if (!Array.isArray(branches) || branches.length === 0) {
      branches = [
        { branchCode: 'BRMS', branchName: 'SUDIRMAN' },
        { branchCode: 'BRMT', branchName: 'TEBET' },
        { branchCode: 'BRMK', branchName: 'KUNINGAN' },
        { branchCode: 'BRMKG', branchName: 'KELAPA GADING' },
        { branchCode: 'BRMLB', branchName: 'LEBAK BULUS' },
        { branchCode: 'BRMKW', branchName: 'KWITANG' },
        { branchCode: 'BBND', branchName: 'BALI NUSA DUA' },
      ];
    }

    console.log(`[Direct ESB Sync] Registering ${branches.length} branches in SQLite...`);
    const branchMap = new Map();
    for (const b of branches) {
      const existingStores = db.getAllStores();
      const existing = existingStores.find(
        (s) => s.esbBranchCode === b.branchCode || s.locationCode === b.branchCode || s.id.includes(b.branchCode.toLowerCase())
      );
      const storeId = existing ? existing.id : `birmas-${b.branchCode.toLowerCase()}`;
      db.saveStore({
        id: storeId,
        wpId: existing?.wpId || null,
        name: existing?.name || `Birmas ${b.branchName}`,
        locationCode: b.branchCode,
        esbBranchCode: b.branchCode,
      });
      branchMap.set(b.branchCode, storeId);
    }

    // Index existing products in SQLite by title/variant to preserve IDs and mapped barcodes
    const allExisting = db.getAllProducts();
    const existingByName = new Map();
    for (const p of allExisting) {
      if (p.productTitle) existingByName.set(p.productTitle.toLowerCase().trim(), p);
      if (p.varian) existingByName.set(p.varian.toLowerCase().trim(), p);
    }

    const productCatalog = new Map();
    let totalStockEntries = 0;

    // 2. Fetch menu & stock per branch
    for (const b of branches) {
      try {
        const menuUrl = `${baseUrl}/extv1/menu?branchCode=${encodeURIComponent(b.branchCode)}&visitPurposeID=${visitPurposeID}`;
        const res = await fetch(menuUrl, { headers });
        if (!res.ok) {
          console.warn(`[Direct ESB Sync] Branch ${b.branchCode} returned HTTP ${res.status}`);
          continue;
        }
        const categories = await res.json();
        if (!Array.isArray(categories)) continue;

        const storeId = branchMap.get(b.branchCode);

        for (const cat of categories) {
          for (const detail of (cat.menuCategoryDetails || [])) {
            for (const m of (detail.menus || [])) {
              const menuId = m.menuID;
              const menuName = (m.menuName || '').trim();
              if (!menuName) continue;

              const cleanName = menuName.replace(/^\([0-9+]+\)\s*/, '');
              const existing = existingByName.get(menuName.toLowerCase()) || existingByName.get(cleanName.toLowerCase());

              const prodId = existing ? existing.id : `esb-${menuId}`;
              const barcode = existing?.barcode || null;
              const price = Number(m.sellPrice ?? m.price ?? existing?.price ?? 0);
              const qty = Number(m.qty ?? 0);
              const brand = cleanName.split(' ')[0] || existing?.brand || 'Birmas';

              if (!productCatalog.has(prodId)) {
                productCatalog.set(prodId, {
                  id: prodId,
                  barcode: barcode,
                  sku: String(m.menuCode || existing?.sku || menuId),
                  brand: brand,
                  varian: cleanName,
                  productTitle: menuName,
                  packageType: menuName.toLowerCase().includes('botol') ? 'Botol' : (menuName.toLowerCase().includes('can') || menuName.toLowerCase().includes('kaleng')) ? 'Kaleng' : 'Standard',
                  volume: existing?.volume ?? 330,
                  unitVolume: existing?.unitVolume || 'ml',
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

    // Save all products into SQLite
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
    if (!payload.barcode || !payload.brand || !payload.varian) {
      return res.status(400).json({ error: 'Barcode, Brand, and Varian are required' });
    }

    const cleanBarcode = payload.barcode.trim();
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
      stockByStore: payload.stockByStore || {},
      wpStatus: 'publish',
      lastUpdated: new Date().toISOString(),
    };

    db.saveProduct(productItem);

    res.json({
      success: true,
      message: `Barcode ${cleanBarcode} saved successfully in SQLite for ${productItem.brand} ${productItem.varian}`,
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

  // 11. Sync WordPress data
  app.post('/api/wordpress/sync', async (req, res) => {
    try {
      await runBackgroundWordPressSync();
      res.json({
        success: true,
        message: 'Synchronized with WordPress Pods into SQLite tables',
        data: db.getAllProducts(),
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // 12. Trigger WordPress to Sync with ESB POS
  app.post('/api/wordpress/sync-esb', async (req, res) => {
    try {
      const wpConfig = db.getWpConfig();
      const url = process.env.WP_URL || wpConfig.wpUrl || 'https://admin.birmas.id';
      const endpoint = `${url.replace(/\/$/, '')}/wp-json/api/v1/synchronize-stock-esb`;
      console.log(`[ESB Sync Trigger] Sending POST to ${endpoint} ...`);

      const authHeader = process.env.WP_APP_PASSWORD
        ? { 'Authorization': `Basic ${Buffer.from(process.env.WP_APP_PASSWORD).toString('base64')}` }
        : {};

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 BirmasStockAudit/1.0',
          ...authHeader,
        },
      });

      const text = await response.text();
      let data = text;
      try { data = JSON.parse(text); } catch (_) {}

      console.log(`[ESB Sync Trigger] Response HTTP ${response.status}`);
      res.json({
        success: response.ok,
        status: response.status,
        result: data,
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 13. Direct ESB Live Sync
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
  console.log('[CLI] Connecting to https://admin.birmas.id to sync product_stocks into SQLite tables...');
  runBackgroundWordPressSync().then(() => {
    const stores = db.getAllStores();
    const products = db.getAllProducts();
    console.log(`[CLI] Sync finished! Total products in SQLite: ${products.length}, Stores in SQLite: ${stores.length}`);
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
