import {
  fetchStores as apiFetchStores,
  fetchProducts as apiFetchProducts,
  apiMatchBarcode,
  fetchAuditState as apiFetchAuditState,
  apiSendScan,
  apiAdjustCount,
  apiResetAudit,
  apiFinalizeAudit,
  fetchAuditHistory as apiFetchAuditHistory,
  apiClearAuditHistory,
  fetchWpConfig as apiFetchWpConfig,
  apiSaveWpConfig,
  apiDeleteBarcodeMatch,
  apiFetchDatabaseStatus,
  apiSyncWordPress as apiRunSync,
  apiAddStore,
  apiDeleteStore,
} from './apiClient.js';

export const DEFAULT_STORES = [
  {
    id: 'birmas-kuningan',
    name: 'Birmas Kuningan',
    locationCode: 'BIRMAS-KNG',
    esbBranchCode: 'ESB_KNG',
  },
  {
    id: 'birmas-kwitang',
    name: 'Birmas Kwitang',
    locationCode: 'BIRMAS-KWT',
    esbBranchCode: 'ESB_KWT',
  },
  {
    id: 'birmas-lebak-bulus',
    name: 'Birmas Lebak Bulus',
    locationCode: 'BIRMAS-LBB',
    esbBranchCode: 'ESB_LBB',
  },
  {
    id: 'birmas-sudirman',
    name: 'Birmas Sudirman',
    locationCode: 'BIRMAS-SDR',
    esbBranchCode: 'ESB_SDR',
  },
];

export const DEFAULT_WP_PRODUCTS = [
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
  }
];

export async function fetchStores() {
  return await apiFetchStores();
}

export async function addStore(storeData) {
  return await apiAddStore(storeData);
}

export async function deleteStore(storeId) {
  return await apiDeleteStore(storeId);
}

export async function fetchProducts() {
  return await apiFetchProducts();
}

export async function saveNewBarcode(payload) {
  return await apiMatchBarcode(payload);
}

export async function deleteBarcode(barcode) {
  return await apiDeleteBarcodeMatch(barcode);
}

export async function fetchAuditState(storeId) {
  return await apiFetchAuditState(storeId);
}

export async function sendAuditScan(barcode, storeId, auditorName) {
  return await apiSendScan(barcode, storeId, auditorName);
}

export async function adjustAuditCount(barcode, storeId, opts) {
  return await apiAdjustCount(barcode, storeId, opts);
}

export async function resetAuditSession(storeId) {
  return await apiResetAudit(storeId);
}

export async function finalizeAuditSession(audit) {
  return await apiFinalizeAudit(audit);
}

export async function fetchAuditHistory() {
  return await apiFetchAuditHistory();
}

export async function clearAuditHistory() {
  return await apiClearAuditHistory();
}

export async function fetchWordPressConfig() {
  return await apiFetchWpConfig();
}

export async function saveWordPressConfig(config) {
  return await apiSaveWpConfig(config);
}

export async function syncWordPressData(config) {
  return await apiRunSync(config);
}

export async function fetchDatabaseHealth() {
  return await apiFetchDatabaseStatus();
}
