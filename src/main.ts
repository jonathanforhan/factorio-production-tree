import { buildProductionTree, type ProductionNode } from './domain/graph';
import { loadGameData } from './domain/loadData';
import { computeTotals } from './domain/totals';
import { createInitialState, Store, type AppState } from './state/store';
import { loadPreferredMachines, savePreferredMachines } from './state/preferences';
import { decodeStateFromHash, syncStateToUrl } from './state/url';
import { createDefaultBuildingsControl } from './ui/defaultBuildingsControl';
import { createNodeEditorPanel } from './ui/nodeEditorPanel';
import { createQuantityInput } from './ui/quantityInput';
import { createSearchSelect } from './ui/searchSelect';
import { createSummaryPanel } from './ui/summaryPanel';
import { createTreeView } from './ui/treeView';

function findNode(node: ProductionNode, path: string): ProductionNode | null {
  if (node.path === path) return node;
  for (const child of node.children) {
    const found = findNode(child, path);
    if (found) return found;
  }
  return null;
}

async function main(): Promise<void> {
  const app = document.getElementById('app');
  if (!app) throw new Error('Missing #app root element');
  app.replaceChildren();

  const loadingEl = document.createElement('div');
  loadingEl.className = 'fpt-loading';
  loadingEl.textContent = 'Loading Factorio data…';
  app.appendChild(loadingEl);

  const gameData = await loadGameData();
  loadingEl.remove();

  const urlState = decodeStateFromHash(window.location.hash);
  const preferredMachines = loadPreferredMachines();
  const initial: AppState = urlState
    ? {
        itemId: urlState.itemId,
        ratePerSec: urlState.ratePerSec,
        overrides: urlState.overrides,
        selectedPath: null,
        preferredMachines,
      }
    : { ...createInitialState(), preferredMachines };
  const store = new Store(initial);

  // --- layout skeleton ---
  const root = document.createElement('div');
  root.className = 'fpt-app';

  const headerEl = document.createElement('header');
  headerEl.className = 'fpt-header';
  const titleWrap = document.createElement('div');
  titleWrap.className = 'fpt-header__title-wrap';
  const titleEl = document.createElement('h1');
  titleEl.className = 'fpt-header__title';
  titleEl.textContent = 'Factorio Production Tree';
  const versionEl = document.createElement('span');
  versionEl.className = 'fpt-header__version';
  versionEl.textContent = `v${gameData.version}`;
  titleWrap.append(titleEl, versionEl);

  const searchSelect = createSearchSelect(gameData, (itemId) => store.setItem(itemId));
  const quantityInput = createQuantityInput(store.getState().ratePerSec, (rate) => store.setRate(rate));
  const defaultBuildingsControl = createDefaultBuildingsControl(gameData, (familyId, machineId) => {
    store.setPreferredMachine(familyId, machineId);
    savePreferredMachines(store.getState().preferredMachines);
  });
  defaultBuildingsControl.update(initial.preferredMachines);
  const controlsEl = document.createElement('div');
  controlsEl.className = 'fpt-header__controls';
  controlsEl.append(searchSelect.el, quantityInput.el, defaultBuildingsControl.el);
  headerEl.append(titleWrap, controlsEl);

  const mainEl = document.createElement('main');
  mainEl.className = 'fpt-main';

  const treeView = createTreeView((path) => store.setSelectedPath(path));
  treeView.el.classList.add('fpt-main__tree');

  const sidebarEl = document.createElement('aside');
  sidebarEl.className = 'fpt-sidebar';
  const editorPanel = createNodeEditorPanel(
    (path, patch) => store.patchOverride(path, patch),
    (path) => store.clearOverride(path),
    () => store.setSelectedPath(null),
  );
  const summaryPanel = createSummaryPanel();
  sidebarEl.append(editorPanel.el, summaryPanel.el);

  mainEl.append(treeView.el, sidebarEl);
  root.append(headerEl, mainEl);
  app.appendChild(root);

  if (initial.itemId) {
    const item = gameData.items.get(initial.itemId);
    if (item) searchSelect.setValue(item.name);
  }

  let currentRoot: ProductionNode | null = null;

  function recompute(state: AppState): void {
    defaultBuildingsControl.update(state.preferredMachines);

    if (!state.itemId) {
      currentRoot = null;
      treeView.render(null, gameData, null);
      summaryPanel.update(null, gameData);
      editorPanel.update(null, gameData);
      return;
    }

    const preferredMachineIds = Object.values(state.preferredMachines);
    currentRoot = buildProductionTree(state.itemId, state.ratePerSec, gameData, state.overrides, preferredMachineIds);
    const totals = computeTotals(currentRoot);

    treeView.render(currentRoot, gameData, state.selectedPath);
    summaryPanel.update(totals, gameData);
    editorPanel.update(state.selectedPath ? findNode(currentRoot, state.selectedPath) : null, gameData);

    syncStateToUrl(state);
  }

  store.subscribe(recompute);
  recompute(store.getState());

  window.addEventListener('resize', () => {
    const state = store.getState();
    if (state.itemId) treeView.render(currentRoot, gameData, state.selectedPath);
  });
}

main().catch((err: unknown) => {
  console.error(err);
  const app = document.getElementById('app');
  if (!app) return;
  app.replaceChildren();
  const errorEl = document.createElement('div');
  errorEl.className = 'fpt-error';
  errorEl.textContent = 'Failed to load Factorio data. Check the browser console for details.';
  app.appendChild(errorEl);
});
