import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateDailyHours,
  calculateWeeklyHours,
  calculateInterjornadaRest,
  validateEmployeeCompliance,
  checkTeamOperationalAndAffinities,
  calculateStoreCoverage,
  suggest5x2Redistribution,
  createTraditional6x1Schedule,
  formatHoursDecimal,
  parseTimeToMinutes,
  balanceEmployeeHours,
  applyGroupSchedule,
  applyGroupBreakInterval,
  ensureEmployeeWeeksSchedule,
  updateEmployeeShiftAcrossWeeks,
  replaceEmployeeWeekSchedule,
  calculateEmployeeMonthlySummary,
  balanceActiveWeekForMonthlyTarget,
  balanceAllWeeksToMonthlyTarget,
  checkMonthlyTeamOperationalAndAffinities,
  canReplaceRestDayWithWork,
  countRestDaysInWeek,
  moveOrApplyFolgaInWeek,
  updateEmployeeLunchHours,
  applyStoreOperatingHours,
  buildDefaultWorkShiftForDay,
  linkEmployeesForSameFolga,
  linkEmployeesForNoParallelFolga,
  moveOrApplyFolgaAcrossWeeks,
  propagateLinkedFolgas,
  unlinkEmployeeFolga,
  unlinkEmployeeNoParallelFolga,
  checkParallelFolgaConflict,
  DEFAULT_STORE_HOURS,
} from './compliance';
import { Employee, DayShift, StoreHoursMap } from '../types/schedule';
import { createBaseEmployees, createDefaultScenarios } from '../data/seuCarroData';

test('parseTimeToMinutes converts HH:MM properly', () => {
  assert.equal(parseTimeToMinutes('08:00'), 480);
  assert.equal(parseTimeToMinutes('17:30'), 1050);
  assert.equal(parseTimeToMinutes('13:00'), 780);
  assert.equal(parseTimeToMinutes('00:00'), 0);
  assert.equal(parseTimeToMinutes(''), 0);
});

test('calculateDailyHours deducts exact lunch interval (1h30 = 90min, 1h00 = 60min)', () => {
  // 08:00 to 17:30 (570 min) with 1h30 lunch (11:30 to 13:00 = 90 min) -> exactly 480 min = 8.00h
  const shift1h30Lunch: DayShift = {
    day: 'SEG',
    type: 'TRABALHO',
    chairId: 'VEND-L1-1',
    startTime: '08:00',
    lunchStart: '11:30',
    lunchEnd: '13:00',
    endTime: '17:30',
  };
  assert.equal(calculateDailyHours(shift1h30Lunch), 8.0);
  assert.equal(formatHoursDecimal(calculateDailyHours(shift1h30Lunch)), '8h00');

  // 08:00 to 17:30 with 1h00 lunch (12:00 to 13:00 = 60 min) -> exactly 510 min = 8.50h (8h30)
  const shift1h00Lunch: DayShift = {
    day: 'SEG',
    type: 'TRABALHO',
    chairId: 'VEND-L1-1',
    startTime: '08:00',
    lunchStart: '12:00',
    lunchEnd: '13:00',
    endTime: '17:30',
  };
  assert.equal(calculateDailyHours(shift1h00Lunch), 8.5);
  assert.equal(formatHoursDecimal(calculateDailyHours(shift1h00Lunch)), '8h30');

  // Saturday 08:00 to 13:00 without lunch = exactly 300 min = 5.00h (5h00)
  const saturdayShift: DayShift = {
    day: 'SAB',
    type: 'TRABALHO',
    chairId: 'VEND-L1-1',
    startTime: '08:00',
    endTime: '13:00',
  };
  assert.equal(calculateDailyHours(saturdayShift), 5.0);
  assert.equal(formatHoursDecimal(calculateDailyHours(saturdayShift)), '5h00');

  // Rest day has 0 hours
  const restShift: DayShift = {
    day: 'DOM',
    type: 'FOLGA_DSR',
    chairId: 'SDR-1',
  };
  assert.equal(calculateDailyHours(restShift), 0);
});

test('Cenário A calculates 40h for weekday-only staff and 37h for Saturday staff', () => {
  const [scenA] = createDefaultScenarios();

  // Winona (does not work Saturday): 5 days x 8h = 40h
  const winona = scenA.employees.find((e) => e.id === 'emp-winona')!;
  assert.equal(calculateWeeklyHours(winona.schedule), 40.0);

  // Jair (works Saturday, off Tuesday): 4 days x 8h (32h) + Saturday 5h = 37h
  const jair = scenA.employees.find((e) => e.id === 'emp-jair')!;
  assert.equal(calculateWeeklyHours(jair.schedule), 37.0);

  // Both are compliant with Fase 1 (teto 42h)
  const compWinona = validateEmployeeCompliance(winona, 'FASE_1');
  assert.equal(compWinona.isCompliant, true);

  const compJair = validateEmployeeCompliance(jair, 'FASE_1');
  assert.equal(compJair.isCompliant, true);
});

test('calculateInterjornadaRest enforces Art. 66 CLT 11-hour consecutive rest', () => {
  const shiftLate: DayShift = {
    day: 'SEG',
    type: 'TRABALHO',
    chairId: 'VEND-L1-1',
    startTime: '13:00',
    endTime: '22:00',
  };
  const shiftEarlyNextDay: DayShift = {
    day: 'TER',
    type: 'TRABALHO',
    chairId: 'VEND-L1-1',
    startTime: '07:00',
    endTime: '16:00',
  };
  const violation = calculateInterjornadaRest(shiftLate, shiftEarlyNextDay);
  assert.equal(violation.valid, false);
  assert.equal(violation.restMinutes, 540); // 9h = 540m

  const normalShift1: DayShift = {
    day: 'SEG',
    type: 'TRABALHO',
    chairId: 'VEND-L1-1',
    startTime: '08:00',
    endTime: '17:30',
  };
  const normalShift2: DayShift = {
    day: 'TER',
    type: 'TRABALHO',
    chairId: 'VEND-L1-1',
    startTime: '08:00',
    endTime: '17:30',
  };
  const validInter = calculateInterjornadaRest(normalShift1, normalShift2);
  assert.equal(validInter.valid, true);
});

test('traditional 6x1 schedule violates EC 141/2026 Fase 1 and Fase 2', () => {
  const schedule6x1 = createTraditional6x1Schedule('VEND-L1-1');
  assert.equal(calculateWeeklyHours(schedule6x1), 44);

  const mockEmployee: Employee = {
    id: 'emp-test',
    name: 'Carlos Oliveira',
    shortName: 'Carlos',
    role: 'Vendedor',
    contractType: 'CLT_ATIVO',
    department: 'VENDAS',
    defaultStore: 'LOJA_1',
    defaultChairId: 'VEND-L1-1',
    badgeColor: '#10B981',
    rulesAndRestrictions: 'Nenhuma',
    schedule: schedule6x1,
  };

  const resAtual = validateEmployeeCompliance(mockEmployee, 'ATUAL');
  assert.equal(resAtual.isCompliant, true);

  const resFase1 = validateEmployeeCompliance(mockEmployee, 'FASE_1');
  assert.equal(resFase1.isCompliant, false);
  assert.equal(resFase1.status, 'VIOLACAO');
  assert.equal(resFase1.violations.some((v) => v.code === 'MAX_HOURS_EXCEEDED'), true);
  assert.equal(resFase1.violations.some((v) => v.code === 'INSUFFICIENT_REST_DAYS'), true);

  const resFase2 = validateEmployeeCompliance(mockEmployee, 'FASE_2');
  assert.equal(resFase2.isCompliant, false);
  assert.equal(resFase2.status, 'VIOLACAO');
});

