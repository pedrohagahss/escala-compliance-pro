import test from 'node:test';
import assert from 'node:assert';
import { createBaseEmployees, createDefaultScenarios } from '../data/seuCarroData';
import type { DayOfWeek } from '../types/schedule';
import {
  calculateSectorDailyCoverage,
  autoAssignCirculatingCoverage,
  calculateWeeklyCoverageSummary,
} from './coverage';
import {
  calculateEmployeeMonthlySummary,
  ensureEmployeeWeeksSchedule,
  updateEmployeeShiftAcrossWeeks,
  setEmployeeMonthlySaturdayOff,
} from './compliance';

test('calculateSectorDailyCoverage flags uncovered sector when below minimum headcount', () => {
  const baseEmployees = createBaseEmployees();

  // Força folga para todos os SDRs na Segunda-feira
  const testTeam = baseEmployees.map((emp) => {
    if (emp.department === 'SDR') {
      return {
        ...emp,
        schedule: {
          ...emp.schedule,
          SEG: { day: 'SEG' as const, type: 'FOLGA_5X2' as const, chairId: emp.defaultChairId },
        },
      };
    }
    return emp;
  });

  const dailyCoverage = calculateSectorDailyCoverage(testTeam, 'SEG');
  const sdrSector = dailyCoverage.find((s) => s.sector.departmentId === 'SDR');

  assert.ok(sdrSector, 'SDR sector exists');
  assert.strictEqual(sdrSector.activeHeadcount, 0, 'Zero active SDRs');
  assert.strictEqual(sdrSector.isUncovered, true, 'Sector is marked as uncovered');
  assert.strictEqual(sdrSector.status, 'CRITICO', 'Status is CRITICO due to 0 active staff');
});

test('autoAssignCirculatingCoverage assigns Edvania / Lorena to uncovered SDR sector', () => {
  const baseEmployees = createBaseEmployees();

  // Força folga para todos os SDRs na Segunda-feira
  const testTeam = baseEmployees.map((emp) => {
    if (emp.department === 'SDR') {
      return {
        ...emp,
        schedule: {
          ...emp.schedule,
          SEG: { day: 'SEG' as const, type: 'FOLGA_5X2' as const, chairId: emp.defaultChairId },
        },
      };
    }
    return emp;
  });

  const coveredTeam = autoAssignCirculatingCoverage(testTeam, 'SEG');
  const dailyCoverageAfter = calculateSectorDailyCoverage(coveredTeam, 'SEG');
  const sdrSectorAfter = dailyCoverageAfter.find((s) => s.sector.departmentId === 'SDR');

  assert.ok(sdrSectorAfter, 'SDR sector exists');
  assert.strictEqual(sdrSectorAfter.coveredHeadcount > 0, true, 'Has covered headcounts');
  assert.strictEqual(sdrSectorAfter.effectiveHeadcount >= sdrSectorAfter.minRequired, true, 'Effective headcount meets minimum');
  assert.strictEqual(sdrSectorAfter.isUncovered, false, 'Sector is no longer uncovered');
});

test('weekly shift changes immediately update monthly planner summaries in real-time', () => {
  const baseEmployees = createBaseEmployees();
  let emp = ensureEmployeeWeeksSchedule(baseEmployees[0]); // Winona (SDR)

  const initialSummary = calculateEmployeeMonthlySummary(emp, 'FASE_1');
  assert.strictEqual(initialSummary.weeklyHours.length, 4, 'Has 4 weeks');

  // Gestor altera a escala da Semana 2: concede folga na Quinta-feira (8h a menos)
  emp = updateEmployeeShiftAcrossWeeks(emp, 2, 'QUI', {
    type: 'FOLGA_5X2',
    label: 'Folga Extra Concedida',
  });

  const updatedSummary = calculateEmployeeMonthlySummary(emp, 'FASE_1');

  // A semana 2 deve ter 8h a menos que a semana 1
  assert.strictEqual(
    updatedSummary.weeklyHours[1],
    initialSummary.weeklyHours[1] - 8,
    'Week 2 hours reflect the weekly grid shift modification directly'
  );

  // A média mensal deve ter sido recalculada instantaneamente
  assert.strictEqual(
    updatedSummary.totalMonthlyHours,
    initialSummary.totalMonthlyHours - 8,
    'Total monthly hours decreased by exactly 8 hours'
  );
});

test('setEmployeeMonthlySaturdayOff dynamically synchronizes all 4 weeks of the employee schedule', () => {
  const baseEmployees = createBaseEmployees();
  let emp = ensureEmployeeWeeksSchedule(baseEmployees[0]);

  // Altera o sábado de folga mensal para a Semana 3
  emp = setEmployeeMonthlySaturdayOff(emp, 3);

  assert.strictEqual(emp.saturdayOffWeek, 3, 'Saturday off is now week 3');
  assert.strictEqual(emp.weeksSchedule![3].SAB.type, 'FOLGA_5X2', 'Week 3 Saturday is off');
  assert.strictEqual(emp.weeksSchedule![1].SAB.type, 'TRABALHO', 'Week 1 Saturday is worked');
  assert.strictEqual(emp.weeksSchedule![2].SAB.type, 'TRABALHO', 'Week 2 Saturday is worked');
  assert.strictEqual(emp.weeksSchedule![4].SAB.type, 'TRABALHO', 'Week 4 Saturday is worked');
});

