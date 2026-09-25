// Shareable-link state: the selected item, target rate, and every per-branch override are
// packed into the URL hash so a tree can be shared/bookmarked without any backend.

import type { NodeOverride, OverrideMap } from '../domain/graph';
import type { AppState } from './store';

interface UrlPayload {
  i: string;
  r: number;
  o: [string, NodeOverride][];
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function encodeStateToHash(state: AppState): string {
  if (!state.itemId) return '';
  const payload: UrlPayload = { i: state.itemId, r: state.ratePerSec, o: [...state.overrides.entries()] };
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  return bytesToBase64Url(bytes);
}

export function decodeStateFromHash(
  hash: string,
): { itemId: string; ratePerSec: number; overrides: OverrideMap } | null {
  const raw = hash.replace(/^#/, '');
  if (!raw) return null;
  try {
    const json = new TextDecoder().decode(base64UrlToBytes(raw));
    const payload = JSON.parse(json) as Partial<UrlPayload>;
    if (typeof payload.i !== 'string' || typeof payload.r !== 'number') return null;
    return { itemId: payload.i, ratePerSec: payload.r, overrides: new Map(payload.o ?? []) };
  } catch {
    return null;
  }
}

export function syncStateToUrl(state: AppState): void {
  const hash = encodeStateToHash(state);
  const url = hash ? `#${hash}` : `${window.location.pathname}${window.location.search}`;
  history.replaceState(null, '', url);
}
