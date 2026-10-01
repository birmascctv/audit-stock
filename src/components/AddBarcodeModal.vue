<script setup>
import { ref, computed, watch } from 'vue';
import { useAuditStore } from '../composables/useAuditStore.js';
import {
  Barcode,
  Plus,
  CheckCircle2,
  AlertTriangle,
  X,
  Building2,
  Sparkles,
  Link2,
  Package,
  Layers,
  FileSpreadsheet,
  AlertCircle
} from 'lucide-vue-next';

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false,
  },
  prefilledBarcode: {
    type: String,
    default: '',
  },
});

const emit = defineEmits(['close', 'barcodeAdded']);

const { stores, currentStore, wpProducts, addNewBarcode } = useAuditStore();

// Live Dynamic Product Variants from ESB Cloud
const esbProductList = computed(() => {
  if (!wpProducts.value || wpProducts.value.length === 0) return [];
  return [...wpProducts.value].sort((a, b) =>
    (a.productTitle || a.varian || '').localeCompare(b.productTitle || b.varian || '')
  );
});

const dynamicBrands = computed(() => {
  const set = new Set();
  esbProductList.value.forEach((p) => {
    if (p.brand) set.add(p.brand.trim());
  });
  return Array.from(set).sort();
});

const barcodeSourceType = ref('from_wp_variant');
const selectedProductId = ref('');

const barcodeInput = ref('');
const productTitleInput = ref('');
const brandInput = ref('');
const customBrand = ref('');
const varianInput = ref('');
const packageTypeInput = ref('Botol');
const volumeInput = ref(330);
const unitVolumeInput = ref('ml');
const wpIdInput = ref('');
const skuInput = ref('');
const priceInput = ref(0);

const mapAllStores = ref(false);
const currentStoreStock = ref(0);
const stockKuningan = ref(0);
const stockKwitang = ref(0);
const stockLebakBulus = ref(0);
const stockSudirman = ref(0);

const isSubmitting = ref(false);
const feedbackMessage = ref(null);

watch(
  () => props.prefilledBarcode,
  (newVal) => {
    if (newVal) barcodeInput.value = newVal;
  },
  { immediate: true }
);

watch(
  esbProductList,
  (list) => {
    if (list && list.length > 0 && !selectedProductId.value) {
      selectedProductId.value = list[0].id;
      handleSelectPreset(list[0].id);
    }
  },
  { immediate: true }
);

function handleSelectPreset(productId) {
  const item = esbProductList.value.find((p) => p.id === productId);
  if (!item) return;

  productTitleInput.value = item.productTitle || `${item.brand} ${item.varian}`;
  brandInput.value = item.brand || 'Birmas';
  varianInput.value = item.varian || item.productTitle;
  packageTypeInput.value = item.packageType || 'Botol';
  volumeInput.value = item.volume || 330;
  unitVolumeInput.value = item.unitVolume || 'ml';
  wpIdInput.value = item.id;
  priceInput.value = item.price || 0;
  skuInput.value = item.sku || `SKU-${item.id}`;
}

function handleSwitchSource(type) {
  barcodeSourceType.value = type;
  if (type === 'entirely_new') {
    productTitleInput.value = '';
    brandInput.value = dynamicBrands.value[0] || 'Birmas';
    varianInput.value = '';
    priceInput.value = 0;
    wpIdInput.value = '';
    skuInput.value = '';
  } else if (esbProductList.value.length > 0) {
    const first = esbProductList.value[0];
    selectedProductId.value = first.id;
    handleSelectPreset(first.id);
  }
}
    brandInput.value = 'Other';
    customBrand.value = '';
    varianInput.value = '';
    wpIdInput.value = '';
    skuInput.value = '';
    priceInput.value = 0;
  } else {
    handleSelectPreset(selectedPresetIndex.value);
  }
}

