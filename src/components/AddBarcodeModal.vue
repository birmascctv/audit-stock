<script setup>
import { ref, watch } from 'vue';
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

const { stores, currentStore, addNewBarcode } = useAuditStore();

// Known Product Variants from WordPress Pods for fast 1-click matching
const KNOWN_WP_VARIANTS = [
  { id: '12880', brand: 'Guinness', title: 'Guinness Draught In Can 440ml', varian: 'Draught In Can', packageType: 'Kaleng', volume: 440, unitVolume: 'ml', price: 58000 },
  { id: '12877', brand: 'Cham Joeun', title: 'Cham Joeun Lychee Botol 360ml', varian: 'Lychee', packageType: 'Botol', volume: 360, unitVolume: 'ml', price: 104000 },
  { id: '12878', brand: 'Cham Joeun', title: 'Cham Joeun Original Botol 360ml', varian: 'Original', packageType: 'Botol', volume: 360, unitVolume: 'ml', price: 104000 },
  { id: '12882', brand: 'Orang Tua', title: 'Orang Tua AO Botol 620ml', varian: 'AO', packageType: 'Botol', volume: 620, unitVolume: 'ml', price: 65000 },
  { id: '101', brand: 'Kulturale', title: 'Kulturale Lychee Kaleng 330ml', varian: 'Lychee', packageType: 'Kaleng', volume: 330, unitVolume: 'ml', price: 35000 },
  { id: '102', brand: 'Kulturale', title: 'Kulturale Mango Kaleng 330ml', varian: 'Mango', packageType: 'Kaleng', volume: 330, unitVolume: 'ml', price: 35000 },
  { id: '103', brand: 'Kulturale', title: 'Kulturale Apple Kaleng 330ml', varian: 'Apple', packageType: 'Kaleng', volume: 330, unitVolume: 'ml', price: 35000 },
  { id: '104', brand: 'Kulturale', title: 'Kulturale Original Kaleng 330ml', varian: 'Original', packageType: 'Kaleng', volume: 330, unitVolume: 'ml', price: 35000 },
  { id: '105', brand: 'Albens', title: 'Albens LL Stout Kaleng 330ml', varian: 'LL Stout', packageType: 'Kaleng', volume: 330, unitVolume: 'ml', price: 45000 },
  { id: '106', brand: 'Albens', title: 'Albens Amarillo Kaleng 330ml', varian: 'Amarillo', packageType: 'Kaleng', volume: 330, unitVolume: 'ml', price: 45000 },
  { id: '107', brand: 'Albens', title: 'Albens Naganini Kaleng 330ml', varian: 'Naganini', packageType: 'Kaleng', volume: 330, unitVolume: 'ml', price: 45000 },
];

const barcodeSourceType = ref('from_wp_variant');
const selectedPresetIndex = ref('0');

const barcodeInput = ref('');
const productTitleInput = ref('Guinness Draught In Can 440ml');
const brandInput = ref('Guinness');
const customBrand = ref('');
const varianInput = ref('Draught In Can');
const packageTypeInput = ref('Kaleng');
const volumeInput = ref(440);
const unitVolumeInput = ref('ml');
const wpIdInput = ref('12880');
const skuInput = ref('');
const priceInput = ref(58000);

const mapAllStores = ref(false);
const currentStoreStock = ref(24);
const stockKuningan = ref(24);
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

function handleSelectPreset(val) {
  const item = KNOWN_WP_VARIANTS[Number(val)];
  if (!item) return;

  productTitleInput.value = item.title;
  brandInput.value = item.brand;
  varianInput.value = item.varian;
  packageTypeInput.value = item.packageType;
  volumeInput.value = item.volume;
  unitVolumeInput.value = item.unitVolume;
  wpIdInput.value = item.id;
  priceInput.value = item.price;
  skuInput.value = `SKU-${item.brand.substring(0, 3).toUpperCase()}-${item.id}`;
}

function handleSwitchSource(type) {
  barcodeSourceType.value = type;
  if (type === 'entirely_new') {
    productTitleInput.value = '';
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

        <!-- When "from_wp_variant": Dropdown of known variants -->
        <div v-if="barcodeSourceType === 'from_wp_variant'" class="bg-slate-50 p-3 rounded-xl border border-slate-200">
          <label class="block text-slate-800 font-semibold mb-1">
            Choose WordPress Product Variant:
          </label>
          <select
            v-model="selectedPresetIndex"
            @change="handleSelectPreset(selectedPresetIndex)"
            class="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:border-teal-500 cursor-pointer"
          >
            <option
              v-for="(v, idx) in KNOWN_WP_VARIANTS"
              :key="v.id"
              :value="String(idx)"
            >
              [WP ID: {{ v.id }}] {{ v.title }} • {{ v.packageType }} {{ v.volume }}{{ v.unitVolume }} • Rp {{ v.price.toLocaleString() }}
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
              <option value="Guinness">Guinness</option>
              <option value="Cham Joeun">Cham Joeun</option>
              <option value="Orang Tua">Orang Tua</option>
              <option value="Kulturale">Kulturale</option>
              <option value="Albens">Albens</option>
              <option value="Birmas Brew">Birmas Brew</option>
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
