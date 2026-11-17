import { CHAIRS, DEPARTMENTS } from '../data/seuCarroData';
import {
  ChairDefinition,
  ContractType,
  DayOfWeek,
  DayShift,
  DepartmentId,
  Employee,
  EmployeeComplianceResult,
  EmployeeMonthlySummary,
  EmployeePontoMaisSummary,
  LegalPhase,
  PontoMaisStandardConfig,
  SectorMinimumsMap,
  StoreHoursMap,
  StoreId,
} from '../types/schedule';
import {
  buildDefaultWorkShiftForDay,
  checkMonthlyTeamOperationalAndAffinities,
  checkParallelFolgaConflict,
  DAYS_OF_WEEK,
  DEFAULT_STORE_HOURS,
  ensureEmployeeWeeksSchedule,
  formatHoursDecimal,
  LEGAL_PHASES,
  updateEmployeeLunchHours,
} from './compliance';
import { calculateWeeklyCoverageSummary } from './coverage';
import { findChairOccupant } from './scheduleFilters';

export interface NewMemberInput {
  name: string;
  shortName?: string;
  role: string;
  contractType: ContractType;
  department: DepartmentId;
  defaultStore: StoreId;
  defaultChairId?: string;
  badgeColor?: string;
  defaultLunchStart?: string;
  defaultLunchEnd?: string;
  rulesAndRestrictions?: string;
  saturdayOffWeek?: number;
  weekdayOff?: DayOfWeek;
}

const CHAIR_PREFIX_BY_DEPT: Record<DepartmentId, (store: StoreId) => string> = {
  SDR: () => 'SDR',
  VENDAS: (store) => (store === 'LOJA_1' ? 'VEND-L1' : 'VEND-L2'),
  PREPARACAO: () => 'PREP',
  DOCUMENTACAO: () => 'DOC',
  FINANCEIRO: () => 'FIN',
  SUCESSO_CLIENTE: () => 'SC',
  MARKETING: () => 'MKT',
  GESTAO: () => 'GEST',
};

export function getDepartmentBadgeColor(department: DepartmentId): string {
  return DEPARTMENTS.find((d) => d.id === department)?.badgeColor || '#2563EB';
}

export function deriveShortName(fullName: string): string {
  const trimmed = fullName.trim();
  if (!trimmed) return 'Novo(a)';
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0];
  return parts[0].length <= 3 ? `${parts[0]} ${parts[1]}` : parts[0];
}

/**
 * Gera o próximo código único de cadeira para a loja/setor informados (ex: SDR-5, VEND-L1-5, FIN-2).
 */
export function generateNextChairId(
  department: DepartmentId,
  store: StoreId,
  employees: Employee[],
  baseChairs: ChairDefinition[] = CHAIRS
): string {
  const prefix = CHAIR_PREFIX_BY_DEPT[department](store);
  const usedIds = new Set<string>([
    ...employees.map((e) => e.defaultChairId).filter(Boolean),
    ...baseChairs.map((c) => c.id).filter(Boolean),
  ]);

  let maxNum = 0;
  let matchingExistingCount = 0;

  for (const id of usedIds) {
    if (!id.startsWith(`${prefix}-`)) continue;
    matchingExistingCount++;
    const suffix = id.slice(prefix.length + 1);
    const parsed = parseInt(suffix, 10);
    if (!isNaN(parsed) && String(parsed) === suffix) {
      maxNum = Math.max(maxNum, parsed);
    }
  }

  let candidateNum = Math.max(maxNum + 1, matchingExistingCount + 1, 1);
  while (usedIds.has(`${prefix}-${candidateNum}`)) {
    candidateNum++;
  }
  return `${prefix}-${candidateNum}`;
}

/**
 * Monta dinamicamente a lista de cadeiras visíveis para uma seção (Loja + Setor),
 * preservando as cadeiras estáticas cujo ocupante ainda existe e incluindo cadeiras
 * criadas dinamicamente por edição ou adição de membros.
 */
