import { ref, computed } from 'vue';

const AUTH_STORAGE_KEY = 'birmas_audit_user_v2';

export const DEFAULT_ACCOUNTS = [
  {
    id: 'user-admin',
    username: 'admin',
    email: 'admin@birmas.id',
    name: 'Admin',
    role: 'Administrator',
    hint: 'Password: admin666',
  },
  {
    id: 'user-chrisna',
    username: 'chrisna',
    email: 'chrisna@birmas.id',
    name: 'Chrisna',
    role: 'Auditor',
    hint: 'Password: auditor666',
  },
];

const currentUser = ref(getStoredUser());

function getStoredUser() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
    return null;
  } catch {
    return null;
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
      if (
        matched &&
        ((cleanUser === 'admin' && passwordInput === 'admin666') ||
         (cleanUser === 'chrisna' && passwordInput === 'auditor666'))
      ) {
        currentUser.value = matched;
        if (typeof window !== 'undefined') {
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(matched));
        }
        return { success: true, message: 'Logged in successfully', user: matched };
      }
      return { success: false, message: err.message || 'Invalid username or password' };
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
