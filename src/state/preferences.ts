// Persists the global "default building per family" preference across sessions. Separate from
// url.ts (which persists a specific shareable tree) since this is a personal play-style setting.

const STORAGE_KEY = 'fpt:preferredMachines';

export function loadPreferredMachines(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as Record<string, string>;
  } catch {
    return {};
  }
}

export function savePreferredMachines(preferredMachines: Record<string, string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferredMachines));
  } catch {
    // Private browsing / storage disabled / quota exceeded - preference just won't persist.
  }
}
