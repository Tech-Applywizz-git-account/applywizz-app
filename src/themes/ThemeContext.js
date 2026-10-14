import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from "react";
import { AccessibilityInfo, AppState, Image } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { useWorkspace } from "../context/WorkspaceContext";
import { useAuth } from "../context/AuthContext";
import { BRAND } from "../theme";
import { fetchActiveTheme } from "./api";
import { loadThemeCache, saveThemeCache } from "./cache";
import { getModuleDefaults, toLegacyTheme } from "./defaults";

const {
  sanitizeActivePayload, sanitizeTokens, resolveTheme, deepMerge, moduleForRoute, moduleForWorkspace,
} = require("./core");

const ThemeContext = createContext(null);
const MIN_FETCH_GAP = 30000;

function payloadChecksum(payload) {
  return payload?.themes?.map((item) => item.checksum).filter(Boolean).join(":") || "";
}

export function ThemeProvider({ children }) {
  const { workspaceId } = useWorkspace();
  const { profile } = useAuth();
  const [routeName, setRouteNameState] = useState(null);
  const moduleId = moduleForRoute(routeName, workspaceId);
  const [payload, setPayload] = useState(null);
  const [preview, setPreview] = useState(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [status, setStatus] = useState("default");
  // Keyed by module so switching routes never applies another module's payload.
  const cachesRef = useRef(new Map());
  const lastFetchRef = useRef(new Map());
  const moduleRef = useRef(moduleId);
  const abortRef = useRef(null);

  const refresh = useCallback(async (targetModule, { force = false } = {}) => {
    const now = Date.now();
    if (!force && now - (lastFetchRef.current.get(targetModule) || 0) < MIN_FETCH_GAP) return;
    lastFetchRef.current.set(targetModule, now);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const known = cachesRef.current.get(targetModule);
    try {
      const result = await fetchActiveTheme(targetModule, known?.etag, controller.signal);
      if (result.status === 304) {
        if (known) {
          const touched = { ...known, fetchedAt: now };
          cachesRef.current.set(targetModule, touched);
          saveThemeCache(targetModule, touched);
        }
        if (moduleRef.current === targetModule) setStatus("current");
        return;
      }
      const clean = sanitizeActivePayload(result.data);
      const entry = {
        payload: clean, etag: result.etag, checksum: payloadChecksum(clean), fetchedAt: now,
      };
      cachesRef.current.set(targetModule, entry);
      saveThemeCache(targetModule, entry);
      // A late response for a module we already navigated away from must not paint.
      if (moduleRef.current !== targetModule) return;
      setPayload(clean);
      setStatus("current");
      const performance = clean.tokens.performance || {};
      if (performance.maxAssets > 0 && performance.maxAssetBytes > 0) {
        const keys = (performance.preloadAssets || []).slice(0, Math.min(performance.maxAssets, 6));
        keys.forEach((key) => {
          const asset = clean.assets[key];
          if (asset?.type === "image") Image.prefetch(asset.url).catch(() => {});
        });
      }
    } catch (error) {
      if (
        moduleRef.current === targetModule
        && error?.name !== "AbortError"
        && error?.code !== "ERR_CANCELED"
      ) {
        setStatus(cachesRef.current.get(targetModule) ? "cached" : "default");
      }
    }
  }, []);

  useEffect(() => {
    let active = true;
    moduleRef.current = moduleId;
    const inMemory = cachesRef.current.get(moduleId);
    setPayload(inMemory?.payload || null);
    setStatus(inMemory ? "cached" : "default");
    if (inMemory) {
      refresh(moduleId);
      return () => { active = false; };
    }
    loadThemeCache(moduleId).then((cached) => {
      if (!active || moduleRef.current !== moduleId) return;
      if (cached) {
        cachesRef.current.set(moduleId, cached);
        setPayload(cached.payload);
        setStatus("cached");
      }
      refresh(moduleId, { force: true });
    });
    return () => { active = false; };
  }, [moduleId, refresh]);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReducedMotion).catch(() => {});
    const motion = AccessibilityInfo.addEventListener("reduceMotionChanged", setReducedMotion);
    const app = AppState.addEventListener("change", (next) => {
      if (next === "active") refresh(moduleRef.current);
    });
    const network = NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) refresh(moduleRef.current);
    });
    return () => {
      motion?.remove();
      app.remove();
      network();
      abortRef.current?.abort();
    };
  }, [refresh]);

  const setRouteName = useCallback((next) => {
    setRouteNameState(typeof next === "string" && next ? next : null);
  }, []);

  const defaults = useMemo(() => {
    const base = getModuleDefaults(moduleId);
    const customAccent = profile?.accent_color && profile.accent_color !== "#4F46E5"
      ? profile.accent_color
      : BRAND.teal;
    return moduleId === "invoice"
      ? deepMerge(base, { colors: { primary: customAccent, accent: customAccent, focus: customAccent } })
      : base;
  }, [moduleId, profile?.accent_color]);

  const tokens = useMemo(() => {
    const remote = preview || (payload?.themes?.length ? payload.tokens : {});
    return resolveTheme(defaults, remote, {
      moduleId,
      reducedMotion: reducedMotion || Boolean(remote?.accessibility?.reduceMotion),
      lowPerformance: remote?.performance?.animationBudgetMs === 0,
    });
  }, [defaults, moduleId, payload, preview, reducedMotion]);

  const value = useMemo(() => ({
    moduleId,
    workspaceModule: moduleForWorkspace(workspaceId),
    routeName,
    setRouteName,
    tokens,
    theme: toLegacyTheme(tokens),
    assets: payload?.assets || {},
    activeThemes: payload?.themes || [],
    status,
    isPreviewing: Boolean(preview),
    applyPreview(next) {
      setPreview(sanitizeTokens(next?.tokens || next || {}));
    },
    clearPreview() { setPreview(null); },
    refresh: () => refresh(moduleRef.current, { force: true }),
    reducedMotion,
  }), [moduleId, workspaceId, routeName, setRouteName, tokens, payload, status, preview, refresh, reducedMotion]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useEventTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useEventTheme must be used inside ThemeProvider");
  return context;
}

export function useModuleTheme(moduleId) {
  const context = useEventTheme();
  return useMemo(() => {
    if (!moduleId || moduleId === context.moduleId) return context;
    const tokens = resolveTheme(
      getModuleDefaults(moduleId),
      {},
      { moduleId, reducedMotion: context.reducedMotion },
    );
    return { ...context, tokens, theme: toLegacyTheme(tokens) };
  }, [context, moduleId]);
}

export const useIncentiveTheme = () => useModuleTheme("incentives");
