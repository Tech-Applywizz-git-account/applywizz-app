import React, { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSnackAuth } from "./AuthContext";
import { snackApi } from "./api";
import { showSnackifyOrderNotification } from "../src/notifications/push";

const POLL_MS = 8000;
const ACTIVE_ORDER_RE = /^(confirming|pending|placed|accepted|preparing|on_the_way|ready_for_pickup|in_progress)$/i;

function itemsSummary(row) {
  const items = row?.items || row?.order_items || [];
  if (Array.isArray(items) && items.length) {
    return items.map((i) => `${i.name || i.item_name || "Item"}${i.qty > 1 ? ` x${i.qty}` : ""}`).join(", ");
  }
  return row?.quick_item || "Pantry order";
}

export default function OfficeBoyAlertsController() {
  const navigation = useNavigation();
  const { role } = useSnackAuth();
  const primedRef = useRef(false);
  const seenRef = useRef(new Set());
  const firingRef = useRef(false);
  const openedRef = useRef(new Set());

  useEffect(() => {
    if (role !== "office_boy") return undefined;

    const poll = async () => {
      if (firingRef.current) return;
      firingRef.current = true;
      try {
        const data = await snackApi.listRequests();
        const list = data?.requests || data?.queue || data?.data || data || [];
        const rows = (Array.isArray(list) ? list : []).filter((row) => {
          const status = String(row?.live_status || row?.status || "");
          return ACTIVE_ORDER_RE.test(status);
        });
        const currentIds = new Set(rows.map((row) => String(row.id)));

        if (!primedRef.current) {
          if (AppState.currentState === "active" && rows.length) {
            const latest = [...rows].sort((a, b) => {
              const aTime = new Date(a?.created_at || a?.updated_at || 0).getTime();
              const bTime = new Date(b?.created_at || b?.updated_at || 0).getTime();
              return bTime - aTime;
            })[0];
            const latestId = String(latest?.id || "");
            if (latestId && !openedRef.current.has(latestId)) {
              openedRef.current.add(latestId);
              navigation.navigate("SnackifyOfficeBoyAlert", { id: latest.id });
            }
          }
          seenRef.current = currentIds;
          primedRef.current = true;
          return;
        }

        const fresh = rows.filter((row) => !seenRef.current.has(String(row.id)));
        seenRef.current = currentIds;
        for (const row of fresh) {
          const rowId = String(row.id);
          await showSnackifyOrderNotification({
            title: "New pantry order",
            body: `${row.delivery_mode === "self_pickup" ? "Pickup" : (row.location || "Desk")} - ${itemsSummary(row)}`,
            data: {
              request_id: row.id,
              order_number: row.user_order_number || "",
              screen: "SnackifyOfficeBoyAlert",
              type: "snackify_order",
            },
          });
          if (AppState.currentState === "active") {
            openedRef.current.add(rowId);
            navigation.navigate("SnackifyOfficeBoyAlert", { id: row.id });
          }
        }
      } catch (_) {
        /* keep polling */
      } finally {
        firingRef.current = false;
      }
    };

    poll();
    const timer = setInterval(poll, POLL_MS);
    const appSub = AppState.addEventListener("change", (state) => {
      if (state === "active") poll();
    });
    return () => {
      clearInterval(timer);
      appSub.remove();
    };
  }, [navigation, role]);

  return null;
}