test('validates Matheus Coutinho (Estagiário) rules: 24h week, max 6h/day, morning restriction', () => {
  const baseTeam = createBaseEmployees();
  const matheus = baseTeam.find((e) => e.id === 'emp-matheus')!;
  assert.ok(matheus);

  const resValid = validateEmployeeCompliance(matheus, 'FASE_1');
  assert.equal(resValid.isCompliant, true);
  assert.equal(resValid.totalWeeklyHours, 24);

  const matheusMorning = JSON.parse(JSON.stringify(matheus)) as Employee;
  matheusMorning.schedule.SEG = {
    day: 'SEG',
    type: 'TRABALHO',
    chairId: 'DOC-EST',
    startTime: '08:00',
    endTime: '12:00',
  };
  const resMorning = validateEmployeeCompliance(matheusMorning, 'FASE_1');
  assert.equal(resMorning.isCompliant, false);
  assert.ok(resMorning.violations.some((v) => v.code === 'INTERNA_MATHEUS_MORNING'));
});

test('checkTeamOperationalAndAffinities flags critical Monday for Andria and Friday for João Pedro', () => {
  const baseTeam = createBaseEmployees();

  const teamCopy = JSON.parse(JSON.stringify(baseTeam)) as Employee[];
  const andria = teamCopy.find((e) => e.id === 'emp-andria')!;
  andria.schedule.SEG = { day: 'SEG', type: 'FOLGA_5X2', chairId: andria.defaultChairId };

  const alerts = checkTeamOperationalAndAffinities(teamCopy);
  assert.ok(alerts.some((a) => a.code === 'CRITICAL_DAY_ABSENCE' && a.daysInvolved?.includes('SEG')));

  const jp = teamCopy.find((e) => e.id === 'emp-joao-pedro')!;
  jp.schedule.SEX = { day: 'SEX', type: 'FOLGA_5X2', chairId: jp.defaultChairId };

  const alerts2 = checkTeamOperationalAndAffinities(teamCopy);
  assert.ok(alerts2.some((a) => a.code === 'CRITICAL_DAY_ABSENCE' && a.daysInvolved?.includes('SEX')));
});

test('balanceEmployeeHours balances shortfall hours across weekdays to reach target', () => {
  const baseTeam = createBaseEmployees();
  const jair = JSON.parse(JSON.stringify(baseTeam.find((e) => e.id === 'emp-jair')!)) as Employee;

  // Jair folga na Terça e folga no Sábado (ficando com 4 dias de 8h = 32h, devendo 8h para 40h)
  jair.schedule.TER = { day: 'TER', type: 'FOLGA_5X2', chairId: jair.defaultChairId };
  jair.schedule.SAB = { day: 'SAB', type: 'FOLGA_5X2', chairId: jair.defaultChairId };

  assert.equal(calculateWeeklyHours(jair.schedule), 32);

  // Equilibrar para 40h nos 4 dias de trabalho restantes
  const balanced = balanceEmployeeHours(jair, 40.0, 'AUTO');
  const newWeeklyHours = calculateWeeklyHours(balanced.schedule);

  assert.equal(newWeeklyHours, 40);
});

test('applyGroupSchedule applies uniform schedule across an entire department', () => {
  const baseTeam = createBaseEmployees();

  const updatedTeam = applyGroupSchedule(baseTeam, 'SDR', {
    startTime: '08:30',
    lunchStart: '12:00',
    lunchEnd: '13:30',
    endTime: '18:00',
    workDays: ['SEG', 'TER', 'QUA', 'QUI', 'SEX'],
  });

  const sdrs = updatedTeam.filter((e) => e.department === 'SDR');
  sdrs.forEach((sdr) => {
    assert.equal(sdr.schedule.SEG.startTime, '08:30');
    assert.equal(sdr.schedule.SEG.endTime, '18:00');
    assert.equal(sdr.schedule.SAB.type, 'FOLGA_5X2');
    assert.equal(sdr.schedule.DOM.type, 'FOLGA_DSR');
  });
});

test('strict week isolation: modifying Week 1 does not alter Weeks 2, 3, or 4', () => {
  const [scenA] = createDefaultScenarios();
  const winonaOrig = ensureEmployeeWeeksSchedule(scenA.employees.find((e) => e.id === 'emp-winona')!);

  const w2Before = JSON.stringify(winonaOrig.weeksSchedule![2]);
  const w3Before = JSON.stringify(winonaOrig.weeksSchedule![3]);
  const w4Before = JSON.stringify(winonaOrig.weeksSchedule![4]);

  // Altera Segunda-feira na Semana 1 para Folga
  const afterShiftEdit = updateEmployeeShiftAcrossWeeks(winonaOrig, 1, 'SEG', {
    type: 'FOLGA_5X2',
    label: 'Folga 5x2',
  });

  assert.equal(afterShiftEdit.weeksSchedule![1].SEG.type, 'FOLGA_5X2');
  assert.equal(JSON.stringify(afterShiftEdit.weeksSchedule![2]), w2Before);
  assert.equal(JSON.stringify(afterShiftEdit.weeksSchedule![3]), w3Before);
  assert.equal(JSON.stringify(afterShiftEdit.weeksSchedule![4]), w4Before);

  // Substitui a grade da Semana 2 via replaceEmployeeWeekSchedule sem afetar Semana 1, 3 ou 4
  const w1AfterEdit = JSON.stringify(afterShiftEdit.weeksSchedule![1]);
  const balancedW2 = balanceEmployeeHours(
    { ...afterShiftEdit, schedule: afterShiftEdit.weeksSchedule![2] },
    40,
    'AUTO'
  );
  const afterReplace = replaceEmployeeWeekSchedule(afterShiftEdit, 2, balancedW2.schedule);

  assert.equal(JSON.stringify(afterReplace.weeksSchedule![1]), w1AfterEdit);
  assert.equal(JSON.stringify(afterReplace.weeksSchedule![3]), w3Before);
  assert.equal(JSON.stringify(afterReplace.weeksSchedule![4]), w4Before);
  assert.equal(calculateWeeklyHours(afterReplace.weeksSchedule![2]), 40);
});

test('calculateEmployeeMonthlySummary and balanceActiveWeekForMonthlyTarget adjust only active week to close monthly sum', () => {
  const [scenA] = createDefaultScenarios();
  // Jair no Cenário A: S1 tem Sábado folga (40h) e S2, S3, S4 têm Sábado trabalhado + folga Terça (37h) -> 40+37+37+37 = 151h
  const jair = ensureEmployeeWeeksSchedule(scenA.employees.find((e) => e.id === 'emp-jair')!);

  const summaryF2 = calculateEmployeeMonthlySummary(jair, 'FASE_2');
  assert.equal(summaryF2.monthlyTargetHours, 160);
  assert.equal(summaryF2.totalMonthlyHours, 151);
  assert.equal(summaryF2.monthlyBalanceHours, -9);

  const w1Before = JSON.stringify(jair.weeksSchedule![1]);
  const w3Before = JSON.stringify(jair.weeksSchedule![3]);
  const w4Before = JSON.stringify(jair.weeksSchedule![4]);

  // Ajusta SOMENTE a Semana 2 para compensar as -9h do mês (37h + 9h = 46h: 4 dias úteis de 10h + 6h sáb)
  const jairWeek2Balanced = balanceActiveWeekForMonthlyTarget(jair, 2, 'FASE_2', 'AUTO');
  assert.equal(JSON.stringify(jairWeek2Balanced.weeksSchedule![1]), w1Before);
  assert.equal(JSON.stringify(jairWeek2Balanced.weeksSchedule![3]), w3Before);
  assert.equal(JSON.stringify(jairWeek2Balanced.weeksSchedule![4]), w4Before);
  assert.equal(calculateWeeklyHours(jairWeek2Balanced.weeksSchedule![2]), 46);
  assert.equal(calculateEmployeeMonthlySummary(jairWeek2Balanced, 'FASE_2').totalMonthlyHours, 160);
});

