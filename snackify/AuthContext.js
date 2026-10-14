import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "../src/context/AuthContext";
import {
  snackApi,
  loadSnackifyTokens,
  saveSnackifySession,
  setAuthErrorHandler,
  refreshSnackifyAccessToken,
  extractSnackifyTokens,
  ensureSnackifyBearer,
  setSnackifyGuestIdentity,
  PANTRY_UNAVAILABLE,
} from "./api";
import { isSnackifyOwner } from "./theme";
import { markSnackifyOnboarded } from "./screens/SplashScreen";

const Ctx = createContext(null);
export const useSnackAuth = () => useContext(Ctx);

function pickTokens(data) {
  return extractSnackifyTokens(data);
}

export function SnackAuthProvider({ children }) {
  const { user: applyUser, signOut: applySignOut, refreshMe } = useAuth();
  const [ready, setReady] = useState(false);
  const [pantrySession, setPantrySession] = useState(null);
  const [prefs, setPrefs] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pantryError, setPantryError] = useState("");

  useEffect(() => {
    setSnackifyGuestIdentity({
      email: applyUser?.email,
      name: applyUser?.name,
    });
  }, [applyUser?.email, applyUser?.name]);

  // Keep snackify_role fresh — admin role changes must flip Queue vs Staff tabs.
  useEffect(() => {
    if (!applyUser?.id || !refreshMe) return undefined;
    refreshMe().catch(() => {});
  }, [applyUser?.id, refreshMe]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setSnackifyGuestIdentity({
        email: applyUser?.email,
        name: applyUser?.name,
      });
      let { access, refresh, profile, prefs: savedPrefs } = await loadSnackifyTokens();
      if (!cancelled && access && refresh) {
        try {
          const next = await refreshSnackifyAccessToken();
          access = next.access;
        } catch (_) {
          /* keep existing access */
        }
      }
      if (!cancelled && !access && applyUser?.email) {
        try {
          access = await ensureSnackifyBearer(applyUser.email);
          const stored = await loadSnackifyTokens();
          refresh = stored.refresh;
          profile = {
            ...(stored.profile || {}),
            email: applyUser.email,
            name: applyUser.name,
            role: applyUser.snackify_role || stored.profile?.role || "staff",
          };
          if (access) {
            await saveSnackifySession({ profile });
          }
        } catch (e) {
          console.log("[snackify] guest bootstrap failed:", e.message);
        }
      }
      if (!cancelled && access) {
        const role = applyUser?.snackify_role || profile?.role || "staff";
        const nextProfile = {
          ...(profile || {}),
          email: applyUser?.email || profile?.email || "",
          name: applyUser?.name || profile?.name || "",
          role,
        };
        setPantrySession({ access, profile: nextProfile });
        if (savedPrefs) {
          setPrefs(savedPrefs);
          if (savedPrefs.onboarding_completed) {
            markSnackifyOnboarded(applyUser?.email || nextProfile.email).catch(() => {});
          }
        }
      }
      if (!cancelled && access) {
        snackApi.tokensBootstrap().then((boot) => {
          const preferred = boot?.profile?.preferred_name;
          if (!preferred || cancelled) return;
          setPantrySession((prev) => ({
            ...(prev || {}),
            profile: { ...(prev?.profile || {}), preferred_name: preferred, name: preferred },
          }));
          saveSnackifySession({
            profile: {
              email: applyUser?.email,
              name: preferred,
              preferred_name: preferred,
              role: applyUser?.snackify_role || "staff",
            },
          }).catch(() => {});
        }).catch(() => {});
      }
      if (!cancelled) setReady(true);
    })();
    return () => { cancelled = true; };
  }, [applyUser?.id, applyUser?.snackify_role, applyUser?.email, applyUser?.name]);

  const applyAuth = useCallback(async (data) => {
    const next = pickTokens(data);
    if (!next.access) throw new Error("No session returned");
    const profile = next.profile || null;
    await saveSnackifySession({ access: next.access, refresh: next.refresh, profile });
    setPantrySession({ access: next.access, profile });
    setPantryError("");
    return profile;
  }, []);

  const updatePrefs = useCallback(async (newPrefs) => {
    setPrefs(newPrefs);
    await saveSnackifySession({ prefs: newPrefs });
    if (newPrefs?.onboarding_completed) {
      await markSnackifyOnboarded(applyUser?.email);
    }
  }, [applyUser?.email]);

  const startLogin = useCallback(async (email) => {
    setBusy(true); setError("");
    try {
      return await snackApi.startLogin(String(email || "").trim().toLowerCase());
    } catch (e) {
      setError(e.message); throw e;
    } finally { setBusy(false); }
  }, []);

  const verifyTotp = useCallback(async (transactionId, code) => {
    setBusy(true); setError("");
    try {
      const data = await snackApi.verifyTotpLogin(transactionId, code);
      return applyAuth(data);
    } catch (e) {
      setError(e.message); throw e;
    } finally { setBusy(false); }
  }, [applyAuth]);

  const startEnrollment = useCallback(async (email) => {
    setBusy(true); setError("");
    try {
      return await snackApi.startEnrollment(String(email || "").trim().toLowerCase());
    } catch (e) {
      setError(e.message); throw e;
    } finally { setBusy(false); }
  }, []);

  const verifyEnrollmentOtp = useCallback(async (id, code) => {
    setBusy(true); setError("");
    try {
      return await snackApi.verifyEnrollmentOtp(id, code);
    } catch (e) {
      setError(e.message); throw e;
    } finally { setBusy(false); }
  }, []);

  const verifyTotpEnrollment = useCallback(async (id, code) => {
    setBusy(true); setError("");
    try {
      const data = await snackApi.verifyTotpEnrollment(id, code);
      return applyAuth(data);
    } catch (e) {
      setError(e.message); throw e;
    } finally { setBusy(false); }
  }, [applyAuth]);

  const guest = useCallback(async () => {
    setBusy(true); setError("");
    try {
      setSnackifyGuestIdentity({ email: applyUser?.email, name: applyUser?.name });
      const data = await snackApi.guestLogin(applyUser?.email);
      const profile = {
        role: applyUser?.snackify_role || "staff",
        email: applyUser?.email,
        name: applyUser?.name,
      };
      await applyAuth({ ...data, profile: data?.profile || profile });
    } catch (e) {
      setError(e.message); throw e;
    } finally { setBusy(false); }
  }, [applyAuth, applyUser?.email, applyUser?.name, applyUser?.snackify_role]);

  const signOut = useCallback(async () => {
    await applySignOut();
  }, [applySignOut]);

  useEffect(() => {
    setAuthErrorHandler(() => {
      setPantryError(PANTRY_UNAVAILABLE);
    });
    return () => setAuthErrorHandler(null);
  }, []);

  const snackifyRole = applyUser?.snackify_role || pantrySession?.profile?.role || "staff";
  const isOwner = isSnackifyOwner(applyUser);
  const setPreferredName = useCallback(async (preferredName, extra = {}) => {
    const name = String(preferredName || "").trim();
    let next = name;
    try {
      const data = await snackApi.updateProfile({
        preferred_name: name,
        employee_code: extra.employee_code,
      });
      next = data?.preferred_name || name;
    } catch (e) {
      if (e.status === 404) {
        await snackApi.updateCardStyle({ display_name: name.slice(0, 22), color: "neon" }).catch(() => {});
      } else {
        throw e;
      }
    }
    setPantrySession((prev) => ({
      ...(prev || {}),
      profile: { ...(prev?.profile || {}), preferred_name: next, name: next },
    }));
    await saveSnackifySession({
      profile: {
        ...(pantrySession?.profile || {}),
        email: applyUser?.email || pantrySession?.profile?.email,
        name: next,
        preferred_name: next,
        role: applyUser?.snackify_role || pantrySession?.profile?.role || "staff",
      },
    });
    return next;
  }, [applyUser?.email, applyUser?.snackify_role, pantrySession]);

  const profile = useMemo(() => ({
    email: applyUser?.email || pantrySession?.profile?.email || "",
    name: pantrySession?.profile?.preferred_name || applyUser?.name || pantrySession?.profile?.name || "",
    preferred_name: pantrySession?.profile?.preferred_name || "",
    role: snackifyRole,
  }), [applyUser, pantrySession, snackifyRole]);

  const session = applyUser
    ? { access: pantrySession?.access || null, profile }
    : null;

  const onboarded = prefs?.onboarding_completed === true;
  const preferredLocation = prefs?.preferred_location || null;
  const hasPantryToken = Boolean(pantrySession?.access);

  const value = useMemo(
    () => ({
      ready,
      session,
      pantrySession,
      hasPantryToken,
      pantryError,
      role: snackifyRole,
      isOwner,
      busy,
      error,
      setError,
      prefs,
      onboarded,
      preferredLocation,
      updatePrefs,
      startLogin,
      verifyTotp,
      startEnrollment,
      verifyEnrollmentOtp,
      verifyTotpEnrollment,
      guest,
      signOut,
      profile,
      setPreferredName,
    }),
    [
      ready, session, pantrySession, hasPantryToken, pantryError, snackifyRole, isOwner,
      busy, error, prefs, onboarded, preferredLocation,
      startLogin, verifyTotp, startEnrollment, verifyEnrollmentOtp, verifyTotpEnrollment,
      guest, signOut, updatePrefs, profile, setPreferredName,
    ],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
