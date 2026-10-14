import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "./AuthContext";
import { attachWorkspaceSwitcher } from "./workspaceBridge";

const STORAGE_KEY = "applywizz.workspace";

export const WORKSPACE_IDS = {
  invoice: "invoice",
  snackify: "snackify",
  career: "career",
};

const ALL_WORKSPACE_IDS = Object.values(WORKSPACE_IDS);

const WorkspaceContext = createContext(null);

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error("useWorkspace must be used inside WorkspaceProvider");
  }
  return ctx;
}

/**
 * Default landing app from entitlements:
 * - invoice + snackify (+/- career) → invoice
 * - snackify + career (no invoice) → career
 * - snackify only → snackify
 */
export function preferredWorkspace(apps) {
  const set = new Set(
    (Array.isArray(apps) ? apps : [])
      .map((id) => String(id || "").trim().toLowerCase())
      .filter((id) => ALL_WORKSPACE_IDS.includes(id)),
  );
  if (set.has(WORKSPACE_IDS.invoice)) return WORKSPACE_IDS.invoice;
  if (set.has(WORKSPACE_IDS.snackify)) return WORKSPACE_IDS.snackify;
  return WORKSPACE_IDS.career;
}

export function WorkspaceProvider({ children }) {
  const { user } = useAuth();
  const [workspaceId, setWorkspaceIdState] = useState(null);
  const [workspaceOwnerId, setWorkspaceOwnerId] = useState(null);
  const appliedUserRef = useRef(null);

  const allowedApps = useMemo(() => {
    const fromUser = user?.apps;
    if (Array.isArray(fromUser) && fromUser.length) {
      return fromUser.filter((id) => ALL_WORKSPACE_IDS.includes(id));
    }
    return [WORKSPACE_IDS.snackify];
  }, [user?.apps]);

  const defaultWorkspace = useMemo(
    () => preferredWorkspace(allowedApps),
    [allowedApps],
  );

  const canOpen = useCallback(
    (id) => allowedApps.includes(id),
    [allowedApps],
  );

  const showSwitcher = allowedApps.length > 1;

  const persist = useCallback(async (id, ownerId) => {
    setWorkspaceIdState(id);
    if (ownerId) setWorkspaceOwnerId(ownerId);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, id);
    } catch (_) {
      /* ignore */
    }
  }, []);

  // Resolve landing workspace when auth/apps are ready or user changes.
  // Never flip ready→false after first paint — that unmounted the whole
  // navigator and flashed a black splash during login.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user?.id) {
        appliedUserRef.current = null;
        if (!cancelled) {
          setWorkspaceIdState(null);
          setWorkspaceOwnerId(null);
        }
        return;
      }

      const userChanged = appliedUserRef.current !== user.id;
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        let next = defaultWorkspace;

        if (!userChanged && saved && allowedApps.includes(saved)) {
          // Same session / app resume — keep last choice if still allowed.
          next = saved;
        } else {
          // New login or entitlement change — land on policy default.
          next = defaultWorkspace;
        }

        if (!allowedApps.includes(next)) next = defaultWorkspace;

        if (!cancelled) {
          appliedUserRef.current = user.id;
          await persist(next, user.id);
        }
      } catch (_) {
        if (!cancelled) await persist(defaultWorkspace, user.id);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id, allowedApps.join("|"), defaultWorkspace, persist]);

  const setWorkspaceId = useCallback(async (id) => {
    if (!ALL_WORKSPACE_IDS.includes(id) || !canOpen(id)) return;
    await persist(id, user?.id);
  }, [canOpen, persist, user?.id]);

  // Derive immediately from the signed-in user so login never waits on
  // AsyncStorage / an effect tick (those caused a blank frame).
  const resolvedWorkspaceId = useMemo(() => {
    if (!user?.id) return null;
    if (
      workspaceOwnerId === user.id
      && workspaceId
      && allowedApps.includes(workspaceId)
    ) {
      return workspaceId;
    }
    return defaultWorkspace;
  }, [user?.id, workspaceOwnerId, workspaceId, allowedApps, defaultWorkspace]);

  useEffect(() => {
    attachWorkspaceSwitcher(setWorkspaceId);
    return () => attachWorkspaceSwitcher(null);
  }, [setWorkspaceId]);

  const value = useMemo(
    () => ({
      workspaceId: resolvedWorkspaceId,
      setWorkspaceId,
      ready: true,
      allowedApps,
      canOpen,
      showSwitcher,
      defaultWorkspace,
    }),
    [resolvedWorkspaceId, setWorkspaceId, allowedApps, canOpen, showSwitcher, defaultWorkspace],
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}