test('balanceAllWeeksToMonthlyTarget closes 4-week monthly sum exactly to 160h (Fase 2) and 168h (Fase 1) preserving days off', () => {
  const [scenA] = createDefaultScenarios();
  const jair = ensureEmployeeWeeksSchedule(scenA.employees.find((e) => e.id === 'emp-jair')!);

  // Fase 2 (160h = 4x40h): S1 já tem 40h, S2/S3/S4 têm 37h -> cada uma de S2/S3/S4 deve ir para 40h = 160h exatas!
  const jairClosedF2 = balanceAllWeeksToMonthlyTarget(jair, 'FASE_2', 'AUTO');
  const sumF2 = calculateEmployeeMonthlySummary(jairClosedF2, 'FASE_2');
  assert.equal(sumF2.totalMonthlyHours, 160);
  assert.equal(sumF2.monthlyBalanceHours, 0);
  assert.deepEqual(sumF2.weeklyHours, [40, 40, 40, 40]);
  // Preserva folgas de Terça em S2/S3/S4 e Sábado em S1
  assert.equal(jairClosedF2.weeksSchedule![1].SAB.type, 'FOLGA_5X2');
  assert.equal(jairClosedF2.weeksSchedule![2].TER.type, 'FOLGA_5X2');
  assert.equal(jairClosedF2.weeksSchedule![2].SAB.type, 'TRABALHO');

  // Fase 1 (168h = 4x42h): S1 (40h->42h), S2/S3/S4 (37h->42h) -> 42+42+42+42 = 168h exatas!
  const jairClosedF1 = balanceAllWeeksToMonthlyTarget(jair, 'FASE_1', 'AUTO');
  const sumF1 = calculateEmployeeMonthlySummary(jairClosedF1, 'FASE_1');
  assert.equal(sumF1.totalMonthlyHours, 168);
  assert.equal(sumF1.monthlyBalanceHours, 0);
  assert.deepEqual(sumF1.weeklyHours, [42, 42, 42, 42]);
});

test('calculateEmployeeMonthlySummary tracks independent offDaysByWeek, progressive accumulatedBalances, and compensatedHours', () => {
  const [scenA] = createDefaultScenarios();
  let winona = ensureEmployeeWeeksSchedule(scenA.employees.find((e) => e.id === 'emp-winona')!);

  // Winona no Cenário A: S1 folga Sáb+Dom (40h), S2/S3/S4 folgam Ter+Dom com Sáb 5h (37h).
  // Vamos personalizar para ter folgas diferentes em cada semana e horas acumulando:
  // S1: 44h (+4h sobre 40h na Fase 2, folgas: SAB, DOM)
  // S2: 36h (-4h sobre 40h na Fase 2, folgas: QUA, DOM com SAB trabalhando 4h ou folgando SAB e trabalhando 4 dias + 1h)
  // Usando updateEmployeeShiftAcrossWeeks para simular mudanças individuais em cada semana:
  winona = updateEmployeeShiftAcrossWeeks(winona, 1, 'SAB', {
    type: 'TRABALHO',
    startTime: '08:00',
    endTime: '12:00',
    label: '08:00–12:00 (4h)',
  }); // S1 = 44h (+4h), folga só DOM (simulado)
  winona = updateEmployeeShiftAcrossWeeks(winona, 2, 'QUA', {
    type: 'FOLGA_5X2',
    label: 'Folga 5x2',
  }); // S2 tinha Ter folga (37h) -> tirando Qua fica 29h (-11h); devolvendo Ter trabalho = 37h e deixando Sab folga + Qua folga = 32h (-8h)
  winona = updateEmployeeShiftAcrossWeeks(winona, 2, 'TER', {
    type: 'TRABALHO',
    startTime: '08:00',
    lunchStart: '12:00',
    lunchEnd: '13:30',
    endTime: '17:30',
    label: '08:00–17:30',
  });
  winona = updateEmployeeShiftAcrossWeeks(winona, 2, 'SAB', {
    type: 'FOLGA_5X2',
    label: 'Folga 5x2',
  }); // S2 = 32h (-8h), folgas QUA, SAB, DOM

  // S3: volta Ter folga + trabalha Sáb, ajusta Qui +3h = 40h (delta 0h)
  winona = updateEmployeeShiftAcrossWeeks(winona, 3, 'QUI', {
    type: 'TRABALHO',
    startTime: '08:00',
    lunchStart: '12:00',
    lunchEnd: '13:00',
    endTime: '20:00',
    label: '08:00–20:00',
  }); // Qui vai de 8h para 11h (+3h -> 40h) -> wait, 11h viola CLT 10h; usar 19:00 = 10h (+2h -> 39h) e Sex +1h (18:30, 9h) = 40h!
  winona = updateEmployeeShiftAcrossWeeks(winona, 3, 'QUI', {
    type: 'TRABALHO',
    startTime: '08:00',
    lunchStart: '12:00',
    lunchEnd: '13:00',
    endTime: '19:00',
    label: '08:00–19:00',
  });
  winona = updateEmployeeShiftAcrossWeeks(winona, 3, 'SEX', {
    type: 'TRABALHO',
    startTime: '08:00',
    lunchStart: '12:00',
    lunchEnd: '13:00',
    endTime: '18:00',
    label: '08:00–18:00',
  }); // S3 = 40h (delta 0h), folgas TER, DOM

  // S4: Seg folga, trabalha Ter/Qua/Qui/Sex 10h (08-19 almoço 12-13) + Sáb 4h (08-12) -> 44h (+4h), folgas SEG, DOM
  winona = updateEmployeeShiftAcrossWeeks(winona, 4, 'SEG', { type: 'FOLGA_5X2', label: 'Folga 5x2' });
  winona = updateEmployeeShiftAcrossWeeks(winona, 4, 'TER', {
    type: 'TRABALHO',
    startTime: '08:00',
    lunchStart: '12:00',
    lunchEnd: '13:00',
    endTime: '19:00',
    label: '08:00–19:00',
  });
  winona = updateEmployeeShiftAcrossWeeks(winona, 4, 'QUA', {
    type: 'TRABALHO',
    startTime: '08:00',
    lunchStart: '12:00',
    lunchEnd: '13:00',
    endTime: '19:00',
    label: '08:00–19:00',
  });
  winona = updateEmployeeShiftAcrossWeeks(winona, 4, 'QUI', {
    type: 'TRABALHO',
    startTime: '08:00',
    lunchStart: '12:00',
    lunchEnd: '13:00',
    endTime: '19:00',
    label: '08:00–19:00',
  });
  winona = updateEmployeeShiftAcrossWeeks(winona, 4, 'SEX', {
    type: 'TRABALHO',
    startTime: '08:00',
    lunchStart: '12:00',
    lunchEnd: '13:00',
    endTime: '19:00',
    label: '08:00–19:00',
  });
  winona = updateEmployeeShiftAcrossWeeks(winona, 4, 'SAB', {
    type: 'TRABALHO',
    startTime: '08:00',
    endTime: '12:00',
    label: '08:00–12:00 (4h)',
  });

  const summary = calculateEmployeeMonthlySummary(winona, 'FASE_2');

  assert.deepEqual(summary.weeklyHours, [44, 32, 40, 44]);
  assert.deepEqual(summary.weeklyDeltas, [4, -8, 0, 4]);
  assert.deepEqual(summary.accumulatedBalances, [4, -4, -4, 0]);
  assert.equal(summary.totalMonthlyHours, 160);
  assert.equal(summary.monthlyBalanceHours, 0);
  assert.equal(summary.compensatedHours, 8);
  assert.equal(summary.totalOvertimeHours, 0);

  // Dias de folga completamente independentes em cada semana
  assert.deepEqual(summary.offDaysByWeek[0], ['DOM']);
  assert.deepEqual(summary.offDaysByWeek[1], ['QUA', 'SAB', 'DOM']);
  assert.deepEqual(summary.offDaysByWeek[2], ['TER', 'DOM']);
  assert.deepEqual(summary.offDaysByWeek[3], ['SEG', 'DOM']);
});

