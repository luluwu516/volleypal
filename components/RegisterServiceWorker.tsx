"use client";

import { useEffect } from "react";

/**
 * Registers /sw.js once the page is interactive. No-op in dev to avoid HMR
 * conflicts. Renders nothing.
 */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    const register = () => {
      navigator.serviceWorker
        .register("/sw.js")
        .catch((err) => console.warn("sw register failed", err));
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);
  return null;
}
