// The "editable branch" panel: lets the user change a production step's recipe, machine,
// quality tier, module loadout, and beacons. Rebuilt fresh on every update() call.

import type { NodeOverride, ProductionNode } from '../domain/graph';
import type { GameData } from '../domain/types';
import { formatNumber, formatPercent, formatPower, titleCase } from './format';
import { createIcon } from './icon';

export interface NodeEditorPanel {
  el: HTMLDivElement;
  update(node: ProductionNode | null, gameData: GameData): void;
}

type PatchFn = (path: string, patch: Partial<NodeOverride>) => void;
type ResetFn = (path: string) => void;

function section(title: string): { wrap: HTMLDivElement; body: HTMLDivElement } {
  const wrap = document.createElement('div');
  wrap.className = 'fpt-editor__section';
  const heading = document.createElement('h4');
  heading.textContent = title;
  const body = document.createElement('div');
  body.className = 'fpt-editor__section-body';
  wrap.append(heading, body);
  return { wrap, body };
}

function labeledSelect(labelText: string): { row: HTMLLabelElement; select: HTMLSelectElement } {
  const row = document.createElement('label');
  row.className = 'fpt-editor__row';
  const label = document.createElement('span');
  label.textContent = labelText;
  const select = document.createElement('select');
  row.append(label, select);
  return { row, select };
}

