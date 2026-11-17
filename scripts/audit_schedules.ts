import { createDefaultScenarios } from '../src/data/seuCarroData';
import { DayOfWeek, Employee, Scenario } from '../src/types/schedule';
import {
  calculateDailyHours,
  calculateEmployeeMonthlySummary,
  calculateInterjornadaRest,
  checkParallelFolgaConflict,
  DAYS_OF_WEEK,
  DEFAULT_STORE_HOURS,
  ensureEmployeeWeeksSchedule,
  formatHoursDecimal,
  parseTimeToMinutes,
} from '../src/utils/compliance';
import { analyzeScenarioMetrics, createOptimizedScenarios } from '../src/utils/scenarioProposals';
import { calculateSectorDailyCoverage, SECTOR_DEFINITIONS } from '../src/utils/coverage';
import { getCycleWeekForDate, getDayOfWeekForDateIso, getEmployeeShiftForDate } from '../src/utils/realCalendar';

const WEEK_NUMS = [1, 2, 3, 4] as const;

interface DeepScenarioAudit {
  id: string;
  name: string;
  phase: string;
  utilization42hPct: number;
  avgWeeklyHoursClt: number;
  maxDailyMinutesObserved: number;
  within8h24Cap: boolean;
  complianceErrorCount: number;
  operationalWarningCount: number;
  uncoveredSectorsTotal: number;
  prolongedWeekendsCount: number;
  employeesWithZeroProlongedWeekend: string[];
  parallelConflictsCount: number;
  tightestInterjornada: {
    employee: string;
    week: number;
    transition: string;
    restMinutes: number;
  } | null;
  peakLunchConcurrency: Array<{
    week: number;
    store: string;
    department: string;
    day: DayOfWeek;
    window: string;
    onLunchCount: number;
    workingCount: number;
    namesOnLunch: string[];
  }>;
  soloCoverageGaps: Array<{
    employee: string;
    department: string;
    store: string;
    daysOffCountIn4Weeks: number;
    sampleOffDays: string[];
  }>;
  monthlyBalanceSpreadHours: number;
  monthlyExtremesLabel: string;
  openingClosingBlindspots: Array<{
    group: string;
    windowType: 'ABERTURA' | 'FECHAMENTO';
    hourWindow: string;
    occurrencesCount: number;
    sampleDays: string[];
  }>;
  l2SeniorSaturdayRisk: string[];
  jorginhoCollisionDays: string[];
  l2FinLunchRiskDays: string[];
  internalWeekdayCollisions: string[];
  criticalDaysMinSummary: string;
  coverageAwareScore: number;
  qualityScore: {
    total: number;
    breakdown: string;
  };
}

function auditScenarioDeep(scenario: Scenario): DeepScenarioAudit {
  const employees = scenario.employees.map(ensureEmployeeWeeksSchedule);
  const metrics = analyzeScenarioMetrics(scenario);

  // 1. Funcionários CLT rotativos sem nenhum FDS prolongado nas 4 semanas
  const activeClt = employees.filter(
    (e) => e.contractType === 'CLT_ATIVO' || e.contractType === 'CLT_TEMPORARIO'
  );
  const withProlonged = new Set(metrics.prolongedWeekends.map((p) => p.employeeId));
  const employeesWithZeroProlongedWeekend = activeClt
    .filter((e) => !withProlonged.has(e.id))
    .map((e) => `${e.shortName} (${e.department})`);

  // 2. Conflitos de "Proibir Folga Paralela"
  let parallelConflictsCount = 0;
  for (const w of WEEK_NUMS) {
    for (const d of DAYS_OF_WEEK) {
      if (d.key === 'DOM') continue;
      for (const emp of employees) {
        const shift = emp.weeksSchedule?.[w]?.[d.key];
        if (shift && shift.type !== 'TRABALHO') {
          const conflicts = checkParallelFolgaConflict(employees, emp.id, w, d.key);
          if (conflicts.length > 0) parallelConflictsCount++;
        }
      }
    }
  }

  // 3. Menor intervalo interjornada em toda a matriz S1–S4
  let tightestInterjornada: DeepScenarioAudit['tightestInterjornada'] = null;
  for (const emp of employees) {
    if (emp.contractType === 'LICENCA_MATERNIDADE') continue;
    for (const w of WEEK_NUMS) {
      const sched = emp.weeksSchedule?.[w];
      if (!sched) continue;
      for (let i = 0; i < DAYS_OF_WEEK.length - 1; i++) {
        const prev = DAYS_OF_WEEK[i].key;
        const curr = DAYS_OF_WEEK[i + 1].key;
        if (sched[prev]?.type === 'TRABALHO' && sched[curr]?.type === 'TRABALHO') {
          const rest = calculateInterjornadaRest(sched[prev], sched[curr]);
          if (!tightestInterjornada || rest.restMinutes < tightestInterjornada.restMinutes) {
            tightestInterjornada = {
              employee: emp.shortName,
              week: w,
              transition: `${prev}->${curr}`,
              restMinutes: rest.restMinutes,
            };
          }
        }
      }
    }
  }

  // 4. Pico de sobreposição de almoço (>= 50% do setor no mesmo horário em S1–S4)
  const peakLunchConcurrency: DeepScenarioAudit['peakLunchConcurrency'] = [];
  const deptGroups = new Map<string, Employee[]>();
  for (const emp of activeClt) {
    const key = `${emp.defaultStore}::${emp.department}`;
    const list = deptGroups.get(key) || [];
    list.push(emp);
    deptGroups.set(key, list);
  }

  for (const [key, group] of deptGroups.entries()) {
    if (group.length < 2) continue;
    const [store, department] = key.split('::');
    for (const w of WEEK_NUMS) {
      for (const d of DAYS_OF_WEEK) {
        if (d.isWeekend) continue;
        const workingInDay = group.filter((e) => e.weeksSchedule?.[w]?.[d.key]?.type === 'TRABALHO');
        if (workingInDay.length < 2) continue;

        // Verifica a cada 15 min entre 11:00 e 15:00 qual o pico simultâneo em almoço
        let worstCount = 0;
        let worstMin = 0;
        let worstNames: string[] = [];
        for (let m = 11 * 60; m <= 15 * 60; m += 15) {
          const atLunch = workingInDay.filter((emp) => {
            const sh = emp.weeksSchedule?.[w]?.[d.key];
            if (!sh?.lunchStart || !sh?.lunchEnd) return false;
            const ls = parseTimeToMinutes(sh.lunchStart);
            const le = parseTimeToMinutes(sh.lunchEnd);
            return m >= ls && m < le;
          });
          if (atLunch.length > worstCount) {
            worstCount = atLunch.length;
            worstMin = m;
            worstNames = atLunch.map((e) => e.shortName);
          }
        }

        if (worstCount >= Math.ceil(workingInDay.length / 2) && worstCount >= 2) {
          const hh = String(Math.floor(worstMin / 60)).padStart(2, '0');
          const mm = String(worstMin % 60).padStart(2, '0');
          peakLunchConcurrency.push({
            week: w,
            store,
            department,
            day: d.key,
            window: `${hh}:${mm}`,
            onLunchCount: worstCount,
            workingCount: workingInDay.length,
            namesOnLunch: worstNames,
          });
        }
      }
    }
  }

  // Deduplica por departamento mostrando pior dia de S1–S4
  const worstLunchByGroup = new Map<string, DeepScenarioAudit['peakLunchConcurrency'][number]>();
  for (const item of peakLunchConcurrency) {
    const gk = `${item.store}-${item.department}`;
    const prev = worstLunchByGroup.get(gk);
    if (!prev || item.onLunchCount / item.workingCount > prev.onLunchCount / prev.workingCount) {
      worstLunchByGroup.set(gk, item);
    }
  }

  // 5. Especialistas únicos por setor+loja com dias de folga úteis sem par direto no setor
  const soloCoverageGaps: DeepScenarioAudit['soloCoverageGaps'] = [];
  for (const [key, group] of deptGroups.entries()) {
    const [store, department] = key.split('::');
    const fixedStaff = employees.filter(
      (e) =>
        e.defaultStore === store &&
        e.department === department &&
        e.contractType !== 'LICENCA_MATERNIDADE'
    );
    if (fixedStaff.length === 1) {
      const solo = fixedStaff[0];
      const offSamples: string[] = [];
      for (const w of WEEK_NUMS) {
        for (const d of DAYS_OF_WEEK) {
          if (d.key === 'DOM') continue;
          const sh = solo.weeksSchedule?.[w]?.[d.key];
          if (sh && sh.type !== 'TRABALHO') {
            offSamples.push(`S${w} ${d.shortLabel}`);
          }
        }
      }
      if (offSamples.length > 0) {
        soloCoverageGaps.push({
          employee: solo.shortName,
          department,
          store,
          daysOffCountIn4Weeks: offSamples.length,
          sampleOffDays: offSamples,
        });
      }
    }
  }

  // 6. Dispersão mensal (máx - mín horas entre CLTs ativos no cenário + extremos)
  const monthlyEntries = activeClt.map((emp) => ({
    name: emp.shortName,
    hours: calculateEmployeeMonthlySummary(emp, scenario.phase).totalMonthlyHours,
  }));
  monthlyEntries.sort((a, b) => a.hours - b.hours);
  const minEntry = monthlyEntries[0];
  const maxEntry = monthlyEntries[monthlyEntries.length - 1];
  const monthlyBalanceSpreadHours =
    minEntry && maxEntry ? Number((maxEntry.hours - minEntry.hours).toFixed(2)) : 0;
  const minGroupNames = monthlyEntries
    .filter((e) => Math.abs(e.hours - minEntry.hours) < 0.01)
    .map((e) => e.name)
    .join(', ');
  const maxGroupNames = monthlyEntries
    .filter((e) => Math.abs(e.hours - maxEntry.hours) < 0.01)
    .map((e) => e.name)
    .join(', ');
  const monthlyExtremesLabel =
    minEntry && maxEntry
      ? `mín ${formatHoursDecimal(minEntry.hours)} (${minGroupNames}) vs máx ${formatHoursDecimal(maxEntry.hours)} (${maxGroupNames})`
      : 'n/a';

  // 7. Auditoria de Pontas (Abertura e Fechamento da Loja em S1–S4, Seg–Sex)
  const storeHours = scenario.storeHours || DEFAULT_STORE_HOURS;
  const pointCheckGroups: Array<{
    label: string;
    store: 'LOJA_1' | 'LOJA_2';
    depts: Employee['department'][];
  }> = [
    { label: 'LOJA_1/SDR', store: 'LOJA_1', depts: ['SDR'] },
    { label: 'LOJA_1/VENDAS', store: 'LOJA_1', depts: ['VENDAS'] },
    { label: 'LOJA_1/PREPARACAO', store: 'LOJA_1', depts: ['PREPARACAO'] },
    { label: 'LOJA_2/DOC+SC', store: 'LOJA_2', depts: ['DOCUMENTACAO', 'SUCESSO_CLIENTE'] },
    { label: 'LOJA_2/VENDAS-EXT', store: 'LOJA_2', depts: ['VENDAS'] },
  ];
  const openingClosingBlindspots: DeepScenarioAudit['openingClosingBlindspots'] = [];

  for (const grp of pointCheckGroups) {
    const members = employees.filter(
      (e) =>
        e.contractType !== 'LICENCA_MATERNIDADE' &&
        e.defaultStore === grp.store &&
        grp.depts.includes(e.department)
    );
    if (members.length === 0) continue;

    const stHours = storeHours[grp.store];
    const openStr = stHours.weekdayOpen;
    const closeStr = stHours.weekdayClose;
    const openMin = parseTimeToMinutes(openStr);
    const closeMin = parseTimeToMinutes(closeStr);

    const openMissDays: string[] = [];
    const closeMissDays: string[] = [];

    for (const w of WEEK_NUMS) {
      for (const d of DAYS_OF_WEEK) {
        if (d.isWeekend) continue;
        const presentAtOpen = members.some((emp) => {
          const sh = emp.weeksSchedule?.[w]?.[d.key];
          if (!sh || sh.type !== 'TRABALHO' || !sh.startTime || !sh.endTime) return false;
          return parseTimeToMinutes(sh.startTime) <= openMin && parseTimeToMinutes(sh.endTime) > openMin;
        });
        if (!presentAtOpen) {
          openMissDays.push(`S${w} ${d.shortLabel}`);
        }

        const presentAtClose = members.some((emp) => {
          const sh = emp.weeksSchedule?.[w]?.[d.key];
          if (!sh || sh.type !== 'TRABALHO' || !sh.startTime || !sh.endTime) return false;
          return parseTimeToMinutes(sh.startTime) < closeMin && parseTimeToMinutes(sh.endTime) >= closeMin;
        });
        if (!presentAtClose) {
          closeMissDays.push(`S${w} ${d.shortLabel}`);
        }
      }
    }

    if (openMissDays.length > 0) {
      openingClosingBlindspots.push({
        group: grp.label,
        windowType: 'ABERTURA',
        hourWindow: openStr,
        occurrencesCount: openMissDays.length,
        sampleDays: openMissDays,
      });
    }
    if (closeMissDays.length > 0) {
      openingClosingBlindspots.push({
        group: grp.label,
        windowType: 'FECHAMENTO',
        hourWindow: closeStr,
        occurrencesCount: closeMissDays.length,
        sampleDays: closeMissDays,
      });
    }
  }

  // 8. Risco de Sábado sem Sênior/Pós-Venda em LOJA_2/DOC+SC (Marielly & titular SC-1 fora juntos no sábado)
  const l2SeniorSaturdayRisk: string[] = [];
  const marielly = employees.find((e) => e.id === 'emp-marielly');
  const scHolder = employees.find(
    (e) =>
      e.department === 'SUCESSO_CLIENTE' &&
      e.contractType !== 'LICENCA_MATERNIDADE'
  );
  for (const w of WEEK_NUMS) {
    const mSat = marielly?.weeksSchedule?.[w]?.SAB?.type === 'TRABALHO';
    const scSat = scHolder?.weeksSchedule?.[w]?.SAB?.type === 'TRABALHO';
    if (!mSat && !scSat) {
      l2SeniorSaturdayRisk.push(`S${w} Sáb (só Auxiliar Mayana + Estagiário 4h)`);
    }
  }

  // 8B. Rodada #5: Colisões úteis de mesa solo (Jorginho off com L1-VENDAS < 100%) & backup de almoço L2-FIN
  const jorginho = employees.find((e) => e.id === 'emp-rosinaldo');
  const l1Sellers = employees.filter(
    (e) =>
      e.defaultStore === 'LOJA_1' &&
      e.department === 'VENDAS' &&
      e.contractType !== 'LICENCA_MATERNIDADE'
  );
  const jorginhoCollisionDays: string[] = [];
  for (const w of WEEK_NUMS) {
    for (const d of DAYS_OF_WEEK) {
      if (d.isWeekend) continue;
      if (jorginho?.weeksSchedule?.[w]?.[d.key]?.type !== 'TRABALHO') {
        const l1Active = l1Sellers.filter((e) => e.weeksSchedule?.[w]?.[d.key]?.type === 'TRABALHO').length;
        if (l1Active < l1Sellers.length) {
          jorginhoCollisionDays.push(`S${w} ${d.shortLabel} (${l1Active}/${l1Sellers.length} L1)`);
        }
      }
    }
  }

  const joaoPedro = employees.find((e) => e.id === 'emp-joao-pedro');
  const l2FinLunchRiskDays: string[] = [];
  for (const w of WEEK_NUMS) {
    for (const d of DAYS_OF_WEEK) {
      if (d.isWeekend) continue;
      const jpShift = joaoPedro?.weeksSchedule?.[w]?.[d.key];
      if (!jpShift || jpShift.type !== 'TRABALHO' || !jpShift.lunchStart || !jpShift.lunchEnd) continue;
      const jpLs = parseTimeToMinutes(jpShift.lunchStart);
      const jpLe = parseTimeToMinutes(jpShift.lunchEnd);
      const mShift = marielly?.weeksSchedule?.[w]?.[d.key];
      if (!mShift || mShift.type !== 'TRABALHO') {
        l2FinLunchRiskDays.push(`S${w} ${d.shortLabel} (Marielly folga)`);
        continue;
      }
      if (mShift.lunchStart && mShift.lunchEnd) {
        const mLs = parseTimeToMinutes(mShift.lunchStart);
        const mLe = parseTimeToMinutes(mShift.lunchEnd);
        if (Math.min(jpLe, mLe) > Math.max(jpLs, mLs)) {
          l2FinLunchRiskDays.push(`S${w} ${d.shortLabel} (sobrep. almoço)`);
        }
      }
    }
  }

  // 8C. Capacidade mínima nos dias críticos declarados dos setores (S1–S4)
  const criticalChecks = [
    { label: 'SDR Seg', store: 'LOJA_1', dept: 'SDR' as const, day: 'SEG' as const },
    { label: 'Vendas Sáb', store: 'LOJA_1', dept: 'VENDAS' as const, day: 'SAB' as const },
    { label: 'Prep Sex', store: 'LOJA_1', dept: 'PREPARACAO' as const, day: 'SEX' as const },
    { label: 'Doc+SC Qui', store: 'LOJA_2', dept: 'DOCUMENTACAO' as const, day: 'QUI' as const },
  ];
  const criticalDaysMinSummary = criticalChecks
    .map((c) => {
      const pool = employees.filter(
        (e) =>
          e.defaultStore === c.store &&
          (c.dept === 'DOCUMENTACAO'
            ? e.department === 'DOCUMENTACAO' || e.department === 'SUCESSO_CLIENTE'
            : e.department === c.dept) &&
          e.contractType !== 'LICENCA_MATERNIDADE'
      );
      const counts = WEEK_NUMS.map(
        (w) => pool.filter((e) => e.weeksSchedule?.[w]?.[c.day]?.type === 'TRABALHO').length
      );
      return `${c.label}:${Math.min(...counts)}/${pool.length}`;
    })
    .join(' | ');

  // 8D. Rodada #6: Colisão interna no mesmo setor multi-pessoa (2+ CLTs úteis off no mesmo dia => queda < n-1)
  const internalWeekdayCollisions: string[] = [];
  const multiSectorChecks: Array<{
    label: string;
    members: Employee[];
    minHealthy: number;
  }> = [
    {
      label: 'L1-SDR',
      members: activeClt.filter((e) => e.defaultStore === 'LOJA_1' && e.department === 'SDR'),
      minHealthy: 3,
    },
    {
      label: 'L1-VENDAS',
      members: activeClt.filter((e) => e.defaultStore === 'LOJA_1' && e.department === 'VENDAS'),
      minHealthy: 3,
    },
    {
      label: 'L1-PREP',
      members: activeClt.filter((e) => e.defaultStore === 'LOJA_1' && e.department === 'PREPARACAO'),
      minHealthy: 3,
    },
    {
      label: 'L2-DOC+SC(CLT)',
      members: activeClt.filter(
        (e) =>
          e.defaultStore === 'LOJA_2' &&
          (e.department === 'DOCUMENTACAO' || e.department === 'SUCESSO_CLIENTE')
      ),
      minHealthy: 2,
    },
  ];
  for (const grp of multiSectorChecks) {
    if (grp.members.length === 0) continue;
    for (const w of WEEK_NUMS) {
      for (const d of DAYS_OF_WEEK) {
        if (d.isWeekend) continue;
        const active = grp.members.filter((e) => e.weeksSchedule?.[w]?.[d.key]?.type === 'TRABALHO');
        if (active.length < grp.minHealthy) {
          const offNames = grp.members
            .filter((e) => e.weeksSchedule?.[w]?.[d.key]?.type !== 'TRABALHO')
            .map((e) => e.shortName)
            .join('+');
          internalWeekdayCollisions.push(
            `${grp.label} S${w} ${d.shortLabel} (${active.length}/${grp.members.length} -> off: ${offNames})`
          );
        }
      }
    }
  }

  // 9. Índice Ponderado de Qualidade Operacional (Score 0–100)
  const p1Legal = Math.max(
    0,
    30 - metrics.complianceErrorCount * 12 - (metrics.within8h24Cap ? 0 : 15)
  );
  const p2Sectors = Math.max(0, 20 - metrics.uncoveredSectorsTotal * 4);
  const p3Util42 = Math.min(15, 15 * (metrics.utilization42hPct / 100));

  const lunchPenalty = Math.min(10, worstLunchByGroup.size * 3);
  const edgeDaysMulti = openingClosingBlindspots
    .filter((b) => b.group !== 'LOJA_2/VENDAS-EXT')
    .reduce((acc, b) => acc + b.occurrencesCount, 0);
  const edgeDaysSolo = openingClosingBlindspots
    .filter((b) => b.group === 'LOJA_2/VENDAS-EXT')
    .reduce((acc, b) => acc + b.occurrencesCount, 0);
  const edgePenalty = Math.min(10, edgeDaysMulti * 0.5 + edgeDaysSolo * 0.15 + l2SeniorSaturdayRisk.length * 1.5);
  const p4Intraday = Math.max(0, 20 - lunchPenalty - edgePenalty);

  // Calcula também blindagem efetiva de VEND-L2-EXT qdo L1 Vendas cobre a ponta (>=3 ativos em L1 + 1 cobrindo abertura/fechamento)
  let unbackedSoloEdgeDays = 0;
  const stHoursL2 = storeHours.LOJA_2;
  const l2OpenMin = parseTimeToMinutes(stHoursL2.weekdayOpen);
  const l2CloseMin = parseTimeToMinutes(stHoursL2.weekdayClose);
  for (const w of WEEK_NUMS) {
    for (const d of DAYS_OF_WEEK) {
      if (d.isWeekend) continue;
      const jSh = jorginho?.weeksSchedule?.[w]?.[d.key];
      const activeL1 = l1Sellers.filter((e) => {
        const s = e.weeksSchedule?.[w]?.[d.key];
        return s?.type === 'TRABALHO' && s.startTime && s.endTime;
      });
      const jHasOpen =
        jSh?.type === 'TRABALHO' && !!jSh.startTime && parseTimeToMinutes(jSh.startTime) <= l2OpenMin;
      const jHasClose =
        jSh?.type === 'TRABALHO' && !!jSh.endTime && parseTimeToMinutes(jSh.endTime) >= l2CloseMin;
      const peerOpen = activeL1.some((e) => parseTimeToMinutes(e.weeksSchedule![w][d.key].startTime!) <= l2OpenMin);
      const peerClose = activeL1.some((e) => parseTimeToMinutes(e.weeksSchedule![w][d.key].endTime!) >= l2CloseMin);

      if (!jHasOpen && !(activeL1.length >= 3 && peerOpen)) unbackedSoloEdgeDays++;
      if (!jHasClose && !(activeL1.length >= 3 && peerClose)) unbackedSoloEdgeDays++;
    }
  }
  const edgePenaltyEffective = Math.min(
    10,
    edgeDaysMulti * 0.5 + unbackedSoloEdgeDays * 0.15 + l2SeniorSaturdayRisk.length * 1.5
  );
  const p4IntradayEffective = Math.max(0, 20 - lunchPenalty - edgePenaltyEffective);

  const fdsPenalty = Math.min(5, employeesWithZeroProlongedWeekend.length * 1);
  const spreadPenalty = Math.min(5, monthlyBalanceSpreadHours * 0.35);
  const p5Equity = Math.max(0, 10 - fdsPenalty - spreadPenalty);

  const minRest = tightestInterjornada ? tightestInterjornada.restMinutes : 840;
  const p6Rest =
    minRest >= 840 ? 5 : minRest <= 660 ? 0 : Number(((5 * (minRest - 660)) / (840 - 660)).toFixed(2));

  const totalScore = Number((p1Legal + p2Sectors + p3Util42 + p4Intraday + p5Equity + p6Rest).toFixed(1));
  const coverageAwareScore = Number(
    (p1Legal + p2Sectors + p3Util42 + p4IntradayEffective + p5Equity + p6Rest).toFixed(1)
  );

  return {
    id: scenario.id,
    name: scenario.name,
    phase: scenario.phase,
    utilization42hPct: metrics.utilization42hPct,
    avgWeeklyHoursClt: metrics.avgWeeklyHoursClt,
    maxDailyMinutesObserved: metrics.maxDailyMinutesObserved,
    within8h24Cap: metrics.within8h24Cap,
    complianceErrorCount: metrics.complianceErrorCount,
    operationalWarningCount: metrics.operationalWarningCount,
    uncoveredSectorsTotal: metrics.uncoveredSectorsTotal,
    prolongedWeekendsCount: metrics.prolongedWeekendsCount,
    employeesWithZeroProlongedWeekend,
    parallelConflictsCount,
    tightestInterjornada,
    peakLunchConcurrency: Array.from(worstLunchByGroup.values()),
    soloCoverageGaps,
    monthlyBalanceSpreadHours,
    monthlyExtremesLabel,
    openingClosingBlindspots,
    l2SeniorSaturdayRisk,
    jorginhoCollisionDays,
    l2FinLunchRiskDays,
    internalWeekdayCollisions,
    criticalDaysMinSummary,
    coverageAwareScore,
    qualityScore: {
      total: totalScore,
      breakdown: `Legal/8h24:${p1Legal.toFixed(1)}/30 Set:${p2Sectors.toFixed(1)}/20 42h:${p3Util42.toFixed(1)}/15 Intradia:${p4Intraday.toFixed(1)}/20 Equid:${p5Equity.toFixed(1)}/10 Interj:${p6Rest.toFixed(1)}/5`,
    },
  };
}