export function buildSectionChairs(
  staticChairIds: string[],
  storeId: StoreId,
  deptId: DepartmentId,
  employees: Employee[],
  baseChairs: ChairDefinition[] = CHAIRS
): ChairDefinition[] {
  const result: ChairDefinition[] = [];
  const addedChairIds = new Set<string>();
  const weeks = [1, 2, 3, 4];

  for (const chairId of staticChairIds) {
    const baseDef = baseChairs.find((c) => c.id === chairId);
    const occupant = findChairOccupant(chairId, employees, weeks);
    if (!occupant) {
      // Ao excluir o colaborador, a linha desaparece limpa da tabela
      continue;
    }

    // Se o colaborador mudou de loja ou setor no cadastro, respeita a nova seção
    if (
      occupant.defaultChairId === chairId &&
      (occupant.defaultStore !== storeId ||
        (occupant.department !== deptId &&
          !(storeId === 'LOJA_2' && deptId === 'DOCUMENTACAO' && occupant.department === 'SUCESSO_CLIENTE')))
    ) {
      continue;
    }

    if (baseDef) {
      const updatedName = baseDef.name.replace(/\([^)]*\)/, `(${occupant.shortName})`);
      result.push({
        ...baseDef,
        name: updatedName.includes(occupant.shortName)
          ? updatedName
          : `${baseDef.code} (${occupant.shortName})`,
      });
    } else {
      result.push({
        id: chairId,
        code: chairId,
        name: `${chairId} (${occupant.shortName})`,
        store: storeId,
        department: occupant.department,
        description: occupant.role,
      });
    }
    addedChairIds.add(chairId);
  }

  // Adiciona colaboradores incluídos/movidos para esta loja + setor cuja cadeira não está nos estáticos
  for (const emp of employees) {
    if (emp.defaultStore !== storeId) continue;
    const matchesSection =
      emp.department === deptId ||
      (storeId === 'LOJA_2' && deptId === 'DOCUMENTACAO' && emp.department === 'SUCESSO_CLIENTE');
    if (!matchesSection) continue;
    if (addedChairIds.has(emp.defaultChairId)) continue;

    const existingBase = baseChairs.find((c) => c.id === emp.defaultChairId);
    result.push(
      existingBase
        ? {
            ...existingBase,
            store: storeId,
            department: emp.department,
            name: existingBase.name.includes(emp.shortName)
              ? existingBase.name
              : `${emp.defaultChairId} (${emp.shortName})`,
          }
        : {
            id: emp.defaultChairId,
            code: emp.defaultChairId,
            name: `Posto ${emp.defaultChairId} (${emp.shortName})`,
            store: storeId,
            department: emp.department,
            description: emp.role,
          }
    );
    addedChairIds.add(emp.defaultChairId);
  }

  return result;
}

/**
 * Cria um novo colaborador completo já com ciclo S1–S4 inicializado respeitando contrato e loja.
 */
