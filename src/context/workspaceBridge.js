import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "applywizz.workspace";
const VALID_WORKSPACES = new Set(["invoice", "snackify", "career"]);

let imperativeWorkspaceSetter = null;

export function attachWorkspaceSwitcher(fn) {
  imperativeWorkspaceSetter = typeof fn === "function" ? fn : null;
}

export async function switchWorkspaceExternally(id) {
  if (!VALID_WORKSPACES.has(id)) return;
  if (imperativeWorkspaceSetter) {
    await imperativeWorkspaceSetter(id);
    return;
  }
  try {
    await AsyncStorage.setItem(STORAGE_KEY, id);
  } catch (_) {
    /* ignore */
  }
}
