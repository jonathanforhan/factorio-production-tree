export interface QuantityInput {
  el: HTMLDivElement;
  setValue(ratePerSec: number): void;
}

export function createQuantityInput(
  initialRatePerSec: number,
  onChange: (ratePerSec: number) => void,
): QuantityInput {
  const container = document.createElement('div');
  container.className = 'fpt-quantity';

  const input = document.createElement('input');
  input.type = 'number';
  input.min = '0';
  input.step = 'any';
  input.className = 'fpt-quantity__input';
  input.setAttribute('aria-label', 'Target production rate');

  const unitToggle = document.createElement('button');
  unitToggle.type = 'button';
  unitToggle.className = 'fpt-quantity__unit';
  unitToggle.title = 'Toggle units';

  let unit: 'sec' | 'min' = 'sec';

  const toDisplay = (ratePerSec: number): number => (unit === 'sec' ? ratePerSec : ratePerSec * 60);
  const currentRatePerSec = (): number => {
    const raw = parseFloat(input.value) || 0;
    return unit === 'sec' ? raw : raw / 60;
  };

  function setValue(ratePerSec: number): void {
    input.value = String(Number(toDisplay(ratePerSec).toFixed(4)));
  }

  function updateUnitLabel(): void {
    unitToggle.textContent = unit === 'sec' ? '/s' : '/min';
  }

  input.addEventListener('input', () => {
    const raw = parseFloat(input.value);
    if (!Number.isFinite(raw) || raw < 0) return;
    onChange(unit === 'sec' ? raw : raw / 60);
  });

  unitToggle.addEventListener('click', () => {
    const ratePerSec = currentRatePerSec();
    unit = unit === 'sec' ? 'min' : 'sec';
    updateUnitLabel();
    setValue(ratePerSec);
  });

  updateUnitLabel();
  setValue(initialRatePerSec);

  container.append(input, unitToggle);
  return { el: container, setValue };
}
