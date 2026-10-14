import AsyncStorage from "@react-native-async-storage/async-storage";

/** Legacy device-wide key (caused avatar leaking across accounts). */
const LEGACY_AVATAR_KEY = "profile_avatar_uri";

function userKey(userId) {
  const id = String(userId || "").trim();
  if (!id) return null;
  return `profile_avatar_uri:${id}`;
}

/** Single-letter avatar fallback (first char of name or email). */
export function firstLetter(user, profile) {
  const name = String(user?.name || "").trim();
  if (name && !name.includes("@")) return name.charAt(0).toUpperCase();
  const email = String(user?.email || "").trim();
  if (email) return email.charAt(0).toUpperCase();
  const biz = String(profile?.business_name || "").trim();
  if (biz) return biz.charAt(0).toUpperCase();
  return "A";
}

/** Drop the old shared key so one user's photo never applies to others. */
export async function clearLegacySharedAvatar() {
  try {
    await AsyncStorage.removeItem(LEGACY_AVATAR_KEY);
  } catch {
    /* ignore */
  }
}

export async function loadAvatarUri(userId) {
  const key = userKey(userId);
  if (!key) return null;
  try {
    return (await AsyncStorage.getItem(key)) || null;
  } catch {
    return null;
  }
}

export async function saveAvatarUri(userId, uri) {
  const key = userKey(userId);
  if (!key) return null;
  try {
    // Ensure the shared legacy key cannot leak to other accounts.
    await AsyncStorage.removeItem(LEGACY_AVATAR_KEY);
    if (!uri) {
      await AsyncStorage.removeItem(key);
      return null;
    }
    await AsyncStorage.setItem(key, uri);
    return uri;
  } catch {
    return null;
  }
}