function applySandboxTransform(
  baseScenario: Scenario,
  mode: 'TRAD_V2' | 'CENB_V2'
): Scenario {
  const cloned = JSON.parse(JSON.stringify(baseScenario)) as Scenario;
  cloned.id = mode === 'TRAD_V2' ? 'sandbox-trad-v2' : 'sandbox-cenb-v2';
  cloned.name =
    mode === 'TRAD_V2'
      ? 'Sandbox Tradicional v2 (0-Déficit: 4 Ondas Almoço + Pontas 17h30 + Jorge Alt.)'
      : 'Sandbox Cenário B v2 (0-Déficit: 4 Ondas Almoço + Pontas 18h + Jorge Alt.)';

  type SlotRule = {
    start: string;
    lunchStart: string;
    lunchEnd: string;
    end: string;
    altWeekEven?: { start: string; lunchStart: string; lunchEnd: string; end: string };
  };

  const tradRules: Record<string, SlotRule> = {
    'emp-diana': { start: '08:00', lunchStart: '11:00', lunchEnd: '12:00', end: '17:24' },
    'emp-andria': { start: '08:00', lunchStart: '12:00', lunchEnd: '13:00', end: '17:24' },
    'emp-adriane': { start: '08:06', lunchStart: '13:00', lunchEnd: '14:00', end: '17:30' },
    'emp-winona': { start: '08:06', lunchStart: '14:00', lunchEnd: '15:00', end: '17:30' },

    'emp-jair': { start: '08:00', lunchStart: '11:00', lunchEnd: '12:00', end: '17:24' },
    'emp-joao-alexandre': { start: '08:00', lunchStart: '12:00', lunchEnd: '13:00', end: '17:24' },
    'emp-marcos-antonio': { start: '08:06', lunchStart: '13:00', lunchEnd: '14:00', end: '17:30' },
    'emp-rayssa': { start: '08:06', lunchStart: '14:00', lunchEnd: '15:00', end: '17:30' },

    'emp-allisson': { start: '08:00', lunchStart: '11:00', lunchEnd: '12:00', end: '17:24' },
    'emp-rodolfo': { start: '08:00', lunchStart: '12:00', lunchEnd: '13:00', end: '17:24' },
    'emp-marcos-florentino': { start: '08:06', lunchStart: '13:00', lunchEnd: '14:00', end: '17:30' },
    'emp-alefy': { start: '08:06', lunchStart: '14:00', lunchEnd: '15:00', end: '17:30' },

    'emp-marielly': { start: '08:00', lunchStart: '11:00', lunchEnd: '12:00', end: '17:24' },
    'emp-jorge': {
      start: '08:00',
      lunchStart: '12:00',
      lunchEnd: '13:00',
      end: '17:24',
      altWeekEven: { start: '08:06', lunchStart: '12:00', lunchEnd: '13:00', end: '17:30' },
    },
    'emp-mayana': { start: '08:06', lunchStart: '13:00', lunchEnd: '14:00', end: '17:30' },
  };

  const cenBRules: Record<string, SlotRule> = {
    'emp-diana': { start: '08:00', lunchStart: '11:00', lunchEnd: '12:00', end: '17:24' },
    'emp-andria': { start: '08:00', lunchStart: '12:00', lunchEnd: '13:00', end: '17:24' },
    'emp-adriane': { start: '08:36', lunchStart: '13:00', lunchEnd: '14:00', end: '18:00' },
    'emp-winona': { start: '08:36', lunchStart: '14:00', lunchEnd: '15:00', end: '18:00' },

    'emp-jair': { start: '08:00', lunchStart: '11:00', lunchEnd: '12:00', end: '17:24' },
    'emp-joao-alexandre': { start: '08:00', lunchStart: '12:00', lunchEnd: '13:00', end: '17:24' },
    'emp-marcos-antonio': { start: '08:36', lunchStart: '13:00', lunchEnd: '14:00', end: '18:00' },
    'emp-rayssa': { start: '08:36', lunchStart: '14:00', lunchEnd: '15:00', end: '18:00' },

    'emp-allisson': { start: '08:00', lunchStart: '11:00', lunchEnd: '12:00', end: '17:24' },
    'emp-rodolfo': { start: '08:00', lunchStart: '12:00', lunchEnd: '13:00', end: '17:24' },
    'emp-marcos-florentino': { start: '08:36', lunchStart: '13:00', lunchEnd: '14:00', end: '18:00' },
    'emp-alefy': { start: '08:36', lunchStart: '14:00', lunchEnd: '15:00', end: '18:00' },

    'emp-marielly': { start: '08:00', lunchStart: '11:00', lunchEnd: '12:00', end: '17:24' },
    'emp-jorge': {
      start: '08:00',
      lunchStart: '12:00',
      lunchEnd: '13:00',
      end: '17:24',
      altWeekEven: { start: '08:36', lunchStart: '12:00', lunchEnd: '13:00', end: '18:00' },
    },
    'emp-mayana': { start: '08:36', lunchStart: '13:00', lunchEnd: '14:00', end: '18:00' },
  };

  const rules = mode === 'TRAD_V2' ? tradRules : cenBRules;

  for (const emp of cloned.employees) {
    const rule = rules[emp.id];
    if (rule && emp.weeksSchedule) {
      for (const w of WEEK_NUMS) {
        const wRule = w % 2 === 0 && rule.altWeekEven ? rule.altWeekEven : rule;
        for (const d of DAYS_OF_WEEK) {
          if (d.isWeekend) continue;
          const sh = emp.weeksSchedule[w]?.[d.key];
          if (sh && sh.type === 'TRABALHO') {
            sh.startTime = wRule.start;
            sh.lunchStart = wRule.lunchStart;
            sh.lunchEnd = wRule.lunchEnd;
            sh.endTime = wRule.end;
          }
        }
      }
      emp.schedule = JSON.parse(JSON.stringify(emp.weeksSchedule[1]));
    }

  }

  return cloned;
}

function applySandboxV3Additions(scen: Scenario, mode: 'TRAD_V3' | 'CENB_V3'): Scenario {
  const cloned = JSON.parse(JSON.stringify(scen)) as Scenario;
  cloned.id = mode === 'TRAD_V3' ? 'sandbox-trad-v3' : 'sandbox-cenb-v3';
  cloned.name =
    mode === 'TRAD_V3'
      ? 'Sandbox Tradicional v3 (+L2 Sênior Desacoplada + Jorginho Bordas Alt.)'
      : 'Sandbox Cenário B v3 (+L2 Sênior Desacoplada + Jorginho Bordas Alt.)';

  const openSlot = { start: '08:00', lunchStart: '12:00', lunchEnd: '13:00', end: '17:24' };
  const closeSlot =
    mode === 'TRAD_V3'
      ? { start: '08:06', lunchStart: '12:00', lunchEnd: '13:00', end: '17:30' }
      : { start: '08:36', lunchStart: '12:00', lunchEnd: '13:00', end: '18:00' };
  const mayanaClose =
    mode === 'TRAD_V3'
      ? { start: '08:06', lunchStart: '13:00', lunchEnd: '14:00', end: '17:30' }
      : { start: '08:36', lunchStart: '13:00', lunchEnd: '14:00', end: '18:00' };
  const mariellyOpen = { start: '08:00', lunchStart: '11:00', lunchEnd: '12:00', end: '17:24' };
  const satEnd = mode === 'TRAD_V3' ? '13:00' : '14:00';

  const makeWork = (day: DayOfWeek, chairId: string, s: typeof openSlot) => ({
    day,
    type: 'TRABALHO' as const,
    chairId,
    startTime: s.start,
    lunchStart: s.lunchStart,
    lunchEnd: s.lunchEnd,
    endTime: s.end,
  });

  const makeSat = (chairId: string) => ({
    day: 'SAB' as DayOfWeek,
    type: 'TRABALHO' as const,
    chairId,
    startTime: '08:00',
    endTime: satEnd,
  });

  const makeFolga = (day: DayOfWeek, chairId: string, label: string) => ({
    day,
    type: 'FOLGA_5X2' as const,
    chairId,
    label,
  });

  for (const emp of cloned.employees) {
    if (!emp.weeksSchedule) continue;

    // 1. Jorginho alterna bordas (S1/S3 abre 08:00, S2/S4 fecha 17:30/18:00)
    if (emp.id === 'emp-rosinaldo') {
      for (const w of WEEK_NUMS) {
        const slot = w % 2 === 1 ? openSlot : closeSlot;
        for (const d of ['SEG', 'TER', 'QUA', 'QUI', 'SEX'] as DayOfWeek[]) {
          if (emp.weeksSchedule[w][d]?.type === 'TRABALHO') {
            emp.weeksSchedule[w][d] = makeWork(d, emp.defaultChairId, slot);
          }
        }
      }
      emp.schedule = JSON.parse(JSON.stringify(emp.weeksSchedule[1]));
    }

    // 2. Desacopla sábados em L2 DOC+SC: Marielly [1,3] / Mayana [2,3] / Jorge [2,4]
    // Zero sábados sem Sênior/Pós-Venda, zero pontos cegos Seg–Sex e 1 FDS Prolongado cada (S1->S2, S3->S4, S2->S3)!
    const l2Plans: Record<
      string,
      {
        satOff: number[];
        weekdayOff: Partial<Record<1 | 2 | 3 | 4, DayOfWeek>>;
        winByWeek: Record<number, typeof openSlot>;
        dayOverride?: Partial<Record<1 | 2 | 3 | 4, Partial<Record<DayOfWeek, typeof openSlot>>>>;
      }
    > = {
      'emp-marielly': {
        satOff: [1, 3],
        weekdayOff: { 2: 'SEG', 4: 'TER' },
        winByWeek: { 1: mariellyOpen, 2: mariellyOpen, 3: mariellyOpen, 4: mariellyOpen },
      },
      'emp-mayana': {
        satOff: [2, 3],
        weekdayOff: { 1: 'TER', 4: 'SEG' },
        winByWeek: { 1: mayanaClose, 2: mayanaClose, 3: mayanaClose, 4: mayanaClose },
      },
      'emp-jorge': {
        satOff: [2, 4],
        weekdayOff: { 1: 'QUA', 3: 'SEG' },
        winByWeek: { 1: closeSlot, 2: openSlot, 3: closeSlot, 4: closeSlot },
        dayOverride: { 4: { TER: openSlot } }, // Cobre abertura 08:00 na folga de Marielly c/ 14h de interjornada
      },
    };

    const plan = l2Plans[emp.id];
    if (plan) {
      for (const w of WEEK_NUMS) {
        const isSatOff = plan.satOff.includes(w);
        const wOff = plan.weekdayOff[w];
        const baseSlot = plan.winByWeek[w];
        for (const d of ['SEG', 'TER', 'QUA', 'QUI', 'SEX'] as DayOfWeek[]) {
          const slot = plan.dayOverride?.[w]?.[d] ?? baseSlot;
          emp.weeksSchedule[w][d] =
            !isSatOff && wOff === d
              ? makeFolga(d, emp.defaultChairId, 'Folga 5x2')
              : makeWork(d, emp.defaultChairId, slot);
        }
        emp.weeksSchedule[w].SAB = isSatOff
          ? makeFolga('SAB', emp.defaultChairId, 'Folga Sábado (5x2)')
          : makeSat(emp.defaultChairId);
      }
      emp.schedule = JSON.parse(JSON.stringify(emp.weeksSchedule[1]));
    }
  }

  return cloned;
}

function applySandboxV4Transform(scen: Scenario, mode: 'TRAD_V4' | 'CENB_V4'): Scenario {
  const baseV3 = applySandboxV3Additions(
    applySandboxTransform(scen, mode === 'TRAD_V4' ? 'TRAD_V2' : 'CENB_V2'),
    mode === 'TRAD_V4' ? 'TRAD_V3' : 'CENB_V3'
  );
  baseV3.id = mode === 'TRAD_V4' ? 'sandbox-trad-v4' : 'sandbox-cenb-v4';
  baseV3.name =
    mode === 'TRAD_V4'
      ? 'Sandbox Tradicional v4 (+Vendas Zero Colisão Jorginho S4 Seg + Backup Cruzado)'
      : 'Sandbox Cenário B v4 (+Vendas Zero Colisão Jorginho S4 Seg + Backup Cruzado)';

  const satEnd = mode === 'TRAD_V4' ? '13:00' : '14:00';
  const openSlotByEmp: Record<string, { start: string; lunchStart: string; lunchEnd: string; end: string }> = {
    'emp-jair': { start: '08:00', lunchStart: '11:00', lunchEnd: '12:00', end: '17:24' },
    'emp-joao-alexandre': { start: '08:00', lunchStart: '12:00', lunchEnd: '13:00', end: '17:24' },
    'emp-marcos-antonio':
      mode === 'TRAD_V4'
        ? { start: '08:06', lunchStart: '13:00', lunchEnd: '14:00', end: '17:30' }
        : { start: '08:36', lunchStart: '13:00', lunchEnd: '14:00', end: '18:00' },
    'emp-rayssa':
      mode === 'TRAD_V4'
        ? { start: '08:06', lunchStart: '14:00', lunchEnd: '15:00', end: '17:30' }
        : { start: '08:36', lunchStart: '14:00', lunchEnd: '15:00', end: '18:00' },
  };

  const jorgOpen = { start: '08:00', lunchStart: '12:00', lunchEnd: '13:00', end: '17:24' };
  const jorgClose =
    mode === 'TRAD_V4'
      ? { start: '08:06', lunchStart: '12:00', lunchEnd: '13:00', end: '17:30' }
      : { start: '08:36', lunchStart: '12:00', lunchEnd: '13:00', end: '18:00' };

  // Desacopla folgas úteis de Vendas p/ que Jorginho (S2 QUA, S4 SEG) SEMPRE encontre 4/4 L1 ativos!
  const salesPlans: Record<
    string,
    {
      satOff: number[];
      weekdayOff: Partial<Record<1 | 2 | 3 | 4, DayOfWeek>>;
      satChair?: Partial<Record<1 | 2 | 3 | 4, string>>;
    }
  > = {
    'emp-joao-alexandre': { satOff: [2, 4], weekdayOff: { 1: 'SEG', 3: 'TER' } },
    'emp-rosinaldo': { satOff: [2, 4], weekdayOff: { 1: 'QUA', 3: 'SEG' } },
    'emp-jair': { satOff: [1, 3], weekdayOff: { 2: 'SEG', 4: 'TER' } },
    'emp-marcos-antonio': {
      satOff: [1],
      weekdayOff: { 2: 'SEG', 3: 'TER', 4: 'QUA' },
      satChair: { 4: 'VEND-L2-EXT' },
    },
    'emp-rayssa': {
      satOff: [3],
      weekdayOff: { 1: 'TER', 2: 'QUA', 4: 'SEG' },
      satChair: { 2: 'VEND-L2-EXT' },
    },
  };

  for (const emp of baseV3.employees) {
    const plan = salesPlans[emp.id];
    if (!plan || !emp.weeksSchedule) continue;

    for (const w of WEEK_NUMS) {
      const isSatOff = plan.satOff.includes(w);
      const wOff = plan.weekdayOff[w];
      const slot =
        emp.id === 'emp-rosinaldo' ? (w % 2 === 1 ? jorgOpen : jorgClose) : openSlotByEmp[emp.id];

      for (const d of ['SEG', 'TER', 'QUA', 'QUI', 'SEX'] as DayOfWeek[]) {
        emp.weeksSchedule[w][d] =
          !isSatOff && wOff === d
            ? { day: d, type: 'FOLGA_5X2', chairId: emp.defaultChairId, label: 'Folga 5x2' }
            : {
                day: d,
                type: 'TRABALHO',
                chairId: emp.defaultChairId,
                startTime: slot.start,
                lunchStart: slot.lunchStart,
                lunchEnd: slot.lunchEnd,
                endTime: slot.end,
              };
      }

      const satChair = plan.satChair?.[w] || emp.defaultChairId;
      emp.weeksSchedule[w].SAB = isSatOff
        ? { day: 'SAB', type: 'FOLGA_5X2', chairId: emp.defaultChairId, label: 'Folga Sábado (5x2)' }
        : { day: 'SAB', type: 'TRABALHO', chairId: satChair, startTime: '08:00', endTime: satEnd };
    }
    emp.schedule = JSON.parse(JSON.stringify(emp.weeksSchedule[1]));
  }

  return baseV3;
}

function buildPostLicenseScenarios(baseCenB5050: Scenario): { legacy: Scenario; sandboxV4: Scenario } {
  // Simula retorno de Grazy (SC-1 ativa como CLT_ATIVO) e saída do temporário Jorge Vinicius
  const postLicenseBaseEmployees = baseCenB5050.employees
    .filter((e) => e.id !== 'emp-jorge')
    .map((e) => {
      if (e.id !== 'emp-grazy') return JSON.parse(JSON.stringify(e)) as Employee;
      const g = JSON.parse(JSON.stringify(e)) as Employee;
      g.contractType = 'CLT_ATIVO';
      g.shortName = 'Grazy';
      g.defaultLunchStart = '12:00';
      g.defaultLunchEnd = '13:00';
      return g;
    });

  const legacyGenerated = createOptimizedScenarios(postLicenseBaseEmployees).find(
    (s) => s.id === 'scen-opt-b-est-5050'
  )!;
  legacyGenerated.id = 'pos-licenca-legado-cenb';
  legacyGenerated.name = 'Simulação Pós-Licença Grazy no Código Atual (Sem Herança SC-1)';

  // No Sandbox v4 Pós-Licença, Grazy herda exatamente a matriz SC-1 desacoplada de Jorge Vinicius
  const v4WithJorge = applySandboxV4Transform(baseCenB5050, 'CENB_V4');
  const jorgeTemplate = v4WithJorge.employees.find((e) => e.id === 'emp-jorge')!;
  const v4Employees = v4WithJorge.employees
    .filter((e) => e.id !== 'emp-jorge')
    .map((e) => {
      if (e.id !== 'emp-grazy') return e;
      const g = JSON.parse(JSON.stringify(e)) as Employee;
      g.contractType = 'CLT_ATIVO';
      g.shortName = 'Grazy';
      g.defaultLunchStart = '12:00';
      g.defaultLunchEnd = '13:00';
      g.weeksSchedule = JSON.parse(JSON.stringify(jorgeTemplate.weeksSchedule));
      g.schedule = JSON.parse(JSON.stringify(jorgeTemplate.schedule));
      return g;
    });

  const sandboxV4: Scenario = {
    ...v4WithJorge,
    id: 'sandbox-pos-licenca-v4',
    name: 'Sandbox Pós-Licença Grazy v4 (Herança SC-1 Desacoplada = 0 Risco)',
    employees: v4Employees,
  };

  return { legacy: legacyGenerated, sandboxV4 };
}

