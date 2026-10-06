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
} from 'lucide-vue-next';
import UploadSalesCsvModal from '../components/UploadSalesCsvModal.vue';

const { currentUser, role, isSuperAdmin } = useAuth();

// Filters
const selectedStoreId = ref('all');
const selectedCategory = ref('all');
const selectedBrand = ref('all');
const selectedVisitPurpose = ref('all');
const selectedPayment = ref('all');
const searchQuery = ref('');
const datePreset = ref('7d');
const startDate = ref('');
const endDate = ref('');
const activeViewTab = ref('table'); // 'table' | 'byChannel' | 'byStore' | 'byBrand' | 'topItems' | 'byPayment'

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
  syncMessage.value = `Successfully imported ${rows.length} sales records from CSV!`;
}

// Stores list derived dynamically from uploaded sales data
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
  return Array.from(storeMap.entries()).map(([id, name]) => ({ id, name }));
});

// Categories list
const categories = computed(() => {
  const set = new Set();
  transactions.value.forEach((t) => {
    if (t.category) set.add(t.category);
  });
  return Array.from(set);
});

// Brands list
const brands = computed(() => {
  const set = new Set();
  transactions.value.forEach((t) => {
    if (t.brand) set.add(t.brand);
  });
  return Array.from(set);
});

// Visit Purposes / Channels list
const visitPurposes = computed(() => {
  const set = new Set();
  transactions.value.forEach((t) => {
    if (t.visit_purpose) set.add(t.visit_purpose);
  });
  return Array.from(set);
});

