import { useSyncExternalStore } from "react";

type Listener = () => void;

let navOpen = false;
let browserOffline = false;
let nativeOffline = false;
let offline = false;
let keyboardOpen = false;
let recheckNative: (() => Promise<void>) | null = null;

const navListeners = new Set<Listener>();
const offlineListeners = new Set<Listener>();
const keyboardListeners = new Set<Listener>();

function emit(listeners: Set<Listener>) {
  listeners.forEach((listener) => listener());
}

export function getMobileNavOpen() {
  return navOpen;
}

export function setMobileNavOpen(open: boolean) {
  if (navOpen === open) return;
  navOpen = open;
  emit(navListeners);
}

export function subscribeMobileNav(listener: Listener) {
  navListeners.add(listener);
  return () => navListeners.delete(listener);
}

export function useMobileNavOpen() {
  return useSyncExternalStore(subscribeMobileNav, getMobileNavOpen, () => false);
}

function publishOffline() {
  const next = browserOffline || nativeOffline;
  if (next === offline) return;
  offline = next;
  emit(offlineListeners);
}

export function setBrowserOffline(value: boolean) {
  if (browserOffline === value) return;
  browserOffline = value;
  publishOffline();
}

export function setNativeOffline(value: boolean) {
  if (nativeOffline === value) return;
  nativeOffline = value;
  publishOffline();
}

export function getOffline() {
  return offline;
}

export function subscribeOffline(listener: Listener) {
  offlineListeners.add(listener);
  return () => offlineListeners.delete(listener);
}

export function useOffline() {
  return useSyncExternalStore(subscribeOffline, getOffline, () => false);
}

export function registerNativeConnectivityRecheck(fn: () => Promise<void>) {
  recheckNative = fn;
  return () => {
    if (recheckNative === fn) recheckNative = null;
  };
}

export async function recheckConnectivity() {
  setBrowserOffline(typeof navigator !== "undefined" ? !navigator.onLine : false);
  if (recheckNative) await recheckNative();
}

export function setKeyboardOpen(value: boolean) {
  if (keyboardOpen === value) return;
  keyboardOpen = value;
  emit(keyboardListeners);
}

export function getKeyboardOpen() {
  return keyboardOpen;
}

export function subscribeKeyboard(listener: Listener) {
  keyboardListeners.add(listener);
  return () => keyboardListeners.delete(listener);
}

export function useKeyboardOpen() {
  return useSyncExternalStore(subscribeKeyboard, getKeyboardOpen, () => false);
}