function printAuditBlock(a: DeepScenarioAudit) {
  console.log(`[${a.id}] ${a.name}`);
  console.log(
    `  ★ SCORE QUALIDADE: ${a.qualityScore.total.toFixed(1)}/100 (c/ Cobertura Cruzada Mapeada: ${a.coverageAwareScore.toFixed(1)}/100) [${a.qualityScore.breakdown}]`
  );
  console.log(
    `  • Aproveitamento 42h: ${a.utilization42hPct.toFixed(1)}% (${formatHoursDecimal(a.avgWeeklyHoursClt)}/sem média) | Pico diário: ${a.maxDailyMinutesObserved} min (${a.within8h24Cap ? 'OK <= 8h24' : 'EXCEDEU 8h24'}) | Dispersão mensal CLT: ${a.monthlyBalanceSpreadHours}h [${a.monthlyExtremesLabel}]`
  );
  console.log(
    `  • Compliance: ${a.complianceErrorCount} erros | Avisos operacionais: ${a.operationalWarningCount} | Setores descobertos: ${a.uncoveredSectorsTotal}`
  );
  console.log(
    `  • FDS prolongados (Sáb+Dom+Seg): ${a.prolongedWeekendsCount} ocorrências | CLTs c/ ZERO FDS prolongado (${a.employeesWithZeroProlongedWeekend.length}): ${a.employeesWithZeroProlongedWeekend.join(', ') || 'nenhum'}`
  );
  if (a.tightestInterjornada) {
    console.log(
      `  • Menor interjornada: ${a.tightestInterjornada.employee} em S${a.tightestInterjornada.week} (${a.tightestInterjornada.transition}) = ${(a.tightestInterjornada.restMinutes / 60).toFixed(2)}h (${a.tightestInterjornada.restMinutes} min)`
    );
  }
  console.log(
    `  • Pico simultâneo de almoço (S1–S4): ${
      a.peakLunchConcurrency.length === 0
        ? 'ZERO (>= 50% fora simultâneo eliminado!)'
        : a.peakLunchConcurrency
            .map((p) => `${p.store}/${p.department} (S${p.week} ${p.day} ${p.window}: ${p.onLunchCount}/${p.workingCount} fora -> ${p.namesOnLunch.join('+')})`)
            .join(' | ')
    }`
  );
  if (a.soloCoverageGaps.length > 0) {
    console.log(
      `  • Especialistas únicos ausentes na semana/sábado: ${a.soloCoverageGaps
        .map((g) => `${g.employee} [${g.department}]: ${g.daysOffCountIn4Weeks} dias (${g.sampleOffDays.join(', ')})`)
        .join(' ; ')}`
    );
  }
  console.log(
    `  • Pontos cegos ABERTURA/FECHAMENTO (S1–S4): ${
      a.openingClosingBlindspots.length === 0
        ? 'ZERO pontas descobertas!'
        : a.openingClosingBlindspots
            .map((b) => `${b.group} ${b.windowType} (${b.hourWindow}): ${b.occurrencesCount} dias sem ninguém [${b.sampleDays.slice(0, 6).join(', ')}${b.sampleDays.length > 6 ? '...' : ''}]`)
            .join(' | ')
    }`
  );
  console.log(
    `  • Risco Sábado L2 Doc+SC (Supervisão/Pós-Venda juntos fora): ${
      a.l2SeniorSaturdayRisk.length === 0 ? 'ZERO' : a.l2SeniorSaturdayRisk.join(' ; ')
    }`
  );
  console.log(
    `  • Rodada #5 | Colisão Vendas-Ext vs L1 (<100%): ${
      a.jorginhoCollisionDays.length === 0 ? 'ZERO (4/4 L1 em TODAS as folgas úteis!)' : a.jorginhoCollisionDays.join(', ')
    } | Almoço FIN sem Marielly: ${a.l2FinLunchRiskDays.length}/20 dias [${a.criticalDaysMinSummary}]`
  );
  console.log(
    `  • Rodada #6 | Colisão Interna (< n-1 no setor útil): ${
      a.internalWeekdayCollisions.length === 0
        ? 'ZERO (nenhum setor multi-pessoa caiu <=50% em Seg–Sex)'
        : a.internalWeekdayCollisions.join(' | ')
    }`
  );
  console.log('');
}

type PlanSlotOverride = { start: string; lunchStart: string; lunchEnd: string; end: string };
type CustomMonthPlan = {
  satOff: number[];
  weekdayOff: Partial<Record<1 | 2 | 3 | 4, DayOfWeek>>;
  satChair?: Partial<Record<1 | 2 | 3 | 4, string>>;
  slotByWeek?: Partial<Record<1 | 2 | 3 | 4, PlanSlotOverride>>;
  dayOverride?: Partial<Record<1 | 2 | 3 | 4, Partial<Record<DayOfWeek, PlanSlotOverride>>>>;
};

function overrideCustomEmployeePlans(
  scenario: Scenario,
  plans: Record<string, CustomMonthPlan>,
  defaultSlotsByEmp: Record<string, PlanSlotOverride>,
  satEnd: '13:00' | '14:00'
) {
  for (const emp of scenario.employees) {
    const plan = plans[emp.id];
    const baseSlot = defaultSlotsByEmp[emp.id];
    if (!plan || !baseSlot || !emp.weeksSchedule) continue;
    for (const w of WEEK_NUMS) {
      const isSatOff = plan.satOff.includes(w);
      const wOff = plan.weekdayOff[w];
      const baseWeekSlot = plan.slotByWeek?.[w] ?? baseSlot;
      for (const d of ['SEG', 'TER', 'QUA', 'QUI', 'SEX'] as DayOfWeek[]) {
        const slot = plan.dayOverride?.[w]?.[d] ?? baseWeekSlot;
        emp.weeksSchedule[w][d] =
          !isSatOff && wOff === d
            ? { day: d, type: 'FOLGA_5X2', chairId: emp.defaultChairId, label: 'Folga 5x2' }
            : {
                day: d,
                type: 'TRABALHO',
                chairId: emp.defaultChairId,
                startTime: slot.start,
                lunchStart: slot.lunchStart,
                lunchEnd: slot.lunchEnd,
                endTime: slot.end,
              };
      }
      const satChair = plan.satChair?.[w] || emp.defaultChairId;
      emp.weeksSchedule[w].SAB = isSatOff
        ? { day: 'SAB', type: 'FOLGA_5X2', chairId: emp.defaultChairId, label: 'Folga Sábado (5x2)' }
        : { day: 'SAB', type: 'TRABALHO', chairId: satChair, startTime: '08:00', endTime: satEnd };
    }
    emp.schedule = JSON.parse(JSON.stringify(emp.weeksSchedule[1]));
  }
}

function getSandboxV3Slots(mode: 'TRAD' | 'CENB'): Record<string, PlanSlotOverride> {
  const isTrad = mode === 'TRAD';
  return {
    'emp-diana': { start: '08:00', lunchStart: '11:00', lunchEnd: '12:00', end: '17:24' },
    'emp-andria': { start: '08:00', lunchStart: '12:00', lunchEnd: '13:00', end: '17:24' },
    'emp-adriane': {
      start: isTrad ? '08:06' : '08:36',
      lunchStart: '13:00',
      lunchEnd: '14:00',
      end: isTrad ? '17:30' : '18:00',
    },
    'emp-winona': {
      start: isTrad ? '08:06' : '08:36',
      lunchStart: '14:00',
      lunchEnd: '15:00',
      end: isTrad ? '17:30' : '18:00',
    },
    'emp-jair': { start: '08:00', lunchStart: '11:00', lunchEnd: '12:00', end: '17:24' },
    'emp-joao-alexandre': { start: '08:00', lunchStart: '12:00', lunchEnd: '13:00', end: '17:24' },
    'emp-marcos-antonio': {
      start: isTrad ? '08:06' : '08:36',
      lunchStart: '13:00',
      lunchEnd: '14:00',
      end: isTrad ? '17:30' : '18:00',
    },
    'emp-rayssa': {
      start: isTrad ? '08:06' : '08:36',
      lunchStart: '14:00',
      lunchEnd: '15:00',
      end: isTrad ? '17:30' : '18:00',
    },
    'emp-rosinaldo': { start: '08:00', lunchStart: '12:00', lunchEnd: '13:00', end: '17:24' },
  };
}

function applySandbox3SabFixedTransform(scen3Sab: Scenario, mode: 'TRAD' | 'CENB'): Scenario {
  const cloned = applySandboxTransform(scen3Sab, mode === 'TRAD' ? 'TRAD_V2' : 'CENB_V2');
  cloned.id = mode === 'TRAD' ? 'sandbox-trad-3sab-v6' : 'sandbox-cenb-3sab-v6';
  cloned.name =
    mode === 'TRAD'
      ? 'Sandbox Tradicional 75% Sáb v6 (Zero Colisão S2 Seg + 4 Ondas Almoço)'
      : 'Sandbox Cenário B 75% Sáb v6 (Zero Colisão S2 Seg + 4 Ondas Almoço)';

  const isTrad = mode === 'TRAD';
  const satEnd = isTrad ? '13:00' : '14:00';
  const openSlot = { start: '08:00', lunchStart: '12:00', lunchEnd: '13:00', end: '17:24' };
  const closeSlot = isTrad
    ? { start: '08:06', lunchStart: '12:00', lunchEnd: '13:00', end: '17:30' }
    : { start: '08:36', lunchStart: '12:00', lunchEnd: '13:00', end: '18:00' };
  const slots = getSandboxV3Slots(mode);

  // Corrige S2 Seg (Jair + João Alex) e S4 Ter (Andria + Diana), garantindo abertura/fechamento 100% em L1+L2 Doc+SC
  const plans3SabV6: Record<string, CustomMonthPlan> = {
    'emp-diana': { satOff: [2], weekdayOff: { 1: 'TER', 3: 'SEG', 4: 'QUI' } },
    'emp-joao-alexandre': { satOff: [1], weekdayOff: { 2: 'SEG', 3: 'TER', 4: 'QUA' } },
    'emp-rosinaldo': {
      satOff: [1],
      weekdayOff: { 2: 'SEG', 3: 'TER', 4: 'QUA' },
      slotByWeek: { 1: openSlot, 2: closeSlot, 3: openSlot, 4: closeSlot },
    },
    'emp-jair': { satOff: [2], weekdayOff: { 1: 'TER', 3: 'SEG', 4: 'TER' } },
    'emp-marcos-antonio': { satOff: [3], weekdayOff: { 1: 'QUA', 2: 'TER', 4: 'SEG' } },
    'emp-rayssa': {
      satOff: [4],
      weekdayOff: { 1: 'SEG', 2: 'QUA', 3: 'QUA' },
      satChair: { 1: 'VEND-L2-EXT' },
    },
    'emp-marielly': {
      satOff: [1],
      weekdayOff: { 2: 'SEG', 3: 'TER', 4: 'TER' },
      slotByWeek: {
        1: { start: '08:00', lunchStart: '11:00', lunchEnd: '12:00', end: '17:24' },
        2: { start: '08:00', lunchStart: '11:00', lunchEnd: '12:00', end: '17:24' },
        3: { start: '08:00', lunchStart: '11:00', lunchEnd: '12:00', end: '17:24' },
        4: { start: '08:00', lunchStart: '11:00', lunchEnd: '12:00', end: '17:24' },
      },
    },
    'emp-jorge': {
      satOff: [2],
      weekdayOff: { 1: 'TER', 3: 'SEG', 4: 'QUA' },
      slotByWeek: { 1: closeSlot, 2: closeSlot, 3: closeSlot, 4: closeSlot },
      dayOverride: {
        2: { SEG: openSlot },
        3: { TER: openSlot },
        4: { TER: openSlot },
      },
    },
    'emp-mayana': {
      satOff: [3],
      weekdayOff: { 1: 'QUA', 2: 'TER', 4: 'SEG' },
      slotByWeek: {
        1: { start: closeSlot.start, lunchStart: '13:00', lunchEnd: '14:00', end: closeSlot.end },
        2: { start: closeSlot.start, lunchStart: '13:00', lunchEnd: '14:00', end: closeSlot.end },
        3: { start: closeSlot.start, lunchStart: '13:00', lunchEnd: '14:00', end: closeSlot.end },
        4: { start: closeSlot.start, lunchStart: '13:00', lunchEnd: '14:00', end: closeSlot.end },
      },
    },
  };

  overrideCustomEmployeePlans(cloned, plans3SabV6, {
    ...slots,
    'emp-marielly': openSlot,
    'emp-jorge': closeSlot,
    'emp-mayana': closeSlot,
  }, satEnd);

  return cloned;
}

function runQuarterly12WeekComparison(cenB5050: Scenario, cenBV3: Scenario) {
  console.log('=== AUDITORIA TRIMESTRAL 12 SEMANAS (M1 -> M2 -> M3) — RODADA #6 ===');
  const slots = getSandboxV3Slots('CENB');
  const jorgOpen = { start: '08:00', lunchStart: '12:00', lunchEnd: '13:00', end: '17:24' };
  const jorgClose = { start: '08:36', lunchStart: '12:00', lunchEnd: '13:00', end: '18:00' };

  // M1: Cenário B v3 (já Pareto-ótimo: 0 colisões <3/4 L1, 90.8 base / 94.1 c/ backup)
  const m1 = JSON.parse(JSON.stringify(cenBV3)) as Scenario;
  m1.id = 'trimestre-m1-v3';

  // M2: Rotação justa de sábados em Vendas (Marcos/Rayssa passam a 2 sábados; Jair/Jorginho fazem 3) + 1 FDS Prolongado para Andria (S6 SEG c/ 3/4 SDR)
  const m2 = JSON.parse(JSON.stringify(cenBV3)) as Scenario;
  m2.id = 'trimestre-m2-v6';
  const m2Plans: Record<string, CustomMonthPlan> = {
    'emp-joao-alexandre': { satOff: [2, 4], weekdayOff: { 1: 'SEG', 3: 'TER' } },
    'emp-marcos-antonio': { satOff: [1, 3], weekdayOff: { 2: 'TER', 4: 'SEG' } },
    'emp-rayssa': {
      satOff: [2, 4],
      weekdayOff: { 1: 'TER', 3: 'SEG' },
      satChair: { 3: 'VEND-L2-EXT' },
    },
    'emp-jair': { satOff: [1], weekdayOff: { 2: 'SEG', 3: 'QUA', 4: 'TER' } },
    'emp-rosinaldo': {
      satOff: [3],
      weekdayOff: { 1: 'QUA', 2: 'QUA', 4: 'SEG' },
      slotByWeek: { 1: jorgOpen, 2: jorgClose, 3: jorgOpen, 4: jorgClose },
    },
    // Andria ganha 1 FDS prolongado (S5 Sáb OFF -> S6 SEG OFF) enquanto Adriane passa p/ S6 TER: SDR Seg mantém 3/4!
    'emp-andria': { satOff: [1, 3], weekdayOff: { 2: 'SEG', 4: 'TER' } },
    'emp-adriane': { satOff: [1, 3], weekdayOff: { 2: 'TER', 4: 'SEG' } },
  };
  overrideCustomEmployeePlans(m2, m2Plans, slots, '14:00');

  // M3: Fecha equidade trimestral de sábados em Vendas -> [7, 7, 7, 7, 8] sábados trabalhados (4 vendedores c/ 5 folgas Sáb, 1 c/ 4)
  const m3 = JSON.parse(JSON.stringify(cenBV3)) as Scenario;
  m3.id = 'trimestre-m3-v6';
  const m3Plans: Record<string, CustomMonthPlan> = {
    'emp-jair': { satOff: [1, 3], weekdayOff: { 2: 'SEG', 4: 'TER' } },
    'emp-rosinaldo': {
      satOff: [1, 3],
      weekdayOff: { 2: 'TER', 4: 'SEG' },
      slotByWeek: { 1: jorgOpen, 2: jorgClose, 3: jorgOpen, 4: jorgClose },
    },
    'emp-marcos-antonio': { satOff: [2, 4], weekdayOff: { 1: 'SEG', 3: 'QUA' } },
    'emp-joao-alexandre': { satOff: [2], weekdayOff: { 1: 'QUA', 3: 'SEG', 4: 'QUA' } },
    'emp-rayssa': {
      satOff: [4],
      weekdayOff: { 1: 'TER', 2: 'QUA', 3: 'TER' },
      satChair: { 1: 'VEND-L2-EXT', 3: 'VEND-L2-EXT' },
    },
  };
  overrideCustomEmployeePlans(m3, m3Plans, slots, '14:00');

  const trackIds = ['emp-joao-alexandre', 'emp-jair', 'emp-rosinaldo', 'emp-marcos-antonio', 'emp-rayssa', 'emp-andria'];
  const summarizeQuarterly = (label: string, months: Scenario[]) => {
    const audits = months.map(auditScenarioDeep);
    const errors = audits.reduce((s, a) => s + a.complianceErrorCount, 0);
    const uncovered = audits.reduce((s, a) => s + a.uncoveredSectorsTotal, 0);
    const internalColls = audits.flatMap((a, idx) => a.internalWeekdayCollisions.map((c) => `M${idx + 1} ${c}`));
    const finLunchMiss = audits.reduce((s, a) => s + a.l2FinLunchRiskDays.length, 0);
    const l2SatRisk = audits.reduce((s, a) => s + a.l2SeniorSaturdayRisk.length, 0);

    const sellerStats = trackIds.map((id) => {
      let satWorked = 0;
      let satOff = 0;
      let totalHours = 0;
      let shortName = id;
      for (const m of months) {
        const emp = m.employees.find((e) => e.id === id);
        if (!emp) continue;
        shortName = emp.shortName;
        const sum = calculateEmployeeMonthlySummary(emp, m.phase);
        totalHours += sum.totalMonthlyHours;
        for (const w of WEEK_NUMS) {
          if (emp.weeksSchedule?.[w]?.SAB?.type === 'TRABALHO') satWorked++;
          else satOff++;
        }
      }
      return { id, shortName, satWorked, satOff, totalHours };
    });

    const sellersOnly = sellerStats.filter((s) => s.id !== 'emp-andria');
    const hrsList = sellersOnly.map((s) => s.totalHours);
    const spread12w = Number((Math.max(...hrsList) - Math.min(...hrsList)).toFixed(2));
    const andriaFdsProlCount = audits.reduce((acc, _a, idx) => {
      const mRes = analyzeScenarioMetrics(months[idx]);
      return acc + mRes.prolongedWeekends.filter((p) => p.employeeId === 'emp-andria').length;
    }, 0);

    console.log(`  [${label}]`);
    console.log(
      `    • Compliance 12 sem: ${errors} erros | Setores desc: ${uncovered} | Risco Sáb L2 Doc+SC: ${l2SatRisk} | Déficit Almoço FIN: ${finLunchMiss}/60 dias úteis`
    );
    console.log(
      `    • Colisões Internas (< n-1 em Seg–Sex nas 12 sem): ${internalColls.length === 0 ? 'ZERO' : internalColls.join(' | ')}`
    );
    console.log(
      `    • Sábados Trabalhados/Folgados (Vendas, 12 Sáb): ${sellersOnly
        .map((s) => `${s.shortName}=${s.satWorked}T/${s.satOff}F (${formatHoursDecimal(s.totalHours)})`)
        .join(' | ')}`
    );
    console.log(
      `    • Dispersão Trimestral em Vendas (máx - mín 12 sem): ${spread12w}h | Andria (SDR) FDS Prolongados no Trimestre: ${andriaFdsProlCount}`
    );
  };

  summarizeQuarterly('Atual Cenário B 50/50 × 3 Meses (Legado)', [cenB5050, cenB5050, cenB5050]);
  summarizeQuarterly('Rodada #6 Trimestral Pareto-Ótimo (M1 v3 + M2 Rotação + M3 Equidade)', [m1, m2, m3]);
  console.log('');

  return [m1, m2, m3];
}

function applyMonthWindowSchedule(
  scenario: Scenario,
  byWeekSlot: Record<string, { w12: PlanSlotOverride; w34?: PlanSlotOverride }>
) {
  for (const emp of scenario.employees) {
    const spec = byWeekSlot[emp.id];
    if (!spec || !emp.weeksSchedule) continue;
    for (const w of WEEK_NUMS) {
      const slot = w <= 2 || !spec.w34 ? spec.w12 : spec.w34;
      for (const d of ['SEG', 'TER', 'QUA', 'QUI', 'SEX'] as DayOfWeek[]) {
        const sh = emp.weeksSchedule[w]?.[d];
        if (sh && sh.type === 'TRABALHO') {
          sh.startTime = slot.start;
          sh.lunchStart = slot.lunchStart;
          sh.lunchEnd = slot.lunchEnd;
          sh.endTime = slot.end;
        }
      }
    }
    emp.schedule = JSON.parse(JSON.stringify(emp.weeksSchedule[1]));
  }
}

