import { useSyncExternalStore } from "react";
import { installKind, iosSheet, subscribeInstall } from "@/lib/pwa";

/**
 * "prompt" | "ios" | null — whether (and how) this browser can install the
 * app right now. null on the server and until hydration, so nothing about
 * install is ever in the server HTML.
 */
export function useInstallKind() {
  return useSyncExternalStore(subscribeInstall, installKind, () => null);
}

/** Whether the iOS Add to Home Screen sheet is open. */
export function useIosSheetOpen() {
  return useSyncExternalStore(iosSheet.subscribe, iosSheet.isOpen, () => false);
}
