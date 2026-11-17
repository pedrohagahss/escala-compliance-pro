export type LegalPhase = 'FASE_1' | 'FASE_2' | 'ATUAL';

export interface LegalPhaseConfig {
  id: LegalPhase;
  name: string;
  shortName: string;
  badge: string;
  maxWeeklyHours: number;
  maxDailyHours: number; // 8.0h regular
  maxOvertimeDailyHours: number; // até 2h extras = 10h máx CLT Art. 59
  minWeeklyRestDays: number;
  divisor: number; // 210 in Fase 1, 200 in Fase 2, 220 in Atual
  description: string;
  legalBasis: string;
}

export type DayOfWeek = 'SEG' | 'TER' | 'QUA' | 'QUI' | 'SEX' | 'SAB' | 'DOM';

export type ShiftType = 'TRABALHO' | 'FOLGA' | 'FOLGA_DSR' | 'FOLGA_5X2' | 'LICENCA';

export type StoreId = 'LOJA_1' | 'LOJA_2';

export type DepartmentId =
  | 'SDR'
  | 'VENDAS'
  | 'PREPARACAO'
  | 'DOCUMENTACAO'
  | 'FINANCEIRO'
  | 'SUCESSO_CLIENTE'
  | 'MARKETING'
  | 'GESTAO';

export interface ChairDefinition {
  id: string;
  code: string;
  name: string;
  store: StoreId;
  department: DepartmentId;
  description: string;
  isExternalOrRotating?: boolean;
}

export type ContractType =
  | 'CLT_ATIVO'
  | 'CLT_TEMPORARIO'
  | 'ESTAGIARIO'
  | 'LICENCA_MATERNIDADE'
  | 'LIDERANCA';

export interface ShiftCoverage {
  coveredByEmployeeId: string; // ex: 'emp-edvania', 'emp-lorena', 'emp-pedro'
  coveredByName: string;       // ex: 'Edvania Maria'
  coveredByRole: string;       // ex: 'Supervisora Comercial'
  notes?: string;
}

export interface DayShift {
  day: DayOfWeek;
  type: ShiftType;
  chairId: string;
  startTime?: string;   // ex: "08:00"
  lunchStart?: string;  // ex: "11:30" ou "12:00"
  lunchEnd?: string;    // ex: "13:00" ou "13:30"
  endTime?: string;     // ex: "17:30" ou "13:00"
  customHours?: number;
  label?: string;
  coverage?: ShiftCoverage; // Colaborador designado para cobrir esta cadeira quando em folga
}

export interface Employee {
  id: string;
  name: string;
  shortName: string;
  role: string;
  contractType: ContractType;
  department: DepartmentId;
  defaultStore: StoreId;
  defaultChairId: string;
  badgeColor: string;
  defaultLunchStart?: string;
  defaultLunchEnd?: string;
  rulesAndRestrictions: string;
  affinityPartnerId?: string; // ex: João Alexandre + Winona, Andria + João Pedro
  linkedFolgaIds?: string[]; // Colaboradores vinculados para compartilhar os mesmos dias de folga (S1–S4)
  noParallelFolgaIds?: string[]; // Colaboradores proibidos de folgar no mesmo dia em paralelo (Seg–Sáb, S1–S4)
  isCirculating?: boolean; // Liderança sem horário rígido
  notes?: string;
  // Escala da semana ativa
  schedule: Record<DayOfWeek, DayShift>;
  // Escalas multi-semanais (Ciclo de 4 semanas / Mês)
  weeksSchedule?: Record<number, Record<DayOfWeek, DayShift>>; // semana 1 a 4
  saturdayOffWeek?: number; // 1, 2, 3 ou 4 (qual sábado do mês o colaborador folga)
}

export interface ComplianceViolation {
  code:
    | 'MAX_HOURS_EXCEEDED'
    | 'INSUFFICIENT_REST_DAYS'
    | 'INTERJORNADA_VIOLATION'
    | 'INTERNA_MATHEUS_LIMIT'
    | 'INTERNA_MATHEUS_MORNING'
    | 'CRITICAL_DAY_ABSENCE'
    | 'AFFINITY_MISMATCH'
    | 'PARALLEL_FOLGA_CONFLICT'
    | 'DAILY_OVERTIME_LIMIT';
  severity: 'ERROR' | 'WARNING' | 'INFO';
  category: 'LEGAL' | 'OPERATIONAL' | 'AFFINITY';
  message: string;
  details?: string;
  daysInvolved?: DayOfWeek[];
}

export interface EmployeeComplianceResult {
  employeeId: string;
  totalWeeklyHours: number;
  regularHours: number; // até 40h ou 42h
  overtimeHours: number; // excedente legal de hora extra (+50% ou banco de horas)
  dailyOvertimeTotal: number; // soma de horas diárias além de 8h
  workDaysCount: number;
  restDaysCount: number;
  isCompliant: boolean;
  hasOvertime: boolean;
  status: 'CONFORME' | 'HORAS_EXTRAS' | 'ALERTA' | 'VIOLACAO';
  violations: ComplianceViolation[];
  balanceHours: number; // vs teto legal
}

