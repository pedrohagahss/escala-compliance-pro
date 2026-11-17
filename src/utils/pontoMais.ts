import {
  DayOfWeek,
  Employee,
  EmployeePontoMaisSummary,
  EmployeePontoMaisWeekResult,
  LegalPhase,
  PontoMaisDayDifference,
  PontoMaisDayRule,
  PontoMaisPresetId,
  PontoMaisStandardConfig,
  Scenario,
} from '../types/schedule';
import {
  calculateDailyHours,
  DAYS_OF_WEEK,
  ensureEmployeeWeeksSchedule,
  formatHoursDecimal,
  LEGAL_PHASES,
  parseTimeToMinutes,
} from './compliance';

const cloneConfig = (cfg: PontoMaisStandardConfig): PontoMaisStandardConfig =>
  JSON.parse(JSON.stringify(cfg)) as PontoMaisStandardConfig;

export const PONTOMAIS_PRESET_CONFIGS: Record<
  Exclude<PontoMaisPresetId, 'CUSTOM'>,
  PontoMaisStandardConfig
> = {
  '42H_LUN1H_SEX': {
    presetId: '42H_LUN1H_SEX',
    label: '42h00 Fechadas (Seg–Qui 8h30 + Sex 8h00)',
    note: 'PontoMais fechado em 42h00/sem: Seg–Qui 08:00–17:30 (1h almoço) + Sex 08:00–17:00 (1h almoço). Equipe segue a escala real com Banco de Horas automático.',
    autoManageBancoDeHoras: true,
    days: {
      SEG: {
        isWorkDay: true,
        startTime: '08:00',
        lunchStart: '12:00',
        lunchEnd: '13:00',
        endTime: '17:30',
      },
      TER: {
        isWorkDay: true,
        startTime: '08:00',
        lunchStart: '12:00',
        lunchEnd: '13:00',
        endTime: '17:30',
      },
      QUA: {
        isWorkDay: true,
        startTime: '08:00',
        lunchStart: '12:00',
        lunchEnd: '13:00',
        endTime: '17:30',
      },
      QUI: {
        isWorkDay: true,
        startTime: '08:00',
        lunchStart: '12:00',
        lunchEnd: '13:00',
        endTime: '17:30',
      },
      SEX: {
        isWorkDay: true,
        startTime: '08:00',
        lunchStart: '12:00',
        lunchEnd: '13:00',
        endTime: '17:00',
      },
      SAB: {
        isWorkDay: false,
        startTime: '08:00',
        endTime: '13:00',
      },
      DOM: {
        isWorkDay: false,
        startTime: '00:00',
        endTime: '00:00',
      },
    },
  },
  '42H_8H24_DIA': {
    presetId: '42H_8H24_DIA',
    label: '42h00 Uniforme (Seg–Sex 8h24/dia)',
    note: 'PontoMais fechado em 42h00/sem: Seg–Sex 08:00–17:24 (1h almoço). Equipe segue a escala real com Banco de Horas automático.',
    autoManageBancoDeHoras: true,
    days: {
      SEG: {
        isWorkDay: true,
        startTime: '08:00',
        lunchStart: '12:00',
        lunchEnd: '13:00',
        endTime: '17:24',
      },
      TER: {
        isWorkDay: true,
        startTime: '08:00',
        lunchStart: '12:00',
        lunchEnd: '13:00',
        endTime: '17:24',
      },
      QUA: {
        isWorkDay: true,
        startTime: '08:00',
        lunchStart: '12:00',
        lunchEnd: '13:00',
        endTime: '17:24',
      },
      QUI: {
        isWorkDay: true,
        startTime: '08:00',
        lunchStart: '12:00',
        lunchEnd: '13:00',
        endTime: '17:24',
      },
      SEX: {
        isWorkDay: true,
        startTime: '08:00',
        lunchStart: '12:00',
        lunchEnd: '13:00',
        endTime: '17:24',
      },
      SAB: {
        isWorkDay: false,
        startTime: '08:00',
        endTime: '13:00',
      },
      DOM: {
        isWorkDay: false,
        startTime: '00:00',
        endTime: '00:00',
      },
    },
  },
  '40H_8H_DIA': {
    presetId: '40H_8H_DIA',
    label: '40h00 Fechadas (Seg–Sex 8h00/dia)',
    note: 'PontoMais fechado em 40h00/sem: Seg–Sex 08:00–17:30 (1h30 almoço). Equipe segue a escala real com Banco de Horas automático.',
    autoManageBancoDeHoras: true,
    days: {
      SEG: {
        isWorkDay: true,
        startTime: '08:00',
        lunchStart: '12:00',
        lunchEnd: '13:30',
        endTime: '17:30',
      },
      TER: {
        isWorkDay: true,
        startTime: '08:00',
        lunchStart: '12:00',
        lunchEnd: '13:30',
        endTime: '17:30',
      },
      QUA: {
        isWorkDay: true,
        startTime: '08:00',
        lunchStart: '12:00',
        lunchEnd: '13:30',
        endTime: '17:30',
      },
      QUI: {
        isWorkDay: true,
        startTime: '08:00',
        lunchStart: '12:00',
        lunchEnd: '13:30',
        endTime: '17:30',
      },
      SEX: {
        isWorkDay: true,
        startTime: '08:00',
        lunchStart: '12:00',
        lunchEnd: '13:30',
        endTime: '17:30',
      },
      SAB: {
        isWorkDay: false,
        startTime: '08:00',
        endTime: '13:00',
      },
      DOM: {
        isWorkDay: false,
        startTime: '00:00',
        endTime: '00:00',
      },
    },
  },
};

