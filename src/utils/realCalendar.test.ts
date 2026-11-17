import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultScenarios } from '../data/seuCarroData';
import {
  addDaysIso,
  addMonthsToYearMonth,
  buildRealDayFloorPlanSnapshot,
  buildRealMonthProjection,
  getCycleWeekForDate,
  getDayOfWeekForDateIso,
  getWeekDatesAround,
  isProlongedWeekendPartOnDate,
} from './realCalendar';
import { OPTIMIZED_SCENARIO_IDS } from './scenarioProposals';

test('getCycleWeekForDate maps 2026-11-02..2026-11-29 to S1..S4 and repeats cleanly into 2027', () => {
  assert.equal(getDayOfWeekForDateIso('2026-11-14'), 'SAB');
  assert.equal(getCycleWeekForDate('2026-11-02'), 1);
  assert.equal(getCycleWeekForDate('2026-11-14'), 2);
  assert.equal(getCycleWeekForDate('2026-11-16'), 3);
  assert.equal(getCycleWeekForDate('2026-11-28'), 4);
  // 2026-11-30 is Monday right after S4 -> wraps back to S1
  assert.equal(getCycleWeekForDate('2026-11-30'), 1);
  // Month & day arithmetic across year transition
  assert.equal(addDaysIso('2026-12-31', 1), '2027-01-01');
  const feb2027 = addMonthsToYearMonth(2026, 10, 3);
  assert.deepEqual(feb2027, { year: 2027, month0: 1 });
});

test('getWeekDatesAround returns Mon..Sun aligned week around Saturday 2026-11-14', () => {
  const week = getWeekDatesAround('2026-11-14');
  assert.equal(week.length, 7);
  assert.equal(week[0].dateIso, '2026-11-09');
  assert.equal(week[0].dayKey, 'SEG');
  assert.equal(week[5].dateIso, '2026-11-14');
  assert.equal(week[5].dayKey, 'SAB');
  assert.equal(week[6].dateIso, '2026-11-15');
  assert.equal(week[6].dayKey, 'DOM');
});

test('buildRealDayFloorPlanSnapshot populates both stores with zero uncovered sectors on 2026-11-14', () => {
  const scenarios = createDefaultScenarios();
  const prop1 = scenarios.find((s) => s.id === OPTIMIZED_SCENARIO_IDS.TRAD_5050)!;

  const satSnapshot = buildRealDayFloorPlanSnapshot(
    prop1.employees,
    '2026-11-14',
    prop1.storeHours,
    prop1.sectorMinimums
  );
  assert.equal(satSnapshot.cycleWeek, 2);
  assert.equal(satSnapshot.dayKey, 'SAB');
  assert.equal(satSnapshot.totals.uncoveredSectors, 0);
  assert.ok(satSnapshot.roomsByStore.LOJA_1.length === 4);
  assert.ok(satSnapshot.roomsByStore.LOJA_2.length === 3);
  assert.ok(satSnapshot.totals.working >= 8);
  assert.ok(satSnapshot.totals.folga5x2 >= 7);

  // Sunday 2026-11-15 -> DSR
  const sunSnapshot = buildRealDayFloorPlanSnapshot(
    prop1.employees,
    '2026-11-15',
    prop1.storeHours,
    prop1.sectorMinimums
  );
  assert.equal(sunSnapshot.dayKey, 'DOM');
  assert.equal(sunSnapshot.totals.working, 0);
  assert.ok(sunSnapshot.totals.dsr >= 17);
});

test('buildRealMonthProjection detects prolonged weekend transition and full 42-day month grid', () => {
  const scenarios = createDefaultScenarios();
  const prop1 = scenarios.find((s) => s.id === OPTIMIZED_SCENARIO_IDS.TRAD_5050)!;
  const adriane = prop1.employees.find((e) => e.id === 'emp-adriane')!;

  // In Prop 1, Adriane has S1 SAB off + S2 SEG off (2026-11-07 Sáb, 2026-11-08 Dom, 2026-11-09 Seg)
  assert.equal(isProlongedWeekendPartOnDate(adriane, '2026-11-07'), true);
  assert.equal(isProlongedWeekendPartOnDate(adriane, '2026-11-09'), true);

  const nov2026 = buildRealMonthProjection(
    prop1.employees,
    2026,
    10,
    prop1.storeHours,
    prop1.sectorMinimums,
    'emp-adriane'
  );
  assert.equal(nov2026.cells.length, 42);
  assert.equal(nov2026.summary.uncoveredDaysCount, 0);
  assert.ok(nov2026.summary.prolongedWeekendsStarts >= 2);
  assert.ok(nov2026.summary.totalFocusHours > 160);
});
