import AsyncStorage from "@react-native-async-storage/async-storage";

const { serializeCache, deserializeCache } = require("./core");

const PREFIX = "applywizz.event-theme.v1.";

export async function loadThemeCache(moduleId) {
  try {
    return deserializeCache(await AsyncStorage.getItem(`${PREFIX}${moduleId}`));
  } catch (_) {
    return null;
  }
}

export async function saveThemeCache(moduleId, entry) {
  try {
    const serialized = serializeCache(entry);
    if (serialized.length <= 140000) await AsyncStorage.setItem(`${PREFIX}${moduleId}`, serialized);
  } catch (_) {
    // A bad remote response must never replace the last-known-good entry.
  }
}

export { serializeCache, deserializeCache };