test('same-function peers cover a single colleague on Folga (SDRs and Vendedores rodízio)', () => {
  const baseEmployees = createBaseEmployees().map((e) => ensureEmployeeWeeksSchedule(e));
  // Pega semana 2 em que Winona folga na Terça, enquanto outros SDRs trabalham
  const week2Employees = baseEmployees.map((e) => ({
    ...e,
    schedule: e.weeksSchedule![2],
  }));

  const tueCoverage = calculateSectorDailyCoverage(week2Employees, 'TER');
  const sdrTue = tueCoverage.find((s) => s.sector.id === 'L1-SDR');
  assert.ok(sdrTue, 'L1-SDR coverage found');
  assert.strictEqual(sdrTue.isUncovered, false, 'SDR sector is covered by active colleagues on Tuesday');
  assert.strictEqual(sdrTue.status, 'SEGURO', 'SDR status is SEGURO');

  // Filial sem vendedor externo por decisão da gerência: o setor não exige mínimo e não gera alarme
  const monCoverage = calculateSectorDailyCoverage(week2Employees, 'SEG');
  const l2Vendas = monCoverage.find((s) => s.sector.id === 'L2-VENDAS-EXT');
  assert.ok(l2Vendas, 'L2-VENDAS-EXT found');
  assert.strictEqual(l2Vendas.isUncovered, false, 'L2-VENDAS-EXT sem mínimo não fica descoberto');
});

test('cross-skill coverage: Marielly covers L2-FIN on Mon-Thu when active, blocked on SEX, and CRITICO if both are off', () => {
  const baseEmployees = createBaseEmployees().map((e) => ensureEmployeeWeeksSchedule(e));
  // Coloca João Pedro de folga na Segunda e Marielly trabalhando na Segunda
  const monTeam = baseEmployees.map((e) => {
    const sched = { ...e.weeksSchedule![2] };
    if (e.id === 'emp-joao-pedro') {
      sched.SEG = { day: 'SEG', type: 'FOLGA_5X2', chairId: e.defaultChairId };
    }
    if (e.id === 'emp-marielly') {
      sched.SEG = { day: 'SEG', type: 'TRABALHO', chairId: e.defaultChairId, startTime: '08:00', endTime: '17:30' };
    }
    return { ...e, schedule: sched };
  });

  const monCov = calculateSectorDailyCoverage(monTeam, 'SEG');
  const finMon = monCov.find((s) => s.sector.id === 'L2-FIN');
  assert.ok(finMon, 'L2-FIN found');
  assert.strictEqual(finMon.isUncovered, false, 'L2-FIN is covered on Monday by Marielly skill');
  assert.strictEqual(
    finMon.autoCoveredByPeersOrSkills.some((c) => c.employeeName === 'Marielly'),
    true,
    'Marielly is listed as cross-skill backup'
  );

  // Se BOTH João Pedro AND Marielly folgarem na Segunda, L2-FIN fica CRITICO
  const monBothOff = monTeam.map((e) =>
    e.id === 'emp-marielly'
      ? { ...e, schedule: { ...e.schedule, SEG: { day: 'SEG' as const, type: 'FOLGA_5X2' as const, chairId: e.defaultChairId } } }
      : e
  );
  const monBothCov = calculateSectorDailyCoverage(monBothOff, 'SEG');
  const finMonCrit = monBothCov.find((s) => s.sector.id === 'L2-FIN');
  assert.strictEqual(finMonCrit?.isUncovered, true, 'L2-FIN becomes uncovered when Marielly is also off');
  assert.strictEqual(finMonCrit?.status, 'CRITICO', 'L2-FIN becomes CRITICO');

  // Sexta-feira é dia crítico de pagamento: Marielly não libera automaticamente L2-FIN
  const friTeam = baseEmployees.map((e) => {
    const sched = { ...e.weeksSchedule![2] };
    if (e.id === 'emp-joao-pedro') {
      sched.SEX = { day: 'SEX', type: 'FOLGA_5X2', chairId: e.defaultChairId };
    }
    if (e.id === 'emp-marielly') {
      sched.SEX = { day: 'SEX', type: 'TRABALHO', chairId: e.defaultChairId, startTime: '08:00', endTime: '17:30' };
    }
    return { ...e, schedule: sched };
  });
  const friCov = calculateSectorDailyCoverage(friTeam, 'SEX');
  const finFri = friCov.find((s) => s.sector.id === 'L2-FIN');
  assert.strictEqual(finFri?.isUncovered, true, 'Friday critical payment day still flags deficit if João Pedro is off');
});