function runShiftWindowEquityAudit(cenBV3: Scenario, baseQuarterM123: Scenario[]) {
  console.log('=== RODADA #7A: EQUIDADE INTRADIA (FECHAMENTO 18h + ZELADORIA 08h/18h) — BASE vs TRIMESTRAL ROTATIVO ===');

  const groups: Array<{ label: string; ids: string[] }> = [
    { label: 'L1-SDR', ids: ['emp-diana', 'emp-andria', 'emp-adriane', 'emp-winona'] },
    { label: 'L1-VENDAS', ids: ['emp-joao-alexandre', 'emp-jair', 'emp-marcos-antonio', 'emp-rayssa'] },
    { label: 'L1-PREP', ids: ['emp-allisson', 'emp-rodolfo', 'emp-marcos-florentino', 'emp-alefy'] },
    { label: 'L2-DOC+SC', ids: ['emp-marielly', 'emp-jorge', 'emp-mayana'] },
  ];

  const summarizeWindows = (label: string, months: Scenario[]) => {
    console.log(`  [${label}]`);
    const audits = months.map(auditScenarioDeep);
    const totalBlindspots = audits.reduce(
      (s, a) => s + a.openingClosingBlindspots.reduce((k, b) => k + b.occurrencesCount, 0),
      0
    );
    const totalColls = audits.reduce((s, a) => s + a.internalWeekdayCollisions.length, 0);
    const totalErrors = audits.reduce((s, a) => s + a.complianceErrorCount, 0);
    const minRest = Math.min(...audits.map((a) => a.tightestInterjornada?.restMinutes ?? 999));

    const nonExtBlindspots = audits.flatMap((a, mIdx) =>
      a.openingClosingBlindspots
        .filter((b) => !b.group.includes('VENDAS-EXT'))
        .map((b) => `M${mIdx + 1} ${b.group} ${b.windowType}(${b.occurrencesCount}): ${b.sampleDays.join(',')}`)
    );
    const finLunchMiss = audits.reduce((s, a) => s + a.l2FinLunchRiskDays.length, 0);

    console.log(
      `    • Saúde 12 sem: ${totalErrors} erros CLT | ${totalColls} colisões <n-1 | Déficit Almoço FIN: ${finLunchMiss}/60d | ${totalBlindspots} blindspots 08h/18h (${
        nonExtBlindspots.length === 0 ? 'ZERO fora de L2-VENDAS-EXT' : nonExtBlindspots.join(' ; ')
      }) | menor interjornada ${(minRest / 60).toFixed(1)}h`
    );

    for (const g of groups) {
      const counts = g.ids.map((id) => {
        let openShifts = 0;
        let closeShifts = 0;
        let extremeLunch11or14 = 0;
        let shortName = id;
        for (const m of months) {
          const emp = m.employees.find((e) => e.id === id);
          if (!emp) continue;
          shortName = emp.shortName;
          for (const w of WEEK_NUMS) {
            for (const d of ['SEG', 'TER', 'QUA', 'QUI', 'SEX'] as DayOfWeek[]) {
              const sh = emp.weeksSchedule?.[w]?.[d];
              if (sh?.type === 'TRABALHO') {
                if (sh.startTime === '08:00' && sh.endTime === '17:24') openShifts++;
                if (sh.endTime === '18:00') closeShifts++;
                if (sh.lunchStart === '11:00' || sh.lunchStart === '14:00') extremeLunch11or14++;
              }
            }
          }
        }
        return { id, shortName, openShifts, closeShifts, extremeLunch11or14 };
      });
      const closes = counts.map((c) => c.closeShifts);
      const extremes = counts.map((c) => c.extremeLunch11or14);
      const closeGap = Math.max(...closes) - Math.min(...closes);
      const lunchGap = Math.max(...extremes) - Math.min(...extremes);
      console.log(
        `    • ${g.label.padEnd(9)} | Gap Fechamento=${String(closeGap).padStart(2)}t Gap AlmoçoExt=${String(lunchGap).padStart(2)}d -> ${counts
          .map((c) => `${c.shortName}:${c.closeShifts}F/${c.openShifts}A(${c.extremeLunch11or14}x)`)
          .join(' | ')}`
      );
    }

    // Checar Zeladoria (Marcos Flor. + Alefy) especificamente para cobertura 08h e 18h no trimestre
    let zelMissOpen = 0;
    let zelMissClose = 0;
    for (const m of months) {
      const mf = m.employees.find((e) => e.id === 'emp-marcos-florentino');
      const al = m.employees.find((e) => e.id === 'emp-alefy');
      for (const w of WEEK_NUMS) {
        for (const d of ['SEG', 'TER', 'QUA', 'QUI', 'SEX'] as DayOfWeek[]) {
          const mfSh = mf?.weeksSchedule?.[w]?.[d];
          const alSh = al?.weeksSchedule?.[w]?.[d];
          const hasOpen =
            (mfSh?.type === 'TRABALHO' && mfSh.startTime === '08:00') ||
            (alSh?.type === 'TRABALHO' && alSh.startTime === '08:00');
          const hasClose =
            (mfSh?.type === 'TRABALHO' && mfSh.endTime === '18:00') ||
            (alSh?.type === 'TRABALHO' && alSh.endTime === '18:00');
          if (!hasOpen) zelMissOpen++;
          if (!hasClose) zelMissClose++;
        }
      }
    }
    console.log(
      `    • Zeladoria (Marcos Flor. + Alefy) em Seg–Sex (60d): ${zelMissOpen} dias s/ abertura 08:00 | ${zelMissClose} dias s/ fechamento 18:00`
    );
  };

  summarizeWindows('Cenário B v3 Fixo × 3 Meses (Baseline s/ Rotação de Turno)', [cenBV3, cenBV3, cenBV3]);

  // Montar Rotação Trimestral de Turnos (M1, M2, M3) sobre a base de Rodada #6
  const rotMonths = baseQuarterM123.map((m) => JSON.parse(JSON.stringify(m)) as Scenario);
  const [rm1, rm2, rm3] = rotMonths;
  rm1.id = 'trimestre-m1-v7-janelas';
  rm2.id = 'trimestre-m2-v7-janelas';
  rm3.id = 'trimestre-m3-v7-janelas';

  const open11: PlanSlotOverride = { start: '08:00', lunchStart: '11:00', lunchEnd: '12:00', end: '17:24' };
  const open12: PlanSlotOverride = { start: '08:00', lunchStart: '12:00', lunchEnd: '13:00', end: '17:24' };
  const close13: PlanSlotOverride = { start: '08:36', lunchStart: '13:00', lunchEnd: '14:00', end: '18:00' };
  const close14: PlanSlotOverride = { start: '08:36', lunchStart: '14:00', lunchEnd: '15:00', end: '18:00' };

  // M1: Zeladoria 1 na abertura (Marcos Flor.) + 1 no fechamento (Alefy); L1-SDR e L1-VENDAS mantêm pares Pareto
  applyMonthWindowSchedule(rm1, {
    'emp-allisson': { w12: open11 },
    'emp-marcos-florentino': { w12: open12 },
    'emp-rodolfo': { w12: close13 },
    'emp-alefy': { w12: close14 },
  });

  // M2: Inverte pares Abertura <-> Fechamento em SDR, Vendas e Prep (Alefy na abertura 08h, Marcos Flor. no fechamento 18h)
  // Regra estrutural L2-FIN: Marielly permanece âncora 08:00–17:24 (almoço 11h–12h c/ João Pedro), enquanto Mayana+Jorge alternam sem gerar déficit FIN
  applyMonthWindowSchedule(rm2, {
    'emp-adriane': { w12: open11 },
    'emp-winona': { w12: open12 },
    'emp-diana': { w12: close13 },
    'emp-andria': { w12: close14 },

    'emp-marcos-antonio': { w12: open11 },
    'emp-rayssa': { w12: open12 },
    'emp-jair': { w12: close13 },
    'emp-joao-alexandre': { w12: close14 },

    'emp-rodolfo': { w12: open11 },
    'emp-alefy': { w12: open12 },
    'emp-allisson': { w12: close13 },
    'emp-marcos-florentino': { w12: close14 },

    // Marielly âncora 11h–12h para não destruir cobertura da tarde em L2-FIN; Mayana ganha 2 semanas de abertura 08h (W2 & W4 onde Jorge fecha 18h)
    'emp-marielly': { w12: open11 },
  });

  // M3: Quebra quinzenal (S1–S2 vs S3–S4) para atingir equidade exata 6/6/6/6 semanas fechamento + 11h/14h balanceado
  applyMonthWindowSchedule(rm3, {
    'emp-diana': { w12: open12, w34: close14 },
    'emp-winona': { w12: open11, w34: close13 },
    'emp-andria': { w12: close13, w34: open11 },
    'emp-adriane': { w12: close14, w34: open12 },

    'emp-jair': { w12: open11, w34: close14 },
    'emp-marcos-antonio': { w12: open12, w34: close13 },
    'emp-joao-alexandre': { w12: close13, w34: open11 },
    'emp-rayssa': { w12: close14, w34: open12 },

    'emp-allisson': { w12: open12, w34: close14 },
    'emp-marcos-florentino': { w12: open11, w34: close13 },
    'emp-rodolfo': { w12: close13, w34: open12 },
    'emp-alefy': { w12: close14, w34: open11 },

    'emp-marielly': { w12: open11 },
    'emp-mayana': { w12: close13 },
  });

  // Em rm2 e rm3, nos dias de S1, S3 e S4 em que Jorge fecha 18:00 e trabalha no mesmo dia (exceto S1 Qua, S3 Seg e S4 Ter), Mayana roda 08:00–17:24 (13h–14h)
  for (const rMonth of [rm2, rm3]) {
    const mayana = rMonth.employees.find((e) => e.id === 'emp-mayana');
    const jorge = rMonth.employees.find((e) => e.id === 'emp-jorge');
    if (mayana?.weeksSchedule && jorge?.weeksSchedule) {
      for (const w of [1, 3, 4] as const) {
        for (const d of ['SEG', 'TER', 'QUA', 'QUI', 'SEX'] as DayOfWeek[]) {
          const mSh = mayana.weeksSchedule[w]?.[d];
          const jSh = jorge.weeksSchedule[w]?.[d];
          if (mSh?.type === 'TRABALHO' && jSh?.type === 'TRABALHO' && jSh.endTime === '18:00') {
            mSh.startTime = '08:00';
            mSh.lunchStart = '13:00';
            mSh.lunchEnd = '14:00';
            mSh.endTime = '17:24';
          }
        }
      }
      mayana.schedule = JSON.parse(JSON.stringify(mayana.weeksSchedule[1]));
    }
  }

  summarizeWindows('Rodada #7 Rotativo (M1+M2+M3 c/ Equidade 18h + Zeladoria 08h/18h)', rotMonths);
  console.log('');
}

function runStressResilienceAudit(targets: Scenario[]) {
  console.log('=== RODADA #7B/8: TESTES DE ESTRESSE E RESILIÊNCIA OPERACIONAL (MÉTODO REAL coverage.ts) ===');

  const stressTargets = targets;

  console.log('  [1] MATRIZ N-1 DE FALTA IMPREVISTA DE 1 DIA (S1–S4 × Seg–Sáb):');
  for (const sc of stressTargets) {
    const emps = sc.employees.map(ensureEmployeeWeeksSchedule);
    let testedWorkerDays = 0;
    let fragileTotal = 0;
    let fragileWeekdays = 0;
    let fragileSaturdays = 0;
    let criticalDrops = 0;
    let satL2ExtBreaks = 0;
    const hitBySector = new Map<string, number>();

    for (const w of WEEK_NUMS) {
      const weekEmps = emps.map((e) => ({
        ...e,
        schedule: JSON.parse(JSON.stringify(e.weeksSchedule![w])),
      }));

      for (const dKey of ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'] as DayOfWeek[]) {
        // Só testar ativos CLT que estão escalados como TRABALHO neste dia
        const activeToday = weekEmps.filter(
          (e) =>
            (e.contractType === 'CLT_ATIVO' || e.contractType === 'CLT_TEMPORARIO') &&
            e.schedule[dKey]?.type === 'TRABALHO'
        );

        for (const absent of activeToday) {
          testedWorkerDays++;
          const simEmps = weekEmps.map((e) =>
            e.id === absent.id
              ? {
                  ...e,
                  schedule: {
                    ...e.schedule,
                    [dKey]: { day: dKey, type: 'FOLGA_5X2' as const, chairId: e.defaultChairId, label: 'Sim. Falta' },
                  },
                }
              : e
          );
          const cov = calculateSectorDailyCoverage(simEmps, dKey);
          const broken = cov.filter((c) => c.status !== 'SEGURO');
          if (broken.length > 0) {
            fragileTotal++;
            if (dKey === 'SAB') fragileSaturdays++;
            else fragileWeekdays++;
            if (broken.some((b) => b.status === 'CRITICO')) criticalDrops++;
            for (const b of broken) {
              hitBySector.set(b.sector.id, (hitBySector.get(b.sector.id) ?? 0) + 1);
            }
            if (dKey === 'SAB' && broken.some((b) => b.sector.id === 'L2-VENDAS-EXT')) {
              satL2ExtBreaks++;
            }
          }
        }
      }
    }

    const topSectors = Array.from(hitBySector.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([sec, cnt]) => `${sec}:${cnt}`)
      .join(', ');
    const pctFragile = ((fragileTotal / testedWorkerDays) * 100).toFixed(1);
    console.log(
      `    • [${sc.id}] ${fragileTotal}/${testedWorkerDays} faltas sensíveis (${pctFragile}%) | Seg–Sex=${fragileWeekdays} | Sáb=${fragileSaturdays} (queima L2-VENDAS-EXT=${satL2ExtBreaks}) | CRÍTICO=${criticalDrops} | Top setores: ${topSectors}`
    );
  }

  console.log('  [2] ESTUDO DE SÁBADOS EM LOJA 2 (DOC+SC 08:00–14:00) + AUSÊNCIA DO ESTAGIÁRIO MATHEUS:');
  for (const sc of stressTargets) {
    const emps = sc.employees.map(ensureEmployeeWeeksSchedule);
    const l2DocIds = new Set(['emp-marielly', 'emp-jorge', 'emp-mayana']);
    const satEndMin = parseTimeToMinutes(sc.storeHours?.LOJA_2?.saturdayClose || '14:00');
    const satStartMin = parseTimeToMinutes(sc.storeHours?.LOJA_2?.saturdayOpen || '08:00');
    const step = 10; // 10 min

    let soloHoursWithMatheus = 0;
    let emptyHoursWithMatheus = 0;
    let soloHoursNoMatheus = 0;
    let emptyHoursNoMatheus = 0;
    let oneCltSaturdays = 0;
    let criticalNoMatheusSats = 0;

    for (const w of WEEK_NUMS) {
      const cltSatActive = emps.filter(
        (e) => l2DocIds.has(e.id) && e.weeksSchedule?.[w]?.SAB?.type === 'TRABALHO'
      );
      if (cltSatActive.length <= 1) oneCltSaturdays++;

      const matheus = emps.find((e) => e.id === 'emp-matheus');
      const matSat = matheus?.weeksSchedule?.[w]?.SAB;

      // Checar coverage formal se Matheus faltar no sábado
      const simNoMat = emps.map((e) => ({
        ...e,
        schedule:
          e.id === 'emp-matheus'
            ? {
                ...e.weeksSchedule![w],
                SAB: { day: 'SAB' as const, type: 'FOLGA_5X2' as const, chairId: e.defaultChairId, label: 'Falta Estag' },
              }
            : e.weeksSchedule![w],
      }));
      const l2DocCov = calculateSectorDailyCoverage(simNoMat, 'SAB').find((c) => c.sector.id === 'L2-DOC');
      if (l2DocCov && l2DocCov.status !== 'SEGURO') criticalNoMatheusSats++;

      for (let m = satStartMin; m < satEndMin; m += step) {
        const cltCount = cltSatActive.filter((e) => {
          const sh = e.weeksSchedule![w].SAB;
          if (!sh.startTime || !sh.endTime) return false;
          return parseTimeToMinutes(sh.startTime) <= m && m < parseTimeToMinutes(sh.endTime);
        }).length;

        const matPresent =
          matSat?.type === 'TRABALHO' &&
          !!matSat.startTime &&
          !!matSat.endTime &&
          parseTimeToMinutes(matSat.startTime) <= m &&
          m < parseTimeToMinutes(matSat.endTime)
            ? 1
            : 0;

        const totalWithMat = cltCount + matPresent;
        if (totalWithMat === 0) emptyHoursWithMatheus += step / 60;
        else if (totalWithMat === 1) soloHoursWithMatheus += step / 60;

        if (cltCount === 0) emptyHoursNoMatheus += step / 60;
        else if (cltCount === 1) soloHoursNoMatheus += step / 60;
      }
    }

    console.log(
      `    • [${sc.id}] Sábados c/ 1 CLT=${oneCltSaturdays}/4 | Horas só c/ 1 pessoa (08h–08h40 / 12h40–14h c/ Matheus)=${soloHoursWithMatheus.toFixed(1)}h (0p=${emptyHoursWithMatheus.toFixed(1)}h) | Sem Matheus=${soloHoursNoMatheus.toFixed(1)}h solo (0p=${emptyHoursNoMatheus.toFixed(1)}h, Doc alerta Sáb=${criticalNoMatheusSats}/4)`
    );
  }

  console.log('  [3] FÉRIAS PROGRAMADAS NAILSON (L1-MKT, jan/2027 — 20 DIAS ÚTEIS):');
  for (const sc of stressTargets.filter((s) => s.id !== 'scen-opt-b-est-5050')) {
    const emps = sc.employees.map(ensureEmployeeWeeksSchedule);
    let cltZeroDays = 0;
    let leadershipCoveredDays = 0;
    let dualOverlapWithL2Fin = 0;

    for (const w of WEEK_NUMS) {
      for (const d of ['SEG', 'TER', 'QUA', 'QUI', 'SEX'] as DayOfWeek[]) {
        const weekEmps = emps.map((e) => {
          const clonedSh = JSON.parse(JSON.stringify(e.weeksSchedule![w]));
          if (e.id === 'emp-nailson') {
            clonedSh[d] = { day: d, type: 'LICENCA' as const, chairId: e.defaultChairId, label: 'Férias jan/2027' };
          }
          return { ...e, schedule: clonedSh };
        });
        const cov = calculateSectorDailyCoverage(weekEmps, d);
        const mkt = cov.find((c) => c.sector.id === 'L1-MKT');
        const marielly = weekEmps.find((e) => e.id === 'emp-marielly');
        if (mkt && mkt.activeHeadcount === 0) {
          cltZeroDays++;
          if (mkt.autoCoveredByPeersOrSkills) leadershipCoveredDays++;
          if (marielly && marielly.schedule[d]?.type !== 'TRABALHO') dualOverlapWithL2Fin++;
        }
      }
    }
    console.log(
      `    • [${sc.id}] L1-MKT c/ 0 CLT=${cltZeroDays}/20 dias úteis (~168h/mês) | Coberto nativamente por Igor=${leadershipCoveredDays}/20 | Sobrecarga dupla (L1-MKT=0 CLT + Marielly OFF sem backup de L2-FIN no almoço 12h–13h)=${dualOverlapWithL2Fin}/20 dias`
    );
  }
  console.log('');
}

function buildHybridSelectiveCore(
  baseV3: Scenario,
  base3Sab: Scenario,
  opts: {
    id: string;
    name: string;
    mode: 'TRAD' | 'CENB';
    jorgWeekdayOff: Partial<Record<1 | 2 | 3 | 4, DayOfWeek>>;
  }
): Scenario {
  const cloned = JSON.parse(JSON.stringify(baseV3)) as Scenario;
  cloned.id = opts.id;
  cloned.name = opts.name;

  const v6Emps = new Map(base3Sab.employees.map((e) => [e.id, ensureEmployeeWeeksSchedule(e)]));
  const sdrAndVendasL1 = new Set([
    'emp-diana',
    'emp-andria',
    'emp-adriane',
    'emp-winona',
    'emp-joao-alexandre',
    'emp-jair',
    'emp-marcos-antonio',
    'emp-rayssa',
  ]);

  for (const emp of cloned.employees) {
    if (!sdrAndVendasL1.has(emp.id)) continue;
    const src = v6Emps.get(emp.id);
    if (!src?.weeksSchedule) continue;
    emp.weeksSchedule = JSON.parse(JSON.stringify(src.weeksSchedule));
    if (emp.id === 'emp-rayssa' && emp.weeksSchedule?.[1]?.SAB) {
      emp.weeksSchedule[1].SAB.chairId = emp.defaultChairId;
    }
    emp.schedule = JSON.parse(JSON.stringify(emp.weeksSchedule![1]));
  }

  const isTrad = opts.mode === 'TRAD';
  const satEnd: '13:00' | '14:00' = isTrad ? '13:00' : '14:00';
  const closeStart = isTrad ? '08:06' : '08:36';
  const closeEnd = isTrad ? '17:30' : '18:00';

  const slots = getSandboxV3Slots(opts.mode);
  const open11: PlanSlotOverride = { start: '08:00', lunchStart: '11:00', lunchEnd: '12:00', end: '17:24' };
  const open12: PlanSlotOverride = { start: '08:00', lunchStart: '12:00', lunchEnd: '13:00', end: '17:24' };
  const close12: PlanSlotOverride = { start: closeStart, lunchStart: '12:00', lunchEnd: '13:00', end: closeEnd };
  const close13: PlanSlotOverride = { start: closeStart, lunchStart: '13:00', lunchEnd: '14:00', end: closeEnd };

  const hybridPlans: Record<string, CustomMonthPlan> = {
    'emp-marielly': {
      satOff: [2, 4],
      weekdayOff: { 1: 'TER', 3: 'SEG' },
      slotByWeek: { 1: open11, 2: open11, 3: open11, 4: open11 },
    },
    'emp-jorge': {
      satOff: [1],
      weekdayOff: { 2: 'SEG', 3: 'QUA', 4: 'TER' },
      slotByWeek: { 1: close12, 2: close12, 3: close12, 4: close12 },
      dayOverride: { 1: { TER: open12 }, 3: { SEG: open12 } },
    },
    'emp-mayana': {
      satOff: [3],
      weekdayOff: { 1: 'QUA', 2: 'TER', 4: 'SEG' },
      slotByWeek: { 1: close13, 2: close13, 3: close13, 4: close13 },
    },
    'emp-rosinaldo': {
      satOff: [2, 4],
      weekdayOff: opts.jorgWeekdayOff,
      slotByWeek: { 1: open12, 2: close12, 3: open12, 4: close12 },
    },
  };

  overrideCustomEmployeePlans(
    cloned,
    hybridPlans,
    {
      ...slots,
      'emp-marielly': open11,
      'emp-jorge': close12,
      'emp-mayana': close13,
      'emp-rosinaldo': open12,
    },
    satEnd
  );

  return cloned;
}

function buildHybridSelectiveV8(cenBV3: Scenario, cenB3SabV6: Scenario): Scenario {
  return buildHybridSelectiveCore(cenBV3, cenB3SabV6, {
    id: 'sandbox-cenb-hibrido-v8',
    name: 'Sandbox Cenário B Híbrido Setor-Seletivo v8 (SDR/Vendas/DOC 75% Sáb + Especialistas L2/PREP 50/50)',
    mode: 'CENB',
    jorgWeekdayOff: { 1: 'QUI', 3: 'QUI' },
  });
}

