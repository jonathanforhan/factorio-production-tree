// Minimal transient notification, used for copy/paste feedback (there's otherwise no visible
// response to a modifier-click gesture, which would make success/failure indistinguishable).

let toastEl: HTMLDivElement | null = null;
let hideTimer: ReturnType<typeof setTimeout> | null = null;

function ensureToast(): HTMLDivElement {
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.className = 'fpt-toast';
    toastEl.hidden = true;
    document.body.appendChild(toastEl);
  }
  return toastEl;
}

export function showToast(message: string, kind: 'info' | 'error' = 'info'): void {
  const el = ensureToast();
  el.textContent = message;
  el.classList.toggle('fpt-toast--error', kind === 'error');
  el.hidden = false;
  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    el.hidden = true;
  }, 2600);
}
