<script setup>
import { ref } from 'vue';
import { useAuditStore } from '../composables/useAuditStore.js';
import AddBarcodeModal from '../components/AddBarcodeModal.vue';
import {
  Globe,
  Key,
  ShieldCheck,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Database,
  Sliders,
  ExternalLink,
  Code,
  Layers,
  Building2,
  Sparkles,
  Edit2,
  Plus,
  BookOpen,
  Server,
  Cpu,
  ArrowRight,
  Copy,
  Check,
  PackageCheck,
  Webhook,
  Terminal,
  Trash2
} from 'lucide-vue-next';

const {
  wpConfig,
  wpProducts,
  stores,
  syncFromWordPress,
  isSyncing,
  lastSyncStatus,
  createStore,
  removeStore,
} = useAuditStore();

const isTesting = ref(false);
const testResult = ref(null);
const isAddModalOpen = ref(false);

const copiedSnippet = ref(false);
const copiedWebhookSnippet = ref(false);
const copiedGitSteps = ref(false);
const activeGuideTab = ref('pull_rest'); // 'pull_rest' | 'push_webhook' | 'git_setup'

// New Store Form
const newStoreName = ref('');
const newStoreCode = ref('');
const isAddingStore = ref(false);

async function handleAddStore() {
  if (!newStoreName.value.trim()) return;
  isAddingStore.value = true;
  try {
    await createStore({
      name: newStoreName.value.trim(),
      locationCode: newStoreCode.value.trim() || undefined,
    });
    newStoreName.value = '';
    newStoreCode.value = '';
    alert('Store added successfully to backend!');
  } catch (err) {
    alert('Failed to add store: ' + err.message);
  } finally {
    isAddingStore.value = false;
  }
}

async function handleRemoveStore(storeId, storeName) {
  if (confirm(`Remove store "${storeName}" from backend?`)) {
    await removeStore(storeId);
  }
}

async function handleSaveAndTest() {
  isTesting.value = true;
  testResult.value = null;

  try {
    await syncFromWordPress();
    testResult.value = {
      success: lastSyncStatus.value.success,
      message: lastSyncStatus.value.message,
    };
  } catch (err) {
    testResult.value = {
      success: false,
      message: err.message || 'Connection failed',
    };
  } finally {
    isTesting.value = false;
  }
}

// Option 1: REST API Snippet for WPCode (Pull model)
const wpCodePodsSnippet = `<?php
/**
 * Birmas Store Stocks Endpoint for WPCode
 * Exposes Product Stocks (from ESB) and Product Variants to this audit dashboard backend.
 */
add_action('rest_api_init', function () {
  register_rest_route('birmas/v1', '/chiller-stocks', array(
    'methods' => 'GET',
    'permission_callback' => '__return_true',
    'callback' => function () {
      // Fetch Product Stocks updated by your ESB
      $stock_posts = get_posts(array(
        'post_type' => 'product_stocks',
        'posts_per_page' => -1,
        'post_status' => 'publish'
      ));

      $stocks_data = array();
      foreach ($stock_posts as $post) {
        $location = get_post_meta($post->ID, 'location', true);
        $variant_title = get_post_meta($post->ID, 'product_variant_title', true) ?: $post->post_title;
        $stock = (int) get_post_meta($post->ID, 'stock', true);
        $esb_menu_id = get_post_meta($post->ID, 'esb_menu_id', true);

        $stocks_data[] = array(
          'id' => $post->ID,
          'variant_title' => $variant_title,
          'location' => $location,
          'stock' => $stock,
          'esb_menu_id' => $esb_menu_id
        );
      }

      return array(
        'success' => true,
        'count' => count($stocks_data),
        'products' => $stocks_data
      );
    }
  ));
});`;