/**
 * Rodada #9 — [sandbox-cenb-hibrido-v9]:
 * Evolui o v8 preservando L1-SDR / L1-VENDAS / Jorge+Mayana em 75% Sáb (0.0h solo no sábado da Loja 2)
 * e especialistas/PREP em 50/50, ajustando apenas Jorginho para {S1: QUI, S3: SEG}.
 */
function buildHybridSelectiveV9(cenBHibridoV8: Scenario, cenB3SabV6: Scenario): Scenario {
  return buildHybridSelectiveCore(cenBHibridoV8, cenB3SabV6, {
    id: 'sandbox-cenb-hibrido-v9',
    name: 'Sandbox Cenário B Híbrido v9 (Setor-Seletivo + 100% Equidade FDS Prolongado em Vendas)',
    mode: 'CENB',
    jorgWeekdayOff: { 1: 'QUI', 3: 'SEG' },
  });
}

/**
 * Rodada #10 — [sandbox-trad-hibrido-v10]:
 * Espelha a arquitetura híbrida v9 para o horário padrão atual da loja (Seg–Sex 08:00–17:30, Sáb 08:00–13:00).
 */
function buildHybridSelectiveTradV10(tradV3: Scenario, trad3SabV6: Scenario): Scenario {
  return buildHybridSelectiveCore(tradV3, trad3SabV6, {
    id: 'sandbox-trad-hibrido-v10',
    name: 'Sandbox Tradicional Híbrido v10 (Setor-Seletivo 08h–17h30 / Sáb 13h + Equidade FDS Vendas)',
    mode: 'TRAD',
    jorgWeekdayOff: { 1: 'QUI', 3: 'SEG' },
  });
}

interface N1SolverSummary {
  totalBroken: number;
  solvedByInternalClt: number;
  solvedByCascadeClt: number;
  solvedByCirculatingLead: number;
  caseDetails: string[];
}

function solveN1WithLayers(sc: Scenario, enableFinCascade: boolean): N1SolverSummary {
  const sellerL1Ids = new Set(['emp-joao-alexandre', 'emp-jair', 'emp-marcos-antonio', 'emp-rayssa']);
  const sellerChairs = ['VEND-L1-1', 'VEND-L1-2', 'VEND-L1-3', 'VEND-L1-4'];
  const emps = sc.employees.map(ensureEmployeeWeeksSchedule);
  let totalBroken = 0;
  let solvedByInternalClt = 0;
  let solvedByCascadeClt = 0;
  let solvedByCirculatingLead = 0;
  const caseDetails: string[] = [];

  for (const w of WEEK_NUMS) {
    const weekEmps = emps.map((e) => ({
      ...e,
      schedule: JSON.parse(JSON.stringify(e.weeksSchedule![w])),
    }));

    for (const dKey of ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'] as DayOfWeek[]) {
      const activeToday = weekEmps.filter(
        (e) =>
          (e.contractType === 'CLT_ATIVO' || e.contractType === 'CLT_TEMPORARIO') &&
          e.schedule[dKey]?.type === 'TRABALHO'
      );

      for (const absent of activeToday) {
        const simEmps = weekEmps.map((e) =>
          e.id === absent.id
            ? {
                ...e,
                schedule: {
                  ...e.schedule,
                  [dKey]: { day: dKey, type: 'FOLGA_5X2' as const, chairId: e.defaultChairId, label: 'Sim. Falta' },
                },
              }
            : e
        );
        const cov = calculateSectorDailyCoverage(simEmps, dKey);
        const broken = cov.filter((c) => c.status !== 'SEGURO');
        if (broken.length === 0) continue;

        totalBroken++;
        let layer1Resolution: string | null = null;
        let usedCascade = false;

        // Tentar Camada 1: remanejamento realista entre cadeiras compativeis dentro dos ativos
        const primaryBrokenIds = broken.map((b) => b.sector.id);
        const candidates: Array<{ empId: string; toChair: string; label: string }> = [];

        if (primaryBrokenIds.includes('L2-VENDAS-EXT')) {
          for (const s of simEmps) {
            if (sellerL1Ids.has(s.id) && s.schedule[dKey]?.type === 'TRABALHO' && s.schedule[dKey].chairId !== 'VEND-L2-EXT') {
              candidates.push({ empId: s.id, toChair: 'VEND-L2-EXT', label: `Mover ${s.shortName} -> VEND-L2-EXT` });
            }
          }
        }
        if (primaryBrokenIds.includes('L1-VENDAS')) {
          const jorg = simEmps.find((s) => s.id === 'emp-rosinaldo');
          if (jorg?.schedule[dKey]?.type === 'TRABALHO') {
            candidates.push({ empId: jorg.id, toChair: 'VEND-L1-4', label: `Trazer Jorginho -> VEND-L1` });
          }
        }
        if (primaryBrokenIds.includes('L2-DOC')) {
          const allisson = simEmps.find((s) => s.id === 'emp-allisson');
          if (allisson?.schedule[dKey]?.type === 'TRABALHO') {
            candidates.push({ empId: allisson.id, toChair: 'DOC-AUX', label: `Mover Allisson -> DOC-AUX` });
          }
        }
        if (primaryBrokenIds.includes('L2-FIN')) {
          const marielly = simEmps.find((s) => s.id === 'emp-marielly');
          if (marielly?.schedule[dKey]?.type === 'TRABALHO') {
            candidates.push({ empId: marielly.id, toChair: 'FIN-1', label: `Alocar Marielly -> FIN-1` });
          }
        }
        if (primaryBrokenIds.includes('L1-SDR')) {
          const excessSeller = simEmps.find(
            (s) => sellerL1Ids.has(s.id) && s.schedule[dKey]?.type === 'TRABALHO' && sellerChairs.includes(s.schedule[dKey].chairId)
          );
          void excessSeller;
        }

        for (const cand of candidates) {
          const movedEmps = simEmps.map((e) =>
            e.id === cand.empId
              ? {
                  ...e,
                  schedule: {
                    ...e.schedule,
                    [dKey]: { ...e.schedule[dKey], chairId: cand.toChair },
                  },
                }
              : e
          );
          const covAfter = calculateSectorDailyCoverage(movedEmps, dKey);
          if (covAfter.every((c) => c.status === 'SEGURO')) {
            layer1Resolution = cand.label;
            break;
          }
        }

        // Camada 1B (Cascata Dupla R$0 CLT em L2-FIN quando Marielly esta de folga 5x2):
        // Allisson (L1-PREP > 2) assume DOC-AUX e libera Mayana (ou SC-1 ativo) -> FIN-1 sem furar pisos
        if (!layer1Resolution && enableFinCascade && primaryBrokenIds.includes('L2-FIN')) {
          const allisson = simEmps.find((s) => s.id === 'emp-allisson');
          const l2FinSecCandidates = ['emp-mayana', 'emp-jorge', 'emp-grazy'];
          if (allisson?.schedule[dKey]?.type === 'TRABALHO') {
            for (const finId of l2FinSecCandidates) {
              const secEmp = simEmps.find((s) => s.id === finId && s.schedule[dKey]?.type === 'TRABALHO');
              if (!secEmp) continue;
              const cascadeEmps = simEmps.map((e) => {
                if (e.id === allisson.id) {
                  return { ...e, schedule: { ...e.schedule, [dKey]: { ...e.schedule[dKey], chairId: 'DOC-AUX' } } };
                }
                if (e.id === secEmp.id) {
                  return { ...e, schedule: { ...e.schedule, [dKey]: { ...e.schedule[dKey], chairId: 'FIN-1' } } };
                }
                return e;
              });
              const covAfterCascade = calculateSectorDailyCoverage(cascadeEmps, dKey);
              if (covAfterCascade.every((c) => c.status === 'SEGURO')) {
                layer1Resolution = `Cascata Allisson->DOC-AUX + ${secEmp.shortName}->FIN-1`;
                usedCascade = true;
                break;
              }
            }
          }
        }

        if (layer1Resolution) {
          solvedByInternalClt++;
          if (usedCascade) solvedByCascadeClt++;
          caseDetails.push(
            `S${w} ${dKey} falta ${absent.shortName} (${primaryBrokenIds.join('+')}) -> [${usedCascade ? 'C1-Cascata CLT R$0' : 'C1 CLT'}: ${layer1Resolution}]`
          );
        } else {
          // Tentar Camada 2: Backup Circulante Oficial da Tabela SECTOR_DEFINITIONS.primaryBackups
          const primarySecDef = SECTOR_DEFINITIONS.find((sd) => sd.id === broken[0].sector.id);
          const backupLead = primarySecDef?.primaryBackups[0];
          if (backupLead) {
            const backedEmps = simEmps.map((e) =>
              e.id === absent.id
                ? {
                    ...e,
                    schedule: {
                      ...e.schedule,
                      [dKey]: {
                        ...e.schedule[dKey],
                        coverage: {
                          coveredByEmployeeId: backupLead.id,
                          coveredByName: backupLead.name,
                          status: 'ATRIBUIDO' as const,
                        },
                      },
                    },
                  }
                : e
            );
            const covAfterLead = calculateSectorDailyCoverage(backedEmps, dKey);
            if (covAfterLead.every((c) => c.status === 'SEGURO')) {
              solvedByCirculatingLead++;
              caseDetails.push(
                `S${w} ${dKey} falta ${absent.shortName} (${primaryBrokenIds.join('+')}) -> [C2 Liderança: ${backupLead.name.split(' ')[0]}]`
              );
              continue;
            }
          }
          caseDetails.push(
            `S${w} ${dKey} falta ${absent.shortName} (${primaryBrokenIds.join('+')}) -> [SEM MITIGAÇÃO ÚNICA]`
          );
        }
      }
    }
  }

  return { totalBroken, solvedByInternalClt, solvedByCascadeClt, solvedByCirculatingLead, caseDetails };
}

function runN1RedeploymentSolver(targets: Scenario[]) {
  console.log('=== RODADA #8A: BANCO DINÂMICO DE REMANEJAMENTO N-1 (SOLVER OPERACIONAL vs LIDERANÇA) ===');

  for (const sc of targets) {
    const res = solveN1WithLayers(sc, false);
    const totalMitigated = res.solvedByInternalClt + res.solvedByCirculatingLead;
    console.log(
      `  • [${sc.id}] ${res.totalBroken} casos críticos/alerta -> Camada 1 (Remanej. Interno CLT R$0)=${res.solvedByInternalClt} | Camada 2 (Liderança Circulante)=${res.solvedByCirculatingLead} | Mitigação total=${totalMitigated}/${res.totalBroken}`
    );
    for (const det of res.caseDetails) {
      console.log(`      - ${det}`);
    }
  }
  console.log('');
}

function runNailsonJan2027ContingencyAudit(cenBV3: Scenario, cenBHybridV8: Scenario) {
  console.log('=== RODADA #8B: PLANO ESPECIAL DE CONTINGÊNCIA NAILSON (FÉRIAS JAN/2027 — 20 DIAS ÚTEIS) ===');

  const evaluateScenario = (sc: Scenario, label: string) => {
    const emps = sc.employees.map(ensureEmployeeWeeksSchedule);
    let zeroMktDays = 0;
    let dualOverloadFinDays = 0;
    let allissonBackupDays = 0;
    let internalSupportHours = 0;
    const supportLog: string[] = [];

    for (const w of WEEK_NUMS) {
      for (const dKey of ['SEG', 'TER', 'QUA', 'QUI', 'SEX'] as DayOfWeek[]) {
        const weekEmps = emps.map((e) => {
          const clonedSh = JSON.parse(JSON.stringify(e.weeksSchedule![w]));
          if (e.id === 'emp-nailson') {
            clonedSh[dKey] = { day: dKey, type: 'LICENCA' as const, chairId: e.defaultChairId, label: 'Férias jan/2027' };
          }
          return { ...e, schedule: clonedSh };
        });

        const cov = calculateSectorDailyCoverage(weekEmps, dKey);
        const mkt = cov.find((c) => c.sector.id === 'L1-MKT');
        const sdr = cov.find((c) => c.sector.id === 'L1-SDR');
        const vendas = cov.find((c) => c.sector.id === 'L1-VENDAS');
        const marielly = weekEmps.find((e) => e.id === 'emp-marielly');
        const allisson = weekEmps.find((e) => e.id === 'emp-allisson');
        const prep = cov.find((c) => c.sector.id === 'L1-PREP');

        if (mkt && mkt.activeHeadcount === 0) {
          zeroMktDays++;
          if (marielly?.schedule[dKey]?.type !== 'TRABALHO') {
            dualOverloadFinDays++;
            if (allisson?.schedule[dKey]?.type === 'TRABALHO' && prep && prep.activeHeadcount > 2) {
              allissonBackupDays++;
            }
          }

          // Checar ociosidade segura acima do piso (active > minRequired):
          // Andria (SDR) 1.5h (15:00-16:30 fora leads manha e ondas almoco) quando L1-SDR >= 3 ativos
          const andria = weekEmps.find((e) => e.id === 'emp-andria');
          const rayssa = weekEmps.find((e) => e.id === 'emp-rayssa');
          let dayHours = 0;
          const helpers: string[] = [];
          if (sdr && sdr.activeHeadcount >= 3 && andria?.schedule[dKey]?.type === 'TRABALHO') {
            dayHours += 1.5;
            helpers.push(`Andria 1.5h (SDR ${sdr.activeHeadcount}/4)`);
          }
          if (vendas && vendas.activeHeadcount >= 3 && rayssa?.schedule[dKey]?.type === 'TRABALHO') {
            dayHours += 1.5;
            helpers.push(`Rayssa 1.5h (Vendas ${vendas.activeHeadcount}/4)`);
          }
          internalSupportHours += dayHours;
          if (helpers.length > 0 && w === 1) {
            supportLog.push(`S${w} ${dKey}: ${helpers.join(' + ')}`);
          }
        }
      }
    }

    const totalMktHours = 168; // 4 semanas x 42h CLT
    const residualDirectorHours = Math.max(0, totalMktHours - internalSupportHours);
    console.log(
      `  • [${label}] L1-MKT 0 CLT=${zeroMktDays}/20d (${totalMktHours}h) | Sobrecarga Dupla c/ Marielly OFF=${dualOverloadFinDays}/20d (Allisson livre em L1-PREP>2 p/ L2=${allissonBackupDays}/${dualOverloadFinDays})`
    );
    console.log(
      `      - Apoio Interno Sem Furar Piso (Andria SDR>=3 + Rayssa Vendas>=3): ${internalSupportHours.toFixed(1)}h/mês (${((internalSupportHours / totalMktHours) * 100).toFixed(1)}% das 168h) -> Carga residual Igor/Lorena: ${residualDirectorHours.toFixed(1)}h/mês`
    );
    console.log(`      - Exemplo S1 blocos ociosos 1.5h: ${supportLog.join(' | ')}`);
  };

  evaluateScenario(cenBV3, 'v3 50/50 + Plano jan/2027');
  evaluateScenario(cenBHybridV8, `${cenBHybridV8.id} + Plano jan/2027`);
  console.log('');
}

interface HolidayDef {
  dateIso: string;
  name: string;
}

const NATIONAL_HOLIDAYS_SEASON: HolidayDef[] = [
  { dateIso: '2026-11-15', name: 'Proclamação da República (Dom)' },
  { dateIso: '2026-11-20', name: 'Consciência Negra — Lei 14.759/2023 (Sex)' },
  { dateIso: '2026-12-25', name: 'Natal (Sex)' },
  { dateIso: '2027-01-01', name: 'Confraternização Universal (Sex)' },
];

function enumerateMonthDates(year: number, month1To12: number): string[] {
  const res: string[] = [];
  const d = new Date(year, month1To12 - 1, 1, 12, 0, 0, 0);
  while (d.getMonth() === month1To12 - 1) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    res.push(`${y}-${m}-${day}`);
    d.setDate(d.getDate() + 1);
  }
  return res;
}

/**
 * Rodada #9A: Projeção Sazonal no Calendário Civil Real (nov/2026 – jan/2027) usando realCalendar.ts.
 * Mede impacto dos feriados nacionais em dias úteis, absorção de folgas 5x2 pelo feriado,
 * distorção de meses com 5 sábados (jan/2027 repetindo S1), sugestão automática de reposição justa
 * de folga e plano real de férias do Nailson (jan/2027).
 */
function runRealCalendarSeasonAudit(targets: Scenario[]) {
  console.log('=== RODADA #9A: PROJEÇÃO SAZONAL CALENDÁRIO REAL + FERIADOS NACIONAIS (NOV/2026–JAN/2027) ===');
  const holidayMap = new Map(NATIONAL_HOLIDAYS_SEASON.map((h) => [h.dateIso, h]));

  const monthsSpec = [
    { label: 'Nov/2026 (Ciclo Inicial)', year: 2026, month: 11 },
    { label: 'Dez/2026 (Natal)', year: 2026, month: 12 },
    { label: 'Jan/2027 (Ano Novo + 5 Sáb + Férias Nailson)', year: 2027, month: 1 },
  ];

  for (const mSpec of monthsSpec) {
    const dates = enumerateMonthDates(mSpec.year, mSpec.month);
    const openWeekdays = dates.filter((iso) => {
      const k = getDayOfWeekForDateIso(iso);
      return k !== 'SAB' && k !== 'DOM' && !holidayMap.has(iso);
    });
    const saturdays = dates.filter((iso) => getDayOfWeekForDateIso(iso) === 'SAB' && !holidayMap.has(iso));
    const satCycles = saturdays.map((s) => `${s.slice(8)}/${s.slice(5, 7)}(S${getCycleWeekForDate(s)})`);
    const monthHolidays = dates.filter((iso) => holidayMap.has(iso)).map((iso) => `${iso.slice(8)}/${iso.slice(5, 7)}: ${holidayMap.get(iso)!.name}`);
    console.log(
      `  [Calendário Civil ${mSpec.label}] Dias úteis abertos=${openWeekdays.length}d | Sábados=${saturdays.length} (${satCycles.join(', ')}) | Feriados=${monthHolidays.join(' | ')}`
    );
  }
  console.log('');

  for (const sc of targets) {
    const emps = sc.employees.map(ensureEmployeeWeeksSchedule);
    const activeClt = emps.filter((e) => e.contractType === 'CLT_ATIVO' || e.contractType === 'CLT_TEMPORARIO');

    console.log(`  • [${sc.id}]`);
    for (const mSpec of monthsSpec) {
      const dates = enumerateMonthDates(mSpec.year, mSpec.month);
      const isJan2027 = mSpec.year === 2027 && mSpec.month === 1;

      const hoursByEmp = new Map<string, number>();
      const satWorkedByEmp = new Map<string, number>();
      const satOffByEmp = new Map<string, number>();
      for (const e of activeClt) {
        hoursByEmp.set(e.id, 0);
        satWorkedByEmp.set(e.id, 0);
        satOffByEmp.set(e.id, 0);
      }

      const holidayAbsorbedFolgas: Array<{
        dateIso: string;
        holidayName: string;
        cycleWeek: number;
        dayKey: DayOfWeek;
        emp: Employee;
        suggestedSwap: string;
      }> = [];

      let janNailsonAbsentHours = 0;
      let janInternalSupportHours = 0;
      let janMaxSupportCandidates = 0;

      for (const dateIso of dates) {
        const dayKey = getDayOfWeekForDateIso(dateIso);
        const cycleWeek = getCycleWeekForDate(dateIso);
        const hol = holidayMap.get(dateIso);

        // Contagem de horas e sábados reais
        for (const e of activeClt) {
          const effEmp =
            isJan2027 && e.id === 'emp-nailson' && dayKey !== 'DOM'
              ? {
                  ...e,
                  weeksSchedule: {
                    ...e.weeksSchedule,
                    [cycleWeek]: {
                      ...e.weeksSchedule![cycleWeek],
                      [dayKey]: { day: dayKey, type: 'LICENCA' as const, chairId: e.defaultChairId, label: 'Férias jan/2027' },
                    },
                  },
                }
              : e;

          const info = getEmployeeShiftForDate(effEmp, dateIso);
          if (hol) {
            if (dayKey !== 'DOM' && info.isFolga5x2) {
              // Encontrar melhor dia útil da mesma semana (SEG..QUI antes da SEX feriado) p/ compensar a folga absorvida
              let bestSwap = 'Sem troca automática (>0 colegas OFF no setor)';
              const weekDays = (['SEG', 'TER', 'QUA', 'QUI'] as DayOfWeek[]).filter((wd) => wd !== dayKey);
              for (const wd of weekDays) {
                const peersInSector = activeClt.filter(
                  (p) => p.defaultStore === e.defaultStore && p.department === e.department && p.id !== e.id
                );
                const offCountSameDay = peersInSector.filter(
                  (p) => p.weeksSchedule?.[cycleWeek]?.[wd]?.type !== 'TRABALHO'
                ).length;
                if (offCountSameDay === 0) {
                  bestSwap = `Mover Folga ${dayKey}(${dateIso.slice(8)}/${dateIso.slice(5, 7)}) -> S${cycleWeek} ${wd} (setor 100% na véspera)`;
                  break;
                }
              }
              holidayAbsorbedFolgas.push({
                dateIso,
                holidayName: hol.name,
                cycleWeek,
                dayKey,
                emp: e,
                suggestedSwap: bestSwap,
              });
            }
            continue;
          }

          if (info.isWork) {
            hoursByEmp.set(e.id, (hoursByEmp.get(e.id) || 0) + info.dailyHours);
            if (dayKey === 'SAB') satWorkedByEmp.set(e.id, (satWorkedByEmp.get(e.id) || 0) + 1);
          } else if (dayKey === 'SAB' && info.isFolga5x2) {
            satOffByEmp.set(e.id, (satOffByEmp.get(e.id) || 0) + 1);
          }
        }

        // Em Jan/2027 (dias úteis abertos sem 01/01), calcular carga exata de Nailson & blocos reais Andria/Rayssa
        if (isJan2027 && !hol && dayKey !== 'DOM' && dayKey !== 'SAB') {
          const nailsonBase = activeClt.find((e) => e.id === 'emp-nailson');
          if (nailsonBase) {
            const baseInfo = getEmployeeShiftForDate(nailsonBase, dateIso);
            if (baseInfo.isWork) janNailsonAbsentHours += baseInfo.dailyHours;
          }
          const dayEmps = emps.map((e) => ({
            ...e,
            schedule: JSON.parse(JSON.stringify(e.weeksSchedule![cycleWeek])),
          }));
          const cov = calculateSectorDailyCoverage(dayEmps, dayKey);
          const sdr = cov.find((c) => c.sector.id === 'L1-SDR');
          const vendas = cov.find((c) => c.sector.id === 'L1-VENDAS');
          const andria = dayEmps.find((e) => e.id === 'emp-andria');
          const rayssa = dayEmps.find((e) => e.id === 'emp-rayssa');
          let supDay = 0;
          if (sdr && sdr.activeHeadcount >= 3 && andria?.schedule[dayKey]?.type === 'TRABALHO') supDay += 1.5;
          if (vendas && vendas.activeHeadcount >= 3 && rayssa?.schedule[dayKey]?.type === 'TRABALHO') supDay += 1.5;
          janInternalSupportHours += supDay;
          if (supDay > 0) janMaxSupportCandidates++;
        }
      }

      const regularHours = activeClt
        .filter((e) => !(isJan2027 && e.id === 'emp-nailson'))
        .map((e) => ({ name: e.shortName, h: hoursByEmp.get(e.id) || 0 }))
        .sort((a, b) => a.h - b.h);
      const minH = regularHours[0];
      const maxH = regularHours[regularHours.length - 1];
      const spreadReal = Number((maxH.h - minH.h).toFixed(1));

      const doubleSatOffNames = activeClt
        .filter((e) => {
          if (mSpec.month !== 1 || e.id === 'emp-nailson' || e.id === 'emp-joao-pedro') return false;
          const offs = satOffByEmp.get(e.id) || 0;
          if (offs < 2) return false;
          const is75PctMember =
            sc.id.includes('3sab') ||
            (sc.id.includes('hibrido') &&
              [
                'emp-diana',
                'emp-andria',
                'emp-adriane',
                'emp-winona',
                'emp-joao-alexandre',
                'emp-jair',
                'emp-marcos-antonio',
                'emp-rayssa',
                'emp-jorge',
                'emp-mayana',
              ].includes(e.id));
          return is75PctMember;
        })
        .map((e) => `${e.shortName}(${satOffByEmp.get(e.id)}F/${satWorkedByEmp.get(e.id)}T)`);

      const absorbedStr =
        holidayAbsorbedFolgas.length === 0
          ? '0 absorções'
          : holidayAbsorbedFolgas
              .map((a) => `${a.emp.shortName} em ${a.dateIso.slice(8)}/${a.dateIso.slice(5, 7)}(S${a.cycleWeek} ${a.dayKey}) -> ${a.suggestedSwap}`)
              .join(' | ');

      console.log(
        `    - ${mSpec.label}: Horas reais=${minH.h.toFixed(1)}h (${minH.name})..${maxH.h.toFixed(1)}h (${maxH.name}) [disp=${spreadReal}h] | Folgas 5x2 colidindo c/ feriado=${holidayAbsorbedFolgas.length} [${absorbedStr}]`
      );
      if (isJan2027) {
        const doubleInfo = doubleSatOffNames.length > 0 ? doubleSatOffNames.join(', ') : 'nenhum 75% com 2F em Jan';
    console.log(
      `      * Férias Nailson Jan/2027 reais (sem 01/01): ${janNailsonAbsentHours.toFixed(1)}h úteis | Apoio Andria+Rayssa=${janInternalSupportHours.toFixed(1)}h (${janMaxSupportCandidates}d) -> Residual Igor/Lorena=${Math.max(0, janNailsonAbsentHours - janInternalSupportHours).toFixed(1)}h | Distorção S1 duplo (75% c/ 2F/5 sáb): ${doubleInfo}`
        );
      }
    }
  }
  console.log('');
}

