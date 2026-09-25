import type { GameData, ItemDef } from '../domain/types';
import { createIcon } from './icon';

export interface SearchSelect {
  el: HTMLDivElement;
  setValue(itemName: string): void;
}

export function createSearchSelect(gameData: GameData, onSelect: (itemId: string) => void): SearchSelect {
  const container = document.createElement('div');
  container.className = 'fpt-search';

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Search for an item… (e.g. Automation science pack)';
  input.className = 'fpt-search__input';
  input.autocomplete = 'off';
  input.spellcheck = false;

  const dropdown = document.createElement('div');
  dropdown.className = 'fpt-search__dropdown';
  dropdown.hidden = true;

  // Only craftable, physical items make sense as a search target: exclude technology/research
  // entries (Factorio's tech tree is modeled as its own "item" per technology, produced by a lab
  // recipe that consumes science packs - e.g. "automation-science-pack-technology" - which would
  // otherwise show up alongside, and confusingly share a display name with, the real item).
  const searchableItems: ItemDef[] = [...gameData.items.values()]
    .filter((item) => gameData.recipesByOutput.has(item.id) && item.category !== 'technology')
    .sort((a, b) => a.name.localeCompare(b.name));

  let currentResults: ItemDef[] = [];
  let rowEls: HTMLButtonElement[] = [];
  let activeIndex = -1;

  function selectItem(item: ItemDef): void {
    input.value = item.name;
    dropdown.hidden = true;
    onSelect(item.id);
  }

  function setActiveIndex(index: number): void {
    if (rowEls.length === 0) {
      activeIndex = -1;
      return;
    }
    activeIndex = Math.max(0, Math.min(index, rowEls.length - 1));
    for (const [i, el] of rowEls.entries()) el.classList.toggle('is-active', i === activeIndex);
    rowEls[activeIndex].scrollIntoView({ block: 'nearest' });
  }

  function renderResults(query: string): void {
    dropdown.replaceChildren();
    rowEls = [];
    const q = query.trim().toLowerCase();
    currentResults = (q ? searchableItems.filter((i) => i.name.toLowerCase().includes(q)) : searchableItems).slice(
      0,
      40,
    );

    if (currentResults.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'fpt-search__empty';
      empty.textContent = 'No items found';
      dropdown.appendChild(empty);
    } else {
      for (const item of currentResults) {
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'fpt-search__row';
        row.appendChild(createIcon(gameData, item.icon, 28));
        const label = document.createElement('span');
        label.textContent = item.name;
        row.appendChild(label);
        row.addEventListener('mouseenter', () => setActiveIndex(rowEls.indexOf(row)));
        row.addEventListener('click', () => selectItem(item));
        dropdown.appendChild(row);
        rowEls.push(row);
      }
    }
    dropdown.hidden = false;
    setActiveIndex(0);
  }

  input.addEventListener('focus', () => renderResults(input.value));
  input.addEventListener('input', () => renderResults(input.value));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      dropdown.hidden = true;
      input.blur();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (dropdown.hidden) renderResults(input.value);
      else setActiveIndex(activeIndex + 1);
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (dropdown.hidden) renderResults(input.value);
      else setActiveIndex(activeIndex - 1);
      return;
    }
    if (e.key === 'Enter') {
      if (!dropdown.hidden && activeIndex >= 0 && currentResults[activeIndex]) {
        e.preventDefault();
        selectItem(currentResults[activeIndex]);
      }
    }
  });
  document.addEventListener('click', (e) => {
    if (!container.contains(e.target as Node)) dropdown.hidden = true;
  });

  container.append(input, dropdown);

  return {
    el: container,
    setValue(itemName: string) {
      input.value = itemName;
    },
  };
}
