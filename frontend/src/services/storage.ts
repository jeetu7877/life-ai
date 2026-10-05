import { Preferences } from '@capacitor/preferences';
import { User } from '../types';

const KEYS = {
  TOKEN: 'life_token',
  LEGACY_TOKEN: 'jeet_token',
  REFRESH_TOKEN: 'life_refresh_token',
  USER: 'life_user',
  SERVER_URL: 'life_server_url',
  LEGACY_SERVER_URL: 'jeet_server_url',
  LAST_ROUTE: 'life_last_route',
  SETTINGS: 'life_settings',
} as const;

// In-memory synchronous cache for high-speed synchronous reads (e.g., Axios interceptors)
class MemoryCache {
  token: string | null = null;
  refreshToken: string | null = null;
  user: User | null = null;
  serverUrl: string | null = null;
  lastRoute: string | null = null;
  isHydrated: boolean = false;
}

const cache = new MemoryCache();

// Initial synchronous hydration from localStorage if available
if (typeof window !== 'undefined' && window.localStorage) {
  try {
    cache.token = localStorage.getItem(KEYS.TOKEN) || localStorage.getItem(KEYS.LEGACY_TOKEN) || null;
    cache.refreshToken = localStorage.getItem(KEYS.REFRESH_TOKEN) || null;
    const rawUser = localStorage.getItem(KEYS.USER);
    if (rawUser) {
      cache.user = JSON.parse(rawUser);
    }
    cache.serverUrl = localStorage.getItem(KEYS.SERVER_URL) || localStorage.getItem(KEYS.LEGACY_SERVER_URL) || null;
    cache.lastRoute = localStorage.getItem(KEYS.LAST_ROUTE) || null;
  } catch (e) {
    console.warn('[STORAGE] Failed initial localStorage read:', e);
  }
}

/**
 * Hydrates storage from native Capacitor Preferences (Android SharedPreferences)
 * Guarantees persistence across app force-close, phone reboot, and WebView cache resets.
 */
export const hydrateStorage = async (): Promise<void> => {
  try {
    const [tokenRes, refreshRes, userRes, serverRes, routeRes] = await Promise.all([
      Preferences.get({ key: KEYS.TOKEN }),
      Preferences.get({ key: KEYS.REFRESH_TOKEN }),
      Preferences.get({ key: KEYS.USER }),
      Preferences.get({ key: KEYS.SERVER_URL }),
      Preferences.get({ key: KEYS.LAST_ROUTE }),
    ]);

    if (tokenRes.value) {
      cache.token = tokenRes.value;
      if (typeof window !== 'undefined') localStorage.setItem(KEYS.TOKEN, tokenRes.value);
    }
    if (refreshRes.value) {
      cache.refreshToken = refreshRes.value;
      if (typeof window !== 'undefined') localStorage.setItem(KEYS.REFRESH_TOKEN, refreshRes.value);
    }
    if (userRes.value) {
      try {
        cache.user = JSON.parse(userRes.value);
        if (typeof window !== 'undefined') localStorage.setItem(KEYS.USER, userRes.value);
      } catch {}
    }
    if (serverRes.value) {
      cache.serverUrl = serverRes.value;
      if (typeof window !== 'undefined') localStorage.setItem(KEYS.SERVER_URL, serverRes.value);
    }
    if (routeRes.value) {
      cache.lastRoute = routeRes.value;
      if (typeof window !== 'undefined') localStorage.setItem(KEYS.LAST_ROUTE, routeRes.value);
    }

    cache.isHydrated = true;
    console.log('[STORAGE] Hydrated storage from native Android Preferences & localStorage');
  } catch (err) {
    console.warn('[STORAGE] Error hydrating native Preferences:', err);
    cache.isHydrated = true;
  }
};