export function createNewMember(
  input: NewMemberInput,
  existingEmployees: Employee[],
  storeHours?: StoreHoursMap
): Employee {
  const cleanName = input.name.trim() || 'Novo Colaborador';
  const shortName = (input.shortName || '').trim() || deriveShortName(cleanName);
  const slug = shortName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  const uniqueId = `emp-${slug || 'membro'}-${Date.now().toString(36).slice(-4)}${Math.floor(
    Math.random() * 90 + 10
  )}`;
  const chairId =
    input.defaultChairId?.trim() ||
    generateNextChairId(input.department, input.defaultStore, existingEmployees);

  const badgeColor = input.badgeColor || getDepartmentBadgeColor(input.department);
  const isEstagio = input.contractType === 'ESTAGIARIO';
  const isLicenca = input.contractType === 'LICENCA_MATERNIDADE';
  const satOffWeek = Math.max(1, Math.min(4, input.saturdayOffWeek || 1));
  const weekdayOff: DayOfWeek =
    input.weekdayOff || (input.department === 'SDR' ? 'TER' : 'SEG');

  const lunchStart = isEstagio || isLicenca ? undefined : input.defaultLunchStart || '12:00';
  const lunchEnd = isEstagio || isLicenca ? undefined : input.defaultLunchEnd || '13:30';

  const stubEmp: Employee = {
    id: uniqueId,
    name: cleanName,
    shortName,
    role: input.role.trim() || 'Colaborador(a)',
    contractType: input.contractType,
    department: input.department,
    defaultStore: input.defaultStore,
    defaultChairId: chairId,
    badgeColor,
    defaultLunchStart: lunchStart,
    defaultLunchEnd: lunchEnd,
    isCirculating: input.contractType === 'LIDERANCA',
    saturdayOffWeek: satOffWeek,
    rulesAndRestrictions:
      input.rulesAndRestrictions?.trim() || 'Sem restrições operacionais cadastradas.',
    schedule: {} as Record<DayOfWeek, DayShift>,
  };

  if (isLicenca) {
    const licSchedule = {} as Record<DayOfWeek, DayShift>;
    DAYS_OF_WEEK.forEach((d) => {
      licSchedule[d.key] = { day: d.key, type: 'LICENCA', chairId, label: 'Licença' };
    });
    const weeksSchedule: Record<number, Record<DayOfWeek, DayShift>> = {};
    for (let w = 1; w <= 4; w++) {
      weeksSchedule[w] = JSON.parse(JSON.stringify(licSchedule));
    }
    return {
      ...stubEmp,
      schedule: licSchedule,
      weeksSchedule,
    };
  }

  const weeksSchedule: Record<number, Record<DayOfWeek, DayShift>> = {};
  for (let w = 1; w <= 4; w++) {
    const weekSched = {} as Record<DayOfWeek, DayShift>;
    for (const d of DAYS_OF_WEEK) {
      if (d.key === 'DOM') {
        weekSched.DOM = { day: 'DOM', type: 'FOLGA_DSR', chairId, label: 'DSR' };
        continue;
      }

      if (isEstagio) {
        weekSched[d.key] = buildDefaultWorkShiftForDay(stubEmp, d.key, chairId, storeHours);
        continue;
      }

      if (d.key === 'SAB') {
        if (w === satOffWeek) {
          weekSched.SAB = {
            day: 'SAB',
            type: 'FOLGA_5X2',
            chairId,
            label: 'Folga Mensal Sáb',
          };
        } else {
          weekSched.SAB = buildDefaultWorkShiftForDay(stubEmp, 'SAB', chairId, storeHours);
        }
        continue;
      }

      if (w !== satOffWeek && d.key === weekdayOff) {
        weekSched[d.key] = { day: d.key, type: 'FOLGA_5X2', chairId, label: 'Folga 5x2' };
      } else {
        weekSched[d.key] = buildDefaultWorkShiftForDay(stubEmp, d.key, chairId, storeHours);
      }
    }
    weeksSchedule[w] = weekSched;
  }

  return ensureEmployeeWeeksSchedule({
    ...stubEmp,
    schedule: weeksSchedule[1],
    weeksSchedule,
  });
}

/**
 * Atualiza o perfil de um colaborador existente e sincroniza cadeira, almoço ou turnos S1–S4.
 */