// Payment methods list
const paymentMethods = computed(() => {
  const set = new Set();
  transactions.value.forEach((t) => {
    if (t.payment_method) set.add(t.payment_method);
  });
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

// Format Date
function formatSimpleDate(isoString) {
  if (!isoString) return '-';
  try {
    const d = new Date(isoString);
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

// Date preset handler
function applyDatePreset(preset) {
  datePreset.value = preset;
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  if (preset === 'today') {
    startDate.value = todayStr;
    endDate.value = todayStr;
  } else if (preset === 'yesterday') {
    const yest = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yestStr = yest.toISOString().slice(0, 10);
    startDate.value = yestStr;
    endDate.value = yestStr;
  } else if (preset === '7d') {
    const past7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    startDate.value = past7.toISOString().slice(0, 10);
    endDate.value = todayStr;
  } else if (preset === '30d') {
    const past30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    startDate.value = past30.toISOString().slice(0, 10);
    endDate.value = todayStr;
  } else if (preset === 'all') {
    startDate.value = '';
    endDate.value = '';
  }
  loadSalesReport();
}

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

    const [txRes, sumRes] = await Promise.all([
      fetch(`/api/sales/report?${query.toString()}`).then((r) => r.json()),
      fetch(`/api/sales/summary?${query.toString()}`).then((r) => r.json()),
    ]);

    if (txRes.success) {
      transactions.value = txRes.transactions || [];
    }
    if (sumRes.success && sumRes.summary) {
      summary.value = sumRes.summary;
    }
  } catch (err) {
    console.error('Failed to load sales report:', err);
  } finally {
    isLoading.value = false;
  }
}

async function handleSyncFromBirmas() {
  isSyncing.value = true;
  syncMessage.value = '';
  try {
    const res = await fetch('/api/sales/sync-birmas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await res.json();
    if (data.success) {
      syncMessage.value = data.message || 'Sales data updated successfully!';
      await loadSalesReport();
    } else {
      syncMessage.value = data.message || 'Sync response received.';
    }
  } catch (err) {
    syncMessage.value = 'Sync notice: ' + err.message;
  } finally {
    isSyncing.value = false;
  }
}

function handleExportCSV() {
  if (transactions.value.length === 0) return;
  const rows = transactions.value.map((tx, idx) => ({
    'No': idx + 1,
    'Bill No': tx.bill_no,
    'Date Time': tx.date,
    'Branch': tx.store_name,
    'Channel': tx.visit_purpose || 'DINE IN',
    'Brand': tx.brand || '',
    'Product Name': tx.item_name,
    'Variant': tx.variant || '',
    'Category': tx.category || '',
    'Qty': tx.qty,
    'Unit Price': tx.unit_price,
    'Total': tx.total,
    'Payment Method': tx.payment_method,
    'Cashier': tx.cashier,
  }));

  const filename = `ESB_Sales_Recapitulation_${selectedStoreId.value}_${new Date().toISOString().slice(0, 10)}.csv`;
  exportToCSV(filename, rows);
}

onMounted(() => {
  applyDatePreset('7d');
});
</script>

<template>
  <div class="space-y-6">
    <!-- Top Bar: Header, Scope & Actions -->
    <div class="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
      <div>
        <div class="flex items-center gap-2.5">
          <div class="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-600 to-teal-600 text-white flex items-center justify-center shadow-md shadow-cyan-600/20">
            <TrendingUp class="w-5 h-5 text-white" />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h2 class="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
                ESB Sales Recapitulation Report
              </h2>
              <span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-teal-50 border border-teal-200 text-teal-800">
                All Stores Live
              </span>
              <span v-if="isSuperAdmin" class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 border border-purple-200 text-purple-700">
                Superadmin View
              </span>
              <span v-else class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 border border-blue-200 text-blue-700">
                Sales Admin
              </span>
            </div>
            <p class="text-xs text-slate-500 mt-0.5">
              Itemized sales detail and recapitulation from <code class="text-teal-700 font-mono text-[11px]">https://erp.esb.co.id/report/report-sales-recapitulation-detail</code>
            </p>
          </div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="flex flex-wrap items-center gap-2.5">
        <!-- Upload Sales CSV (Manual Upload for Sales Admin) -->
        <button
          @click="isUploadModalOpen = true"
          type="button"
          class="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold flex items-center gap-2 shadow-md shadow-teal-600/20 transition-all cursor-pointer"
          title="Upload ESB Sales Recapitulation CSV file"
        >
          <UploadCloud class="w-4 h-4" />
          <span>Upload Sales CSV</span>
        </button>

        <!-- Export CSV Button (Allowed for Sales Report) -->
        <button
          @click="handleExportCSV"
          :disabled="transactions.length === 0"
          type="button"
          class="px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
          title="Download sales recapitulation as CSV"
        >
          <Download class="w-3.5 h-3.5 text-emerald-600" />
          <span>Export CSV</span>
        </button>
      </div>
    </div>

    <!-- Sync notification banner -->
    <div
      v-if="syncMessage"
      class="p-3.5 rounded-2xl bg-teal-50 border border-teal-200 text-xs text-teal-900 font-medium flex items-center justify-between shadow-xs"
    >
      <div class="flex items-center gap-2">
        <CheckCircle2 class="w-4 h-4 text-teal-600 shrink-0" />
        <span>{{ syncMessage }}</span>
      </div>
      <button @click="syncMessage = ''" class="text-teal-700 hover:text-teal-900 font-bold text-xs p-1">
        ✕
      </button>
    </div>

    <!-- KPI Summary Metrics (Cards) -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <!-- Total Net Sales -->
      <div class="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs relative overflow-hidden">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Net Revenue</span>
          <div class="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <DollarSign class="w-4 h-4" />
          </div>
        </div>
        <div class="mt-3">
          <h3 class="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            {{ formatRupiah(summary.totalNetSales) }}
          </h3>
          <p class="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
            <span>Gross: {{ formatRupiah(summary.totalGrossSales) }}</span>
            <span v-if="summary.totalDiscounts > 0" class="text-rose-600 font-medium">(-{{ formatRupiah(summary.totalDiscounts) }})</span>
          </p>
        </div>
      </div>

      <!-- Total Bills / Receipts -->
      <div class="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs relative overflow-hidden">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold text-slate-500 uppercase tracking-wider">Transactions / Bills</span>
          <div class="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
            <Receipt class="w-4 h-4" />
          </div>
        </div>
        <div class="mt-3">
          <h3 class="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            {{ summary.totalBills.toLocaleString('id-ID') }} <span class="text-xs font-normal text-slate-400">bills</span>
          </h3>
          <p class="text-[11px] text-slate-500 mt-1">
            Average ticket: {{ summary.totalBills > 0 ? formatRupiah(Math.round(summary.totalNetSales / summary.totalBills)) : 'Rp 0' }}
          </p>
        </div>
      </div>

      <!-- Total Units Sold -->
      <div class="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs relative overflow-hidden">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Units Sold</span>
          <div class="w-8 h-8 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center">
            <Package class="w-4 h-4" />
          </div>
        </div>
        <div class="mt-3">
          <h3 class="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            {{ summary.totalUnitsSold.toLocaleString('id-ID') }} <span class="text-xs font-normal text-slate-400">items</span>
          </h3>
          <p class="text-[11px] text-slate-500 mt-1">
            Across {{ summary.totalLineItems }} line items
          </p>
        </div>
      </div>

      <!-- Stores Represented -->
      <div class="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs relative overflow-hidden">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold text-slate-500 uppercase tracking-wider">Stores Uploaded</span>
          <div class="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Store class="w-4 h-4" />
          </div>
        </div>
        <div class="mt-3">
          <h3 class="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            {{ availableStores.length }} <span class="text-xs font-normal text-slate-400">branches</span>
          </h3>
          <p class="text-[11px] text-slate-500 mt-1 truncate" :title="availableStores.map(s => s.name).join(', ')">
            {{ availableStores.length > 0 ? availableStores.map(s => s.name).join(', ') : 'Upload CSV to view branches' }}
          </p>
        </div>
      </div>
    </div>

    <!-- Filter & Search Toolbar -->
    <div class="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
      <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <!-- Store Selector: All Stores Included! -->
        <div class="flex flex-wrap items-center gap-3">
          <div>
            <label class="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Store Filter:</label>
            <div class="relative">
              <select
                v-model="selectedStoreId"
                @change="loadSalesReport"
                class="appearance-none pl-3 pr-8 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 cursor-pointer focus:outline-none focus:border-teal-500"
              >
                <option value="all">All Stores ({{ availableStores.length }} branches)</option>
                <option v-for="st in availableStores" :key="st.id" :value="st.id">
                  {{ st.name }}
                </option>
              </select>
              <ChevronDown class="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          <!-- Channel / Visit Purpose filter -->
          <div v-if="visitPurposes.length > 0">
            <label class="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Sales Channel:</label>
            <div class="relative">
              <select
                v-model="selectedVisitPurpose"
                @change="loadSalesReport"
                class="appearance-none pl-3 pr-8 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 cursor-pointer focus:outline-none focus:border-teal-500"
              >
                <option value="all">All Channels (Dine In & Delivery)</option>
                <option v-for="vp in visitPurposes" :key="vp" :value="vp">
                  {{ vp }}
                </option>
              </select>
              <ChevronDown class="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          <!-- Brand filter -->
          <div v-if="brands.length > 0">
            <label class="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Brand:</label>
            <div class="relative">
              <select
                v-model="selectedBrand"
                @change="loadSalesReport"
                class="appearance-none pl-3 pr-8 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 cursor-pointer focus:outline-none focus:border-teal-500"
              >
                <option value="all">All Brands</option>
                <option v-for="br in brands" :key="br" :value="br">
                  {{ br }}
                </option>
              </select>
              <ChevronDown class="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          <!-- Category filter -->
          <div v-if="categories.length > 0">
            <label class="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Category:</label>
            <div class="relative">
              <select
                v-model="selectedCategory"
                @change="loadSalesReport"
                class="appearance-none pl-3 pr-8 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 cursor-pointer focus:outline-none focus:border-teal-500"
              >
                <option value="all">All Categories</option>
                <option v-for="cat in categories" :key="cat" :value="cat">
                  {{ cat }}
                </option>
              </select>
              <ChevronDown class="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          <!-- Payment Method filter -->
          <div v-if="paymentMethods.length > 0">
            <label class="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Payment Method:</label>
            <div class="relative">
              <select
                v-model="selectedPayment"
                @change="loadSalesReport"
                class="appearance-none pl-3 pr-8 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 cursor-pointer focus:outline-none focus:border-teal-500"
              >
                <option value="all">All Payment Methods</option>
                <option v-for="pm in paymentMethods" :key="pm" :value="pm">
                  {{ pm }}
                </option>
              </select>
              <ChevronDown class="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>

        <!-- Date Range Presets -->
        <div>
          <label class="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Date Period:</label>
          <div class="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              @click="applyDatePreset('today')"
              type="button"
              class="px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer"
              :class="datePreset === 'today' ? 'bg-white text-teal-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'"
            >
              Today
            </button>
            <button
              @click="applyDatePreset('yesterday')"
              type="button"
              class="px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer"
              :class="datePreset === 'yesterday' ? 'bg-white text-teal-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'"
            >
              Yesterday
            </button>
            <button
              @click="applyDatePreset('7d')"
              type="button"
              class="px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer"
              :class="datePreset === '7d' ? 'bg-white text-teal-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'"
            >
              Last 7 Days
            </button>
            <button
              @click="applyDatePreset('30d')"
              type="button"
              class="px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer"
              :class="datePreset === '30d' ? 'bg-white text-teal-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'"
            >
              This Month
            </button>
            <button
              @click="applyDatePreset('all')"
              type="button"
              class="px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer"
              :class="datePreset === 'all' ? 'bg-white text-teal-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'"
            >
              All Time
            </button>
          </div>
        </div>
      </div>

      <!-- Search bar and custom date picker row -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
        <!-- Search bar -->
        <div class="relative flex-1 max-w-md">
          <Search class="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            v-model="searchQuery"
            @input="loadSalesReport"
            type="text"
            placeholder="Search by product, bill #, variant, or cashier..."
            class="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-teal-500"
          />
        </div>

        <!-- Custom Date range inputs -->
        <div class="flex items-center gap-2 text-xs text-slate-600">
          <Calendar class="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <input
            v-model="startDate"
            @change="datePreset = 'custom'; loadSalesReport()"
            type="date"
            class="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-700"
          />
          <span class="text-slate-400">to</span>
          <input
            v-model="endDate"
            @change="datePreset = 'custom'; loadSalesReport()"
            type="date"
            class="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-700"
          />
        </div>
      </div>
    </div>

    <!-- Main Content Tabs -->
    <div class="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden flex flex-col">
      <!-- Tab Header -->
      <div class="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
        <div class="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 self-start">
          <button
            @click="activeViewTab = 'table'"
            type="button"
            class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer"
            :class="activeViewTab === 'table' ? 'bg-white text-teal-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'"
          >
            Itemized Sales ({{ transactions.length }})
          </button>
          <button
            @click="activeViewTab = 'byChannel'"
            type="button"
            class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer"
            :class="activeViewTab === 'byChannel' ? 'bg-white text-teal-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'"
          >
            By Channel ({{ (summary.byChannel || []).length }})
          </button>
          <button
            @click="activeViewTab = 'byStore'"
            type="button"
            class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer"
            :class="activeViewTab === 'byStore' ? 'bg-white text-teal-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'"
          >
            By Branch ({{ (summary.byStore || []).length }})
          </button>
          <button
            @click="activeViewTab = 'byBrand'"
            type="button"
            class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer"
            :class="activeViewTab === 'byBrand' ? 'bg-white text-teal-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'"
          >
            By Brand ({{ (summary.byBrand || []).length }})
          </button>
          <button
            @click="activeViewTab = 'topItems'"
            type="button"
            class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer"
            :class="activeViewTab === 'topItems' ? 'bg-white text-teal-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'"
          >
            Top Products
          </button>
          <button
            @click="activeViewTab = 'byPayment'"
            type="button"
            class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer"
            :class="activeViewTab === 'byPayment' ? 'bg-white text-teal-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'"
          >
            Payment Methods
          </button>
        </div>

        <div class="text-xs text-slate-500 font-medium">
          Showing {{ transactions.length }} transactions
        </div>
      </div>

      <!-- TAB 1: Itemized Transactions Table (ESB Sales Recapitulation Detail) -->
      <div v-if="activeViewTab === 'table'" class="overflow-x-auto">
        <table class="w-full text-left text-xs text-slate-700 border-collapse">
          <thead class="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
            <tr>
              <th class="py-3 px-3 w-10 text-center">No</th>
              <th class="py-3 px-3">Date Time</th>
              <th class="py-3 px-3 font-mono">Bill Number</th>
              <th class="py-3 px-3">Branch</th>
              <th class="py-3 px-3">Channel (Visit)</th>
              <th class="py-3 px-4">Brand & Variant</th>
              <th class="py-3 px-3">Category</th>
              <th class="py-3 px-3 text-center">Qty</th>
              <th class="py-3 px-3 text-right">Price</th>
              <th class="py-3 px-3 text-right">Total (IDR)</th>
              <th class="py-3 px-3">Payment Method</th>
              <th class="py-3 px-3">Cashier</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr
              v-for="(tx, index) in transactions"
              :key="tx.id || index"
              class="hover:bg-slate-50/80 transition-colors"
            >
              <td class="py-3 px-3 text-center font-mono text-slate-400 text-[11px]">
                {{ index + 1 }}
              </td>
              <td class="py-3 px-3 text-slate-600 whitespace-nowrap text-[11px]">
                {{ formatSimpleDate(tx.date) }}
              </td>
              <td class="py-3 px-3 font-mono font-bold text-slate-900 text-[11px]">
                {{ tx.bill_no }}
              </td>
              <td class="py-3 px-3">
                <span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-800">
                  {{ tx.store_name }}
                </span>
              </td>
              <td class="py-3 px-3 whitespace-nowrap">
                <span
                  class="px-2 py-0.5 rounded-full text-[10px] font-bold"
                  :class="{
                    'bg-blue-50 text-blue-700 border border-blue-200': tx.visit_purpose === 'DINE IN',
                    'bg-orange-50 text-orange-700 border border-orange-200': tx.visit_purpose === 'SHOPEEFOOD',
                    'bg-emerald-50 text-emerald-700 border border-emerald-200': tx.visit_purpose === 'GOFOOD',
                    'bg-green-50 text-green-700 border border-green-200': tx.visit_purpose === 'GRABFOOD' || tx.visit_purpose === 'GRABMART',
                    'bg-indigo-50 text-indigo-700 border border-indigo-200': tx.visit_purpose === 'WA ORDER',
                    'bg-purple-50 text-purple-700 border border-purple-200': tx.visit_purpose === 'TEMAN',
                  }"
                >
                  {{ tx.visit_purpose || 'DINE IN' }}
                </span>
              </td>
              <td class="py-3 px-4">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span v-if="tx.brand" class="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-teal-50 text-teal-800 border border-teal-200">
                    {{ tx.brand }}
                  </span>
                  <span class="font-bold text-slate-900 text-xs">{{ tx.item_name }}</span>
                </div>
              </td>
              <td class="py-3 px-3 whitespace-nowrap">
                <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">
                  {{ tx.category || 'Beverage' }}
                </span>
              </td>
              <td class="py-3 px-3 text-center font-extrabold text-teal-800 font-mono text-sm">
                {{ tx.qty }}
              </td>
              <td class="py-3 px-3 text-right font-mono text-slate-600 text-xs">
                {{ formatRupiah(tx.unit_price) }}
              </td>
              <td class="py-3 px-3 text-right font-mono font-black text-slate-900 text-xs">
                {{ formatRupiah(tx.total) }}
              </td>
              <td class="py-3 px-3">
                <span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 max-w-[150px] truncate block" :title="tx.payment_method">
                  {{ tx.payment_method || 'QRIS' }}
                </span>
              </td>
              <td class="py-3 px-3 text-slate-500 text-[11px] whitespace-nowrap">
                {{ tx.cashier || 'Kasir' }}
              </td>
            </tr>

            <!-- Empty State -->
            <tr v-if="transactions.length === 0">
              <td colspan="12" class="py-16 text-center">
                <div class="max-w-md mx-auto space-y-3">
                  <div class="w-14 h-14 rounded-2xl bg-teal-50 border border-teal-200 text-teal-600 flex items-center justify-center mx-auto shadow-xs">
                    <UploadCloud class="w-7 h-7 text-teal-600" />
                  </div>
                  <h4 class="font-extrabold text-slate-800 text-base">Sales Table is Clean & Ready</h4>
                  <p class="text-xs text-slate-500">
                    No mock or hardcoded data. Upload your ESB Sales Recapitulation Detail CSV file to view real transactions, channel distributions, and brand reports.
                  </p>
                  <button
                    @click="isUploadModalOpen = true"
                    type="button"
                    class="mt-2 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-extrabold shadow-md shadow-teal-600/20 transition-all cursor-pointer"
                  >
                    <UploadCloud class="w-4 h-4" />
                    <span>Upload ESB Sales CSV</span>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- TAB 2: Sales by Channel (Visit Purpose) -->
      <div v-else-if="activeViewTab === 'byChannel'" class="p-6 space-y-5">
        <div class="flex items-center justify-between">
          <div>
            <h4 class="text-sm font-extrabold text-slate-900">Breakdown by Sales Channel (Visit Purpose)</h4>
            <p class="text-xs text-slate-500">Comparison of Dine-in vs Delivery platforms (ShopeeFood, GoFood, GrabFood, GrabMart, WA Order)</p>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div
            v-for="ch in summary.byChannel || []"
            :key="ch.channel"
            class="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex flex-col justify-between hover:shadow-xs transition-shadow"
          >
            <div>
              <div class="flex items-center justify-between mb-2">
                <span
                  class="px-2.5 py-1 rounded-full text-xs font-black tracking-wide"
                  :class="{
                    'bg-blue-100 text-blue-800': ch.channel === 'DINE IN',
                    'bg-orange-100 text-orange-800': ch.channel === 'SHOPEEFOOD',
                    'bg-emerald-100 text-emerald-800': ch.channel === 'GOFOOD',
                    'bg-green-100 text-green-800': ch.channel === 'GRABFOOD' || ch.channel === 'GRABMART',
                    'bg-indigo-100 text-indigo-800': ch.channel === 'WA ORDER',
                    'bg-purple-100 text-purple-800': ch.channel === 'TEMAN',
                  }"
                >
                  {{ ch.channel }}
                </span>
                <span class="text-xs font-mono font-bold text-slate-500">{{ ch.bills }} bills</span>
              </div>
              <div class="mt-4">
                <span class="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Total Revenue</span>
                <span class="text-xl font-black text-slate-900 font-mono">{{ formatRupiah(ch.revenue) }}</span>
              </div>
            </div>

            <div class="flex items-center justify-between pt-3 mt-4 border-t border-slate-200 text-xs">
              <span class="text-slate-500">Units Sold: <strong class="text-slate-800 font-mono">{{ ch.units }}</strong></span>
              <span class="text-slate-500">
                Share: <strong class="text-teal-700 font-mono">{{ summary.totalNetSales > 0 ? ((ch.revenue / summary.totalNetSales) * 100).toFixed(1) : 0 }}%</strong>
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- TAB 3: Sales by Store Location -->
      <div v-else-if="activeViewTab === 'byStore'" class="p-6 space-y-4">
        <h4 class="text-sm font-bold text-slate-900 mb-2">Revenue Breakdown by Store Location</h4>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div
            v-for="st in summary.byStore || []"
            :key="st.store_id"
            class="bg-slate-50 border border-slate-200 rounded-2xl p-5"
          >
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-2">
                <Building2 class="w-4 h-4 text-teal-600" />
                <span class="font-extrabold text-slate-900 text-sm">{{ st.store_name }}</span>
              </div>
              <span class="text-xs font-bold text-slate-500 font-mono">{{ st.bills }} bills</span>
            </div>
            <div class="flex items-baseline justify-between pt-2 border-t border-slate-200/80">
              <div>
                <span class="text-[11px] text-slate-500 uppercase tracking-wider block">Net Revenue</span>
                <span class="text-lg font-black text-emerald-700 font-mono">{{ formatRupiah(st.revenue) }}</span>
              </div>
              <div class="text-right">
                <span class="text-[11px] text-slate-500 uppercase tracking-wider block">Units Sold</span>
                <span class="text-sm font-bold text-slate-900 font-mono">{{ st.units }} units</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- TAB 4: Sales by Brand -->
      <div v-else-if="activeViewTab === 'byBrand'" class="p-6 space-y-4">
        <h4 class="text-sm font-bold text-slate-900 mb-2">Top Selling Product Brands (Menu Category Detail)</h4>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs border-collapse">
            <thead class="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th class="py-3 px-4 w-12 text-center">Rank</th>
                <th class="py-3 px-4">Brand Name</th>
                <th class="py-3 px-4">Category</th>
                <th class="py-3 px-4 text-center">Units Sold</th>
                <th class="py-3 px-4 text-right">Revenue</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="(b, idx) in summary.byBrand || []" :key="idx" class="hover:bg-slate-50">
                <td class="py-3 px-4 text-center font-bold text-teal-700 font-mono">#{{ idx + 1 }}</td>
                <td class="py-3 px-4 font-black text-slate-900">{{ b.brand }}</td>
                <td class="py-3 px-4">
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">
                    {{ b.category || 'Beverage' }}
                  </span>
                </td>
                <td class="py-3 px-4 text-center font-bold text-teal-800 font-mono">{{ b.units }}</td>
                <td class="py-3 px-4 text-right font-black text-slate-900 font-mono">{{ formatRupiah(b.revenue) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- TAB 5: Top Selling Products -->
      <div v-else-if="activeViewTab === 'topItems'" class="p-6 space-y-4">
        <h4 class="text-sm font-bold text-slate-900 mb-2">Top Selling Products (Menu Variants)</h4>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs border-collapse">
            <thead class="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th class="py-3 px-4 w-12 text-center">Rank</th>
                <th class="py-3 px-4">Brand</th>
                <th class="py-3 px-4">Menu Variant</th>
                <th class="py-3 px-4">Category</th>
                <th class="py-3 px-4 text-center">Units Sold</th>
                <th class="py-3 px-4 text-right">Total Revenue</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="(item, idx) in summary.topItems || []" :key="idx" class="hover:bg-slate-50">
                <td class="py-3 px-4 text-center font-bold text-teal-700 font-mono">#{{ idx + 1 }}</td>
                <td class="py-3 px-4">
                  <span v-if="item.brand" class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
                    {{ item.brand }}
                  </span>
                  <span v-else class="text-slate-400">-</span>
                </td>
                <td class="py-3 px-4 font-bold text-slate-900">{{ item.item_name }}</td>
                <td class="py-3 px-4">
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">
                    {{ item.category || 'Beverage' }}
                  </span>
                </td>
                <td class="py-3 px-4 text-center font-bold text-teal-800 font-mono">{{ item.totalQty }}</td>
                <td class="py-3 px-4 text-right font-bold text-emerald-700 font-mono">{{ formatRupiah(item.totalRevenue) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- TAB 6: Sales by Payment Method -->
      <div v-else-if="activeViewTab === 'byPayment'" class="p-6 space-y-4">
        <h4 class="text-sm font-bold text-slate-900 mb-2">Breakdown by Payment Method</h4>
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <div
            v-for="pm in summary.byPayment || []"
            :key="pm.payment_method"
            class="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col justify-between"
          >
            <div class="flex items-center justify-between mb-2">
              <span class="font-extrabold text-slate-900 text-xs flex items-center gap-1.5">
                <CreditCard class="w-3.5 h-3.5 text-teal-600" />
                {{ pm.payment_method }}
              </span>
              <span class="text-[11px] font-bold text-slate-500">{{ pm.count }} tx</span>
            </div>
            <div class="mt-2 pt-2 border-t border-slate-200">
              <span class="text-base font-black text-slate-900 font-mono">{{ formatRupiah(pm.totalAmount) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Upload Sales CSV Modal -->
    <UploadSalesCsvModal
      :is-open="isUploadModalOpen"
      :stores="availableStores"
      @close="isUploadModalOpen = false"
      @imported="handleCsvImported"
    />
  </div>
</template>
