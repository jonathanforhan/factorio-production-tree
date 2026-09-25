import { describe, expect, it } from 'vitest';

import { buildProductionTree, type OverrideMap } from '../src/domain/graph';
import { computeTotals } from '../src/domain/totals';
import { loadTestGameData } from './testData';

const gameData = loadTestGameData();

describe('computeTotals', () => {
  // engine-unit (10s; 1 steel-plate + 1 iron-gear-wheel + 2 pipe) is a diamond: both
  // iron-gear-wheel and pipe consume iron-plate, so the tree draws iron-plate (and iron-ore,
  // and their furnaces/drills) as two separate branches. Totals must merge them back into one
  // real number of furnaces/drills instead of double-rounding each occurrence up separately.
  it('merges building counts for an item that appears via multiple branches', () => {
    const overrides: OverrideMap = new Map();
    const root = buildProductionTree('engine-unit', 1, gameData, overrides);
    const totals = computeTotals(root);

    // iron-gear-wheel needs 2 iron-plate/s (via 1 gear/s * 2), pipe needs 2 * 1 iron-plate/s
    // (via 2 pipe/s * 1 iron-plate each) = 4 iron-plate/s combined -> 4 * 3.2s / 1 speed = 12.8
    // stone-furnace-equivalents for iron-plate alone, plus 1 * 3.2/1 = 3.2 for the steel-plate
    // smelting step (steel uses a furnace too), all on the same 'stone-furnace' key.
    const stoneFurnace = totals.machines.find((m) => m.machineId === 'stone-furnace');
    expect(stoneFurnace).toBeDefined();

    // Cross-check against the two branches individually to make sure nothing was dropped or
    // double-counted: sum of exact per-branch furnace counts must equal the merged total.
    function sumMachineExact(node: import('../src/domain/graph').ProductionNode, machineId: string): number {
      let sum = node.machineId === machineId ? node.machineCount : 0;
      for (const child of node.children) sum += sumMachineExact(child, machineId);
      return sum;
    }
    expect(stoneFurnace!.exactCount).toBeCloseTo(sumMachineExact(root, 'stone-furnace'), 6);

    const ironOreTotal = totals.rawResources.find((r) => r.itemId === 'iron-ore');
    expect(ironOreTotal).toBeDefined();
    expect(ironOreTotal!.ratePerSec).toBeGreaterThan(0);

    // Building counts should be integers (rounded up from the exact fractional requirement).
    for (const m of totals.machines) {
      expect(Number.isInteger(m.buildingsNeeded)).toBe(true);
      expect(m.buildingsNeeded).toBeGreaterThanOrEqual(Math.floor(m.exactCount));
    }

    expect(totals.totalPowerKw).toBeGreaterThan(0);
    expect(totals.totalPollutionPerMinute).toBeGreaterThan(0);
  });

  it('rounds a single node up to the next whole building', () => {
    const overrides: OverrideMap = new Map();
    const root = buildProductionTree('automation-science-pack', 1, gameData, overrides);
    const totals = computeTotals(root);

    const assembler = totals.machines.find((m) => m.machineId === 'assembling-machine-1');
    expect(assembler).toBeDefined();
    expect(assembler!.buildingsNeeded).toBe(Math.ceil(assembler!.exactCount));
  });
});
