import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { snackApi } from "./api";
import { categoriesFrom, enrichMenu } from "./catalog";
import { getSnackBootstrapMem, hydrateSnackCache, writeSnackBootstrap } from "./tokenCache";
import { useSnackTokens } from "./TokenContext";

const EMPTY = { items: [], cats: [], forcePickup: false, pickupMsg: "", err: "", loading: false, load: () => {}, byId: () => null };
const Ctx = createContext(EMPTY);
export const useSnackMenu = () => useContext(Ctx) || EMPTY;

function menuFromSnap(snap, catalog) {
  const raw = snap?.menu;
  if (!raw) return [];
  return enrichMenu(raw, catalog || snap?.catalog || []);
}

export function SnackMenuProvider({ children }) {
  const tokens = useSnackTokens();
  const snap0 = getSnackBootstrapMem();
  const [items, setItems] = useState(() => menuFromSnap(snap0, snap0?.catalog));
  const [forcePickup, setForcePickup] = useState(false);
  const [pickupMsg, setPickupMsg] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async ({ silent } = {}) => {
    const cached = getSnackBootstrapMem();
    const hasCache = Array.isArray(cached?.menu) && cached.menu.length > 0;
    if (!silent && !hasCache && items.length === 0) setLoading(true);
    try {
      const [menu, pickup] = await Promise.all([
        snackApi.items(),
        snackApi.selfPickupStatus().catch(() => null),
      ]);
      const raw = Array.isArray(menu)
        ? menu
        : (menu?.items || menu?.data || menu?.results || menu?.rows || menu?.menu || []);
      const catalog = tokens?.catalog || cached?.catalog || [];
      const enriched = enrichMenu(raw, catalog);
      setItems(enriched);
      const forced = Boolean(pickup?.is_self_pickup_day || pickup?.force_self_pickup || pickup?.on_leave || pickup?.self_pickup);
      setForcePickup(forced);
      setPickupMsg(forced ? (pickup?.message || "Office boy is on leave — self pickup only.") : "");
      setErr("");
      writeSnackBootstrap({ ...(getSnackBootstrapMem() || {}), menu: raw, catalog }).catch(() => {});
    } catch (e) {
      if (!hasCache && items.length === 0) {
        setErr(e?.message || "Could not load the pantry menu.");
      }
    } finally {
      setLoading(false);
    }
  }, [items.length, tokens?.catalog]);

  useEffect(() => {
    hydrateSnackCache().then((snap) => {
      if (snap?.menu) setItems(menuFromSnap(snap, tokens?.catalog || snap.catalog));
    });
  }, [tokens?.catalog]);

  const byId = useCallback((id) => items.find((i) => String(i.id) === String(id)), [items]);
  const cats = useMemo(() => categoriesFrom(items), [items]);

  const value = useMemo(
    () => ({ items, cats, forcePickup, pickupMsg, err, loading, load, byId }),
    [items, cats, forcePickup, pickupMsg, err, loading, load, byId],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