async function handleSubmit() {
  feedbackMessage.value = null;
  const cleanBarcode = barcodeInput.value.trim();

  if (!cleanBarcode) {
    feedbackMessage.value = { type: 'error', text: 'Please enter or scan a barcode!' };
    return;
  }

  const finalBrand = brandInput.value === 'Other' ? customBrand.value.trim() : brandInput.value;
  if (!finalBrand) {
    feedbackMessage.value = { type: 'error', text: 'Brand name is required!' };
    return;
  }

  if (!varianInput.value.trim()) {
    feedbackMessage.value = { type: 'error', text: 'Variant / Flavor name is required!' };
    return;
  }

  isSubmitting.value = true;

  const storeStocks = {};
  if (mapAllStores.value) {
    storeStocks['birmas-kuningan'] = Number(stockKuningan.value) || 0;
    storeStocks['birmas-kwitang'] = Number(stockKwitang.value) || 0;
    storeStocks['birmas-lebak-bulus'] = Number(stockLebakBulus.value) || 0;
    storeStocks['birmas-sudirman'] = Number(stockSudirman.value) || 0;
  } else {
    storeStocks[currentStore.value.id] = Number(currentStoreStock.value) || 0;
  }

  const payload = {
    barcode: cleanBarcode,
    brand: finalBrand,
    varian: varianInput.value.trim(),
    productTitle: productTitleInput.value.trim() || `${finalBrand} ${varianInput.value.trim()} ${packageTypeInput.value} ${volumeInput.value}${unitVolumeInput.value}`,
    packageType: packageTypeInput.value,
    volume: Number(volumeInput.value) || 330,
    unitVolume: unitVolumeInput.value || 'ml',
    wpId: wpIdInput.value.trim() || undefined,
    sku: skuInput.value.trim() || undefined,
    price: Number(priceInput.value) || 0,
    stockByStore: storeStocks,
  };

  try {
    const res = await addNewBarcode(payload);
    if (res.success) {
      feedbackMessage.value = {
        type: 'success',
        text: res.message || `Successfully registered barcode ${cleanBarcode}!`,
      };
      emit('barcodeAdded', cleanBarcode);

      setTimeout(() => {
        emit('close');
        barcodeInput.value = '';
        feedbackMessage.value = null;
      }, 1000);
    } else {
      feedbackMessage.value = { type: 'error', text: res.message || 'Failed to add barcode.' };
    }
  } catch (err) {
    feedbackMessage.value = { type: 'error', text: err.message || 'Network error' };
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
    @click.self="emit('close')"
  >
    <div class="bg-white border border-slate-200 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
      <!-- Header -->
      <div class="p-5 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center">
            <Plus class="w-5 h-5" />
          </div>
          <div>
            <h3 class="text-base font-extrabold text-slate-900">Add & Map New Barcode</h3>
            <p class="text-xs text-slate-500">
              Save new barcode into backend database (from WordPress Pods or new unlisted product)
            </p>
          </div>
        </div>

        <button
          @click="emit('close')"
          type="button"
          class="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Form Body -->
      <form @submit.prevent="handleSubmit" class="p-6 space-y-4 overflow-y-auto text-xs text-slate-700">
        <!-- 1. Barcode Field (Aim scanner or type) -->
        <div class="bg-teal-50/50 border border-teal-200 p-3.5 rounded-2xl">
          <label class="block text-teal-900 font-bold mb-1 flex items-center justify-between">
            <span class="flex items-center gap-1.5">
              <Barcode class="w-4 h-4 text-teal-600" />
              <span>Kode Barcode (Scan bottle with Barcode Scanner or type):</span>
            </span>
            <span class="text-[11px] text-teal-800 bg-teal-100 px-2 py-0.5 rounded font-mono font-bold">
              Scanner Ready
            </span>
          </label>
          <input
            v-model="barcodeInput"
            type="text"
            required
            autofocus
            placeholder="e.g. 8997026800122 (aim scanner at bottle)"
            class="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-mono text-base font-bold placeholder-slate-400 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
          />
          <p class="text-[11px] text-slate-500 mt-1">
            * This barcode is saved directly into this dashboard backend so future physical scans match immediately.
          </p>
        </div>

        <!-- Source Type Selector -->
        <div>
          <label class="block text-slate-800 font-bold mb-1.5">Select Product Source:</label>
          <div class="grid grid-cols-2 gap-2">
            <button
              type="button"
              @click="handleSwitchSource('from_wp_variant')"
              class="p-3 rounded-xl border text-left transition-all flex flex-col justify-between"
              :class="
                barcodeSourceType === 'from_wp_variant'
                  ? 'bg-teal-50/80 border-teal-500 text-teal-900 ring-2 ring-teal-500/20'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
              "
            >
              <span class="font-bold text-xs flex items-center gap-1.5">
                <Link2 class="w-3.5 h-3.5 text-teal-600" />
                <span>WordPress Pods Variant</span>
              </span>
              <span class="text-[10px] text-slate-500 mt-0.5">
                Link to an existing variant recorded in WordPress
              </span>
            </button>

            <button
              type="button"
              @click="handleSwitchSource('entirely_new')"
              class="p-3 rounded-xl border text-left transition-all flex flex-col justify-between"
              :class="
                barcodeSourceType === 'entirely_new'
                  ? 'bg-teal-50/80 border-teal-500 text-teal-900 ring-2 ring-teal-500/20'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
              "
            >
              <span class="font-bold text-xs flex items-center gap-1.5">
                <Sparkles class="w-3.5 h-3.5 text-teal-600" />
                <span>Entirely New Product (Unlisted in ESB)</span>
              </span>
              <span class="text-[10px] text-slate-500 mt-0.5">
                Not yet in ESB — auditor enters product info manually
              </span>
            </button>
          </div>
        </div>

        <!-- When "from_wp_variant": Dropdown of ESB Cloud variants -->
        <div v-if="barcodeSourceType === 'from_wp_variant'" class="bg-slate-50 p-3 rounded-xl border border-slate-200">
          <label class="block text-slate-800 font-semibold mb-1 flex items-center justify-between">
            <span>Choose ESB Product Variant:</span>
            <span class="text-[10px] text-teal-700 font-bold bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
              {{ esbProductList.length }} Products from ESB
            </span>
          </label>
          <select
            v-model="selectedProductId"
            @change="handleSelectPreset(selectedProductId)"
            class="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:border-teal-500 cursor-pointer text-xs"
          >
            <option
              v-for="p in esbProductList"
              :key="p.id"
              :value="p.id"
            >
              {{ p.productTitle || p.varian }} • {{ p.barcode ? `[Barcode: ${p.barcode}]` : '[No Barcode]' }} • Rp {{ (p.price || 0).toLocaleString() }}
            </option>
          </select>
        </div>

        <!-- Product Name, Brand & Variant -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block text-slate-700 font-semibold mb-1">Brand Name:</label>
            <select
              v-model="brandInput"
              class="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:border-teal-500"
            >
              <option v-for="b in dynamicBrands" :key="b" :value="b">{{ b }}</option>
              <option value="Other">Other / Custom Brand</option>
            </select>
            <input
              v-if="brandInput === 'Other'"
              v-model="customBrand"
              type="text"
              placeholder="Type brand name..."
              class="w-full mt-2 px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-slate-800 text-xs"
            />
          </div>

          <div>
            <label class="block text-slate-700 font-semibold mb-1">Variant / Flavor Name:</label>
            <input
              v-model="varianInput"
              type="text"
              required
              placeholder="e.g. Draught In Can, Lychee, Stout"
              class="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:border-teal-500"
            />
          </div>
        </div>

        <!-- Packaging, Volume & Price -->
        <div class="grid grid-cols-3 gap-3">
          <div>
            <label class="block text-slate-700 font-semibold mb-1">Packaging:</label>
            <select
              v-model="packageTypeInput"
              class="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-xl text-slate-800 focus:outline-none"
            >
              <option value="Kaleng">Kaleng</option>
              <option value="Botol">Botol</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <label class="block text-slate-700 font-semibold mb-1">Volume (ml):</label>
            <input
              v-model.number="volumeInput"
              type="number"
              placeholder="e.g. 330, 440, 620"
              class="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-xl text-slate-800 focus:outline-none"
            />
          </div>

          <div>
            <label class="block text-slate-700 font-semibold mb-1">Price (Rp):</label>
            <input
              v-model.number="priceInput"
              type="number"
              placeholder="e.g. 35000"
              class="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-xl text-slate-800 font-mono focus:outline-none"
            />
          </div>
        </div>

        <!-- Store Stock Allocation -->
        <div class="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
          <div class="flex items-center justify-between">
            <span class="font-bold text-slate-900 text-xs flex items-center gap-1.5">
              <Building2 class="w-3.5 h-3.5 text-teal-600" />
              <span>Initial Expected Store Stock:</span>
            </span>

            <label class="flex items-center gap-1.5 text-[11px] text-slate-600 cursor-pointer">
              <input
                v-model="mapAllStores"
                type="checkbox"
                class="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
              />
              <span>Map all 4 branches</span>
            </label>
          </div>

          <p class="text-[11px] text-slate-500 leading-relaxed">
            * This product does not have to be mapped to all stores yet. You can input expected stock for <strong>{{ currentStore.name }}</strong> only.
          </p>

          <!-- If single store mode (default) -->
          <div v-if="!mapAllStores" class="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-200">
            <div class="flex-1">
              <span class="font-bold text-slate-800">{{ currentStore.name }}</span>
              <p class="text-[10px] text-slate-500">Initial expected stock for this store</p>
            </div>
            <div class="flex items-center gap-1.5">
              <input
                v-model.number="currentStoreStock"
                type="number"
                min="0"
                class="w-20 px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-center font-mono font-bold text-sm text-slate-900 focus:outline-none focus:border-teal-500"
              />
              <span class="text-xs text-slate-500 font-medium">units</span>
            </div>
          </div>

          <!-- If all 4 branches mode -->
          <div v-else class="grid grid-cols-2 gap-2.5">
            <div class="bg-white p-2.5 rounded-xl border border-slate-200">
              <label class="block text-[11px] font-semibold text-slate-700 mb-1">Birmas Kuningan:</label>
              <input
                v-model.number="stockKuningan"
                type="number"
                min="0"
                class="w-full px-2 py-1 bg-slate-50 border border-slate-300 rounded text-center font-mono font-bold text-xs"
              />
            </div>

            <div class="bg-white p-2.5 rounded-xl border border-slate-200">
              <label class="block text-[11px] font-semibold text-slate-700 mb-1">Birmas Kwitang:</label>
              <input
                v-model.number="stockKwitang"
                type="number"
                min="0"
                class="w-full px-2 py-1 bg-slate-50 border border-slate-300 rounded text-center font-mono font-bold text-xs"
              />
            </div>

            <div class="bg-white p-2.5 rounded-xl border border-slate-200">
              <label class="block text-[11px] font-semibold text-slate-700 mb-1">Birmas Lebak Bulus:</label>
              <input
                v-model.number="stockLebakBulus"
                type="number"
                min="0"
                class="w-full px-2 py-1 bg-slate-50 border border-slate-300 rounded text-center font-mono font-bold text-xs"
              />
            </div>

            <div class="bg-white p-2.5 rounded-xl border border-slate-200">
              <label class="block text-[11px] font-semibold text-slate-700 mb-1">Birmas Sudirman:</label>
              <input
                v-model.number="stockSudirman"
                type="number"
                min="0"
                class="w-full px-2 py-1 bg-slate-50 border border-slate-300 rounded text-center font-mono font-bold text-xs"
              />
            </div>
          </div>
        </div>

        <!-- Feedback message banner -->
        <div
          v-if="feedbackMessage"
          class="p-3 rounded-xl border text-xs flex items-center gap-2"
          :class="
            feedbackMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
              : 'bg-rose-50 border-rose-300 text-rose-800'
          "
        >
          <component
            :is="feedbackMessage.type === 'success' ? CheckCircle2 : AlertCircle"
            class="w-4 h-4 shrink-0"
          />
          <span>{{ feedbackMessage.text }}</span>
        </div>

        <!-- Submit & Cancel Buttons -->
        <div class="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
          <button
            @click="emit('close')"
            type="button"
            class="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            :disabled="isSubmitting"
            class="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-teal-600/20 transition-all disabled:opacity-50"
          >
            <Plus class="w-4 h-4" />
            <span>{{ isSubmitting ? 'Saving to Database...' : 'Save Barcode to Backend' }}</span>
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
