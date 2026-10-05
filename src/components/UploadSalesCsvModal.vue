<script setup>
import { ref, computed } from 'vue';
import {
  X,
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Download,
  ArrowRight,
  Database,
  Building2,
  DollarSign,
  Package,
  Layers
} from 'lucide-vue-next';

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false,
  },
  stores: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits(['close', 'imported']);

const file = ref(null);
const fileName = ref('');
const fileSize = ref('');
const isDragging = ref(false);
const isParsing = ref(false);
const isUploading = ref(false);
const parsedRows = ref([]);
const parseErrors = ref([]);
const uploadStatus = ref(null); // { success: boolean, message: string }

// Format Rupiah
function formatRupiah(amount) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

// Clean and parse numbers (handles "15.000", "Rp 15.000", "15,000.00", etc.)
function parseNumber(val) {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return val;
  let str = String(val).trim().replace(/Rp|IDR/gi, '').trim();
  
  // Indonesian format: 15.000 or 15.000,50
  if (str.includes('.') && !str.includes(',')) {
    // Check if dot is thousands separator (e.g. 15.000)
    const parts = str.split('.');
    if (parts.length > 1 && parts[parts.length - 1].length === 3) {
      str = str.replace(/\./g, '');
    }
  } else if (str.includes('.') && str.includes(',')) {
    // e.g. 15.000,50 -> dot is thousands, comma is decimal
    str = str.replace(/\./g, '').replace(',', '.');
  } else if (str.includes(',')) {
    // e.g. 15,000 or 15,5
    if (str.split(',')[1]?.length === 3) {
      str = str.replace(/,/g, '');
    } else {
      str = str.replace(',', '.');
    }
  }

  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

// Dynamically extract store branch from CSV and map to standard Birmas branches
function detectStore(storeName) {
  const raw = String(storeName || '').trim();
  if (!raw) return { id: 'birmas-kuningan', name: 'Birmas Kuningan' };
  const s = raw.toLowerCase();
  if (s.includes('sudirman')) return { id: 'birmas-sudirman', name: 'Birmas Sudirman' };
  if (s.includes('kwitang')) return { id: 'birmas-kwitang', name: 'Birmas Kwitang' };
  if (s.includes('kuningan') || s.includes('kunngan')) return { id: 'birmas-kuningan', name: 'Birmas Kuningan' };
  if (s.includes('lebak') || s.includes('bulus')) return { id: 'birmas-lebak-bulus', name: 'Birmas Lebak Bulus' };
  if (s.includes('gading') || s.includes('kgading')) return { id: 'birmas-kelapa-gading', name: 'Birmas Kelapa Gading' };
  if (s.includes('nomadic') || s.includes('bandung')) return { id: 'birmas-nomadic', name: 'Birmas Nomadic' };
  if (s.includes('nusa') || s.includes('bali')) return { id: 'birmas-nusadua', name: 'Birmas Nusa Dua' };

  // Title case fallback
  const formattedName = raw === raw.toUpperCase() && raw.length > 1
    ? raw.split(' ').map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ')
    : raw;

  const cleanId = raw.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return {
    id: cleanId ? `store-${cleanId}` : 'birmas-default',
    name: formattedName,
  };
}

// Parse CSV content into rows
function parseCSV(text) {
  const allLines = text.split(/\r\n|\n|\r/).filter((line) => line.trim().length > 0);
  if (allLines.length < 2) {
    throw new Error('CSV file contains no data rows or header.');
  }

  // Find the actual header line (ESB reports have 8-10 lines of metadata headers)
  let headerLineIndex = allLines.findIndex((line) => {
    const l = line.toLowerCase();
    return (l.includes('bill number') || l.includes('sales number')) && l.includes('branch');
  });

  if (headerLineIndex === -1) {
    // Fallback: look for general keywords
    headerLineIndex = allLines.findIndex((line) => {
      const l = line.toLowerCase();
      return l.includes('branch') && (l.includes('qty') || l.includes('price') || l.includes('menu'));
    });
  }

  if (headerLineIndex === -1) {
    headerLineIndex = 0; // standard fallback
  }

  // Detect delimiter: comma, semicolon, or tab from the header line
  const headerLine = allLines[headerLineIndex];
  let delimiter = ',';
  if ((headerLine.match(/;/g) || []).length > (headerLine.match(/,/g) || []).length) {
    delimiter = ';';
  } else if ((headerLine.match(/\t/g) || []).length > (headerLine.match(/,/g) || []).length) {
    delimiter = '\t';
  }

  // Split line handling quotes
  const splitLine = (line) => {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"' || char === "'") {
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim().replace(/^["']|["']$/g, ''));
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim().replace(/^["']|["']$/g, ''));
    return result;
  };

  const headers = splitLine(headerLine).map((h) => h.toLowerCase().trim().replace(/[\s_.-]+/g, ''));

  // Exact column matching for ESB Sales Recapitulation Detail Report
  const colIndex = {
    salesNo: headers.findIndex((h) => h === 'salesnumber' || h.includes('salesno')),
    billNo: headers.findIndex((h) => h === 'billnumber' || h.includes('bill') || h.includes('faktur') || h.includes('invoice')),
    salesDate: headers.findIndex((h) => h === 'salesdate' || h === 'sales_date'),
    salesDateIn: headers.findIndex((h) => h === 'salesdatein' || h === 'sales_date_in' || h.includes('datein') || h.includes('datetime') || h.includes('tanggal')),
    branch: headers.findIndex((h) => h === 'branch' || h.includes('cabang') || h.includes('store') || h.includes('outlet')),
    visitPurpose: headers.findIndex((h) => h === 'visitpurpose' || h === 'visit_purpose' || h.includes('ordermode') || h.includes('channel')),
    payment: headers.findIndex((h) => h === 'paymentmethod' || h === 'payment_method' || h.includes('pembayaran') || h.includes('payment')),
    menuCategory: headers.findIndex((h) => h === 'menucategory' || h === 'menu_category' || h === 'category' || h.includes('kategori')),
    menuCategoryDetail: headers.findIndex((h) => h === 'menucategorydetail' || h === 'menu_category_detail' || h === 'brand' || h.includes('categorydetail')),
    menu: headers.findIndex((h) => h === 'menu' || h === 'itemname' || h === 'product' || h.includes('namabarang')),
    qty: headers.findIndex((h) => h === 'qty' || h.includes('quantity') || h.includes('jumlah')),
    price: headers.findIndex((h) => h === 'price' || h.includes('harga') || h.includes('unitprice')),
    subtotal: headers.findIndex((h) => h === 'subtotal'),
    discount: headers.findIndex((h) => h === 'discount' || h.includes('diskon')),
    tax: headers.findIndex((h) => h === 'tax' || h === 'vat' || h.includes('pajak')),
    total: headers.findIndex((h) => h === 'total' || h === 'nettsales' || h.includes('totalbayar')),
    waiter: headers.findIndex((h) => h === 'waiter' || h === 'cashier' || h.includes('kasir')),
  };

  const parsed = [];
  for (let i = headerLineIndex + 1; i < allLines.length; i++) {
    const rawLine = allLines[i].trim();
    if (!rawLine) continue;
    
    // Ignore footer summary rows (e.g. "Discount Total Rounding", "Rounding Total", etc.)
    if (rawLine.startsWith(',,,,,') || rawLine.includes('Rounding') || rawLine.includes('Total Rounding') || rawLine.includes('Platform Fee Total')) {
      continue;
    }

    const cols = splitLine(rawLine);
    if (cols.length < 3) continue;

    const rawMenu = colIndex.menu !== -1 ? cols[colIndex.menu] : '';
    const rawBranch = colIndex.branch !== -1 ? cols[colIndex.branch] : '';
    const rawBillNo = colIndex.billNo !== -1 ? cols[colIndex.billNo] : '';
    const rawSalesNo = colIndex.salesNo !== -1 ? cols[colIndex.salesNo] : '';

    // If both menu and branch are empty, skip row
    if (!rawMenu && !rawBranch && !rawBillNo && !rawSalesNo) continue;

    const storeInfo = detectStore(rawBranch);

    const qty = parseNumber(colIndex.qty !== -1 ? cols[colIndex.qty] : 1) || 1;
    const unitPrice = parseNumber(colIndex.price !== -1 ? cols[colIndex.price] : 0);
    const discount = parseNumber(colIndex.discount !== -1 ? cols[colIndex.discount] : 0);
    const tax = parseNumber(colIndex.tax !== -1 ? cols[colIndex.tax] : 0);
    
    let subtotal = parseNumber(colIndex.subtotal !== -1 ? cols[colIndex.subtotal] : 0);
    if (!subtotal) subtotal = qty * unitPrice;

    let total = parseNumber(colIndex.total !== -1 ? cols[colIndex.total] : 0);
    if (!total) total = subtotal - discount + tax;

    const billNo = rawBillNo || rawSalesNo || `ESB-${Date.now()}-${i}`;
    const rawSalesDate = colIndex.salesDate !== -1 ? cols[colIndex.salesDate] : '';
    const rawSalesDateIn = colIndex.salesDateIn !== -1 ? cols[colIndex.salesDateIn] : '';
    const dateVal = rawSalesDateIn || rawSalesDate || new Date().toISOString();
    
    const visitPurpose = (colIndex.visitPurpose !== -1 ? cols[colIndex.visitPurpose] : '') || 'DINE IN';
    const payment = (colIndex.payment !== -1 ? cols[colIndex.payment] : '') || 'QRIS BCA';
    const category = (colIndex.menuCategory !== -1 ? cols[colIndex.menuCategory] : '') || 'Beverage';
    const brand = (colIndex.menuCategoryDetail !== -1 ? cols[colIndex.menuCategoryDetail] : '') || '';
    const menuVariant = (colIndex.menu !== -1 ? cols[colIndex.menu] : '') || `Retail Item #${i}`;
    const cashier = (colIndex.waiter !== -1 ? cols[colIndex.waiter] : '') || 'Kasir';

    parsed.push({
      id: `csv-${billNo}-${i}-${Date.now().toString(36)}`,
      bill_no: billNo,
      date: dateVal,
      sales_date: rawSalesDate || (dateVal ? dateVal.split(' ')[0] : ''),
      sales_date_in: rawSalesDateIn || dateVal,
      store_id: storeInfo.id,
      store_name: storeInfo.name,
      branch: storeInfo.name,
      item_name: menuVariant,
      variant: menuVariant,
      menu: menuVariant,
      brand: brand,
      menu_category_detail: brand,
      category: category,
      menu_category: category,
      barcode: '',
      qty,
      unit_price: unitPrice,
      price: unitPrice,
      discount,
      tax,
      subtotal,
      total,
      payment_method: payment,
      visit_purpose: visitPurpose,
      cashier,
    });
  }

  return parsed;
}

// Handle File Selection
function handleFileSelect(e) {
  const selectedFile = e.target.files?.[0] || e.dataTransfer?.files?.[0];
  if (!selectedFile) return;

  file.value = selectedFile;
  fileName.value = selectedFile.name;
  fileSize.value = (selectedFile.size / 1024).toFixed(1) + ' KB';
  parseErrors.value = [];
  uploadStatus.value = null;
  isParsing.value = true;

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const text = event.target?.result;
      const rows = parseCSV(text);
      if (rows.length === 0) {
        parseErrors.value = ['No valid transaction rows found in CSV. Please verify column headers.'];
      } else {
        parsedRows.value = rows;
      }
    } catch (err) {
      parseErrors.value = [err.message || 'Failed to parse CSV file.'];
    } finally {
      isParsing.value = false;
    }
  };
  reader.onerror = () => {
    parseErrors.value = ['Error reading file from disk.'];
    isParsing.value = false;
  };
  reader.readAsText(selectedFile);
}

// Computed stats of parsed CSV
const parsedStats = computed(() => {
  if (parsedRows.value.length === 0) return null;
  const uniqueBills = new Set(parsedRows.value.map((r) => r.bill_no)).size;
  const uniqueStores = new Set(parsedRows.value.map((r) => r.store_name));
  const totalUnits = parsedRows.value.reduce((acc, r) => acc + (r.qty || 0), 0);
  const totalGross = parsedRows.value.reduce((acc, r) => acc + (r.subtotal || 0), 0);
  const totalNet = parsedRows.value.reduce((acc, r) => acc + (r.total || 0), 0);

  return {
    rowCount: parsedRows.value.length,
    billCount: uniqueBills,
    stores: Array.from(uniqueStores),
    totalUnits,
    totalGross,
    totalNet,
  };
});

// Import into Dashboard (POST to /api/sales/push)
async function handleImport() {
  if (parsedRows.value.length === 0 || isUploading.value) return;

  isUploading.value = true;
  uploadStatus.value = null;

  try {
    const res = await fetch('/api/sales/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(parsedRows.value),
    });

    const data = await res.json();
    if (res.ok && data.success) {
      uploadStatus.value = {
        success: true,
        message: `Successfully imported ${data.count || parsedRows.value.length} sales records into the database!`,
      };
      emit('imported', parsedRows.value);
      setTimeout(() => {
        handleClose();
      }, 1500);
    } else {
      uploadStatus.value = {
        success: false,
        message: data.message || data.error || 'Server rejected the import.',
      };
    }
  } catch (err) {
    uploadStatus.value = {
      success: false,
      message: err.message || 'Network error while uploading transactions.',
    };
  } finally {
    isUploading.value = false;
  }
}

// Download Sample Template CSV for Admin Sales
function downloadSampleTemplate() {
  const headers = [
    'Bill No',
    'Date Time',
    'Store Name',
    'Item Name',
    'Variant',
    'Category',
    'Barcode',
    'Qty',
    'Unit Price',
    'Discount',
    'Tax',
    'Subtotal',
    'Total',
    'Payment Method',
    'Cashier'
  ];

  const sampleRows = [
    ['ESB-1002341', '2026-10-05 10:15:00', 'Birmas Kuningan', 'Original Cold Brew Coffee', '250ml Botol', 'Cold Brew', '899123456701', '2', '28000', '0', '0', '56000', '56000', 'QRIS BCA', 'Rian'],
    ['ESB-1002342', '2026-10-05 11:20:00', 'Birmas Sudirman', 'Kombucha Passionfruit', '330ml Can', 'Fermented Drink', '899123456702', '1', '35000', '5000', '0', '35000', '30000', 'GoPay', 'Maya'],
    ['ESB-1002343', '2026-10-05 12:05:00', 'Birmas Kwitang', 'Matcha Latte Oatmilk', '1 Liter', 'Milk Tea', '899123456703', '3', '45000', '0', '0', '135000', '135000', 'BCA Debit', 'Dedi'],
    ['ESB-1002344', '2026-10-05 13:40:00', 'Birmas Lebak Bulus', 'Earl Grey Milk Tea', '500ml', 'Tea', '899123456704', '1', '32000', '0', '0', '32000', '32000', 'ShopeePay', 'Siti'],
  ];

  const csvContent = 'data:text/csv;charset=utf-8,' +
    [headers.join(','), ...sampleRows.map((r) => r.join(','))].join('\n');

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `ESB_Sales_Recapitulation_Template_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function handleClose() {
  file.value = null;
  fileName.value = '';
  fileSize.value = '';
  parsedRows.value = [];
  parseErrors.value = [];
  uploadStatus.value = null;
  emit('close');
}
</script>

<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs transition-all"
    @click.self="handleClose"
  >
    <div class="bg-white rounded-3xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
      <!-- Modal Header -->
      <div class="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-2xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center shadow-xs">
            <FileSpreadsheet class="w-5 h-5 text-teal-700" />
          </div>
          <div>
            <h3 class="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <span>Import Sales Recapitulation (CSV)</span>
              <span class="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800">
                ESB Compatible
              </span>
            </h3>
            <p class="text-xs text-slate-500">
              Upload daily or monthly ESB Sales Recapitulation Detail to update live dashboard metrics.
            </p>
          </div>
        </div>

        <button
          @click="handleClose"
          class="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Modal Body -->
      <div class="p-6 overflow-y-auto space-y-5 text-sm">
        <!-- Drag & Drop Zone -->
        <div
          v-if="parsedRows.length === 0"
          class="relative border-2 border-dashed rounded-3xl p-8 text-center transition-all cursor-pointer"
          :class="isDragging ? 'border-teal-500 bg-teal-50/50 scale-[0.99]' : 'border-slate-300 hover:border-teal-400 bg-slate-50/30'"
          @dragover.prevent="isDragging = true"
          @dragleave.prevent="isDragging = false"
          @drop.prevent="isDragging = false; handleFileSelect($event)"
        >
          <input
            type="file"
            accept=".csv, .tsv, .txt, text/csv, application/vnd.ms-excel"
            class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            @change="handleFileSelect"
          />

          <div class="flex flex-col items-center justify-center gap-3">
            <div class="w-14 h-14 rounded-2xl bg-teal-100/70 text-teal-700 flex items-center justify-center shadow-inner">
              <UploadCloud class="w-7 h-7 text-teal-700" />
            </div>

            <div>
              <p class="text-sm font-bold text-slate-800">
                Click to browse or drag & drop your Sales CSV file
              </p>
              <p class="text-xs text-slate-500 mt-1">
                Supports ESB Sales Recapitulation Detail export (.csv, .tsv)
              </p>
            </div>

            <div class="flex items-center gap-3 mt-2">
              <button
                type="button"
                @click.stop="downloadSampleTemplate"
                class="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-teal-700 border border-slate-200 text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
              >
                <Download class="w-3.5 h-3.5" />
                <span>Download Sample Template</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Parsing Feedback / Errors -->
        <div v-if="parseErrors.length > 0" class="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs space-y-1">
          <div class="flex items-center gap-2 font-bold">
            <AlertCircle class="w-4 h-4 text-rose-600" />
            <span>CSV Parsing Failed</span>
          </div>
          <p v-for="(err, idx) in parseErrors" :key="idx" class="pl-6 text-rose-700">
            {{ err }}
          </p>
        </div>

        <!-- Parsed Summary & Preview -->
        <div v-if="parsedStats" class="space-y-4">
          <!-- File info header -->
          <div class="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
            <div class="flex items-center gap-2.5">
              <FileSpreadsheet class="w-5 h-5 text-teal-600" />
              <div>
                <p class="text-xs font-bold text-slate-900">{{ fileName }}</p>
                <p class="text-[11px] text-slate-500">{{ fileSize }} • Ready to import</p>
              </div>
            </div>
            <button
              @click="parsedRows = []; file = null; fileName = ''; uploadStatus = null;"
              class="text-xs font-bold text-slate-500 hover:text-rose-600 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors"
            >
              Choose Another File
            </button>
          </div>

          <!-- KPI Cards for the parsed batch -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div class="p-3.5 rounded-2xl bg-teal-50/60 border border-teal-200/70">
              <p class="text-[11px] font-bold uppercase tracking-wider text-teal-800">Total Items</p>
              <p class="text-xl font-extrabold text-teal-950 mt-1">{{ parsedStats.rowCount }}</p>
              <p class="text-[11px] text-teal-700 mt-0.5">{{ parsedStats.billCount }} Unique Invoices</p>
            </div>

            <div class="p-3.5 rounded-2xl bg-cyan-50/60 border border-cyan-200/70">
              <p class="text-[11px] font-bold uppercase tracking-wider text-cyan-800">Units Sold</p>
              <p class="text-xl font-extrabold text-cyan-950 mt-1">{{ parsedStats.totalUnits }}</p>
              <p class="text-[11px] text-cyan-700 mt-0.5">Physical bottles/packs</p>
            </div>

            <div class="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-200/70">
              <p class="text-[11px] font-bold uppercase tracking-wider text-emerald-800">Net Sales Total</p>
              <p class="text-lg font-extrabold text-emerald-950 mt-1 truncate">
                {{ formatRupiah(parsedStats.totalNet) }}
              </p>
              <p class="text-[11px] text-emerald-700 mt-0.5">After discounts & taxes</p>
            </div>

            <div class="p-3.5 rounded-2xl bg-indigo-50/60 border border-indigo-200/70">
              <p class="text-[11px] font-bold uppercase tracking-wider text-indigo-800">Stores</p>
              <p class="text-xl font-extrabold text-indigo-950 mt-1">{{ parsedStats.stores.length }}</p>
              <p class="text-[11px] text-indigo-700 mt-0.5 truncate">{{ parsedStats.stores.join(', ') }}</p>
            </div>
          </div>

          <!-- Preview Table (first 5 rows) -->
          <div>
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-bold text-slate-700">Preview (First 5 Rows)</span>
              <span class="text-[11px] text-slate-500">Total {{ parsedRows.length }} rows parsed</span>
            </div>

            <div class="border border-slate-200 rounded-2xl overflow-hidden max-h-56 overflow-y-auto">
              <table class="w-full text-left text-xs">
                <thead class="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 sticky top-0">
                  <tr>
                    <th class="py-2 px-3">Date / Bill No</th>
                    <th class="py-2 px-3">Branch</th>
                    <th class="py-2 px-3">Channel</th>
                    <th class="py-2 px-3">Brand & Product</th>
                    <th class="py-2 px-3 text-center">Qty</th>
                    <th class="py-2 px-3 text-right">Price</th>
                    <th class="py-2 px-3 text-right">Total</th>
                    <th class="py-2 px-3">Payment</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  <tr v-for="(row, idx) in parsedRows.slice(0, 6)" :key="idx" class="hover:bg-slate-50/70">
                    <td class="py-2 px-3">
                      <span class="font-mono font-bold text-slate-900 block">{{ row.bill_no }}</span>
                      <span class="text-[10px] text-slate-400 block">{{ row.date }}</span>
                    </td>
                    <td class="py-2 px-3">
                      <span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700">
                        {{ row.store_name }}
                      </span>
                    </td>
                    <td class="py-2 px-3">
                      <span
                        class="px-2 py-0.5 rounded-full text-[10px] font-bold"
                        :class="row.visit_purpose === 'DINE IN' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-amber-50 text-amber-700 border border-amber-200'"
                      >
                        {{ row.visit_purpose }}
                      </span>
                    </td>
                    <td class="py-2 px-3 text-slate-900">
                      <div class="flex items-center gap-1.5">
                        <span v-if="row.brand" class="px-1.5 py-0.2 rounded text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
                          {{ row.brand }}
                        </span>
                        <span class="font-bold truncate max-w-[180px]">{{ row.item_name }}</span>
                      </div>
                      <span v-if="row.category" class="text-slate-400 text-[10px] block mt-0.5">{{ row.category }}</span>
                    </td>
                    <td class="py-2 px-3 text-center font-bold text-teal-800">{{ row.qty }}</td>
                    <td class="py-2 px-3 text-right text-slate-600">{{ formatRupiah(row.unit_price) }}</td>
                    <td class="py-2 px-3 text-right font-extrabold text-slate-900">{{ formatRupiah(row.total) }}</td>
                    <td class="py-2 px-3 text-slate-600">
                      <span class="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 max-w-[120px] truncate block">
                        {{ row.payment_method }}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Status Message -->
          <div
            v-if="uploadStatus"
            class="p-3.5 rounded-2xl text-xs font-semibold flex items-center gap-2"
            :class="uploadStatus.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'"
          >
            <CheckCircle2 v-if="uploadStatus.success" class="w-4 h-4 text-emerald-600 shrink-0" />
            <AlertCircle v-else class="w-4 h-4 text-rose-600 shrink-0" />
            <span>{{ uploadStatus.message }}</span>
          </div>
        </div>
      </div>

      <!-- Modal Footer -->
      <div class="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
        <button
          type="button"
          @click="downloadSampleTemplate"
          class="text-xs font-bold text-slate-600 hover:text-teal-700 flex items-center gap-1.5 transition-colors"
        >
          <Download class="w-3.5 h-3.5" />
          <span>Get CSV Template</span>
        </button>

        <div class="flex items-center gap-2.5">
          <button
            type="button"
            @click="handleClose"
            class="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition-colors"
          >
            Cancel
          </button>

          <button
            v-if="parsedRows.length > 0"
            type="button"
            @click="handleImport"
            :disabled="isUploading"
            class="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-extrabold flex items-center gap-2 shadow-md shadow-teal-600/20 disabled:opacity-50 transition-all cursor-pointer"
          >
            <Database class="w-4 h-4" />
            <span>{{ isUploading ? 'Importing Transactions...' : `Import ${parsedRows.length} Rows to Dashboard` }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
