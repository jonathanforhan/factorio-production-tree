// Top-bar control: lets the user pick a preferred tier for each "family" of upgradeable building
// (assemblers, furnaces, mining drills) once, instead of re-picking it on every branch of every
// tree. Applies only where a node has no explicit per-branch override.

import { getMachineFamilies } from '../domain/machineFamilies';
import type { GameData } from '../domain/types';

export interface DefaultBuildingsControl {
  el: HTMLDivElement;
  update(preferredMachines: Record<string, string>): void;
}

export function createDefaultBuildingsControl(
  gameData: GameData,
  onChange: (familyId: string, machineId: string | null) => void,
): DefaultBuildingsControl {
  const families = getMachineFamilies(gameData);

  const container = document.createElement('div');
  container.className = 'fpt-default-buildings';

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'fpt-default-buildings__toggle';
  toggle.textContent = 'Default buildings';

  const popover = document.createElement('div');
  popover.className = 'fpt-default-buildings__popover';
  popover.hidden = true;

  const selects = new Map<string, HTMLSelectElement>();

  for (const family of families) {
    const row = document.createElement('label');
    row.className = 'fpt-default-buildings__row';
    const label = document.createElement('span');
    label.textContent = family.label;
    const select = document.createElement('select');

    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = 'Game default';
    select.appendChild(defaultOpt);

    for (const machineId of family.machineIds) {
      const item = gameData.items.get(machineId);
      const opt = document.createElement('option');
      opt.value = machineId;
      opt.textContent = item?.name ?? machineId;
      select.appendChild(opt);
    }

    select.addEventListener('change', () => onChange(family.id, select.value || null));
    row.append(label, select);
    popover.appendChild(row);
    selects.set(family.id, select);
  }

  if (families.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'fpt-default-buildings__empty';
    empty.textContent = 'No tiered buildings found in this dataset.';
    popover.appendChild(empty);
  }

  toggle.addEventListener('click', () => {
    popover.hidden = !popover.hidden;
  });
  document.addEventListener('click', (e) => {
    if (!container.contains(e.target as Node)) popover.hidden = true;
  });

  container.append(toggle, popover);

  return {
    el: container,
    update(preferredMachines) {
      for (const [familyId, select] of selects) select.value = preferredMachines[familyId] ?? '';
    },
  };
}
