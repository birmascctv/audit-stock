<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuth } from '../composables/useAuth.js';
import { useAuditStore } from '../composables/useAuditStore.js';
import {
  Barcode,
  Volume2,
  VolumeX,
  HelpCircle,
  ClipboardCheck,
  Globe,
  History,
  Building2,
  LogOut,
  Zap
} from 'lucide-vue-next';

defineProps({
  soundEnabled: {
    type: Boolean,
    default: true,
  },
});

const emit = defineEmits(['toggleSound', 'openGuide']);

const route = useRoute();
const router = useRouter();
const { logout } = useAuth();
const { stores, selectedStoreId, selectStore, lastCheckedAt } = useAuditStore();

const currentTime = ref('');
let timer = null;

function updateTime() {
  const now = new Date();
  currentTime.value = now.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function handleLogout() {
  logout();
  router.push('/login');
}

onMounted(() => {
  updateTime();
  timer = window.setInterval(updateTime, 1000);
});

onUnmounted(() => {
  if (timer) clearInterval(timer);
});
</script>

<template>
  <header class="bg-white border-b border-slate-200 text-slate-800 sticky top-0 z-30 shadow-sm">
    <div class="max-w-[1560px] mx-auto px-4 sm:px-8 lg:px-12 xl:px-16 py-3">
      <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <!-- Logo & Navigation Tabs -->
        <div class="flex flex-wrap items-center gap-3 sm:gap-6">
          <router-link to="/audit" class="flex items-center gap-2.5 group">
            <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-600 to-cyan-600 flex items-center justify-center text-white shadow-md shadow-teal-500/20 group-hover:scale-105 transition-transform">
              <ClipboardCheck class="w-5 h-5 text-white" />
            </div>
            <div>
              <div class="flex items-center gap-1.5">
                <h1 class="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight leading-tight">
                  Birmas Stock Audit
                </h1>
                <span class="text-[10px] px-1.5 py-0.2 rounded bg-teal-50 text-teal-700 border border-teal-200 font-medium">
                  Store Station
                </span>
              </div>
              <p class="text-[11px] text-slate-500">Overall Store Physical Stock Audit</p>
            </div>
          </router-link>

          <!-- Navigation Links -->
          <nav class="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <router-link
              to="/audit"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
              :class="
                route.path === '/audit'
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
              "
            >
              <ClipboardCheck class="w-3.5 h-3.5" />
              <span>Physical Audit</span>
            </router-link>

            <router-link
              to="/wordpress"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
              :class="
                route.path === '/wordpress'
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
              "
            >
              <Globe class="w-3.5 h-3.5" />
              <span>WordPress / ESB</span>
            </router-link>

            <router-link
              to="/history"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
              :class="
                route.path === '/history'
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
              "
            >
              <History class="w-3.5 h-3.5" />
              <span>Audit Records</span>
            </router-link>
          </nav>
        </div>

        <!-- Right Side: Auto-Checker, Quick Store Switcher, Tools & Logout -->
        <div class="flex items-center gap-2 sm:gap-3 flex-wrap">
          <!-- Live Auto-Checker Status -->
          <div class="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-teal-50 border border-teal-200 text-teal-800 text-[11px] font-medium" title="Background checker pulls fresh ESB stock and physical scans every 10s-30s">
            <span class="w-2 h-2 rounded-full bg-teal-500 animate-pulse"></span>
            <span class="font-bold">Auto-Sync</span>
            <span class="text-teal-600 text-[10px]">({{ lastCheckedAt }})</span>
          </div>

          <!-- Quick Store Switcher -->
          <div class="relative flex items-center">
            <Building2 class="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
            <select
              :value="selectedStoreId"
              @change="selectStore($event.target.value)"
              class="text-xs bg-slate-50 border border-slate-300 rounded-xl pl-8 pr-4 py-1.5 font-bold text-slate-800 focus:outline-none focus:border-teal-500 cursor-pointer shadow-sm"
            >
              <option v-for="s in stores" :key="s.id" :value="s.id">
                {{ s.name }}
              </option>
            </select>
          </div>

          <!-- Sound Mute Toggle -->
          <button
            @click="emit('toggleSound')"
            type="button"
            class="p-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors shadow-sm"
            :title="soundEnabled ? 'Mute Scanner Beeper' : 'Unmute Scanner Beeper'"
          >
            <component :is="soundEnabled ? Volume2 : VolumeX" class="w-4 h-4" />
          </button>

          <!-- Scanner Tips (EN/ID) -->
          <button
            @click="emit('openGuide')"
            type="button"
            class="p-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors shadow-sm flex items-center gap-1"
            title="Barcode Scanner Tips (English & Indonesian)"
          >
            <HelpCircle class="w-4 h-4 text-teal-600" />
            <span class="text-xs font-semibold hidden md:inline">Tips</span>
          </button>

          <!-- Clock -->
          <div class="hidden xl:flex items-center text-xs font-mono font-bold text-slate-500 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200">
            {{ currentTime }}
          </div>

          <!-- Logout Button -->
          <button
            @click="handleLogout"
            type="button"
            class="p-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 transition-colors text-xs font-bold flex items-center gap-1.5 shadow-sm"
            title="Log Out of Store Audit Station"
          >
            <LogOut class="w-3.5 h-3.5" />
            <span class="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
    </div>
  </header>
</template>
