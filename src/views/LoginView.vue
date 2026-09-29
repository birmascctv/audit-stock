<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth, DEFAULT_ACCOUNTS } from '../composables/useAuth.js';
import {
  ClipboardCheck,
  Lock,
  User as UserIcon,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  KeyRound,
  CheckCircle2
} from 'lucide-vue-next';

const router = useRouter();
const { loginWithBackend } = useAuth();

const username = ref('admin');
const password = ref('admin123');
const isLoading = ref(false);
const errorMessage = ref(null);

async function handleLogin() {
  errorMessage.value = null;
  if (!username.value.trim() || !password.value.trim()) {
    errorMessage.value = 'Please enter both username and password';
    return;
  }

  isLoading.value = true;
  try {
    const result = await loginWithBackend(username.value, password.value);
    if (result.success) {
      router.push('/audit');
    } else {
      errorMessage.value = result.message || 'Invalid username or password';
    }
  } catch (err) {
    errorMessage.value = err.message || 'Login failed. Please check backend connection.';
  } finally {
    isLoading.value = false;
  }
}

function fillCredentials(account) {
  username.value = account.username;
  password.value = account.username === 'admin' ? 'admin123' : 'birmas2026';
  errorMessage.value = null;
}
</script>

<template>
  <div class="min-h-screen bg-slate-100 flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden font-sans">
    <!-- Subtle tosca ambient glow -->
    <div class="absolute -top-32 -left-32 w-96 h-96 bg-teal-200/40 rounded-full blur-3xl pointer-events-none"></div>
    <div class="absolute -bottom-32 -right-32 w-96 h-96 bg-cyan-200/40 rounded-full blur-3xl pointer-events-none"></div>

    <div class="w-full max-w-md relative z-10">
      <!-- Brand Logo / Header -->
      <div class="text-center mb-6">
        <div class="inline-flex w-16 h-16 rounded-2xl bg-gradient-to-tr from-teal-600 to-cyan-600 items-center justify-center text-white shadow-xl shadow-teal-600/20 mb-3">
          <ClipboardCheck class="w-8 h-8 text-white" />
        </div>
        <h1 class="text-2xl font-black text-slate-900 tracking-tight">
          Birmas Stock Audit
        </h1>
        <p class="text-xs text-slate-500 mt-1">
          Store physical barcode audit station with backend authentication
        </p>
      </div>

      <!-- Main Login Card (Light Gray & White Theme) -->
      <div class="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-200/60">
        <div class="flex items-center justify-between mb-5 border-b border-slate-100 pb-3">
          <div>
            <h2 class="text-base font-bold text-slate-900">Sign In</h2>
            <p class="text-[11px] text-slate-500">Access store audit records & counting station</p>
          </div>
          <span class="px-2.5 py-0.5 rounded-full bg-teal-50 border border-teal-200 text-teal-700 text-[10px] font-bold">
            Backend Saved
          </span>
        </div>

        <form @submit.prevent="handleLogin" class="space-y-4">
          <!-- Username / Email -->
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
              <span>Username or Email:</span>
              <span class="text-[10px] text-slate-400 font-normal">e.g. admin or auditor</span>
            </label>
            <div class="relative">
              <UserIcon class="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                v-model="username"
                type="text"
                required
                autocomplete="username"
                placeholder="Enter username..."
                class="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm font-medium placeholder-slate-400 focus:outline-none focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-100 transition-all"
              />
            </div>
          </div>

          <!-- Password -->
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
              <span>Password:</span>
              <span class="text-[10px] text-slate-400 font-normal">Stored securely in backend</span>
            </label>
            <div class="relative">
              <Lock class="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                v-model="password"
                type="password"
                required
                autocomplete="current-password"
                placeholder="Enter password..."
                class="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm font-medium placeholder-slate-400 focus:outline-none focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-100 transition-all"
              />
            </div>
          </div>

          <!-- Error Alert -->
          <div
            v-if="errorMessage"
            class="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2"
          >
            <AlertCircle class="w-4 h-4 text-rose-600 shrink-0" />
            <span>{{ errorMessage }}</span>
          </div>

          <!-- Submit Button -->
          <button
            type="submit"
            :disabled="isLoading"
            class="w-full py-3 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-teal-600/25 transition-all disabled:opacity-50 mt-2 cursor-pointer"
          >
            <span>{{ isLoading ? 'Verifying with Backend...' : 'Sign In to Station' }}</span>
            <ArrowRight class="w-4 h-4" />
          </button>
        </form>

        <!-- Quick 1-Click Credentials Helper for Testing -->
        <div class="mt-6 pt-5 border-t border-slate-100">
          <div class="flex items-center justify-between mb-2">
            <span class="text-[11px] font-bold text-slate-500 flex items-center gap-1">
              <KeyRound class="w-3.5 h-3.5 text-teal-600" />
              <span>Available Backend User Accounts:</span>
            </span>
          </div>

          <div class="space-y-1.5">
            <button
              v-for="acc in DEFAULT_ACCOUNTS"
              :key="acc.id"
              @click="fillCredentials(acc)"
              type="button"
              class="w-full p-2.5 rounded-xl border border-slate-200 hover:border-teal-400 hover:bg-teal-50/50 text-left transition-all flex items-center justify-between group cursor-pointer"
            >
              <div>
                <div class="flex items-center gap-1.5">
                  <span class="font-extrabold text-xs text-slate-800 group-hover:text-teal-900">{{ acc.name }}</span>
                  <span class="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-semibold">{{ acc.role }}</span>
                </div>
                <span class="text-[11px] text-slate-500 font-mono">User: <strong>{{ acc.username }}</strong> • {{ acc.hint }}</span>
              </div>
              <span class="text-[11px] font-bold text-teal-700 opacity-80 group-hover:opacity-100">Use</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
