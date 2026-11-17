import {
  DayOfWeek,
  DayShift,
  DepartmentId,
  Employee,
  SectorMinimumsMap,
  StoreHoursMap,
  StoreId,
} from '../types/schedule';
import {
  calculateDailyHours,
  DAYS_OF_WEEK,
  DEFAULT_STORE_HOURS,
  ensureEmployeeWeeksSchedule,
} from './compliance';
import {
  calculateWeeklyCoverageSummary,
  DEFAULT_SECTOR_MINIMUMS,
  SECTOR_DEFINITIONS,
  SectorDefinition,
  SectorDailyCoverageResult,
} from './coverage';

/**
 * Segunda-feira âncora da Semana 1 (S1) do ciclo mensal ativo:
 * 2026-11-02 (Seg) .. 2026-11-08 (Dom) = S1
 * 2026-11-09 (Seg) .. 2026-11-15 (Dom) = S2 (Sábado 14/11/2026 = HOJE)
 * 2026-11-16 (Seg) .. 2026-11-22 (Dom) = S3
 * 2026-11-23 (Seg) .. 2026-11-29 (Dom) = S4
 * Ciclo de 4 semanas repete continuamente nas datas futuras e anteriores.
 */
export const CYCLE_ANCHOR_MONDAY_ISO = '2026-11-02';

export const PT_MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
] as const;

export const PT_MONTH_SHORT = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
] as const;

export const CALENDAR_WEEKDAY_HEADERS_SUN_FIRST: Array<{
  dayKey: DayOfWeek;
  short: string;
  label: string;
  isWeekend: boolean;
}> = [
  { dayKey: 'DOM', short: 'Dom', label: 'Domingo', isWeekend: true },
  { dayKey: 'SEG', short: 'Seg', label: 'Segunda-feira', isWeekend: false },
  { dayKey: 'TER', short: 'Ter', label: 'Terça-feira', isWeekend: false },
  { dayKey: 'QUA', short: 'Qua', label: 'Quarta-feira', isWeekend: false },
  { dayKey: 'QUI', short: 'Qui', label: 'Quinta-feira', isWeekend: false },
  { dayKey: 'SEX', short: 'Sex', label: 'Sexta-feira', isWeekend: false },
  { dayKey: 'SAB', short: 'Sáb', label: 'Sábado', isWeekend: true },
];

const JS_DAY_TO_KEY: DayOfWeek[] = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'];

export function parseDateIsoLocal(dateIso: string): Date {
  const [y, m, d] = dateIso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0, 0);
}

export function formatDateIsoLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getDefaultTodayIso(): string {
  return formatDateIsoLocal(new Date());
}

export function addDaysIso(dateIso: string, deltaDays: number): string {
  const d = parseDateIsoLocal(dateIso);
  d.setDate(d.getDate() + deltaDays);
  return formatDateIsoLocal(d);
}

export function addMonthsToYearMonth(
  year: number,
  month0: number,
  deltaMonths: number
): { year: number; month0: number } {
  const d = new Date(year, month0 + deltaMonths, 1, 12, 0, 0, 0);
  return { year: d.getFullYear(), month0: d.getMonth() };
}

export function getDayOfWeekForDateIso(dateIso: string): DayOfWeek {
  const d = parseDateIsoLocal(dateIso);
  return JS_DAY_TO_KEY[d.getDay()];
}

export function getFullDateLabelPt(dateIso: string): {
  weekdayFull: string;
  weekdayShort: string;
  dayNumber: number;
  monthName: string;
  monthShort: string;
  year: number;
  brShort: string; // DD/MM/YYYY
  fullTitle: string; // ex: Sábado, 14 de Novembro de 2026
} {
  const d = parseDateIsoLocal(dateIso);
  const key = JS_DAY_TO_KEY[d.getDay()];
  const dayMeta = DAYS_OF_WEEK.find((item) => item.key === key) || DAYS_OF_WEEK[0];
  const dayNumber = d.getDate();
  const month0 = d.getMonth();
  const year = d.getFullYear();
  const monthName = PT_MONTH_NAMES[month0];
  const monthShort = PT_MONTH_SHORT[month0];
  const dd = String(dayNumber).padStart(2, '0');
  const mm = String(month0 + 1).padStart(2, '0');

  return {
    weekdayFull: dayMeta.label,
    weekdayShort: dayMeta.shortLabel,
    dayNumber,
    monthName,
    monthShort,
    year,
    brShort: `${dd}/${mm}/${year}`,
    fullTitle: `${dayMeta.label}, ${dd} de ${monthName} de ${year}`,
  };
}