export interface EmployeeMonthlySummary {
  employeeId: string;
  weeklyHours: number[]; // [sem1, sem2, sem3, sem4]
  weeklyTargetHours: number; // meta semanal (ex: 42h Fase 1, 40h Fase 2, 24h Estágio)
  weeklyDeltas: number[]; // diferença de cada semana contra a meta semanal [s1-meta, s2-meta, s3-meta, s4-meta]
  accumulatedBalances: number[]; // saldo acumulado progressivo de semana para semana [s1, s1+s2, s1+s2+s3, s1+s2+s3+s4]
  offDaysByWeek: DayOfWeek[][]; // dias de folga específicos de cada semana (podem ser diferentes entre S1..S4)
  workDaysCountByWeek: number[]; // quantidade de dias trabalhados por semana
  complianceByWeek: EmployeeComplianceResult[]; // validação detalhada de cada uma das 4 semanas
  compensatedHours: number; // horas faltantes/excedentes compensadas entre semanas dentro do mês
  totalMonthlyHours: number;
  monthlyTargetHours: number; // meta do mês (ex: 168h na Fase 1, 160h na Fase 2)
  monthlyBalanceHours: number; // totalMonthlyHours - monthlyTargetHours
  averageWeeklyHours: number;
  totalOvertimeHours: number; // horas extras líquidas não compensadas no mês
  saturdaysWorkedCount: number;
  saturdayOffWeek: number;
  status: 'CONFORME' | 'HORAS_EXTRAS' | 'COMPENSANDO' | 'VIOLACAO';
}

export interface StoreOperatingHours {
  weekdayOpen: string;   // ex: '08:00'
  weekdayClose: string;  // ex: '17:30'
  saturdayOpen: string;  // ex: '08:00'
  saturdayClose: string; // ex: '13:00'
}

export type StoreHoursMap = Record<StoreId, StoreOperatingHours>;

export interface SectorMinimumConfig {
  weekday: number;
  saturday: number;
}

export type SectorMinimumsMap = Record<string, SectorMinimumConfig>;

export type PontoMaisPresetId = '42H_LUN1H_SEX' | '42H_8H24_DIA' | '40H_8H_DIA' | 'CUSTOM';

export interface PontoMaisDayRule {
  isWorkDay: boolean;
  startTime: string;
  lunchStart?: string;
  lunchEnd?: string;
  endTime: string;
}

export interface PontoMaisStandardConfig {
  presetId: PontoMaisPresetId;
  label: string;
  note?: string;
  days: Record<DayOfWeek, PontoMaisDayRule>;
  autoManageBancoDeHoras: boolean;
}

export interface PontoMaisDayDifference {
  day: DayOfWeek;
  pontoMaisHours: number;
  realHours: number;
  diffHours: number; // realHours - pontoMaisHours
  creditHours: number; // horas extras creditadas automaticamente no Banco de Horas
  debitHours: number;  // horas compensadas/folgas debitadas do Banco de Horas
}

export interface EmployeePontoMaisWeekResult {
  weekNumber: number;
  pontoMaisWeeklyHours: number;
  realWeeklyHours: number;
  weeklyNetBancoHours: number;
  weeklyCreditHours: number;
  weeklyDebitHours: number;
  accumulatedBancoHours: number;
  dayDifferences: Record<DayOfWeek, PontoMaisDayDifference>;
}

export interface EmployeePontoMaisSummary {
  employeeId: string;
  isEligibleForBanco: boolean;
  pontoMaisWeeklyHours: number;
  pontoMaisMonthlyHours: number;
  realMonthlyHours: number;
  netBancoHoursMonth: number;
  totalDailyCreditsMonth: number;
  totalDailyDebitsMonth: number;
  weeks: EmployeePontoMaisWeekResult[];
}

export interface Scenario {
  id: string;
  name: string;
  shortTag: string;
  description: string;
  phase: LegalPhase;
  employees: Employee[];
  storeHours?: StoreHoursMap;
  sectorMinimums?: SectorMinimumsMap;
  pontoMaisConfig?: PontoMaisStandardConfig;
  createdAt: string;
}

export interface StoreHourCoverage {
  hourStr: string;
  totalLoja1: number;
  totalLoja2: number;
  byDepartmentLoja1: Record<DepartmentId, number>;
  byDepartmentLoja2: Record<DepartmentId, number>;
  isOpeningWindow?: boolean; // 08:00
  isLunchWindow?: boolean;   // 11:30 - 14:30
  isClosingWindow?: boolean; // 17:30
}
