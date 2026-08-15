"use client";

import type { PrefillData, SavedProgress } from "./types";

/**
 * localStorage persistence helpers. No database, no login for the prototype.
 * All reads/writes are guarded so the app never crashes if storage is
 * unavailable (private mode, SSR, etc.).
 */

const PROGRESS_PREFIX = "govmatch_progress_";
const PREFILL_KEY = "govmatch_prefill"; // read by the Chrome extension

function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

export function loadProgress(opportunityId: string): SavedProgress | null {
  const raw = safeGet(PROGRESS_PREFIX + opportunityId);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SavedProgress;
  } catch {
    return null;
  }
}

export function saveProgress(progress: SavedProgress): void {
  safeSet(PROGRESS_PREFIX + progress.opportunityId, JSON.stringify(progress));
}

/**
 * Save prefillData under the well-known key the Chrome extension reads.
 * The founder copies this JSON into the extension popup.
 */
export function savePrefill(data: PrefillData): void {
  safeSet(PREFILL_KEY, JSON.stringify(data, null, 2));
}

export function loadPrefill(): PrefillData | null {
  const raw = safeGet(PREFILL_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PrefillData;
  } catch {
    return null;
  }
}