export const storage = {
  // Sync read methods
  getToken(): string | null {
    return cache.token;
  },

  getRefreshToken(): string | null {
    return cache.refreshToken;
  },

  getUser(): User | null {
    return cache.user;
  },

  getServerUrl(): string | null {
    return cache.serverUrl;
  },

  getLastRoute(): string | null {
    return cache.lastRoute;
  },

  isHydrated(): boolean {
    return cache.isHydrated;
  },

  // Async persistent write methods
  async setToken(token: string | null): Promise<void> {
    cache.token = token;
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem(KEYS.TOKEN, token);
        localStorage.setItem(KEYS.LEGACY_TOKEN, token);
      } else {
        localStorage.removeItem(KEYS.TOKEN);
        localStorage.removeItem(KEYS.LEGACY_TOKEN);
      }
    }
    try {
      if (token) {
        await Preferences.set({ key: KEYS.TOKEN, value: token });
      } else {
        await Preferences.remove({ key: KEYS.TOKEN });
      }
    } catch (e) {
      console.warn('[STORAGE] Preferences.set token failed:', e);
    }
  },

  async setRefreshToken(refreshToken: string | null): Promise<void> {
    cache.refreshToken = refreshToken;
    if (typeof window !== 'undefined') {
      if (refreshToken) {
        localStorage.setItem(KEYS.REFRESH_TOKEN, refreshToken);
      } else {
        localStorage.removeItem(KEYS.REFRESH_TOKEN);
      }
    }
    try {
      if (refreshToken) {
        await Preferences.set({ key: KEYS.REFRESH_TOKEN, value: refreshToken });
      } else {
        await Preferences.remove({ key: KEYS.REFRESH_TOKEN });
      }
    } catch (e) {
      console.warn('[STORAGE] Preferences.set refresh token failed:', e);
    }
  },

  async setUser(user: User | null): Promise<void> {
    cache.user = user;
    const serialized = user ? JSON.stringify(user) : null;
    if (typeof window !== 'undefined') {
      if (serialized) {
        localStorage.setItem(KEYS.USER, serialized);
      } else {
        localStorage.removeItem(KEYS.USER);
      }
    }
    try {
      if (serialized) {
        await Preferences.set({ key: KEYS.USER, value: serialized });
      } else {
        await Preferences.remove({ key: KEYS.USER });
      }
    } catch (e) {
      console.warn('[STORAGE] Preferences.set user failed:', e);
    }
  },

  async setServerUrl(url: string | null): Promise<void> {
    cache.serverUrl = url;
    if (typeof window !== 'undefined') {
      if (url) {
        localStorage.setItem(KEYS.SERVER_URL, url);
        localStorage.setItem(KEYS.LEGACY_SERVER_URL, url);
      } else {
        localStorage.removeItem(KEYS.SERVER_URL);
        localStorage.removeItem(KEYS.LEGACY_SERVER_URL);
      }
    }
    try {
      if (url) {
        await Preferences.set({ key: KEYS.SERVER_URL, value: url });
      } else {
        await Preferences.remove({ key: KEYS.SERVER_URL });
      }
    } catch (e) {
      console.warn('[STORAGE] Preferences.set server url failed:', e);
    }
  },

  async setLastRoute(route: string): Promise<void> {
    // Only persist safe operational routes
    if (!route || route.startsWith('/login') || route.startsWith('/register') || route.startsWith('/auth')) {
      return;
    }
    cache.lastRoute = route;
    if (typeof window !== 'undefined') {
      localStorage.setItem(KEYS.LAST_ROUTE, route);
    }
    try {
      await Preferences.set({ key: KEYS.LAST_ROUTE, value: route });
    } catch {}
  },

  /**
   * Safe Session Clear:
   * Only wipes tokens and active user identity upon deliberate user sign-out.
   * NEVER wipes server configurations, preferences, or device settings.
   */
  async clearSession(): Promise<void> {
    cache.token = null;
    cache.refreshToken = null;
    cache.user = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem(KEYS.TOKEN);
      localStorage.removeItem(KEYS.LEGACY_TOKEN);
      localStorage.removeItem(KEYS.REFRESH_TOKEN);
      localStorage.removeItem(KEYS.USER);
    }
    try {
      await Promise.all([
        Preferences.remove({ key: KEYS.TOKEN }),
        Preferences.remove({ key: KEYS.REFRESH_TOKEN }),
        Preferences.remove({ key: KEYS.USER }),
      ]);
    } catch (e) {
      console.warn('[STORAGE] clearSession failed:', e);
    }
  }
};