/**
 * Calcula o número da semana do ciclo (1 a 4 -> S1..S4) para qualquer data real do calendário.
 */
export function getCycleWeekForDate(dateIso: string): 1 | 2 | 3 | 4 {
  const anchor = parseDateIsoLocal(CYCLE_ANCHOR_MONDAY_ISO);
  const target = parseDateIsoLocal(dateIso);
  const diffDays = Math.round((target.getTime() - anchor.getTime()) / (1000 * 60 * 60 * 24));
  const weekOffset = Math.floor(diffDays / 7);
  const mod = ((weekOffset % 4) + 4) % 4;
  return (mod + 1) as 1 | 2 | 3 | 4;
}

export function getWeekDatesAround(dateIso: string): Array<{
  dateIso: string;
  dayKey: DayOfWeek;
  weekdayShort: string;
  dayNumber: number;
  monthShort: string;
  cycleWeek: 1 | 2 | 3 | 4;
}> {
  const d = parseDateIsoLocal(dateIso);
  // Semana Seg..Dom ao redor da data atual para espelhar a grade da empresa
  const jsDay = d.getDay();
  const mondayDelta = jsDay === 0 ? -6 : 1 - jsDay;
  const monday = new Date(d);
  monday.setDate(d.getDate() + mondayDelta);

  const items: Array<{
    dateIso: string;
    dayKey: DayOfWeek;
    weekdayShort: string;
    dayNumber: number;
    monthShort: string;
    cycleWeek: 1 | 2 | 3 | 4;
  }> = [];

  for (let i = 0; i < 7; i++) {
    const cur = new Date(monday);
    cur.setDate(monday.getDate() + i);
    const iso = formatDateIsoLocal(cur);
    const meta = getFullDateLabelPt(iso);
    items.push({
      dateIso: iso,
      dayKey: getDayOfWeekForDateIso(iso),
      weekdayShort: meta.weekdayShort,
      dayNumber: meta.dayNumber,
      monthShort: meta.monthShort,
      cycleWeek: getCycleWeekForDate(iso),
    });
  }

  return items;
}

export function getEmployeeShiftForDate(
  emp: Employee,
  dateIso: string
): {
  cycleWeek: 1 | 2 | 3 | 4;
  dayKey: DayOfWeek;
  shift: DayShift;
  dailyHours: number;
  effectiveChairId: string;
  isWork: boolean;
  isFolga5x2: boolean;
  isDsr: boolean;
  isLicenca: boolean;
} {
  const prepared = ensureEmployeeWeeksSchedule(emp);
  const cycleWeek = getCycleWeekForDate(dateIso);
  const dayKey = getDayOfWeekForDateIso(dateIso);
  const weekSched = prepared.weeksSchedule?.[cycleWeek] || prepared.schedule;
  const shift = weekSched[dayKey] || { type: dayKey === 'DOM' ? 'FOLGA_DSR' : 'TRABALHO' };

  const isWork = shift.type === 'TRABALHO';
  const isFolga5x2 = shift.type === 'FOLGA_5X2';
  const isDsr = shift.type === 'FOLGA_DSR';
  const isLicenca = shift.type === 'LICENCA';

  return {
    cycleWeek,
    dayKey,
    shift,
    dailyHours: isWork ? calculateDailyHours(shift) : 0,
    effectiveChairId: shift.chairId || prepared.defaultChairId,
    isWork,
    isFolga5x2,
    isDsr,
    isLicenca,
  };
}

/**
 * Indica se esta data específica faz parte de um fim de semana prolongado (Sáb folga + Dom DSR + Seg folga).
 */
export function isProlongedWeekendPartOnDate(emp: Employee, dateIso: string): boolean {
  const dayKey = getDayOfWeekForDateIso(dateIso);
  if (dayKey !== 'SAB' && dayKey !== 'DOM' && dayKey !== 'SEG') return false;

  const saturdayIso =
    dayKey === 'SAB'
      ? dateIso
      : dayKey === 'DOM'
      ? addDaysIso(dateIso, -1)
      : addDaysIso(dateIso, -2);
  const sundayIso = addDaysIso(saturdayIso, 1);
  const mondayIso = addDaysIso(saturdayIso, 2);

  const satShift = getEmployeeShiftForDate(emp, saturdayIso);
  const sunShift = getEmployeeShiftForDate(emp, sundayIso);
  const monShift = getEmployeeShiftForDate(emp, mondayIso);

  return !satShift.isWork && !satShift.isLicenca && !sunShift.isWork && !sunShift.isLicenca && !monShift.isWork && !monShift.isLicenca;
}

