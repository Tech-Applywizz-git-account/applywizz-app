import { showSnackifyWalletNotification } from "../src/notifications/push";

export function itemLabelFromLines(lines) {
  const parts = (lines || [])
    .map((l) => {
      const name = String(l?.displayName || l?.name || l?.item_name || "").trim();
      if (!name) return "";
      const qty = Number(l.qty) || 1;
      return qty > 1 ? `${name} ×${qty}` : name;
    })
    .filter(Boolean);
  return parts.join(", ") || "your order";
}

export function notifyCoinsDeducted({ item, charged, remaining, requestId }) {
  return showSnackifyWalletNotification({
    title: "Coins deducted",
    body: `Your coins ${charged} for ${item} deducted. Now available are ${remaining}.`,
    data: { request_id: requestId, screen: "SnackifyTrack" },
  });
}

export function notifyCoinsRefunded({ item, refunded, remaining, requestId }) {
  return showSnackifyWalletNotification({
    title: "Order cancelled",
    body: `Your order was cancelled successfully and re-added coins for ${item} are ${refunded}. Now available coins are ${remaining}.`,
    data: { request_id: requestId, screen: "SnackifyTrack" },
  });
}
