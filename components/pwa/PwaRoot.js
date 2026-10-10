"use client";

import { useEffect } from "react";
import { iosSheet, registerServiceWorker } from "@/lib/pwa";
import { useIosSheetOpen } from "@/lib/useInstall";
import IosInstallSheet from "./IosInstallSheet";

/**
 * Mounted once by app/layout.js: registers the service worker, and renders
 * the iOS Add to Home Screen sheet at the top level (so the sidebar drawer's
 * transform can't trap it) whenever an Install button opens it.
 */
export default function PwaRoot() {
  const sheetOpen = useIosSheetOpen();

  useEffect(() => {
    registerServiceWorker();
  }, []);

  return sheetOpen ? <IosInstallSheet onClose={iosSheet.close} /> : null;
}
