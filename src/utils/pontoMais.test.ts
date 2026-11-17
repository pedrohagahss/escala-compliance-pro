import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateEmployeePontoMaisSummary,
  calculatePontoMaisDayHours,
  calculatePontoMaisWeeklyHours,
  calculateTeamPontoMaisOverview,
  getDefaultPontoMaisConfig,
  getEffectivePontoMaisConfig,
  PONTOMAIS_PRESET_CONFIGS,
  validatePontoMaisStandardCap,
} from './pontoMais';
import { createDefaultScenarios } from '../data/seuCarroData';
import { DayOfWeek, DayShift, Employee, PontoMaisStandardConfig } from '../types/schedule';

function makeEmployee(
  weeklyOverrides: Record<number, Partial<Record<DayOfWeek, Partial<DayShift>>>>
): Employee {
  const baseWork: Record<DayOfWeek, DayShift> = {
    SEG: { day: 'SEG', type: 'TRABALHO', chairId: 'SDR-1', startTime: '08:00', lunchStart: '12:00', lunchEnd: '13:00', endTime: '17:30' },
    TER: { day: 'TER', type: 'TRABALHO', chairId: 'SDR-1', startTime: '08:00', lunchStart: '12:00', lunchEnd: '13:00', endTime: '17:30' },
    QUA: { day: 'QUA', type: 'TRABALHO', chairId: 'SDR-1', startTime: '08:00', lunchStart: '12:00', lunchEnd: '13:00', endTime: '17:30' },
    QUI: { day: 'QUI', type: 'TRABALHO', chairId: 'SDR-1', startTime: '08:00', lunchStart: '12:00', lunchEnd: '13:00', endTime: '17:30' },
    SEX: { day: 'SEX', type: 'TRABALHO', chairId: 'SDR-1', startTime: '08:00', lunchStart: '12:00', lunchEnd: '13:00', endTime: '17:30' },
    SAB: { day: 'SAB', type: 'TRABALHO', chairId: 'SDR-1', startTime: '08:00', endTime: '13:00' },
    DOM: { day: 'DOM', type: 'FOLGA_DSR', chairId: 'SDR-1' },
  };

  const weeksSchedule: Record<number, Record<DayOfWeek, DayShift>> = {};
  for (let w = 1; w <= 4; w++) {
    const clone = JSON.parse(JSON.stringify(baseWork)) as Record<DayOfWeek, DayShift>;
    const ov = weeklyOverrides[w];
    if (ov) {
      (Object.keys(ov) as DayOfWeek[]).forEach((d) => {
        clone[d] = { ...clone[d], ...ov[d] };
      });
    }
    weeksSchedule[w] = clone;
  }

  return {
    id: 'emp-test',
    name: 'Colaborador Teste',
    shortName: 'Teste',
    role: 'SDR',
    contractType: 'CLT_ATIVO',
    department: 'SDR',
    defaultStore: 'LOJA_1',
    defaultChairId: 'SDR-1',
    badgeColor: '#2563EB',
    rulesAndRestrictions: '',
    schedule: weeksSchedule[1],
    weeksSchedule,
  };
}