export function createNodeEditorPanel(onPatch: PatchFn, onReset: ResetFn, onClose: () => void): NodeEditorPanel {
  const container = document.createElement('div');
  container.className = 'fpt-editor';

  function render(node: ProductionNode | null, gameData: GameData): void {
    container.replaceChildren();
    container.hidden = false;
    if (!node) {
      const hint = document.createElement('p');
      hint.className = 'fpt-editor__hint';
      hint.textContent =
        'Click any item card or building badge in the tree to change its recipe, machine, quality, modules, and beacons.';
      container.appendChild(hint);
      return;
    }

    const item = gameData.items.get(node.itemId);

    const header = document.createElement('div');
    header.className = 'fpt-editor__header';
    header.appendChild(createIcon(gameData, item?.icon ?? node.itemId, 32));
    const title = document.createElement('h3');
    title.textContent = item?.name ?? titleCase(node.itemId);
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'fpt-editor__close';
    closeBtn.textContent = '✕';
    closeBtn.setAttribute('aria-label', 'Close editor');
    closeBtn.addEventListener('click', onClose);
    header.append(title, closeBtn);
    container.appendChild(header);

    if (node.truncatedCycle) {
      const notice = document.createElement('p');
      notice.className = 'fpt-editor__notice';
      notice.textContent = 'This ingredient loops back to an ancestor in this chain, so the branch stops here.';
      container.appendChild(notice);
      return;
    }

    if (!node.recipe) {
      const notice = document.createElement('p');
      notice.className = 'fpt-editor__notice';
      notice.textContent = 'No known recipe produces this item - treated as a raw input.';
      container.appendChild(notice);
      return;
    }

    const candidateRecipes = gameData.recipesByOutput.get(node.itemId) ?? [];

    // --- Recipe ---
    if (candidateRecipes.length > 1) {
      const { wrap, body } = section('Recipe');
      const { row, select } = labeledSelect('Made via');
      for (const recipe of candidateRecipes) {
        const opt = document.createElement('option');
        opt.value = recipe.id;
        opt.textContent = recipe.name;
        opt.selected = recipe.id === node.recipe.id;
        select.appendChild(opt);
      }
      select.addEventListener('change', () => {
        onPatch(node.path, { recipeId: select.value, machineId: undefined, modules: undefined });
      });
      body.appendChild(row);
      container.appendChild(wrap);
    }

    // --- Machine ---
    if (node.recipe.producers.length > 0) {
      const { wrap, body } = section('Building');
      const { row, select } = labeledSelect('Producer');
      for (const producerId of node.recipe.producers) {
        const producer = gameData.items.get(producerId);
        const opt = document.createElement('option');
        opt.value = producerId;
        opt.textContent = producer?.name ?? titleCase(producerId);
        opt.selected = producerId === node.machineId;
        select.appendChild(opt);
      }
      select.addEventListener('change', () => {
        onPatch(node.path, { machineId: select.value, modules: undefined });
      });
      body.appendChild(row);
      container.appendChild(wrap);
    }

    // --- Quality ---
    {
      const { wrap, body } = section('Quality');
      const group = document.createElement('div');
      group.className = 'fpt-editor__quality-group';
      for (const quality of gameData.qualities) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'fpt-editor__quality-btn';
        btn.classList.toggle('is-active', quality.id === node.qualityId);
        btn.textContent = quality.name;
        btn.addEventListener('click', () => onPatch(node.path, { quality: quality.id }));
        group.appendChild(btn);
      }
      body.appendChild(group);
      container.appendChild(wrap);
    }

    const machine = node.machineId ? gameData.items.get(node.machineId)?.machine : undefined;

    // --- Modules ---
    if (machine) {
      const { wrap, body } = section(machine.moduleSlots > 0 ? `Modules (${machine.moduleSlots} slots)` : 'Modules');
      if (machine.moduleSlots === 0) {
        const notice = document.createElement('p');
        notice.className = 'fpt-editor__notice';
        notice.textContent = `${machine.name} has no module slots. Pick a different building above (e.g. a higher-tier assembler or an electric furnace) to add modules.`;
        body.appendChild(notice);
      } else {
        const moduleItems = [...gameData.items.values()].filter((i) => i.module);
        for (let slot = 0; slot < machine.moduleSlots; slot++) {
          const { row, select } = labeledSelect(`Slot ${slot + 1}`);
          const emptyOpt = document.createElement('option');
          emptyOpt.value = '';
          emptyOpt.textContent = 'Empty';
          select.appendChild(emptyOpt);
          for (const moduleItem of moduleItems) {
            const opt = document.createElement('option');
            opt.value = moduleItem.id;
            opt.textContent = moduleItem.name;
            opt.selected = node.modules[slot] === moduleItem.id;
            select.appendChild(opt);
          }
          select.addEventListener('change', () => {
            const nextModules = [...node.modules];
            nextModules[slot] = select.value || null;
            onPatch(node.path, { modules: nextModules });
          });
          body.appendChild(row);
        }
      }
      container.appendChild(wrap);
    }

    // --- Beacons ---
    {
      const beaconItem = gameData.items.get(gameData.defaultBeaconId);
      if (beaconItem?.beacon) {
        const { wrap, body } = section('Beacons');

        const countRow = document.createElement('label');
        countRow.className = 'fpt-editor__row';
        const countLabel = document.createElement('span');
        countLabel.textContent = `${beaconItem.name} count`;
        const countInput = document.createElement('input');
        countInput.type = 'number';
        countInput.min = '0';
        countInput.max = '24';
        countInput.step = '1';
        countInput.value = String(node.beaconCount);
        countInput.addEventListener('change', () => {
          const count = Math.max(0, Math.round(parseFloat(countInput.value) || 0));
          onPatch(node.path, {
            beaconCount: count,
            beaconId: count > 0 ? gameData.defaultBeaconId : null,
            beaconModuleId: count > 0 ? (node.beaconModuleId ?? 'speed-module') : null,
          });
        });
        countRow.append(countLabel, countInput);
        body.appendChild(countRow);

        const { row: moduleRow, select: moduleSelect } = labeledSelect('Beacon module');
        const moduleItems = [...gameData.items.values()].filter((i) => i.module);
        for (const moduleItem of moduleItems) {
          const opt = document.createElement('option');
          opt.value = moduleItem.id;
          opt.textContent = moduleItem.name;
          opt.selected = moduleItem.id === node.beaconModuleId;
          moduleSelect.appendChild(opt);
        }
        moduleSelect.addEventListener('change', () => {
          onPatch(node.path, { beaconModuleId: moduleSelect.value, beaconId: gameData.defaultBeaconId });
        });
        body.appendChild(moduleRow);

        container.appendChild(wrap);
      }
    }

    // --- Computed stats ---
    {
      const { wrap, body } = section('Effective stats');
      const stats: [string, string][] = [
        ['Speed', formatPercent(node.effects.speed)],
        ['Productivity', formatPercent(node.effects.productivity)],
        ['Consumption', formatPercent(node.effects.consumption)],
        ['Pollution', formatPercent(node.effects.pollution)],
        ['Buildings needed', `${Math.ceil(node.machineCount - 1e-9)} (${formatNumber(node.machineCount, 2)} exact)`],
        ['Power draw', formatPower(node.powerUsageKw)],
      ];
      for (const [label, value] of stats) {
        const row = document.createElement('div');
        row.className = 'fpt-editor__stat-row';
        const l = document.createElement('span');
        l.textContent = label;
        const v = document.createElement('span');
        v.textContent = value;
        row.append(l, v);
        body.appendChild(row);
      }
      container.appendChild(wrap);
    }

    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'fpt-editor__reset';
    resetBtn.textContent = 'Reset this branch to default';
    resetBtn.addEventListener('click', () => onReset(node.path));
    container.appendChild(resetBtn);
  }

  return { el: container, update: render };
}
