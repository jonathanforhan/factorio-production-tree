import { ICON_SIZE } from '../domain/loadData';
import type { GameData } from '../domain/types';

export function createIcon(gameData: GameData, id: string, size = 32): HTMLSpanElement {
  const span = document.createElement('span');
  span.className = 'fpt-icon';
  span.style.width = `${size}px`;
  span.style.height = `${size}px`;

  const icon = gameData.icons.get(id);
  if (icon) {
    const scale = size / ICON_SIZE;
    span.style.backgroundImage = `url(${gameData.iconSheetUrl})`;
    span.style.backgroundSize = `${gameData.iconSheetWidth * scale}px ${gameData.iconSheetHeight * scale}px`;
    span.style.backgroundPosition = `-${icon.x * scale}px -${icon.y * scale}px`;
  } else {
    span.classList.add('fpt-icon--missing');
  }
  return span;
}
