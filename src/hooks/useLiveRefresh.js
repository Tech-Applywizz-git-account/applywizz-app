import { useCallback, useRef } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "@react-navigation/native";

/** Match web React Query live defaults. */
export const LIVE_POLL_MS = 30_000;
export const LIVE_STALE_MS = 15_000;

/**
 * While the screen is focused and the app is active, call `onTick` on an interval
 * and again when returning from background.
 */
export function useLiveRefresh(onTick, intervalMs = LIVE_POLL_MS) {
  const tickRef = useRef(onTick);
  tickRef.current = onTick;

  useFocusEffect(
    useCallback(() => {
      const run = () => {
        if (AppState.currentState !== "active") return;
        try {
          tickRef.current?.();
        } catch {
          /* ignore */
        }
      };
      const id = setInterval(run, intervalMs);
      const sub = AppState.addEventListener("change", (state) => {
        if (state === "active") run();
      });
      return () => {
        clearInterval(id);
        sub.remove();
      };
    }, [intervalMs]),
  );
}

export default useLiveRefresh;