export function getDefaultPontoMaisConfig(phase: LegalPhase): PontoMaisStandardConfig {
  if (phase === 'FASE_2') {
    return cloneConfig(PONTOMAIS_PRESET_CONFIGS['40H_8H_DIA']);
  }
  return cloneConfig(PONTOMAIS_PRESET_CONFIGS['42H_LUN1H_SEX']);
}

export function getEffectivePontoMaisConfig(
  scenario: Pick<Scenario, 'pontoMaisConfig'> | undefined,
  phase: LegalPhase
): PontoMaisStandardConfig {
  if (scenario?.pontoMaisConfig) {
    const check = validatePontoMaisStandardCap(scenario.pontoMaisConfig, phase);
    if (check.valid) {
      return scenario.pontoMaisConfig;
    }
  }
  return getDefaultPontoMaisConfig(phase);
}

export function calculatePontoMaisDayHours(rule?: PontoMaisDayRule): number {
  if (!rule || !rule.isWorkDay) return 0;
  const startMin = parseTimeToMinutes(rule.startTime);
  const endMin = parseTimeToMinutes(rule.endTime);
  if (endMin <= startMin) return 0;

  let totalMin = endMin - startMin;
  if (rule.lunchStart && rule.lunchEnd) {
    const lStart = parseTimeToMinutes(rule.lunchStart);
    const lEnd = parseTimeToMinutes(rule.lunchEnd);
    if (lEnd > lStart) {
      totalMin -= lEnd - lStart;
    }
  }
  return Math.max(0, Math.round((totalMin / 60) * 10000) / 10000);
}

export function calculatePontoMaisWeeklyHours(config: PontoMaisStandardConfig): number {
  const sum = DAYS_OF_WEEK.reduce(
    (acc, d) => acc + calculatePontoMaisDayHours(config.days[d.key]),
    0
  );
  return Math.round(sum * 10000) / 10000;
}

export interface PontoMaisCapValidation {
  valid: boolean;
  weeklyHours: number;
  maxAllowed: number;
  excessHours: number;
  message?: string;
}

export function validatePontoMaisStandardCap(
  config: PontoMaisStandardConfig,
  phase: LegalPhase
): PontoMaisCapValidation {
  const weeklyHours = calculatePontoMaisWeeklyHours(config);
  const maxAllowed = LEGAL_PHASES[phase].maxWeeklyHours;
  const excessHours = Math.max(0, Math.round((weeklyHours - maxAllowed) * 10000) / 10000);

  if (weeklyHours > maxAllowed + 0.001) {
    return {
      valid: false,
      weeklyHours,
      maxAllowed,
      excessHours,
      message: `Horário padrão no PontoMais (${formatHoursDecimal(
        weeklyHours
      )}) não pode ultrapassar o teto fechado de ${formatHoursDecimal(maxAllowed)}/sem.`,
    };
  }

  return {
    valid: true,
    weeklyHours,
    maxAllowed,
    excessHours: 0,
  };
}

