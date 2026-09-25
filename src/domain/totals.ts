// Walks a (possibly-duplicated) production tree and rolls it up into the numbers that actually
// answer "how many of each building will I need, and what does it cost to run" - the tree view
// re-draws an item at every branch it's needed, but the totals here de-duplicate correctly.

import type { ProductionNode } from './graph';

export interface MachineTotal {
  machineId: string;
  qualityId: string;
  exactCount: number;
  buildingsNeeded: number;
}

export interface RawResourceTotal {
  itemId: string;
  ratePerSec: number;
}

export interface ProcessedItemTotal {
  itemId: string;
  ratePerSec: number;
}

export interface ProductionTotals {
  machines: MachineTotal[];
  rawResources: RawResourceTotal[];
  /** Every crafted (non-raw, non-mined) item in the tree, with its combined throughput across
   *  every branch it's needed in - e.g. "iron plate: 10/s" even though the tree draws iron plate
   *  as several separate nodes. */
  processedItems: ProcessedItemTotal[];
  totalPowerKw: number;
  totalPollutionPerMinute: number;
}

export function computeTotals(root: ProductionNode): ProductionTotals {
  const machineMap = new Map<string, MachineTotal>();
  const rawMap = new Map<string, number>();
  const processedMap = new Map<string, number>();
  let totalPowerKw = 0;
  let totalPollutionPerMinute = 0;

  const visit = (node: ProductionNode): void => {
    totalPowerKw += node.powerUsageKw;
    totalPollutionPerMinute += node.pollutionPerMinute;

    if (node.machineId && node.machineCount > 0) {
      const key = `${node.machineId}|${node.qualityId}`;
      const existing = machineMap.get(key);
      if (existing) existing.exactCount += node.machineCount;
      else
        machineMap.set(key, {
          machineId: node.machineId,
          qualityId: node.qualityId,
          exactCount: node.machineCount,
          buildingsNeeded: 0,
        });
    }

    const isMined = node.recipe?.flags.has('mining') ?? false;
    if (node.isRaw || isMined) {
      rawMap.set(node.itemId, (rawMap.get(node.itemId) ?? 0) + node.ratePerSec);
    } else if (node.recipe) {
      processedMap.set(node.itemId, (processedMap.get(node.itemId) ?? 0) + node.ratePerSec);
    }

    for (const child of node.children) visit(child);
  };

  visit(root);

  const machines = [...machineMap.values()]
    .map((m) => ({ ...m, buildingsNeeded: Math.ceil(m.exactCount - 1e-9) }))
    .sort((a, b) => b.exactCount - a.exactCount);

  const rawResources = [...rawMap.entries()]
    .map(([itemId, ratePerSec]) => ({ itemId, ratePerSec }))
    .sort((a, b) => b.ratePerSec - a.ratePerSec);

  const processedItems = [...processedMap.entries()]
    .map(([itemId, ratePerSec]) => ({ itemId, ratePerSec }))
    .sort((a, b) => b.ratePerSec - a.ratePerSec);

  return { machines, rawResources, processedItems, totalPowerKw, totalPollutionPerMinute };
}
