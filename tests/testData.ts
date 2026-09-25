import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseGameData, type RawData } from '../src/domain/loadData';
import type { GameData } from '../src/domain/types';

const DATA_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'public',
  'data',
  'factorio-spa',
  'data.json',
);

let cached: GameData | undefined;

export function loadTestGameData(): GameData {
  if (!cached) {
    const raw = JSON.parse(readFileSync(DATA_PATH, 'utf-8')) as RawData;
    cached = parseGameData(raw);
  }
  return cached;
}
