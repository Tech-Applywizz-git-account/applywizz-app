import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api, {
  setUnauthorizedHandler,
  warmTokenCache,
  setCachedTokens,
  clearTokenCache,
} from "../api/client";
import { invalidatePrefix, hydrateQueryCache } from "../api/queryCache";
import { warmBackend } from "../api/warmup";
import { startBootstrapWorker, stopBootstrapWorker } from "../api/bootstrap";
import {
  registerPushTokenWithBackend,
  unregisterPushTokenFromBackend,
} from "../notifications/push";
import {
  loadAvatarUri,
  saveAvatarUri,
  clearLegacySharedAvatar,
} from "../utils/avatar";
import { clearSnackifySession } from "../../snackify/api";

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

const DEFAULT_PROFILE = { currency: "USD", accent_color: "#149E81" };
const WORKSPACE_KEY = "applywizz.workspace";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const [avatarUri, setAvatarUriState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const signingOutRef = useRef(false);
  const loginInFlightRef = useRef(false);
  const userIdRef = useRef(null);

  const refreshAvatar = useCallback(async (userId) => {
    const id = userId || userIdRef.current;
    if (!id) {
      setAvatarUriState(null);
      return null;
    }
    const uri = await loadAvatarUri(id);
    setAvatarUriState(uri);
    return uri;
  }, []);

  const setAvatarUri = useCallback(async (uri) => {
    const id = userIdRef.current;
    if (!id) return null;
    const saved = await saveAvatarUri(id, uri);
    setAvatarUriState(saved);
    return saved;
  }, []);

  /**
   * Instant local logout — UI clears immediately.
   * Network cleanup is best-effort and never blocks the login screen.
   * Overlay only shows when there was an active session (avoids login glitch).
   */
  const signOut = useCallback(async () => {
    if (signingOutRef.current) return;
    if (loginInFlightRef.current) return;

    const hadSession = Boolean(userIdRef.current);
    signingOutRef.current = true;
    setUnauthorizedHandler(null);

    // Clear UI first so navigation flips to Login in the same frame.
    userIdRef.current = null;
    setAvatarUriState(null);
    setUser(null);
    setProfile(DEFAULT_PROFILE);
    clearTokenCache();
    stopBootstrapWorker();

    if (hadSession) setSigningOut(true);

    const finish = () => {
      signingOutRef.current = false;
      setSigningOut(false);
      setUnauthorizedHandler(() => { signOut(); });
    };

    // Fire-and-forget cleanup with a hard cap so Sign out never sticks.
    const cleanup = (async () => {
      try {
        const refresh = await AsyncStorage.getItem("refresh");
        if (refresh) {
          api.post("/auth/logout/", { refresh }, { timeout: 1500 }).catch(() => {});
        }
      } catch { /* ignore */ }
      try {
        await AsyncStorage.multiRemove([
          "access",
          "refresh",
          "user",
          "legacy_access",
          "legacy_refresh",
          "owner_access",
          "owner_refresh",
          "owner_user",
          WORKSPACE_KEY,
        ]);
      } catch { /* ignore */ }
      try { await clearSnackifySession(); } catch { /* ignore */ }
      try { await unregisterPushTokenFromBackend(); } catch { /* ignore */ }
      try {
        invalidatePrefix("invoice_requests:");
        invalidatePrefix("external_paid_requests:");
      } catch { /* ignore */ }
    })();

    const cap = new Promise((resolve) => setTimeout(resolve, hadSession ? 600 : 0));
    Promise.race([cleanup, cap]).finally(finish);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (loginInFlightRef.current) return;
      if (!userIdRef.current) return;
      signOut();
    });
    return () => setUnauthorizedHandler(null);
  }, [signOut]);

  const loadProfile = useCallback(async () => {
    setProfile((prev) => prev || DEFAULT_PROFILE);
  }, []);

  const refreshMe = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me/");
      userIdRef.current = data?.id || null;
      setUser(data);
      await AsyncStorage.setItem("user", JSON.stringify(data));
      await refreshAvatar(data?.id);
      return data;
    } catch (e) {
      return null;
    }
  }, [refreshAvatar]);

  useEffect(() => {
    (async () => {
      // Wake Render + restore last Home snapshot without blocking the login screen.
      warmBackend({ force: false }).catch(() => {});
      hydrateQueryCache().catch(() => {});
      await warmTokenCache();
      clearLegacySharedAvatar().catch(() => {});
      const token = await AsyncStorage.getItem("access");
      const cached = await AsyncStorage.getItem("user");
      if (token && cached) {
        let parsed = null;
        try {
          parsed = JSON.parse(cached);
          userIdRef.current = parsed?.id || null;
          setUser(parsed);
          refreshAvatar(parsed?.id).catch(() => {});
        } catch {
          userIdRef.current = null;
          setUser(null);
          setAvatarUriState(null);
        }
        setLoading(false);
        if (parsed) startBootstrapWorker(parsed);
        refreshMe().catch(() => {});
        registerPushTokenWithBackend().catch(() => {});
      } else {
        setLoading(false);
      }
    })();
  }, [refreshMe, refreshAvatar]);

  const persist = async (data) => {
    if (!data?.tokens?.access || !data?.tokens?.refresh) {
      throw new Error("Login response missing tokens");
    }

    await AsyncStorage.setItem("access", data.tokens.access);
    await AsyncStorage.setItem("refresh", data.tokens.refresh);
    await AsyncStorage.setItem("user", JSON.stringify(data.user));
    if (data.legacy_tokens?.access) {
      await AsyncStorage.setItem("legacy_access", data.legacy_tokens.access);
      await AsyncStorage.setItem("legacy_refresh", data.legacy_tokens.refresh);
    }
    await setCachedTokens({
      access: data.tokens.access,
      legacy: data.legacy_tokens?.access || null,
    });
    // Do NOT wipe query cache on login — that forces a cold 30–60s Home wait.
    // Bootstrap overwrites keys; disk snapshots paint Home in milliseconds.
    userIdRef.current = data.user?.id || null;
    setUser(data.user);
    setProfile(DEFAULT_PROFILE);
    refreshAvatar(data.user?.id).catch(() => {});
    startBootstrapWorker(data.user);
    registerPushTokenWithBackend().catch(() => {});
  };

  const signIn = async (email, password = null, otp = null) => {
    const body = { email };
    if (password) body.password = password;
    if (otp) body.otp = otp;

    loginInFlightRef.current = true;
    setUnauthorizedHandler(null);
    try {
      // Do not block login on Render wake — ping in parallel.
      warmBackend({ force: false }).catch(() => {});
      const { data } = await api.post("/auth/login/", body, { timeout: 25000 });
      if (data.require_otp) return data;
      try {
        await AsyncStorage.multiRemove(["owner_access", "owner_refresh", "owner_user"]);
      } catch (e) { /* ignore */ }
      await persist(data);
      return data;
    } finally {
      loginInFlightRef.current = false;
      setUnauthorizedHandler(() => { signOut(); });
    }
  };

  const register = async (email, password, business_name) => {
    const { data } = await api.post("/auth/register/", { email, password, business_name });
    await persist(data);
  };

  const startImpersonation = useCallback(async (userId) => {
    if (!userId) throw new Error("user_id is required");
    const access = await AsyncStorage.getItem("access");
    const refresh = await AsyncStorage.getItem("refresh");
    const rawUser = await AsyncStorage.getItem("user");
    if (!access || !refresh) throw new Error("Not signed in");

    let data;
    try {
      const res = await api.post("/auth/impersonate/start/", { user_id: userId });
      data = res.data;
    } catch (e) {
      const status = e?.response?.status;
      const detail = e?.response?.data?.error || e?.response?.data?.detail || e?.message;
      if (status === 404) {
        throw new Error(
          "View-as API not found on the server. Deploy the latest backend (impersonate endpoints) or point the app at a local API.",
        );
      }
      throw new Error(detail || "Could not start view-as");
    }
    if (!data?.tokens?.access || !data?.tokens?.refresh || !data?.user) {
      throw new Error("Invalid impersonation response");
    }

    await AsyncStorage.multiSet([
      ["owner_access", access],
      ["owner_refresh", refresh],
      ["owner_user", rawUser || JSON.stringify(user || {})],
    ]);

    // Drop owner workspace + Snackify session so target apps/default land correctly.
    try {
      await AsyncStorage.removeItem(WORKSPACE_KEY);
    } catch (e) { /* ignore */ }
    try {
      await clearSnackifySession();
    } catch (e) { /* ignore */ }

    stopBootstrapWorker();
    await persist(data);
    return data.user;
  }, [user]);

  const stopImpersonation = useCallback(async () => {
    try {
      await api.post("/auth/impersonate/stop/");
    } catch (e) { /* best-effort */ }

    const ownerAccess = await AsyncStorage.getItem("owner_access");
    const ownerRefresh = await AsyncStorage.getItem("owner_refresh");
    const ownerUserRaw = await AsyncStorage.getItem("owner_user");
    if (!ownerAccess || !ownerRefresh) {
      await AsyncStorage.multiRemove(["owner_access", "owner_refresh", "owner_user"]);
      await signOut();
      return;
    }

    let ownerUser = null;
    try {
      ownerUser = ownerUserRaw ? JSON.parse(ownerUserRaw) : null;
    } catch {
      ownerUser = null;
    }

    stopBootstrapWorker();
    try {
      await AsyncStorage.removeItem(WORKSPACE_KEY);
    } catch (e) { /* ignore */ }
    try {
      await clearSnackifySession();
    } catch (e) { /* ignore */ }

    await AsyncStorage.multiSet([
      ["access", ownerAccess],
      ["refresh", ownerRefresh],
      ["user", ownerUserRaw || "{}"],
    ]);
    await AsyncStorage.multiRemove(["owner_access", "owner_refresh", "owner_user"]);
    await setCachedTokens({ access: ownerAccess, legacy: null });
    await invalidatePrefix("");

    userIdRef.current = ownerUser?.id || null;
    setUser(ownerUser);
    setProfile(DEFAULT_PROFILE);
    await refreshAvatar(ownerUser?.id);
    if (ownerUser) startBootstrapWorker(ownerUser);
    refreshMe().catch(() => {});
  }, [refreshAvatar, refreshMe, signOut]);

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      loading,
      signingOut,
      avatarUri,
      setAvatarUri,
      refreshAvatar,
      signIn,
      register,
      signOut,
      loadProfile,
      refreshMe,
      setProfile,
      startImpersonation,
      stopImpersonation,
      // Owner flag is enough: older cached sessions may lack can_impersonate from /me/.
      canImpersonate: Boolean(
        (user?.can_impersonate || user?.is_owner)
        && !user?.impersonation_active,
      ),
      impersonation: {
        active: Boolean(user?.impersonation_active),
        actorEmail: user?.impersonator_email || "",
        targetName: user?.name || "",
        targetEmail: user?.email || "",
      },
    }}
    >
      {children}
    </AuthContext.Provider>
  );
}