export function calculateEmployeePontoMaisSummary(
  employee: Employee,
  config: PontoMaisStandardConfig,
  _phase: LegalPhase
): EmployeePontoMaisSummary {
  const prepared = ensureEmployeeWeeksSchedule(employee);
  const pontoMaisWeeklyHours = calculatePontoMaisWeeklyHours(config);

  if (prepared.contractType === 'LICENCA_MATERNIDADE' || prepared.isCirculating) {
    const emptyWeeks: EmployeePontoMaisWeekResult[] = [1, 2, 3, 4].map((w) => {
      const dayDifferences = {} as Record<DayOfWeek, PontoMaisDayDifference>;
      DAYS_OF_WEEK.forEach((d) => {
        dayDifferences[d.key] = {
          day: d.key,
          pontoMaisHours: 0,
          realHours: 0,
          diffHours: 0,
          creditHours: 0,
          debitHours: 0,
        };
      });
      return {
        weekNumber: w,
        pontoMaisWeeklyHours: 0,
        realWeeklyHours: 0,
        weeklyNetBancoHours: 0,
        weeklyCreditHours: 0,
        weeklyDebitHours: 0,
        accumulatedBancoHours: 0,
        dayDifferences,
      };
    });

    return {
      employeeId: prepared.id,
      isEligibleForBanco: false,
      pontoMaisWeeklyHours: 0,
      pontoMaisMonthlyHours: 0,
      realMonthlyHours: 0,
      netBancoHoursMonth: 0,
      totalDailyCreditsMonth: 0,
      totalDailyDebitsMonth: 0,
      weeks: emptyWeeks,
    };
  }

  if (prepared.contractType === 'ESTAGIARIO') {
    const weeks: EmployeePontoMaisWeekResult[] = [1, 2, 3, 4].map((w) => {
      const weekSched = prepared.weeksSchedule?.[w] || prepared.schedule;
      let realWeeklyHours = 0;
      const dayDifferences = {} as Record<DayOfWeek, PontoMaisDayDifference>;
      DAYS_OF_WEEK.forEach((d) => {
        const realHours = calculateDailyHours(weekSched[d.key]);
        realWeeklyHours += realHours;
        dayDifferences[d.key] = {
          day: d.key,
          pontoMaisHours: realHours,
          realHours,
          diffHours: 0,
          creditHours: 0,
          debitHours: 0,
        };
      });
      return {
        weekNumber: w,
        pontoMaisWeeklyHours: 24,
        realWeeklyHours: Math.round(realWeeklyHours * 10000) / 10000,
        weeklyNetBancoHours: 0,
        weeklyCreditHours: 0,
        weeklyDebitHours: 0,
        accumulatedBancoHours: 0,
        dayDifferences,
      };
    });

    return {
      employeeId: prepared.id,
      isEligibleForBanco: false,
      pontoMaisWeeklyHours: 24,
      pontoMaisMonthlyHours: 96,
      realMonthlyHours: Math.round(
        weeks.reduce((sum, w) => sum + w.realWeeklyHours, 0) * 10000
      ) / 10000,
      netBancoHoursMonth: 0,
      totalDailyCreditsMonth: 0,
      totalDailyDebitsMonth: 0,
      weeks,
    };
  }

  let runningBanco = 0;
  let totalDailyCreditsMonth = 0;
  let totalDailyDebitsMonth = 0;
  let realMonthlyHours = 0;

  const weeks: EmployeePontoMaisWeekResult[] = [1, 2, 3, 4].map((w) => {
    const weekSched = prepared.weeksSchedule?.[w] || prepared.schedule;
    const dayDifferences = {} as Record<DayOfWeek, PontoMaisDayDifference>;
    let realWeeklyHours = 0;
    let weeklyCreditHours = 0;
    let weeklyDebitHours = 0;

    DAYS_OF_WEEK.forEach((d) => {
      const pontoMaisHours = calculatePontoMaisDayHours(config.days[d.key]);
      const realHours = calculateDailyHours(weekSched[d.key]);
      const diffHours = Math.round((realHours - pontoMaisHours) * 10000) / 10000;
      const creditHours = diffHours > 0.001 ? diffHours : 0;
      const debitHours = diffHours < -0.001 ? Math.abs(diffHours) : 0;

      realWeeklyHours += realHours;
      weeklyCreditHours += creditHours;
      weeklyDebitHours += debitHours;

      dayDifferences[d.key] = {
        day: d.key,
        pontoMaisHours,
        realHours,
        diffHours,
        creditHours,
        debitHours,
      };
    });

    realWeeklyHours = Math.round(realWeeklyHours * 10000) / 10000;
    weeklyCreditHours = Math.round(weeklyCreditHours * 10000) / 10000;
    weeklyDebitHours = Math.round(weeklyDebitHours * 10000) / 10000;
    const weeklyNetBancoHours =
      Math.round((realWeeklyHours - pontoMaisWeeklyHours) * 10000) / 10000;

    runningBanco = Math.round((runningBanco + weeklyNetBancoHours) * 10000) / 10000;
    realMonthlyHours += realWeeklyHours;
    totalDailyCreditsMonth += weeklyCreditHours;
    totalDailyDebitsMonth += weeklyDebitHours;

    return {
      weekNumber: w,
      pontoMaisWeeklyHours,
      realWeeklyHours,
      weeklyNetBancoHours,
      weeklyCreditHours,
      weeklyDebitHours,
      accumulatedBancoHours: runningBanco,
      dayDifferences,
    };
  });

  const pontoMaisMonthlyHours = Math.round(pontoMaisWeeklyHours * 4 * 10000) / 10000;
  realMonthlyHours = Math.round(realMonthlyHours * 10000) / 10000;
  totalDailyCreditsMonth = Math.round(totalDailyCreditsMonth * 10000) / 10000;
  totalDailyDebitsMonth = Math.round(totalDailyDebitsMonth * 10000) / 10000;

  return {
    employeeId: prepared.id,
    isEligibleForBanco: true,
    pontoMaisWeeklyHours,
    pontoMaisMonthlyHours,
    realMonthlyHours,
    netBancoHoursMonth: Math.round((realMonthlyHours - pontoMaisMonthlyHours) * 10000) / 10000,
    totalDailyCreditsMonth,
    totalDailyDebitsMonth,
    weeks,
  };
}