function buildSeasonalFourPhasePlans(cenBHybridV9: Scenario): {
  m1Nov: Scenario;
  m2Dez: Scenario;
  m3Jan: Scenario;
  m4Fev: Scenario;
} {
  const slots = getSandboxV3Slots('CENB');
  const open11: PlanSlotOverride = { start: '08:00', lunchStart: '11:00', lunchEnd: '12:00', end: '17:24' };
  const open12: PlanSlotOverride = { start: '08:00', lunchStart: '12:00', lunchEnd: '13:00', end: '17:24' };
  const close12: PlanSlotOverride = { start: '08:36', lunchStart: '12:00', lunchEnd: '13:00', end: '18:00' };
  const close13: PlanSlotOverride = { start: '08:36', lunchStart: '13:00', lunchEnd: '14:00', end: '18:00' };
  const fullSlots: Record<string, PlanSlotOverride> = {
    ...slots,
    'emp-marielly': open11,
    'emp-jorge': close12,
    'emp-mayana': close13,
    'emp-rosinaldo': open12,
  };

  // M1 (Nov/2026): baseline híbrido v9
  const m1Nov = JSON.parse(JSON.stringify(cenBHybridV9)) as Scenario;
  m1Nov.id = 'sazonal-m1-nov-v9';

  // M2 (Dez/2026): rotaciona +1 satOff em L1-SDR (Diana S1), L1-VENDAS (Jair S1), L2-DOC+SC (Mayana S1) e Jorginho [1,3]
  const m2Dez = JSON.parse(JSON.stringify(cenBHybridV9)) as Scenario;
  m2Dez.id = 'sazonal-m2-dez-rot10';
  overrideCustomEmployeePlans(
    m2Dez,
    {
      'emp-diana': { satOff: [1], weekdayOff: { 2: 'SEG', 3: 'QUI', 4: 'QUA' } },
      'emp-andria': { satOff: [2], weekdayOff: { 1: 'QUA', 3: 'TER', 4: 'TER' } },
      'emp-adriane': { satOff: [3], weekdayOff: { 1: 'TER', 2: 'QUA', 4: 'SEG' } },
      'emp-winona': { satOff: [4], weekdayOff: { 1: 'SEG', 2: 'TER', 3: 'QUA' } },

      'emp-jair': { satOff: [1], weekdayOff: { 2: 'SEG', 3: 'QUI', 4: 'TER' } },
      'emp-marcos-antonio': {
        satOff: [2],
        weekdayOff: { 1: 'TER', 3: 'SEG', 4: 'QUA' },
        satChair: { 1: 'VEND-L2-EXT', 3: 'VEND-L2-EXT' },
      },
      'emp-rayssa': { satOff: [3], weekdayOff: { 1: 'QUA', 2: 'TER', 4: 'SEG' } },
      'emp-joao-alexandre': { satOff: [4], weekdayOff: { 1: 'SEG', 2: 'QUI', 3: 'TER' } },
      'emp-rosinaldo': {
        satOff: [1, 3],
        weekdayOff: { 2: 'SEG', 4: 'QUI' },
        slotByWeek: { 1: open12, 2: close12, 3: open12, 4: close12 },
      },

      'emp-marielly': {
        satOff: [2, 4],
        weekdayOff: { 1: 'TER', 3: 'SEG' },
        slotByWeek: { 1: open11, 2: open11, 3: open11, 4: open11 },
      },
      'emp-mayana': {
        satOff: [1],
        weekdayOff: { 2: 'SEG', 3: 'TER', 4: 'QUI' },
        slotByWeek: { 1: close13, 2: close13, 3: close13, 4: close13 },
      },
      'emp-jorge': {
        satOff: [3],
        weekdayOff: { 1: 'QUA', 2: 'QUI', 4: 'SEG' },
        slotByWeek: { 1: close12, 2: close12, 3: close12, 4: close12 },
        dayOverride: { 1: { TER: open12 }, 3: { SEG: open12 } },
      },
    },
    fullSlots,
    '14:00'
  );

  // M3 (Jan/2027 — S1 dupla em 02/01 e 30/01): Andria S1 em L1-SDR; Marcos Ant. S1 em L1-VENDAS; Jorge S1 em DOC+SC
  const m3Jan = JSON.parse(JSON.stringify(cenBHybridV9)) as Scenario;
  m3Jan.id = 'sazonal-m3-jan-rot10';
  overrideCustomEmployeePlans(
    m3Jan,
    {
      'emp-andria': { satOff: [1], weekdayOff: { 2: 'TER', 3: 'QUA', 4: 'TER' } },
      'emp-winona': { satOff: [2], weekdayOff: { 1: 'QUA', 3: 'SEG', 4: 'QUI' } },
      'emp-adriane': { satOff: [3], weekdayOff: { 1: 'TER', 2: 'QUI', 4: 'SEG' } },
      'emp-diana': { satOff: [4], weekdayOff: { 1: 'SEG', 2: 'QUA', 3: 'TER' } },

      'emp-marcos-antonio': { satOff: [1], weekdayOff: { 2: 'SEG', 3: 'QUA', 4: 'QUI' } },
      'emp-rayssa': { satOff: [2], weekdayOff: { 1: 'TER', 3: 'SEG', 4: 'QUA' } },
      'emp-joao-alexandre': { satOff: [3], weekdayOff: { 1: 'QUA', 2: 'TER', 4: 'SEG' } },
      'emp-jair': {
        satOff: [4],
        weekdayOff: { 1: 'SEG', 2: 'QUI', 3: 'TER' },
        satChair: { 2: 'VEND-L2-EXT' },
      },
      'emp-rosinaldo': {
        satOff: [2, 4],
        weekdayOff: { 1: 'QUI', 3: 'SEG' },
        slotByWeek: { 1: open12, 2: close12, 3: open12, 4: close12 },
      },
    },
    fullSlots,
    '14:00'
  );

  const marcosM3 = m3Jan.employees.find((e) => e.id === 'emp-marcos-antonio');
  if (marcosM3?.weeksSchedule?.[2]?.SAB) marcosM3.weeksSchedule[2].SAB.chairId = 'VEND-L2-EXT';
  if (marcosM3?.weeksSchedule?.[4]?.SAB) marcosM3.weeksSchedule[4].SAB.chairId = marcosM3.defaultChairId;

  // M4 (Ciclo 4 iniciando 25/01/2027 SEG): fecha o Quadrado Latino de Sábados S1 (Adriane, Rayssa, Mayana)
  const m4Fev = JSON.parse(JSON.stringify(cenBHybridV9)) as Scenario;
  m4Fev.id = 'sazonal-m4-fev-rot11';
  overrideCustomEmployeePlans(
    m4Fev,
    {
      'emp-adriane': { satOff: [1], weekdayOff: { 2: 'SEG', 3: 'QUA', 4: 'TER' } },
      'emp-diana': { satOff: [2], weekdayOff: { 1: 'SEG', 3: 'TER', 4: 'QUI' } },
      'emp-winona': { satOff: [3], weekdayOff: { 1: 'QUA', 2: 'TER', 4: 'SEG' } },
      'emp-andria': { satOff: [4], weekdayOff: { 1: 'TER', 2: 'QUA', 3: 'QUI' } },

      'emp-rayssa': {
        satOff: [1],
        weekdayOff: { 2: 'SEG', 3: 'QUI', 4: 'TER' },
        satChair: { 2: 'VEND-L2-EXT', 4: 'VEND-L2-EXT' },
      },
      'emp-joao-alexandre': { satOff: [2], weekdayOff: { 1: 'TER', 3: 'SEG', 4: 'QUA' } },
      'emp-jair': { satOff: [3], weekdayOff: { 1: 'QUA', 2: 'TER', 4: 'SEG' } },
      'emp-marcos-antonio': { satOff: [4], weekdayOff: { 1: 'SEG', 2: 'QUI', 3: 'TER' } },
      'emp-rosinaldo': {
        satOff: [2, 4],
        weekdayOff: { 1: 'QUI', 3: 'SEG' },
        slotByWeek: { 1: open12, 2: close12, 3: open12, 4: close12 },
      },

      'emp-marielly': {
        satOff: [2, 4],
        weekdayOff: { 1: 'TER', 3: 'SEG' },
        slotByWeek: { 1: open11, 2: open11, 3: open11, 4: open11 },
      },
      'emp-mayana': {
        satOff: [1],
        weekdayOff: { 2: 'SEG', 3: 'TER', 4: 'QUI' },
        slotByWeek: { 1: close13, 2: close13, 3: close13, 4: close13 },
      },
      'emp-jorge': {
        satOff: [3],
        weekdayOff: { 1: 'QUA', 2: 'QUI', 4: 'SEG' },
        slotByWeek: { 1: close12, 2: close12, 3: close12, 4: close12 },
        dayOverride: { 1: { TER: open12 }, 3: { SEG: open12 } },
      },
    },
    fullSlots,
    '14:00'
  );

  return { m1Nov, m2Dez, m3Jan, m4Fev };
}

/**
 * Rodada #10A: Motor Trimestral Sazonal Real (Nov/2026 + Dez/2026 + Jan/2027 — 75 dias operacionais)
 * Compensa a repetição de S1 em Jan/2027 (5 sábados: 02/01 e 30/01) e equaliza cargas civis
 * entre pares 75% de L1-SDR, L1-VENDAS e L2-DOC+SC mantendo ZERO colisões < n-1 e 0.0h solo Loja 2.
 */
function runRealSeasonalQuarterCompensation(cenBHybridV9: Scenario) {
  console.log('=== RODADA #10A: MOTOR TRIMESTRAL SAZONAL REAL (NOV/2026–JAN/2027 — 13 SÁBADOS REAIS) ===');
  const { m1Nov, m2Dez, m3Jan } = buildSeasonalFourPhasePlans(cenBHybridV9);

  const evalQuarterCivil = (
    label: string,
    pickScenarioForDate: (dateIso: string) => Scenario,
    monthAuditsInput: Scenario[]
  ) => {
    const holidaySet = new Set(NATIONAL_HOLIDAYS_SEASON.map((h) => h.dateIso));
    const dates = [
      ...enumerateMonthDates(2026, 11).filter((d) => d >= '2026-11-02'),
      ...enumerateMonthDates(2026, 12),
      ...enumerateMonthDates(2027, 1),
    ];

    const preparedByScenario = new Map<Scenario, ReturnType<typeof ensureEmployeeWeeksSchedule>[]>();
    const getPrepared = (sc: Scenario) => {
      let cached = preparedByScenario.get(sc);
      if (!cached) {
        cached = sc.employees.map(ensureEmployeeWeeksSchedule);
        preparedByScenario.set(sc, cached);
      }
      return cached;
    };

    const satWorked = new Map<string, number>();
    const satOff = new Map<string, number>();
    const realHours = new Map<string, number>();
    const empNames = new Map<string, string>();
    const activeIds: string[] = [];

    for (const e of monthAuditsInput[0].employees) {
      if (e.contractType === 'CLT_ATIVO' || e.contractType === 'CLT_TEMPORARIO') {
        activeIds.push(e.id);
        empNames.set(e.id, e.shortName);
        satWorked.set(e.id, 0);
        satOff.set(e.id, 0);
        realHours.set(e.id, 0);
      }
    }

    let docSoloSaturdays = 0;
    let weekdayInternalColl = 0;
    let uncoveredCivil = 0;
    let weeklyFolgaAnomalies = 0;

    // Verificar cada mês/bloco na auditoria profunda
    const monthAudits = monthAuditsInput.map((sc) => auditScenarioDeep(sc));
    const complianceErrors = monthAudits.reduce((s, a) => s + a.complianceErrorCount, 0);
    const lunchPeaks = monthAudits.reduce((s, a) => s + a.peakLunchConcurrency.length, 0);

    // Rastrear quantas folgas 5x2 cada CLT efetivo tira em cada semana civil Seg..Dom (13 semanas: 02/11..31/01)
    const weeklyFolgasByEmp = new Map<string, number[]>();
    const weeklyHoursByEmp = new Map<string, number[]>();
    for (const id of activeIds) {
      weeklyFolgasByEmp.set(id, Array(13).fill(0));
      weeklyHoursByEmp.set(id, Array(13).fill(0));
    }

    const anchorMs = new Date('2026-11-02T12:00:00Z').getTime();

    for (const dateIso of dates) {
      const sc = pickScenarioForDate(dateIso);
      const prepared = getPrepared(sc);
      const dayKey = getDayOfWeekForDateIso(dateIso);
      const cycleWeek = getCycleWeekForDate(dateIso);
      const weekIdx = Math.floor((new Date(`${dateIso}T12:00:00Z`).getTime() - anchorMs) / (7 * 86400000));

      // Checar contagem semanal de folgas 5x2 mesmo que o dia da folga caia num feriado nacional
      if (dayKey !== 'DOM') {
        for (const id of activeIds) {
          const e = prepared.find((emp) => emp.id === id);
          if (!e) continue;
          const schedDay = e.weeksSchedule?.[cycleWeek]?.[dayKey];
          if (schedDay?.type === 'FOLGA_5X2') {
            const arr = weeklyFolgasByEmp.get(id)!;
            arr[weekIdx] = (arr[weekIdx] || 0) + 1;
          }
        }
      }

      if (dayKey === 'DOM' || holidaySet.has(dateIso)) continue;

      const dayEmps = prepared.map((e) => ({
        ...e,
        schedule: JSON.parse(JSON.stringify(e.weeksSchedule![cycleWeek])),
      }));
      const cov = calculateSectorDailyCoverage(dayEmps, dayKey);
      if (cov.some((c) => c.status !== 'SEGURO')) uncoveredCivil++;

      if (dayKey === 'SAB') {
        const docClts = dayEmps.filter(
          (e) => ['emp-marielly', 'emp-jorge', 'emp-mayana'].includes(e.id) && e.schedule.SAB?.type === 'TRABALHO'
        );
        if (docClts.length <= 1) docSoloSaturdays++;
      } else {
        const checkGroups = [
          dayEmps.filter((e) => e.defaultStore === 'LOJA_1' && e.department === 'SDR' && e.contractType === 'CLT_ATIVO'),
          dayEmps.filter((e) => e.defaultStore === 'LOJA_1' && e.department === 'VENDAS' && e.contractType === 'CLT_ATIVO'),
          dayEmps.filter((e) => e.defaultStore === 'LOJA_1' && e.department === 'PREPARACAO' && e.contractType === 'CLT_ATIVO'),
        ];
        for (const grp of checkGroups) {
          if (grp.filter((e) => e.schedule[dayKey]?.type === 'TRABALHO').length < 3) weekdayInternalColl++;
        }
      }

      for (const id of activeIds) {
        const e = prepared.find((emp) => emp.id === id);
        if (!e) continue;
        const info = getEmployeeShiftForDate(e, dateIso);
        if (info.isWork) {
          realHours.set(id, (realHours.get(id) || 0) + info.dailyHours);
          const wh = weeklyHoursByEmp.get(id)!;
          wh[weekIdx] = (wh[weekIdx] || 0) + info.dailyHours;
          if (dayKey === 'SAB') satWorked.set(id, (satWorked.get(id) || 0) + 1);
        } else if (dayKey === 'SAB' && info.isFolga5x2) {
          satOff.set(id, (satOff.get(id) || 0) + 1);
        }
      }
    }

    let maxCivilWeekHours = 0;
    for (const id of activeIds) {
      const fArr = weeklyFolgasByEmp.get(id) || [];
      const hArr = weeklyHoursByEmp.get(id) || [];
      for (let w = 0; w < 13; w++) {
        if (fArr[w] !== 1) weeklyFolgaAnomalies++;
        if (hArr[w] > maxCivilWeekHours) maxCivilWeekHours = hArr[w];
      }
    }

    const groups = [
      { label: 'L1-SDR (75%)', ids: ['emp-diana', 'emp-andria', 'emp-adriane', 'emp-winona'] },
      { label: 'L1-VENDAS (75%)', ids: ['emp-joao-alexandre', 'emp-jair', 'emp-marcos-antonio', 'emp-rayssa'] },
      { label: 'DOC+SC 75% (Jorge/Mayana)', ids: ['emp-jorge', 'emp-mayana'] },
    ];
    const allRotIds = groups.flatMap((g) => g.ids);
    const hrsRot = allRotIds.map((id) => realHours.get(id) || 0);
    const totalDispersionRot = Number((Math.max(...hrsRot) - Math.min(...hrsRot)).toFixed(1));

    console.log(`  [${label}]`);
    console.log(
      `    • Trimestre Civil (75d abertos | 13 Sáb): Erros CLT=${complianceErrors} | Setores desc=${uncoveredCivil} | Colisões <3/4 útil=${weekdayInternalColl} | Semanas c/ anomalia 5x2=${weeklyFolgaAnomalies} (pico=${maxCivilWeekHours.toFixed(1)}h/sem) | Sáb c/ 1 CLT DOC+SC=${docSoloSaturdays}/13 | Picos almoço=${lunchPeaks}`
    );
    console.log(`    • Dispersão entre pares 75% (máx - mín horas reais em 75d): ${totalDispersionRot}h`);
    for (const grp of groups) {
      const summary = grp.ids
        .map((id) => `${empNames.get(id)}=${satWorked.get(id)}T/${satOff.get(id)}F(${(realHours.get(id) || 0).toFixed(1)}h)`)
        .join(' | ');
      const gh = grp.ids.map((id) => realHours.get(id) || 0);
      console.log(`      - ${grp.label} [disp ${(Math.max(...gh) - Math.min(...gh)).toFixed(1)}h]: ${summary}`);
    }
  };

  evalQuarterCivil('Híbrido v9 Fixo × 3 Meses Civis (Nov+Dez+Jan)', () => m1Nov, [m1Nov]);
  evalQuarterCivil(
    'Armadilha Corte Dia 1º (M2 em 01/12 TER & M3 em 01/01 SEX)',
    (dateIso) => {
      const m = Number(dateIso.slice(5, 7));
      return m === 11 ? m1Nov : m === 12 ? m2Dez : m3Jan;
    },
    [m1Nov, m2Dez, m3Jan]
  );
  evalQuarterCivil(
    'Rodada #10 Sazonal Alinhado à Segunda S1 (M2 em 30/11 SEG & M3 em 28/12 SEG)',
    (dateIso) => (dateIso < '2026-11-30' ? m1Nov : dateIso < '2026-12-28' ? m2Dez : m3Jan),
    [m1Nov, m2Dez, m3Jan]
  );
  console.log('');
}

