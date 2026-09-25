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

  // Only items that can actually be produced by some recipe make sense as a search target.
  const searchableItems: ItemDef[] = [...gameData.items.values()]
    .filter((item) => gameData.recipesByOutput.has(item.id))
    .sort((a, b) => a.name.localeCompare(b.name));

  function renderResults(query: string): void {
    dropdown.replaceChildren();
    const q = query.trim().toLowerCase();
    const results = (q ? searchableItems.filter((i) => i.name.toLowerCase().includes(q)) : searchableItems).slice(
      0,
      40,
    );

    if (results.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'fpt-search__empty';
      empty.textContent = 'No items found';
      dropdown.appendChild(empty);
    } else {
      for (const item of results) {
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'fpt-search__row';
        row.appendChild(createIcon(gameData, item.icon, 28));
        const label = document.createElement('span');
        label.textContent = item.name;
        row.appendChild(label);
        row.addEventListener('click', () => {
          input.value = item.name;
          dropdown.hidden = true;
          onSelect(item.id);
        });
        dropdown.appendChild(row);
      }
    }
    dropdown.hidden = false;
  }

  input.addEventListener('focus', () => renderResults(input.value));
  input.addEventListener('input', () => renderResults(input.value));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      dropdown.hidden = true;
      input.blur();
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
