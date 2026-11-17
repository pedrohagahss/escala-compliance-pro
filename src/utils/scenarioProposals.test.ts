import test from 'node:test';
import assert from 'node:assert/strict';
import { createBaseEmployees, createDefaultScenarios } from '../data/seuCarroData';
import {
  analyzeScenarioMetrics,
  createOptimizedScenarios,
  OPTIMIZED_SCENARIO_IDS,
} from './scenarioProposals';
import {
  calculateDailyHours,
  calculateWeeklyHours,
  checkMonthlyTeamOperationalAndAffinities,
  ensureEmployeeWeeksSchedule,
  parseTimeToMinutes,
} from './compliance';

test('all 4 optimized scenarios respect <= 8h24/day cap, <= 42h/week, 0 errors, and 0 uncovered sectors S1-S4', () => {
  const baseTeam = createBaseEmployees();
  const proposals = createOptimizedScenarios(baseTeam);

  assert.equal(proposals.length, 4);

  proposals.forEach((scen) => {
    const metrics = analyzeScenarioMetrics(scen);

    assert.equal(
      metrics.within8h24Cap,
      true,
      `${scen.id}: maxDailyMinutes=${metrics.maxDailyMinutesObserved} exceeded 504 (8h24)`
    );
    assert.ok(
      metrics.maxDailyHoursObserved <= 8.4,
      `${scen.id}: maxDailyHours=${metrics.maxDailyHoursObserved} > 8.4`
    );
    assert.equal(
      metrics.complianceErrorCount,
      0,
      `${scen.id}: expected 0 compliance errors, found ${metrics.complianceErrorCount}`
    );
    assert.equal(
      metrics.uncoveredSectorsTotal,
      0,
      `${scen.id}: expected 0 uncovered sectors across S1-S4, found ${metrics.uncoveredSectorsTotal}`
    );

    const alerts = checkMonthlyTeamOperationalAndAffinities(
      scen.employees.map(ensureEmployeeWeeksSchedule),
      scen.storeHours
    );
    const hardAlerts = alerts.filter((a) => a.severity === 'ERROR' || a.severity === 'WARNING');
    assert.equal(
      hardAlerts.length,
      0,
      `${scen.id}: unexpected operational/affinity alerts: ${hardAlerts.map((a) => `${a.code}: ${a.message}`).join(' | ')}`
    );

    // Garante pelo menos 10 FDS prolongados (Sáb -> Dom -> Seg) por ciclo
    assert.ok(
      metrics.prolongedWeekendsCount >= 10,
      `${scen.id}: expected >=10 prolonged weekends in 4-week cycle, found ${metrics.prolongedWeekendsCount}`
    );

    // Preserva integralmente Matheus (24h, nunca antes de 12:30 dia útil)
    const matheus = scen.employees.find((e) => e.id === 'emp-matheus')!;
    for (let w = 1; w <= 4; w++) {
      const ws = matheus.weeksSchedule![w];
      assert.equal(calculateWeeklyHours(ws), 24, `${scen.id} S${w} Matheus must remain 24h`);
      (['SEG', 'TER', 'QUA', 'QUI', 'SEX'] as const).forEach((d) => {
        if (ws[d].type === 'TRABALHO' && ws[d].startTime) {
          assert.ok(parseTimeToMinutes(ws[d].startTime) >= 750, 'Matheus weekday >= 12:30');
        }
      });
    }

    // Preserva Andria ativa em TODAS as Segundas e João Pedro em TODAS as Sextas
    const andria = scen.employees.find((e) => e.id === 'emp-andria')!;
    const jp = scen.employees.find((e) => e.id === 'emp-joao-pedro')!;
    for (let w = 1; w <= 4; w++) {
      assert.equal(andria.weeksSchedule![w].SEG.type, 'TRABALHO', `${scen.id} Andria must work SEG S${w}`);
      assert.equal(jp.weeksSchedule![w].SEX.type, 'TRABALHO', `${scen.id} João Pedro must work SEX S${w}`);
      assert.equal(calculateWeeklyHours(jp.weeksSchedule![w]), 42, `${scen.id} João Pedro hits 42h S${w}`);
    }

    // Preparação: garante alguém cobrindo abertura e fechamento da loja Seg–Sex
    const isCenB = scen.id.includes('-b-est-');
    const expectedClose = isCenB ? '18:00' : '17:30';
    const prepStaff = scen.employees.filter((e) => e.department === 'PREPARACAO');
    for (let w = 1; w <= 4; w++) {
      (['SEG', 'TER', 'QUA', 'QUI', 'SEX'] as const).forEach((d) => {
        const activePrep = prepStaff
          .map((p) => p.weeksSchedule![w][d])
          .filter((s) => s.type === 'TRABALHO');
        assert.ok(activePrep.some((s) => s.startTime === '08:00'), `${scen.id} S${w} ${d}: Prep covers opening 08:00`);
        assert.ok(activePrep.some((s) => s.endTime === expectedClose), `${scen.id} S${w} ${d}: Prep covers close ${expectedClose}`);
        activePrep.forEach((s) => {
          assert.ok(calculateDailyHours(s) <= 8.4, `${scen.id} S${w} ${d}: Prep daily hours <= 8.4`);
        });
      });
    }
  });
});

test('createDefaultScenarios preserves legacy scen-a at index 0 and exposes all 4 optimized proposals', () => {
  const all = createDefaultScenarios();
  assert.equal(all[0].id, 'scen-a');
  const ids = all.map((s) => s.id);
  Object.values(OPTIMIZED_SCENARIO_IDS).forEach((id) => {
    assert.ok(ids.includes(id), `Missing optimized scenario id ${id}`);
  });
});