// Option 2: Webhook Trigger (Push model)
const wpWebhookSnippet = `<?php
/**
 * Automatic Webhook: Notify Dashboard Backend whenever ESB updates Product Stocks
 */
add_action('save_post_product_stocks', function ($post_id, $post, $update) {
  if (wp_is_post_revision($post_id) || $post->post_status !== 'publish') return;

  // Replace with your actual server IP or domain:
  $dashboard_url = 'https://your-server-domain.com/api/esb/webhook';
  
  $body = json_encode(array(
    'event' => 'stock_updated',
    'post_id' => $post_id,
    'location' => get_post_meta($post_id, 'location', true),
    'variant_title' => get_post_meta($post_id, 'product_variant_title', true) ?: $post->post_title,
    'stock' => (int) get_post_meta($post_id, 'stock', true),
    'updated_at' => current_time('mysql')
  ));

  wp_remote_post($dashboard_url, array(
    'headers' => array('Content-Type' => 'application/json'),
    'body' => $body,
    'timeout' => 5,
    'blocking' => false // non-blocking background dispatch
  ));
}, 10, 3);`;

// Git setup baby steps instructions
const gitSetupSteps = `# 1. ON YOUR LAPTOP (INITIALIZE & PUSH TO GIT):
cd /path/to/your/project-folder
git init
git add .
git commit -m "feat: birmas stock audit system with node backend and vue js"
git branch -M main
git remote add origin git@github.com:YOUR_USERNAME/birmas-stock-audit.git
git push -u origin main

# 2. ON YOUR SERVER (SSH INTO UBUNTU / DEBIAN VPS):
ssh root@YOUR_SERVER_IP

# Install Node.js 20 & Git (if not installed):
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git

# Clone the repository from GitHub:
cd /var/www
git clone git@github.com:YOUR_USERNAME/birmas-stock-audit.git
cd birmas-stock-audit

# Install dependencies:
npm install

# Build frontend:
npm run build

# Install PM2 for 24/7 background uptime & auto restart:
npm install -g pm2
pm2 start server.js --name "birmas-audit"
pm2 save
pm2 startup

# 3. PULL UPDATES FROM GIT ON SERVER IN FUTURE:
cd /var/www/birmas-stock-audit
git pull origin main
npm install
npm run build
pm2 restart birmas-audit`;