export function updateMemberProfile(
  employees: Employee[],
  memberId: string,
  patch: Partial<NewMemberInput>,
  options: {
    rebuildScheduleWithStoreHours?: boolean;
    storeHours?: StoreHoursMap;
  } = {}
): Employee[] {
  return employees.map((emp) => {
    if (emp.id !== memberId) return emp;

    const prepared = ensureEmployeeWeeksSchedule(emp);
    const nextDepartment = patch.department ?? prepared.department;
    const nextStore = patch.defaultStore ?? prepared.defaultStore;
    const deptOrStoreChanged =
      nextDepartment !== prepared.department || nextStore !== prepared.defaultStore;

    const nextChairId =
      patch.defaultChairId?.trim() ||
      (deptOrStoreChanged
        ? generateNextChairId(nextDepartment, nextStore, employees)
        : prepared.defaultChairId);

    const nextContractType = patch.contractType ?? prepared.contractType;
    const contractChanged = nextContractType !== prepared.contractType;
    const nextName = patch.name !== undefined ? patch.name.trim() || prepared.name : prepared.name;
    const nextShortName =
      patch.shortName !== undefined
        ? patch.shortName.trim() || deriveShortName(nextName)
        : prepared.shortName;

    const isEstagio = nextContractType === 'ESTAGIARIO';
    const isLicenca = nextContractType === 'LICENCA_MATERNIDADE';
    const nextLunchStart =
      isEstagio || isLicenca
        ? undefined
        : patch.defaultLunchStart !== undefined
        ? patch.defaultLunchStart
        : prepared.defaultLunchStart || '12:00';
    const nextLunchEnd =
      isEstagio || isLicenca
        ? undefined
        : patch.defaultLunchEnd !== undefined
        ? patch.defaultLunchEnd
        : prepared.defaultLunchEnd || '13:30';

    const nextBadgeColor =
      patch.badgeColor ||
      (patch.department ? getDepartmentBadgeColor(nextDepartment) : prepared.badgeColor);

    const nextWeeks = JSON.parse(JSON.stringify(prepared.weeksSchedule!)) as Record<
      number,
      Record<DayOfWeek, DayShift>
    >;

    const baseUpdated: Employee = {
      ...prepared,
      name: nextName,
      shortName: nextShortName,
      role: patch.role !== undefined ? patch.role.trim() || prepared.role : prepared.role,
      contractType: nextContractType,
      department: nextDepartment,
      defaultStore: nextStore,
      defaultChairId: nextChairId,
      badgeColor: nextBadgeColor,
      defaultLunchStart: nextLunchStart,
      defaultLunchEnd: nextLunchEnd,
      isCirculating: nextContractType === 'LIDERANCA',
      rulesAndRestrictions:
        patch.rulesAndRestrictions !== undefined
          ? patch.rulesAndRestrictions.trim()
          : prepared.rulesAndRestrictions,
      saturdayOffWeek: patch.saturdayOffWeek ?? prepared.saturdayOffWeek,
    };

    if (isLicenca) {
      for (let w = 1; w <= 4; w++) {
        const ws = {} as Record<DayOfWeek, DayShift>;
        DAYS_OF_WEEK.forEach((d) => {
          ws[d.key] = { day: d.key, type: 'LICENCA', chairId: nextChairId, label: 'Licença' };
        });
        nextWeeks[w] = ws;
      }
      return {
        ...baseUpdated,
        schedule: nextWeeks[1],
        weeksSchedule: nextWeeks,
      };
    }

    const storeChanged = patch.defaultStore !== undefined && patch.defaultStore !== prepared.defaultStore;
    const shouldRebuildWorkShifts = Boolean(
      options.rebuildScheduleWithStoreHours || contractChanged || storeChanged
    );

    for (let w = 1; w <= 4; w++) {
      const sched = nextWeeks[w];
      if (!sched) continue;
      DAYS_OF_WEEK.forEach((dInfo) => {
        const d = dInfo.key;
        const shift = sched[d];
        if (!shift) return;
        if (shouldRebuildWorkShifts && (shift.type === 'TRABALHO' || shift.type === 'LICENCA')) {
          if (d === 'DOM') {
            sched[d] = { day: d, type: 'FOLGA_DSR', chairId: nextChairId, label: 'DSR' };
          } else {
            sched[d] = buildDefaultWorkShiftForDay(
              baseUpdated,
              d,
              nextChairId,
              options.storeHours
            );
          }
        } else {
          sched[d] = {
            ...shift,
            chairId: nextChairId,
          };
        }
      });
    }

    let resultEmp: Employee = {
      ...baseUpdated,
      weeksSchedule: nextWeeks,
      schedule: nextWeeks[1],
    };

    const lunchChanged =
      !isEstagio &&
      !isLicenca &&
      (nextLunchStart !== prepared.defaultLunchStart || nextLunchEnd !== prepared.defaultLunchEnd);
    if (lunchChanged && nextLunchStart && nextLunchEnd) {
      resultEmp = updateEmployeeLunchHours(resultEmp, nextLunchStart, nextLunchEnd, [1, 2, 3, 4]);
    }

    return resultEmp;
  });
}

/**
 * Remove um colaborador da equipe e limpa qualquer vínculo (folga igual, proibição paralela,
 * afinidade ou cobertura de folga em S1–S4) que apontava para ele.
 */
export function deleteMemberFromTeam(
  employees: Employee[],
  memberId: string
): { employees: Employee[]; deletedMember?: Employee } {
  const deletedMember = employees.find((e) => e.id === memberId);
  if (!deletedMember) {
    return { employees };
  }

  const remaining = employees
    .filter((e) => e.id !== memberId)
    .map((emp) => {
      const nextLinked = emp.linkedFolgaIds?.filter((id) => id !== memberId);
      const nextNoParallel = emp.noParallelFolgaIds?.filter((id) => id !== memberId);
      const nextAffinity = emp.affinityPartnerId === memberId ? undefined : emp.affinityPartnerId;

      const cleanedSchedule = { ...emp.schedule };
      DAYS_OF_WEEK.forEach((d) => {
        const shift = cleanedSchedule[d.key];
        if (shift?.coverage?.coveredByEmployeeId === memberId) {
          cleanedSchedule[d.key] = { ...shift, coverage: undefined };
        }
      });

      let cleanedWeeks = emp.weeksSchedule;
      if (emp.weeksSchedule) {
        cleanedWeeks = {};
        for (let w = 1; w <= 4; w++) {
          const wSched = emp.weeksSchedule[w];
          if (!wSched) continue;
          const copyW = { ...wSched };
          DAYS_OF_WEEK.forEach((d) => {
            const s = copyW[d.key];
            if (s?.coverage?.coveredByEmployeeId === memberId) {
              copyW[d.key] = { ...s, coverage: undefined };
            }
          });
          cleanedWeeks[w] = copyW;
        }
      }

      return {
        ...emp,
        affinityPartnerId: nextAffinity,
        linkedFolgaIds: nextLinked && nextLinked.length > 0 ? nextLinked : undefined,
        noParallelFolgaIds:
          nextNoParallel && nextNoParallel.length > 0 ? nextNoParallel : undefined,
        schedule: cleanedWeeks?.[1] || cleanedSchedule,
        weeksSchedule: cleanedWeeks,
      };
    });

  return { employees: remaining, deletedMember };
}