test('default staggered scenario S1-S4 has zero false uncovered critical or alert sectors', () => {
  const defaultScen = createDefaultScenarios()[0];
  const activeDays: DayOfWeek[] = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'];

  [1, 2, 3, 4].forEach((weekNum) => {
    const weekEmployees = defaultScen.employees.map((e) => ({
      ...e,
      schedule: ensureEmployeeWeeksSchedule(e).weeksSchedule![weekNum],
    }));
    const summary = calculateWeeklyCoverageSummary(weekEmployees);
    assert.strictEqual(
      summary.totalCriticalUncovered,
      0,
      `Week ${weekNum} should have 0 critical uncovered sectors by default`
    );
    assert.strictEqual(
      summary.totalAlertUncovered,
      0,
      `Week ${weekNum} should have 0 alert uncovered sectors by default`
    );
    activeDays.forEach((d) => {
      const uncovered = summary.byDay[d].filter((r) => r.isUncovered);
      assert.strictEqual(
        uncovered.length,
        0,
        `Week ${weekNum} ${d} should have no uncovered sectors (found: ${uncovered.map((u) => u.sector.id).join(', ')})`
      );
    });
  });
});

test('custom sectorMinimums allow 1-of-4 employee sector to be marked covered (manageable load)', () => {
  const baseEmployees = createBaseEmployees();
  // Coloca 3 dos 4 SDRs de folga na Segunda-feira (apenas 1 SDR ativo de 4 cadeiras)
  let sdrOffCount = 0;
  const oneOfFourTeam = baseEmployees.map((emp) => {
    if (emp.department === 'SDR' && sdrOffCount < 3) {
      sdrOffCount++;
      return {
        ...emp,
        schedule: {
          ...emp.schedule,
          SEG: { day: 'SEG' as const, type: 'FOLGA_5X2' as const, chairId: emp.defaultChairId },
        },
      };
    }
    return emp;
  });

  // Com mínimo padrão (2), 1 de 4 fica descoberto (ALERTA)
  const defaultCov = calculateSectorDailyCoverage(oneOfFourTeam, 'SEG');
  const sdrDefault = defaultCov.find((s) => s.sector.id === 'L1-SDR');
  assert.ok(sdrDefault);
  assert.strictEqual(sdrDefault.activeHeadcount, 1);
  assert.strictEqual(sdrDefault.minRequired, 2);
  assert.strictEqual(sdrDefault.isUncovered, true);
  assert.strictEqual(sdrDefault.status, 'ALERTA');

  // Quando o usuário define o efetivo mínimo do setor L1-SDR para 1, o setor passa a ser COBERTO
  const customCov = calculateSectorDailyCoverage(oneOfFourTeam, 'SEG', {
    'L1-SDR': { weekday: 1, saturday: 1 },
  });
  const sdrCustom = customCov.find((s) => s.sector.id === 'L1-SDR');
  assert.ok(sdrCustom);
  assert.strictEqual(sdrCustom.activeHeadcount, 1);
  assert.strictEqual(sdrCustom.minRequired, 1);
  assert.strictEqual(sdrCustom.isUncovered, false);
  assert.strictEqual(sdrCustom.status, 'SEGURO');
  assert.strictEqual(sdrCustom.isSinglePersonManageableLoad, true);
});

test('autoAssignCirculatingCoverage respects custom sectorMinimums', () => {
  const baseEmployees = createBaseEmployees();
  let sdrOffCount = 0;
  const oneOfFourTeam = baseEmployees.map((emp) => {
    if (emp.department === 'SDR' && sdrOffCount < 3) {
      sdrOffCount++;
      return {
        ...emp,
        schedule: {
          ...emp.schedule,
          TER: { day: 'TER' as const, type: 'FOLGA_5X2' as const, chairId: emp.defaultChairId },
        },
      };
    }
    return emp;
  });

  // Com mínimo = 1, autoAssignCirculatingCoverage NÃO aloca cobertura extra pois 1 ativo já cobre
  const autoMin1 = autoAssignCirculatingCoverage(oneOfFourTeam, 'TER', {
    'L1-SDR': { weekday: 1, saturday: 1 },
  });
  const covMin1 = calculateSectorDailyCoverage(autoMin1, 'TER', {
    'L1-SDR': { weekday: 1, saturday: 1 },
  }).find((s) => s.sector.id === 'L1-SDR');
  assert.strictEqual(covMin1?.coveredHeadcount, 0);
  assert.strictEqual(covMin1?.isUncovered, false);

  // Com mínimo elevado para 3, autoAssignCirculatingCoverage cobre o déficit de 2 postos
  const autoMin3 = autoAssignCirculatingCoverage(oneOfFourTeam, 'TER', {
    'L1-SDR': { weekday: 3, saturday: 2 },
  });
  const covMin3 = calculateSectorDailyCoverage(autoMin3, 'TER', {
    'L1-SDR': { weekday: 3, saturday: 2 },
  }).find((s) => s.sector.id === 'L1-SDR');
  assert.strictEqual(covMin3?.effectiveHeadcount, 3);
  assert.strictEqual(covMin3?.isUncovered, false);
});