export interface FloorPlanPersonStatus {
  employee: Employee;
  effectiveChairId: string;
  shift: DayShift;
  dailyHours: number;
  isWork: boolean;
  isFolga5x2: boolean;
  isDsr: boolean;
  isLicenca: boolean;
  isProlongedWeekendPart: boolean;
  isSubstituteHere?: boolean;
}

export interface FloorPlanRoomSnapshot {
  sector: SectorDefinition;
  storeId: StoreId;
  departmentId: DepartmentId;
  coverage?: SectorDailyCoverageResult;
  occupants: FloorPlanPersonStatus[];
  workingCount: number;
  folgaCount: number;
  dsrCount: number;
  licencaCount: number;
  minRequired: number;
  isUncovered: boolean;
}

export interface RealDayFloorPlanSnapshot {
  dateIso: string;
  dateMeta: ReturnType<typeof getFullDateLabelPt>;
  cycleWeek: 1 | 2 | 3 | 4;
  dayKey: DayOfWeek;
  roomsByStore: Record<StoreId, FloorPlanRoomSnapshot[]>;
  allPeopleStatuses: FloorPlanPersonStatus[];
  totals: {
    working: number;
    folga5x2: number;
    dsr: number;
    licenca: number;
    uncoveredSectors: number;
  };
}

export function buildRealDayFloorPlanSnapshot(
  employees: Employee[],
  dateIso: string,
  storeHours: StoreHoursMap = DEFAULT_STORE_HOURS,
  sectorMinimums: SectorMinimumsMap = DEFAULT_SECTOR_MINIMUMS
): RealDayFloorPlanSnapshot {
  const prepared = employees.map(ensureEmployeeWeeksSchedule);
  const cycleWeek = getCycleWeekForDate(dateIso);
  const dayKey = getDayOfWeekForDateIso(dateIso);
  const dateMeta = getFullDateLabelPt(dateIso);

  // Calcula cobertura para a semana do ciclo em questão
  const weekEmployees: Employee[] = prepared.map((e) => ({
    ...e,
    schedule: e.weeksSchedule?.[cycleWeek] || e.schedule,
  }));
  const weekCov = calculateWeeklyCoverageSummary(weekEmployees, sectorMinimums);
  const dayCovList = weekCov.byDay[dayKey] || [];

  const allPeopleStatuses: FloorPlanPersonStatus[] = prepared
    .filter((e) => !e.isCirculating)
    .map((emp) => {
      const info = getEmployeeShiftForDate(emp, dateIso);
      const isProlonged = isProlongedWeekendPartOnDate(emp, dateIso);
      return {
        employee: emp,
        effectiveChairId: info.effectiveChairId,
        shift: info.shift,
        dailyHours: info.dailyHours,
        isWork: info.isWork,
        isFolga5x2: info.isFolga5x2,
        isDsr: info.isDsr,
        isLicenca: info.isLicenca,
        isProlongedWeekendPart: isProlonged,
      };
    });

  const buildRoom = (sector: SectorDefinition): FloorPlanRoomSnapshot => {
    const covResult = dayCovList.find((r) => r.sector.id === sector.id);
    // Pessoas cujo turno efetivo (ou posto padrão) está neste setor
    const directOccupants = allPeopleStatuses.filter((p) => {
      if (sector.chairIds.includes(p.effectiveChairId)) return true;
      if (
        p.employee.defaultStore === sector.storeId &&
        p.employee.department === sector.departmentId &&
        !SECTOR_DEFINITIONS.some(
          (other) => other.id !== sector.id && other.chairIds.includes(p.effectiveChairId)
        )
      ) {
        return true;
      }
      return false;
    });

    const workingCount = directOccupants.filter((p) => p.isWork).length;
    const folgaCount = directOccupants.filter((p) => p.isFolga5x2).length;
    const dsrCount = directOccupants.filter((p) => p.isDsr).length;
    const licencaCount = directOccupants.filter((p) => p.isLicenca).length;

    const minCfg = sectorMinimums[sector.id] || DEFAULT_SECTOR_MINIMUMS[sector.id];
    const minRequired =
      dayKey === 'DOM'
        ? 0
        : dayKey === 'SAB'
        ? minCfg?.saturday ?? sector.minRequiredSaturday
        : minCfg?.weekday ?? sector.minRequiredWeekday;

    return {
      sector,
      storeId: sector.storeId,
      departmentId: sector.departmentId,
      coverage: covResult,
      occupants: directOccupants,
      workingCount,
      folgaCount,
      dsrCount,
      licencaCount,
      minRequired,
      isUncovered: Boolean(dayKey !== 'DOM' && covResult?.isUncovered),
    };
  };

  const roomsL1 = SECTOR_DEFINITIONS.filter((s) => s.storeId === 'LOJA_1').map(buildRoom);
  const roomsL2 = SECTOR_DEFINITIONS.filter((s) => s.storeId === 'LOJA_2').map(buildRoom);

  const totals = {
    working: allPeopleStatuses.filter((p) => p.isWork).length,
    folga5x2: allPeopleStatuses.filter((p) => p.isFolga5x2).length,
    dsr: allPeopleStatuses.filter((p) => p.isDsr).length,
    licenca: allPeopleStatuses.filter((p) => p.isLicenca).length,
    uncoveredSectors: [...roomsL1, ...roomsL2].filter((r) => r.isUncovered).length,
  };

  void storeHours;

  return {
    dateIso,
    dateMeta,
    cycleWeek,
    dayKey,
    roomsByStore: {
      LOJA_1: roomsL1,
      LOJA_2: roomsL2,
    },
    allPeopleStatuses,
    totals,
  };
}