function copySnippet(type) {
  if (type === 'rest') {
    navigator.clipboard.writeText(wpCodePodsSnippet);
    copiedSnippet.value = true;
    setTimeout(() => { copiedSnippet.value = false; }, 2000);
  } else if (type === 'webhook') {
    navigator.clipboard.writeText(wpWebhookSnippet);
    copiedWebhookSnippet.value = true;
    setTimeout(() => { copiedWebhookSnippet.value = false; }, 2000);
  } else if (type === 'git') {
    navigator.clipboard.writeText(gitSetupSteps);
    copiedGitSteps.value = true;
    setTimeout(() => { copiedGitSteps.value = false; }, 2000);
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <div class="flex items-center gap-2">
          <h2 class="text-xl font-extrabold text-slate-900 tracking-tight">
            WordPress Pods & ESB Backend Architecture
          </h2>
          <span class="text-xs px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200 font-semibold">
            Backend Storage Active
          </span>
        </div>
        <p class="text-xs text-slate-500 mt-0.5">
          Connecting WordPress Pods (Product Variants & Stocks) to your local and cloud backend database
        </p>
      </div>

      <div class="flex items-center gap-2">
        <button
          @click="isAddModalOpen = true"
          type="button"
          class="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition-all"
        >
          <Plus class="w-3.5 h-3.5" />
          <span>Add & Map New Barcode</span>
        </button>
      </div>
    </div>

    <!-- Question 1 Answer Card: Store List & Backend Persistence -->
    <div class="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      <div class="flex items-start gap-3.5">
        <div class="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center shrink-0">
          <Database class="w-5 h-5" />
        </div>
        <div class="flex-1">
          <h3 class="text-sm sm:text-base font-bold text-slate-900">
            Is it better to save the store list in /data or in backend?
          </h3>
          <p class="text-xs text-slate-600 mt-1 leading-relaxed">
            <strong>Answer: They are the same thing in this architecture!</strong><br />
            Your backend server (<code>server.js</code>) manages the store list and saves it persistently to <code>/data/audit_store.json</code> on the server's disk. This ensures:
          </p>
          <ul class="list-disc list-inside text-xs text-slate-600 mt-1.5 space-y-1">
            <li>Whenever your server restarts or reboots, your store list, products, barcodes, and audit history are never lost.</li>
            <li>You can add, edit, or delete store branches dynamically at any time via the API (<code>/api/stores</code>) or using the manager below.</li>
            <li>Whenever ESB updates stock in WordPress, this backend immediately receives the new stock numbers and keeps all auditor screens in sync.</li>
          </ul>
        </div>
      </div>
    </div>

    <!-- Store Management in Backend -->
    <div class="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      <div class="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
        <div class="flex items-center gap-2.5">
          <Building2 class="w-5 h-5 text-teal-600" />
          <div>
            <h3 class="text-sm font-bold text-slate-900">Manage Stores in Backend</h3>
            <p class="text-[11px] text-slate-500">Add or manage store locations saved in <code>server.js</code> / <code>/data/audit_store.json</code></p>
          </div>
        </div>
        <span class="text-xs font-mono font-bold px-2.5 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200">
          {{ stores.length }} Active Stores
        </span>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- Stores List -->
        <div class="space-y-2">
          <div
            v-for="s in stores"
            :key="s.id"
            class="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs"
          >
            <div>
              <span class="font-bold text-slate-900">{{ s.name }}</span>
              <div class="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500 font-mono">
                <span>Code: {{ s.locationCode }}</span>
                <span>•</span>
                <span>ESB Branch: {{ s.esbBranchCode || s.id }}</span>
              </div>
            </div>

            <button
              v-if="stores.length > 1"
              @click="handleRemoveStore(s.id, s.name)"
              type="button"
              class="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
              title="Remove store from backend"
            >
              <Trash2 class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <!-- Add Store Form -->
        <form @submit.prevent="handleAddStore" class="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3 text-xs">
          <span class="font-bold text-slate-800 block">Add New Store Location:</span>
          <div>
            <label class="block text-[11px] font-semibold text-slate-600 mb-1">Store Name:</label>
            <input
              v-model="newStoreName"
              type="text"
              required
              placeholder="e.g. Birmas Senopati"
              class="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-teal-500"
            />
          </div>
          <div>
            <label class="block text-[11px] font-semibold text-slate-600 mb-1">Location Code (Optional):</label>
            <input
              v-model="newStoreCode"
              type="text"
              placeholder="e.g. BRM-SNP"
              class="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-teal-500"
            />
          </div>
          <button
            type="submit"
            :disabled="isAddingStore"
            class="w-full py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <Plus class="w-3.5 h-3.5" />
            <span>{{ isAddingStore ? 'Adding...' : 'Add Store to Backend' }}</span>
          </button>
        </form>
      </div>
    </div>

    <!-- Architecture & Connection Guide Navigation Tabs -->
    <div class="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      <div class="flex items-center gap-2 border-b border-slate-200 pb-3 mb-4">
        <button
          @click="activeGuideTab = 'pull_rest'"
          type="button"
          class="px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all"
          :class="activeGuideTab === 'pull_rest' ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'"
        >
          1. REST API via WPCode (Pull Model)
        </button>
        <button
          @click="activeGuideTab = 'push_webhook'"
          type="button"
          class="px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all"
          :class="activeGuideTab === 'push_webhook' ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'"
        >
          2. Live Webhook on ESB Save (Push Model)
        </button>
        <button
          @click="activeGuideTab = 'git_setup'"
          type="button"
          class="px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all"
          :class="activeGuideTab === 'git_setup' ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'"
        >
          3. Git & Server Setup (Baby Steps)
        </button>
      </div>

      <!-- Tab 1: WPCode REST API Snippet -->
      <div v-if="activeGuideTab === 'pull_rest'" class="space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <h4 class="text-sm font-bold text-slate-900">Step 1: Paste this Snippet into WPCode</h4>
            <p class="text-xs text-slate-500">Go to your WordPress Admin > <strong>Code Snippets > + Add Snippet</strong> > Choose PHP Snippet</p>
          </div>
          <button
            @click="copySnippet('rest')"
            class="px-3 py-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-300 text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <component :is="copiedSnippet ? Check : Copy" class="w-3.5 h-3.5 text-teal-700" />
            <span>{{ copiedSnippet ? 'Copied PHP!' : 'Copy PHP Snippet' }}</span>
          </button>
        </div>

        <pre class="p-4 bg-slate-900 text-emerald-300 font-mono text-xs rounded-xl overflow-x-auto leading-relaxed">{{ wpCodePodsSnippet }}</pre>
      </div>

      <!-- Tab 2: Webhook Trigger Snippet -->
      <div v-if="activeGuideTab === 'push_webhook'" class="space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <h4 class="text-sm font-bold text-slate-900">Instant Webhook on ESB Save</h4>
            <p class="text-xs text-slate-500">Whenever ESB updates a product stock post, WordPress notifies this server at <code>/api/esb/webhook</code></p>
          </div>
          <button
            @click="copySnippet('webhook')"
            class="px-3 py-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-300 text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <component :is="copiedWebhookSnippet ? Check : Copy" class="w-3.5 h-3.5 text-teal-700" />
            <span>{{ copiedWebhookSnippet ? 'Copied PHP!' : 'Copy Webhook Snippet' }}</span>
          </button>
        </div>

        <pre class="p-4 bg-slate-900 text-cyan-300 font-mono text-xs rounded-xl overflow-x-auto leading-relaxed">{{ wpWebhookSnippet }}</pre>
      </div>

      <!-- Tab 3: Git & Server Setup (Baby Steps) -->
      <div v-if="activeGuideTab === 'git_setup'" class="space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <h4 class="text-sm font-bold text-slate-900">Baby Steps: Laptop to Git to Production Server</h4>
            <p class="text-xs text-slate-500">Follow these exact commands step-by-step</p>
          </div>
          <button
            @click="copySnippet('git')"
            class="px-3 py-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-300 text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <component :is="copiedGitSteps ? Check : Copy" class="w-3.5 h-3.5 text-teal-700" />
            <span>{{ copiedGitSteps ? 'Copied Commands!' : 'Copy All Commands' }}</span>
          </button>
        </div>

        <pre class="p-4 bg-slate-900 text-slate-100 font-mono text-xs rounded-xl overflow-x-auto leading-relaxed">{{ gitSetupSteps }}</pre>
      </div>
    </div>

    <!-- Barcode Mapping Table & WordPress Sync Config Form -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Col 1: Connection Form & Sync Settings -->
      <div class="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
        <div>
          <div class="flex items-center gap-3 border-b border-slate-100 pb-3 mb-4">
            <div class="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200 text-teal-600 flex items-center justify-center">
              <Globe class="w-5 h-5" />
            </div>
            <div>
              <h3 class="text-sm font-bold text-slate-900">WordPress Connection Config</h3>
              <p class="text-[11px] text-slate-500">Node proxy connects without browser CORS issues</p>
            </div>
          </div>

          <form @submit.prevent="handleSaveAndTest" class="space-y-4 text-xs text-slate-700">
            <div>
              <label class="block font-semibold text-slate-700 mb-1">WordPress Domain URL:</label>
              <input
                v-model="wpConfig.wpUrl"
                type="url"
                placeholder="https://your-wordpress-domain.com"
                class="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-mono focus:outline-none focus:border-teal-500"
              />
              <p class="text-[10px] text-slate-400 mt-1">
                Default: <code>https://demo-store.local</code> uses persistent backend storage.
              </p>
            </div>

            <div>
              <label class="block font-semibold text-slate-700 mb-1">REST API Path:</label>
              <input
                v-model="wpConfig.customEndpointPath"
                type="text"
                placeholder="/wp-json/birmas/v1/chiller-stocks"
                class="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-mono focus:outline-none focus:border-teal-500"
              />
            </div>

            <div>
              <label class="block font-semibold text-slate-700 mb-1">Application Password (Optional):</label>
              <input
                v-model="wpConfig.appPassword"
                type="password"
                placeholder="Created in Users > Edit Profile"
                class="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-mono focus:outline-none focus:border-teal-500"
              />
            </div>

            <button
              type="submit"
              :disabled="isTesting"
              class="w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50"
            >
              <RefreshCw class="w-4 h-4" :class="isTesting ? 'animate-spin' : ''" />
              <span>{{ isTesting ? 'Connecting & Syncing...' : 'Save & Sync ESB Stock' }}</span>
            </button>
          </form>

          <div
            v-if="testResult"
            class="mt-4 p-3 rounded-xl border text-xs flex items-center gap-2"
            :class="testResult.success ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-rose-50 border-rose-300 text-rose-800'"
          >
            <component :is="testResult.success ? CheckCircle2 : AlertTriangle" class="w-4 h-4 shrink-0" />
            <span>{{ testResult.message }}</span>
          </div>
        </div>
      </div>

      <!-- Col 2 & 3: Master Barcode Mapping Table -->
      <div class="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
        <div>
          <div class="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
            <div>
              <h3 class="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>Master Barcode Mapping Database</span>
                <span class="text-xs px-2 py-0.5 rounded bg-teal-50 border border-teal-200 text-teal-700 font-mono font-bold">
                  {{ wpProducts.length }} Registered Barcodes
                </span>
              </h3>
              <p class="text-[11px] text-slate-500">
                Barcodes saved directly on this dashboard backend, mapped to WordPress Pods variants and stock amounts
              </p>
            </div>

            <button
              @click="isAddModalOpen = true"
              type="button"
              class="px-3 py-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 border border-teal-300 text-teal-800 text-xs font-bold flex items-center gap-1 transition-colors"
            >
              <Plus class="w-3.5 h-3.5" />
              <span>Add Barcode</span>
            </button>
          </div>

          <div class="overflow-x-auto rounded-xl border border-slate-200">
            <table class="w-full text-left border-collapse text-xs">
              <thead class="bg-slate-50 text-[11px] text-slate-600 uppercase border-b border-slate-200">
                <tr>
                  <th class="py-2.5 px-3">Kode Barcode</th>
                  <th class="py-2.5 px-3">Brand & Product Variant</th>
                  <th class="py-2.5 px-3 text-center">Package</th>
                  <th class="py-2.5 px-3 text-right">Price (Rp)</th>
                  <th class="py-2.5 px-3 text-center">Kuningan</th>
                  <th class="py-2.5 px-3 text-center">Kwitang</th>
                  <th class="py-2.5 px-3 text-center">Lebak Bulus</th>
                  <th class="py-2.5 px-3 text-center">Sudirman</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 text-slate-800">
                <tr v-for="p in wpProducts" :key="p.barcode" class="hover:bg-slate-50">
                  <td class="py-2 px-3 font-mono font-bold text-teal-800">{{ p.barcode }}</td>
                  <td class="py-2 px-3 font-medium">
                    {{ p.brand }} {{ p.varian }}
                  </td>
                  <td class="py-2 px-3 text-center text-slate-600">{{ p.packageType || 'Kaleng' }} {{ p.volume ? p.volume + (p.unitVolume || 'ml') : '' }}</td>
                  <td class="py-2 px-3 text-right font-mono">{{ p.price ? p.price.toLocaleString() : '-' }}</td>
                  <td class="py-2 px-3 text-center font-mono font-bold">{{ p.stockByStore?.['birmas-kuningan'] ?? 0 }}</td>
                  <td class="py-2 px-3 text-center font-mono font-bold">{{ p.stockByStore?.['birmas-kwitang'] ?? 0 }}</td>
                  <td class="py-2 px-3 text-center font-mono font-bold">{{ p.stockByStore?.['birmas-lebak-bulus'] ?? 0 }}</td>
                  <td class="py-2 px-3 text-center font-mono font-bold">{{ p.stockByStore?.['birmas-sudirman'] ?? 0 }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- Add Barcode Modal -->
    <AddBarcodeModal
      :is-open="isAddModalOpen"
      @close="isAddModalOpen = false"
    />
  </div>
</template>