function addDaysUtcIso(startIso: string, addDays: number): string {
  const [y, m, d] = startIso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + addDays));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function getSemesterHolidays(includeRegionalPEAndCarnival: boolean): Map<string, string> {
  const map = new Map<string, string>([
    ['2026-11-02', 'Finados (Nac. SEG)'],
    ['2026-11-15', 'Proclamação da República (Nac. DOM)'],
    ['2026-11-20', 'Consciência Negra (Nac. SEX)'],
    ['2026-12-25', 'Natal (Nac. SEX)'],
    ['2027-01-01', 'Confraternização Universal (Nac. SEX)'],
    ['2027-03-26', 'Paixão de Cristo (Nac. SEX)'],
    ['2027-04-21', 'Tiradentes (Nac. QUA)'],
    ['2027-05-01', 'Dia do Trabalho (Nac. SAB)'],
  ]);
  if (includeRegionalPEAndCarnival) {
    map.set('2026-12-08', 'N. Sra. Conceição (Recife TER)');
    map.set('2027-02-09', 'Carnaval (Comércio TER)');
    map.set('2027-03-06', 'Data Magna PE (Est. SAB)');
  }
  return map;
}

function isInternalCollisionOnDayForSemester(dayEmps: Employee[], dayKey: DayOfWeek): boolean {
  if (dayKey === 'SAB') {
    const docClts = dayEmps.filter(
      (e) => ['emp-marielly', 'emp-jorge', 'emp-mayana'].includes(e.id) && e.schedule.SAB?.type === 'TRABALHO'
    );
    return docClts.length <= 1;
  }
  const groups = [
    dayEmps.filter((e) => e.defaultStore === 'LOJA_1' && e.department === 'SDR' && e.contractType === 'CLT_ATIVO'),
    dayEmps.filter((e) => e.defaultStore === 'LOJA_1' && e.department === 'VENDAS' && e.contractType === 'CLT_ATIVO'),
    dayEmps.filter((e) => e.defaultStore === 'LOJA_1' && e.department === 'PREPARACAO' && e.contractType === 'CLT_ATIVO'),
  ];
  return groups.some((grp) => grp.filter((e) => e.schedule[dayKey]?.type === 'TRABALHO').length < 3);
}

interface SemesterEvaluationOptions {
  label: string;
  holidays: Map<string, string>;
  phases: Scenario[];
  rotatePhases: boolean;
  phaseIndexByBlock?: number[];
  antiAbsorption: boolean;
  antiSatHolidayComp?: boolean;
  logSwaps?: boolean;
}

function evaluateSemesterCalendar(opts: SemesterEvaluationOptions) {
  const { phases, holidays } = opts;
  const dates182 = Array.from({ length: 182 }, (_, idx) => addDaysUtcIso('2026-11-02', idx));
  const activeCltIds = phases[0].employees
    .filter((e) => e.contractType === 'CLT_ATIVO' || e.contractType === 'CLT_TEMPORARIO')
    .map((e) => e.id);
  const nameMap = new Map(phases[0].employees.map((e) => [e.id, e.shortName]));

  const satWorked = new Map<string, number>();
  const satOff = new Map<string, number>();
  const realHours = new Map<string, number>();
  const curStreak = new Map<string, number>();
  const maxStreak = new Map<string, number>();
  for (const id of activeCltIds) {
    satWorked.set(id, 0);
    satOff.set(id, 0);
    realHours.set(id, 0);
    curStreak.set(id, 0);
    maxStreak.set(id, 0);
  }

  let uncoveredDays = 0;
  let internalCollisions = 0;
  let docSoloSats = 0;
  let weekdayHolidayAbsorptions = 0;
  let satHolidayAbsorptions = 0;
  let weeklyFolgaAnomalies = 0;
  let maxWeeklyHours = 0;
  let openWorkdaysCount = 0;
  let openSatsCount = 0;
  const swapNotes: string[] = [];
  const bankCreditNotes: string[] = [];

  for (let weekIdx = 0; weekIdx < 26; weekIdx++) {
    const blockIdx = Math.floor(weekIdx / 4);
    const phaseIdx = opts.phaseIndexByBlock
      ? opts.phaseIndexByBlock[blockIdx] ?? blockIdx % phases.length
      : opts.rotatePhases
        ? blockIdx % phases.length
        : 0;
    const baseSc = phases[phaseIdx];
    const cycleWeek = ((weekIdx % 4) + 1) as 1 | 2 | 3 | 4;
    const weekEmps = baseSc.employees.map((e) => {
      const prepared = ensureEmployeeWeeksSchedule(e);
      return {
        ...prepared,
        schedule: JSON.parse(JSON.stringify(prepared.weeksSchedule![cycleWeek])),
      };
    });

    const weekDates = dates182.slice(weekIdx * 7, weekIdx * 7 + 7);
    const dayIsoByKey = new Map<DayOfWeek, string>();
    const holidayWeekKeys: Array<{ dayKey: DayOfWeek; dateIso: string; name: string }> = [];
    let satHolidayInfo: { dateIso: string; name: string } | null = null;

    for (const dateIso of weekDates) {
      const dk = getDayOfWeekForDateIso(dateIso);
      dayIsoByKey.set(dk, dateIso);
      const hName = holidays.get(dateIso);
      if (hName && dk !== 'DOM' && dk !== 'SAB') {
        holidayWeekKeys.push({ dayKey: dk, dateIso, name: hName });
      } else if (hName && dk === 'SAB') {
        satHolidayInfo = { dateIso, name: hName };
      }
    }

    // Protocolo Anti-Absorção de Feriado Útil: se FOLGA_5X2 coincidir c/ feriado SEG..SEX,
    // desloca a folga p/ outro dia aberto da mesma semana mantendo cobertura 100% e colisões <3/4 = 0.
    if (opts.antiAbsorption && holidayWeekKeys.length > 0) {
      for (const hInfo of holidayWeekKeys) {
        for (const emp of weekEmps) {
          if (emp.contractType !== 'CLT_ATIVO' && emp.contractType !== 'CLT_TEMPORARIO') continue;
          if (emp.schedule[hInfo.dayKey]?.type !== 'FOLGA_5X2') continue;

          const candidateOrder: DayOfWeek[] = (
            emp.id === 'emp-andria' ? ['QUI', 'QUA', 'TER', 'SEX', 'SEG', 'SAB'] : ['QUI', 'QUA', 'TER', 'SEG', 'SEX', 'SAB']
          ) as DayOfWeek[];
          const refWorkDay = (['SEG', 'TER', 'QUA', 'QUI', 'SEX'] as DayOfWeek[]).find(
            (wd) => emp.schedule[wd]?.type === 'TRABALHO' && !!emp.schedule[wd]?.startTime
          );
          const fallbackShift = refWorkDay ? emp.schedule[refWorkDay] : undefined;

          for (const candKey of candidateOrder) {
            const candIso = dayIsoByKey.get(candKey)!;
            if (candKey === hInfo.dayKey || holidays.has(candIso)) continue;
            if (emp.schedule[candKey]?.type !== 'TRABALHO') continue;

            const origHol = emp.schedule[hInfo.dayKey];
            const origCand = emp.schedule[candKey];
            const restoreShift = origCand.lunchStart
              ? { ...origCand, day: hInfo.dayKey }
              : fallbackShift
                ? { ...fallbackShift, day: hInfo.dayKey }
                : null;
            if (!restoreShift) continue;

            emp.schedule[hInfo.dayKey] = restoreShift;
            emp.schedule[candKey] = {
              day: candKey,
              type: 'FOLGA_5X2',
              chairId: emp.defaultChairId,
              label: `Folga comp. ${hInfo.dateIso.slice(8)}/${hInfo.dateIso.slice(5, 7)}`,
            };

            const covOk = calculateSectorDailyCoverage(weekEmps, candKey).every((c) => c.status === 'SEGURO');
            const noColl = !isInternalCollisionOnDayForSemester(weekEmps, candKey);
            if (covOk && noColl) {
              swapNotes.push(
                `${emp.shortName} [${hInfo.dateIso.slice(8)}/${hInfo.dateIso.slice(5, 7)} ${hInfo.dayKey}->${candKey}]`
              );
              break;
            }

            emp.schedule[hInfo.dayKey] = origHol;
            emp.schedule[candKey] = origCand;
          }
        }
      }
    }

    // Rodada #12B: Compensação Justa de Sábado-Feriado (06/03 ou 01/05):
    // Evita que quem caiu c/ satOff no feriado trabalhe 42h úteis enquanto colegas do setor trabalham 33h36.
    if (opts.antiSatHolidayComp && satHolidayInfo) {
      const satTag = `${satHolidayInfo.dateIso.slice(8)}/${satHolidayInfo.dateIso.slice(5, 7)}`;
      for (const emp of weekEmps) {
        if (emp.contractType !== 'CLT_ATIVO' && emp.contractType !== 'CLT_TEMPORARIO') continue;
        if (emp.schedule.SAB?.type !== 'FOLGA_5X2') continue;

        let compensated = false;
        const candidateOrder: DayOfWeek[] = ['SEX', 'QUI', 'QUA', 'TER', 'SEG'];
        for (const candKey of candidateOrder) {
          const candIso = dayIsoByKey.get(candKey)!;
          if (holidays.has(candIso)) continue;
          if (emp.schedule[candKey]?.type !== 'TRABALHO') continue;

          const origSab = emp.schedule.SAB;
          const origCand = emp.schedule[candKey];
          emp.schedule.SAB = {
            day: 'SAB',
            type: 'TRABALHO',
            chairId: emp.defaultChairId,
            startTime: '08:00',
            endTime: '14:00',
            label: `Feriado Sáb ${satTag}`,
          };
          emp.schedule[candKey] = {
            day: candKey,
            type: 'FOLGA_5X2',
            chairId: emp.defaultChairId,
            label: `Comp. Sáb-Fer ${satTag}`,
          };

          const covOk = calculateSectorDailyCoverage(weekEmps, candKey).every((c) => c.status === 'SEGURO');
          const noColl = !isInternalCollisionOnDayForSemester(weekEmps, candKey);
          if (covOk && noColl) {
            swapNotes.push(`${emp.shortName} [${satTag} SAB->${candKey}]`);
            compensated = true;
            break;
          }

          emp.schedule.SAB = origSab;
          emp.schedule[candKey] = origCand;
        }
        if (!compensated) {
          bankCreditNotes.push(`${emp.shortName}(${satTag})`);
        }
      }
    }

    const folgasCountThisWeek = new Map<string, number>();
    const hoursThisWeek = new Map<string, number>();
    for (const id of activeCltIds) {
      folgasCountThisWeek.set(id, 0);
      hoursThisWeek.set(id, 0);
    }

    for (const dateIso of weekDates) {
      const dayKey = getDayOfWeekForDateIso(dateIso);
      const hName = holidays.get(dateIso);

      if (dayKey !== 'DOM') {
        for (const id of activeCltIds) {
          const emp = weekEmps.find((e) => e.id === id);
          if (!emp) continue;
          if (emp.schedule[dayKey]?.type === 'FOLGA_5X2') {
            folgasCountThisWeek.set(id, (folgasCountThisWeek.get(id) || 0) + 1);
          }
        }
      }

      if (dayKey === 'DOM' || hName) {
        if (hName && dayKey !== 'DOM') {
          for (const id of activeCltIds) {
            const emp = weekEmps.find((e) => e.id === id);
            if (!emp) continue;
            if (emp.schedule[dayKey]?.type === 'FOLGA_5X2') {
              if (dayKey === 'SAB') satHolidayAbsorptions++;
              else weekdayHolidayAbsorptions++;
            }
          }
        }
        for (const id of activeCltIds) curStreak.set(id, 0);
        continue;
      }

      openWorkdaysCount++;
      if (dayKey === 'SAB') openSatsCount++;

      const cov = calculateSectorDailyCoverage(weekEmps, dayKey);
      if (cov.some((c) => c.status !== 'SEGURO')) uncoveredDays++;
      if (isInternalCollisionOnDayForSemester(weekEmps, dayKey)) {
        if (dayKey === 'SAB') docSoloSats++;
        else internalCollisions++;
      }

      for (const id of activeCltIds) {
        const emp = weekEmps.find((e) => e.id === id);
        if (!emp) continue;
        const sh = emp.schedule[dayKey];
        if (sh?.type === 'TRABALHO') {
          const h = calculateDailyHours(sh);
          realHours.set(id, (realHours.get(id) || 0) + h);
          hoursThisWeek.set(id, (hoursThisWeek.get(id) || 0) + h);
          if (dayKey === 'SAB') satWorked.set(id, (satWorked.get(id) || 0) + 1);
          const st = (curStreak.get(id) || 0) + 1;
          curStreak.set(id, st);
          if (st > (maxStreak.get(id) || 0)) maxStreak.set(id, st);
        } else {
          curStreak.set(id, 0);
          if (dayKey === 'SAB' && sh?.type === 'FOLGA_5X2') {
            satOff.set(id, (satOff.get(id) || 0) + 1);
          }
        }
      }
    }

    for (const id of activeCltIds) {
      if ((folgasCountThisWeek.get(id) || 0) !== 1) weeklyFolgaAnomalies++;
      const wh = hoursThisWeek.get(id) || 0;
      if (wh > maxWeeklyHours) maxWeeklyHours = wh;
    }
  }

  const groups = [
    { label: 'L1-SDR (75%)', ids: ['emp-diana', 'emp-andria', 'emp-adriane', 'emp-winona'] },
    { label: 'L1-VENDAS (75%)', ids: ['emp-joao-alexandre', 'emp-jair', 'emp-marcos-antonio', 'emp-rayssa'] },
    { label: 'DOC+SC 75%', ids: ['emp-jorge', 'emp-mayana'] },
  ];
  const allRotHrs = groups.flatMap((g) => g.ids).map((id) => realHours.get(id) || 0);
  const totalDisp = Number((Math.max(...allRotHrs) - Math.min(...allRotHrs)).toFixed(1));
  const globalMaxStreak = Math.max(...Array.from(maxStreak.values()));

  console.log(`  [${opts.label}]`);
  console.log(
    `    • Semestre (${openWorkdaysCount}d abertos | ${openSatsCount} Sáb abertos): Setores desc=${uncoveredDays} | Colisões <3/4=${internalCollisions} | Sáb solo DOC+SC=${docSoloSats} | Anomalias 5x2=${weeklyFolgaAnomalies} (pico=${maxWeeklyHours.toFixed(1)}h/sem) | Seq máx trabalho=${globalMaxStreak}d (<=6d OK)`
  );
  console.log(
    `    • Absorção de folga 5x2 por feriado: Úteis SEG–SEX=${weekdayHolidayAbsorptions} | Sáb=${satHolidayAbsorptions} | Dispersão 75% (182d)=${totalDisp}h`
  );
  for (const g of groups) {
    const gh = g.ids.map((id) => realHours.get(id) || 0);
    const summary = g.ids
      .map((id) => `${nameMap.get(id)}=${satWorked.get(id)}T/${satOff.get(id)}F(${(realHours.get(id) || 0).toFixed(1)}h)`)
      .join(' | ');
    console.log(`      - ${g.label} [disp ${(Math.max(...gh) - Math.min(...gh)).toFixed(1)}h]: ${summary}`);
  }
  if (opts.logSwaps && swapNotes.length > 0) {
    console.log(`    • Trocas automáticas anti-absorção (${swapNotes.length}): ${swapNotes.join(' ; ')}`);
  }
  if (bankCreditNotes.length > 0) {
    console.log(`    • Setores solo/3-pessoas c/ crédito Banco de Horas Sáb-Fer (${bankCreditNotes.length}): ${bankCreditNotes.join(' ; ')}`);
  }
}

/**
 * Rodada #11: Auditoria Semestral Completa (26 Semanas / M1..M7: 02/11/2026–02/05/2027) c/ Feriados Não-Sexta
 * + Protocolo Anti-Absorção de Feriado Útil + Cascata Dupla R$0 CLT Zero-Liderança (Allisson + Mayana/SC-1 -> L2-FIN).
 */
function runRodada11SemesterAndCascadeAudit(cenBHybridV9: Scenario, tradHybridV10: Scenario) {
  console.log('=== RODADA #11A: SEMESTRE REAL 26 SEMANAS (M1..M7: 02/11/2026–02/05/2027) & FERIADOS FORA DA SEXTA ===');
  const { m1Nov, m2Dez, m3Jan, m4Fev } = buildSeasonalFourPhasePlans(cenBHybridV9);
  const fourPhases = [m1Nov, m2Dez, m3Jan, m4Fev];

  // Garantir que M4 também é 100% válido isoladamente na auditoria profunda mensal
  const phaseAudits = fourPhases.map((p) => auditScenarioDeep(p));
  console.log(
    `  • Saúde dos 4 Ciclos Base (M1..M4): ${phaseAudits
      .map((a) => `${a.id}[Err=${a.complianceErrorCount}, Desc=${a.uncoveredSectorsTotal}, Colis<3/4=${a.internalWeekdayCollisions.length}, Alm=${a.peakLunchConcurrency.length}, SábL2=${a.l2SeniorSaturdayRisk.length}]`)
      .join(' | ')}`
  );

  const natHolidays = getSemesterHolidays(false);
  const fullHolidaysPE = getSemesterHolidays(true);

  console.log('  -- Cenário Feriados Nacionais Federais (incl. 02/11 SEG, 21/04 QUA, 01/05 SAB) --');
  evaluateSemesterCalendar({
    label: 'Nac | Híbrido v9 Fixo × 26 Sem',
    holidays: natHolidays,
    phases: fourPhases,
    rotatePhases: false,
    antiAbsorption: false,
  });
  evaluateSemesterCalendar({
    label: 'Nac | Semestral M1..M4 Alinhado S1 (sem troca feriado)',
    holidays: natHolidays,
    phases: fourPhases,
    rotatePhases: true,
    antiAbsorption: false,
  });
  evaluateSemesterCalendar({
    label: 'Nac | Rodada #11 M1..M4 Alinhado S1 + Anti-Absorção Feriado',
    holidays: natHolidays,
    phases: fourPhases,
    rotatePhases: true,
    antiAbsorption: true,
    logSwaps: true,
  });

  console.log('  -- Cenário Completo PE/Recife (+08/12 TER Recife, 09/02 TER Carnaval, 06/03 SAB Data Magna PE) --');
  evaluateSemesterCalendar({
    label: 'PE  | Híbrido v9 Fixo × 26 Sem',
    holidays: fullHolidaysPE,
    phases: fourPhases,
    rotatePhases: false,
    antiAbsorption: false,
  });
  evaluateSemesterCalendar({
    label: 'PE  | Rodada #11 M1..M4 Alinhado S1 + Anti-Absorção Feriado',
    holidays: fullHolidaysPE,
    phases: fourPhases,
    rotatePhases: true,
    antiAbsorption: true,
    logSwaps: true,
  });
  console.log('');

  console.log('=== RODADA #11B: CASCATA DUPLA CLT R$0 ZERO-LIDERANÇA (L2-FIN CAMADA 2: 2 -> 0 & ALMOÇO FIN 2/20 -> 0/20) ===');
  const cascadeTargets: Scenario[] = [cenBHybridV9, tradHybridV10, ...fourPhases.slice(1)];
  for (const sc of cascadeTargets) {
    const baseN1 = solveN1WithLayers(sc, false);
    const cascN1 = solveN1WithLayers(sc, true);

    const emps = sc.employees.map(ensureEmployeeWeeksSchedule);
    let baseLunchMiss = 0;
    let cascadeLunchMiss = 0;
    let janBaseDual = 0;
    let janCascDual = 0;

    for (const w of WEEK_NUMS) {
      for (const d of ['SEG', 'TER', 'QUA', 'QUI', 'SEX'] as DayOfWeek[]) {
        const dayEmps = emps.map((e) => ({
          ...e,
          schedule: JSON.parse(JSON.stringify(e.weeksSchedule![w])),
        }));
        const jp = dayEmps.find((e) => e.id === 'emp-joao-pedro');
        const mar = dayEmps.find((e) => e.id === 'emp-marielly');
        const allisson = dayEmps.find((e) => e.id === 'emp-allisson');
        const prepActive = dayEmps.filter(
          (e) => e.defaultStore === 'LOJA_1' && e.department === 'PREPARACAO' && e.schedule[d]?.type === 'TRABALHO'
        ).length;
        const docActive = dayEmps
          .filter(
            (e) =>
              (e.defaultStore === 'LOJA_2' && e.department === 'DOCUMENTACAO') ||
              e.department === 'SUCESSO_CLIENTE'
          )
          .filter(
            (e) =>
              (e.contractType === 'CLT_ATIVO' || e.contractType === 'CLT_TEMPORARIO') &&
              e.schedule[d]?.type === 'TRABALHO'
          ).length;
        const mayanaOrScActive = ['emp-mayana', 'emp-jorge', 'emp-grazy'].some(
          (id) => dayEmps.find((e) => e.id === id)?.schedule[d]?.type === 'TRABALHO'
        );

        const jpAtLunch = jp?.schedule[d]?.type === 'TRABALHO';
        const marUnavailableForFinLunch = !mar || mar.schedule[d]?.type !== 'TRABALHO' || d === 'SEX';
        if (jpAtLunch && marUnavailableForFinLunch && (!mar || mar.schedule[d]?.type !== 'TRABALHO')) {
          baseLunchMiss++;
          const canCascade = allisson?.schedule[d]?.type === 'TRABALHO' && prepActive >= 3 && docActive >= 2 && mayanaOrScActive;
          if (!canCascade) cascadeLunchMiss++;
        }

        // Jan/2027 (L1-MKT = 0 CLT qdo Nailson em férias): sobrecarga dupla qdo Marielly OFF em Seg–Sex
        const nailsonAtWorkIfNotVac = dayEmps.find((e) => e.id === 'emp-nailson')?.schedule[d]?.type === 'TRABALHO';
        if (nailsonAtWorkIfNotVac && mar?.schedule[d]?.type !== 'TRABALHO') {
          janBaseDual++;
          const canCascade = allisson?.schedule[d]?.type === 'TRABALHO' && prepActive >= 3 && docActive >= 2 && mayanaOrScActive;
          if (!canCascade) janCascDual++;
        }
      }
    }

    const cascDetails = cascN1.caseDetails.filter((l) => l.includes('C1-Cascata')).join(' | ');
    console.log(
      `  • [${sc.id}] N-1 Camada 2 Liderança: ${baseN1.solvedByCirculatingLead} -> ${cascN1.solvedByCirculatingLead}/${cascN1.totalBroken} (C1 CLT total=${cascN1.solvedByInternalClt}/${cascN1.totalBroken}, cascata=${cascN1.solvedByCascadeClt}) | Almoço L2-FIN sem backup CLT: ${baseLunchMiss}/20 -> ${cascadeLunchMiss}/20 | Choque Duplo Jan/2027 (L1-MKT=0 + FIN): ${janBaseDual}/20 -> ${janCascDual}/20`
    );
    if (cascDetails) {
      console.log(`      - Execuções da Cascata: ${cascDetails}`);
    }
  }
  console.log('');
}

