// The direct answer to "how many of each building will I need at minimum": aggregated building
// counts, raw resource intake, and power/pollution totals - de-duplicated across the whole tree.

import type { ProductionTotals } from '../domain/totals';
import type { GameData } from '../domain/types';
import { formatNumber, formatPower, formatRate, titleCase } from './format';
import { createIcon } from './icon';
import { qualityOutlineColor } from './quality';

export interface SummaryPanel {
  el: HTMLDivElement;
  update(totals: ProductionTotals | null, gameData: GameData): void;
}

function row(gameData: GameData, iconId: string, name: string, qualityId: string, value: string, title?: string) {
  const el = document.createElement('div');
  el.className = 'fpt-summary__row';
  const icon = createIcon(gameData, iconId, 24);
  const outline = qualityOutlineColor(qualityId);
  if (outline) {
    icon.style.border = `2px solid ${outline}`;
    icon.style.borderRadius = '4px';
  }
  el.appendChild(icon);
  const label = document.createElement('span');
  label.className = 'fpt-summary__label';
  label.textContent = name;
  const valueEl = document.createElement('span');
  valueEl.className = 'fpt-summary__count';
  valueEl.textContent = value;
  if (title) valueEl.title = title;
  el.append(label, valueEl);
  return el;
}

function appendRateList(
  container: HTMLElement,
  gameData: GameData,
  title: string,
  entries: { itemId: string; ratePerSec: number }[],
  emptyText: string,
): void {
  const heading = document.createElement('h4');
  heading.textContent = title;
  container.appendChild(heading);

  const list = document.createElement('div');
  list.className = 'fpt-summary__list';
  if (entries.length === 0) {
    const none = document.createElement('p');
    none.className = 'fpt-summary__empty';
    none.textContent = emptyText;
    list.appendChild(none);
  }
  for (const entry of entries) {
    const item = gameData.items.get(entry.itemId);
    list.appendChild(
      row(gameData, item?.icon ?? entry.itemId, item?.name ?? titleCase(entry.itemId), 'normal', formatRate(entry.ratePerSec)),
    );
  }
  container.appendChild(list);
}

export function createSummaryPanel(): SummaryPanel {
  const container = document.createElement('div');
  container.className = 'fpt-summary';

  function render(totals: ProductionTotals | null, gameData: GameData): void {
    container.replaceChildren();

    if (!totals) {
      const empty = document.createElement('p');
      empty.className = 'fpt-summary__empty';
      empty.textContent = 'Search for an item to see the production summary.';
      container.appendChild(empty);
      return;
    }

    const overview = document.createElement('div');
    overview.className = 'fpt-summary__overview';
    const power = document.createElement('div');
    power.textContent = `Total power: ${formatPower(totals.totalPowerKw)}`;
    const pollution = document.createElement('div');
    pollution.textContent = `Total pollution: ${formatNumber(totals.totalPollutionPerMinute, 1)}/min`;
    overview.append(power, pollution);
    container.appendChild(overview);

    const machinesHeading = document.createElement('h4');
    machinesHeading.textContent = 'Buildings needed (minimum)';
    container.appendChild(machinesHeading);
    const machinesList = document.createElement('div');
    machinesList.className = 'fpt-summary__list';
    if (totals.machines.length === 0) {
      const none = document.createElement('p');
      none.className = 'fpt-summary__empty';
      none.textContent = 'Nothing to build.';
      machinesList.appendChild(none);
    }
    for (const m of totals.machines) {
      const item = gameData.items.get(m.machineId);
      machinesList.appendChild(
        row(
          gameData,
          item?.icon ?? m.machineId,
          item?.name ?? titleCase(m.machineId),
          m.qualityId,
          `×${m.buildingsNeeded}`,
          `${formatNumber(m.exactCount, 3)} exact`,
        ),
      );
    }
    container.appendChild(machinesList);

    appendRateList(container, gameData, 'Raw resources', totals.rawResources, 'None required.');
    appendRateList(container, gameData, 'Processed resources (total throughput)', totals.processedItems, 'None.');
  }

  return { el: container, update: render };
}
