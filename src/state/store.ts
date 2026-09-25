// Minimal observable store - no external state library. The whole app re-derives its tree from
// this state on every change, which is cheap enough for trees of this size.

import type { NodeOverride, OverrideMap } from '../domain/graph';

export interface AppState {
  itemId: string | null;
  ratePerSec: number;
  overrides: OverrideMap;
  /** Path of the branch currently open in the editor panel; not persisted to the URL. */
  selectedPath: string | null;
}

export function createInitialState(): AppState {
  return {
    itemId: null,
    ratePerSec: 1,
    overrides: new Map(),
    selectedPath: null,
  };
}

type Listener = (state: AppState) => void;

export class Store {
  private state: AppState;
  private listeners = new Set<Listener>();

  constructor(initial: AppState) {
    this.state = initial;
  }

  getState(): AppState {
    return this.state;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    for (const listener of this.listeners) listener(this.state);
  }

  setItem(itemId: string | null): void {
    this.state = { ...this.state, itemId, overrides: new Map(), selectedPath: null };
    this.emit();
  }

  setRate(ratePerSec: number): void {
    this.state = { ...this.state, ratePerSec };
    this.emit();
  }

  setSelectedPath(path: string | null): void {
    this.state = { ...this.state, selectedPath: path };
    this.emit();
  }

  setOverride(path: string, override: NodeOverride): void {
    const overrides = new Map(this.state.overrides);
    overrides.set(path, override);
    this.state = { ...this.state, overrides };
    this.emit();
  }

  patchOverride(path: string, patch: Partial<NodeOverride>): void {
    const overrides = new Map(this.state.overrides);
    overrides.set(path, { ...overrides.get(path), ...patch });
    this.state = { ...this.state, overrides };
    this.emit();
  }

  clearOverride(path: string): void {
    if (!this.state.overrides.has(path)) return;
    const overrides = new Map(this.state.overrides);
    overrides.delete(path);
    this.state = { ...this.state, overrides };
    this.emit();
  }

  replaceState(next: AppState): void {
    this.state = next;
    this.emit();
  }
}