export interface TeamPontoMaisOverview {
  eligibleCount: number;
  totalMonthlyCredits: number;
  totalMonthlyDebits: number;
  totalNetBancoMonth: number;
  positiveBancoCount: number;
  negativeBancoCount: number;
  zeroBancoCount: number;
}

export function calculateTeamPontoMaisOverview(
  employees: Employee[],
  summaryMap: Record<string, EmployeePontoMaisSummary>
): TeamPontoMaisOverview {
  let eligibleCount = 0;
  let totalMonthlyCredits = 0;
  let totalMonthlyDebits = 0;
  let totalNetBancoMonth = 0;
  let positiveBancoCount = 0;
  let negativeBancoCount = 0;
  let zeroBancoCount = 0;

  employees.forEach((emp) => {
    const sum = summaryMap[emp.id];
    if (!sum || !sum.isEligibleForBanco) return;
    eligibleCount++;
    totalMonthlyCredits += sum.totalDailyCreditsMonth;
    totalMonthlyDebits += sum.totalDailyDebitsMonth;
    totalNetBancoMonth += sum.netBancoHoursMonth;

    if (sum.netBancoHoursMonth > 0.08) positiveBancoCount++;
    else if (sum.netBancoHoursMonth < -0.08) negativeBancoCount++;
    else zeroBancoCount++;
  });

  return {
    eligibleCount,
    totalMonthlyCredits: Math.round(totalMonthlyCredits * 10000) / 10000,
    totalMonthlyDebits: Math.round(totalMonthlyDebits * 10000) / 10000,
    totalNetBancoMonth: Math.round(totalNetBancoMonth * 10000) / 10000,
    positiveBancoCount,
    negativeBancoCount,
    zeroBancoCount,
  };
}
