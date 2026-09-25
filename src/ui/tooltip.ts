let tooltipEl: HTMLDivElement | null = null;

function ensureTooltip(): HTMLDivElement {
  if (!tooltipEl) {
    tooltipEl = document.createElement('div');
    tooltipEl.className = 'fpt-tooltip';
    tooltipEl.hidden = true;
    document.body.appendChild(tooltipEl);
  }
  return tooltipEl;
}

function positionTooltip(el: HTMLDivElement, x: number, y: number): void {
  const margin = 14;
  const rect = el.getBoundingClientRect();
  let left = x + margin;
  let top = y + margin;
  if (left + rect.width > window.innerWidth) left = x - rect.width - margin;
  if (top + rect.height > window.innerHeight) top = y - rect.height - margin;
  el.style.left = `${Math.max(4, left)}px`;
  el.style.top = `${Math.max(4, top)}px`;
}

export function showTooltip(content: HTMLElement, x: number, y: number): void {
  const el = ensureTooltip();
  el.replaceChildren(content);
  el.hidden = false;
  positionTooltip(el, x, y);
}

export function hideTooltip(): void {
  if (tooltipEl) tooltipEl.hidden = true;
}

/** Wires hover-tooltip behavior onto an element; `contentFn` is called fresh on every hover. */
export function attachTooltip(el: HTMLElement, contentFn: () => HTMLElement): void {
  el.addEventListener('mouseenter', (e) => showTooltip(contentFn(), e.clientX, e.clientY));
  el.addEventListener('mousemove', (e) => {
    const el2 = ensureTooltip();
    if (!el2.hidden) positionTooltip(el2, e.clientX, e.clientY);
  });
  el.addEventListener('mouseleave', () => hideTooltip());
}

export function tooltipRow(label: string, value: string): HTMLDivElement {
  const row = document.createElement('div');
  row.className = 'fpt-tooltip__row';
  const l = document.createElement('span');
  l.className = 'fpt-tooltip__label';
  l.textContent = label;
  const v = document.createElement('span');
  v.className = 'fpt-tooltip__value';
  v.textContent = value;
  row.append(l, v);
  return row;
}