test('automatic monthly recalculation updates balances immediately when a single shift is toggled', () => {
  const [scenA] = createDefaultScenarios();
  const winona = ensureEmployeeWeeksSchedule(scenA.employees.find((e) => e.id === 'emp-winona')!);

  const before = calculateEmployeeMonthlySummary(winona, 'FASE_1');
  // S1=40h (-2h), S2=37h (-5h), S3=37h (-5h), S4=37h (-5h) => total 151h, acumulado [-2, -7, -12, -17]
  assert.equal(before.totalMonthlyHours, 151);
  assert.deepEqual(before.accumulatedBalances, [-2, -7, -12, -17]);
  assert.equal(before.status, 'COMPENSANDO');

  // Tira Segunda da S1 (de 8h para Folga) -> S1 cai de 40h para 32h (-10h na Fase 1)
  const afterS1 = updateEmployeeShiftAcrossWeeks(winona, 1, 'SEG', {
    type: 'FOLGA_5X2',
    label: 'Folga 5x2',
  });
  const sumAfterS1 = calculateEmployeeMonthlySummary(afterS1, 'FASE_1');
  assert.deepEqual(sumAfterS1.weeklyHours, [32, 37, 37, 37]);
  assert.deepEqual(sumAfterS1.accumulatedBalances, [-10, -15, -20, -25]);
  assert.equal(sumAfterS1.totalMonthlyHours, 143);
  assert.equal(sumAfterS1.monthlyBalanceHours, -25);

  // Tira Quarta da S2 -> S2 cai de 37h para 29h (-13h na Fase 1), sem mexer em S1
  const afterS2 = updateEmployeeShiftAcrossWeeks(afterS1, 2, 'QUA', {
    type: 'FOLGA_5X2',
    label: 'Folga 5x2',
  });
  const sumAfterS2 = calculateEmployeeMonthlySummary(afterS2, 'FASE_1');
  assert.deepEqual(sumAfterS2.weeklyHours, [32, 29, 37, 37]);
  assert.deepEqual(sumAfterS2.accumulatedBalances, [-10, -23, -28, -33]);
  assert.equal(sumAfterS2.totalMonthlyHours, 135);
  assert.ok(sumAfterS2.offDaysByWeek[0].includes('SEG'));
  assert.ok(!sumAfterS2.offDaysByWeek[0].includes('QUA'));
  assert.ok(sumAfterS2.offDaysByWeek[1].includes('QUA'));
});

test('balanceAllWeeksToMonthlyTarget spreads Step-2 spillover across weeks when one week hits 10h/day CLT cap', () => {
  const [scenA] = createDefaultScenarios();
  let winona = ensureEmployeeWeeksSchedule(scenA.employees.find((e) => e.id === 'emp-winona')!);

  // Semana 1 com 3 folgas (SEG, SAB, DOM) -> apenas 4 dias úteis (máx possível CLT = 40h, abaixo dos 42h da Fase 1)
  winona = updateEmployeeShiftAcrossWeeks(winona, 1, 'SEG', {
    type: 'FOLGA_5X2',
    label: 'Folga 5x2',
  });

  // Fecha o mês na Fase 1 (168h): S1 só chega até 40h (falta 2h de spillover que precisa ir para S2, S3, S4!)
  const closed = balanceAllWeeksToMonthlyTarget(winona, 'FASE_1', 'AUTO');
  const sum = calculateEmployeeMonthlySummary(closed, 'FASE_1');

  assert.equal(sum.totalMonthlyHours, 168);
  assert.equal(sum.monthlyBalanceHours, 0);
  // S1 bate o teto de 40h (4 dias x 10h)
  assert.equal(sum.weeklyHours[0], 40);
  // Os 2h restantes foram distribuídos nas outras semanas sem sobrecarregar só uma semana
  assert.ok(sum.weeklyHours[1] > 42 || sum.weeklyHours[2] > 42 || sum.weeklyHours[3] > 42);
  assert.ok(Math.max(...sum.weeklyHours.slice(1)) <= 44);
  // Preserva SEG folga em S1 e TER folga em S2..S4
  assert.equal(closed.weeksSchedule![1].SEG.type, 'FOLGA_5X2');
  assert.equal(closed.weeksSchedule![2].TER.type, 'FOLGA_5X2');
});

test('checkMonthlyTeamOperationalAndAffinities aggregates multi-week operational and affinity tags', () => {
  const [scenA] = createDefaultScenarios();
  let team = scenA.employees.map(ensureEmployeeWeeksSchedule);

  // Marca Andria como folga na Segunda-feira SOMENTE na Semana 2
  team = team.map((emp) =>
    emp.id === 'emp-andria'
      ? updateEmployeeShiftAcrossWeeks(emp, 2, 'SEG', { type: 'FOLGA_5X2', label: 'Folga 5x2' })
      : emp
  );

  const alerts = checkMonthlyTeamOperationalAndAffinities(team);
  const andriaSegAlert = alerts.find(
    (a) => a.code === 'CRITICAL_DAY_ABSENCE' && a.daysInvolved?.includes('SEG') && a.message.includes('Andria')
  );
  assert.ok(andriaSegAlert);
  assert.ok(andriaSegAlert.message.startsWith('[S2]'));
});

test('canReplaceRestDayWithWork blocks reducing weekly rest days below 1 and allows when 2+', () => {
  const [scenA] = createDefaultScenarios();
  const winona = ensureEmployeeWeeksSchedule(scenA.employees.find((e) => e.id === 'emp-winona')!);

  // Semana 1 da Winona tem 2 folgas (SAB e DOM): pode transformar 1 delas em trabalho (ficando com 1 folga mínima)
  assert.equal(countRestDaysInWeek(winona.weeksSchedule![1]), 2);
  const allowedWithTwo = canReplaceRestDayWithWork(winona.weeksSchedule![1], 'SAB', winona.contractType);
  assert.equal(allowedWithTwo.allowed, true);

  // Se reduzir para apenas 1 folga (DOM), passa a bloquear remover a última folga da semana
  const with1Folga = updateEmployeeShiftAcrossWeeks(winona, 1, 'SAB', {
    type: 'TRABALHO',
    startTime: '08:00',
    endTime: '13:00',
  });
  assert.equal(countRestDaysInWeek(with1Folga.weeksSchedule![1]), 1);
  const blocked = canReplaceRestDayWithWork(
    with1Folga.weeksSchedule![1],
    'DOM',
    with1Folga.contractType
  );
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.reason?.includes('1 folga'));
});