export interface RealCalendarDayCell {
  dateIso: string;
  dayNumber: number;
  inCurrentMonth: boolean;
  dayKey: DayOfWeek;
  cycleWeek: 1 | 2 | 3 | 4;
  isWeekend: boolean;
  workingCount: number;
  folgaCount: number;
  dsrCount: number;
  licencaCount: number;
  folgaNames: string[];
  workingNames: string[];
  prolongedFolgaNames: string[];
  uncoveredSectorsCount: number;
  focusEmployee?: FloorPlanPersonStatus;
}

export interface RealMonthProjection {
  year: number;
  month0: number;
  monthName: string;
  monthShort: string;
  cells: RealCalendarDayCell[];
  summary: {
    workDaysCount: number;
    folga5x2DaysCount: number;
    dsrDaysCount: number;
    prolongedWeekendsStarts: number;
    uncoveredDaysCount: number;
    totalFocusHours: number;
  };
}

/**
 * Constrói a matriz real de um mês do calendário (42 células / 6 semanas, começando no Domingo),
 * projetando escalas S1–S4, folgas, DSR, cobertura e opcionalmente um colaborador em foco.
 */
export function buildRealMonthProjection(
  employees: Employee[],
  year: number,
  month0: number,
  storeHours: StoreHoursMap = DEFAULT_STORE_HOURS,
  sectorMinimums: SectorMinimumsMap = DEFAULT_SECTOR_MINIMUMS,
  focusEmployeeId: string = 'ALL',
  departmentFilter: DepartmentId | 'ALL' = 'ALL',
  storeFilter: StoreId | 'ALL' = 'ALL'
): RealMonthProjection {
  const preparedAll = employees.map(ensureEmployeeWeeksSchedule);
  const filteredPeople = preparedAll.filter((e) => {
    if (e.isCirculating) return false;
    if (storeFilter !== 'ALL' && e.defaultStore !== storeFilter) return false;
    if (departmentFilter !== 'ALL' && e.department !== departmentFilter) return false;
    return true;
  });

  const focusEmp =
    focusEmployeeId !== 'ALL'
      ? preparedAll.find((e) => e.id === focusEmployeeId)
      : undefined;

  const firstDayOfMonth = new Date(year, month0, 1, 12, 0, 0, 0);
  const startOffset = firstDayOfMonth.getDay(); // 0 = Dom
  const gridStart = new Date(firstDayOfMonth);
  gridStart.setDate(1 - startOffset);

  // Cache coverage by (cycleWeek, dayKey) so 42 days only runs calculateWeeklyCoverageSummary 4 times!
  const covCache = new Map<number, ReturnType<typeof calculateWeeklyCoverageSummary>>();
  for (const w of [1, 2, 3, 4] as const) {
    const wEmps = preparedAll.map((e) => ({
      ...e,
      schedule: e.weeksSchedule?.[w] || e.schedule,
    }));
    covCache.set(w, calculateWeeklyCoverageSummary(wEmps, sectorMinimums));
  }

  const cells: RealCalendarDayCell[] = [];
  let workDaysCount = 0;
  let folga5x2DaysCount = 0;
  let dsrDaysCount = 0;
  let prolongedWeekendsStarts = 0;
  let uncoveredDaysCount = 0;
  let totalFocusHours = 0;

  void storeHours;

  for (let i = 0; i < 42; i++) {
    const cur = new Date(gridStart);
    cur.setDate(gridStart.getDate() + i);
    const dateIso = formatDateIsoLocal(cur);
    const inCurrentMonth = cur.getMonth() === month0 && cur.getFullYear() === year;
    const dayKey = getDayOfWeekForDateIso(dateIso);
    const cycleWeek = getCycleWeekForDate(dateIso);

    const covWeek = covCache.get(cycleWeek)!;
    const dayCovList = covWeek.byDay[dayKey] || [];
    const relevantCov = dayCovList.filter((r) => {
      if (storeFilter !== 'ALL' && r.sector.storeId !== storeFilter) return false;
      if (departmentFilter !== 'ALL' && r.sector.departmentId !== departmentFilter) return false;
      return true;
    });
    const uncoveredSectorsCount =
      dayKey === 'DOM' ? 0 : relevantCov.filter((r) => r.isUncovered).length;

    const statuses = filteredPeople.map((emp) => {
      const info = getEmployeeShiftForDate(emp, dateIso);
      const prolonged = isProlongedWeekendPartOnDate(emp, dateIso);
      return {
        emp,
        info,
        prolonged,
      };
    });

    const workingNames = statuses.filter((s) => s.info.isWork).map((s) => s.emp.shortName);
    const folgaNames = statuses.filter((s) => s.info.isFolga5x2).map((s) => s.emp.shortName);
    const prolongedFolgaNames = statuses
      .filter((s) => s.info.isFolga5x2 && s.prolonged)
      .map((s) => s.emp.shortName);
    const dsrCount = statuses.filter((s) => s.info.isDsr).length;
    const licencaCount = statuses.filter((s) => s.info.isLicenca).length;

    let focusStatus: FloorPlanPersonStatus | undefined;
    if (focusEmp) {
      const fInfo = getEmployeeShiftForDate(focusEmp, dateIso);
      const fProlonged = isProlongedWeekendPartOnDate(focusEmp, dateIso);
      focusStatus = {
        employee: focusEmp,
        effectiveChairId: fInfo.effectiveChairId,
        shift: fInfo.shift,
        dailyHours: fInfo.dailyHours,
        isWork: fInfo.isWork,
        isFolga5x2: fInfo.isFolga5x2,
        isDsr: fInfo.isDsr,
        isLicenca: fInfo.isLicenca,
        isProlongedWeekendPart: fProlonged,
      };

      if (inCurrentMonth) {
        if (fInfo.isWork) {
          workDaysCount++;
          totalFocusHours += fInfo.dailyHours;
        } else if (fInfo.isFolga5x2) {
          folga5x2DaysCount++;
        } else if (fInfo.isDsr) {
          dsrDaysCount++;
        }
        if (dayKey === 'SAB' && fProlonged) {
          prolongedWeekendsStarts++;
        }
      }
    } else if (inCurrentMonth) {
      if (workingNames.length > 0) workDaysCount++;
      if (folgaNames.length > 0) folga5x2DaysCount++;
      if (dsrCount > 0 && workingNames.length === 0) dsrDaysCount++;
      if (uncoveredSectorsCount > 0) uncoveredDaysCount++;
      if (dayKey === 'SAB') {
        prolongedWeekendsStarts += statuses.filter((s) => s.prolonged).length;
      }
    }

    cells.push({
      dateIso,
      dayNumber: cur.getDate(),
      inCurrentMonth,
      dayKey,
      cycleWeek,
      isWeekend: dayKey === 'SAB' || dayKey === 'DOM',
      workingCount: workingNames.length,
      folgaCount: folgaNames.length,
      dsrCount,
      licencaCount,
      folgaNames,
      workingNames,
      prolongedFolgaNames,
      uncoveredSectorsCount,
      focusEmployee: focusStatus,
    });
  }

  return {
    year,
    month0,
    monthName: PT_MONTH_NAMES[month0],
    monthShort: PT_MONTH_SHORT[month0],
    cells,
    summary: {
      workDaysCount,
      folga5x2DaysCount,
      dsrDaysCount,
      prolongedWeekendsStarts,
      uncoveredDaysCount,
      totalFocusHours: Math.round(totalFocusHours * 100) / 100,
    },
  };
}
