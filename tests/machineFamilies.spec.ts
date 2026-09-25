import { describe, expect, it } from 'vitest';

import { getMachineFamilies } from '../src/domain/machineFamilies';
import { loadTestGameData } from './testData';

const gameData = loadTestGameData();

describe('getMachineFamilies', () => {
  it('finds the well-known tiered building families with all their real machine ids', () => {
    const families = getMachineFamilies(gameData);
    const byId = new Map(families.map((f) => [f.id, f]));

    expect(byId.get('assembler')?.machineIds).toEqual([
      'assembling-machine-1',
      'assembling-machine-2',
      'assembling-machine-3',
    ]);
    expect(byId.get('furnace')?.machineIds).toEqual(['stone-furnace', 'steel-furnace', 'electric-furnace']);
    expect(byId.get('drill')?.machineIds).toEqual([
      'burner-mining-drill',
      'electric-mining-drill',
      'big-mining-drill',
    ]);
  });
});