test('moveOrApplyFolgaInWeek moves existing Folga within or across weeks preserving >=1 rest day and compensates >42h excess', () => {
  const [scenA] = createDefaultScenarios();
  const jair = ensureEmployeeWeeksSchedule(scenA.employees.find((e) => e.id === 'emp-jair')!);

  const customStoreHours: StoreHoursMap = {
    ...DEFAULT_STORE_HOURS,
    LOJA_1: {
      weekdayOpen: '08:30',
      weekdayClose: '18:00',
      saturdayOpen: '08:00',
      saturdayClose: '13:00',
    },
  };

  // Na S2, Jair folga na TER e DOM. Mover Folga de TER para QUA mantém 2 folgas e reconstrói TER com 08:30-18:00
  const moved = moveOrApplyFolgaInWeek(jair, 2, 'QUA', {
    sourceDay: 'TER',
    storeHours: customStoreHours,
  });
  assert.equal(moved.changed, true);
  assert.equal(moved.employee.weeksSchedule![2].QUA.type, 'FOLGA_5X2');
  assert.equal(moved.employee.weeksSchedule![2].TER.type, 'TRABALHO');
  assert.equal(moved.employee.weeksSchedule![2].TER.startTime, '08:30');
  assert.equal(moved.employee.weeksSchedule![2].TER.endTime, '18:00');
  assert.equal(countRestDaysInWeek(moved.employee.weeksSchedule![2]), 2);

  // Mover folga entre semanas: de S2 (QUA) para S1 (SEG)
  // S2 fica com 1 folga (DOM) e 6 dias trabalhados (>42h), enquanto S1 ganha SEG de folga (3 folgas)
  const crossMoved = moveOrApplyFolgaInWeek(moved.employee, 1, 'SEG', {
    sourceWeek: 2,
    sourceDay: 'QUA',
    storeHours: DEFAULT_STORE_HOURS,
  });
  assert.equal(crossMoved.changed, true);
  assert.equal(crossMoved.employee.weeksSchedule![1].SEG.type, 'FOLGA_5X2');
  assert.equal(countRestDaysInWeek(crossMoved.employee.weeksSchedule![1]), 3);
  assert.equal(crossMoved.employee.weeksSchedule![2].QUA.type, 'TRABALHO');
  assert.equal(countRestDaysInWeek(crossMoved.employee.weeksSchedule![2]), 1);
  // S2 passa a ter 45h (8h x 5 + 5h sab), excedendo 42h, mas compensável no mês sem violação
  assert.equal(calculateWeeklyHours(crossMoved.employee.weeksSchedule![2]), 45);
  const monthlyCross = calculateEmployeeMonthlySummary(crossMoved.employee, 'FASE_1');
  assert.notEqual(monthlyCross.status, 'VIOLACAO');
  assert.ok(monthlyCross.compensatedHours >= 3);

  // Tentar mover a ÚLTIMA folga restante de S2 (DOM) para S1 é bloqueado
  const blockedLast = moveOrApplyFolgaInWeek(crossMoved.employee, 1, 'TER', {
    sourceWeek: 2,
    sourceDay: 'DOM',
    storeHours: DEFAULT_STORE_HOURS,
  });
  assert.equal(blockedLast.changed, false);

  // Soltar um novo objeto Folga sobre QUI aumenta folgas da S2
  const applied = moveOrApplyFolgaInWeek(moved.employee, 2, 'QUI', { storeHours: customStoreHours });
  assert.equal(applied.changed, true);
  assert.equal(applied.employee.weeksSchedule![2].QUI.type, 'FOLGA_5X2');
  assert.equal(countRestDaysInWeek(applied.employee.weeksSchedule![2]), 3);
});

test('updateEmployeeLunchHours changes only active weekday lunch times without touching entry/exit or days off', () => {
  const [scenA] = createDefaultScenarios();
  const winona = ensureEmployeeWeeksSchedule(scenA.employees.find((e) => e.id === 'emp-winona')!);

  // S1 trabalha Seg-Sex (08:00-17:30, almoço 13:00-14:30 = 1h30 -> 40h); S2 folga Ter+Dom
  const updated = updateEmployeeLunchHours(winona, '12:00', '13:00', [1, 2, 3, 4]);
  assert.equal(updated.defaultLunchStart, '12:00');
  assert.equal(updated.defaultLunchEnd, '13:00');
  assert.equal(updated.weeksSchedule![1].SEG.startTime, '08:00');
  assert.equal(updated.weeksSchedule![1].SEG.endTime, '17:30');
  assert.equal(updated.weeksSchedule![1].SEG.lunchStart, '12:00');
  assert.equal(updated.weeksSchedule![1].SEG.lunchEnd, '13:00');
  // Folgas continuam preservadas
  assert.equal(updated.weeksSchedule![1].SAB.type, 'FOLGA_5X2');
  assert.equal(updated.weeksSchedule![2].TER.type, 'FOLGA_5X2');
  // Com almoço reduzido para 1h00, S1 vai de 40h para 42.5h (5 x 8h30)
  assert.equal(calculateWeeklyHours(updated.weeksSchedule![1]), 42.5);
});

test('applyStoreOperatingHours updates active open/close only for selected store and updates operational alert check', () => {
  const [scenA] = createDefaultScenarios();
  const team = scenA.employees.map(ensureEmployeeWeeksSchedule);

  const newL1Hours = {
    weekdayOpen: '09:00',
    weekdayClose: '18:30',
    saturdayOpen: '08:30',
    saturdayClose: '12:30',
  };

  const updatedTeam = applyStoreOperatingHours(team, 'LOJA_1', newL1Hours);
  const winona = updatedTeam.find((e) => e.id === 'emp-winona')!; // LOJA_1
  const marielly = updatedTeam.find((e) => e.id === 'emp-marielly')!; // LOJA_2

  // Loja 1 foi atualizada preservando almoço e folga
  assert.equal(winona.weeksSchedule![1].SEG.startTime, '09:00');
  assert.equal(winona.weeksSchedule![1].SEG.endTime, '18:30');
  assert.equal(winona.weeksSchedule![1].SEG.lunchStart, '13:00');
  assert.equal(winona.weeksSchedule![2].SAB.startTime, '08:30');
  assert.equal(winona.weeksSchedule![2].SAB.endTime, '12:30');
  assert.equal(winona.weeksSchedule![1].SAB.type, 'FOLGA_5X2');

  // Loja 2 permanece intacta (08:00-17:30)
  assert.equal(marielly.weeksSchedule![1].SEG.startTime, '08:00');
  assert.equal(marielly.weeksSchedule![1].SEG.endTime, '17:30');

  // Alerta de abertura/fechamento da Loja 1 respeita o novo horário da Loja 1 (09:00-18:30)
  const alertsWithCustomHours = checkTeamOperationalAndAffinities(updatedTeam, {
    ...DEFAULT_STORE_HOURS,
    LOJA_1: newL1Hours,
  });
  assert.equal(
    alertsWithCustomHours.some((a) => a.message.includes('abertura') || a.message.includes('fechamento')),
    false
  );
});

