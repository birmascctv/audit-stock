<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useAuth } from '../composables/useAuth.js';
import { useAuditStore } from '../composables/useAuditStore.js';
import { exportToCSV, formatDateTime } from '../utils/storage.js';
import {
  TrendingUp,
  Receipt,
  DollarSign,
  Package,
  Building2,
  Calendar,
  Filter,
  Search,
  Download,
  RefreshCw,
  HelpCircle,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Copy,
  ChevronDown,
  Layers,
  Store,
  ArrowUpRight,
  Sparkles,
  ExternalLink,
  UploadCloud,
  FileSpreadsheet,
  BarChart3,
  Tag,
  ShoppingBag,
  Percent
} from 'lucide-vue-next';
import UploadSalesCsvModal from '../components/UploadSalesCsvModal.vue';
import {
  SEPTEMBER_DAILY_MATRIX,
  SEPTEMBER_MATRIX_TOTALS,
  WEEKLY_CATEGORY_MATRIX,
  WEEKLY_MATRIX_TOTALS,
  PROMO_CAMPAIGN_RECORDS,
  computeDailyOutletMatrixFromTransactions,
  computeWeeklyCategoryMatrixFromTransactions
} from '../utils/salesAnalyticsData.js';

const { currentUser, role, isSuperAdmin } = useAuth();

// Navigation Tabs
// 'outletMatrix' | 'weeklyProducts' | 'promoReport' | 'table' | 'analytics'
const activeViewTab = ref('outletMatrix');

// Filters
const selectedStoreId = ref('all');
const selectedCategory = ref('all');
const selectedBrand = ref('all');
const selectedVisitPurpose = ref('all');
const selectedPayment = ref('all');
const searchQuery = ref('');
const datePreset = ref('30d');
const startDate = ref('');
const endDate = ref('');

// Data Source Mode for Matrix: 'auto' | 'benchmark' | 'live'
const matrixSourceMode = ref('auto');

// Weekly Products Category Filter & Search
const weeklySelectedCategory = ref('all');
const weeklySearchQuery = ref('');
const weeklySelectedStore = ref('all');

// Promo Report Filters
const promoSelectedMonth = ref('all');
const promoSelectedOutlet = ref('all');
const promoSearchQuery = ref('');

// State
const transactions = ref([]);
const summary = ref({
  totalBills: 0,
  totalLineItems: 0,
  totalUnitsSold: 0,
  totalGrossSales: 0,
  totalDiscounts: 0,
  totalTax: 0,
  totalNetSales: 0,
  byStore: [],
  byChannel: [],
  byPayment: [],
  byBrand: [],
  topItems: [],
});
const isLoading = ref(false);
const isSyncing = ref(false);
const syncMessage = ref('');
const isUploadModalOpen = ref(false);

function handleCsvImported(rows) {
  loadSalesReport();
  activeViewTab.value = 'outletMatrix';
  syncMessage.value = `Successfully imported ${rows.length} sales records from CSV! Live analytics updated.`;
}

// Stores list derived dynamically
const availableStores = computed(() => {
  const storeMap = new Map();
  if (summary.value?.byStore?.length) {
    summary.value.byStore.forEach((s) => {
      if (s.store_id && s.store_name) {
        storeMap.set(s.store_id, s.store_name);
      }
    });
  }
  transactions.value.forEach((t) => {
    if (t.store_id && t.store_name) {
      storeMap.set(t.store_id, t.store_name);
    }
  });
  // Default Birmas chain if none uploaded yet
  if (storeMap.size === 0) {
    return [
      { id: 'birmas-sudirman', name: 'Birmas Sudirman' },
      { id: 'birmas-kwitang', name: 'Birmas Kwitang' },
      { id: 'birmas-kuningan', name: 'Birmas Kuningan' },
      { id: 'birmas-lebak-bulus', name: 'Birmas Lebak Bulus' },
      { id: 'birmas-kelapa-gading', name: 'Birmas Kelapa Gading' },
      { id: 'birmas-nomadic', name: 'Birmas Nomadic (Bandung)' },
      { id: 'birmas-nusadua', name: 'Birmas Nusa Dua (Bali)' },
    ];
  }
  return Array.from(storeMap.entries()).map(([id, name]) => ({ id, name }));
});

// Categories list
const categories = computed(() => {
  const set = new Set();
  transactions.value.forEach((t) => {
    if (t.category) set.add(t.category);
  });
  if (set.size === 0) {
    return ['Anggur', 'Beer', 'Craft Beer', 'Fizzy', 'Liquor', 'Soju Import', 'Soju', 'Wine', 'Mixer', 'Lain Lain'];
  }
  return Array.from(set);
});

// Format Rupiah
function formatRupiah(amount) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

function formatNumber(num) {
  if (!num) return '-';
  return Number(num).toLocaleString('id-ID');
}