interface N2EvaluationOutcome {
  kind: 'ZERO_IMPACTO' | 'C1_CLT' | 'C2_1_LIDER' | 'C2_2_LIDERES' | 'COLAPSO_N2';
  brokenSectors?: string[];
  detail?: string;
}

/**
 * Rodada #12:
 * - 12A: Matriz Real de Estresse Duplo Simultâneo (N-2 CLT) em S1–S4 × Seg–Sáb respeitando exclusividade física da Liderança;
 * - 12B: Equalização dos Sábados-Feriados S2 (06/03/2027 Data Magna PE & 01/05/2027 Dia do Trabalho) via Compensação em SEX (4/4 -> 3/4).
 */
function runRodada12StressN2AndSatHolidayAudit(scenList: Scenario[], cenBHybridV9: Scenario) {
  console.log('=== RODADA #12A: MATRIZ DE ESTRESSE DUPLO SIMULTÂNEO (N-2 CLT) EM S1–S4 × SEG–SÁB ===');
  const sellerL1Ids = new Set(['emp-joao-alexandre', 'emp-jair', 'emp-marcos-antonio', 'emp-rayssa']);
  const finCascadeIds = ['emp-mayana', 'emp-jorge', 'emp-grazy'];
  const activeCltIdSet = new Set(
    cenBHybridV9.employees
      .filter((e) => e.contractType === 'CLT_ATIVO' || e.contractType === 'CLT_TEMPORARIO')
      .map((e) => e.id)
  );

  const scoreBrokenCoverage = (cov: ReturnType<typeof calculateSectorDailyCoverage>): number =>
    cov.reduce((sum, c) => (c.status === 'SEGURO' ? sum : sum + (c.status === 'CRITICO' ? 10 : 1)), 0);

  const generateMoves = (emps: Employee[], dKey: DayOfWeek) => {
    const moves: Array<{ empId: string; toChair: string }> = [];
    const l1ToExtCand = emps.find(
      (s) => sellerL1Ids.has(s.id) && s.schedule[dKey]?.type === 'TRABALHO' && s.schedule[dKey].chairId !== 'VEND-L2-EXT'
    );
    if (l1ToExtCand) moves.push({ empId: l1ToExtCand.id, toChair: 'VEND-L2-EXT' });

    const extSeller = emps.find(
      (s) => sellerL1Ids.has(s.id) && s.schedule[dKey]?.type === 'TRABALHO' && s.schedule[dKey].chairId === 'VEND-L2-EXT'
    );
    if (extSeller) moves.push({ empId: extSeller.id, toChair: 'VEND-L1-4' });

    const jorg = emps.find(
      (s) => s.id === 'emp-rosinaldo' && s.schedule[dKey]?.type === 'TRABALHO' && s.schedule[dKey].chairId !== 'VEND-L1-4'
    );
    if (jorg) moves.push({ empId: jorg.id, toChair: 'VEND-L1-4' });

    const allisson = emps.find(
      (s) => s.id === 'emp-allisson' && s.schedule[dKey]?.type === 'TRABALHO' && s.schedule[dKey].chairId !== 'DOC-AUX'
    );
    if (allisson) moves.push({ empId: allisson.id, toChair: 'DOC-AUX' });

    const marielly = emps.find(
      (s) => s.id === 'emp-marielly' && s.schedule[dKey]?.type === 'TRABALHO' && s.schedule[dKey].chairId !== 'FIN-1'
    );
    if (marielly) moves.push({ empId: marielly.id, toChair: 'FIN-1' });

    for (const cid of finCascadeIds) {
      const cEmp = emps.find(
        (s) => s.id === cid && s.schedule[dKey]?.type === 'TRABALHO' && s.schedule[dKey].chairId !== 'FIN-1'
      );
      if (cEmp) {
        moves.push({ empId: cEmp.id, toChair: 'FIN-1' });
        break;
      }
    }
    return moves;
  };

  const applyChairMove = (emps: Employee[], dKey: DayOfWeek, empId: string, toChair: string): Employee[] =>
    emps.map((e) =>
      e.id === empId ? { ...e, schedule: { ...e.schedule, [dKey]: { ...e.schedule[dKey], chairId: toChair } } } : e
    );

  const attachLeadCoverage = (
    emps: Employee[],
    dKey: DayOfWeek,
    assignments: Array<{ absentId: string; lead: { id: string; name: string } }>
  ): Employee[] => {
    const byAbsent = new Map(assignments.map((a) => [a.absentId, a.lead]));
    return emps.map((e) => {
      const lead = byAbsent.get(e.id);
      if (!lead) return e;
      return {
        ...e,
        schedule: {
          ...e.schedule,
          [dKey]: {
            ...e.schedule[dKey],
            coverage: {
              coveredByEmployeeId: lead.id,
              coveredByName: lead.name,
              status: 'ATRIBUIDO' as const,
            },
          },
        },
      };
    });
  };

  const evaluatePairN2 = (weekEmps: Employee[], w: 1 | 2 | 3 | 4, dKey: DayOfWeek, empA: Employee, empB: Employee): N2EvaluationOutcome => {
    const simEmps = weekEmps.map((e) =>
      e.id === empA.id || e.id === empB.id
        ? {
            ...e,
            schedule: {
              ...e.schedule,
              [dKey]: { day: dKey, type: 'FOLGA_5X2' as const, chairId: e.defaultChairId, label: 'Sim. Falta N-2' },
            },
          }
        : e
    );

    const cov0 = calculateSectorDailyCoverage(simEmps, dKey);
    const score0 = scoreBrokenCoverage(cov0);
    if (score0 === 0) return { kind: 'ZERO_IMPACTO' };

    let bestState = simEmps;
    let bestScore = score0;
    const moves1 = generateMoves(simEmps, dKey);
    const step1States: Array<{ state: Employee[]; movedId: string }> = [];

    for (const m1 of moves1) {
      const s1 = applyChairMove(simEmps, dKey, m1.empId, m1.toChair);
      const sc1 = scoreBrokenCoverage(calculateSectorDailyCoverage(s1, dKey));
      if (sc1 === 0) return { kind: 'C1_CLT' };
      if (sc1 < bestScore) {
        bestScore = sc1;
        bestState = s1;
      }
      step1States.push({ state: s1, movedId: m1.empId });
    }

    for (const st1 of step1States) {
      const moves2 = generateMoves(st1.state, dKey);
      for (const m2 of moves2) {
        if (m2.empId === st1.movedId) continue;
        const s2 = applyChairMove(st1.state, dKey, m2.empId, m2.toChair);
        const sc2 = scoreBrokenCoverage(calculateSectorDailyCoverage(s2, dKey));
        if (sc2 === 0) return { kind: 'C1_CLT' };
        if (sc2 < bestScore) {
          bestScore = sc2;
          bestState = s2;
        }
      }
    }

    const remBroken = calculateSectorDailyCoverage(bestState, dKey).filter((c) => c.status !== 'SEGURO');
    const leadsMap = new Map<string, { id: string; name: string }>();
    for (const b of remBroken) {
      const sd = SECTOR_DEFINITIONS.find((s) => s.id === b.sector.id);
      for (const p of sd?.primaryBackups || []) {
        if (!activeCltIdSet.has(p.id)) leadsMap.set(p.id, p);
      }
    }
    const leadsPool = Array.from(leadsMap.values());

    for (const lead of leadsPool) {
      for (const targetId of [empA.id, empB.id]) {
        const backed = attachLeadCoverage(bestState, dKey, [{ absentId: targetId, lead }]);
        if (scoreBrokenCoverage(calculateSectorDailyCoverage(backed, dKey)) === 0) {
          return { kind: 'C2_1_LIDER' };
        }
      }
    }

    for (const l1 of leadsPool) {
      for (const l2 of leadsPool) {
        if (l1.id === l2.id) continue;
        const backed = attachLeadCoverage(bestState, dKey, [
          { absentId: empA.id, lead: l1 },
          { absentId: empB.id, lead: l2 },
        ]);
        if (scoreBrokenCoverage(calculateSectorDailyCoverage(backed, dKey)) === 0) {
          return { kind: 'C2_2_LIDERES' };
        }
      }
    }

    return {
      kind: 'COLAPSO_N2',
      brokenSectors: remBroken.map((b) => b.sector.id),
      detail: `S${w} ${dKey} (${empA.shortName}+${empB.shortName} -> ${remBroken.map((b) => `${b.sector.id}:${b.status}`).join('+')})`,
    };
  };

  for (const sc of scenList) {
    const emps = sc.employees.map(ensureEmployeeWeeksSchedule);
    let totalPairs = 0;
    let zeroImpact = 0;
    let c1Clt = 0;
    let c2OneLead = 0;
    let c2TwoLeads = 0;
    let collapseCount = 0;
    const collapseBySector = new Map<string, number>();
    const collapseByDay = new Map<DayOfWeek, number>();
    const collapseExamples: string[] = [];

    for (const w of WEEK_NUMS) {
      const weekEmps = emps.map((e) => ({ ...e, schedule: JSON.parse(JSON.stringify(e.weeksSchedule![w])) }));
      for (const dKey of ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'] as DayOfWeek[]) {
        const activeToday = weekEmps.filter(
          (e) =>
            (e.contractType === 'CLT_ATIVO' || e.contractType === 'CLT_TEMPORARIO') &&
            e.schedule[dKey]?.type === 'TRABALHO'
        );
        for (let i = 0; i < activeToday.length; i++) {
          for (let j = i + 1; j < activeToday.length; j++) {
            totalPairs++;
            const out = evaluatePairN2(weekEmps, w, dKey, activeToday[i], activeToday[j]);
            if (out.kind === 'ZERO_IMPACTO') zeroImpact++;
            else if (out.kind === 'C1_CLT') c1Clt++;
            else if (out.kind === 'C2_1_LIDER') c2OneLead++;
            else if (out.kind === 'C2_2_LIDERES') c2TwoLeads++;
            else {
              collapseCount++;
              collapseByDay.set(dKey, (collapseByDay.get(dKey) || 0) + 1);
              for (const sid of out.brokenSectors || []) {
                collapseBySector.set(sid, (collapseBySector.get(sid) || 0) + 1);
              }
              if (collapseExamples.length < 4 && out.detail) collapseExamples.push(out.detail);
            }
          }
        }
      }
    }

    const cltOkPct = (((zeroImpact + c1Clt) / totalPairs) * 100).toFixed(1);
    const totalRescuedPct = (((totalPairs - collapseCount) / totalPairs) * 100).toFixed(1);
    const collapsePct = ((collapseCount / totalPairs) * 100).toFixed(1);
    const topSecs = Array.from(collapseBySector.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k}:${v}`)
      .join(', ');
    const topDays = Array.from(collapseByDay.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k}:${v}`)
      .join(', ');

    console.log(
      `  • [${sc.id}] Pares N-2=${totalPairs} | 0-Impacto=${zeroImpact} + C1-CLT=${c1Clt} (${cltOkPct}% sem Liderança) | C2 1-Líder=${c2OneLead} | C2 2-Líderes=${c2TwoLeads} | Sobrevivência=${totalRescuedPct}% | COLAPSO N-2=${collapseCount} (${collapsePct}%)`
    );
    if (collapseCount > 0) {
      console.log(`      - Gargalos Colapso N-2: Setores=[${topSecs}] | Dias=[${topDays}] | Ex: ${collapseExamples.join(' ; ')}`);
    }
  }
  console.log('');

  console.log('=== RODADA #12B: EQUALIZAÇÃO DOS SÁBADOS-FERIADOS S2 (06/03 DATA MAGNA PE & 01/05 TRABALHO) NO SEMESTRE 182d ===');
  const { m1Nov, m2Dez, m3Jan, m4Fev } = buildSeasonalFourPhasePlans(cenBHybridV9);
  const fourPhases = [m1Nov, m2Dez, m3Jan, m4Fev];
  const natHolidays = getSemesterHolidays(false);
  const fullHolidaysPE = getSemesterHolidays(true);

  const satVictims = (sc: Scenario) =>
    sc.employees
      .filter((e) => (e.contractType === 'CLT_ATIVO' || e.contractType === 'CLT_TEMPORARIO') && e.weeksSchedule?.[2]?.SAB?.type === 'FOLGA_5X2')
      .map((e) => e.shortName)
      .join(', ');
  console.log(`  • Causa raiz dos 8.4h na Rodada #11: S2 em M5 (06/03 PE)=[${satVictims(m1Nov)}] & S2 em M7 (01/05 Nac/PE)=[${satVictims(m3Jan)}] trabalham 42.0h vs pares 33.6h.`);

  console.log('  -- Feriados Nacionais Federais (Teste Rotação M7 vs Compensação Justa SEX 4/4->3/4) --');
  evaluateSemesterCalendar({
    label: 'Nac | Rodada #12B-1 Inversão M7=M4 sem Comp. SEX (prova limite físico sem compensação)',
    holidays: natHolidays,
    phases: fourPhases,
    rotatePhases: true,
    phaseIndexByBlock: [0, 1, 2, 3, 0, 1, 3],
    antiAbsorption: true,
  });
  evaluateSemesterCalendar({
    label: 'Nac | Rodada #12B-2 M1..M4 + Protocolo Justo Sáb-Feriado (Comp. SEX 4/4->3/4)',
    holidays: natHolidays,
    phases: fourPhases,
    rotatePhases: true,
    antiAbsorption: true,
    antiSatHolidayComp: true,
    logSwaps: true,
  });

  console.log('  -- Completo PE/Recife (06/03 Data Magna + 01/05 Trabalho Compensados em SEX 4/4->3/4) --');
  evaluateSemesterCalendar({
    label: 'PE  | Rodada #12B-2 M1..M4 + Protocolo Justo Sáb-Feriado (06/03 & 01/05 Comp. SEX)',
    holidays: fullHolidaysPE,
    phases: fourPhases,
    rotatePhases: true,
    antiAbsorption: true,
    antiSatHolidayComp: true,
    logSwaps: true,
  });
  evaluateSemesterCalendar({
    label: 'PE  | Rodada #12B-3 M5=M3 & M7=M4 + Protocolo Justo Sáb-Feriado (Anti-Assimetria 6.5 Ciclos)',
    holidays: fullHolidaysPE,
    phases: fourPhases,
    rotatePhases: true,
    phaseIndexByBlock: [0, 1, 2, 3, 2, 1, 3],
    antiAbsorption: true,
    antiSatHolidayComp: true,
    logSwaps: true,
  });
  console.log('');
}

function runAudit() {
  const scenarios = createDefaultScenarios();
  const baseAudits = scenarios.map(auditScenarioDeep);
  const allAudits = [...baseAudits];

  console.log('=== AUDITORIA PROFUNDA DAS ESCALAS — SEU CARRO PE ===');
  console.log(`Executado em: ${new Date().toISOString()}`);
  console.log(
    `Horários padrão configurados: Seg–Sex ${DEFAULT_STORE_HOURS.LOJA_1.weekdayOpen}–${DEFAULT_STORE_HOURS.LOJA_1.weekdayClose}, Sáb ${DEFAULT_STORE_HOURS.LOJA_1.saturdayOpen}–${DEFAULT_STORE_HOURS.LOJA_1.saturdayClose}`
  );
  console.log('');

  for (const a of baseAudits) {
    printAuditBlock(a);
  }

  const tradBase = scenarios.find((s) => s.id === 'scen-opt-trad-5050');
  const cenBBase = scenarios.find((s) => s.id === 'scen-opt-b-est-5050');
  const trad3SabBase = scenarios.find((s) => s.id === 'scen-opt-trad-3sab');
  const cenB3SabBase = scenarios.find((s) => s.id === 'scen-opt-b-est-3sab');
  if (tradBase && cenBBase) {
    console.log('=== SIMULADOR SANDBOX v2–v6 + PÓS-LICENÇA GRAZY (RODADAs #1–#6) ===');
    const sb2Trad = auditScenarioDeep(applySandboxTransform(tradBase, 'TRAD_V2'));
    const sb2CenB = auditScenarioDeep(applySandboxTransform(cenBBase, 'CENB_V2'));
    const sb3Trad = auditScenarioDeep(applySandboxV3Additions(applySandboxTransform(tradBase, 'TRAD_V2'), 'TRAD_V3'));
    const sb3CenB = auditScenarioDeep(applySandboxV3Additions(applySandboxTransform(cenBBase, 'CENB_V2'), 'CENB_V3'));
    const sb4Trad = auditScenarioDeep(applySandboxV4Transform(tradBase, 'TRAD_V4'));
    const sb4CenB = auditScenarioDeep(applySandboxV4Transform(cenBBase, 'CENB_V4'));

    const postLic = buildPostLicenseScenarios(cenBBase);
    const postLegacyAudit = auditScenarioDeep(postLic.legacy);
    const postV4Audit = auditScenarioDeep(postLic.sandboxV4);

    const sb3TradScenario = applySandboxV3Additions(applySandboxTransform(tradBase, 'TRAD_V2'), 'TRAD_V3');
    const sb6TradScenario = trad3SabBase ? applySandbox3SabFixedTransform(trad3SabBase, 'TRAD') : null;
    const sb10TradHybrid = sb6TradScenario ? buildHybridSelectiveTradV10(sb3TradScenario, sb6TradScenario) : null;

    const sb3CenBScenario = applySandboxV3Additions(applySandboxTransform(cenBBase, 'CENB_V2'), 'CENB_V3');
    const sb6CenBScenario = cenB3SabBase ? applySandbox3SabFixedTransform(cenB3SabBase, 'CENB') : null;
    const sb8CenBHybrid = sb6CenBScenario ? buildHybridSelectiveV8(sb3CenBScenario, sb6CenBScenario) : null;
    const sb9CenBHybrid = sb8CenBHybrid && sb6CenBScenario ? buildHybridSelectiveV9(sb8CenBHybrid, sb6CenBScenario) : null;

    const extras: DeepScenarioAudit[] = [sb2Trad, sb2CenB, sb3Trad, sb3CenB, sb4Trad, sb4CenB, postLegacyAudit, postV4Audit];
    if (sb6TradScenario && sb6CenBScenario) {
      extras.push(auditScenarioDeep(sb6TradScenario), auditScenarioDeep(sb6CenBScenario));
    }
    if (sb8CenBHybrid) {
      extras.push(auditScenarioDeep(sb8CenBHybrid));
    }
    if (sb9CenBHybrid) {
      extras.push(auditScenarioDeep(sb9CenBHybrid));
    }
    if (sb10TradHybrid) {
      extras.push(auditScenarioDeep(sb10TradHybrid));
    }

    for (const sba of extras) {
      printAuditBlock(sba);
      allAudits.push(sba);
    }

    const quarterMonths = runQuarterly12WeekComparison(cenBBase, sb3CenBScenario);
    runShiftWindowEquityAudit(sb3CenBScenario, quarterMonths);
    if (sb6CenBScenario && sb8CenBHybrid && sb9CenBHybrid) {
      const stressList = [cenBBase, sb3CenBScenario, sb6CenBScenario, sb8CenBHybrid, sb9CenBHybrid];
      const n1List = [sb3CenBScenario, sb6CenBScenario, sb8CenBHybrid, sb9CenBHybrid];
      if (sb6TradScenario && sb10TradHybrid) {
        stressList.push(sb3TradScenario, sb6TradScenario, sb10TradHybrid);
        n1List.push(sb3TradScenario, sb6TradScenario, sb10TradHybrid);
      }
      runStressResilienceAudit(stressList);
      runN1RedeploymentSolver(n1List);
      runNailsonJan2027ContingencyAudit(sb3CenBScenario, sb9CenBHybrid);
      runRealCalendarSeasonAudit([sb3CenBScenario, sb6CenBScenario, sb8CenBHybrid, sb9CenBHybrid]);
      runRealSeasonalQuarterCompensation(sb9CenBHybrid);
      if (sb10TradHybrid) {
        runRodada11SemesterAndCascadeAudit(sb9CenBHybrid, sb10TradHybrid);
        runRodada12StressN2AndSatHolidayAudit(
          [sb3CenBScenario, sb9CenBHybrid, sb6CenBScenario, sb10TradHybrid],
          sb9CenBHybrid
        );
      }
    }
  }

  console.log('=== RANKING GERAL (SCORE PONDERADO 0–100 | BASE vs COBERTURA CRUZADA) ===');
  [...allAudits]
    .sort((a, b) => b.coverageAwareScore - a.coverageAwareScore || b.qualityScore.total - a.qualityScore.total)
    .forEach((a, idx) => {
      console.log(
        `  #${idx + 1} [${a.id}] -> Base ${a.qualityScore.total.toFixed(1)} | c/ Backup Cruzado ${a.coverageAwareScore.toFixed(1)}/100 (${a.qualityScore.breakdown})`
      );
    });
  console.log('');
}

runAudit();