test('applyGroupBreakInterval updates only break duration/window without overwriting individual entry/exit or rest days', () => {
  const [scenA] = createDefaultScenarios();
  let team = scenA.employees.map(ensureEmployeeWeeksSchedule);

  // Winona entra 09:00-18:30 na SEG S1 com almoço às 13:00; Andria entra 08:00-17:30 com almoço às 12:00
  team = team.map((emp) => {
    if (emp.id === 'emp-winona') {
      return updateEmployeeShiftAcrossWeeks(emp, 1, 'SEG', {
        type: 'TRABALHO',
        startTime: '09:00',
        endTime: '18:30',
        lunchStart: '13:00',
        lunchEnd: '14:30',
        label: '09:00–18:30',
      });
    }
    return emp;
  });

  const origWinona = team.find((e) => e.id === 'emp-winona')!;
  const origAndria = team.find((e) => e.id === 'emp-andria')!;

  // 1. DURATION_ONLY (1h00 = 60 min) apenas na Semana 1:
  // Preserva início individual de almoço (Winona 13:00->14:00, Andria 12:00->13:00), entrada/saída e folgas
  const with60m = applyGroupBreakInterval(team, 'SDR', {
    storeId: 'LOJA_1',
    mode: 'DURATION_ONLY',
    durationMinutes: 60,
    targetWeeks: [1],
  });

  const winona60 = with60m.find((e) => e.id === 'emp-winona')!;
  const andria60 = with60m.find((e) => e.id === 'emp-andria')!;
  const matheus60 = with60m.find((e) => e.id === 'emp-matheus')!; // outro setor + estagiário

  assert.equal(winona60.weeksSchedule![1].SEG.startTime, '09:00');
  assert.equal(winona60.weeksSchedule![1].SEG.endTime, '18:30');
  assert.equal(winona60.weeksSchedule![1].SEG.lunchStart, '13:00');
  assert.equal(winona60.weeksSchedule![1].SEG.lunchEnd, '14:00');
  // Semana 2 da Winona não foi selecionada -> mantém almoço original
  assert.equal(winona60.weeksSchedule![2].SEG.lunchEnd, origWinona.weeksSchedule![2].SEG.lunchEnd);

  // Todos os tipos de turno (trabalho/folga/DSR) nas 4 semanas de Winona e Andria permanecem idênticos
  for (let w = 1; w <= 4; w++) {
    for (const d of ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB', 'DOM'] as const) {
      assert.equal(winona60.weeksSchedule![w][d].type, origWinona.weeksSchedule![w][d].type);
      assert.equal(andria60.weeksSchedule![w][d].type, origAndria.weeksSchedule![w][d].type);
    }
  }

  // Na S1, onde Andria trabalha em dia útil (ex: SEG), mantém 08:00-17:30 e almoço 12:00->13:00
  assert.equal(andria60.weeksSchedule![1].SEG.startTime, '08:00');
  assert.equal(andria60.weeksSchedule![1].SEG.endTime, '17:30');
  assert.equal(andria60.weeksSchedule![1].SEG.lunchStart, '12:00');
  assert.equal(andria60.weeksSchedule![1].SEG.lunchEnd, '13:00');
  // Estagiário de outro setor intacto
  assert.equal(matheus60.weeksSchedule![1].SEG.lunchStart, undefined);

  // 2. FIXED_WINDOW (12:30-13:30) em S1..S4 preserva entrada/saída distintas de cada colaboradora
  const withFixed = applyGroupBreakInterval(with60m, 'SDR', {
    storeId: 'LOJA_1',
    mode: 'FIXED_WINDOW',
    lunchStart: '12:30',
    lunchEnd: '13:30',
    targetWeeks: [1, 2, 3, 4],
  });
  const winonaFixed = withFixed.find((e) => e.id === 'emp-winona')!;
  const andriaFixed = withFixed.find((e) => e.id === 'emp-andria')!;
  assert.equal(winonaFixed.weeksSchedule![1].SEG.startTime, '09:00');
  assert.equal(winonaFixed.weeksSchedule![1].SEG.endTime, '18:30');
  assert.equal(winonaFixed.weeksSchedule![1].SEG.lunchStart, '12:30');
  assert.equal(winonaFixed.weeksSchedule![1].SEG.lunchEnd, '13:30');
  assert.equal(andriaFixed.weeksSchedule![2].SEG.startTime, '08:00');
  assert.equal(andriaFixed.weeksSchedule![2].SEG.endTime, '17:30');
  assert.equal(andriaFixed.weeksSchedule![2].SEG.lunchStart, '12:30');
  assert.equal(andriaFixed.weeksSchedule![2].SEG.lunchEnd, '13:30');

  // 3. NONE remove apenas o intervalo mantendo entrada/saída
  const withNone = applyGroupBreakInterval(withFixed, 'SDR', {
    storeId: 'LOJA_1',
    mode: 'NONE',
    targetWeeks: [1],
  });
  const winonaNone = withNone.find((e) => e.id === 'emp-winona')!;
  assert.equal(winonaNone.weeksSchedule![1].SEG.startTime, '09:00');
  assert.equal(winonaNone.weeksSchedule![1].SEG.endTime, '18:30');
  assert.equal(winonaNone.weeksSchedule![1].SEG.lunchStart, undefined);
  assert.equal(winonaNone.weeksSchedule![1].SEG.lunchEnd, undefined);
});

