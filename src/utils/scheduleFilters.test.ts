import test from 'node:test';
import assert from 'node:assert/strict';
import { CHAIRS, createDefaultScenarios } from '../data/seuCarroData';
import { DAYS_OF_WEEK } from './compliance';
import {
  filterSectionChairs,
  getFilteredEmployeeOptions,
  getVisibleDays,
} from './scheduleFilters';

test('getVisibleDays returns all 7 days for ALL and single day when filtered', () => {
  const all = getVisibleDays(DAYS_OF_WEEK, 'ALL');
  assert.equal(all.length, 7);

  const qua = getVisibleDays(DAYS_OF_WEEK, 'QUA');
  assert.equal(qua.length, 1);
  assert.equal(qua[0].key, 'QUA');

  const sab = getVisibleDays(DAYS_OF_WEEK, 'SAB');
  assert.equal(sab.length, 1);
  assert.equal(sab[0].key, 'SAB');
});

test('filterSectionChairs filters by selectedEmployeeId and searchQuery', () => {
  const scenario = createDefaultScenarios()[0];
  const sdrChairs = CHAIRS.filter((c) => c.store === 'LOJA_1' && c.department === 'SDR');

  // Specific employee filter
  const onlyWinona = filterSectionChairs(sdrChairs, scenario.employees, [1, 2, 3, 4], 'emp-winona', '');
  assert.equal(onlyWinona.length, 1);
  assert.equal(onlyWinona[0].id, 'SDR-1');

  // Employee not in this section yields 0 chairs
  const noneInSdr = filterSectionChairs(sdrChairs, scenario.employees, [1, 2, 3, 4], 'emp-jair', '');
  assert.equal(noneInSdr.length, 0);

  // Text query filters cleanly
  const bySearch = filterSectionChairs(sdrChairs, scenario.employees, [1, 2, 3, 4], 'ALL', 'andria');
  assert.equal(bySearch.length, 1);
  assert.equal(bySearch[0].id, 'SDR-2');
});

test('getFilteredEmployeeOptions respects selectedStore and selectedDept and excludes maternity leave', () => {
  const scenario = createDefaultScenarios()[0];

  const allOpts = getFilteredEmployeeOptions(scenario.employees, 'ALL', 'ALL');
  assert.equal(allOpts.some((o) => o.id === 'emp-grazy'), false);
  assert.equal(allOpts.some((o) => o.id === 'emp-winona'), true);
  assert.equal(allOpts.some((o) => o.id === 'emp-joao-pedro'), true);

  const sdrOpts = getFilteredEmployeeOptions(scenario.employees, 'ALL', 'SDR');
  assert.equal(sdrOpts.length, 4);
  assert.ok(sdrOpts.every((o) => o.department === 'SDR'));

  const loja2Opts = getFilteredEmployeeOptions(scenario.employees, 'LOJA_2', 'ALL');
  assert.ok(loja2Opts.length > 0);
  assert.ok(loja2Opts.every((o) => o.store === 'LOJA_2'));
});
