<script setup>
import { ref } from 'vue';
import { useRoute } from 'vue-router';
import ChillerHeader from './components/ChillerHeader.vue';
import ScannerGuideModal from './components/ScannerGuideModal.vue';

const route = useRoute();
const soundEnabled = ref(true);
const isGuideOpen = ref(false);
</script>

<template>
  <div class="min-h-screen bg-slate-100 text-slate-800 flex flex-col font-sans selection:bg-teal-500 selection:text-white">
    <!-- Header (shown on all pages except login) -->
    <ChillerHeader
      v-if="route.path !== '/login'"
      :sound-enabled="soundEnabled"
      @toggle-sound="soundEnabled = !soundEnabled"
      @open-guide="isGuideOpen = true"
    />

    <!-- Routed View with generous left & right gutters -->
    <main
      class="flex-1 w-full"
      :class="route.path === '/login' ? '' : 'max-w-[1560px] mx-auto px-4 sm:px-8 lg:px-12 xl:px-16 py-8'"
    >
      <router-view />
    </main>

    <!-- Footer -->
    <footer
      v-if="route.path !== '/login'"
      class="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500"
    >
      <div class="max-w-[1560px] mx-auto px-4 sm:px-8 lg:px-12 xl:px-16 flex flex-col sm:flex-row items-center justify-between gap-2">
        <p>
          Birmas Store Stock Audit Station • Synchronized with WordPress & ESB Pods
        </p>
        <div class="flex items-center gap-3">
          <button @click="isGuideOpen = true" class="text-teal-700 hover:underline font-medium">
            Scanner Tips (EN / ID)
          </button>
          <span>•</span>
          <router-link to="/wordpress" class="text-slate-600 hover:text-teal-700">
            WordPress & ESB Pods Setup
          </router-link>
        </div>
      </div>
    </footer>

    <!-- Hardware Guide Modal -->
    <ScannerGuideModal
      :is-open="isGuideOpen"
      @close="isGuideOpen = false"
    />
  </div>
</template>
