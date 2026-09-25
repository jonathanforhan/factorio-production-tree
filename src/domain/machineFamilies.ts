// The well-known tiered building upgrades players think of as "one family" (assembler 1/2/3,
// furnace tiers, drill tiers) - hardcoded rather than derived from the data, because deriving
// "families" from shared recipe.producers lists over-merges unrelated buildings (e.g. a handful
// of Space Age exception recipes that also accept a foundry or chemical-plant transitively pull
// those into the assembler group via naive connected-components).

import type { GameData } from './types';

export interface MachineFamily {
  id: string;
  label: string;
  machineIds: string[];
}

const CANDIDATE_FAMILIES: MachineFamily[] = [
  {
    id: 'assembler',
    label: 'Assembling machines',
    machineIds: ['assembling-machine-1', 'assembling-machine-2', 'assembling-machine-3'],
  },
  { id: 'furnace', label: 'Furnaces', machineIds: ['stone-furnace', 'steel-furnace', 'electric-furnace'] },
  {
    id: 'drill',
    label: 'Mining drills',
    machineIds: ['burner-mining-drill', 'electric-mining-drill', 'big-mining-drill'],
  },
];

/** Only families whose buildings actually exist in the loaded dataset (defensive against a future
 *  data update renaming or removing one). */
export function getMachineFamilies(gameData: GameData): MachineFamily[] {
  return CANDIDATE_FAMILIES.map((family) => ({
    ...family,
    machineIds: family.machineIds.filter((id) => gameData.items.has(id)),
  })).filter((family) => family.machineIds.length > 1);
}