/**
 * Constrói um resumo estruturado e um snapshot da escala atual para o Chat com IA.
 */
export function buildScheduleAiContextSummary(params: {
  employees: Employee[];
  currentPhase: LegalPhase;
  monthlySummaryMap: Record<string, EmployeeMonthlySummary>;
  pontoMaisConfig: PontoMaisStandardConfig;
  pontoMaisWeeklyHours: number;
  pontoMaisSummaryMap: Record<string, EmployeePontoMaisSummary>;
  storeHours: StoreHoursMap;
  sectorMinimums: SectorMinimumsMap;
}): {
  contextSummary: string;
  scheduleSnapshot: Record<string, unknown>;
} {
  const {
    employees,
    currentPhase,
    monthlySummaryMap,
    pontoMaisConfig,
    pontoMaisWeeklyHours,
    pontoMaisSummaryMap,
    storeHours,
    sectorMinimums,
  } = params;

  const phaseCfg = LEGAL_PHASES[currentPhase];
  const prepared = employees.map(ensureEmployeeWeeksSchedule);
  const empMap = new Map(prepared.map((e) => [e.id, e]));

  const sameFolgaPairs = new Set<string>();
  const noParallelPairs = new Set<string>();
  const parallelConflicts: string[] = [];

  for (const emp of prepared) {
    (emp.linkedFolgaIds || []).forEach((pid) => {
      const p = empMap.get(pid);
      if (!p) return;
      const key = emp.id < p.id ? `${emp.shortName} ↔ ${p.shortName}` : `${p.shortName} ↔ ${emp.shortName}`;
      sameFolgaPairs.add(key);
    });
    (emp.noParallelFolgaIds || []).forEach((pid) => {
      const p = empMap.get(pid);
      if (!p) return;
      const key = emp.id < p.id ? `${emp.shortName} ⊘ ${p.shortName}` : `${p.shortName} ⊘ ${emp.shortName}`;
      noParallelPairs.add(key);
    });
  }

  const monToSat: DayOfWeek[] = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'];
  const recordedConflictKeys = new Set<string>();
  for (let w = 1; w <= 4; w++) {
    for (const d of monToSat) {
      for (const emp of prepared) {
        const shift = emp.weeksSchedule?.[w]?.[d] || emp.schedule?.[d];
        if (!shift || shift.type === 'TRABALHO') continue;
        const conflicts = checkParallelFolgaConflict(prepared, emp.id, w, d);
        for (const c of conflicts) {
          const idPair = emp.id < c.id ? `${emp.id}-${c.id}` : `${c.id}-${emp.id}`;
          const cKey = `S${w}-${d}-${idPair}`;
          if (!recordedConflictKeys.has(cKey)) {
            recordedConflictKeys.add(cKey);
            parallelConflicts.push(`S${w} ${d}: ${emp.shortName} e ${c.shortName} estão de folga juntos`);
          }
        }
      }
    }
  }

  const uncoveredAlerts: Array<{
    week: number;
    day: string;
    sectorTitle: string;
    storeName: string;
    message: string;
  }> = [];

  for (let w = 1; w <= 4; w++) {
    const weekTeam = prepared.map((e) => ({
      ...e,
      schedule: e.weeksSchedule?.[w] || e.schedule,
    }));
    const cov = calculateWeeklyCoverageSummary(weekTeam, sectorMinimums);
    DAYS_OF_WEEK.forEach((dInfo) => {
      if (dInfo.key === 'DOM') return;
      cov.byDay[dInfo.key].forEach((res) => {
        if (res.isUncovered) {
          uncoveredAlerts.push({
            week: w,
            day: dInfo.shortLabel,
            sectorTitle: res.sector.title,
            storeName: res.sector.storeName,
            message: res.message,
          });
        }
      });
    });
  }

  const operationalAlerts = checkMonthlyTeamOperationalAndAffinities(prepared, storeHours).map(
    (a) => a.message
  );

  const l1 = storeHours.LOJA_1 || DEFAULT_STORE_HOURS.LOJA_1;
  const l2 = storeHours.LOJA_2 || DEFAULT_STORE_HOURS.LOJA_2;

  const employeeRows = prepared.map((emp) => {
    const mSum = monthlySummaryMap[emp.id];
    const pmSum = pontoMaisSummaryMap[emp.id];
    return {
      id: emp.id,
      name: emp.name,
      shortName: emp.shortName,
      department: emp.department,
      defaultStore: emp.defaultStore,
      defaultChairId: emp.defaultChairId,
      contractType: emp.contractType,
      monthlyHours: mSum?.totalMonthlyHours ?? 0,
      monthlyTargetHours: mSum?.monthlyTargetHours ?? phaseCfg.maxWeeklyHours * 4,
      monthlyBalanceHours: mSum?.monthlyBalanceHours ?? 0,
      status: mSum?.status ?? 'CONFORME',
      weeklyHours: mSum?.weeklyHours ?? [0, 0, 0, 0],
      linkedFolgaNames: (emp.linkedFolgaIds || []).map((id) => empMap.get(id)?.shortName || id),
      noParallelFolgaNames: (emp.noParallelFolgaIds || []).map(
        (id) => empMap.get(id)?.shortName || id
      ),
      pontoMaisNetBancoMonth: pmSum?.netBancoHoursMonth ?? 0,
    };
  });

  const contextLines: string[] = [
    `Fase Legal: ${phaseCfg.name} (Teto: ${phaseCfg.maxWeeklyHours}h/sem | ${phaseCfg.maxWeeklyHours * 4}h/mês)`,
    `Horário Loja 1 (Matriz 546): Seg-Sex ${l1.weekdayOpen}-${l1.weekdayClose}, Sáb ${l1.saturdayOpen}-${l1.saturdayClose}`,
    `Horário Loja 2 (Filial 777): Seg-Sex ${l2.weekdayOpen}-${l2.weekdayClose}, Sáb ${l2.saturdayOpen}-${l2.saturdayClose}`,
    `PontoMais (Base Formal): ${formatHoursDecimal(pontoMaisWeeklyHours)}/sem (${pontoMaisConfig.label})`,
    `Vínculos Folga Igual (${sameFolgaPairs.size}): ${Array.from(sameFolgaPairs).join('; ') || 'nenhum'}`,
    `Proibições de Folga Paralela (${noParallelPairs.size}): ${Array.from(noParallelPairs).join('; ') || 'nenhum'}`,
    `Conflitos de Folga Paralela (${parallelConflicts.length}): ${parallelConflicts.join('; ') || 'nenhum'}`,
    `Alertas de Cobertura de Setores (${uncoveredAlerts.length}): ${
      uncoveredAlerts
        .slice(0, 10)
        .map((a) => `S${a.week} ${a.day} ${a.sectorTitle} (${a.message})`)
        .join(' | ') || '100% coberto'
    }`,
    'Colaboradores (Saldo Mês S1-S4):',
    ...employeeRows.map(
      (e) =>
        `- ${e.shortName} (${e.defaultChairId}, ${e.defaultStore}, ${e.department}, ${e.contractType}): ${formatHoursDecimal(
          e.monthlyHours
        )}/${formatHoursDecimal(e.monthlyTargetHours)} (saldo ${e.monthlyBalanceHours >= 0 ? '+' : ''}${formatHoursDecimal(
          e.monthlyBalanceHours
        )}, status ${e.status})`
    ),
  ];

  return {
    contextSummary: contextLines.join('\n'),
    scheduleSnapshot: {
      phase: currentPhase,
      phaseBadge: phaseCfg.badge,
      maxWeeklyHours: phaseCfg.maxWeeklyHours,
      monthlyTargetHours: phaseCfg.maxWeeklyHours * 4,
      pontoMaisWeeklyHours,
      pontoMaisLabel: pontoMaisConfig.label,
      employees: employeeRows,
      uncoveredAlerts,
      parallelConflicts,
      sameFolgaLinks: Array.from(sameFolgaPairs),
      noParallelLinks: Array.from(noParallelPairs),
      operationalAlerts,
    },
  };
}
