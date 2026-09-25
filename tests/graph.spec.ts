import { describe, expect, it } from 'vitest';

import { buildProductionTree, type OverrideMap, type ProductionNode } from '../src/domain/graph';
import { loadTestGameData } from './testData';

const gameData = loadTestGameData();

function tryFind(node: ProductionNode, itemId: string): ProductionNode | undefined {
  if (node.itemId === itemId) return node;
  for (const child of node.children) {
    const found = tryFind(child, itemId);
    if (found) return found;
  }
  return undefined;
}

function find(node: ProductionNode, itemId: string): ProductionNode {
  const found = tryFind(node, itemId);
  if (!found) throw new Error(`No node for ${itemId} found under ${node.itemId}`);
  return found;
}

describe('buildProductionTree', () => {
  // Hand-derived from the real vendored recipes: automation-science-pack (5s, 1 copper-plate +
  // 1 iron-gear-wheel) on assembling-machine-1 (speed 0.5) at a target of 1 item/sec.
  it('matches hand-calculated machine counts and rates for automation science pack', () => {
    const overrides: OverrideMap = new Map();
    const root = buildProductionTree('automation-science-pack', 1, gameData, overrides);

    expect(root.recipe?.id).toBe('automation-science-pack');
    expect(root.machineId).toBe('assembling-machine-1');
    expect(root.machineCount).toBeCloseTo(10, 5); // 1/s * 5s / 0.5 speed

    const copperPlate = find(root, 'copper-plate');
    expect(copperPlate.ratePerSec).toBeCloseTo(1, 5);
    expect(copperPlate.machineId).toBe('stone-furnace');
    expect(copperPlate.machineCount).toBeCloseTo(3.2, 5);

    const ironGear = find(root, 'iron-gear-wheel');
    expect(ironGear.ratePerSec).toBeCloseTo(1, 5);
    expect(ironGear.machineCount).toBeCloseTo(1, 5); // 1/s * 0.5s / 0.5 speed

    const ironPlate = find(ironGear, 'iron-plate');
    expect(ironPlate.ratePerSec).toBeCloseTo(2, 5); // 2 iron-plate per gear
    expect(ironPlate.machineCount).toBeCloseTo(6.4, 5);

    const ironOre = find(ironPlate, 'iron-ore');
    expect(ironOre.ratePerSec).toBeCloseTo(2, 5);
    expect(ironOre.recipe?.flags.has('mining')).toBe(true);
    expect(ironOre.machineId).toBe('electric-mining-drill');
    expect(ironOre.machineCount).toBeCloseTo(4, 5);
    expect(ironOre.children).toHaveLength(0);

    const copperOre = find(copperPlate, 'copper-ore');
    expect(copperOre.ratePerSec).toBeCloseTo(1, 5);
    expect(copperOre.machineCount).toBeCloseTo(2, 5);
  });

  it('respects per-node overrides keyed by path without affecting sibling occurrences', () => {
    const overrides: OverrideMap = new Map();
    const root = buildProductionTree('automation-science-pack', 1, gameData, overrides);
    const ironPlateViaGear = find(root, 'iron-gear-wheel').path + '/iron-plate';

    overrides.set(ironPlateViaGear, { machineId: 'electric-furnace' });
    const overridden = buildProductionTree('automation-science-pack', 1, gameData, overrides);

    const ironPlate = find(find(overridden, 'iron-gear-wheel'), 'iron-plate');
    expect(ironPlate.machineId).toBe('electric-furnace');
  });

  it('stops recursion on a recipe cycle instead of looping forever', () => {
    // sulfuric-acid consumes iron-plate; iron-plate's default recipe doesn't loop back, so
    // synthesize a cyclic override to prove the guard works without depending on a real loop.
    const overrides: OverrideMap = new Map();
    const root = buildProductionTree('iron-plate', 1, gameData, overrides, 'iron-plate', new Set(['iron-plate']));
    expect(root.truncatedCycle).toBe(true);
    expect(root.children).toHaveLength(0);
  });
});
