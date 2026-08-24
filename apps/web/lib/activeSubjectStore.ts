"use client";

import { useSyncExternalStore } from "react";

// A page announces which subject it belongs to (or null, if none) via
// SetActiveSubject; the sidebar reads it here. This exists because Next.js
// layouts never receive a child page's params/searchParams directly, and
// several student pages (topic, chapter overview) know their subject only
// from a dynamic route param, not a `?subject=` query string.
type Listener = () => void;

let activeSubjectId: string | null = null;
const listeners = new Set<Listener>();

export function setActiveSubjectId(id: string | null) {
  if (activeSubjectId === id) return;
  activeSubjectId = id;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return activeSubjectId;
}

function getServerSnapshot() {
  return null;
}

export function useActiveSubjectId() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