// Format Date
function formatSimpleDate(isoString) {
  if (!isoString) return '-';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

// -------------------------------------------------------------
// DYNAMIC ANALYTICS COMPUTATIONS (Excel Report Replications)
// -------------------------------------------------------------

// 1. Daily Outlet Revenue Matrix
const computedDailyMatrix = computed(() => {
  if (matrixSourceMode.value === 'benchmark' || (transactions.value.length === 0 && matrixSourceMode.value === 'auto')) {
    return {
      matrix: SEPTEMBER_DAILY_MATRIX,
      totals: SEPTEMBER_MATRIX_TOTALS,
      isBenchmark: true,
    };
  }
  return computeDailyOutletMatrixFromTransactions(transactions.value);
});

// Outlets for Matrix view
const matrixOutlets = [
  { key: 'sudirman', name: 'SUDIRMAN', channels: ['gofood', 'grabfood', 'grabmart', 'shopeefood', 'qris', 'transfer', 'edc', 'tunai'] },
  { key: 'kwitang', name: 'KWITANG', channels: ['gofood', 'grabfood', 'grabmart', 'shopeefood', 'qris', 'transfer', 'tunai'] },
  { key: 'kuningan', name: 'KUNINGAN', channels: ['gofood', 'grabfood', 'grabmart', 'shopeefood', 'qris', 'transfer', 'tunai'] },
  { key: 'lebakBulus', name: 'LEBAK BULUS', channels: ['gofood', 'grabfood', 'grabmart', 'shopeefood', 'qris', 'transfer', 'tunai'] },
  { key: 'kelapaGading', name: 'KELAPA GADING', channels: ['gofood', 'grabfood', 'grabmart', 'shopeefood', 'qris', 'transfer', 'tunai'] },
  { key: 'nomadic', name: 'NOMADIC', channels: ['gofood', 'grabfood', 'grabmart', 'shopeefood', 'qris', 'transfer', 'edc', 'tunai'] },
  { key: 'nusadua', name: 'NUSADUA', channels: ['edc', 'qris', 'tunai'] },
];

const selectedMatrixOutletKey = ref('all');

const visibleMatrixOutlets = computed(() => {
  if (selectedMatrixOutletKey.value === 'all') return matrixOutlets;
  return matrixOutlets.filter(o => o.key === selectedMatrixOutletKey.value);
});

// Overall sum of all outlets
const matrixGrandTotalRevenue = computed(() => {
  const totals = computedDailyMatrix.value.totals;
  let sum = 0;
  for (const k in totals) {
    sum += (totals[k]?.total || 0);
  }
  return sum;
});

// 2. Weekly Category & Product Sales Matrix
const computedWeeklyMatrix = computed(() => {
  let baseMatrix = WEEKLY_CATEGORY_MATRIX;
  if (transactions.value.length > 0 && matrixSourceMode.value !== 'benchmark') {
    const res = computeWeeklyCategoryMatrixFromTransactions(transactions.value);
    if (res.matrix && res.matrix.length > 0) {
      baseMatrix = res.matrix;
    }
  }

  // Filter by Category
  let filtered = baseMatrix;
  if (weeklySelectedCategory.value !== 'all') {
    filtered = filtered.filter(item => item.category.toLowerCase() === weeklySelectedCategory.value.toLowerCase());
  }

  // Filter by Search Query
  if (weeklySearchQuery.value.trim()) {
    const q = weeklySearchQuery.value.toLowerCase().trim();
    filtered = filtered.filter(item =>
      (item.detail && item.detail.toLowerCase().includes(q)) ||
      (item.category && item.category.toLowerCase().includes(q))
    );
  }

  return filtered;
});

// Group weekly products by category for accordion/subtotals
const weeklyGroupedByCategory = computed(() => {
  const map = new Map();
  computedWeeklyMatrix.value.forEach((item) => {
    if (!map.has(item.category)) {
      map.set(item.category, []);
    }
    map.get(item.category).push(item);
  });
  return Array.from(map.entries()).map(([catName, items]) => {
    // calculate category subtotal
    const subtotal = {
      kwitang: items.reduce((acc, i) => acc + (i.kwitang?.[4] || 0), 0),
      sudirman: items.reduce((acc, i) => acc + (i.sudirman?.[4] || 0), 0),
      kuningan: items.reduce((acc, i) => acc + (i.kuningan?.[4] || 0), 0),
      nomadic: items.reduce((acc, i) => acc + (i.nomadic?.[4] || 0), 0),
      bali: items.reduce((acc, i) => acc + (i.bali?.[4] || 0), 0),
      lebakBulus: items.reduce((acc, i) => acc + (i.lebakBulus?.[4] || 0), 0),
      total: 0
    };
    subtotal.total = subtotal.kwitang + subtotal.sudirman + subtotal.kuningan + subtotal.nomadic + subtotal.bali + subtotal.lebakBulus;

    return {
      category: catName,
      items,
      subtotal,
    };
  });
});

// 3. Promo Sales Performance Records
const computedPromoRecords = computed(() => {
  let list = [...PROMO_CAMPAIGN_RECORDS];

  // If live transactions contain promo items, merge them
  if (transactions.value.length > 0) {
    const promoTx = transactions.value.filter(t => (t.item_name || '').toUpperCase().includes('PROMO'));
    if (promoTx.length > 0) {
      // aggregate live promo items
      const livePromoMap = new Map();
      promoTx.forEach((tx) => {
        const key = `${tx.store_name}___${tx.item_name}`;
        if (!livePromoMap.has(key)) {
          livePromoMap.set(key, {
            month: 'Live Upload',
            fromDate: tx.sales_date || (tx.date ? String(tx.date).slice(0, 10) : 'Current'),
            toDate: 'Current',
            outlet: (tx.store_name || 'Outlet').toUpperCase(),
            promo: tx.item_name,
            gofood: 0,
            grabfood: 0,
            grabmart: 0,
            shopeefood: 0,
            dineIn: 0,
            takeAway: 0,
            waOrder: 0,
            grandTotal: 0,
          });
        }
        const p = livePromoMap.get(key);
        const vp = String(tx.visit_purpose || '').toUpperCase();
        const qty = Number(tx.qty || 1);
        if (vp.includes('GOFOOD')) p.gofood += qty;
        else if (vp.includes('GRABFOOD')) p.grabfood += qty;
        else if (vp.includes('GRABMART')) p.grabmart += qty;
        else if (vp.includes('SHOPEE')) p.shopeefood += qty;
        else if (vp.includes('TAKE AWAY')) p.takeAway += qty;
        else if (vp.includes('WA')) p.waOrder += qty;
        else p.dineIn += qty;
        p.grandTotal += qty;
      });
      list = [...Array.from(livePromoMap.values()), ...list];
    }
  }

  // Filter by Month
  if (promoSelectedMonth.value !== 'all') {
    list = list.filter(r => r.month.toLowerCase().includes(promoSelectedMonth.value.toLowerCase()));
  }

  // Filter by Outlet
  if (promoSelectedOutlet.value !== 'all') {
    list = list.filter(r => r.outlet.toLowerCase().includes(promoSelectedOutlet.value.toLowerCase()));
  }

  // Search promo
  if (promoSearchQuery.value.trim()) {
    const q = promoSearchQuery.value.toLowerCase().trim();
    list = list.filter(r => r.promo.toLowerCase().includes(q) || r.outlet.toLowerCase().includes(q));
  }

  return list;
});

const promoSummaryTotals = computed(() => {
  return computedPromoRecords.value.reduce(
    (acc, r) => {
      acc.gofood += (r.gofood || 0);
      acc.grabfood += (r.grabfood || 0);
      acc.grabmart += (r.grabmart || 0);
      acc.shopeefood += (r.shopeefood || 0);
      acc.dineIn += (r.dineIn || 0);
      acc.takeAway += (r.takeAway || 0);
      acc.waOrder += (r.waOrder || 0);
      acc.grandTotal += (r.grandTotal || 0);
      return acc;
    },
    { gofood: 0, grabfood: 0, grabmart: 0, shopeefood: 0, dineIn: 0, takeAway: 0, waOrder: 0, grandTotal: 0 }
  );
});

// -------------------------------------------------------------
// Load sales report data from backend API
// -------------------------------------------------------------
async function loadSalesReport() {
  isLoading.value = true;
  try {
    const query = new URLSearchParams();
    if (selectedStoreId.value && selectedStoreId.value !== 'all') {
      query.set('storeId', selectedStoreId.value);
    }
    if (startDate.value) query.set('startDate', startDate.value);
    if (endDate.value) query.set('endDate', endDate.value);
    if (searchQuery.value.trim()) query.set('search', searchQuery.value.trim());
    if (selectedCategory.value && selectedCategory.value !== 'all') {
      query.set('category', selectedCategory.value);
    }
    if (selectedBrand.value && selectedBrand.value !== 'all') {
      query.set('brand', selectedBrand.value);
    }
    if (selectedVisitPurpose.value && selectedVisitPurpose.value !== 'all') {
      query.set('visitPurpose', selectedVisitPurpose.value);
    }
    if (selectedPayment.value && selectedPayment.value !== 'all') {
      query.set('paymentMethod', selectedPayment.value);
    }
    query.set('limit', '500');

    const [txRes, sumRes] = await Promise.all([
      fetch(`/api/sales/report?${query.toString()}`).then((r) => r.json()).catch(() => ({ transactions: [] })),
      fetch(`/api/sales/summary?${query.toString()}`).then((r) => r.json()).catch(() => ({ summary: null })),
    ]);

    if (txRes && txRes.transactions) {
      transactions.value = txRes.transactions;
    }
    if (sumRes && sumRes.summary) {
      summary.value = sumRes.summary;
    }
  } catch (err) {
    console.error('Failed to load sales report:', err);
  } finally {
    isLoading.value = false;
  }
}

// Export active data to CSV
function exportActiveView() {
  if (activeViewTab.value === 'outletMatrix') {
    exportDailyMatrixCSV();
  } else if (activeViewTab.value === 'weeklyProducts') {
    exportWeeklyCategoryCSV();
  } else if (activeViewTab.value === 'promoReport') {
    exportPromoReportCSV();
  } else {
    exportRawTransactionsCSV();
  }
}

function exportDailyMatrixCSV() {
  const rows = [];
  const matrix = computedDailyMatrix.value.matrix;
  for (const r of matrix) {
    const row = { DATE: r.date };
    for (const o of matrixOutlets) {
      for (const ch of o.channels) {
        row[`${o.name} ${ch.toUpperCase()}`] = r.outlets[o.key]?.[ch] || 0;
      }
      row[`${o.name} TOTAL`] = r.outlets[o.key]?.total || 0;
    }
    rows.push(row);
  }
  exportToCSV(rows, `Birmas_Daily_Outlet_Revenue_Matrix_${new Date().toISOString().slice(0, 10)}`);
}

function exportWeeklyCategoryCSV() {
  const rows = computedWeeklyMatrix.value.map(i => ({
    CATEGORY: i.category,
    'CATEGORY DETAIL (BRAND)': i.detail,
    'KWITANG W1': i.kwitang[0], 'KWITANG W2': i.kwitang[1], 'KWITANG W3': i.kwitang[2], 'KWITANG W4': i.kwitang[3], 'KWITANG TOTAL': i.kwitang[4],
    'SUDIRMAN W1': i.sudirman[0], 'SUDIRMAN W2': i.sudirman[1], 'SUDIRMAN W3': i.sudirman[2], 'SUDIRMAN W4': i.sudirman[3], 'SUDIRMAN TOTAL': i.sudirman[4],
    'KUNINGAN W1': i.kuningan[0], 'KUNINGAN W2': i.kuningan[1], 'KUNINGAN W3': i.kuningan[2], 'KUNINGAN W4': i.kuningan[3], 'KUNINGAN TOTAL': i.kuningan[4],
    'NOMADIC W1': i.nomadic[0], 'NOMADIC W2': i.nomadic[1], 'NOMADIC W3': i.nomadic[2], 'NOMADIC W4': i.nomadic[3], 'NOMADIC TOTAL': i.nomadic[4],
    'BALI W1': i.bali[0], 'BALI W2': i.bali[1], 'BALI W3': i.bali[2], 'BALI W4': i.bali[3], 'BALI TOTAL': i.bali[4],
    'LEBAK BULUS W1': i.lebakBulus[0], 'LEBAK BULUS W2': i.lebakBulus[1], 'LEBAK BULUS W3': i.lebakBulus[2], 'LEBAK BULUS W4': i.lebakBulus[3], 'LEBAK BULUS TOTAL': i.lebakBulus[4],
    'GRAND TOTAL': (i.kwitang[4] + i.sudirman[4] + i.kuningan[4] + i.nomadic[4] + i.bali[4] + i.lebakBulus[4])
  }));
  exportToCSV(rows, `Birmas_Weekly_Category_Sales_Matrix_${new Date().toISOString().slice(0, 10)}`);
}

function exportPromoReportCSV() {
  const rows = computedPromoRecords.value.map(r => ({
    MONTH: r.month,
    'FROM DATE': r.fromDate,
    'TO DATE': r.toDate,
    OUTLET: r.outlet,
    'MENU PROMO': r.promo,
    GOFOOD: r.gofood,
    GRABFOOD: r.grabfood,
    GRABMART: r.grabmart,
    SHOPEEFOOD: r.shopeefood,
    'DINE IN': r.dineIn,
    'TAKE AWAY': r.takeAway,
    'WA ORDER': r.waOrder,
    'GRAND TOTAL': r.grandTotal
  }));
  exportToCSV(rows, `Birmas_Promo_Performance_Report_${new Date().toISOString().slice(0, 10)}`);
}

function exportRawTransactionsCSV() {
  const rows = transactions.value.map(t => ({
    'Sales Date': t.sales_date || (t.date ? String(t.date).slice(0, 10) : ''),
    'Sales Date In': t.sales_date_in || t.date || '',
    'Branch': t.store_name || t.branch || '',
    'Visit Purpose': t.visit_purpose || '',
    'Payment Method': t.payment_method || '',
    'Menu Category': t.category || '',
    'Menu Category Detail': t.brand || '',
    'Menu': t.item_name || t.variant || '',
    'Qty': t.qty || 1,
    'Price': t.unit_price || 0,
    'Subtotal': t.subtotal || 0,
    'Discount': t.discount || 0,
    'Tax': t.tax || 0,
    'Total': t.total || 0,
    'Bill Number': t.bill_no || ''
  }));
  exportToCSV(rows, `Birmas_Itemized_Sales_Export_${new Date().toISOString().slice(0, 10)}`);
}

onMounted(() => {
  loadSalesReport();
});
</script>

<template>
  <div class="space-y-6 font-sans">
    <!-- Top Header Banner -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
      <div class="flex items-center gap-3.5">
        <div class="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center shadow-xs">
          <BarChart3 class="w-6 h-6 text-teal-700" />
        </div>
        <div>
          <h1 class="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span>Sales Report & Analytics</span>
            <span class="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-800">
              ESB Multi-Branch
            </span>
          </h1>
          <p class="text-xs text-slate-500 mt-0.5">
            Cross-tabulated daily revenue, weekly category volume, and promo performance across Birmas outlets.
          </p>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="flex flex-wrap items-center gap-2.5">
        <!-- Upload Sales CSV Modal Button -->
        <button
          @click="isUploadModalOpen = true"
          type="button"
          class="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold flex items-center gap-2 shadow-md shadow-teal-600/20 transition-all cursor-pointer"
          title="Upload ESB Sales Recapitulation CSV file"
        >
          <UploadCloud class="w-4 h-4" />
          <span>Upload Sales CSV</span>
        </button>

        <!-- Export CSV Button -->
        <button
          @click="exportActiveView"
          type="button"
          class="px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
          title="Download active report as CSV"
        >
          <Download class="w-3.5 h-3.5 text-emerald-600" />
          <span>Export CSV</span>
        </button>
      </div>
    </div>

    <!-- Live Sync Alert Toast -->
    <div
      v-if="syncMessage"
      class="p-4 rounded-2xl bg-teal-50 border border-teal-200 text-xs text-teal-900 font-semibold flex items-center justify-between shadow-xs animate-in fade-in"
    >
      <div class="flex items-center gap-2.5">
        <CheckCircle2 class="w-4 h-4 text-teal-700 shrink-0" />
        <span>{{ syncMessage }}</span>
      </div>
      <button @click="syncMessage = ''" class="text-teal-700 hover:text-teal-900 font-bold p-1 cursor-pointer">
        ✕
      </button>
    </div>

    <!-- Top KPI Summary Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <!-- Total Net Revenue -->
      <div class="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs relative overflow-hidden">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Revenue Tracked</span>
          <div class="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <DollarSign class="w-4 h-4" />
          </div>
        </div>
        <div class="mt-3">
          <h3 class="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            {{ formatRupiah(summary.totalNetSales > 0 ? summary.totalNetSales : matrixGrandTotalRevenue) }}
          </h3>
          <p class="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
            <span v-if="summary.totalNetSales > 0">Live CSV Invoices ({{ summary.totalBills }} bills)</span>
            <span v-else class="text-teal-700 font-medium">September Matrix: Rp 500M+ across 7 Outlets</span>
          </p>
        </div>
      </div>

      <!-- Online Food Delivery Total -->
      <div class="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs relative overflow-hidden">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold text-slate-500 uppercase tracking-wider">Online Food Delivery</span>
          <div class="w-8 h-8 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
            <ShoppingBag class="w-4 h-4" />
          </div>
        </div>
        <div class="mt-3">
          <h3 class="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            GoFood & Shopee
          </h3>
          <p class="text-[11px] text-slate-500 mt-1">
            ShopeeFood: Rp 122M+ • GoFood: Rp 27M+ • Grab: Rp 20M+
          </p>
        </div>
      </div>

      <!-- In-Store & QRIS Total -->
      <div class="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs relative overflow-hidden">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold text-slate-500 uppercase tracking-wider">In-Store & QRIS</span>
          <div class="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
            <CreditCard class="w-4 h-4" />
          </div>
        </div>
        <div class="mt-3">
          <h3 class="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            QRIS & Tunai
          </h3>
          <p class="text-[11px] text-slate-500 mt-1">
            QRIS: Rp 229M+ • Cash/Tunai: Rp 74M+ • EDC: Rp 6.7M+
          </p>
        </div>
      </div>

      <!-- Top Branches -->
      <div class="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs relative overflow-hidden">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold text-slate-500 uppercase tracking-wider">Outlets Included</span>
          <div class="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Store class="w-4 h-4" />
          </div>
        </div>
        <div class="mt-3">
          <h3 class="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            7 Branches
          </h3>
          <p class="text-[11px] text-slate-500 mt-1 truncate">
            Sudirman, Kwitang, Kuningan, Lebak Bulus, Nomadic, Bali, Gading
          </p>
        </div>
      </div>
    </div>

    <!-- Main Analytics Card with Tabs -->
    <div class="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden flex flex-col">
      <!-- Tab Header Bar -->
      <div class="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/60">
        <div class="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
          <!-- TAB 1: Daily Outlet Revenue Matrix -->
          <button
            @click="activeViewTab = 'outletMatrix'"
            type="button"
            class="px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer"
            :class="activeViewTab === 'outletMatrix' ? 'bg-white text-teal-800 shadow-sm' : 'text-slate-600 hover:text-slate-900'"
          >
            <BarChart3 class="w-3.5 h-3.5 text-teal-600" />
            <span>Daily Outlet Matrix</span>
          </button>

          <!-- TAB 2: Weekly Category & Product Sales -->
          <button
            @click="activeViewTab = 'weeklyProducts'"
            type="button"
            class="px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer"
            :class="activeViewTab === 'weeklyProducts' ? 'bg-white text-teal-800 shadow-sm' : 'text-slate-600 hover:text-slate-900'"
          >
            <Layers class="w-3.5 h-3.5 text-indigo-600" />
            <span>Weekly Product Sales</span>
          </button>

          <!-- TAB 3: Promo Performance -->
          <button
            @click="activeViewTab = 'promoReport'"
            type="button"
            class="px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer"
            :class="activeViewTab === 'promoReport' ? 'bg-white text-teal-800 shadow-sm' : 'text-slate-600 hover:text-slate-900'"
          >
            <Tag class="w-3.5 h-3.5 text-amber-600" />
            <span>Promo Performance</span>
          </button>

          <!-- TAB 4: Raw Itemized Sales Transactions -->
          <button
            @click="activeViewTab = 'table'"
            type="button"
            class="px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer"
            :class="activeViewTab === 'table' ? 'bg-white text-teal-800 shadow-sm' : 'text-slate-600 hover:text-slate-900'"
          >
            <Receipt class="w-3.5 h-3.5 text-cyan-600" />
            <span>Itemized Transactions ({{ transactions.length }})</span>
          </button>
        </div>

        <!-- Data Source Indicator -->
        <div class="flex items-center gap-2">
          <span class="text-[11px] text-slate-500 font-medium">Data View:</span>
          <select
            v-model="matrixSourceMode"
            class="text-xs font-bold bg-white border border-slate-300 rounded-xl px-2.5 py-1 text-slate-700 cursor-pointer focus:outline-none focus:border-teal-500"
          >
            <option value="auto">Auto (Live if uploaded, else Excel)</option>
            <option value="benchmark">Excel Summary Benchmark</option>
            <option value="live">Uploaded CSV Only</option>
          </select>
        </div>
      </div>

      <!-- ============================================================= -->
      <!-- TAB 1 CONTENT: Daily Outlet Revenue Matrix                    -->
      <!-- ============================================================= -->
      <div v-if="activeViewTab === 'outletMatrix'" class="p-5 space-y-4">
        <!-- Sub-filter bar for Matrix -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
          <div class="flex items-center gap-2">
            <span class="text-xs font-bold text-slate-700">Filter Outlet Column:</span>
            <select
              v-model="selectedMatrixOutletKey"
              class="text-xs font-bold bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-slate-800 cursor-pointer focus:outline-none focus:border-teal-500"
            >
              <option value="all">All Outlets (Full Multi-Branch Cross-Table)</option>
              <option v-for="o in matrixOutlets" :key="o.key" :value="o.key">
                {{ o.name }} Only
              </option>
            </select>
          </div>

          <div class="flex items-center gap-2 text-xs text-slate-500">
            <span>Showing {{ computedDailyMatrix.matrix.length }} dates in period</span>
            <span v-if="computedDailyMatrix.isBenchmark" class="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold">
              Benchmark Data (Sept 2026)
            </span>
            <span v-else class="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold">
              Live CSV Aggregation
            </span>
          </div>
        </div>

        <!-- The Big Cross-Tabulation Matrix Table -->
        <div class="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
          <div class="overflow-x-auto max-h-[620px] overflow-y-auto">
            <table class="w-full text-right text-xs text-slate-700 border-collapse">
              <!-- Tier 1 Header: Outlet Names -->
              <thead class="bg-slate-100 text-slate-800 font-extrabold border-b border-slate-300 sticky top-0 z-20">
                <tr>
                  <th class="py-2.5 px-3 text-left bg-slate-200 sticky left-0 z-30 min-w-[95px] border-r border-slate-300">
                    DATE
                  </th>
                  <template v-for="o in visibleMatrixOutlets" :key="o.key">
                    <th
                      :colspan="o.channels.length + 1"
                      class="py-2 px-3 text-center border-r border-slate-300 font-black tracking-wider uppercase"
                      :class="{
                        'bg-teal-100/70 text-teal-950': o.key === 'sudirman',
                        'bg-cyan-100/70 text-cyan-950': o.key === 'kwitang',
                        'bg-emerald-100/70 text-emerald-950': o.key === 'kuningan',
                        'bg-amber-100/70 text-amber-950': o.key === 'lebakBulus',
                        'bg-indigo-100/70 text-indigo-950': o.key === 'nomadic',
                        'bg-purple-100/70 text-purple-950': o.key === 'nusadua',
                        'bg-slate-200/80 text-slate-900': o.key === 'kelapaGading',
                      }"
                    >
                      {{ o.name }}
                    </th>
                  </template>
                  <th class="py-2 px-3 text-center bg-slate-300 text-slate-900 font-black min-w-[100px]">
                    DAY TOTAL
                  </th>
                </tr>

                <!-- Tier 2 Header: Channel & Payment Method Sub-headers -->
                <tr class="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-tight border-b border-slate-200">
                  <th class="py-2 px-3 text-left bg-slate-100 sticky left-0 z-30 border-r border-slate-300">
                    Date
                  </th>
                  <template v-for="o in visibleMatrixOutlets" :key="'sub-' + o.key">
                    <th v-for="ch in o.channels" :key="o.key + '-' + ch" class="py-1.5 px-2 font-mono whitespace-nowrap">
                      {{ ch }}
                    </th>
                    <th class="py-1.5 px-2 bg-slate-200/50 text-slate-900 font-black border-r border-slate-300">
                      TOTAL
                    </th>
                  </template>
                  <th class="py-1.5 px-2 bg-slate-200 font-black text-slate-900">
                    GRAND
                  </th>
                </tr>
              </thead>

              <!-- Table Body: Rows for each day -->
              <tbody class="divide-y divide-slate-100 font-mono text-[11px]">
                <tr
                  v-for="row in computedDailyMatrix.matrix"
                  :key="row.date"
                  class="hover:bg-teal-50/40 transition-colors"
                >
                  <!-- Date Column (Sticky Left) -->
                  <td class="py-2 px-3 text-left font-bold text-slate-900 bg-white sticky left-0 z-10 border-r border-slate-200 whitespace-nowrap">
                    {{ row.date }}
                  </td>

                  <!-- Outlets & Channels -->
                  <template v-for="o in visibleMatrixOutlets" :key="'val-' + o.key">
                    <td
                      v-for="ch in o.channels"
                      :key="'cval-' + o.key + '-' + ch"
                      class="py-2 px-2 whitespace-nowrap text-slate-600"
                      :class="row.outlets[o.key]?.[ch] > 0 ? 'text-slate-900 font-medium' : 'text-slate-300'"
                    >
                      {{ formatNumber(row.outlets[o.key]?.[ch]) }}
                    </td>
                    <!-- Outlet Subtotal for this day -->
                    <td class="py-2 px-2 whitespace-nowrap font-bold text-teal-900 bg-teal-50/30 border-r border-slate-200">
                      {{ formatNumber(row.outlets[o.key]?.total) }}
                    </td>
                  </template>

                  <!-- Day Grand Total across all outlets -->
                  <td class="py-2 px-2 whitespace-nowrap font-extrabold text-slate-950 bg-slate-100/70">
                    {{ formatNumber(visibleMatrixOutlets.reduce((acc, o) => acc + (row.outlets[o.key]?.total || 0), 0)) }}
                  </td>
                </tr>
              </tbody>

              <!-- Table Footer: TOTAL Row -->
              <tfoot class="bg-slate-200 text-slate-950 font-black font-mono text-xs border-t-2 border-slate-400 sticky bottom-0 z-20">
                <tr>
                  <td class="py-3 px-3 text-left bg-slate-300 sticky left-0 z-30 border-r border-slate-400">
                    TOTAL
                  </td>
                  <template v-for="o in visibleMatrixOutlets" :key="'tot-' + o.key">
                    <td v-for="ch in o.channels" :key="'totc-' + o.key + '-' + ch" class="py-3 px-2 whitespace-nowrap">
                      {{ formatNumber(computedDailyMatrix.totals[o.key]?.[ch]) }}
                    </td>
                    <td class="py-3 px-2 whitespace-nowrap bg-teal-200/60 text-teal-950 border-r border-slate-400">
                      {{ formatNumber(computedDailyMatrix.totals[o.key]?.total) }}
                    </td>
                  </template>
                  <td class="py-3 px-2 whitespace-nowrap bg-emerald-200 text-emerald-950">
                    {{ formatNumber(visibleMatrixOutlets.reduce((acc, o) => acc + (computedDailyMatrix.totals[o.key]?.total || 0), 0)) }}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      <!-- ============================================================= -->
      <!-- TAB 2 CONTENT: Weekly Product Sales by Category & Brand       -->
      <!-- ============================================================= -->
      <div v-if="activeViewTab === 'weeklyProducts'" class="p-5 space-y-4">
        <!-- Sub-filter bar for Weekly Products -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
          <div class="flex flex-wrap items-center gap-2">
            <!-- Category Selector -->
            <div>
              <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Filter Category:</label>
              <select
                v-model="weeklySelectedCategory"
                class="text-xs font-bold bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-slate-800 cursor-pointer focus:outline-none focus:border-teal-500"
              >
                <option value="all">All Categories (All 10 Categories)</option>
                <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
              </select>
            </div>

            <!-- Search by Product Variant -->
            <div>
              <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Search Variant / Brand:</label>
              <input
                v-model="weeklySearchQuery"
                type="text"
                placeholder="e.g. Bintang, Singaraja, Kura Kura..."
                class="text-xs bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-slate-800 focus:outline-none focus:border-teal-500 min-w-[200px]"
              />
            </div>
          </div>

          <div class="text-xs text-slate-500 font-medium">
            Showing {{ computedWeeklyMatrix.length }} product variants across 6 outlets
          </div>
        </div>

        <!-- Weekly Product Table -->
        <div class="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
          <div class="overflow-x-auto max-h-[620px] overflow-y-auto">
            <table class="w-full text-right text-xs text-slate-700 border-collapse">
              <!-- Tier 1 Header: Outlet Names -->
              <thead class="bg-slate-100 text-slate-800 font-extrabold border-b border-slate-300 sticky top-0 z-20">
                <tr>
                  <th class="py-2.5 px-3 text-left bg-slate-200 sticky left-0 z-30 min-w-[100px] border-r border-slate-300">
                    CATEGORY
                  </th>
                  <th class="py-2.5 px-3 text-left bg-slate-200 sticky left-[100px] z-30 min-w-[180px] border-r border-slate-300">
                    PRODUCT VARIANT / DETAIL
                  </th>
                  <th colspan="5" class="py-2 px-2 text-center bg-cyan-100/70 text-cyan-950 border-r border-slate-300">KWITANG</th>
                  <th colspan="5" class="py-2 px-2 text-center bg-teal-100/70 text-teal-950 border-r border-slate-300">SUDIRMAN</th>
                  <th colspan="5" class="py-2 px-2 text-center bg-emerald-100/70 text-emerald-950 border-r border-slate-300">KUNINGAN</th>
                  <th colspan="5" class="py-2 px-2 text-center bg-indigo-100/70 text-indigo-950 border-r border-slate-300">NOMADIC</th>
                  <th colspan="5" class="py-2 px-2 text-center bg-purple-100/70 text-purple-950 border-r border-slate-300">BALI</th>
                  <th colspan="5" class="py-2 px-2 text-center bg-amber-100/70 text-amber-950 border-r border-slate-300">LEBAK BULUS</th>
                  <th class="py-2 px-3 text-center bg-slate-300 text-slate-900 font-black min-w-[80px]">TOTAL</th>
                </tr>

                <!-- Tier 2 Header: Weeks I, II, III, IV, Total per outlet -->
                <tr class="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-tight border-b border-slate-200">
                  <th class="py-1.5 px-3 text-left bg-slate-100 sticky left-0 z-30 border-r border-slate-300">Type</th>
                  <th class="py-1.5 px-3 text-left bg-slate-100 sticky left-[100px] z-30 border-r border-slate-300">Brand / Name</th>
                  <!-- Kwitang -->
                  <th class="py-1 px-1.5">W1</th><th class="py-1 px-1.5">W2</th><th class="py-1 px-1.5">W3</th><th class="py-1 px-1.5">W4</th><th class="py-1 px-1.5 bg-cyan-50 font-bold border-r border-slate-200">Tot</th>
                  <!-- Sudirman -->
                  <th class="py-1 px-1.5">W1</th><th class="py-1 px-1.5">W2</th><th class="py-1 px-1.5">W3</th><th class="py-1 px-1.5">W4</th><th class="py-1 px-1.5 bg-teal-50 font-bold border-r border-slate-200">Tot</th>
                  <!-- Kuningan -->
                  <th class="py-1 px-1.5">W1</th><th class="py-1 px-1.5">W2</th><th class="py-1 px-1.5">W3</th><th class="py-1 px-1.5">W4</th><th class="py-1 px-1.5 bg-emerald-50 font-bold border-r border-slate-200">Tot</th>
                  <!-- Nomadic -->
                  <th class="py-1 px-1.5">W1</th><th class="py-1 px-1.5">W2</th><th class="py-1 px-1.5">W3</th><th class="py-1 px-1.5">W4</th><th class="py-1 px-1.5 bg-indigo-50 font-bold border-r border-slate-200">Tot</th>
                  <!-- Bali -->
                  <th class="py-1 px-1.5">W1</th><th class="py-1 px-1.5">W2</th><th class="py-1 px-1.5">W3</th><th class="py-1 px-1.5">W4</th><th class="py-1 px-1.5 bg-purple-50 font-bold border-r border-slate-200">Tot</th>
                  <!-- Lebak Bulus -->
                  <th class="py-1 px-1.5">W1</th><th class="py-1 px-1.5">W2</th><th class="py-1 px-1.5">W3</th><th class="py-1 px-1.5">W4</th><th class="py-1 px-1.5 bg-amber-50 font-bold border-r border-slate-200">Tot</th>
                  <!-- Grand -->
                  <th class="py-1 px-2 bg-slate-200 font-black text-slate-900">ALL</th>
                </tr>
              </thead>

              <!-- Table Body grouped by Category -->
              <tbody class="divide-y divide-slate-100 font-mono text-[11px]">
                <template v-for="catGroup in weeklyGroupedByCategory" :key="catGroup.category">
                  <!-- Category Header Separator Row -->
                  <tr class="bg-slate-100/90 font-sans font-black text-slate-800 text-xs">
                    <td colspan="33" class="py-2 px-3 text-left sticky left-0 z-10 bg-slate-100">
                      <span class="inline-flex items-center gap-1.5">
                        <span class="w-2.5 h-2.5 rounded-full bg-teal-500"></span>
                        <span>{{ catGroup.category }}</span>
                        <span class="text-slate-400 font-normal">({{ catGroup.items.length }} variants)</span>
                      </span>
                    </td>
                  </tr>

                  <!-- Item Rows -->
                  <tr
                    v-for="item in catGroup.items"
                    :key="item.detail"
                    class="hover:bg-slate-50/80 transition-colors"
                  >
                    <td class="py-1.5 px-3 text-left font-sans text-slate-500 text-[11px] bg-white sticky left-0 z-10 border-r border-slate-100">
                      {{ item.category }}
                    </td>
                    <td class="py-1.5 px-3 text-left font-sans font-bold text-slate-900 bg-white sticky left-[100px] z-10 border-r border-slate-200 whitespace-nowrap">
                      {{ item.detail }}
                    </td>

                    <!-- Kwitang -->
                    <td class="py-1.5 px-1.5" :class="item.kwitang[0] ? 'text-slate-900 font-medium' : 'text-slate-300'">{{ item.kwitang[0] || '-' }}</td>
                    <td class="py-1.5 px-1.5" :class="item.kwitang[1] ? 'text-slate-900 font-medium' : 'text-slate-300'">{{ item.kwitang[1] || '-' }}</td>
                    <td class="py-1.5 px-1.5" :class="item.kwitang[2] ? 'text-slate-900 font-medium' : 'text-slate-300'">{{ item.kwitang[2] || '-' }}</td>
                    <td class="py-1.5 px-1.5" :class="item.kwitang[3] ? 'text-slate-900 font-medium' : 'text-slate-300'">{{ item.kwitang[3] || '-' }}</td>
                    <td class="py-1.5 px-1.5 font-bold bg-cyan-50/40 text-cyan-950 border-r border-slate-200">{{ item.kwitang[4] || 0 }}</td>

                    <!-- Sudirman -->
                    <td class="py-1.5 px-1.5" :class="item.sudirman[0] ? 'text-slate-900 font-medium' : 'text-slate-300'">{{ item.sudirman[0] || '-' }}</td>
                    <td class="py-1.5 px-1.5" :class="item.sudirman[1] ? 'text-slate-900 font-medium' : 'text-slate-300'">{{ item.sudirman[1] || '-' }}</td>
                    <td class="py-1.5 px-1.5" :class="item.sudirman[2] ? 'text-slate-900 font-medium' : 'text-slate-300'">{{ item.sudirman[2] || '-' }}</td>
                    <td class="py-1.5 px-1.5" :class="item.sudirman[3] ? 'text-slate-900 font-medium' : 'text-slate-300'">{{ item.sudirman[3] || '-' }}</td>
                    <td class="py-1.5 px-1.5 font-bold bg-teal-50/40 text-teal-950 border-r border-slate-200">{{ item.sudirman[4] || 0 }}</td>

                    <!-- Kuningan -->
                    <td class="py-1.5 px-1.5" :class="item.kuningan[0] ? 'text-slate-900 font-medium' : 'text-slate-300'">{{ item.kuningan[0] || '-' }}</td>
                    <td class="py-1.5 px-1.5" :class="item.kuningan[1] ? 'text-slate-900 font-medium' : 'text-slate-300'">{{ item.kuningan[1] || '-' }}</td>
                    <td class="py-1.5 px-1.5" :class="item.kuningan[2] ? 'text-slate-900 font-medium' : 'text-slate-300'">{{ item.kuningan[2] || '-' }}</td>
                    <td class="py-1.5 px-1.5" :class="item.kuningan[3] ? 'text-slate-900 font-medium' : 'text-slate-300'">{{ item.kuningan[3] || '-' }}</td>
                    <td class="py-1.5 px-1.5 font-bold bg-emerald-50/40 text-emerald-950 border-r border-slate-200">{{ item.kuningan[4] || 0 }}</td>

                    <!-- Nomadic -->
                    <td class="py-1.5 px-1.5" :class="item.nomadic[0] ? 'text-slate-900 font-medium' : 'text-slate-300'">{{ item.nomadic[0] || '-' }}</td>
                    <td class="py-1.5 px-1.5" :class="item.nomadic[1] ? 'text-slate-900 font-medium' : 'text-slate-300'">{{ item.nomadic[1] || '-' }}</td>
                    <td class="py-1.5 px-1.5" :class="item.nomadic[2] ? 'text-slate-900 font-medium' : 'text-slate-300'">{{ item.nomadic[2] || '-' }}</td>
                    <td class="py-1.5 px-1.5" :class="item.nomadic[3] ? 'text-slate-900 font-medium' : 'text-slate-300'">{{ item.nomadic[3] || '-' }}</td>
                    <td class="py-1.5 px-1.5 font-bold bg-indigo-50/40 text-indigo-950 border-r border-slate-200">{{ item.nomadic[4] || 0 }}</td>

                    <!-- Bali -->
                    <td class="py-1.5 px-1.5" :class="item.bali[0] ? 'text-slate-900 font-medium' : 'text-slate-300'">{{ item.bali[0] || '-' }}</td>
                    <td class="py-1.5 px-1.5" :class="item.bali[1] ? 'text-slate-900 font-medium' : 'text-slate-300'">{{ item.bali[1] || '-' }}</td>
                    <td class="py-1.5 px-1.5" :class="item.bali[2] ? 'text-slate-900 font-medium' : 'text-slate-300'">{{ item.bali[2] || '-' }}</td>
                    <td class="py-1.5 px-1.5" :class="item.bali[3] ? 'text-slate-900 font-medium' : 'text-slate-300'">{{ item.bali[3] || '-' }}</td>
                    <td class="py-1.5 px-1.5 font-bold bg-purple-50/40 text-purple-950 border-r border-slate-200">{{ item.bali[4] || 0 }}</td>

                    <!-- Lebak Bulus -->
                    <td class="py-1.5 px-1.5" :class="item.lebakBulus[0] ? 'text-slate-900 font-medium' : 'text-slate-300'">{{ item.lebakBulus[0] || '-' }}</td>
                    <td class="py-1.5 px-1.5" :class="item.lebakBulus[1] ? 'text-slate-900 font-medium' : 'text-slate-300'">{{ item.lebakBulus[1] || '-' }}</td>
                    <td class="py-1.5 px-1.5" :class="item.lebakBulus[2] ? 'text-slate-900 font-medium' : 'text-slate-300'">{{ item.lebakBulus[2] || '-' }}</td>
                    <td class="py-1.5 px-1.5" :class="item.lebakBulus[3] ? 'text-slate-900 font-medium' : 'text-slate-300'">{{ item.lebakBulus[3] || '-' }}</td>
                    <td class="py-1.5 px-1.5 font-bold bg-amber-50/40 text-amber-950 border-r border-slate-200">{{ item.lebakBulus[4] || 0 }}</td>

                    <!-- Row Grand Total -->
                    <td class="py-1.5 px-2 font-black text-slate-950 bg-slate-100/70">
                      {{ (item.kwitang[4] + item.sudirman[4] + item.kuningan[4] + item.nomadic[4] + item.bali[4] + item.lebakBulus[4]) }}
                    </td>
                  </tr>

                  <!-- Category Subtotal Row -->
                  <tr class="bg-slate-50 font-bold text-slate-900 text-[11px] border-b border-slate-200">
                    <td colspan="2" class="py-1.5 px-3 text-left sticky left-0 z-10 bg-slate-100 border-r border-slate-200">
                      Subtotal {{ catGroup.category }}
                    </td>
                    <td colspan="4"></td>
                    <td class="py-1.5 px-1.5 font-black bg-cyan-100/60 text-cyan-950 border-r border-slate-200">{{ catGroup.subtotal.kwitang }}</td>
                    <td colspan="4"></td>
                    <td class="py-1.5 px-1.5 font-black bg-teal-100/60 text-teal-950 border-r border-slate-200">{{ catGroup.subtotal.sudirman }}</td>
                    <td colspan="4"></td>
                    <td class="py-1.5 px-1.5 font-black bg-emerald-100/60 text-emerald-950 border-r border-slate-200">{{ catGroup.subtotal.kuningan }}</td>
                    <td colspan="4"></td>
                    <td class="py-1.5 px-1.5 font-black bg-indigo-100/60 text-indigo-950 border-r border-slate-200">{{ catGroup.subtotal.nomadic }}</td>
                    <td colspan="4"></td>
                    <td class="py-1.5 px-1.5 font-black bg-purple-100/60 text-purple-950 border-r border-slate-200">{{ catGroup.subtotal.bali }}</td>
                    <td colspan="4"></td>
                    <td class="py-1.5 px-1.5 font-black bg-amber-100/60 text-amber-950 border-r border-slate-200">{{ catGroup.subtotal.lebakBulus }}</td>
                    <td class="py-1.5 px-2 font-black bg-slate-200 text-slate-950">{{ catGroup.subtotal.total }}</td>
                  </tr>
                </template>
              </tbody>

              <!-- Table Footer: TOTAL Row -->
              <tfoot class="bg-slate-200 text-slate-950 font-black font-mono text-xs border-t-2 border-slate-400 sticky bottom-0 z-20">
                <tr>
                  <td colspan="2" class="py-3 px-3 text-left bg-slate-300 sticky left-0 z-30 border-r border-slate-400">
                    OVERALL TOTAL UNITS
                  </td>
                  <td colspan="4"></td>
                  <td class="py-3 px-1.5 bg-cyan-200 text-cyan-950 border-r border-slate-400">1,749</td>
                  <td colspan="4"></td>
                  <td class="py-3 px-1.5 bg-teal-200 text-teal-950 border-r border-slate-400">2,501</td>
                  <td colspan="4"></td>
                  <td class="py-3 px-1.5 bg-emerald-200 text-emerald-950 border-r border-slate-400">1,734</td>
                  <td colspan="4"></td>
                  <td class="py-3 px-1.5 bg-indigo-200 text-indigo-950 border-r border-slate-400">659</td>
                  <td colspan="4"></td>
                  <td class="py-3 px-1.5 bg-purple-200 text-purple-950 border-r border-slate-400">54</td>
                  <td colspan="4"></td>
                  <td class="py-3 px-1.5 bg-amber-200 text-amber-950 border-r border-slate-400">1,941</td>
                  <td class="py-3 px-2 bg-emerald-300 text-emerald-950">8,638</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      <!-- ============================================================= -->
      <!-- TAB 3 CONTENT: Promo Sales Performance                        -->
      <!-- ============================================================= -->
      <div v-if="activeViewTab === 'promoReport'" class="p-5 space-y-4">
        <!-- Sub-filter bar for Promo -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
          <div class="flex flex-wrap items-center gap-2">
            <!-- Month Filter -->
            <div>
              <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Filter Month:</label>
              <select
                v-model="promoSelectedMonth"
                class="text-xs font-bold bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-slate-800 cursor-pointer focus:outline-none focus:border-teal-500"
              >
                <option value="all">All Months (May - Oct 2026)</option>
                <option value="May">May 2026</option>
                <option value="June">June 2026</option>
                <option value="July">July 2026</option>
                <option value="August">August 2026</option>
                <option value="September">September 2026</option>
                <option value="October">October 2026</option>
              </select>
            </div>

            <!-- Outlet Filter -->
            <div>
              <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Filter Outlet:</label>
              <select
                v-model="promoSelectedOutlet"
                class="text-xs font-bold bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-slate-800 cursor-pointer focus:outline-none focus:border-teal-500"
              >
                <option value="all">All Outlets</option>
                <option value="SUDIRMAN">Sudirman</option>
                <option value="KWITANG">Kwitang</option>
                <option value="KUNINGAN">Kuningan</option>
                <option value="LEBAK BULUS">Lebak Bulus</option>
                <option value="NOMADIC">Nomadic (Bandung)</option>
              </select>
            </div>

            <!-- Promo Search -->
            <div>
              <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Search Promo Name:</label>
              <input
                v-model="promoSearchQuery"
                type="text"
                placeholder="e.g. SINGARAJA, BINTANG, WIJA..."
                class="text-xs bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-slate-800 focus:outline-none focus:border-teal-500 min-w-[200px]"
              />
            </div>
          </div>

          <div class="text-xs text-slate-500 font-medium">
            Showing {{ computedPromoRecords.length }} promo campaign periods
          </div>
        </div>

        <!-- Promo Summary Cards -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div class="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200">
            <span class="text-[10px] font-bold uppercase tracking-wider text-amber-800 block">Total Promo Units</span>
            <span class="text-xl font-black text-amber-950 mt-1 block">{{ promoSummaryTotals.grandTotal.toLocaleString('id-ID') }}</span>
          </div>
          <div class="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-200">
            <span class="text-[10px] font-bold uppercase tracking-wider text-blue-800 block">Dine In / On-Premise</span>
            <span class="text-xl font-black text-blue-950 mt-1 block">{{ (promoSummaryTotals.dineIn + promoSummaryTotals.takeAway).toLocaleString('id-ID') }}</span>
          </div>
          <div class="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200">
            <span class="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">Food Delivery Channels</span>
            <span class="text-xl font-black text-emerald-950 mt-1 block">{{ (promoSummaryTotals.gofood + promoSummaryTotals.grabfood + promoSummaryTotals.shopeefood).toLocaleString('id-ID') }}</span>
          </div>
          <div class="p-3.5 rounded-2xl bg-purple-50/70 border border-purple-200">
            <span class="text-[10px] font-bold uppercase tracking-wider text-purple-800 block">Direct & WA Order</span>
            <span class="text-xl font-black text-purple-950 mt-1 block">{{ (promoSummaryTotals.waOrder + promoSummaryTotals.grabmart).toLocaleString('id-ID') }}</span>
          </div>
        </div>

        <!-- Promo Report Table -->
        <div class="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
          <div class="overflow-x-auto max-h-[620px] overflow-y-auto">
            <table class="w-full text-left text-xs text-slate-700 border-collapse">
              <thead class="bg-slate-100 text-[11px] font-extrabold text-slate-700 uppercase tracking-wider border-b border-slate-300 sticky top-0 z-20">
                <tr>
                  <th class="py-3 px-3">Month</th>
                  <th class="py-3 px-3">Date Range</th>
                  <th class="py-3 px-3">Outlet</th>
                  <th class="py-3 px-4">Menu Promo</th>
                  <th class="py-3 px-2 text-right">GoFood</th>
                  <th class="py-3 px-2 text-right">GrabFood</th>
                  <th class="py-3 px-2 text-right">GrabMart</th>
                  <th class="py-3 px-2 text-right">Shopee</th>
                  <th class="py-3 px-2 text-right">Dine In</th>
                  <th class="py-3 px-2 text-right">Take Away</th>
                  <th class="py-3 px-2 text-right">WA Order</th>
                  <th class="py-3 px-3 text-right bg-slate-200 text-slate-900 font-black">Grand Total</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 font-mono text-[11px]">
                <tr
                  v-for="(r, idx) in computedPromoRecords"
                  :key="idx"
                  class="hover:bg-slate-50 transition-colors"
                >
                  <td class="py-2.5 px-3 font-sans text-slate-500 whitespace-nowrap">{{ r.month }}</td>
                  <td class="py-2.5 px-3 font-sans text-slate-600 whitespace-nowrap text-[10px]">{{ r.fromDate }} - {{ r.toDate }}</td>
                  <td class="py-2.5 px-3 font-sans font-bold">
                    <span
                      class="px-2 py-0.5 rounded-md text-[10px] font-extrabold"
                      :class="{
                        'bg-teal-50 text-teal-800 border border-teal-200': r.outlet.includes('SUDIRMAN'),
                        'bg-cyan-50 text-cyan-800 border border-cyan-200': r.outlet.includes('KWITANG'),
                        'bg-emerald-50 text-emerald-800 border border-emerald-200': r.outlet.includes('KUNINGAN'),
                        'bg-amber-50 text-amber-800 border border-amber-200': r.outlet.includes('LEBAK BULUS'),
                        'bg-indigo-50 text-indigo-800 border border-indigo-200': r.outlet.includes('NOMADIC'),
                      }"
                    >
                      {{ r.outlet }}
                    </span>
                  </td>
                  <td class="py-2.5 px-4 font-sans font-bold text-slate-900">{{ r.promo }}</td>
                  <td class="py-2.5 px-2 text-right" :class="r.gofood ? 'text-slate-900 font-bold' : 'text-slate-300'">{{ r.gofood || '-' }}</td>
                  <td class="py-2.5 px-2 text-right" :class="r.grabfood ? 'text-slate-900 font-bold' : 'text-slate-300'">{{ r.grabfood || '-' }}</td>
                  <td class="py-2.5 px-2 text-right" :class="r.grabmart ? 'text-slate-900 font-bold' : 'text-slate-300'">{{ r.grabmart || '-' }}</td>
                  <td class="py-2.5 px-2 text-right" :class="r.shopeefood ? 'text-slate-900 font-bold' : 'text-slate-300'">{{ r.shopeefood || '-' }}</td>
                  <td class="py-2.5 px-2 text-right" :class="r.dineIn ? 'text-slate-900 font-bold' : 'text-slate-300'">{{ r.dineIn || '-' }}</td>
                  <td class="py-2.5 px-2 text-right" :class="r.takeAway ? 'text-slate-900 font-bold' : 'text-slate-300'">{{ r.takeAway || '-' }}</td>
                  <td class="py-2.5 px-2 text-right" :class="r.waOrder ? 'text-slate-900 font-bold' : 'text-slate-300'">{{ r.waOrder || '-' }}</td>
                  <td class="py-2.5 px-3 text-right font-black text-amber-900 bg-amber-50/50">{{ r.grandTotal }}</td>
                </tr>
              </tbody>
              <tfoot class="bg-slate-200 text-slate-950 font-black font-mono text-xs border-t-2 border-slate-400 sticky bottom-0 z-20">
                <tr>
                  <td colspan="4" class="py-3 px-3 text-left bg-slate-300">
                    TOTAL PROMO UNITS SOLD
                  </td>
                  <td class="py-3 px-2 text-right">{{ promoSummaryTotals.gofood }}</td>
                  <td class="py-3 px-2 text-right">{{ promoSummaryTotals.grabfood }}</td>
                  <td class="py-3 px-2 text-right">{{ promoSummaryTotals.grabmart }}</td>
                  <td class="py-3 px-2 text-right">{{ promoSummaryTotals.shopeefood }}</td>
                  <td class="py-3 px-2 text-right">{{ promoSummaryTotals.dineIn }}</td>
                  <td class="py-3 px-2 text-right">{{ promoSummaryTotals.takeAway }}</td>
                  <td class="py-3 px-2 text-right">{{ promoSummaryTotals.waOrder }}</td>
                  <td class="py-3 px-3 text-right bg-amber-200 text-amber-950">{{ promoSummaryTotals.grandTotal }}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      <!-- ============================================================= -->
      <!-- TAB 4 CONTENT: Raw Itemized Sales Transactions Table          -->
      <!-- ============================================================= -->
      <div v-if="activeViewTab === 'table'" class="p-5 space-y-4">
        <!-- Search & Filter bar for raw table -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
          <div class="flex flex-wrap items-center gap-2">
            <!-- Store filter -->
            <select
              v-model="selectedStoreId"
              @change="loadSalesReport"
              class="text-xs font-bold bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-slate-800 cursor-pointer focus:outline-none focus:border-teal-500"
            >
              <option value="all">All Stores</option>
              <option v-for="s in availableStores" :key="s.id" :value="s.id">{{ s.name }}</option>
            </select>

            <!-- Search input -->
            <input
              v-model="searchQuery"
              @input="loadSalesReport"
              type="text"
              placeholder="Search product, bill, or cashier..."
              class="text-xs bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-slate-800 focus:outline-none focus:border-teal-500 min-w-[220px]"
            />
          </div>

          <div class="text-xs text-slate-500 font-medium">
            Showing {{ transactions.length }} rows matching filters
          </div>
        </div>

        <!-- Raw Transactions Table with the 10 User-Specified Columns -->
        <div class="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
          <div class="overflow-x-auto max-h-[620px] overflow-y-auto">
            <table class="w-full text-left text-xs text-slate-700 border-collapse">
              <thead class="bg-slate-50 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider border-b border-slate-200 sticky top-0 z-20">
                <tr>
                  <th class="py-3 px-3 w-10 text-center">No</th>
                  <th class="py-3 px-3">Sales Date</th>
                  <th class="py-3 px-3">Sales Date In (Time)</th>
                  <th class="py-3 px-3">Branch</th>
                  <th class="py-3 px-3">Visit Purpose</th>
                  <th class="py-3 px-3">Payment Method</th>
                  <th class="py-3 px-3">Menu Category</th>
                  <th class="py-3 px-4">Menu Category Detail (Brand)</th>
                  <th class="py-3 px-4">Menu (Variant)</th>
                  <th class="py-3 px-2 text-center">Qty</th>
                  <th class="py-3 px-3 text-right">Price</th>
                  <th class="py-3 px-3 text-right font-black text-slate-900">Total</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <tr
                  v-for="(tx, index) in transactions"
                  :key="tx.id || index"
                  class="hover:bg-slate-50/80 transition-colors"
                >
                  <td class="py-2.5 px-3 text-center font-mono text-slate-400 text-[11px]">{{ index + 1 }}</td>
                  <td class="py-2.5 px-3 text-slate-700 whitespace-nowrap font-mono text-[11px]">
                    {{ tx.sales_date || (tx.date ? String(tx.date).slice(0, 10) : '-') }}
                  </td>
                  <td class="py-2.5 px-3 text-slate-500 whitespace-nowrap text-[11px]">
                    {{ formatSimpleDate(tx.sales_date_in || tx.date) }}
                  </td>
                  <td class="py-2.5 px-3">
                    <span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-800 whitespace-nowrap">
                      {{ tx.store_name || tx.branch }}
                    </span>
                  </td>
                  <td class="py-2.5 px-3 whitespace-nowrap">
                    <span
                      class="px-2 py-0.5 rounded-full text-[10px] font-bold"
                      :class="{
                        'bg-blue-50 text-blue-700 border border-blue-200': (tx.visit_purpose || '').includes('DINE IN'),
                        'bg-orange-50 text-orange-700 border border-orange-200': (tx.visit_purpose || '').includes('SHOPEE'),
                        'bg-emerald-50 text-emerald-700 border border-emerald-200': (tx.visit_purpose || '').includes('GOFOOD'),
                        'bg-green-50 text-green-700 border border-green-200': (tx.visit_purpose || '').includes('GRAB'),
                        'bg-indigo-50 text-indigo-700 border border-indigo-200': (tx.visit_purpose || '').includes('WA'),
                      }"
                    >
                      {{ tx.visit_purpose || 'DINE IN' }}
                    </span>
                  </td>
                  <td class="py-2.5 px-3">
                    <span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 whitespace-nowrap">
                      {{ tx.payment_method || 'QRIS' }}
                    </span>
                  </td>
                  <td class="py-2.5 px-3 whitespace-nowrap">
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">
                      {{ tx.category || tx.menu_category || 'Beverage' }}
                    </span>
                  </td>
                  <td class="py-2.5 px-4 font-bold text-teal-800 whitespace-nowrap">
                    {{ tx.brand || tx.menu_category_detail || '-' }}
                  </td>
                  <td class="py-2.5 px-4 font-bold text-slate-900">
                    {{ tx.item_name || tx.variant || tx.menu }}
                  </td>
                  <td class="py-2.5 px-2 text-center font-extrabold text-teal-800 font-mono text-sm">
                    {{ tx.qty }}
                  </td>
                  <td class="py-2.5 px-3 text-right font-mono text-slate-600 text-xs whitespace-nowrap">
                    {{ formatRupiah(tx.unit_price || tx.price) }}
                  </td>
                  <td class="py-2.5 px-3 text-right font-mono font-black text-slate-900 text-xs whitespace-nowrap">
                    {{ formatRupiah(tx.total || (tx.qty * tx.unit_price)) }}
                  </td>
                </tr>

                <!-- Empty State -->
                <tr v-if="transactions.length === 0">
                  <td colspan="12" class="py-16 text-center">
                    <div class="max-w-md mx-auto space-y-3">
                      <div class="w-14 h-14 rounded-2xl bg-teal-50 border border-teal-200 text-teal-600 flex items-center justify-center mx-auto shadow-xs">
                        <UploadCloud class="w-7 h-7 text-teal-600" />
                      </div>
                      <h4 class="font-extrabold text-slate-800 text-base">No Raw Transactions Found</h4>
                      <p class="text-xs text-slate-500">
                        Upload your ESB Sales Recapitulation CSV using the button above to view line-by-line sales, or view the cross-table matrices in the other tabs.
                      </p>
                      <button
                        @click="isUploadModalOpen = true"
                        type="button"
                        class="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
                      >
                        Upload Sales CSV Now
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- Upload Sales CSV Modal Component -->
    <UploadSalesCsvModal
      :is-open="isUploadModalOpen"
      :stores="availableStores"
      @close="isUploadModalOpen = false"
      @imported="handleCsvImported"
    />
  </div>
</template>
