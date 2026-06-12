import { Capacitor } from "@capacitor/core";

export type AppPlatform = "web" | "android";

export function getPlatform(): AppPlatform {
  return Capacitor.isNativePlatform() ? "android" : "web";
}

export const platform = getPlatform();
export const isAndroidPlatform = platform === "android";
export const isNativePlatform = isAndroidPlatform;
