import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { AppState } from "react-native";
import { snackApi } from "./api";
import {
  getSnackBootstrapMem,
  hydrateSnackCache,
  writeSnackBootstrap,
  readPendingOrders,
  dequeuePendingOrder,
} from "./tokenCache";

const Ctx = createContext(null);
export const useSnackTokens = () => useContext(Ctx);

function emptyWallet() {
  return {
    balance: 0,
    monthly_grant: 4000,
    spent_this_month: 0,
    remaining: 0,
    month: "",
    coin_value_inr: 1,
  };
}

function istClock(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const m = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  let year = Number(m.year);
  let month = Number(m.month);
  const day = Number(m.day);
  const hour = Number(m.hour);
  if (day === 1 && hour < 8) {
    month -= 1;
    if (month === 0) {
      month = 12;
      year -= 1;
    }
  }
  return {
    monthKey: `${year}${String(month).padStart(2, "0")}`,
    day,
    hour,
  };
}

export function SnackTokenProvider({ children }) {
  const snap = getSnackBootstrapMem();
  const [wallet, setWallet] = useState(snap?.wallet || emptyWallet());
  const [catalog, setCatalog] = useState(snap?.catalog || []);
  const [ledger, setLedger] = useState(snap?.ledger || []);
  const [printQueue, setPrintQueue] = useState(snap?.print_queue || []);
  const [mealOptions, setMealOptions] = useState(snap?.meal_options || null);
  const [card, setCard] = useState(snap?.card || null);
  const [ready, setReady] = useState(Boolean(snap));

  const apply = useCallback((data) => {
    if (!data) return;
    if (data.wallet) setWallet((prev) => ({ ...prev, ...data.wallet }));
    if (data.catalog) setCatalog(data.catalog);
    if (data.ledger) setLedger(data.ledger);
    if (data.print_queue) setPrintQueue(data.print_queue);
    if (data.meal_options) setMealOptions(data.meal_options);
    if (data.card) setCard(data.card);
    writeSnackBootstrap({ ...(getSnackBootstrapMem() || {}), ...data }).catch(() => {});
  }, []);

  const refresh = useCallback(async () => {
    try {
      let data = await snackApi.tokensBootstrap();
      const clock = istClock();
      const walletMonth = String(data?.wallet?.month || "");
      const grantAmt = Number(data?.wallet?.monthly_grant || 0);
      if (
        (clock.day === 1 && clock.hour >= 8 && walletMonth !== clock.monthKey)
        || (grantAmt > 0 && grantAmt !== 4000)
        || (walletMonth && walletMonth !== clock.monthKey)
      ) {
        try {
          await snackApi.ensureMonthlyWallet({ amount: 4000, month: clock.monthKey });
          data = await snackApi.tokensBootstrap();
        } catch (_) {
          /* backend may auto-grant; keep bootstrap payload */
        }
      }
      apply(data);
      return data;
    } catch {
      return getSnackBootstrapMem();
    }
  }, [apply]);

  const flushQueue = useCallback(async () => {
    const pending = await readPendingOrders();
    for (const payload of pending) {
      try {
        await snackApi.placeRequest(payload, { enqueue: false });
        await dequeuePendingOrder(payload.client_order_id);
      } catch {
        break;
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await hydrateSnackCache();
      if (cancelled) return;
      const cached = getSnackBootstrapMem();
      if (cached) apply(cached);
      setReady(true);
      refresh();
      flushQueue();
    })();
    return () => { cancelled = true; };
  }, [apply, refresh, flushQueue]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        refresh();
        flushQueue();
      }
    });
    return () => sub.remove();
  }, [refresh, flushQueue]);

  const value = useMemo(
    () => ({
      ready,
      wallet,
      catalog,
      ledger,
      printQueue,
      mealOptions,
      card,
      refresh,
      apply,
      format: (n) => `${Number(n) || 0} coins`,
    }),
    [ready, wallet, catalog, ledger, printQueue, mealOptions, card, refresh, apply],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