describe('PontoMais Standard Schedule & Banco de Horas Automático', () => {
  it('todos os presets fecham estritamente dentro do teto semanal (42h Fase 1 / 40h Fase 2)', () => {
    const p42 = PONTOMAIS_PRESET_CONFIGS['42H_LUN1H_SEX'];
    assert.equal(calculatePontoMaisWeeklyHours(p42), 42);
    assert.equal(validatePontoMaisStandardCap(p42, 'FASE_1').valid, true);

    const p42Uniform = PONTOMAIS_PRESET_CONFIGS['42H_8H24_DIA'];
    assert.equal(calculatePontoMaisWeeklyHours(p42Uniform), 42);
    assert.equal(validatePontoMaisStandardCap(p42Uniform, 'FASE_1').valid, true);

    const p40 = PONTOMAIS_PRESET_CONFIGS['40H_8H_DIA'];
    assert.equal(calculatePontoMaisWeeklyHours(p40), 40);
    assert.equal(validatePontoMaisStandardCap(p40, 'FASE_2').valid, true);
  });

  it('bloqueia configuração personalizada no PontoMais que ultrapasse 42h (Fase 1) ou 40h (Fase 2)', () => {
    const overConfig: PontoMaisStandardConfig = {
      ...getDefaultPontoMaisConfig('FASE_1'),
      presetId: 'CUSTOM',
      label: 'Personalizado Inválido',
      days: {
        ...getDefaultPontoMaisConfig('FASE_1').days,
        SEX: {
          isWorkDay: true,
          startTime: '08:00',
          lunchStart: '12:00',
          lunchEnd: '13:00',
          endTime: '17:30', // 8h30 na sexta => 42h30 total
        },
      },
    };

    const checkFase1 = validatePontoMaisStandardCap(overConfig, 'FASE_1');
    assert.equal(checkFase1.valid, false);
    assert.equal(checkFase1.weeklyHours, 42.5);
    assert.equal(checkFase1.excessHours, 0.5);

    const checkFase2 = validatePontoMaisStandardCap(
      getDefaultPontoMaisConfig('FASE_1'),
      'FASE_2'
    );
    assert.equal(checkFase2.valid, false);
    assert.equal(checkFase2.excessHours, 2);

    // Fallback seguro quando cenário tem padrão acima da fase ativa
    const effective = getEffectivePontoMaisConfig({ pontoMaisConfig: overConfig }, 'FASE_1');
    assert.equal(calculatePontoMaisWeeklyHours(effective), 42);
  });

  it('calcula horas extras diárias/semanais e compensações no Banco de Horas mantendo PontoMais fechado em 42h', () => {
    // PontoMais padrão fechado: Seg-Qui 8h30 (34h) + Sex 8h00 = 42h00
    const pontoMais = getDefaultPontoMaisConfig('FASE_1');
    assert.equal(calculatePontoMaisDayHours(pontoMais.days.SEG), 8.5);
    assert.equal(calculatePontoMaisDayHours(pontoMais.days.SEX), 8);
    assert.equal(calculatePontoMaisDayHours(pontoMais.days.SAB), 0);

    // Escala real do colaborador:
    // S1: Folga na TER (-8h30) + Sex 8h30 (+0h30) + Sáb 5h00 (+5h00) => Real = 39h00, BH S1 = -3h00
    // S2: Folga no SAB, trabalha Seg-Sex 8h30 (42h30) => Sex gera +0h30, BH S2 = +0h30
    // S3: Trabalha Seg-Sex 8h30 + 1h extra na Seg (9h30) + Sáb folga => Real = 43h30, BH S3 = +1h30
    // S4: Seg-Sex 8h30 + 1h extra na Qua (9h30) + Sáb 5h00 => Real = 48h30? Não, com folga Qui: Seg(8h30), Ter(8h30), Qua(9h30), Qui(Folga), Sex(8h30), Sáb(5h00) = 40h00 => BH S4 = -2h00
    const emp = makeEmployee({
      1: {
        TER: { type: 'FOLGA_5X2', startTime: undefined, lunchStart: undefined, lunchEnd: undefined, endTime: undefined },
      },
      2: {
        SAB: { type: 'FOLGA_5X2', startTime: undefined, lunchStart: undefined, lunchEnd: undefined, endTime: undefined },
      },
      3: {
        SEG: { endTime: '18:30' }, // +1h00
        SAB: { type: 'FOLGA_5X2', startTime: undefined, lunchStart: undefined, lunchEnd: undefined, endTime: undefined },
      },
      4: {
        QUA: { endTime: '18:30' }, // +1h00
        QUI: { type: 'FOLGA_5X2', startTime: undefined, lunchStart: undefined, lunchEnd: undefined, endTime: undefined },
      },
    });

    const sum = calculateEmployeePontoMaisSummary(emp, pontoMais, 'FASE_1');
    assert.equal(sum.isEligibleForBanco, true);
    assert.equal(sum.pontoMaisWeeklyHours, 42);
    assert.equal(sum.pontoMaisMonthlyHours, 168);

    // S1: Real 39h00 vs PM 42h00 -> net -3h00 (Créd diários: Sex +0h30 + Sab +5h00 = 5h30; Déb: Ter -8h30)
    assert.equal(sum.weeks[0].realWeeklyHours, 39);
    assert.equal(sum.weeks[0].weeklyCreditHours, 5.5);
    assert.equal(sum.weeks[0].weeklyDebitHours, 8.5);
    assert.equal(sum.weeks[0].weeklyNetBancoHours, -3);
    assert.equal(sum.weeks[0].accumulatedBancoHours, -3);

    // S2: Real 42h30 vs PM 42h00 -> net +0h30, acum = -2h30
    assert.equal(sum.weeks[1].realWeeklyHours, 42.5);
    assert.equal(sum.weeks[1].weeklyNetBancoHours, 0.5);
    assert.equal(sum.weeks[1].accumulatedBancoHours, -2.5);

    // S3: Real 43h30 vs PM 42h00 -> net +1h30, acum = -1h00
    assert.equal(sum.weeks[2].realWeeklyHours, 43.5);
    assert.equal(sum.weeks[2].weeklyCreditHours, 1.5);
    assert.equal(sum.weeks[2].weeklyNetBancoHours, 1.5);
    assert.equal(sum.weeks[2].accumulatedBancoHours, -1);

    // S4: Real 40h00 vs PM 42h00 -> net -2h00, acum = -3h00
    assert.equal(sum.weeks[3].realWeeklyHours, 40);
    assert.equal(sum.weeks[3].weeklyNetBancoHours, -2);
    assert.equal(sum.weeks[3].accumulatedBancoHours, -3);
    assert.equal(sum.netBancoHoursMonth, -3);
  });

  it('compensa automaticamente semana de 44h com semana de 40h mantendo PontoMais em 42h', () => {
    const uniform42 = PONTOMAIS_PRESET_CONFIGS['42H_8H24_DIA'];
    // Cada dia Seg-Sex no PontoMais = 8h24 (8.4h) -> 42h00/sem
    const emp = makeEmployee({
      1: {
        // Seg-Sex 08:00-17:30 com 1h18 almoço => 8.2h? Melhor: 08:00-17:48 c/ 1h00 = 8.8h * 5 = 44h
        SEG: { lunchStart: '12:00', lunchEnd: '13:00', endTime: '17:48' },
        TER: { lunchStart: '12:00', lunchEnd: '13:00', endTime: '17:48' },
        QUA: { lunchStart: '12:00', lunchEnd: '13:00', endTime: '17:48' },
        QUI: { lunchStart: '12:00', lunchEnd: '13:00', endTime: '17:48' },
        SEX: { lunchStart: '12:00', lunchEnd: '13:00', endTime: '17:48' },
        SAB: { type: 'FOLGA_5X2', startTime: undefined, endTime: undefined },
      },
      2: {
        // Seg-Sex 08:00-17:00 c/ 1h00 = 8h * 5 = 40h
        SEG: { lunchStart: '12:00', lunchEnd: '13:00', endTime: '17:00' },
        TER: { lunchStart: '12:00', lunchEnd: '13:00', endTime: '17:00' },
        QUA: { lunchStart: '12:00', lunchEnd: '13:00', endTime: '17:00' },
        QUI: { lunchStart: '12:00', lunchEnd: '13:00', endTime: '17:00' },
        SEX: { lunchStart: '12:00', lunchEnd: '13:00', endTime: '17:00' },
        SAB: { type: 'FOLGA_5X2', startTime: undefined, endTime: undefined },
      },
      3: {
        // Seg-Sex 8h24 (42h)
        SEG: { lunchStart: '12:00', lunchEnd: '13:00', endTime: '17:24' },
        TER: { lunchStart: '12:00', lunchEnd: '13:00', endTime: '17:24' },
        QUA: { lunchStart: '12:00', lunchEnd: '13:00', endTime: '17:24' },
        QUI: { lunchStart: '12:00', lunchEnd: '13:00', endTime: '17:24' },
        SEX: { lunchStart: '12:00', lunchEnd: '13:00', endTime: '17:24' },
        SAB: { type: 'FOLGA_5X2', startTime: undefined, endTime: undefined },
      },
      4: {
        SEG: { lunchStart: '12:00', lunchEnd: '13:00', endTime: '17:24' },
        TER: { lunchStart: '12:00', lunchEnd: '13:00', endTime: '17:24' },
        QUA: { lunchStart: '12:00', lunchEnd: '13:00', endTime: '17:24' },
        QUI: { lunchStart: '12:00', lunchEnd: '13:00', endTime: '17:24' },
        SEX: { lunchStart: '12:00', lunchEnd: '13:00', endTime: '17:24' },
        SAB: { type: 'FOLGA_5X2', startTime: undefined, endTime: undefined },
      },
    });

    const sum = calculateEmployeePontoMaisSummary(emp, uniform42, 'FASE_1');
    assert.equal(sum.weeks[0].weeklyNetBancoHours, 2);
    assert.equal(sum.weeks[0].accumulatedBancoHours, 2);
    assert.equal(sum.weeks[1].weeklyNetBancoHours, -2);
    assert.equal(sum.weeks[1].accumulatedBancoHours, 0);
    assert.equal(sum.netBancoHoursMonth, 0);
  });

  it('mantém estagiário (24h) e licença maternidade isolados e agrega equipe padrão corretamente', () => {
    const scen = createDefaultScenarios()[0];
    const pm = getDefaultPontoMaisConfig(scen.phase);
    const map: Record<string, ReturnType<typeof calculateEmployeePontoMaisSummary>> = {};
    scen.employees.forEach((e) => {
      map[e.id] = calculateEmployeePontoMaisSummary(e, pm, scen.phase);
    });

    const matheus = map['emp-matheus'];
    assert.ok(matheus);
    assert.equal(matheus.isEligibleForBanco, false);
    assert.equal(matheus.pontoMaisWeeklyHours, 24);
    assert.equal(matheus.netBancoHoursMonth, 0);

    const grazy = map['emp-grazy'];
    assert.ok(grazy);
    assert.equal(grazy.isEligibleForBanco, false);
    assert.equal(grazy.pontoMaisMonthlyHours, 0);

    const overview = calculateTeamPontoMaisOverview(scen.employees, map);
    assert.ok(overview.eligibleCount > 10);
    assert.ok(overview.totalMonthlyCredits > 0);
  });
});