test('Saturday shifts longer than 6h automatically include lunch break across builders, store hours, individual lunch, and group intervals', () => {
  const [scenA] = createDefaultScenarios();
  let team = scenA.employees.map(ensureEmployeeWeeksSchedule);
  const andria = team.find((e) => e.id === 'emp-andria')!; // defaultLunch 12:00-13:30, works SAB S1 (08:00-13:00)
  const matheus = team.find((e) => e.id === 'emp-matheus')!; // estagiário (never gets adult lunch)

  // 1. buildDefaultWorkShiftForDay: 08:00-13:00 (<=6h) sem almoço; 08:00-16:00 (>6h) com almoço
  const satShort = buildDefaultWorkShiftForDay(andria, 'SAB', andria.defaultChairId, DEFAULT_STORE_HOURS);
  assert.equal(satShort.lunchStart, undefined);
  assert.equal(satShort.lunchEnd, undefined);
  assert.equal(calculateDailyHours(satShort), 5);

  const satLongStore: StoreHoursMap = {
    ...DEFAULT_STORE_HOURS,
    LOJA_1: {
      ...DEFAULT_STORE_HOURS.LOJA_1,
      saturdayOpen: '08:00',
      saturdayClose: '16:00',
    },
  };
  const satLong = buildDefaultWorkShiftForDay(andria, 'SAB', andria.defaultChairId, satLongStore);
  assert.equal(satLong.lunchStart, '12:00');
  assert.equal(satLong.lunchEnd, '13:30');
  assert.equal(calculateDailyHours(satLong), 6.5); // 8h - 1h30

  // 2. updateEmployeeShiftAcrossWeeks: estender sábado para >6h inclui almoço; encurtar para <=6h remove
  const extendedAndria = updateEmployeeShiftAcrossWeeks(andria, 1, 'SAB', {
    type: 'TRABALHO',
    startTime: '08:00',
    endTime: '15:00',
    label: '08:00–15:00',
  });
  assert.equal(extendedAndria.weeksSchedule![1].SAB.lunchStart, '12:00');
  assert.equal(extendedAndria.weeksSchedule![1].SAB.lunchEnd, '13:30');
  assert.equal(calculateDailyHours(extendedAndria.weeksSchedule![1].SAB), 5.5); // 7h - 1h30

  const shortenedAndria = updateEmployeeShiftAcrossWeeks(extendedAndria, 1, 'SAB', {
    type: 'TRABALHO',
    startTime: '08:00',
    endTime: '13:00',
    label: '08:00–13:00',
  });
  assert.equal(shortenedAndria.weeksSchedule![1].SAB.lunchStart, undefined);
  assert.equal(shortenedAndria.weeksSchedule![1].SAB.lunchEnd, undefined);
  assert.equal(calculateDailyHours(shortenedAndria.weeksSchedule![1].SAB), 5);

  // 3. applyStoreOperatingHours com sábado >6h aplica almoço aos sábados ativos da loja (exceto estagiário)
  const storeExtendedTeam = applyStoreOperatingHours(team, 'LOJA_1', satLongStore.LOJA_1);
  const andriaStoreExt = storeExtendedTeam.find((e) => e.id === 'emp-andria')!;
  const matheusAfter = storeExtendedTeam.find((e) => e.id === 'emp-matheus')!;
  assert.equal(andriaStoreExt.weeksSchedule![1].SAB.startTime, '08:00');
  assert.equal(andriaStoreExt.weeksSchedule![1].SAB.endTime, '16:00');
  assert.equal(andriaStoreExt.weeksSchedule![1].SAB.lunchStart, '12:00');
  assert.equal(andriaStoreExt.weeksSchedule![1].SAB.lunchEnd, '13:30');
  assert.equal(calculateDailyHours(andriaStoreExt.weeksSchedule![1].SAB), 6.5);
  assert.equal(matheusAfter.weeksSchedule![1].SAB.lunchStart, undefined);

  // 4. updateEmployeeLunchHours e applyGroupBreakInterval também atualizam Sábado >6h e mantêm Sábado <=6h intacto
  const lunchUpdated = updateEmployeeLunchHours(andriaStoreExt, '12:30', '13:30', [1]);
  assert.equal(lunchUpdated.weeksSchedule![1].SAB.lunchStart, '12:30');
  assert.equal(lunchUpdated.weeksSchedule![1].SAB.lunchEnd, '13:30');
  assert.equal(calculateDailyHours(lunchUpdated.weeksSchedule![1].SAB), 7);

  // Sábado da semana 1 (8h > 6h) muda para 12:00-13:00 (60m), enquanto Sábado <=6h de outro SDR permanece sem almoço
  const group60 = applyGroupBreakInterval(storeExtendedTeam, 'SDR', {
    storeId: 'LOJA_1',
    mode: 'DURATION_ONLY',
    durationMinutes: 60,
    targetWeeks: [1],
  });
  const andriaGroup60 = group60.find((e) => e.id === 'emp-andria')!;
  assert.equal(andriaGroup60.weeksSchedule![1].SAB.lunchStart, '12:00');
  assert.equal(andriaGroup60.weeksSchedule![1].SAB.lunchEnd, '13:00');

  // Encurtando o sábado da Loja 1 de volta para <=6h (08:00-13:00) remove o almoço do sábado
  const storeShortenedTeam = applyStoreOperatingHours(group60, 'LOJA_1', DEFAULT_STORE_HOURS.LOJA_1);
  const andriaShortAgain = storeShortenedTeam.find((e) => e.id === 'emp-andria')!;
  assert.equal(andriaShortAgain.weeksSchedule![1].SAB.lunchStart, undefined);
  assert.equal(andriaShortAgain.weeksSchedule![1].SAB.lunchEnd, undefined);
  assert.equal(calculateDailyHours(andriaShortAgain.weeksSchedule![1].SAB), 5);
});

test('linkEmployeesForSameFolga aligns rest days across S1–S4 while preserving each collaborator own store hours and lunch', () => {
  const [scenA] = createDefaultScenarios();
  const team = scenA.employees.map(ensureEmployeeWeeksSchedule);

  const customStoreHours: StoreHoursMap = {
    LOJA_1: {
      weekdayOpen: '08:00',
      weekdayClose: '17:30',
      saturdayOpen: '08:00',
      saturdayClose: '13:00',
    },
    LOJA_2: {
      weekdayOpen: '09:00',
      weekdayClose: '18:30',
      saturdayOpen: '08:30',
      saturdayClose: '12:30',
    },
  };

  // Winona (L1, almoço 13:00–14:30, S2..S4 folga TER) segue João Alexandre (L1, almoço 12:00–13:30, S2..S4 folga SEG)
  const linked = linkEmployeesForSameFolga(
    team,
    'emp-winona',
    'emp-joao-alexandre',
    true,
    customStoreHours
  );
  const winona = linked.employees.find((e) => e.id === 'emp-winona')!;
  const joao = linked.employees.find((e) => e.id === 'emp-joao-alexandre')!;

  assert.deepEqual(winona.linkedFolgaIds, ['emp-joao-alexandre']);
  assert.deepEqual(joao.linkedFolgaIds, ['emp-winona']);

  for (let w = 1; w <= 4; w++) {
    for (const d of ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB', 'DOM'] as const) {
      const wWork = winona.weeksSchedule![w][d].type === 'TRABALHO';
      const jWork = joao.weeksSchedule![w][d].type === 'TRABALHO';
      assert.equal(wWork, jWork, `Mismatch on week ${w} day ${d}`);
    }
  }
  // Winona mantém seu almoço próprio (13:00–14:30) inclusive no dia TER convertido em TRABALHO
  assert.equal(winona.weeksSchedule![2].TER.type, 'TRABALHO');
  assert.equal(winona.weeksSchedule![2].TER.lunchStart, '13:00');
  assert.equal(winona.weeksSchedule![2].TER.lunchEnd, '14:30');
  assert.equal(winona.weeksSchedule![2].SEG.type, 'FOLGA_5X2');

  // Vínculo entre lojas distintas (João Pedro L2 -> Andria L1, followPartnerFolgas = true) aplica horários da Loja 2 ao JP
  const linkedCrossStore = linkEmployeesForSameFolga(
    linked.employees,
    'emp-joao-pedro',
    'emp-andria',
    true,
    customStoreHours
  );
  const jp = linkedCrossStore.employees.find((e) => e.id === 'emp-joao-pedro')!;
  const andria = linkedCrossStore.employees.find((e) => e.id === 'emp-andria')!;
  // Na S1 Andria folga QUA (JP antes folgava SEG e trabalhava QUA)
  assert.equal(jp.weeksSchedule![1].QUA.type, 'FOLGA_5X2');
  assert.equal(jp.weeksSchedule![1].SEG.type, 'TRABALHO');
  // SEG de JP foi reconstruído respeitando o horário da Loja 2 (09:00–18:30)
  assert.equal(jp.weeksSchedule![1].SEG.startTime, '09:00');
  assert.equal(jp.weeksSchedule![1].SEG.endTime, '18:30');
  assert.deepEqual(andria.linkedFolgaIds, ['emp-joao-pedro']);
});

