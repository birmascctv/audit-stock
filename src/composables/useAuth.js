import { ref, computed } from 'vue';

const AUTH_STORAGE_KEY = 'birmas_audit_user_v2';

export const DEFAULT_ACCOUNTS = [
  {
    id: 'user-admin',
    username: 'admin',
    email: 'admin@birmas.id',
    name: 'Bertha Evania',
    role: 'Audit Supervisor',
    hint: 'Password: admin123',
  },
  {
    id: 'user-auditor',
    username: 'auditor',
    email: 'auditor@birmas.id',
    name: 'Store Auditor Staff',
    role: 'Store Auditor',
    hint: 'Password: birmas2026',
  },
];

const currentUser = ref(getStoredUser());

function getStoredUser() {
  if (typeof window === 'undefined') return DEFAULT_ACCOUNTS[0];
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
    return DEFAULT_ACCOUNTS[0];
  } catch {
    return DEFAULT_ACCOUNTS[0];
  }
}

export function useAuth() {
  const isAuthenticated = computed(() => currentUser.value !== null);

  async function loginWithBackend(usernameInput, passwordInput) {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: usernameInput.trim(),
          password: passwordInput.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success && data.user) {
        currentUser.value = data.user;
        if (typeof window !== 'undefined') {
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(data.user));
        }
        return { success: true, message: data.message || 'Login successful', user: data.user };
      } else {
        return {
          success: false,
          message: data.message || 'Invalid username or password',
        };
      }
    } catch (err) {
      // Local fallback if server unreachable
      const cleanUser = usernameInput.trim().toLowerCase();
      const matched = DEFAULT_ACCOUNTS.find(
        (u) => u.username.toLowerCase() === cleanUser || u.email.toLowerCase() === cleanUser
      );
      if (matched && (passwordInput === 'admin123' || passwordInput === 'birmas2026')) {
        currentUser.value = matched;
        if (typeof window !== 'undefined') {
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(matched));
        }
        return { success: true, message: 'Logged in successfully (offline fallback)', user: matched };
      }
      return { success: false, message: err.message || 'Connection error with auth server' };
    }
  }

  function logout() {
    currentUser.value = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  }

  return {
    currentUser,
    isAuthenticated,
    loginWithBackend,
    logout,
    defaultAccounts: DEFAULT_ACCOUNTS,
  };
}
