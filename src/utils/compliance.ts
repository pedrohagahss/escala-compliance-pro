import {
  ComplianceViolation,
  DayOfWeek,
  DayShift,
  DepartmentId,
  Employee,
  EmployeeComplianceResult,
  EmployeeMonthlySummary,
  LegalPhase,
  LegalPhaseConfig,
  StoreHourCoverage,
  StoreHoursMap,
  StoreId,
  StoreOperatingHours,
} from '../types/schedule';

export const DEFAULT_STORE_HOURS: StoreHoursMap = {
  LOJA_1: {
    weekdayOpen: '08:00',
    weekdayClose: '17:30',
    saturdayOpen: '08:00',
    saturdayClose: '13:00',
  },
  LOJA_2: {
    weekdayOpen: '08:00',
    weekdayClose: '17:30',
    saturdayOpen: '08:00',
    saturdayClose: '13:00',
  },
};

export const DAYS_OF_WEEK: { key: DayOfWeek; label: string; shortLabel: string; isWeekend: boolean }[] = [
  { key: 'SEG', label: 'Segunda-feira', shortLabel: 'Seg', isWeekend: false },
  { key: 'TER', label: 'Terça-feira', shortLabel: 'Ter', isWeekend: false },
  { key: 'QUA', label: 'Quarta-feira', shortLabel: 'Qua', isWeekend: false },
  { key: 'QUI', label: 'Quinta-feira', shortLabel: 'Qui', isWeekend: false },
  { key: 'SEX', label: 'Sexta-feira', shortLabel: 'Sex', isWeekend: false },
  { key: 'SAB', label: 'Sábado', shortLabel: 'Sáb', isWeekend: true },
  { key: 'DOM', label: 'Domingo', shortLabel: 'Dom', isWeekend: true },
];

export const LEGAL_PHASES: Record<LegalPhase, LegalPhaseConfig> = {
  FASE_1: {
    id: 'FASE_1',
    name: 'Fase 1 — Início Obrigatório (15 ou 16 de Dezembro de 2026)',
    shortName: 'Fase 1: 42h (Escala 5x2)',
    badge: 'Fase 1 — 42h (EC 141/2026)',
    maxWeeklyHours: 42,
    maxDailyHours: 8.0, // 8h00 regular
    maxOvertimeDailyHours: 10.0, // CLT Art. 59: máx 2h extras = 10h diárias
    minWeeklyRestDays: 2,
    divisor: 210,
    description:
      'Teto compulsório de 42h semanais e escala 5x2 (mínimo de 2 descansos semanais). Divisor salarial reduzido de 220 para 210, sem redução salarial. Cláusulas coletivas anteriores 6x1 perdem eficácia em 60 dias.',
    legalBasis:
      'Emenda Constitucional nº 141/2026 (promulgada em 16/10/2026). Decisão confirmada pelo Min. Flávio Dino (STF — ADIs 8041 e 8042) assegurando vigência da etapa intermediária de 42h.',
  },
  FASE_2: {
    id: 'FASE_2',
    name: 'Fase 2 — Redução Definitiva (Dezembro de 2027)',
    shortName: 'Fase 2: 40h (Definitiva)',
    badge: 'Fase 2 — 40h (EC 141/2026)',
    maxWeeklyHours: 40,
    maxDailyHours: 8.0, // 8h00 regular em 5 dias
    maxOvertimeDailyHours: 10.0, // CLT Art. 59: máx 2h extras = 10h diárias
    minWeeklyRestDays: 2,
    divisor: 200,
    description:
      'Teto máximo de 40h semanais com escala 5x2 consolidada e jornada regular de até 8h/dia em 5 dias. Divisor salarial 200. Horas excedentes geram adicional de hora extra (mínimo +50%) ou compensação em banco de horas.',
    legalBasis: 'Emenda Constitucional nº 141/2026 — Artigo 2º (Etapa Definitiva de 40 Horas).',
  },
  ATUAL: {
    id: 'ATUAL',
    name: 'Cenário Tradicional Pré-Reforma (Regime CLT 44h)',
    shortName: 'CLT Vigente: 44h (6x1)',
    badge: 'CLT Tradicional 44h',
    maxWeeklyHours: 44,
    maxDailyHours: 8.0,
    maxOvertimeDailyHours: 10.0,
    minWeeklyRestDays: 1,
    divisor: 220,
    description:
      'Carga máxima de 44h semanais, escala 6x1 com 1 folga (DSR aos domingos) e divisor 220. Sujeito à extinção com a EC 141/2026.',
    legalBasis: 'CLT Art. 58 e CF/88 Art. 7º, XIII (redação anterior à EC 141/2026).',
  },
};

/**
 * Converte "HH:MM" para minutos a partir de 00:00
 */
export function parseTimeToMinutes(timeStr?: string): number {
  if (!timeStr || !timeStr.includes(':')) return 0;
  const [h, m] = timeStr.split(':').map((v) => parseInt(v, 10));
  return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
}

/**
 * Converte minutos para "HH:MM"
 */
export function minutesToTimeString(minutes: number): string {
  const norm = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(norm / 60);
  const m = norm % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

/**
 * Retorna a duração bruta do expediente em minutos (Saída - Entrada).
 */
export function getGrossShiftMinutes(startTime?: string, endTime?: string): number {
  if (!startTime || !endTime) return 0;
  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);
  return end >= start ? end - start : end + 1440 - start;
}

/**
 * Regra CLT Art. 71: qualquer jornada com intervalo total maior que 6h (> 360 min),
 * inclusive aos sábados, exige intervalo de almoço/repouso.
 */
export function shouldIncludeLunchBreak(
  shift: Pick<DayShift, 'type' | 'startTime' | 'endTime'>,
  contractType?: Employee['contractType']
): boolean {
  if (shift.type !== 'TRABALHO') return false;
  if (contractType === 'ESTAGIARIO' || contractType === 'LICENCA_MATERNIDADE') return false;
  return getGrossShiftMinutes(shift.startTime, shift.endTime) > 360;
}

/**
 * Resolve uma janela válida de almoço dentro do expediente [startTime, endTime],
 * priorizando o horário padrão do colaborador e ajustando se o turno terminar antes.
 */
export function resolveLunchWindowForShift(
  employee: Pick<Employee, 'defaultLunchStart' | 'defaultLunchEnd'>,
  startTime: string,
  endTime: string
): { lunchStart: string; lunchEnd: string } {
  const prefStartStr = employee.defaultLunchStart || '12:00';
  const prefEndStr = employee.defaultLunchEnd || '13:30';
  const startMin = parseTimeToMinutes(startTime);
  const endMinRaw = parseTimeToMinutes(endTime);
  const endMin = endMinRaw >= startMin ? endMinRaw : endMinRaw + 1440;

  const prefStart = parseTimeToMinutes(prefStartStr);
  const prefEnd = parseTimeToMinutes(prefEndStr);
  const prefDur = Math.max(60, prefEnd > prefStart ? prefEnd - prefStart : 90);

  if (prefStart > startMin && prefEnd < endMin) {
    return { lunchStart: prefStartStr, lunchEnd: prefEndStr };
  }

  const shiftDur = endMin - startMin;
  const safeDur = Math.min(prefDur, Math.max(60, shiftDur - 120));
  const candidateStart = Math.max(startMin + 60, Math.min(prefStart, endMin - safeDur - 30));
  const clampedStart = Math.max(startMin + 30, Math.min(candidateStart, endMin - safeDur - 15));

  return {
    lunchStart: minutesToTimeString(clampedStart),
    lunchEnd: minutesToTimeString(clampedStart + safeDur),
  };
}

/**
 * Formata número de horas decimal (ex: 8.0 -> "8h00", 8.5 -> "8h30", 5.0 -> "5h00", 37.0 -> "37h00")
 */
