import { describe, expect, it } from 'vitest';

import {
  computeEffects,
  effectiveMachineStats,
  effectiveModuleEffects,
  sumBeaconProfile,
} from '../src/domain/calc';
import { loadTestGameData } from './testData';

const gameData = loadTestGameData();

describe('effectiveMachineStats', () => {
  it('replaces (not adds to) base stats at a given quality tier', () => {
    const machine = gameData.items.get('assembling-machine-1')!.machine!;
    expect(machine.speed).toBe(0.5);
    expect(effectiveMachineStats(machine, 'normal').speed).toBe(0.5);
    expect(effectiveMachineStats(machine, 'legendary').speed).toBe(1.25);
  });
});

describe('effectiveModuleEffects', () => {
  it('overrides only the fields present in the quality record, keeping the rest at base', () => {
    const module = gameData.items.get('speed-module')!.module!;
    expect(module.effects.speed).toBe(0.2);
    expect(module.effects.consumption).toBe(0.5);

    const rare = effectiveModuleEffects(module, 'rare');
    expect(rare.speed).toBe(0.32);
    expect(rare.consumption).toBe(0.5); // untouched by the quality record
  });
});

describe('sumBeaconProfile', () => {
  it('sums the diminishing-returns profile for N beacons', () => {
    const beacon = gameData.items.get('beacon')!.beacon!;
    expect(sumBeaconProfile(beacon.profile, 0)).toBe(0);
    expect(sumBeaconProfile(beacon.profile, 1)).toBeCloseTo(1, 5);
    expect(sumBeaconProfile(beacon.profile, 2)).toBeCloseTo(1.7071, 4);
    expect(sumBeaconProfile(beacon.profile, 3)).toBeCloseTo(2.2844, 4);
  });
});

describe('computeEffects', () => {
  it('zeroes out effects the machine/recipe disallows, but keeps the rest', () => {
    const recipe = gameData.recipes.get('automation-science-pack')!;
    const effects = computeEffects(
      {
        recipe,
        machineId: 'assembling-machine-1', // disallows productivity + quality
        qualityId: 'normal',
        modules: ['productivity-module'],
        beaconId: null,
        beaconCount: 0,
        beaconModuleId: null,
      },
      gameData,
    );

    expect(effects.productivity).toBe(0); // disallowed by the machine
    expect(effects.consumption).toBeCloseTo(0.4, 5);
    expect(effects.pollution).toBeCloseTo(0.05, 5);
    expect(effects.speed).toBeCloseTo(-0.05, 5);
  });

  it('applies beacon effectivity, slot count, and the diminishing-returns profile together', () => {
    const recipe = gameData.recipes.get('iron-gear-wheel')!;
    const beacon = gameData.items.get('beacon')!.beacon!;
    const effects = computeEffects(
      {
        recipe,
        machineId: 'assembling-machine-2',
        qualityId: 'normal',
        modules: [],
        beaconId: 'beacon',
        beaconCount: 2,
        beaconModuleId: 'speed-module',
      },
      gameData,
    );

    const expectedSpeed = 0.2 * beacon.effectivity * beacon.moduleSlots * sumBeaconProfile(beacon.profile, 2);
    expect(effects.speed).toBeCloseTo(expectedSpeed, 5);
  });
});
