import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { newClientOrderId } from "./api";

const CartContext = createContext(null);
export const useSnackCart = () => useContext(CartContext);

export function SnackCartProvider({ children }) {
  const [lines, setLines] = useState([]);
  const [mode, setMode] = useState("get_it_here");
  const [location, setLocation] = useState("");
  const [note, setNote] = useState("");
  const [order, setOrder] = useState(null);

  const lastAddRef = useRef({ key: "", ts: 0 });

  const add = useCallback((item, extras = {}) => {
    const breadType = item.isSandwich
      ? (extras.breadType || item.breadOptions?.[0] || "")
      : (extras.breadType || "");
    const key = item.isSandwich
      ? `${item.id}-${breadType}-${extras.sides || "one"}`
      : String(item.id);
    const qty = extras.qty || 1;

    const now = Date.now();
    if (lastAddRef.current.key === key && now - lastAddRef.current.ts < 400) return;
    lastAddRef.current = { key, ts: now };

    setLines((prev) => {
      const hit = prev.find((l) => l.key === key);
      if (hit) return prev.map((l) => (l.key === key ? { ...l, qty: l.qty + qty } : l));
      return [...prev, {
        key,
        id: item.id,
        name: item.name,
        displayName: item.isSandwich ? item.spreadItemName || item.name : item.name,
        img: item.img || "",
        qty,
        breadType,
        customNote: extras.customNote || "",
        isSandwich: !!item.isSandwich,
        sides: extras.sides || "",
        coinPrice: Number(item.coinPrice ?? item.token_price) || 0,
      }];
    });
  }, []);

  const setQty = (key, qty) => {
    setLines((prev) => (qty <= 0 ? prev.filter((l) => l.key !== key) : prev.map((l) => (l.key === key ? { ...l, qty } : l))));
  };

  const clear = () => setLines([]);
  const count = lines.reduce((s, l) => s + l.qty, 0);
  const totalCoins = lines.reduce((s, l) => s + l.qty * (Number(l.coinPrice) || 0), 0);

  const payload = () => ({
    items: lines.map((l) => ({
      name: l.displayName || l.name,
      qty: l.qty,
      breadType: l.breadType || "",
      customNote: l.customNote || "",
      tokens: Number(l.coinPrice) || 0,
    })),
    location: mode === "get_it_here" ? (location || null) : null,
    note: note || undefined,
    delivery_mode: mode,
    fulfillmentType: mode === "get_it_here" ? "delivery" : "pickup",
    client_order_id: newClientOrderId(),
  });

  const value = useMemo(
    () => ({
      lines, add, setQty, clear, count, totalCoins,
      mode, setMode, location, setLocation, note, setNote,
      order, setOrder, payload,
    }),
    [lines, count, totalCoins, mode, location, note, order],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