export function formatHoursDecimal(hours: number): string {
  if (isNaN(hours) || hours <= 0) return '0h00';
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h${m.toString().padStart(2, '0')}`;
}

/**
 * Calcula a duração de trabalho em horas de um turno diário.
 * Se houver horários de entrada e saída, calcula sempre o tempo real líquido:
 * (Saída - Entrada) - (Fim Almoço - Início Almoço)
 */
export function calculateDailyHours(shift: DayShift): number {
  if (shift.type !== 'TRABALHO') return 0;

  if (shift.startTime && shift.endTime) {
    const start = parseTimeToMinutes(shift.startTime);
    const end = parseTimeToMinutes(shift.endTime);

    let totalWorkMinutes = end >= start ? end - start : end + 1440 - start;

    if (shift.lunchStart && shift.lunchEnd) {
      const lStart = parseTimeToMinutes(shift.lunchStart);
      const lEnd = parseTimeToMinutes(shift.lunchEnd);
      const lunchMinutes = lEnd >= lStart ? lEnd - lStart : lEnd + 1440 - lStart;
      totalWorkMinutes -= lunchMinutes;
    }

    return Number(Math.max(0, totalWorkMinutes / 60).toFixed(2));
  }

  if (shift.customHours !== undefined && shift.customHours > 0) {
    return Number(shift.customHours.toFixed(2));
  }

  return 0;
}

/**
 * Calcula o total de horas trabalhadas em uma semana (somando em minutos exatos para evitar erro de arredondamento).
 */
export function calculateWeeklyHours(schedule: Record<DayOfWeek, DayShift>): number {
  let totalMinutes = 0;
  let fallbackHours = 0;
  for (const day of DAYS_OF_WEEK) {
    const shift = schedule[day.key];
    if (!shift || shift.type !== 'TRABALHO') continue;

    if (shift.startTime && shift.endTime) {
      const start = parseTimeToMinutes(shift.startTime);
      const end = parseTimeToMinutes(shift.endTime);
      let workMinutes = end >= start ? end - start : end + 1440 - start;
      if (shift.lunchStart && shift.lunchEnd) {
        const lStart = parseTimeToMinutes(shift.lunchStart);
        const lEnd = parseTimeToMinutes(shift.lunchEnd);
        const lunchMinutes = lEnd >= lStart ? lEnd - lStart : lEnd + 1440 - lStart;
        workMinutes -= lunchMinutes;
      }
      totalMinutes += Math.max(0, workMinutes);
    } else if (shift.customHours !== undefined && shift.customHours > 0) {
      fallbackHours += shift.customHours;
    }
  }
  return Number((totalMinutes / 60 + fallbackHours).toFixed(2));
}

/**
 * Art. 66 CLT: O intervalo interjornada mínimo entre o término de uma jornada
 * e o início da seguinte deve ser de no mínimo 11 horas consecutivas (660 minutos).
 */
export function calculateInterjornadaRest(
  prevShift: DayShift | undefined,
  currShift: DayShift | undefined
): { valid: boolean; restMinutes: number; restHoursStr: string } {
  if (!prevShift || !currShift) return { valid: true, restMinutes: 1440, restHoursStr: '24h+' };
  if (prevShift.type !== 'TRABALHO' || currShift.type !== 'TRABALHO') {
    return { valid: true, restMinutes: 1440, restHoursStr: '24h+' };
  }
  if (!prevShift.endTime || !currShift.startTime) {
    return { valid: true, restMinutes: 1440, restHoursStr: 'N/A' };
  }

  const prevEnd = parseTimeToMinutes(prevShift.endTime);
  const currStart = parseTimeToMinutes(currShift.startTime);

  const restMinutes = 1440 - prevEnd + currStart;
  const valid = restMinutes >= 660; // 11 horas = 660 minutos

  return {
    valid,
    restMinutes,
    restHoursStr: formatHoursDecimal(restMinutes / 60),
  };
}

/**
 * Validação de conformidade semanal com controle legal de HORAS EXTRAS (CLT Art. 59)
 * e teto da EC 141/2026.
 */
export function validateEmployeeCompliance(
  employee: Employee,
  phase: LegalPhase,
  scheduleOverride?: Record<DayOfWeek, DayShift>
): EmployeeComplianceResult {
  const config = LEGAL_PHASES[phase];
  const schedule = scheduleOverride || employee.schedule;

  let totalWeeklyHours = 0;
  let dailyOvertimeTotal = 0;
  let workDaysCount = 0;
  let restDaysCount = 0;
  const violations: ComplianceViolation[] = [];

  // Licença Maternidade
  if (employee.contractType === 'LICENCA_MATERNIDADE') {
    return {
      employeeId: employee.id,
      totalWeeklyHours: 0,
      regularHours: 0,
      overtimeHours: 0,
      dailyOvertimeTotal: 0,
      workDaysCount: 0,
      restDaysCount: 7,
      isCompliant: true,
      hasOvertime: false,
      status: 'CONFORME',
      violations: [],
      balanceHours: -config.maxWeeklyHours,
    };
  }

  for (let i = 0; i < DAYS_OF_WEEK.length; i++) {
    const day = DAYS_OF_WEEK[i].key;
    const shift = schedule[day];
    if (!shift) continue;

    if (shift.type === 'TRABALHO') {
      workDaysCount++;
      const dailyHours = calculateDailyHours(shift);
      totalWeeklyHours += dailyHours;

      // Cálculo de Horas Extras Diárias além de 8h (CLT Art. 59)
      if (employee.contractType !== 'ESTAGIARIO' && dailyHours > 8.0) {
        dailyOvertimeTotal += (dailyHours - 8.0);
      }

      // Regras de Estágio (Lei 11.788/2008 - Matheus Coutinho)
      if (employee.contractType === 'ESTAGIARIO') {
        if (dailyHours > 6.05) {
          violations.push({
            code: 'INTERNA_MATHEUS_LIMIT',
            severity: 'ERROR',
            category: 'LEGAL',
            message: `Violação da Lei do Estágio (Lei 11.788/2008): Limite diário de 6h excedido (${formatHoursDecimal(dailyHours)}) na ${DAYS_OF_WEEK[i].label}.`,
            daysInvolved: [day],
          });
        }
        if (!DAYS_OF_WEEK[i].isWeekend && shift.startTime) {
          const startMin = parseTimeToMinutes(shift.startTime);
          if (startMin < 750) {
            violations.push({
              code: 'INTERNA_MATHEUS_MORNING',
              severity: 'ERROR',
              category: 'OPERATIONAL',
              message: `Restrição de horário do Estagiário: Matheus estuda de manhã e não pode ser alocado antes das 12:30 nos dias úteis.`,
              daysInvolved: [day],
            });
          }
        }
      } else {
        // Teto diário absoluto da CLT: máx 10h (8h regulares + 2h extras - CLT Art. 59)
        if (dailyHours > 10.05) {
          violations.push({
            code: 'DAILY_OVERTIME_LIMIT',
            severity: 'ERROR',
            category: 'LEGAL',
            message: `Jornada diária abusiva na ${DAYS_OF_WEEK[i].label}: ${formatHoursDecimal(dailyHours)} (limite absoluto da CLT é de 10h diárias, sendo 8h regulares + 2h extras).`,
            daysInvolved: [day],
          });
        }
      }
    } else {
      restDaysCount++;
    }

    // Interjornada (Art. 66 CLT) com o dia anterior
    if (i > 0) {
      const prevDay = DAYS_OF_WEEK[i - 1].key;
      const prevShift = schedule[prevDay];
      const inter = calculateInterjornadaRest(prevShift, shift);
      if (!inter.valid) {
        violations.push({
          code: 'INTERJORNADA_VIOLATION',
          severity: 'ERROR',
          category: 'LEGAL',
          message: `Violação do Art. 66 CLT: Descanso interjornada de apenas ${inter.restHoursStr} entre ${DAYS_OF_WEEK[i - 1].shortLabel} e ${DAYS_OF_WEEK[i].shortLabel} (mínimo obrigatório: 11h).`,
          daysInvolved: [prevDay, day],
        });
      }
    }
  }

  // Interjornada Dom -> Seg
  const domShift = schedule['DOM'];
  const segShift = schedule['SEG'];
  if (domShift && segShift) {
    const interWeekend = calculateInterjornadaRest(domShift, segShift);
    if (!interWeekend.valid) {
      violations.push({
        code: 'INTERJORNADA_VIOLATION',
        severity: 'WARNING',
        category: 'LEGAL',
        message: `Intervalo entre Domingo e Segunda é de ${interWeekend.restHoursStr} (mínimo: 11h consecutivas).`,
        daysInvolved: ['DOM', 'SEG'],
      });
    }
  }

  totalWeeklyHours = Number(totalWeeklyHours.toFixed(2));
  dailyOvertimeTotal = Number(dailyOvertimeTotal.toFixed(2));

  // Teto regular da semana
  const maxWeekly = employee.contractType === 'ESTAGIARIO' ? 30 : config.maxWeeklyHours;
  const balanceHours = Number((totalWeeklyHours - maxWeekly).toFixed(2));

  // Horas extras semanais (excedente além do teto da fase)
  const weeklyOvertime = Math.max(0, balanceHours);
  // Total de horas extras geradas (maior entre o excedente semanal e a soma das horas diárias extras)
  const overtimeHours = Number(Math.max(weeklyOvertime, dailyOvertimeTotal).toFixed(2));
  const regularHours = Number(Math.min(totalWeeklyHours, maxWeekly).toFixed(2));
  const hasOvertime = overtimeHours > 0;

  if (employee.contractType === 'ESTAGIARIO') {
    if (totalWeeklyHours > 30.05) {
      violations.push({
        code: 'INTERNA_MATHEUS_LIMIT',
        severity: 'ERROR',
        category: 'LEGAL',
        message: `Carga semanal de estágio excedida: ${formatHoursDecimal(totalWeeklyHours)} (teto da Lei 11.788/2008 é 30h/sem).`,
      });
    }
  } else {
    // Validação de folgas semanais (Escala 5x2 sob EC 141/2026)
    if (config.minWeeklyRestDays >= 2 && restDaysCount < 2) {
      violations.push({
        code: 'INSUFFICIENT_REST_DAYS',
        severity: 'ERROR',
        category: 'LEGAL',
        message: `Inadimplência à Escala 5x2 (EC 141/2026): Apenas ${restDaysCount} folga(s) na semana. A ${config.badge} exige compulsoriamente no mínimo 2 descansos semanais.`,
      });
    } else if (config.minWeeklyRestDays === 1 && restDaysCount < 1) {
      violations.push({
        code: 'INSUFFICIENT_REST_DAYS',
        severity: 'ERROR',
        category: 'LEGAL',
        message: 'Ausência de DSR: Colaborador sem descanso semanal remunerado registrado.',
      });
    }

    // Se houver horas extras regulares (dentro do limite de 2h/dia e acordadas), emitir informativo legal
    if (hasOvertime && !violations.some((v) => v.code === 'DAILY_OVERTIME_LIMIT')) {
      violations.push({
        code: 'MAX_HOURS_EXCEEDED',
        severity: 'INFO',
        category: 'LEGAL',
        message: `Horas Extras Suplementares (Art. 59 CLT): ${formatHoursDecimal(overtimeHours)} além do teto regular de ${maxWeekly}h (${hasOvertime ? 'Adicional mín. 50% ou crédito em Banco de Horas' : ''}).`,
      });
    }
  }

  let status: EmployeeComplianceResult['status'] = 'CONFORME';
  const hasErrors = violations.some((v) => v.severity === 'ERROR');
  const hasWarnings = violations.some((v) => v.severity === 'WARNING');

  if (hasErrors) {
    status = 'VIOLACAO';
  } else if (hasOvertime) {
    status = 'HORAS_EXTRAS';
  } else if (hasWarnings) {
    status = 'ALERTA';
  }

  return {
    employeeId: employee.id,
    totalWeeklyHours,
    regularHours,
    overtimeHours,
    dailyOvertimeTotal,
    workDaysCount,
    restDaysCount,
    isCompliant: !hasErrors,
    hasOvertime,
    status,
    violations,
    balanceHours,
  };
}

/**
 * Calcula a meta semanal padrão para o colaborador na fase legal selecionada.
 */
export function getEmployeeWeeklyTargetHours(employee: Employee, phase: LegalPhase): number {
  if (employee.contractType === 'LICENCA_MATERNIDADE') return 0;
  return employee.contractType === 'ESTAGIARIO' ? 24 : LEGAL_PHASES[phase].maxWeeklyHours;
}

/**
 * Calcula a meta mensal padrão (ciclo de 4 semanas) para o colaborador na fase legal selecionada.
 */
export function getEmployeeMonthlyTargetHours(employee: Employee, phase: LegalPhase): number {
  return Number((getEmployeeWeeklyTargetHours(employee, phase) * 4).toFixed(2));
}

/**
 * Calcula o resumo mensal completo de um colaborador em ciclo de 4 semanas (S1..S4),
 * recalculando automaticamente:
 * - horas de cada semana e folgas independentes por semana;
 * - acúmulo progressivo de horas de uma semana para a outra (S1 -> S2 -> S3 -> S4);
 * - compensação entre semanas (crédito x débito no mês) e saldo final do mês.
 */
export function calculateEmployeeMonthlySummary(
  employee: Employee,
  phase: LegalPhase
): EmployeeMonthlySummary {
  const prepared = ensureEmployeeWeeksSchedule(employee);
  const weeklyTargetHours = getEmployeeWeeklyTargetHours(prepared, phase);
  const monthlyTargetHours = getEmployeeMonthlyTargetHours(prepared, phase);

  const weeklyHours: number[] = [];
  const weeklyDeltas: number[] = [];
  const accumulatedBalances: number[] = [];
  const offDaysByWeek: DayOfWeek[][] = [];
  const workDaysCountByWeek: number[] = [];
  const complianceByWeek: EmployeeComplianceResult[] = [];

  let totalMonthlyMinutes = 0;
  let runningBalanceMinutes = 0;
  let positiveDeltaMinutes = 0;
  let negativeDeltaMinutes = 0;
  let saturdaysWorkedCount = 0;
  let totalMonthlyRestDays = 0;
  let hasHardViolation = false;

  const satOff = prepared.saturdayOffWeek || 1;
  const weeklyTargetMinutes = Math.round(weeklyTargetHours * 60);
  const config = LEGAL_PHASES[phase];

  for (let w = 1; w <= 4; w++) {
    const weekSched = prepared.weeksSchedule?.[w] || prepared.schedule;
    const comp = validateEmployeeCompliance(prepared, phase, weekSched);
    complianceByWeek.push(comp);

    const weekMinutes = Math.round(comp.totalWeeklyHours * 60);
    totalMonthlyMinutes += weekMinutes;
    totalMonthlyRestDays += comp.restDaysCount;

    const deltaMinutes =
      prepared.contractType === 'LICENCA_MATERNIDADE' ? 0 : weekMinutes - weeklyTargetMinutes;
    runningBalanceMinutes += deltaMinutes;

    if (deltaMinutes > 0) positiveDeltaMinutes += deltaMinutes;
    if (deltaMinutes < 0) negativeDeltaMinutes += Math.abs(deltaMinutes);

    weeklyHours.push(comp.totalWeeklyHours);
    weeklyDeltas.push(Number((deltaMinutes / 60).toFixed(2)));
    accumulatedBalances.push(Number((runningBalanceMinutes / 60).toFixed(2)));
    workDaysCountByWeek.push(comp.workDaysCount);

    const weekOffDays = DAYS_OF_WEEK.filter((d) => weekSched[d.key]?.type !== 'TRABALHO').map(
      (d) => d.key
    );
    offDaysByWeek.push(weekOffDays);

    // Violações rígidas que não podem ser compensadas entre semanas:
    // jornada >10h/dia, interjornada <11h, regras de estágio, ou semana com ZERO folgas (< 1 DSR).
    const weekHasHardError = comp.violations.some(
      (v) =>
        v.severity === 'ERROR' &&
        (v.code !== 'INSUFFICIENT_REST_DAYS' || comp.restDaysCount < 1)
    );
    if (weekHasHardError) {
      hasHardViolation = true;
    }

    if (weekSched.SAB?.type === 'TRABALHO') {
      saturdaysWorkedCount++;
    }
  }

  const minMonthlyRestDays =
    prepared.contractType === 'LICENCA_MATERNIDADE' ? 0 : config.minWeeklyRestDays * 4;
  const hasMonthlyRestDeficit =
    prepared.contractType !== 'LICENCA_MATERNIDADE' &&
    prepared.contractType !== 'ESTAGIARIO' &&
    totalMonthlyRestDays < minMonthlyRestDays;
  const hasViolation = hasHardViolation || hasMonthlyRestDeficit;

  const totalMonthlyHours = Number((totalMonthlyMinutes / 60).toFixed(2));
  const monthlyBalanceHours = Number((totalMonthlyHours - monthlyTargetHours).toFixed(2));
  const averageWeeklyHours = Number((totalMonthlyHours / 4).toFixed(2));
  const compensatedMinutes = Math.min(positiveDeltaMinutes, negativeDeltaMinutes);
  const compensatedHours = Number((compensatedMinutes / 60).toFixed(2));
  const totalOvertimeHours =
    prepared.contractType === 'LICENCA_MATERNIDADE'
      ? 0
      : Number(Math.max(0, monthlyBalanceHours).toFixed(2));

  let status: EmployeeMonthlySummary['status'] = 'CONFORME';
  if (hasViolation) {
    status = 'VIOLACAO';
  } else if (monthlyBalanceHours > 0.08) {
    status = 'HORAS_EXTRAS';
  } else if (monthlyBalanceHours < -0.08) {
    status = 'COMPENSANDO';
  }

  return {
    employeeId: prepared.id,
    weeklyHours,
    weeklyTargetHours,
    weeklyDeltas,
    accumulatedBalances,
    offDaysByWeek,
    workDaysCountByWeek,
    complianceByWeek,
    compensatedHours,
    totalMonthlyHours,
    monthlyTargetHours,
    monthlyBalanceHours,
    averageWeeklyHours,
    totalOvertimeHours,
    saturdaysWorkedCount,
    saturdayOffWeek: satOff,
    status,
  };
}

/**
 * Distribui automaticamente o rodízio de "1 Sábado de Folga por Mês"
 * entre a equipe, escalonando para que 25% folgue a cada sábado do mês
 * e mantendo 75% da equipe trabalhando todos os sábados.
 */
export function distributeMonthlySaturdayOff(
  employees: Employee[],
  currentPhase: LegalPhase
): Employee[] {
  // Colaboradores elegíveis para sábado
  const saturdayStaff = employees.filter(
    (e) =>
      e.contractType !== 'LICENCA_MATERNIDADE' &&
      e.contractType !== 'ESTAGIARIO' &&
      !e.isCirculating &&
      (e.department === 'VENDAS' || e.department === 'SDR' || e.department === 'PREPARACAO' || e.department === 'DOCUMENTACAO')
  );

  return employees.map((emp) => {
    const idx = saturdayStaff.findIndex((s) => s.id === emp.id);
    if (idx === -1) return emp;

    // Distribui em 4 semanas (1º sábado, 2º sábado, 3º sábado, 4º sábado)
    const assignedSatWeek = (idx % 4) + 1;

    // Gera as 4 semanas para o colaborador
    const weeksSchedule: Record<number, Record<DayOfWeek, DayShift>> = {};

    for (let w = 1; w <= 4; w++) {
      const sched = JSON.parse(JSON.stringify(emp.schedule)) as Record<DayOfWeek, DayShift>;
      if (w === assignedSatWeek) {
        // Folga no sábado desta semana (cumpre 40h de Seg a Sex com 1h30 de almoço)
        sched.SAB = { day: 'SAB', type: 'FOLGA_5X2', chairId: emp.defaultChairId, label: 'Folga Mensal Sáb' };
        sched.DOM = { day: 'DOM', type: 'FOLGA_DSR', chairId: emp.defaultChairId, label: 'DSR' };
        (['SEG', 'TER', 'QUA', 'QUI', 'SEX'] as const).forEach((d) => {
          sched[d] = {
            day: d,
            type: 'TRABALHO',
            chairId: emp.defaultChairId,
            startTime: '08:00',
            lunchStart: emp.defaultLunchStart || '12:00',
            lunchEnd: emp.defaultLunchEnd || '13:30',
            endTime: '17:30',
            label: '08:00–17:30',
          };
        });
      } else {
        // Trabalha no sábado (08h às 13h = 5h) e folga em um dia útil (ex: Terça para Jair/Diana, Quarta para Marcos Ant, etc.)
        const weekdayOff: DayOfWeek = emp.department === 'SDR' ? 'TER' : emp.id === 'emp-marcos-antonio' ? 'QUA' : 'SEG';
        sched[weekdayOff] = { day: weekdayOff, type: 'FOLGA_5X2', chairId: emp.defaultChairId, label: 'Folga 5x2' };
        sched.SAB = {
          day: 'SAB',
          type: 'TRABALHO',
          chairId: emp.defaultChairId,
          startTime: '08:00',
          endTime: '13:00',
          label: '08:00–13:00 (5h)',
        };
      }
      weeksSchedule[w] = sched;
    }

    return {
      ...emp,
      saturdayOffWeek: assignedSatWeek,
      weeksSchedule,
    };
  });
}

const STAGGERED_OFF_DEFAULTS: Record<
  string,
  { satOff: number; weekdayOff: DayOfWeek }
> = {
  'emp-winona': { satOff: 1, weekdayOff: 'TER' },
  'emp-andria': { satOff: 2, weekdayOff: 'QUA' },
  'emp-diana': { satOff: 3, weekdayOff: 'TER' },
  'emp-adriane': { satOff: 4, weekdayOff: 'QUA' },
  'emp-jair': { satOff: 1, weekdayOff: 'TER' },
  'emp-joao-alexandre': { satOff: 1, weekdayOff: 'SEG' },
  'emp-marcos-antonio': { satOff: 2, weekdayOff: 'QUA' },
  'emp-rayssa': { satOff: 3, weekdayOff: 'TER' },
  'emp-rosinaldo': { satOff: 4, weekdayOff: 'QUI' },
  'emp-allisson': { satOff: 1, weekdayOff: 'TER' },
  'emp-rodolfo': { satOff: 2, weekdayOff: 'SEG' },
  'emp-marcos-florentino': { satOff: 3, weekdayOff: 'QUA' },
  'emp-alefy': { satOff: 4, weekdayOff: 'TER' },
  'emp-nailson': { satOff: 1, weekdayOff: 'QUA' },
  'emp-marielly': { satOff: 1, weekdayOff: 'TER' },
  'emp-mayana': { satOff: 2, weekdayOff: 'QUA' },
  'emp-jorge': { satOff: 3, weekdayOff: 'SEG' },
  'emp-joao-pedro': { satOff: 2, weekdayOff: 'SEG' },
};

/**
 * Garante que o colaborador tenha as 4 semanas inicializadas e sincronizadas,
 * distribuindo folgas de sábado e dias úteis entre colegas da mesma função.
 */
export function ensureEmployeeWeeksSchedule(emp: Employee): Employee {
  const defaults = STAGGERED_OFF_DEFAULTS[emp.id];
  const satOff = emp.saturdayOffWeek || defaults?.satOff || 1;
  const fallbackWeekdayOff: DayOfWeek =
    defaults?.weekdayOff ||
    (emp.department === 'SDR' ? 'TER' : emp.id === 'emp-marcos-antonio' ? 'QUA' : 'SEG');

  const existingWeeks: Record<number, Record<DayOfWeek, DayShift>> = emp.weeksSchedule
    ? JSON.parse(JSON.stringify(emp.weeksSchedule))
    : {};

  for (let w = 1; w <= 4; w++) {
    if (!existingWeeks[w]) {
      const baseSched = JSON.parse(JSON.stringify(emp.schedule)) as Record<DayOfWeek, DayShift>;
      if (
        emp.contractType !== 'LICENCA_MATERNIDADE' &&
        emp.contractType !== 'ESTAGIARIO' &&
        !emp.isCirculating
      ) {
        if (w === satOff) {
          // Folga no sábado desta semana (cumpre 40h de Seg a Sex com 1h30 de almoço)
          baseSched.SAB = { day: 'SAB', type: 'FOLGA_5X2', chairId: emp.defaultChairId, label: 'Folga Mensal Sáb' };
          baseSched.DOM = { day: 'DOM', type: 'FOLGA_DSR', chairId: emp.defaultChairId, label: 'DSR' };
          (['SEG', 'TER', 'QUA', 'QUI', 'SEX'] as const).forEach((d) => {
            baseSched[d] = {
              day: d,
              type: 'TRABALHO',
              chairId: emp.defaultChairId,
              startTime: '08:00',
              lunchStart: emp.defaultLunchStart || '12:00',
              lunchEnd: emp.defaultLunchEnd || '13:30',
              endTime: '17:30',
              label: '08:00–17:30',
            };
          });
        } else {
          // Semanas que trabalha no sábado
          if (baseSched.SAB?.type !== 'TRABALHO') {
            baseSched[fallbackWeekdayOff] = {
              day: fallbackWeekdayOff,
              type: 'FOLGA_5X2',
              chairId: emp.defaultChairId,
              label: 'Folga 5x2',
            };
            baseSched.SAB = {
              day: 'SAB',
              type: 'TRABALHO',
              chairId: emp.defaultChairId,
              startTime: '08:00',
              endTime: '13:00',
              label: '08:00–13:00 (5h)',
            };
          }
        }
      }
      existingWeeks[w] = baseSched;
    }
  }

  return {
    ...emp,
    saturdayOffWeek: satOff,
    weeksSchedule: existingWeeks,
  };
}

/**
 * Atualiza um turno exclusivamente na semana especificada (sem interferir nas outras 3 semanas).
 */
export function updateEmployeeShiftAcrossWeeks(
  employee: Employee,
  weekNumber: number,
  day: DayOfWeek,
  newShift: Partial<DayShift>
): Employee {
  const preparedEmp = ensureEmployeeWeeksSchedule(employee);
  const weeks = JSON.parse(JSON.stringify(preparedEmp.weeksSchedule!)) as Record<
    number,
    Record<DayOfWeek, DayShift>
  >;
  const targetWeek = weeks[weekNumber]
    ? { ...weeks[weekNumber] }
    : (JSON.parse(JSON.stringify(preparedEmp.schedule)) as Record<DayOfWeek, DayShift>);

  const currentShift = targetWeek[day] || { day, type: 'FOLGA_5X2', chairId: employee.defaultChairId };
  let updatedShift: DayShift = {
    ...currentShift,
    ...newShift,
    day,
  };

  if (
    updatedShift.type === 'TRABALHO' &&
    preparedEmp.contractType !== 'ESTAGIARIO' &&
    preparedEmp.contractType !== 'LICENCA_MATERNIDADE' &&
    updatedShift.startTime &&
    updatedShift.endTime
  ) {
    const grossMin = getGrossShiftMinutes(updatedShift.startTime, updatedShift.endTime);
    const lunchExplicitlyProvided = 'lunchStart' in newShift || 'lunchEnd' in newShift;
    if (grossMin > 360) {
      if (!lunchExplicitlyProvided && (!updatedShift.lunchStart || !updatedShift.lunchEnd)) {
        const resolved = resolveLunchWindowForShift(
          preparedEmp,
          updatedShift.startTime,
          updatedShift.endTime
        );
        updatedShift = {
          ...updatedShift,
          lunchStart: resolved.lunchStart,
          lunchEnd: resolved.lunchEnd,
        };
      }
    } else if (day === 'SAB' && !lunchExplicitlyProvided) {
      updatedShift = {
        ...updatedShift,
        lunchStart: undefined,
        lunchEnd: undefined,
      };
    }
  }

  targetWeek[day] = updatedShift;
  weeks[weekNumber] = targetWeek;

  return {
    ...preparedEmp,
    schedule: weekNumber === 1 ? targetWeek : preparedEmp.schedule,
    weeksSchedule: weeks,
  };
}

/**
 * Substitui integralmente a grade de UMA semana específica do colaborador,
 * preservando intactas todas as demais semanas do ciclo mensal.
 */
export function replaceEmployeeWeekSchedule(
  employee: Employee,
  weekNumber: number,
  newWeekSchedule: Record<DayOfWeek, DayShift>
): Employee {
  const preparedEmp = ensureEmployeeWeeksSchedule(employee);
  const weeks = JSON.parse(JSON.stringify(preparedEmp.weeksSchedule!)) as Record<
    number,
    Record<DayOfWeek, DayShift>
  >;
  const clonedWeek = JSON.parse(JSON.stringify(newWeekSchedule)) as Record<DayOfWeek, DayShift>;
  weeks[weekNumber] = clonedWeek;

  return {
    ...preparedEmp,
    schedule: weekNumber === 1 ? clonedWeek : weeks[1],
    weeksSchedule: weeks,
  };
}

/**
 * Atualiza o sábado de folga mensal (1 a 4) e sincroniza todas as semanas do ciclo
 */
export function setEmployeeMonthlySaturdayOff(
  employee: Employee,
  newSatOffWeek: number
): Employee {
  const prepared = ensureEmployeeWeeksSchedule(employee);
  const weeks: Record<number, Record<DayOfWeek, DayShift>> = JSON.parse(
    JSON.stringify(prepared.weeksSchedule!)
  );

  for (let w = 1; w <= 4; w++) {
    const sched = weeks[w] || JSON.parse(JSON.stringify(prepared.schedule));
    if (w === newSatOffWeek) {
      // Esta semana agora tem sábado de folga!
      sched.SAB = { day: 'SAB', type: 'FOLGA_5X2', chairId: employee.defaultChairId, label: 'Folga Mensal Sáb' };
      sched.DOM = { day: 'DOM', type: 'FOLGA_DSR', chairId: employee.defaultChairId, label: 'DSR' };
      // De segunda a sexta trabalha (8h x 5 = 40h)
      (['SEG', 'TER', 'QUA', 'QUI', 'SEX'] as const).forEach((d) => {
        if (sched[d].type !== 'TRABALHO') {
          sched[d] = {
            day: d,
            type: 'TRABALHO',
            chairId: employee.defaultChairId,
            startTime: '08:00',
            lunchStart: employee.defaultLunchStart || '12:00',
            lunchEnd: employee.defaultLunchEnd || '13:30',
            endTime: '17:30',
            label: '08:00–17:30',
          };
        }
      });
    } else {
      // As outras 3 semanas trabalham no sábado
      const weekdayOff: DayOfWeek = employee.department === 'SDR' ? 'TER' : employee.id === 'emp-marcos-antonio' ? 'QUA' : 'SEG';
      sched[weekdayOff] = { day: weekdayOff, type: 'FOLGA_5X2', chairId: employee.defaultChairId, label: 'Folga 5x2' };
      sched.SAB = {
        day: 'SAB',
        type: 'TRABALHO',
        chairId: employee.defaultChairId,
        startTime: '08:00',
        endTime: '13:00',
        label: '08:00–13:00 (5h)',
      };
    }
    weeks[w] = sched;
  }

  return {
    ...prepared,
    saturdayOffWeek: newSatOffWeek,
    weeksSchedule: weeks,
    schedule: weeks[1],
  };
}

/**
 * Validação de Afinidades e Regras Operacionais Específicas
 */
export function checkTeamOperationalAndAffinities(
  employees: Employee[],
  storeHours?: StoreHoursMap
): ComplianceViolation[] {
  const alerts: ComplianceViolation[] = [];
  const empMap = new Map(employees.map((e) => [e.id, e]));

  // 1. Afinidade Casal: João Alexandre (Vendas) + Winona (SDR)
  const joaoAlex = empMap.get('emp-joao-alexandre');
  const winona = empMap.get('emp-winona');
  if (joaoAlex && winona) {
    const joaoSatOff = joaoAlex.schedule.SAB?.type !== 'TRABALHO';
    const winonaSatOff = winona.schedule.SAB?.type !== 'TRABALHO';
    if (joaoSatOff !== winonaSatOff) {
      alerts.push({
        code: 'AFFINITY_MISMATCH',
        severity: 'INFO',
        category: 'AFFINITY',
        message: `Afinidade Casal (João Alexandre e Winona): Um está escalado no sábado e o outro está de folga. Recomenda-se alinhar as folgas quando possível.`,
        daysInvolved: ['SAB'],
      });
    }
  }

  // 2. Afinidade Colegas: Andria (SDR) + João Pedro (Financeiro)
  const andria = empMap.get('emp-andria');
  const jp = empMap.get('emp-joao-pedro');
  if (andria && jp) {
    const andriaSatOff = andria.schedule.SAB?.type !== 'TRABALHO';
    const jpSatOff = jp.schedule.SAB?.type !== 'TRABALHO';
    if (andriaSatOff !== jpSatOff) {
      alerts.push({
        code: 'AFFINITY_MISMATCH',
        severity: 'INFO',
        category: 'AFFINITY',
        message: `Afinidade Operacional (Andria e João Pedro): Folgas em dias diferentes no fim de semana.`,
        daysInvolved: ['SAB'],
      });
    }
  }

  // 3. Dias Críticos:
  if (andria && andria.schedule.SEG?.type !== 'TRABALHO') {
    alerts.push({
      code: 'CRITICAL_DAY_ABSENCE',
      severity: 'WARNING',
      category: 'OPERATIONAL',
      message: `Atenção Crítica: Andria Helen ausente na Segunda-feira (dia com maior acúmulo de leads de fim de semana para SDR).`,
      daysInvolved: ['SEG'],
    });
  }

  if (jp && jp.schedule.SEX?.type !== 'TRABALHO') {
    alerts.push({
      code: 'CRITICAL_DAY_ABSENCE',
      severity: 'WARNING',
      category: 'OPERATIONAL',
      message: `Atenção Crítica: João Pedro ausente na Sexta-feira (dia com maior concentração de pagamentos de veículos).`,
      daysInvolved: ['SEX'],
    });
  }

  // 4. Cobertura de Abertura e Fechamento da Preparação & Zeladoria na Loja 1 (respeitando horário da Loja 1)
  const loja1Open = storeHours?.LOJA_1?.weekdayOpen || DEFAULT_STORE_HOURS.LOJA_1.weekdayOpen;
  const loja1Close = storeHours?.LOJA_1?.weekdayClose || DEFAULT_STORE_HOURS.LOJA_1.weekdayClose;
  const loja1OpenMin = parseTimeToMinutes(loja1Open);
  const loja1CloseMin = parseTimeToMinutes(loja1Close);

  const prepTeam = [
    empMap.get('emp-marcos-florentino'),
    empMap.get('emp-alefy'),
    empMap.get('emp-rodolfo'),
    empMap.get('emp-allisson'),
  ].filter(Boolean) as Employee[];

  const weekdays: DayOfWeek[] = ['SEG', 'TER', 'QUA', 'QUI', 'SEX'];
  for (const day of weekdays) {
    const openWorkers = prepTeam.filter((e) => {
      const s = e.schedule[day];
      return s?.type === 'TRABALHO' && s.startTime && parseTimeToMinutes(s.startTime) <= loja1OpenMin;
    });
    const closeWorkers = prepTeam.filter((e) => {
      const s = e.schedule[day];
      return s?.type === 'TRABALHO' && s.endTime && parseTimeToMinutes(s.endTime) >= loja1CloseMin;
    });

    if (openWorkers.length === 0) {
      alerts.push({
        code: 'CRITICAL_DAY_ABSENCE',
        severity: 'WARNING',
        category: 'OPERATIONAL',
        message: `Falta de cobertura de abertura (${loja1Open}) na Preparação/Zeladoria da Loja 1 na ${day}.`,
        daysInvolved: [day],
      });
    }
    if (closeWorkers.length === 0) {
      alerts.push({
        code: 'CRITICAL_DAY_ABSENCE',
        severity: 'WARNING',
        category: 'OPERATIONAL',
        message: `Falta de cobertura de fechamento (${loja1Close}) na Preparação/Zeladoria da Loja 1 na ${day}.`,
        daysInvolved: [day],
      });
    }
  }

  // 5. Proibição de Folga em Paralelo (Seg–Sáb)
  const monToSat: DayOfWeek[] = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'];
  const checkedPairs = new Set<string>();

  for (const a of employees) {
    if (!a.noParallelFolgaIds?.length || a.contractType === 'LICENCA_MATERNIDADE') continue;
    for (const partnerId of a.noParallelFolgaIds) {
      const b = empMap.get(partnerId);
      if (!b || b.id === a.id || b.contractType === 'LICENCA_MATERNIDADE') continue;

      const pairKey = a.id < b.id ? `${a.id}::${b.id}` : `${b.id}::${a.id}`;
      if (checkedPairs.has(pairKey)) continue;
      checkedPairs.add(pairKey);

      for (const day of monToSat) {
        const aOff = a.schedule[day] && a.schedule[day].type !== 'TRABALHO';
        const bOff = b.schedule[day] && b.schedule[day].type !== 'TRABALHO';
        if (aOff && bOff) {
          alerts.push({
            code: 'PARALLEL_FOLGA_CONFLICT',
            severity: 'WARNING',
            category: 'OPERATIONAL',
            message: `Conflito de Folga em Paralelo (${a.shortName} e ${b.shortName}): Ambos estão de folga em ${day}.`,
            daysInvolved: [day],
          });
        }
      }
    }
  }

  return alerts;
}

/**
 * Avalia alertas operacionais e de afinidade em todas as 4 semanas (S1..S4),
 * consolidando mensagens iguais para exibir em quais semanas ocorrem.
 */
export function checkMonthlyTeamOperationalAndAffinities(
  employees: Employee[],
  storeHours?: StoreHoursMap
): ComplianceViolation[] {
  const preparedTeam = employees.map(ensureEmployeeWeeksSchedule);
  const grouped = new Map<string, { alert: ComplianceViolation; weeks: number[] }>();

  for (let w = 1; w <= 4; w++) {
    const weekTeam = preparedTeam.map((emp) => ({
      ...emp,
      schedule: emp.weeksSchedule?.[w] || emp.schedule,
    }));
    const weekAlerts = checkTeamOperationalAndAffinities(weekTeam, storeHours);
    weekAlerts.forEach((alt) => {
      const key = `${alt.code}::${alt.message}`;
      const existing = grouped.get(key);
      if (existing) {
        existing.weeks.push(w);
      } else {
        grouped.set(key, { alert: alt, weeks: [w] });
      }
    });
  }

  return Array.from(grouped.values()).map(({ alert, weeks }) => {
    const weekTag = weeks.length === 4 ? '[S1–S4]' : `[${weeks.map((w) => `S${w}`).join(', ')}]`;
    return {
      ...alert,
      message: `${weekTag} ${alert.message}`,
    };
  });
}

/**
 * Cobertura horária para o Termômetro
 */
export function calculateStoreCoverage(
  employees: Employee[],
  selectedDay: DayOfWeek
): StoreHourCoverage[] {
  const timeSlots: number[] = [];
  for (let m = 450; m <= 1110; m += 30) {
    timeSlots.push(m);
  }

  return timeSlots.map((slotMin) => {
    const hourStr = minutesToTimeString(slotMin);
    const byDeptL1: Record<DepartmentId, number> = {
      SDR: 0,
      VENDAS: 0,
      PREPARACAO: 0,
      DOCUMENTACAO: 0,
      FINANCEIRO: 0,
      SUCESSO_CLIENTE: 0,
      MARKETING: 0,
      GESTAO: 0,
    };
    const byDeptL2: Record<DepartmentId, number> = {
      SDR: 0,
      VENDAS: 0,
      PREPARACAO: 0,
      DOCUMENTACAO: 0,
      FINANCEIRO: 0,
      SUCESSO_CLIENTE: 0,
      MARKETING: 0,
      GESTAO: 0,
    };

    let totalLoja1 = 0;
    let totalLoja2 = 0;

    employees.forEach((emp) => {
      if (emp.contractType === 'LICENCA_MATERNIDADE' || emp.isCirculating) return;
      const shift = emp.schedule[selectedDay];
      if (!shift || shift.type !== 'TRABALHO' || !shift.startTime || !shift.endTime) return;

      const start = parseTimeToMinutes(shift.startTime);
      const end = parseTimeToMinutes(shift.endTime);

      if (slotMin >= start && slotMin < end) {
        let inLunch = false;
        if (shift.lunchStart && shift.lunchEnd) {
          const lStart = parseTimeToMinutes(shift.lunchStart);
          const lEnd = parseTimeToMinutes(shift.lunchEnd);
          if (slotMin >= lStart && slotMin < lEnd) {
            inLunch = true;
          }
        }

        if (!inLunch) {
          const isLoja2 =
            shift.chairId === 'VEND-L2-EXT' ||
            shift.chairId === 'DOC-SUP' ||
            shift.chairId === 'DOC-AUX' ||
            shift.chairId === 'DOC-EST' ||
            shift.chairId === 'SC-1' ||
            shift.chairId === 'FIN-1' ||
            emp.defaultStore === 'LOJA_2';

          if (isLoja2) {
            totalLoja2++;
            byDeptL2[emp.department] = (byDeptL2[emp.department] || 0) + 1;
          } else {
            totalLoja1++;
            byDeptL1[emp.department] = (byDeptL1[emp.department] || 0) + 1;
          }
        }
      }
    });

    return {
      hourStr,
      totalLoja1,
      totalLoja2,
      byDepartmentLoja1: byDeptL1,
      byDepartmentLoja2: byDeptL2,
      isOpeningWindow: slotMin === 480,
      isLunchWindow: slotMin >= 690 && slotMin <= 870,
      isClosingWindow: slotMin === 1050,
    };
  });
}

/**
 * Sugestão de Redistribuição 5x2 SEM VIOLAÇÃO
 * - 08:00 às 17:30 com 1h30 de almoço = exatamente 8h00 / dia = 40h semanais.
 * - Totalmente em conformidade com Fase 1 (42h) e Fase 2 (40h), gerando ZERO violações!
 */
export function suggest5x2Redistribution(
  employee: Employee,
  phase: LegalPhase,
  strategy: 'COMMERCIAL_5X2' | 'WEEKEND_ROTATION' = 'COMMERCIAL_5X2',
  rotationPattern: number = 0
): Record<DayOfWeek, DayShift> {
  const chairId = employee.defaultChairId || 'SDR-1';

  // 08:00 às 17:30 com 1h30 de almoço (12:00 às 13:30) = exatamente 8h00 / dia
  const workShift: DayShift = {
    day: 'SEG',
    type: 'TRABALHO',
    chairId,
    startTime: '08:00',
    lunchStart: employee.defaultLunchStart || '12:00',
    lunchEnd: employee.defaultLunchEnd || '13:30',
    endTime: '17:30',
    label: '08:00–17:30 (8h)',
  };

  const newSchedule: Record<DayOfWeek, DayShift> = {
    SEG: { ...workShift, day: 'SEG' },
    TER: { ...workShift, day: 'TER' },
    QUA: { ...workShift, day: 'QUA' },
    QUI: { ...workShift, day: 'QUI' },
    SEX: { ...workShift, day: 'SEX' },
    SAB: { day: 'SAB', type: 'FOLGA_5X2', chairId, label: 'Folga 5x2' },
    DOM: { day: 'DOM', type: 'FOLGA_DSR', chairId, label: 'Folga DSR' },
  };

  if (strategy === 'WEEKEND_ROTATION') {
    const pattern = Math.abs(rotationPattern) % 2;
    if (pattern === 1) {
      // Trabalha Terça a Sábado (Folga Segunda e Domingo)
      // 4 dias úteis de 8h (32h) + Sábado 08h-13h (5h) = 37h semanais (SEM VIOLAÇÃO!)
      newSchedule.SEG = { day: 'SEG', type: 'FOLGA_5X2', chairId, label: 'Folga 5x2' };
      newSchedule.TER = { ...workShift, day: 'TER' };
      newSchedule.QUA = { ...workShift, day: 'QUA' };
      newSchedule.QUI = { ...workShift, day: 'QUI' };
      newSchedule.SEX = { ...workShift, day: 'SEX' };
      newSchedule.SAB = {
        day: 'SAB',
        type: 'TRABALHO',
        chairId,
        startTime: '08:00',
        endTime: '13:00',
        label: '08:00–13:00 (5h)',
      };
      newSchedule.DOM = { day: 'DOM', type: 'FOLGA_DSR', chairId, label: 'Folga DSR' };
    }
  }

  return newSchedule;
}

export function createTraditional6x1Schedule(chairId: string = 'VEND-L1-1'): Record<DayOfWeek, DayShift> {
  const stdWork: DayShift = {
    day: 'SEG',
    type: 'TRABALHO',
    chairId,
    startTime: '08:00',
    lunchStart: '12:00',
    lunchEnd: '13:00',
    endTime: '17:00',
    label: '08:00 - 17:00',
  };

  return {
    SEG: { ...stdWork, day: 'SEG' },
    TER: { ...stdWork, day: 'TER' },
    QUA: { ...stdWork, day: 'QUA' },
    QUI: { ...stdWork, day: 'QUI' },
    SEX: { ...stdWork, day: 'SEX' },
    SAB: {
      day: 'SAB',
      type: 'TRABALHO',
      chairId,
      startTime: '08:00',
      endTime: '12:00',
      label: '08:00 - 12:00 (4h)',
    },
    DOM: {
      day: 'DOM',
      type: 'FOLGA_DSR',
      chairId,
      label: 'Folga DSR',
    },
  };
}

/**
 * Ajusta uma grade semanal específica para tentar atingir uma meta de horas,
 * distribuindo os minutos (incluindo resto exato) preferencialmente nos dias úteis (Seg-Sex)
 * e respeitando os limites legais (10h/dia CLT Art. 59 ou 6h/dia Estágio, e almoço mín 1h Art. 71).
 */
export function balanceScheduleToTarget(
  scheduleInput: Record<DayOfWeek, DayShift>,
  targetWeeklyHours: number,
  strategy: 'AUTO' | 'EXTEND_EXIT' | 'REDUCE_LUNCH' = 'AUTO',
  isIntern: boolean = false
): Record<DayOfWeek, DayShift> {
  const sched = JSON.parse(JSON.stringify(scheduleInput)) as Record<DayOfWeek, DayShift>;
  const weekdayWorkDays = (['SEG', 'TER', 'QUA', 'QUI', 'SEX'] as DayOfWeek[]).filter(
    (d) => sched[d]?.type === 'TRABALHO' && sched[d].startTime && sched[d].endTime
  );
  const allWorkDays = (['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'] as DayOfWeek[]).filter(
    (d) => sched[d]?.type === 'TRABALHO' && sched[d].startTime && sched[d].endTime
  );

  // Mantém o sábado fixo (08h-13h) sempre que houver dias úteis para compensar
  const targetDays = weekdayWorkDays.length > 0 ? weekdayWorkDays : allWorkDays;
  if (targetDays.length === 0) return sched;

  let currentHours = 0;
  allWorkDays.forEach((d) => {
    currentHours += calculateDailyHours(sched[d]);
  });

  const diffHours = targetWeeklyHours - currentHours;
  if (Math.abs(diffHours) < 0.08) return sched;

  let remainingMinutes = Math.round(diffHours * 60);
  const maxDailyNet = isIntern ? 360 : 600; // 6h estágio ou 10h CLT Art. 59
  const minDailyNet = 60; // mínimo 1h por turno ativo

  const formatMin = (m: number) => {
    const clamped = Math.max(0, Math.min(1439, m));
    const hh = Math.floor(clamped / 60).toString().padStart(2, '0');
    const mm = (clamped % 60).toString().padStart(2, '0');
    return `${hh}:${mm}`;
  };

  const applyMinutesToDayList = (days: DayOfWeek[], minsToDistribute: number): number => {
    if (days.length === 0 || minsToDistribute === 0) return minsToDistribute;

    const basePerDay = Math.trunc(minsToDistribute / days.length);
    const remainder = minsToDistribute - basePerDay * days.length;
    let unapplied = 0;

    days.forEach((d, idx) => {
      const extraOne = remainder > 0 && idx < remainder ? 1 : remainder < 0 && idx < Math.abs(remainder) ? -1 : 0;
      const desiredDelta = basePerDay + extraOne;
      if (desiredDelta === 0) return;

      const shift = sched[d];
      const startMin = parseTimeToMinutes(shift.startTime!);
      let endMin = parseTimeToMinutes(shift.endTime!);
      let lStart = shift.lunchStart ? parseTimeToMinutes(shift.lunchStart) : undefined;
      let lEnd = shift.lunchEnd ? parseTimeToMinutes(shift.lunchEnd) : undefined;
      const lunchMin = lStart !== undefined && lEnd !== undefined ? Math.max(0, lEnd - lStart) : 0;
      const currentNet = Math.max(0, endMin - startMin - lunchMin);

      if (desiredDelta > 0) {
        const capacity = Math.max(0, maxDailyNet - currentNet);
        const applied = Math.min(desiredDelta, capacity);
        unapplied += desiredDelta - applied;

        if (applied > 0) {
          if (strategy === 'REDUCE_LUNCH' && lStart !== undefined && lEnd !== undefined) {
            const reducibleLunch = Math.max(0, lEnd - lStart - 60);
            const lunchReduction = Math.min(reducibleLunch, applied);
            if (lunchReduction > 0) {
              lEnd -= lunchReduction;
            }
            const remainingAdd = applied - lunchReduction;
            if (remainingAdd > 0) {
              endMin += remainingAdd;
            }
          } else {
            endMin += applied;
          }
        }
      } else {
        const reducible = Math.max(0, currentNet - minDailyNet);
        const reduction = Math.min(Math.abs(desiredDelta), reducible);
        unapplied -= Math.abs(desiredDelta) - reduction;
        endMin -= reduction;
      }

      // Mesmo no sábado, se o turno ultrapassar 6h (360 min), inclui intervalo de almoço
      if (!isIntern && d === 'SAB') {
        const grossAfter = endMin - startMin;
        if (grossAfter > 360 && (lStart === undefined || lEnd === undefined)) {
          const lunchDur = 60;
          lStart = Math.max(startMin + 60, Math.min(720, endMin - 30));
          lEnd = lStart + lunchDur;
          endMin += lunchDur;
        } else if (grossAfter <= 360) {
          lStart = undefined;
          lEnd = undefined;
        }
      }

      shift.endTime = formatMin(endMin);
      if (lStart !== undefined && lEnd !== undefined) {
        shift.lunchStart = formatMin(lStart);
        shift.lunchEnd = formatMin(lEnd);
      } else if (d === 'SAB') {
        shift.lunchStart = undefined;
        shift.lunchEnd = undefined;
      }
      shift.label = `${shift.startTime}–${shift.endTime}`;
    });

    return unapplied;
  };

  remainingMinutes = applyMinutesToDayList(targetDays, remainingMinutes);

  // Se dias úteis bateram o teto de 10h/dia e ainda faltam minutos, distribui no sábado caso exista
  if (Math.abs(remainingMinutes) >= 5 && allWorkDays.length > targetDays.length) {
    const extraDays = allWorkDays.filter((d) => !targetDays.includes(d));
    applyMinutesToDayList(extraDays, remainingMinutes);
  }

  return sched;
}

/**
 * Equilíbrio de horas faltantes na semana (quando alguém folga no sábado ou tem déficit de horas).
 * Distribui a carga faltante pelos dias úteis ativos de forma proporcional e legal (máx 10h/dia CLT Art. 59).
 */
export function balanceEmployeeHours(
  employee: Employee,
  targetWeeklyHours: number = 40.0,
  strategy: 'AUTO' | 'EXTEND_EXIT' | 'REDUCE_LUNCH' = 'AUTO'
): Employee {
  if (employee.contractType === 'LICENCA_MATERNIDADE') return employee;

  const newSchedule = balanceScheduleToTarget(
    employee.schedule,
    targetWeeklyHours,
    strategy,
    employee.contractType === 'ESTAGIARIO'
  );

  return {
    ...employee,
    schedule: newSchedule,
  };
}

/**
 * Ajusta SOMENTE a semana ativa para que a soma das 4 semanas feche a meta mensal
 * (S1 + S2 + S3 + S4 = Meta Mensal), sem interferir nas outras 3 semanas.
 */
export function balanceActiveWeekForMonthlyTarget(
  employee: Employee,
  activeWeekIndex: number,
  phase: LegalPhase,
  strategy: 'AUTO' | 'EXTEND_EXIT' | 'REDUCE_LUNCH' = 'AUTO'
): Employee {
  if (employee.contractType === 'LICENCA_MATERNIDADE' || employee.isCirculating) {
    return employee;
  }

  const prepared = ensureEmployeeWeeksSchedule(employee);
  const weeks = prepared.weeksSchedule!;
  const monthlyTarget = getEmployeeMonthlyTargetHours(prepared, phase);

  let otherWeeksTotal = 0;
  for (let w = 1; w <= 4; w++) {
    if (w !== activeWeekIndex && weeks[w]) {
      otherWeeksTotal += calculateWeeklyHours(weeks[w]);
    }
  }

  const desiredActiveTarget = Math.max(0, Number((monthlyTarget - otherWeeksTotal).toFixed(2)));
  const activeSched = weeks[activeWeekIndex] || prepared.schedule;
  const balancedWeek = balanceScheduleToTarget(
    activeSched,
    desiredActiveTarget,
    strategy,
    prepared.contractType === 'ESTAGIARIO'
  );

  return replaceEmployeeWeekSchedule(prepared, activeWeekIndex, balancedWeek);
}

/**
 * Ajusta todas as 4 semanas para que a soma mensal feche exatamente a meta do mês
 * (ex: 168h na Fase 1 ou 160h na Fase 2), preservando as folgas de cada semana.
 * Primeiro nivela cada semana em direção ao teto semanal da fase, evitando gerar
 * horas extras desnecessárias em semanas que já estavam fechadas.
 */
export function balanceAllWeeksToMonthlyTarget(
  employee: Employee,
  phase: LegalPhase,
  strategy: 'AUTO' | 'EXTEND_EXIT' | 'REDUCE_LUNCH' = 'AUTO'
): Employee {
  if (employee.contractType === 'LICENCA_MATERNIDADE' || employee.isCirculating) {
    return employee;
  }

  const prepared = ensureEmployeeWeeksSchedule(employee);
  const weeks = JSON.parse(JSON.stringify(prepared.weeksSchedule!)) as Record<
    number,
    Record<DayOfWeek, DayShift>
  >;

  const isIntern = prepared.contractType === 'ESTAGIARIO';
  const weeklyTarget = isIntern ? 24 : LEGAL_PHASES[phase].maxWeeklyHours;
  const monthlyTarget = getEmployeeMonthlyTargetHours(prepared, phase);

  let currentMonthlyTotal = 0;
  for (let w = 1; w <= 4; w++) {
    currentMonthlyTotal += calculateWeeklyHours(weeks[w]);
  }

  let remainingMinutes = Math.round((monthlyTarget - currentMonthlyTotal) * 60);
  if (Math.abs(remainingMinutes) < 5) return prepared;

  // Passo 1: Se faltam horas no mês, preenche primeiro semanas abaixo da meta semanal;
  // se sobram horas no mês, reduz primeiro semanas acima da meta semanal.
  if (remainingMinutes > 0) {
    const deficits = [1, 2, 3, 4].map((w) => {
      const h = calculateWeeklyHours(weeks[w]);
      return { w, h, deficitMin: Math.max(0, Math.round((weeklyTarget - h) * 60)) };
    });
    const totalDeficitMin = deficits.reduce((acc, d) => acc + d.deficitMin, 0);
    const initialToFill = Math.min(remainingMinutes, totalDeficitMin);

    if (totalDeficitMin > 0 && initialToFill > 0) {
      for (const item of deficits) {
        if (item.deficitMin <= 0 || remainingMinutes <= 0) continue;
        const allocMin = Math.min(
          remainingMinutes,
          Math.round((item.deficitMin / totalDeficitMin) * initialToFill)
        );
        if (allocMin <= 0) continue;
        const targetW = Number((item.h + allocMin / 60).toFixed(2));
        weeks[item.w] = balanceScheduleToTarget(weeks[item.w], targetW, strategy, isIntern);
        const afterH = calculateWeeklyHours(weeks[item.w]);
        remainingMinutes -= Math.round((afterH - item.h) * 60);
      }
    }
  } else {
    const surpluses = [1, 2, 3, 4].map((w) => {
      const h = calculateWeeklyHours(weeks[w]);
      return { w, h, surplusMin: Math.max(0, Math.round((h - weeklyTarget) * 60)) };
    });
    const totalSurplusMin = surpluses.reduce((acc, s) => acc + s.surplusMin, 0);
    const initialToTrim = Math.min(Math.abs(remainingMinutes), totalSurplusMin);

    if (totalSurplusMin > 0 && initialToTrim > 0) {
      for (const item of surpluses) {
        if (item.surplusMin <= 0 || remainingMinutes >= 0) continue;
        const trimMin = Math.min(
          Math.abs(remainingMinutes),
          Math.round((item.surplusMin / totalSurplusMin) * initialToTrim)
        );
        if (trimMin <= 0) continue;
        const targetW = Number(Math.max(0, item.h - trimMin / 60).toFixed(2));
        weeks[item.w] = balanceScheduleToTarget(weeks[item.w], targetW, strategy, isIntern);
        const afterH = calculateWeeklyHours(weeks[item.w]);
        remainingMinutes -= Math.round((afterH - item.h) * 60);
      }
    }
  }

  // Passo 2: Caso ainda reste diferença mensal (ex: alguma semana bateu teto de 10h/dia CLT ou tem mais folgas),
  // distribui o saldo acumulado igualmente pelas demais semanas disponíveis com capacidade.
  if (Math.abs(remainingMinutes) >= 5) {
    for (let pass = 0; pass < 2 && Math.abs(remainingMinutes) >= 5; pass++) {
      const share = Math.trunc(remainingMinutes / 4);
      const fallbackTargets = [1, 2, 3, 4];
      for (const w of fallbackTargets) {
        if (Math.abs(remainingMinutes) < 5) break;
        const stepMin = pass === 0 && Math.abs(share) >= 5 ? share : remainingMinutes;
        const beforeH = calculateWeeklyHours(weeks[w]);
        const targetW = Number(Math.max(0, beforeH + stepMin / 60).toFixed(2));
        weeks[w] = balanceScheduleToTarget(weeks[w], targetW, strategy, isIntern);
        const afterH = calculateWeeklyHours(weeks[w]);
        remainingMinutes -= Math.round((afterH - beforeH) * 60);
      }
    }
  }

  return {
    ...prepared,
    weeksSchedule: weeks,
    schedule: weeks[1],
  };
}

/**
 * Aplica horário ou escala padronizada para todo um grupo/setor com 1 clique
 */
export function applyGroupSchedule(
  employees: Employee[],
  department: DepartmentId,
  template: {
    startTime: string;
    lunchStart?: string;
    lunchEnd?: string;
    endTime: string;
    workDays: DayOfWeek[];
  }
): Employee[] {
  return employees.map((emp) => {
    if (emp.department !== department || emp.contractType === 'LICENCA_MATERNIDADE' || emp.isCirculating) {
      return emp;
    }

    const newSched: Record<DayOfWeek, DayShift> = { ...emp.schedule };
    DAYS_OF_WEEK.forEach((d) => {
      const isWork = template.workDays.includes(d.key);
      if (isWork) {
        newSched[d.key] = {
          day: d.key,
          type: 'TRABALHO',
          chairId: emp.defaultChairId,
          startTime: template.startTime,
          lunchStart: template.lunchStart,
          lunchEnd: template.lunchEnd,
          endTime: template.endTime,
          label: `${template.startTime}–${template.endTime}`,
        };
      } else {
        const offType = d.key === 'DOM' ? 'FOLGA_DSR' : 'FOLGA_5X2';
        newSched[d.key] = {
          day: d.key,
          type: offType,
          chairId: emp.defaultChairId,
          label: offType === 'FOLGA_DSR' ? 'DSR' : 'Folga 5x2',
        };
      }
    });

    return {
      ...emp,
      schedule: newSched,
    };
  });
}

/**
 * Define apenas o tempo de intervalo (almoço/descanso) para um grupo/setor,
 * preservando rigorosamente o horário de entrada, saída e folgas individuais de cada colaborador.
 */
export function applyGroupBreakInterval(
  employees: Employee[],
  department: DepartmentId,
  options: {
    storeId?: StoreId;
    mode: 'DURATION_ONLY' | 'FIXED_WINDOW' | 'NONE';
    durationMinutes?: number;
    lunchStart?: string;
    lunchEnd?: string;
    targetWeeks?: number[];
  }
): Employee[] {
  const targetWeeks =
    options.targetWeeks && options.targetWeeks.length > 0 ? options.targetWeeks : [1, 2, 3, 4];
  const durationMins = Math.max(0, Math.min(240, options.durationMinutes ?? 90));

  return employees.map((emp) => {
    if (
      emp.department !== department ||
      (options.storeId && emp.defaultStore !== options.storeId) ||
      emp.contractType === 'LICENCA_MATERNIDADE' ||
      emp.contractType === 'ESTAGIARIO' ||
      emp.isCirculating
    ) {
      return emp;
    }

    const prepared = ensureEmployeeWeeksSchedule(emp);
    const weeks = JSON.parse(JSON.stringify(prepared.weeksSchedule!)) as Record<
      number,
      Record<DayOfWeek, DayShift>
    >;

    for (const w of targetWeeks) {
      const sched = weeks[w];
      if (!sched) continue;

      DAYS_OF_WEEK.forEach((dayInfo) => {
        const d = dayInfo.key;
        const shift = sched[d];
        if (!shift || shift.type !== 'TRABALHO') return;
        // Sábado/Domingo só recebe intervalo de almoço se o expediente exceder 6h (> 360 min)
        if (dayInfo.isWeekend && getGrossShiftMinutes(shift.startTime, shift.endTime) <= 360) {
          return;
        }

        if (options.mode === 'NONE' || durationMins === 0) {
          sched[d] = {
            ...shift,
            lunchStart: undefined,
            lunchEnd: undefined,
          };
          return;
        }

        if (options.mode === 'FIXED_WINDOW') {
          const nextStart = options.lunchStart || shift.lunchStart || prepared.defaultLunchStart || '12:00';
          const nextEnd = options.lunchEnd || shift.lunchEnd || prepared.defaultLunchEnd || '13:30';
          sched[d] = {
            ...shift,
            lunchStart: nextStart,
            lunchEnd: nextEnd,
          };
          return;
        }

        // DURATION_ONLY: preserva início individual de cada colaborador/dia e ajusta apenas o fim pela duração
        const baseStart = shift.lunchStart || prepared.defaultLunchStart || '12:00';
        const computedEnd = minutesToTimeString(parseTimeToMinutes(baseStart) + durationMins);
        sched[d] = {
          ...shift,
          lunchStart: baseStart,
          lunchEnd: computedEnd,
        };
      });
    }

    const applyAllWeeks = targetWeeks.length === 4;
    let nextDefaultStart = prepared.defaultLunchStart;
    let nextDefaultEnd = prepared.defaultLunchEnd;

    if (applyAllWeeks) {
      if (options.mode === 'NONE' || durationMins === 0) {
        nextDefaultStart = undefined;
        nextDefaultEnd = undefined;
      } else if (options.mode === 'FIXED_WINDOW') {
        nextDefaultStart = options.lunchStart || nextDefaultStart || '12:00';
        nextDefaultEnd = options.lunchEnd || nextDefaultEnd || '13:30';
      } else {
        const base = nextDefaultStart || '12:00';
        nextDefaultStart = base;
        nextDefaultEnd = minutesToTimeString(parseTimeToMinutes(base) + durationMins);
      }
    }

    return {
      ...prepared,
      defaultLunchStart: nextDefaultStart,
      defaultLunchEnd: nextDefaultEnd,
      weeksSchedule: weeks,
      schedule: weeks[1] || prepared.schedule,
    };
  });
}

/**
 * Conta quantos dias de descanso (folga / DSR / licença) existem em uma semana.
 */
export function countRestDaysInWeek(schedule: Record<DayOfWeek, DayShift>): number {
  return DAYS_OF_WEEK.reduce((count, d) => {
    const s = schedule[d.key];
    return !s || s.type !== 'TRABALHO' ? count + 1 : count;
  }, 0);
}

/**
 * Garante o mínimo obrigatório de 1 folga semanal dentro de cada semana:
 * permite mover/compensar a 2ª folga em outra semana, mas bloqueia zerar folgas na semana.
 */
export function canReplaceRestDayWithWork(
  schedule: Record<DayOfWeek, DayShift>,
  targetDay: DayOfWeek,
  contractType?: Employee['contractType']
): { allowed: boolean; restDaysCount: number; reason?: string } {
  const restDaysCount = countRestDaysInWeek(schedule);
  if (contractType === 'LICENCA_MATERNIDADE') {
    return {
      allowed: false,
      restDaysCount,
      reason: 'Colaboradora em Licença-Maternidade não pode receber expediente ativo.',
    };
  }
  if (schedule[targetDay]?.type === 'TRABALHO') {
    return { allowed: true, restDaysCount };
  }
  if (restDaysCount <= 1) {
    return {
      allowed: false,
      restDaysCount,
      reason:
        'Cada semana precisa manter ao menos 1 folga semanal. Arraste a folga dentro da mesma semana para trocar o dia.',
    };
  }
  return { allowed: true, restDaysCount };
}

/**
 * Constrói um turno padrão de trabalho para o dia especificado respeitando o horário da loja e contrato.
 */
export function buildDefaultWorkShiftForDay(
  employee: Employee,
  day: DayOfWeek,
  chairId?: string,
  storeHours?: StoreHoursMap
): DayShift {
  const targetChair = chairId || employee.defaultChairId;
  const isSaturday = day === 'SAB';
  const isEstagio = employee.contractType === 'ESTAGIARIO';
  const storeCfg = storeHours?.[employee.defaultStore] || DEFAULT_STORE_HOURS[employee.defaultStore];

  if (isEstagio) {
    const startTime = isSaturday ? '08:40' : '13:00';
    const endTime = isSaturday ? '12:40' : '17:00';
    return {
      day,
      type: 'TRABALHO',
      chairId: targetChair,
      startTime,
      endTime,
      label: `${startTime}–${endTime}`,
    };
  }

  const startTime = isSaturday ? storeCfg.saturdayOpen : storeCfg.weekdayOpen;
  const endTime = isSaturday ? storeCfg.saturdayClose : storeCfg.weekdayClose;
  const grossMinutes = getGrossShiftMinutes(startTime, endTime);
  const includeLunch = !isSaturday || grossMinutes > 360;
  const resolvedLunch = includeLunch
    ? resolveLunchWindowForShift(employee, startTime, endTime)
    : null;

  return {
    day,
    type: 'TRABALHO',
    chairId: targetChair,
    startTime,
    endTime,
    lunchStart: resolvedLunch?.lunchStart,
    lunchEnd: resolvedLunch?.lunchEnd,
    label: `${startTime}–${endTime}`,
  };
}

/**
 * Verifica se há conflito com colaboradores vinculados pela proibição de folga em paralelo
 * em uma semana/dia específico (Domingo/DSR e Licença-Maternidade são ignorados).
 */
export function checkParallelFolgaConflict(
  employees: Employee[],
  employeeId: string,
  weekNumber: number,
  day: DayOfWeek
): Employee[] {
  if (day === 'DOM') return [];
  const emp = employees.find((e) => e.id === employeeId);
  if (!emp || !emp.noParallelFolgaIds?.length || emp.contractType === 'LICENCA_MATERNIDADE') {
    return [];
  }

  const empMap = new Map(employees.map((e) => [e.id, e]));
  const conflicts: Employee[] = [];

  for (const partnerId of emp.noParallelFolgaIds) {
    if (partnerId === employeeId) continue;
    const partner = empMap.get(partnerId);
    if (!partner || partner.contractType === 'LICENCA_MATERNIDADE') continue;
    const partnerShift = partner.weeksSchedule?.[weekNumber]?.[day] || partner.schedule?.[day];
    if (!partnerShift || partnerShift.type !== 'TRABALHO') {
      conflicts.push(partner);
    }
  }

  return conflicts;
}

/**
 * Move uma folga existente (dentro da mesma semana OU de uma semana para outra S1–S4)
 * ou aplica um novo objeto Folga sobre um dia trabalhado, mantendo ao menos 1 folga por semana
 * e respeitando eventuais proibições de folga em paralelo.
 */
export function moveOrApplyFolgaAcrossWeeks(
  employee: Employee,
  targetWeek: number,
  targetDay: DayOfWeek,
  options: {
    sourceWeek?: number;
    sourceDay?: DayOfWeek;
    folgaType?: 'FOLGA_5X2' | 'FOLGA_DSR';
    storeHours?: StoreHoursMap;
    allEmployees?: Employee[];
  } = {}
): { employee: Employee; changed: boolean; message?: string } {
  if (employee.contractType === 'LICENCA_MATERNIDADE') {
    return {
      employee,
      changed: false,
      message: 'Colaboradora em Licença-Maternidade não possui troca de folgas.',
    };
  }

  const prepared = ensureEmployeeWeeksSchedule(employee);
  const weeks = JSON.parse(JSON.stringify(prepared.weeksSchedule!)) as Record<
    number,
    Record<DayOfWeek, DayShift>
  >;

  const sourceWeek = options.sourceWeek ?? targetWeek;
  const { sourceDay, storeHours, allEmployees } = options;

  const targetSched = weeks[targetWeek];
  const sourceSched = weeks[sourceWeek];
  if (!targetSched || !sourceSched) {
    return { employee: prepared, changed: false };
  }

  if (sourceDay) {
    if (sourceWeek === targetWeek && sourceDay === targetDay) {
      return { employee: prepared, changed: false };
    }

    const sourceShift = sourceSched[sourceDay];
    const targetShift = targetSched[targetDay];
    if (!sourceShift || sourceShift.type === 'TRABALHO') {
      return { employee: prepared, changed: false };
    }
    if (targetShift && targetShift.type !== 'TRABALHO') {
      return {
        employee: prepared,
        changed: false,
        message: 'Este dia já está definido como Folga.',
      };
    }

    // Se estiver movendo para outra semana, garante que a semana de origem mantenha ao menos 1 folga
    if (sourceWeek !== targetWeek && countRestDaysInWeek(sourceSched) <= 1) {
      return {
        employee: prepared,
        changed: false,
        message: `A Semana ${sourceWeek} precisa manter ao menos 1 folga semanal.`,
      };
    }

    if (targetDay !== 'DOM' && allEmployees) {
      const conflicts = checkParallelFolgaConflict(allEmployees, prepared.id, targetWeek, targetDay);
      if (conflicts.length > 0) {
        return {
          employee: prepared,
          changed: false,
          message: `Bloqueado: ${conflicts.map((c) => c.shortName).join(', ')} já folga em ${targetDay} (S${targetWeek}). Proibição de folga em paralelo ativa!`,
        };
      }
    }

    const chairId = targetShift?.chairId || sourceShift.chairId || prepared.defaultChairId;
    const newFolgaType =
      targetDay === 'DOM' ? 'FOLGA_DSR' : sourceShift.type === 'FOLGA_DSR' ? 'FOLGA_5X2' : sourceShift.type;

    targetSched[targetDay] = {
      day: targetDay,
      type: newFolgaType,
      chairId,
      label: newFolgaType === 'FOLGA_DSR' ? 'DSR' : 'Folga 5x2',
    };
    sourceSched[sourceDay] = buildDefaultWorkShiftForDay(
      prepared,
      sourceDay,
      sourceShift.chairId || prepared.defaultChairId,
      storeHours
    );

    const updated: Employee = {
      ...prepared,
      weeksSchedule: weeks,
      schedule: weeks[1] || prepared.schedule,
    };

    return {
      employee: updated,
      changed: true,
      message:
        sourceWeek === targetWeek
          ? `Folga movida de ${sourceDay} para ${targetDay} na Semana ${targetWeek}.`
          : `Folga movida de S${sourceWeek} (${sourceDay}) para S${targetWeek} (${targetDay}). Saldo compensado no mês.`,
    };
  }

  // Novo objeto Folga solto sobre um dia de trabalho
  const targetShift = targetSched[targetDay];
  if (!targetShift || targetShift.type !== 'TRABALHO') {
    return {
      employee: prepared,
      changed: false,
      message: 'Este dia já está como Folga.',
    };
  }

  if (targetDay !== 'DOM' && allEmployees) {
    const conflicts = checkParallelFolgaConflict(allEmployees, prepared.id, targetWeek, targetDay);
    if (conflicts.length > 0) {
      return {
        employee: prepared,
        changed: false,
        message: `Bloqueado: ${conflicts.map((c) => c.shortName).join(', ')} já folga em ${targetDay} (S${targetWeek}). Proibição de folga em paralelo ativa!`,
      };
    }
  }

  const folgaType = options.folgaType || (targetDay === 'DOM' ? 'FOLGA_DSR' : 'FOLGA_5X2');
  targetSched[targetDay] = {
    day: targetDay,
    type: folgaType,
    chairId: targetShift.chairId || prepared.defaultChairId,
    label: folgaType === 'FOLGA_DSR' ? 'DSR' : 'Folga 5x2',
  };

  const updated: Employee = {
    ...prepared,
    weeksSchedule: weeks,
    schedule: weeks[1] || prepared.schedule,
  };
  return {
    employee: updated,
    changed: true,
    message: `Folga aplicada em ${targetDay} na Semana ${targetWeek}.`,
  };
}

/**
 * Wrapper de compatibilidade para troca na mesma semana.
 */
export function moveOrApplyFolgaInWeek(
  employee: Employee,
  weekNumber: number,
  targetDay: DayOfWeek,
  options: {
    sourceWeek?: number;
    sourceDay?: DayOfWeek;
    folgaType?: 'FOLGA_5X2' | 'FOLGA_DSR';
    storeHours?: StoreHoursMap;
    allEmployees?: Employee[];
  } = {}
): { employee: Employee; changed: boolean; message?: string } {
  return moveOrApplyFolgaAcrossWeeks(employee, weekNumber, targetDay, options);
}

/**
 * Atualiza APENAS o horário de almoço (início e fim) nos dias úteis ativos do colaborador
 * nas semanas informadas, sem alterar horários de entrada/saída nem dias de folga.
 */
export function updateEmployeeLunchHours(
  employee: Employee,
  lunchStart: string,
  lunchEnd: string,
  targetWeeks: number[] = [1, 2, 3, 4]
): Employee {
  if (employee.contractType === 'LICENCA_MATERNIDADE' || employee.contractType === 'ESTAGIARIO') {
    return employee;
  }

  const prepared = ensureEmployeeWeeksSchedule(employee);
  const weeks = JSON.parse(JSON.stringify(prepared.weeksSchedule!)) as Record<
    number,
    Record<DayOfWeek, DayShift>
  >;

  for (const w of targetWeeks) {
    const sched = weeks[w];
    if (!sched) continue;
    DAYS_OF_WEEK.forEach((dayInfo) => {
      const d = dayInfo.key;
      const shift = sched[d];
      if (!shift || shift.type !== 'TRABALHO') return;
      if (dayInfo.isWeekend && getGrossShiftMinutes(shift.startTime, shift.endTime) <= 360) {
        return;
      }
      sched[d] = {
        ...shift,
        lunchStart,
        lunchEnd,
      };
    });
  }

  const applyAllWeeks = targetWeeks.length === 4;

  return {
    ...prepared,
    defaultLunchStart: applyAllWeeks ? lunchStart : prepared.defaultLunchStart,
    defaultLunchEnd: applyAllWeeks ? lunchEnd : prepared.defaultLunchEnd,
    weeksSchedule: weeks,
    schedule: weeks[1] || prepared.schedule,
  };
}

/**
 * Aplica o horário de abertura e fechamento de um estabelecimento aos turnos ativos
 * dos colaboradores daquela loja em S1..S4, preservando folgas e horários de almoço individuais.
 * Quando o sábado da loja exceder 6h (> 360 min), inclui o intervalo de almoço automaticamente.
 */
export function applyStoreOperatingHours(
  employees: Employee[],
  storeId: StoreId,
  hours: StoreOperatingHours
): Employee[] {
  const weekdays: DayOfWeek[] = ['SEG', 'TER', 'QUA', 'QUI', 'SEX'];
  const weekdayOver6h = getGrossShiftMinutes(hours.weekdayOpen, hours.weekdayClose) > 360;
  const satOver6h = getGrossShiftMinutes(hours.saturdayOpen, hours.saturdayClose) > 360;

  return employees.map((emp) => {
    if (
      emp.defaultStore !== storeId ||
      emp.contractType === 'LICENCA_MATERNIDADE' ||
      emp.contractType === 'ESTAGIARIO' ||
      emp.isCirculating
    ) {
      return emp;
    }

    const prepared = ensureEmployeeWeeksSchedule(emp);
    const weeks = JSON.parse(JSON.stringify(prepared.weeksSchedule!)) as Record<
      number,
      Record<DayOfWeek, DayShift>
    >;

    for (let w = 1; w <= 4; w++) {
      const sched = weeks[w];
      if (!sched) continue;
      weekdays.forEach((d) => {
        const shift = sched[d];
        if (shift && shift.type === 'TRABALHO') {
          let nextLunchStart = shift.lunchStart;
          let nextLunchEnd = shift.lunchEnd;
          if (weekdayOver6h && (!nextLunchStart || !nextLunchEnd)) {
            const resolved = resolveLunchWindowForShift(prepared, hours.weekdayOpen, hours.weekdayClose);
            nextLunchStart = resolved.lunchStart;
            nextLunchEnd = resolved.lunchEnd;
          }
          sched[d] = {
            ...shift,
            startTime: hours.weekdayOpen,
            endTime: hours.weekdayClose,
            lunchStart: nextLunchStart,
            lunchEnd: nextLunchEnd,
            label: `${hours.weekdayOpen}–${hours.weekdayClose}`,
          };
        }
      });

      if (sched.SAB && sched.SAB.type === 'TRABALHO') {
        let nextSatLunchStart = sched.SAB.lunchStart;
        let nextSatLunchEnd = sched.SAB.lunchEnd;
        if (satOver6h) {
          if (!nextSatLunchStart || !nextSatLunchEnd) {
            const resolved = resolveLunchWindowForShift(
              prepared,
              hours.saturdayOpen,
              hours.saturdayClose
            );
            nextSatLunchStart = resolved.lunchStart;
            nextSatLunchEnd = resolved.lunchEnd;
          }
        } else {
          nextSatLunchStart = undefined;
          nextSatLunchEnd = undefined;
        }
        sched.SAB = {
          ...sched.SAB,
          startTime: hours.saturdayOpen,
          endTime: hours.saturdayClose,
          lunchStart: nextSatLunchStart,
          lunchEnd: nextSatLunchEnd,
          label: `${hours.saturdayOpen}–${hours.saturdayClose}`,
        };
      }
    }

    return {
      ...prepared,
      weeksSchedule: weeks,
      schedule: weeks[1] || prepared.schedule,
    };
  });
}

/**
 * Sincroniza apenas os dias de folga/trabalho (sem sobrescrever horários da loja ou almoço
 * individuais dos turnos já ativos) de `targetEmp` para espelhar `templateEmp` nas semanas informadas.
 */
export function syncEmployeeFolgasFromTemplate(
  targetEmp: Employee,
  templateEmp: Employee,
  targetWeeks: number[] = [1, 2, 3, 4],
  storeHours?: StoreHoursMap
): Employee {
  if (
    targetEmp.id === templateEmp.id ||
    targetEmp.contractType === 'LICENCA_MATERNIDADE'
  ) {
    return targetEmp;
  }

  const preparedTarget = ensureEmployeeWeeksSchedule(targetEmp);
  const preparedTemplate = ensureEmployeeWeeksSchedule(templateEmp);
  const weeks = JSON.parse(JSON.stringify(preparedTarget.weeksSchedule!)) as Record<
    number,
    Record<DayOfWeek, DayShift>
  >;

  for (const w of targetWeeks) {
    const templateSched = preparedTemplate.weeksSchedule?.[w] || preparedTemplate.schedule;
    const targetSched = weeks[w];
    if (!templateSched || !targetSched) continue;

    DAYS_OF_WEEK.forEach((dInfo) => {
      const d = dInfo.key;
      const tplShift = templateSched[d];
      const tgtShift = targetSched[d];
      if (!tplShift) return;

      const tplIsWork = tplShift.type === 'TRABALHO';
      const tgtIsWork = tgtShift?.type === 'TRABALHO';

      if (!tplIsWork) {
        if (tgtIsWork || !tgtShift) {
          const offType =
            d === 'DOM'
              ? 'FOLGA_DSR'
              : tplShift.type === 'FOLGA_DSR'
              ? 'FOLGA_DSR'
              : 'FOLGA_5X2';
          targetSched[d] = {
            day: d,
            type: offType,
            chairId: tgtShift?.chairId || preparedTarget.defaultChairId,
            label: offType === 'FOLGA_DSR' ? 'DSR' : 'Folga 5x2',
          };
        }
      } else {
        if (!tgtIsWork) {
          if (tgtShift?.type === 'LICENCA') return;
          targetSched[d] = buildDefaultWorkShiftForDay(
            preparedTarget,
            d,
            tgtShift?.chairId || preparedTarget.defaultChairId,
            storeHours
          );
        }
      }
    });
  }

  return {
    ...preparedTarget,
    weeksSchedule: weeks,
    schedule: weeks[1] || preparedTarget.schedule,
  };
}

/**
 * Vincula dois colaboradores (unindo grupos já vinculados de forma simétrica)
 * para compartilharem os mesmos dias de folga em S1–S4 e sincroniza imediatamente.
 */
export function linkEmployeesForSameFolga(
  employees: Employee[],
  sourceId: string,
  partnerId: string,
  followPartnerFolgas: boolean = true,
  storeHours?: StoreHoursMap
): { employees: Employee[]; linkedNames: string[] } {
  if (!sourceId || !partnerId || sourceId === partnerId) {
    return { employees, linkedNames: [] };
  }

  const empMap = new Map(employees.map((e) => [e.id, e]));
  const sourceEmp = empMap.get(sourceId);
  const partnerEmp = empMap.get(partnerId);

  if (
    !sourceEmp ||
    !partnerEmp ||
    sourceEmp.contractType === 'LICENCA_MATERNIDADE' ||
    partnerEmp.contractType === 'LICENCA_MATERNIDADE'
  ) {
    return { employees, linkedNames: [] };
  }

  const groupSet = new Set<string>([sourceId, partnerId]);
  (sourceEmp.linkedFolgaIds || []).forEach((id) => groupSet.add(id));
  (partnerEmp.linkedFolgaIds || []).forEach((id) => groupSet.add(id));

  const validGroupIds = Array.from(groupSet).filter((id) => {
    const e = empMap.get(id);
    return Boolean(e && e.contractType !== 'LICENCA_MATERNIDADE');
  });

  if (validGroupIds.length < 2) {
    return { employees, linkedNames: [] };
  }

  const templateId = followPartnerFolgas ? partnerId : sourceId;
  const withLinks = employees.map((emp) => {
    if (!groupSet.has(emp.id)) return emp;
    const peers = validGroupIds.filter((id) => id !== emp.id);
    const cleanedNoParallel = emp.noParallelFolgaIds?.filter((id) => !groupSet.has(id));
    return {
      ...emp,
      linkedFolgaIds: peers.length > 0 ? peers : undefined,
      noParallelFolgaIds:
        cleanedNoParallel && cleanedNoParallel.length > 0 ? cleanedNoParallel : undefined,
    };
  });

  const templateEmp = withLinks.find((e) => e.id === templateId);
  if (!templateEmp) {
    return { employees: withLinks, linkedNames: [] };
  }

  const synced = withLinks.map((emp) => {
    if (!groupSet.has(emp.id) || emp.id === templateId) return emp;
    return syncEmployeeFolgasFromTemplate(emp, templateEmp, [1, 2, 3, 4], storeHours);
  });

  const linkedNames = validGroupIds
    .map((id) => empMap.get(id)?.shortName)
    .filter((n): n is string => Boolean(n));

  return { employees: synced, linkedNames };
}

/**
 * Remove o vínculo de folgas compartilhadas de um colaborador sem apagar seus turnos.
 */
export function unlinkEmployeeFolga(
  employees: Employee[],
  employeeId: string
): { employees: Employee[]; removedFromNames: string[] } {
  const target = employees.find((e) => e.id === employeeId);
  if (!target || !target.linkedFolgaIds || target.linkedFolgaIds.length === 0) {
    return { employees, removedFromNames: [] };
  }

  const removedFromNames: string[] = [];
  const updated = employees.map((emp) => {
    if (emp.id === employeeId) {
      return {
        ...emp,
        linkedFolgaIds: undefined,
      };
    }
    if (emp.linkedFolgaIds?.includes(employeeId)) {
      removedFromNames.push(emp.shortName);
      const remaining = emp.linkedFolgaIds.filter((id) => id !== employeeId);
      return {
        ...emp,
        linkedFolgaIds: remaining.length > 0 ? remaining : undefined,
      };
    }
    return emp;
  });

  return { employees: updated, removedFromNames };
}

/**
 * Propaga alterações de folga/trabalho de um colaborador nas semanas afetadas
 * para todos os parceiros vinculados a ele.
 */
export function propagateLinkedFolgas(
  employees: Employee[],
  changedEmployeeId: string,
  affectedWeeks: number[],
  storeHours?: StoreHoursMap
): { employees: Employee[]; syncedPartnerNames: string[] } {
  const changedEmp = employees.find((e) => e.id === changedEmployeeId);
  if (!changedEmp || !changedEmp.linkedFolgaIds || changedEmp.linkedFolgaIds.length === 0) {
    return { employees, syncedPartnerNames: [] };
  }

  const partnerSet = new Set(
    changedEmp.linkedFolgaIds.filter((id) => id !== changedEmployeeId)
  );
  if (partnerSet.size === 0 || affectedWeeks.length === 0) {
    return { employees, syncedPartnerNames: [] };
  }

  const syncedPartnerNames: string[] = [];
  const nextEmployees = employees.map((emp) => {
    if (!partnerSet.has(emp.id) || emp.contractType === 'LICENCA_MATERNIDADE') {
      return emp;
    }
    syncedPartnerNames.push(emp.shortName);
    return syncEmployeeFolgasFromTemplate(emp, changedEmp, affectedWeeks, storeHours);
  });

  return { employees: nextEmployees, syncedPartnerNames };
}

/**
 * Vincula dois colaboradores em proibição de folga em paralelo (Seg–Sáb em S1–S4),
 * removendo eventual vínculo contraditório de "folgar igual" entre o par
 * e opcionalmente realocando folgas conflitantes de sourceId para dias livres.
 */
export function linkEmployeesForNoParallelFolga(
  employees: Employee[],
  sourceId: string,
  partnerId: string,
  resolveConflicts: boolean = true,
  storeHours?: StoreHoursMap
): { employees: Employee[]; linkedNames: string[]; resolvedConflictsCount: number } {
  if (!sourceId || !partnerId || sourceId === partnerId) {
    return { employees, linkedNames: [], resolvedConflictsCount: 0 };
  }

  const preparedAll = employees.map(ensureEmployeeWeeksSchedule);
  const empMap = new Map(preparedAll.map((e) => [e.id, e]));
  const sourceOrig = empMap.get(sourceId);
  const partnerOrig = empMap.get(partnerId);

  if (
    !sourceOrig ||
    !partnerOrig ||
    sourceOrig.contractType === 'LICENCA_MATERNIDADE' ||
    partnerOrig.contractType === 'LICENCA_MATERNIDADE'
  ) {
    return { employees, linkedNames: [], resolvedConflictsCount: 0 };
  }

  let workingEmployees = preparedAll.map((emp) => {
    if (emp.id === sourceId) {
      const nextNoParallel = Array.from(new Set([...(emp.noParallelFolgaIds || []), partnerId]));
      const nextLinked = emp.linkedFolgaIds?.filter((id) => id !== partnerId);
      return {
        ...emp,
        noParallelFolgaIds: nextNoParallel,
        linkedFolgaIds: nextLinked && nextLinked.length > 0 ? nextLinked : undefined,
      };
    }
    if (emp.id === partnerId) {
      const nextNoParallel = Array.from(new Set([...(emp.noParallelFolgaIds || []), sourceId]));
      const nextLinked = emp.linkedFolgaIds?.filter((id) => id !== sourceId);
      return {
        ...emp,
        noParallelFolgaIds: nextNoParallel,
        linkedFolgaIds: nextLinked && nextLinked.length > 0 ? nextLinked : undefined,
      };
    }
    return emp;
  });

  let resolvedConflictsCount = 0;
  const alteredWeeks = new Set<number>();

  if (resolveConflicts) {
    const monToSat: DayOfWeek[] = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'];
    const candidateOrder: DayOfWeek[] = ['TER', 'QUA', 'SEG', 'QUI', 'SEX', 'SAB'];

    for (let w = 1; w <= 4; w++) {
      for (const d of monToSat) {
        const currentSource = workingEmployees.find((e) => e.id === sourceId);
        if (!currentSource) continue;
        const srcSched = currentSource.weeksSchedule?.[w] || currentSource.schedule;
        const srcShift = srcSched?.[d];
        if (!srcShift || srcShift.type === 'TRABALHO') continue;

        const conflicts = checkParallelFolgaConflict(workingEmployees, sourceId, w, d);
        if (conflicts.length === 0) continue;

        const altDay = candidateOrder.find((cand) => {
          if (cand === d) return false;
          const candShift = srcSched[cand];
          if (!candShift || candShift.type !== 'TRABALHO') return false;
          return checkParallelFolgaConflict(workingEmployees, sourceId, w, cand).length === 0;
        });

        if (altDay) {
          const updatedWeeks = JSON.parse(
            JSON.stringify(currentSource.weeksSchedule!)
          ) as Record<number, Record<DayOfWeek, DayShift>>;
          const weekSched = updatedWeeks[w];
          const offChairId = weekSched[altDay]?.chairId || currentSource.defaultChairId;

          weekSched[altDay] = {
            day: altDay,
            type: 'FOLGA_5X2',
            chairId: offChairId,
            label: 'Folga 5x2',
          };
          weekSched[d] = buildDefaultWorkShiftForDay(
            currentSource,
            d,
            srcShift.chairId || currentSource.defaultChairId,
            storeHours
          );

          const updatedSource: Employee = {
            ...currentSource,
            weeksSchedule: updatedWeeks,
            schedule: updatedWeeks[1] || currentSource.schedule,
          };

          workingEmployees = workingEmployees.map((emp) =>
            emp.id === sourceId ? updatedSource : emp
          );
          resolvedConflictsCount++;
          alteredWeeks.add(w);
        }
      }
    }

    if (alteredWeeks.size > 0) {
      workingEmployees = propagateLinkedFolgas(
        workingEmployees,
        sourceId,
        Array.from(alteredWeeks),
        storeHours
      ).employees;
    }
  }

  return {
    employees: workingEmployees,
    linkedNames: [sourceOrig.shortName, partnerOrig.shortName],
    resolvedConflictsCount,
  };
}

/**
 * Remove o vínculo de proibição de folga em paralelo de forma simétrica
 * (apenas com um parceiro específico ou todos os parceiros vinculados).
 */
export function unlinkEmployeeNoParallelFolga(
  employees: Employee[],
  employeeId: string,
  partnerId?: string
): { employees: Employee[]; removedFromNames: string[] } {
  const target = employees.find((e) => e.id === employeeId);
  if (!target || !target.noParallelFolgaIds || target.noParallelFolgaIds.length === 0) {
    return { employees, removedFromNames: [] };
  }

  const removedFromNames: string[] = [];
  const updated = employees.map((emp) => {
    if (emp.id === employeeId) {
      if (partnerId) {
        const remaining = (emp.noParallelFolgaIds || []).filter((id) => id !== partnerId);
        return {
          ...emp,
          noParallelFolgaIds: remaining.length > 0 ? remaining : undefined,
        };
      }
      return {
        ...emp,
        noParallelFolgaIds: undefined,
      };
    }

    if ((!partnerId || emp.id === partnerId) && emp.noParallelFolgaIds?.includes(employeeId)) {
      removedFromNames.push(emp.shortName);
      const remaining = emp.noParallelFolgaIds.filter((id) => id !== employeeId);
      return {
        ...emp,
        noParallelFolgaIds: remaining.length > 0 ? remaining : undefined,
      };
    }

    return emp;
  });

  return { employees: updated, removedFromNames };
}

