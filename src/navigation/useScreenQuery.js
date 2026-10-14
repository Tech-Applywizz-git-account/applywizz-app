import { useCallback, useMemo, useRef } from "react";
import { useNavigation, useRoute } from "@react-navigation/native";

/**
 * Sync screen filter/tab state with React Navigation route params
 * (works with Expo linking query strings).
 */
export function useScreenQuery(defaults = {}) {
  const navigation = useNavigation();
  const route = useRoute();
  const defaultsRef = useRef(defaults);
  defaultsRef.current = defaults;
  const params = route.params || {};

  const defaultKey = useMemo(
    () => Object.keys(defaultsRef.current).sort().join("|"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(defaults)],
  );

  const query = useMemo(() => {
    const defs = defaultsRef.current;
    const next = { ...defs };
    Object.keys(defs).forEach((key) => {
      if (params[key] == null || params[key] === "") return;
      const def = defs[key];
      const raw = params[key];
      if (typeof def === "number") {
        const n = Number(raw);
        next[key] = Number.isFinite(n) ? n : def;
      } else if (typeof def === "boolean") {
        next[key] = raw === true || raw === "1" || raw === "true";
      } else {
        next[key] = String(raw);
      }
    });
    return next;
  }, [params, defaultKey]);

  const setQuery = useCallback((patch) => {
    const defs = defaultsRef.current;
    const merged = { ...(route.params || {}), ...patch };
    Object.keys(patch).forEach((key) => {
      const value = patch[key];
      const def = defs[key];
      if (
        value == null
        || value === ""
        || (def !== undefined && String(value) === String(def))
      ) {
        delete merged[key];
      }
    });
    navigation.setParams(merged);
  }, [navigation, route.params]);

  return { query, setQuery, params };
}

export default useScreenQuery;