test('propagateLinkedFolgas mirrors drag-and-drop and shift toggles across linked partners, and unlink cleanly separates them', () => {
  const [scenA] = createDefaultScenarios();
  let team = scenA.employees.map(ensureEmployeeWeeksSchedule);

  // Vincula Winona e João Alexandre seguindo as folgas dele
  team = linkEmployeesForSameFolga(
    team,
    'emp-winona',
    'emp-joao-alexandre',
    true,
    DEFAULT_STORE_HOURS
  ).employees;

  // 1. Move folga de João Alexandre de S2 SEG para S1 QUI -> Winona deve espelhar em S1 e S2
  const movedJoao = moveOrApplyFolgaAcrossWeeks(
    team.find((e) => e.id === 'emp-joao-alexandre')!,
    1,
    'QUI',
    { sourceWeek: 2, sourceDay: 'SEG', storeHours: DEFAULT_STORE_HOURS }
  );
  assert.equal(movedJoao.changed, true);

  team = team.map((e) => (e.id === 'emp-joao-alexandre' ? movedJoao.employee : e));
  team = propagateLinkedFolgas(team, 'emp-joao-alexandre', [1, 2], DEFAULT_STORE_HOURS).employees;

  const winonaAfterMove = team.find((e) => e.id === 'emp-winona')!;
  assert.equal(winonaAfterMove.weeksSchedule![1].QUI.type, 'FOLGA_5X2');
  assert.equal(winonaAfterMove.weeksSchedule![2].SEG.type, 'TRABALHO');

  // 2. Adiciona 3ª pessoa ao grupo (Marcos Antonio -> Winona) e depois desvincula Winona
  team = linkEmployeesForSameFolga(
    team,
    'emp-marcos-antonio',
    'emp-winona',
    true,
    DEFAULT_STORE_HOURS
  ).employees;

  const marcosLinked = team.find((e) => e.id === 'emp-marcos-antonio')!;
  assert.equal(marcosLinked.linkedFolgaIds?.includes('emp-winona'), true);
  assert.equal(marcosLinked.linkedFolgaIds?.includes('emp-joao-alexandre'), true);
  assert.equal(marcosLinked.weeksSchedule![1].QUI.type, 'FOLGA_5X2');

  const unlinked = unlinkEmployeeFolga(team, 'emp-winona');
  team = unlinked.employees;
  const winonaUnlinked = team.find((e) => e.id === 'emp-winona')!;
  const joaoRemaining = team.find((e) => e.id === 'emp-joao-alexandre')!;
  const marcosRemaining = team.find((e) => e.id === 'emp-marcos-antonio')!;

  assert.equal(winonaUnlinked.linkedFolgaIds, undefined);
  assert.deepEqual(joaoRemaining.linkedFolgaIds, ['emp-marcos-antonio']);
  assert.deepEqual(marcosRemaining.linkedFolgaIds, ['emp-joao-alexandre']);

  // Alterar folga de Winona após desvincular não altera mais João Alexandre
  team = team.map((e) =>
    e.id === 'emp-winona'
      ? updateEmployeeShiftAcrossWeeks(e, 3, 'QUA', { type: 'FOLGA_5X2', label: 'Folga 5x2' })
      : e
  );
  team = propagateLinkedFolgas(team, 'emp-winona', [3], DEFAULT_STORE_HOURS).employees;
  assert.equal(
    team.find((e) => e.id === 'emp-joao-alexandre')!.weeksSchedule![3].QUA.type,
    'TRABALHO'
  );
});

test('linkEmployeesForNoParallelFolga separa conflitos, bloqueia arraste paralelo e mantém exclusão mútua', () => {
  const base = createBaseEmployees().map(ensureEmployeeWeeksSchedule);

  // Primeiro vincula Winona e João Alexandre para folgarem IGUAL
  let team = linkEmployeesForSameFolga(
    base,
    'emp-winona',
    'emp-joao-alexandre',
    false,
    DEFAULT_STORE_HOURS
  ).employees;

  assert.equal(
    team.find((e) => e.id === 'emp-winona')!.linkedFolgaIds?.includes('emp-joao-alexandre'),
    true
  );

  // Agora vincula PROIBIÇÃO de folga paralela com resolução automática de conflitos
  const linkRes = linkEmployeesForNoParallelFolga(
    team,
    'emp-winona',
    'emp-joao-alexandre',
    true,
    DEFAULT_STORE_HOURS
  );
  team = linkRes.employees;

  assert.ok(linkRes.resolvedConflictsCount >= 1);
  const winona = team.find((e) => e.id === 'emp-winona')!;
  const joao = team.find((e) => e.id === 'emp-joao-alexandre')!;

  // Vínculo simétrico de proibição e exclusão mútua do vínculo de folga igual
  assert.equal(winona.noParallelFolgaIds?.includes('emp-joao-alexandre'), true);
  assert.equal(joao.noParallelFolgaIds?.includes('emp-winona'), true);
  assert.equal(winona.linkedFolgaIds?.includes('emp-joao-alexandre') ?? false, false);
  assert.equal(joao.linkedFolgaIds?.includes('emp-winona') ?? false, false);

  // Nenhum conflito restante de Seg–Sáb em S1–S4 após separação automática
  const days: Array<'SEG' | 'TER' | 'QUA' | 'QUI' | 'SEX' | 'SAB'> = [
    'SEG',
    'TER',
    'QUA',
    'QUI',
    'SEX',
    'SAB',
  ];
  for (let w = 1; w <= 4; w++) {
    for (const d of days) {
      if (winona.weeksSchedule![w][d].type !== 'TRABALHO') {
        assert.equal(
          checkParallelFolgaConflict(team, 'emp-winona', w, d).length,
          0,
          `Conflito inesperado em S${w} ${d}`
        );
      }
    }
  }

  // Descobre um dia (Seg–Sáb) da semana 1 em que João Alexandre folga e Winona trabalha -> deve BLOQUEAR arraste de folga da Winona
  const joaoOffDay = (['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'] as const).find(
    (d) =>
      joao.weeksSchedule![1][d].type !== 'TRABALHO' &&
      winona.weeksSchedule![1][d].type === 'TRABALHO'
  );
  const winonaOffDay = (['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'] as const).find(
    (d) => winona.weeksSchedule![1][d].type !== 'TRABALHO'
  );
  assert.ok(joaoOffDay && winonaOffDay);

  const blockedMove = moveOrApplyFolgaAcrossWeeks(winona, 1, joaoOffDay!, {
    sourceWeek: 1,
    sourceDay: winonaOffDay!,
    storeHours: DEFAULT_STORE_HOURS,
    allEmployees: team,
  });
  assert.equal(blockedMove.changed, false);
  assert.match(blockedMove.message || '', /Proibição de folga.*paralel/i);

  // Se vincular sem resolver em cima de uma folga paralela forçada, checkTeamOperationalAndAffinities acusa PARALLEL_FOLGA_CONFLICT
  const withForcedConflict = team.map((e) =>
    e.id === 'emp-winona'
      ? updateEmployeeShiftAcrossWeeks(e, 2, 'SEG', { type: 'FOLGA_5X2', label: 'Folga 5x2' })
      : e.id === 'emp-joao-alexandre'
      ? updateEmployeeShiftAcrossWeeks(e, 2, 'SEG', { type: 'FOLGA_5X2', label: 'Folga 5x2' })
      : e
  );
  const week2Slice = withForcedConflict.map((e) => ({ ...e, schedule: e.weeksSchedule![2] }));
  const alerts = checkTeamOperationalAndAffinities(week2Slice, DEFAULT_STORE_HOURS);
  assert.equal(
    alerts.some((a) => a.code === 'PARALLEL_FOLGA_CONFLICT'),
    true
  );

  // Desvincular limpa simetricamente e libera o arraste novamente
  const unlinked = unlinkEmployeeNoParallelFolga(team, 'emp-winona', 'emp-joao-alexandre');
  team = unlinked.employees;
  assert.equal(team.find((e) => e.id === 'emp-winona')!.noParallelFolgaIds, undefined);
  assert.equal(team.find((e) => e.id === 'emp-joao-alexandre')!.noParallelFolgaIds, undefined);

  const allowedAfterUnlink = moveOrApplyFolgaAcrossWeeks(
    team.find((e) => e.id === 'emp-winona')!,
    1,
    joaoOffDay!,
    {
      sourceWeek: 1,
      sourceDay: winonaOffDay!,
      storeHours: DEFAULT_STORE_HOURS,
      allEmployees: team,
    }
  );
  assert.equal(allowedAfterUnlink.changed, true);
});



