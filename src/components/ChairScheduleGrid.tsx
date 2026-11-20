import React, { useRef, useState } from 'react';
import {
  DayOfWeek,
  DayShift,
  DepartmentId,
  Employee,
  EmployeeMonthlySummary,
  EmployeePontoMaisSummary,
  LegalPhase,
  ShiftType,
  SectorMinimumConfig,
  SectorMinimumsMap,
  StoreHoursMap,
  StoreId,
  StoreOperatingHours,
} from '../types/schedule';
import { CHAIRS, DEPARTMENTS } from '../data/seuCarroData';
import {
  applyGroupBreakInterval,
  balanceAllWeeksToMonthlyTarget,
  balanceScheduleToTarget,
  buildDefaultWorkShiftForDay,
  calculateDailyHours,
  calculateInterjornadaRest,
  canReplaceRestDayWithWork,
  checkParallelFolgaConflict,
  countRestDaysInWeek,
  DAYS_OF_WEEK,
  DEFAULT_STORE_HOURS,
  ensureEmployeeWeeksSchedule,
  formatHoursDecimal,
  getGrossShiftMinutes,
  LEGAL_PHASES,
  parseTimeToMinutes,
  replaceEmployeeWeekSchedule,
  resolveLunchWindowForShift,
} from '../utils/compliance';
import {
  calculateWeeklyCoverageSummary,
  DEFAULT_SECTOR_MINIMUMS,
  SECTOR_DEFINITIONS,
} from '../utils/coverage';
import {
  filterSectionChairs,
  findChairOccupant,
  getVisibleDays,
} from '../utils/scheduleFilters';
import { buildSectionChairs } from '../utils/teamManagement';
import {
  AlertCircle,
  AlertTriangle,
  Ban,
  CalendarOff,
  Check,
  CheckCircle2,
  Clock,
  Edit2,
  GripVertical,
  Link2,
  Lock,
  MessageSquare,
  Printer,
  Scale,
  ShieldCheck,
  Sparkles,
  Store,
  Unlink,
  UserCheck,
  UserPlus,
  Utensils,
  X,
} from 'lucide-react';
import { CoverageAssignModal } from './CoverageAssignModal';
import { BalanceHoursModal } from './BalanceHoursModal';

type FolgaDragPayload =
  | { kind: 'NEW_FOLGA' }
  | {
      kind: 'MOVE_FOLGA';
      employeeId: string;
      sourceWeek: number;
      sourceDay: DayOfWeek;
    };

interface ChairScheduleGridProps {
  employees: Employee[];
  currentPhase: LegalPhase;
  selectedWeekFilter: 'ALL' | number;
  onSelectWeekFilter?: (w: 'ALL' | number) => void;
  selectedStore: 'ALL' | StoreId;
  onSelectStore?: (store: 'ALL' | StoreId) => void;
  selectedDept: 'ALL' | DepartmentId;
  onSelectDept?: (dept: 'ALL' | DepartmentId) => void;
  selectedEmployeeFilter: 'ALL' | string;
  onSelectEmployeeFilter?: (empId: 'ALL' | string) => void;
  employeeOptions: { id: string; label: string }[];
  selectedDayFilter: 'ALL' | DayOfWeek;
  onSelectDayFilter?: (day: 'ALL' | DayOfWeek) => void;
  searchQuery: string;
  onClearFilters?: () => void;
  monthlySummaryMap: Record<string, EmployeeMonthlySummary>;
  pontoMaisSummaryMap: Record<string, EmployeePontoMaisSummary>;
  storeHours: StoreHoursMap;
  sectorMinimums: SectorMinimumsMap;
  onUpdateShift: (
    employeeId: string,
    day: DayOfWeek,
    newShift: Partial<DayShift>,
    weekNumber: number | number[]
  ) => void;
  onBatchUpdateEmployees?: (
    updatedEmployees: Employee[],
    scope?: 'SINGLE_WEEK' | 'SELECTED_WEEKS' | 'ALL_WEEKS',
    targetWeeks?: number[]
  ) => void;
  onMoveOrApplyFolga: (
    employeeId: string,
    targetWeek: number,
    targetDay: DayOfWeek,
    sourceDay?: DayOfWeek,
    sourceWeek?: number
  ) => void;
  onUpdateEmployeeLunch: (
    employeeId: string,
    lunchStart: string,
    lunchEnd: string,
    targetWeeks: number[]
  ) => void;
  onUpdateStoreHours: (
    storeId: StoreId,
    hours: StoreOperatingHours,
    applyToTeam: boolean
  ) => void;
  onUpdateSectorMinimum: (
    sectorId: string,
    config: SectorMinimumConfig,
    sectorTitle?: string
  ) => void;
  onLinkFolgaPartner?: (
    sourceId: string,
    partnerId: string,
    followPartnerFolgas: boolean
  ) => void;
  onUnlinkFolgaPartner?: (employeeId: string) => void;
  onLinkNoParallelFolga?: (
    sourceId: string,
    partnerId: string,
    resolveConflicts: boolean
  ) => void;
  onUnlinkNoParallelFolga?: (employeeId: string, partnerId?: string) => void;
  onOpenAddMember?: () => void;
  onOpenEditMember?: (employee: Employee) => void;
  onOpenAiChat?: () => void;
  onPrintSector?: (storeId: StoreId | 'ALL', sectorKey: string, folgasOnly?: boolean) => void;
  onNotify?: (msg: string) => void;
}

export const ChairScheduleGrid: React.FC<ChairScheduleGridProps> = ({
  employees,
  currentPhase,
  selectedWeekFilter,
  onSelectWeekFilter,
  selectedStore,
  onSelectStore,
  selectedDept,
  onSelectDept,
  selectedEmployeeFilter,
  onSelectEmployeeFilter,
  employeeOptions,
  selectedDayFilter,
  onSelectDayFilter,
  searchQuery,
  onClearFilters,
  monthlySummaryMap,
  pontoMaisSummaryMap,
  storeHours,
  sectorMinimums,
  onUpdateShift,
  onBatchUpdateEmployees,
  onMoveOrApplyFolga,
  onUpdateEmployeeLunch,
  onUpdateStoreHours,
  onUpdateSectorMinimum,
  onLinkFolgaPartner,
  onUnlinkFolgaPartner,
  onLinkNoParallelFolga,
  onUnlinkNoParallelFolga,
  onOpenAddMember,
  onOpenEditMember,
  onOpenAiChat,
  onPrintSector,
  onNotify,
}) => {
  const [coverageTarget, setCoverageTarget] = useState<{
    employee: Employee;
    day: DayOfWeek;
    weekNumber: number;
  } | null>(null);
  const [balanceTarget, setBalanceTarget] = useState<{
    employee: Employee;
    weekNumber: number;
  } | null>(null);

  // Editor Inline de Turno na própria linha da grade (sem abrir janela modal)
  const [inlineShiftDraft, setInlineShiftDraft] = useState<{
    employeeId: string;
    weekNumber: number;
    day: DayOfWeek;
    type: ShiftType;
    chairId: string;
    startTime: string;
    lunchStart: string;
    lunchEnd: string;
    endTime: string;
  } | null>(null);

  // Editor Inline de Almoço na própria célula do colaborador (sem abrir janela modal)
  const [inlineLunchEmpId, setInlineLunchEmpId] = useState<string | null>(null);
  const [lunchStartDraft, setLunchStartDraft] = useState('12:00');
  const [lunchEndDraft, setLunchEndDraft] = useState('13:30');
  const [lunchWeeksDraft, setLunchWeeksDraft] = useState<number[]>([1, 2, 3, 4]);

  // Vínculo Inline para folgar igual entre colaboradores (S1–S4)
  const [inlineFolgaLinkEmpId, setInlineFolgaLinkEmpId] = useState<string | null>(null);
  const [selectedLinkPartnerId, setSelectedLinkPartnerId] = useState<string>('');

  // Vínculo Inline para proibir folga paralela entre colaboradores (S1–S4)
  const [inlineNoParallelEmpId, setInlineNoParallelEmpId] = useState<string | null>(null);
  const [selectedNoParallelPartnerId, setSelectedNoParallelPartnerId] = useState<string>('');

  // Editor Inline de Intervalo do Grupo por Setor (define apenas intervalo, preservando entrada/saída/folgas)
  const [inlineGroupKey, setInlineGroupKey] = useState<string | null>(null);
  const [groupDraft, setGroupDraft] = useState<{
    mode: 'DURATION_ONLY' | 'FIXED_WINDOW' | 'NONE';
    durationMinutes: number;
    lunchStart: string;
    lunchEnd: string;
    selectedWeeks: number[];
  }>({
    mode: 'DURATION_ONLY',
    durationMinutes: 90,
    lunchStart: '12:00',
    lunchEnd: '13:30',
    selectedWeeks: [1, 2, 3, 4],
  });

  // Editor Inline de Abertura/Fechamento exclusivo de cada loja
  const [openStoreHoursEditor, setOpenStoreHoursEditor] = useState<StoreId | null>(null);
  const [storeHoursDraft, setStoreHoursDraft] = useState<StoreOperatingHours | null>(null);

  const [dragPayload, setDragPayload] = useState<FolgaDragPayload | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);

  const headerScrollRef = useRef<HTMLDivElement | null>(null);
  const tableScrollRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const isSyncingScrollRef = useRef(false);

  const syncHorizontalScroll = (source: HTMLDivElement) => {
    if (isSyncingScrollRef.current) return;
    isSyncingScrollRef.current = true;
    const targetLeft = source.scrollLeft;

    if (headerScrollRef.current && headerScrollRef.current !== source) {
      headerScrollRef.current.scrollLeft = targetLeft;
    }
    Object.values(tableScrollRefs.current).forEach((el) => {
      if (el && el !== source) {
        el.scrollLeft = targetLeft;
      }
    });

    requestAnimationFrame(() => {
      isSyncingScrollRef.current = false;
    });
  };

  const visibleDays = getVisibleDays(DAYS_OF_WEEK, selectedDayFilter);
  const isSingleDayView = visibleDays.length === 1;
  const tableMinWidthClass = isSingleDayView ? 'min-w-[760px]' : 'min-w-[1040px]';

  const renderColGroup = () =>
    isSingleDayView ? (
      <colgroup>
        <col style={{ width: '26%' }} />
        <col style={{ width: '7%' }} />
        <col style={{ width: '29%' }} />
        <col style={{ width: '17%' }} />
        <col style={{ width: '21%' }} />
      </colgroup>
    ) : (
      <colgroup>
        <col style={{ width: '16%' }} />
        <col style={{ width: '4.2%' }} />
        <col style={{ width: '8%' }} />
        <col style={{ width: '8%' }} />
        <col style={{ width: '8%' }} />
        <col style={{ width: '8%' }} />
        <col style={{ width: '8%' }} />
        <col style={{ width: '8%' }} />
        <col style={{ width: '8%' }} />
        <col style={{ width: '10.6%' }} />
        <col style={{ width: '13.2%' }} />
      </colgroup>
    );

  const hasAnyActiveFilter =
    selectedWeekFilter !== 'ALL' ||
    selectedStore !== 'ALL' ||
    selectedDept !== 'ALL' ||
    selectedEmployeeFilter !== 'ALL' ||
    selectedDayFilter !== 'ALL' ||
    searchQuery.trim().length > 0;

  const visibleWeeks = selectedWeekFilter === 'ALL' ? [1, 2, 3, 4] : [selectedWeekFilter];

  const preparedEmployees = employees.map(ensureEmployeeWeeksSchedule);

  const getWeekEmployees = (weekNum: number): Employee[] =>
    preparedEmployees.map((emp) => ({
      ...emp,
      schedule: emp.weeksSchedule?.[weekNum] || emp.schedule,
    }));

  // Cobertura por semana (S1..S4) calculada dinamicamente com os mínimos configurados por setor
  const coverageByWeek: Record<number, ReturnType<typeof calculateWeeklyCoverageSummary>> = {
    1: calculateWeeklyCoverageSummary(getWeekEmployees(1), sectorMinimums),
    2: calculateWeeklyCoverageSummary(getWeekEmployees(2), sectorMinimums),
    3: calculateWeeklyCoverageSummary(getWeekEmployees(3), sectorMinimums),
    4: calculateWeeklyCoverageSummary(getWeekEmployees(4), sectorMinimums),
  };

  // Equilibrar horas de todo um grupo/setor (fecha o mês quando Todas está ativo, ou só a semana filtrada)
  const handleBalanceGroup = (departmentId: DepartmentId) => {
    if (!onBatchUpdateEmployees) return;

    if (selectedWeekFilter === 'ALL') {
      const updated = preparedEmployees.map((emp) => {
        if (
          emp.department === departmentId &&
          emp.contractType !== 'LICENCA_MATERNIDADE' &&
          !emp.isCirculating
        ) {
          return balanceAllWeeksToMonthlyTarget(emp, currentPhase, 'AUTO');
        }
        return emp;
      });
      onBatchUpdateEmployees(updated, 'ALL_WEEKS');
    } else {
      const wNum = selectedWeekFilter;
      const targetH = LEGAL_PHASES[currentPhase].maxWeeklyHours;
      const updated = preparedEmployees.map((emp) => {
        if (
          emp.department === departmentId &&
          emp.contractType !== 'LICENCA_MATERNIDADE' &&
          !emp.isCirculating
        ) {
          const weekSched = emp.weeksSchedule?.[wNum] || emp.schedule;
          const balancedSched = balanceScheduleToTarget(
            weekSched,
            emp.contractType === 'ESTAGIARIO' ? 24 : targetH,
            'AUTO',
            emp.contractType === 'ESTAGIARIO'
          );
          const nextEmp = replaceEmployeeWeekSchedule(emp, wNum, balancedSched);
          return { ...nextEmp, schedule: balancedSched };
        }
        return emp;
      });
      onBatchUpdateEmployees(updated, 'SINGLE_WEEK', [wNum]);
    }
  };


  // Abre/fecha editor inline do dia (NUNCA transforma o dia em folga ao tocar)
  const handleToggleInlineShiftEditor = (employee: Employee, day: DayOfWeek, weekNum: number) => {
    if (
      inlineShiftDraft &&
      inlineShiftDraft.employeeId === employee.id &&
      inlineShiftDraft.weekNumber === weekNum &&
      inlineShiftDraft.day === day
    ) {
      setInlineShiftDraft(null);
      return;
    }

    const weekSched = employee.weeksSchedule?.[weekNum] || employee.schedule;
    const current = weekSched[day];
    const storeCfg = storeHours[employee.defaultStore] || DEFAULT_STORE_HOURS[employee.defaultStore];
    const defaultStart = day === 'SAB' ? storeCfg.saturdayOpen : storeCfg.weekdayOpen;
    const defaultEnd = day === 'SAB' ? storeCfg.saturdayClose : storeCfg.weekdayClose;

    setInlineShiftDraft({
      employeeId: employee.id,
      weekNumber: weekNum,
      day,
      type: current?.type || 'TRABALHO',
      chairId: current?.chairId || employee.defaultChairId,
      startTime: current?.startTime || defaultStart,
      lunchStart: current?.lunchStart || employee.defaultLunchStart || '12:00',
      lunchEnd: current?.lunchEnd || employee.defaultLunchEnd || '13:30',
      endTime: current?.endTime || defaultEnd,
    });
  };

  const handleToggleInlineLunchEditor = (employee: Employee) => {
    if (inlineLunchEmpId === employee.id) {
      setInlineLunchEmpId(null);
      return;
    }
    setInlineFolgaLinkEmpId(null);
    setInlineNoParallelEmpId(null);
    setInlineLunchEmpId(employee.id);
    setLunchStartDraft(employee.defaultLunchStart || '12:00');
    setLunchEndDraft(employee.defaultLunchEnd || '13:30');
    setLunchWeeksDraft(selectedWeekFilter === 'ALL' ? [1, 2, 3, 4] : [selectedWeekFilter]);
  };

  const handleToggleFolgaLinkEditor = (employee: Employee) => {
    if (inlineFolgaLinkEmpId === employee.id) {
      setInlineFolgaLinkEmpId(null);
      return;
    }
    setInlineLunchEmpId(null);
    setInlineNoParallelEmpId(null);
    const eligible = preparedEmployees.filter(
      (e) => e.id !== employee.id && e.contractType !== 'LICENCA_MATERNIDADE'
    );
    const preferredAffinity =
      employee.affinityPartnerId &&
      eligible.some((e) => e.id === employee.affinityPartnerId)
        ? employee.affinityPartnerId
        : undefined;
    const existingLinked = employee.linkedFolgaIds?.find((id) =>
      eligible.some((e) => e.id === id)
    );
    setSelectedLinkPartnerId(
      preferredAffinity || existingLinked || eligible[0]?.id || ''
    );
    setInlineFolgaLinkEmpId(employee.id);
  };

  const handleToggleNoParallelEditor = (employee: Employee) => {
    if (inlineNoParallelEmpId === employee.id) {
      setInlineNoParallelEmpId(null);
      return;
    }
    setInlineLunchEmpId(null);
    setInlineFolgaLinkEmpId(null);
    const eligible = preparedEmployees.filter(
      (e) => e.id !== employee.id && e.contractType !== 'LICENCA_MATERNIDADE'
    );
    const existingBlocked = employee.noParallelFolgaIds?.find((id) =>
      eligible.some((e) => e.id === id)
    );
    const preferredAffinity =
      employee.affinityPartnerId &&
      eligible.some((e) => e.id === employee.affinityPartnerId)
        ? employee.affinityPartnerId
        : undefined;
    setSelectedNoParallelPartnerId(
      existingBlocked || preferredAffinity || eligible[0]?.id || ''
    );
    setInlineNoParallelEmpId(employee.id);
  };

  const handleToggleInlineGroupEditor = (storeId: StoreId, deptId: DepartmentId) => {
    const key = `${storeId}::${deptId}`;
    if (inlineGroupKey === key) {
      setInlineGroupKey(null);
      return;
    }
    const sampleEmp = preparedEmployees.find(
      (emp) =>
        emp.department === deptId &&
        emp.defaultStore === storeId &&
        emp.contractType !== 'LICENCA_MATERNIDADE' &&
        emp.contractType !== 'ESTAGIARIO' &&
        !emp.isCirculating
    );
    const sampleStart = sampleEmp?.defaultLunchStart || '12:00';
    const sampleEnd = sampleEmp?.defaultLunchEnd || '13:30';
    const computedDuration =
      sampleEmp?.defaultLunchStart && sampleEmp?.defaultLunchEnd
        ? Math.max(
            30,
            Math.min(180, parseTimeToMinutes(sampleEnd) - parseTimeToMinutes(sampleStart))
          )
        : 90;

    setInlineGroupKey(key);
    setGroupDraft({
      mode: 'DURATION_ONLY',
      durationMinutes: computedDuration,
      lunchStart: sampleStart,
      lunchEnd: sampleEnd,
      selectedWeeks: selectedWeekFilter === 'ALL' ? [1, 2, 3, 4] : [selectedWeekFilter],
    });
  };

  const canDropFolgaOnCell = (
    payload: FolgaDragPayload | null,
    employeeId: string,
    targetWeek: number,
    dayKey: DayOfWeek,
    isWork: boolean,
    isLicenca: boolean
  ): boolean => {
    if (isLicenca || !isWork) return false;
    if (!payload) return true;
    if (payload.kind === 'NEW_FOLGA') return true;
    if (payload.kind === 'MOVE_FOLGA') {
      if (payload.employeeId !== employeeId) return false;
      if (payload.sourceWeek === targetWeek && payload.sourceDay === dayKey) return false;
      if (payload.sourceWeek !== targetWeek) {
        const emp = preparedEmployees.find((e) => e.id === employeeId);
        const sourceSched = emp?.weeksSchedule?.[payload.sourceWeek] || emp?.schedule;
        if (!sourceSched || countRestDaysInWeek(sourceSched) <= 1) return false;
      }
      return true;
    }
    return false;
  };

  const handleToggleStoreHoursEditor = (storeId: StoreId) => {
    if (openStoreHoursEditor === storeId) {
      setOpenStoreHoursEditor(null);
      setStoreHoursDraft(null);
    } else {
      const currentCfg = storeHours[storeId] || DEFAULT_STORE_HOURS[storeId];
      setOpenStoreHoursEditor(storeId);
      setStoreHoursDraft({ ...currentCfg });
    }
  };

  const formatSigned = (val: number): string => {
    if (Math.abs(val) < 0.08) return '0h00';
    return `${val > 0 ? '+' : '-'}${formatHoursDecimal(Math.abs(val))}`;
  };

  const storeSections: {
    storeId: StoreId;
    storeName: string;
    storeCode: string;
    storeSubtitle: string;
    sections: {
      deptId: DepartmentId;
      title: string;
      iconColor: string;
      chairIds: string[];
    }[];
  }[] = [
    {
      storeId: 'LOJA_1',
      storeName: 'Loja 1 — Matriz 546',
      storeCode: 'MATRIZ-546',
      storeSubtitle: 'Showroom Principal, Pátio e Base da Preparação',
      sections: [
        {
          deptId: 'SDR',
          title: 'Sala de SDRs (Pré-vendas)',
          iconColor: '#2563EB',
          chairIds: ['SDR-1', 'SDR-2', 'SDR-3', 'SDR-4'],
        },
        {
          deptId: 'VENDAS',
          title: 'Pátio de Vendedores',
          iconColor: '#059669',
          chairIds: ['VEND-L1-1', 'VEND-L1-2', 'VEND-L1-3', 'VEND-L1-4', 'VEND-L1-5', 'VEND-L1-6'],
        },
        {
          deptId: 'PREPARACAO',
          title: 'Base da Preparação & Zeladoria',
          iconColor: '#D97706',
          chairIds: ['PREP-1', 'PREP-2', 'PREP-3', 'PREP-4'],
        },
        {
          deptId: 'MARKETING',
          title: 'Marketing & Conteúdo',
          iconColor: '#4F46E5',
          chairIds: ['MKT-1'],
        },
      ],
    },
    {
      storeId: 'LOJA_2',
      storeName: 'Loja 2 — Filial 777',
      storeCode: 'FILIAL-777',
      storeSubtitle: 'Compras de Veículos, Atendimento, Pós-Venda e Serviços',
      sections: [
        {
          deptId: 'VENDAS',
          title: 'Área Externa (Vendedor Externo)',
          iconColor: '#059669',
          chairIds: ['VEND-L2-EXT'],
        },
        {
          deptId: 'DOCUMENTACAO',
          title: 'Escritório de Atendimento (Baias de Doc & Pós-Venda)',
          iconColor: '#7C3AED',
          chairIds: ['DOC-SUP', 'DOC-AUX', 'DOC-EST', 'SC-1'],
        },
        {
          deptId: 'FINANCEIRO',
          title: 'Escritório 2 — Financeiro & Pagamentos',
          iconColor: '#DB2777',
          chairIds: ['FIN-1'],
        },
      ],
    },
  ];

  return (
    <div className="space-y-5">
      {/* Cabeçalho Congelado dos Dias da Semana servindo a todas as tabelas */}
      <div
        data-frozen-weekday-dock="true"
        className="sticky top-0 z-30 pt-1 -mt-1 bg-slate-50/95 backdrop-blur-xs"
      >
        <div className="bg-white border border-slate-300 rounded-none shadow-none overflow-hidden">
          {/* Dias da semana congelados no topo — alinhados por colgroup a todas as tabelas abaixo */}
          <div
            ref={headerScrollRef}
            onScroll={(e) => syncHorizontalScroll(e.currentTarget)}
            className="border-t border-slate-200 bg-slate-100/90 pl-[50px] pr-[18px] overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <table
              data-frozen-weekday-header="true"
              aria-label="Dias da semana congelados no topo para todas as tabelas"
              className={`w-full table-fixed text-left text-xs border-collapse ${tableMinWidthClass}`}
            >
              {renderColGroup()}
              <thead>
                <tr className="text-slate-700 font-bold uppercase text-[10px] tracking-wide">
                  <th className="py-2 px-2.5 text-slate-700">Cadeira / Colab.</th>
                  <th className="py-2 px-1 text-center text-slate-700">Sem.</th>
                  {visibleDays.map((day) => {
                    const l1Cfg = storeHours.LOJA_1 || DEFAULT_STORE_HOURS.LOJA_1;
                    const l2Cfg = storeHours.LOJA_2 || DEFAULT_STORE_HOURS.LOJA_2;
                    const formatDayHours = (cfg: StoreOperatingHours) =>
                      day.key === 'SAB'
                        ? `${cfg.saturdayOpen}–${cfg.saturdayClose}`
                        : day.key === 'DOM'
                        ? 'DSR'
                        : `${cfg.weekdayOpen}–${cfg.weekdayClose}`;
                    const l1Text = formatDayHours(l1Cfg);
                    const l2Text = formatDayHours(l2Cfg);
                    const hoursSubLabel =
                      selectedStore === 'LOJA_1'
                        ? l1Text
                        : selectedStore === 'LOJA_2'
                        ? l2Text
                        : l1Text === l2Text
                        ? l1Text
                        : `L1 ${l1Text.split('–')[0]} · L2 ${l2Text.split('–')[0]}`;
                    const isFilteredDay = selectedDayFilter === day.key;

                    return (
                      <th
                        key={day.key}
                        data-frozen-day-col={day.key}
                        className={`p-0 text-center border-l border-slate-200/80 ${
                          isFilteredDay
                            ? 'bg-blue-100/80 text-blue-900'
                            : day.isWeekend
                            ? 'bg-blue-50/70 text-blue-800'
                            : 'text-slate-800'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            onSelectDayFilter?.(isFilteredDay ? 'ALL' : day.key)
                          }
                          className="w-full py-2 px-1 text-center hover:bg-blue-100/60 transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                          title={
                            isFilteredDay
                              ? `Mostrando apenas ${day.label}. Clique para exibir todos os dias.`
                              : `Clique para filtrar todas as tabelas por ${day.label}`
                          }
                        >
                          <div className="leading-tight font-extrabold flex items-center justify-center gap-1">
                            <span>{day.shortLabel}</span>
                            {isFilteredDay && (
                              <span className="text-[8.5px] normal-case font-bold px-1 py-0.2 rounded bg-blue-600 text-white">
                                Filtro
                              </span>
                            )}
                          </div>
                          <div className="text-[9px] normal-case font-normal text-slate-500 font-mono leading-tight mt-0.5 truncate">
                            {hoursSubLabel}
                          </div>
                        </button>
                      </th>
                    );
                  })}
                  <th className="py-2 px-1.5 text-center border-l border-slate-200/80 text-slate-700">
                    Sem. &amp; Acum.
                  </th>
                  <th className="py-2 px-2 text-center border-l border-slate-200/80 text-slate-700">
                    Mês (S1–S4)
                  </th>
                </tr>
              </thead>
            </table>
          </div>
        </div>
      </div>

      {/* Renderização Estruturada por LOJA e SETOR */}
      {(() => {
        const dynamicDeptMeta: Record<DepartmentId, { title: string; iconColor: string }> = {
          SDR: { title: 'Sala de SDRs & Pré-Vendas', iconColor: '#0284C7' },
          VENDAS: { title: 'Equipe de Vendas & Pátio', iconColor: '#059669' },
          PREPARACAO: { title: 'Base da Preparação & Zeladoria', iconColor: '#D97706' },
          DOCUMENTACAO: { title: 'Escritório de Documentação & Pós-Venda', iconColor: '#7C3AED' },
          FINANCEIRO: { title: 'Escritório Financeiro & Pagamentos', iconColor: '#DB2777' },
          SUCESSO_CLIENTE: { title: 'Sucesso do Cliente', iconColor: '#0D9488' },
          MARKETING: { title: 'Marketing & Conteúdo', iconColor: '#4F46E5' },
          GESTAO: { title: 'Gestão & Liderança', iconColor: '#334155' },
        };

        const renderedStores = storeSections
          .map((store) => {
            if (selectedStore !== 'ALL' && store.storeId !== selectedStore) return null;

            const allStoreSections = [...store.sections];
            const existingDepts = new Set(allStoreSections.map((s) => s.deptId));
            preparedEmployees.forEach((emp) => {
              if (emp.defaultStore !== store.storeId) return;
              const effectiveDept: DepartmentId =
                store.storeId === 'LOJA_2' && emp.department === 'SUCESSO_CLIENTE'
                  ? 'DOCUMENTACAO'
                  : emp.department;
              if (!existingDepts.has(effectiveDept)) {
                existingDepts.add(effectiveDept);
                const meta = dynamicDeptMeta[effectiveDept] || {
                  title: effectiveDept,
                  iconColor: '#475569',
                };
                allStoreSections.push({
                  deptId: effectiveDept,
                  title: meta.title,
                  iconColor: meta.iconColor,
                  chairIds: [],
                });
              }
            });

            const sectionsWithChairs = allStoreSections
              .filter((sec) => selectedDept === 'ALL' || sec.deptId === selectedDept)
              .map((sec) => {
                const chairDefs = buildSectionChairs(
                  sec.chairIds,
                  store.storeId,
                  sec.deptId,
                  preparedEmployees,
                  CHAIRS
                );
                const chairsFiltered = filterSectionChairs(
                  chairDefs,
                  preparedEmployees,
                  visibleWeeks,
                  selectedEmployeeFilter,
                  searchQuery
                );
                return { section: sec, chairsFiltered };
              })
              .filter((item) => item.chairsFiltered.length > 0);

            if (sectionsWithChairs.length === 0) return null;

            const storeCfg = storeHours[store.storeId] || DEFAULT_STORE_HOURS[store.storeId];
            const isEditingStoreHours = openStoreHoursEditor === store.storeId;

            return (
              <div
                key={store.storeId}
                data-store-card={store.storeId}
                className="bg-white border border-slate-300 rounded-none shadow-none overflow-clip flex"
              >
            {/* Título da loja na lateral (texto girado, lendo de baixo para cima) */}
            <div
              data-store-side-title={store.storeId}
              className="w-8 shrink-0 bg-slate-900 text-white flex justify-center items-start"
            >
              <div className="sticky top-16 py-3 flex flex-col items-center gap-2">
                <span className="[writing-mode:vertical-rl] rotate-180 whitespace-nowrap text-[11px] font-extrabold uppercase tracking-[0.15em]">
                  {store.storeName}
                </span>
                <span className="w-5 h-5 bg-blue-600 flex items-center justify-center font-bold text-[9px]">
                  {store.storeId === 'LOJA_1' ? 'L1' : 'L2'}
                </span>
              </div>
            </div>

            {/* Seções por Setor dentro da Loja */}
            <div className="flex-1 min-w-0 px-4 py-4 space-y-6">
              {sectionsWithChairs.map(({ section, chairsFiltered }) => {

                const isGroupOpen = inlineGroupKey === `${store.storeId}::${section.deptId}`;
                const matchedSector = SECTOR_DEFINITIONS.find(
                  (s) => s.storeId === store.storeId && s.departmentId === section.deptId
                );
                const sectorMinCfg = matchedSector
                  ? sectorMinimums[matchedSector.id] ||
                    DEFAULT_SECTOR_MINIMUMS[matchedSector.id] || {
                      weekday: matchedSector.minRequiredWeekday,
                      saturday: matchedSector.minRequiredSaturday,
                    }
                  : null;
                const maxSectorChairs = Math.max(
                  matchedSector?.chairIds.length ?? 0,
                  chairsFiltered.length
                );

                return (
                  <div key={section.title} className="border-y border-slate-300 rounded-none overflow-hidden">
                    {/* Barra do Setor */}
                    <div className="bg-slate-50/90 px-4 py-2.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2 font-bold text-xs text-slate-800">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: section.iconColor }}
                        />
                        <span>{section.title}</span>
                        <span className="text-slate-400 font-normal">
                          ({chairsFiltered.length} {chairsFiltered.length === 1 ? 'cadeira' : 'cadeiras'})
                        </span>

                        {matchedSector && sectorMinCfg && (
                          <div className="inline-flex items-center gap-1.5 ml-2 text-xs font-semibold text-slate-700">
                            <span className="text-slate-500">Efetivo mín.:</span>
                            <span className="inline-flex items-center gap-0.5">
                              <span className="text-[9.5px] text-slate-500">Seg–Sex</span>
                              <button
                                type="button"
                                disabled={sectorMinCfg.weekday <= 0}
                                onClick={() =>
                                  onUpdateSectorMinimum(
                                    matchedSector.id,
                                    {
                                      ...sectorMinCfg,
                                      weekday: Math.max(0, sectorMinCfg.weekday - 1),
                                    },
                                    matchedSector.title
                                  )
                                }
                                aria-label={`Reduzir mínimo Seg–Sex do setor ${matchedSector.title}`}
                                className="w-4 h-4 rounded hover:bg-slate-100 text-slate-700 font-bold disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed"
                              >
                                -
                              </button>
                              <span
                                data-sector-header-min-weekday={matchedSector.id}
                                className="font-mono font-black text-slate-900 w-3.5 text-center"
                              >
                                {sectorMinCfg.weekday}
                              </span>
                              <button
                                type="button"
                                disabled={sectorMinCfg.weekday >= maxSectorChairs}
                                onClick={() =>
                                  onUpdateSectorMinimum(
                                    matchedSector.id,
                                    {
                                      ...sectorMinCfg,
                                      weekday: Math.min(maxSectorChairs, sectorMinCfg.weekday + 1),
                                    },
                                    matchedSector.title
                                  )
                                }
                                aria-label={`Aumentar mínimo Seg–Sex do setor ${matchedSector.title}`}
                                className="w-4 h-4 rounded hover:bg-slate-100 text-slate-700 font-bold disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed"
                              >
                                +
                              </button>
                            </span>
                            <span className="text-slate-300">|</span>
                            <span className="inline-flex items-center gap-0.5">
                              <span className="text-[9.5px] text-slate-500">Sáb</span>
                              <button
                                type="button"
                                disabled={sectorMinCfg.saturday <= 0}
                                onClick={() =>
                                  onUpdateSectorMinimum(
                                    matchedSector.id,
                                    {
                                      ...sectorMinCfg,
                                      saturday: Math.max(0, sectorMinCfg.saturday - 1),
                                    },
                                    matchedSector.title
                                  )
                                }
                                aria-label={`Reduzir mínimo Sábado do setor ${matchedSector.title}`}
                                className="w-4 h-4 rounded hover:bg-slate-100 text-slate-700 font-bold disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed"
                              >
                                -
                              </button>
                              <span
                                data-sector-header-min-saturday={matchedSector.id}
                                className="font-mono font-black text-slate-900 w-3.5 text-center"
                              >
                                {sectorMinCfg.saturday}
                              </span>
                              <button
                                type="button"
                                disabled={sectorMinCfg.saturday >= maxSectorChairs}
                                onClick={() =>
                                  onUpdateSectorMinimum(
                                    matchedSector.id,
                                    {
                                      ...sectorMinCfg,
                                      saturday: Math.min(maxSectorChairs, sectorMinCfg.saturday + 1),
                                    },
                                    matchedSector.title
                                  )
                                }
                                aria-label={`Aumentar mínimo Sábado do setor ${matchedSector.title}`}
                                className="w-4 h-4 rounded hover:bg-slate-100 text-slate-700 font-bold disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed"
                              >
                                +
                              </button>
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          data-print-folgas-sector={`${store.storeId}::${section.deptId}`}
                          onClick={() =>
                            onPrintSector?.(
                              store.storeId,
                              `${store.storeId}::${section.deptId}`,
                              true
                            )
                          }
                          className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-300 hover:bg-emerald-100 text-emerald-950 font-bold text-[10px] flex items-center gap-1 shadow-2xs transition cursor-pointer whitespace-nowrap shrink-0"
                          title={`Imprimir apenas as folgas do setor ${section.title} (sem horários do dia a dia)`}
                        >
                          <CalendarOff className="w-3 h-3 text-emerald-700 shrink-0" />
                          <span>Imprimir Só Folgas</span>
                        </button>

                        <button
                          type="button"
                          data-print-sector={`${store.storeId}::${section.deptId}`}
                          onClick={() =>
                            onPrintSector?.(
                              store.storeId,
                              `${store.storeId}::${section.deptId}`,
                              false
                            )
                          }
                          className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 font-bold text-[10px] flex items-center gap-1 shadow-2xs transition cursor-pointer whitespace-nowrap shrink-0"
                          title={`Imprimir a tabela de escala apenas do setor ${section.title}`}
                        >
                          <Printer className="w-3 h-3 text-blue-600 shrink-0" />
                          <span>Imprimir Setor</span>
                        </button>

                        <button
                          type="button"
                          aria-expanded={isGroupOpen}
                          onClick={() => handleToggleInlineGroupEditor(store.storeId, section.deptId)}
                          className={`px-2.5 py-1 rounded-lg border font-bold text-[10px] flex items-center gap-1 shadow-2xs transition cursor-pointer whitespace-nowrap shrink-0 ${
                            isGroupOpen
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-white border-slate-200 hover:bg-slate-100 text-slate-700'
                          }`}
                          title="Define apenas o tempo de intervalo do setor, mantendo entrada, saída e folgas individuais"
                        >
                          <Utensils className="w-3 h-3 shrink-0" />
                          <span>Intervalo do Grupo</span>
                        </button>

                      </div>
                    </div>

                    {/* Editor Inline de Intervalo do Grupo (NÃO altera entrada/saída nem folgas individuais) */}
                    {isGroupOpen && (
                      <div
                        data-group-interval-panel={`${store.storeId}::${section.deptId}`}
                        className="bg-blue-50/50 border-b border-blue-200 px-4 py-3 text-xs space-y-2.5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-bold text-blue-950">
                            Tempo de Intervalo do Grupo ({section.title}) &bull;{' '}
                            <span className="font-normal text-blue-900">
                              Preserva entrada, saída e folgas individuais de cada colaborador
                            </span>
                          </span>
                          <button
                            type="button"
                            onClick={() => setInlineGroupKey(null)}
                            className="text-[11px] text-slate-600 hover:text-slate-900 font-semibold cursor-pointer"
                          >
                            Fechar
                          </button>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                          {/* Modo do intervalo */}
                          <div className="inline-flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200">
                            <button
                              type="button"
                              onClick={() => setGroupDraft({ ...groupDraft, mode: 'DURATION_ONLY' })}
                              className={`px-2 py-1 rounded text-[10.5px] font-bold cursor-pointer whitespace-nowrap ${
                                groupDraft.mode === 'DURATION_ONLY'
                                  ? 'bg-blue-600 text-white'
                                  : 'text-slate-600 hover:bg-slate-100'
                              }`}
                            >
                              Só duração (mantém início)
                            </button>
                            <button
                              type="button"
                              onClick={() => setGroupDraft({ ...groupDraft, mode: 'FIXED_WINDOW' })}
                              className={`px-2 py-1 rounded text-[10.5px] font-bold cursor-pointer whitespace-nowrap ${
                                groupDraft.mode === 'FIXED_WINDOW'
                                  ? 'bg-blue-600 text-white'
                                  : 'text-slate-600 hover:bg-slate-100'
                              }`}
                            >
                              Horário fixo
                            </button>
                            <button
                              type="button"
                              onClick={() => setGroupDraft({ ...groupDraft, mode: 'NONE' })}
                              className={`px-2 py-1 rounded text-[10.5px] font-bold cursor-pointer whitespace-nowrap ${
                                groupDraft.mode === 'NONE'
                                  ? 'bg-slate-900 text-white'
                                  : 'text-slate-600 hover:bg-slate-100'
                              }`}
                            >
                              Sem intervalo
                            </button>
                          </div>

                          {groupDraft.mode === 'DURATION_ONLY' && (
                            <div className="flex flex-wrap items-center gap-1.5">
                              {[
                                { label: '30m', mins: 30 },
                                { label: '1h00', mins: 60 },
                                { label: '1h30', mins: 90 },
                                { label: '2h00', mins: 120 },
                              ].map((preset) => (
                                <button
                                  key={preset.mins}
                                  type="button"
                                  onClick={() =>
                                    setGroupDraft({ ...groupDraft, durationMinutes: preset.mins })
                                  }
                                  className={`px-2 py-1 rounded-lg border font-mono text-[11px] font-bold cursor-pointer ${
                                    groupDraft.durationMinutes === preset.mins
                                      ? 'bg-blue-600 text-white border-blue-600'
                                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                                  }`}
                                >
                                  {preset.label}
                                </button>
                              ))}

                              <div className="inline-flex items-center gap-1 bg-white border border-slate-300 rounded-lg px-1.5 py-0.5 text-[11px]">
                                <button
                                  type="button"
                                  aria-label="Reduzir duração do intervalo em 15 minutos"
                                  onClick={() =>
                                    setGroupDraft({
                                      ...groupDraft,
                                      durationMinutes: Math.max(15, groupDraft.durationMinutes - 15),
                                    })
                                  }
                                  className="w-5 h-5 rounded hover:bg-slate-100 font-bold text-slate-700 cursor-pointer"
                                >
                                  -
                                </button>
                                <span
                                  data-group-duration-readout={section.deptId}
                                  className="font-mono font-black text-slate-900 min-w-[40px] text-center"
                                >
                                  {formatHoursDecimal(groupDraft.durationMinutes / 60)}
                                </span>
                                <button
                                  type="button"
                                  aria-label="Aumentar duração do intervalo em 15 minutos"
                                  onClick={() =>
                                    setGroupDraft({
                                      ...groupDraft,
                                      durationMinutes: Math.min(240, groupDraft.durationMinutes + 15),
                                    })
                                  }
                                  className="w-5 h-5 rounded hover:bg-slate-100 font-bold text-slate-700 cursor-pointer"
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          )}

                          {groupDraft.mode === 'FIXED_WINDOW' && (
                            <div className="flex items-center gap-2">
                              <div>
                                <label
                                  htmlFor={`grp-lunch-start-${store.storeId}-${section.deptId}`}
                                  className="block text-[10px] font-bold text-slate-600 mb-0.5"
                                >
                                  Início Intervalo
                                </label>
                                <input
                                  id={`grp-lunch-start-${store.storeId}-${section.deptId}`}
                                  type="time"
                                  value={groupDraft.lunchStart}
                                  onChange={(e) =>
                                    setGroupDraft({ ...groupDraft, lunchStart: e.target.value })
                                  }
                                  className="px-2 py-1 bg-white border border-slate-300 rounded-lg font-mono text-xs text-slate-900"
                                />
                              </div>
                              <div>
                                <label
                                  htmlFor={`grp-lunch-end-${store.storeId}-${section.deptId}`}
                                  className="block text-[10px] font-bold text-slate-600 mb-0.5"
                                >
                                  Fim Intervalo
                                </label>
                                <input
                                  id={`grp-lunch-end-${store.storeId}-${section.deptId}`}
                                  type="time"
                                  value={groupDraft.lunchEnd}
                                  onChange={(e) =>
                                    setGroupDraft({ ...groupDraft, lunchEnd: e.target.value })
                                  }
                                  className="px-2 py-1 bg-white border border-slate-300 rounded-lg font-mono text-xs text-slate-900"
                                />
                              </div>
                            </div>
                          )}

                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4].map((w) => {
                              const active = groupDraft.selectedWeeks.includes(w);
                              return (
                                <button
                                  key={w}
                                  type="button"
                                  onClick={() =>
                                    setGroupDraft((prev) => ({
                                      ...prev,
                                      selectedWeeks: prev.selectedWeeks.includes(w)
                                        ? prev.selectedWeeks.length > 1
                                          ? prev.selectedWeeks.filter((x) => x !== w)
                                          : prev.selectedWeeks
                                        : [...prev.selectedWeeks, w].sort((a, b) => a - b),
                                    }))
                                  }
                                  className={`px-2 py-1 rounded border text-[10px] font-bold cursor-pointer ${
                                    active
                                      ? 'bg-slate-900 text-white border-slate-900'
                                      : 'bg-white text-slate-600 border-slate-300'
                                  }`}
                                >
                                  S{w}
                                </button>
                              );
                            })}
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              if (!onBatchUpdateEmployees) return;
                              const updatedGroup = applyGroupBreakInterval(
                                preparedEmployees,
                                section.deptId,
                                {
                                  storeId: store.storeId,
                                  mode: groupDraft.mode,
                                  durationMinutes: groupDraft.durationMinutes,
                                  lunchStart: groupDraft.lunchStart,
                                  lunchEnd: groupDraft.lunchEnd,
                                  targetWeeks: groupDraft.selectedWeeks,
                                }
                              );
                              onBatchUpdateEmployees(updatedGroup, 'ALL_WEEKS');
                              setInlineGroupKey(null);
                              const weeksLabel = groupDraft.selectedWeeks
                                .map((w) => `S${w}`)
                                .join(', ');
                              const desc =
                                groupDraft.mode === 'NONE'
                                  ? 'sem intervalo'
                                  : groupDraft.mode === 'FIXED_WINDOW'
                                  ? `${groupDraft.lunchStart}–${groupDraft.lunchEnd}`
                                  : `duração ${formatHoursDecimal(groupDraft.durationMinutes / 60)}`;
                              onNotify?.(
                                `Intervalo de ${section.title} atualizado (${desc} em ${weeksLabel}), preservando entrada e saída individuais!`
                              );
                            }}
                            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] cursor-pointer whitespace-nowrap shrink-0"
                          >
                            Aplicar Intervalo
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Tabela do Setor (Todas as 4 semanas simultâneas ou semana filtrada) */}
                    <div
                      ref={(el) => {
                        tableScrollRefs.current[`${store.storeId}::${section.deptId}`] = el;
                      }}
                      onScroll={(e) => syncHorizontalScroll(e.currentTarget)}
                      className="overflow-x-auto"
                    >
                      <table className={`w-full table-fixed text-left text-xs border-collapse ${tableMinWidthClass}`}>
                        {renderColGroup()}
                        <thead className="sr-only">
                          <tr>
                            <th>Cadeira / Colab.</th>
                            <th>Sem.</th>
                            {visibleDays.map((day) => (
                              <th key={day.key}>{day.shortLabel}</th>
                            ))}
                            <th>Sem. &amp; Acum.</th>
                            <th>Mês (S1–S4)</th>
                          </tr>
                        </thead>

                        <tbody>
                          {chairsFiltered.map((chair, chairIdx) => {
                            const occupant = findChairOccupant(
                              chair.id,
                              preparedEmployees,
                              visibleWeeks
                            );

                            const monthlySummary = occupant
                              ? monthlySummaryMap[occupant.id]
                              : undefined;

                            // Cadeira vaga
                            if (!occupant) {
                              return (
                                <tr
                                  key={chair.id}
                                  className={chairIdx > 0 ? 'border-t-2 border-slate-200' : ''}
                                >
                                  <td className="py-3 px-2.5">
                                    <div className="flex items-center gap-1.5 font-bold text-slate-900">
                                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                                        {chair.code}
                                      </span>
                                      <span className="truncate">{chair.name}</span>
                                    </div>
                                    <div className="text-[11px] text-slate-400 italic mt-1">
                                      Cadeira vaga
                                    </div>
                                  </td>
                                  <td className="py-2 px-1 text-center text-slate-300">&mdash;</td>
                                  {visibleDays.map((d) => (
                                    <td key={d.key} className="py-2 px-1 text-center text-slate-300">
                                      &mdash;
                                    </td>
                                  ))}
                                  <td className="py-2 px-1.5 text-center text-slate-300">&mdash;</td>
                                  <td className="py-2 px-2 text-center text-slate-300">&mdash;</td>
                                </tr>
                              );
                            }

                            // Colaboradora em Licença-Maternidade: exibição compacta em linha única
                            if (occupant.contractType === 'LICENCA_MATERNIDADE') {
                              return (
                                <tr
                                  key={chair.id}
                                  className={`bg-rose-50/30 ${
                                    chairIdx > 0 ? 'border-t-2 border-slate-200' : ''
                                  }`}
                                >
                                  <td className="py-2.5 px-2.5">
                                    <div className="flex items-center gap-1.5 font-bold text-slate-900">
                                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                                        {chair.code}
                                      </span>
                                      <span className="truncate text-[11px]">{chair.name}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 mt-1">
                                      <span
                                        className="w-2 h-2 rounded-full shrink-0"
                                        style={{ backgroundColor: occupant.badgeColor }}
                                      />
                                      <span className="font-semibold text-slate-900 text-[11px] truncate">
                                        {occupant.shortName}
                                      </span>
                                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 font-mono font-semibold">
                                        Licença
                                      </span>
                                      <button
                                        type="button"
                                        data-edit-member={occupant.id}
                                        onClick={() => onOpenEditMember?.(occupant)}
                                        title={`Editar ou excluir cadastro de ${occupant.shortName}`}
                                        aria-label={`Editar cadastro de ${occupant.shortName}`}
                                        className="ml-auto p-1 rounded border border-slate-200 bg-white hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition cursor-pointer"
                                      >
                                        <Edit2 className="w-2.5 h-2.5" />
                                      </button>
                                    </div>
                                  </td>
                                  <td className="py-2 px-1 text-center font-mono text-[10px] font-bold text-rose-700">
                                    S1–S4
                                  </td>
                                  <td
                                    colSpan={visibleDays.length}
                                    className="py-2 px-3 text-center text-[11px] text-rose-800 font-medium bg-rose-50/50"
                                  >
                                    Licença-Maternidade nas 4 semanas &bull; Posto coberto por Jorge Vinicius
                                  </td>
                                  <td className="py-2 px-1.5 text-center font-mono text-[10px] text-slate-500">
                                    0h00
                                  </td>
                                  <td className="py-2 px-2 text-center">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-semibold border border-emerald-200">
                                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                      Conforme
                                    </span>
                                  </td>
                                </tr>
                              );
                            }

                            return visibleWeeks.map((weekNum, wIdx) => {
                              const weekSched =
                                occupant.weeksSchedule?.[weekNum] || occupant.schedule;
                              const weekComp = monthlySummary?.complianceByWeek[weekNum - 1];
                              const weekHours =
                                monthlySummary?.weeklyHours[weekNum - 1] ?? 0;
                              const weekDelta =
                                monthlySummary?.weeklyDeltas[weekNum - 1] ?? 0;
                              const accumBalance =
                                monthlySummary?.accumulatedBalances[weekNum - 1] ?? 0;
                              const pmSummary = pontoMaisSummaryMap[occupant.id];
                              const pmWeek = pmSummary?.weeks[weekNum - 1];
                              const weekCov = coverageByWeek[weekNum];
                              const restDaysInWeek = countRestDaysInWeek(weekSched);
                              const restDaysAtMinimum = restDaysInWeek <= 1;
                              const hasRealWeekViolation = Boolean(
                                weekComp?.violations.some((v) => {
                                  if (v.severity !== 'ERROR') return false;
                                  if (
                                    v.code === 'INSUFFICIENT_REST_DAYS' &&
                                    weekComp.restDaysCount >= 1 &&
                                    currentPhase !== 'ATUAL' &&
                                    monthlySummary?.status !== 'VIOLACAO'
                                  ) {
                                    return false;
                                  }
                                  if (
                                    v.code === 'MAX_HOURS_EXCEEDED' &&
                                    currentPhase !== 'ATUAL' &&
                                    monthlySummary?.status !== 'VIOLACAO'
                                  ) {
                                    return false;
                                  }
                                  return true;
                                })
                              );

                              const isFirstRow = wIdx === 0;
                              const isInlineShiftOpenOnThisWeek =
                                inlineShiftDraft?.employeeId === occupant.id &&
                                inlineShiftDraft?.weekNumber === weekNum;
                              const hasInlineShiftForEmp =
                                inlineShiftDraft?.employeeId === occupant.id &&
                                visibleWeeks.includes(inlineShiftDraft.weekNumber);
                              const empRowSpan =
                                visibleWeeks.length + (hasInlineShiftForEmp ? 1 : 0);

                              const rowBorderClass = isFirstRow
                                ? chairIdx > 0
                                  ? 'border-t-2 border-slate-300'
                                  : ''
                                : 'border-t border-slate-100';

                              return (
                                <React.Fragment key={`${chair.id}-w${weekNum}`}>
                                <tr
                                  data-employee-week={`${occupant.id}-S${weekNum}`}
                                  className={`${rowBorderClass} hover:bg-blue-50/20 transition-colors`}
                                >
                                  {/* Col 1: Cadeira / Colaborador (rowSpan nas semanas visíveis + editor inline) */}
                                  {isFirstRow && (
                                    <td
                                      rowSpan={empRowSpan}
                                      className="py-2.5 px-2.5 align-top bg-white border-r border-slate-100"
                                    >
                                      <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-1 font-bold text-slate-900 text-[11px]">
                                          <span className="font-mono text-[11px] font-semibold text-slate-500 shrink-0">
                                            {chair.code}
                                          </span>
                                          <span className="truncate" title={chair.name}>
                                            {chair.name}
                                          </span>
                                        </div>

                                        <div className="flex items-center gap-1.5 text-slate-800">
                                          <span
                                            className="w-2 h-2 rounded-full shrink-0"
                                            style={{ backgroundColor: occupant.badgeColor }}
                                          />
                                          <span className="font-bold text-xs text-slate-900 truncate flex-1">
                                            {occupant.shortName}
                                          </span>
                                          <button
                                            type="button"
                                            data-edit-member={occupant.id}
                                            onClick={() => onOpenEditMember?.(occupant)}
                                            title={`Editar ou excluir cadastro de ${occupant.shortName}`}
                                            aria-label={`Editar cadastro de ${occupant.shortName}`}
                                            className="p-1 rounded border border-slate-200 bg-white hover:bg-blue-50 hover:border-blue-300 text-slate-500 hover:text-blue-700 transition cursor-pointer shrink-0"
                                          >
                                            <Edit2 className="w-2.5 h-2.5" />
                                          </button>
                                        </div>

                                        <div className="flex flex-col items-start gap-1">
                                          {occupant.contractType === 'ESTAGIARIO' ? (
                                            <div className="flex flex-wrap items-center gap-1">
                                              <span className="text-[11px] text-purple-800 font-mono font-bold">
                                                Estágio 24h
                                              </span>
                                              <span className="text-[10px] text-slate-400">
                                                Sem intervalo (4h)
                                              </span>
                                            </div>
                                          ) : (
                                            <>
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  handleToggleInlineLunchEditor(occupant)
                                                }
                                                aria-label={`Alterar horário de almoço de ${occupant.shortName}`}
                                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-mono font-semibold transition cursor-pointer ${
                                                  inlineLunchEmpId === occupant.id
                                                    ? 'bg-amber-200 text-amber-950 border-amber-400'
                                                    : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-200'
                                                }`}
                                                title="Clique para ajustar o horário de almoço direto na tela"
                                              >
                                                <Utensils className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                                                <span>
                                                  Almoço {occupant.defaultLunchStart || '12:00'}–
                                                  {occupant.defaultLunchEnd || '13:30'}
                                                </span>
                                              </button>

                                              {inlineLunchEmpId === occupant.id && (
                                                <div
                                                  data-inline-lunch-panel={occupant.id}
                                                  className="w-full mt-1 p-2 rounded-lg bg-amber-50/90 border border-amber-300 space-y-1.5 text-[10px]"
                                                >
                                                  <div className="flex items-center justify-between gap-1 font-bold text-amber-950">
                                                    <span>Intervalo</span>
                                                    <button
                                                      type="button"
                                                      onClick={() => setInlineLunchEmpId(null)}
                                                      aria-label="Fechar ajuste de almoço"
                                                      className="p-0.5 rounded hover:bg-amber-200 text-amber-800 cursor-pointer"
                                                    >
                                                      <X className="w-3 h-3" />
                                                    </button>
                                                  </div>

                                                  <div className="flex flex-wrap gap-1">
                                                    <button
                                                      type="button"
                                                      onClick={() => {
                                                        setLunchStartDraft('12:00');
                                                        setLunchEndDraft('13:30');
                                                      }}
                                                      className="px-1.5 py-0.5 rounded bg-white hover:bg-amber-100 border border-amber-300 text-amber-900 font-mono font-semibold cursor-pointer"
                                                    >
                                                      1h30
                                                    </button>
                                                    <button
                                                      type="button"
                                                      onClick={() => {
                                                        setLunchStartDraft('12:00');
                                                        setLunchEndDraft('13:00');
                                                      }}
                                                      className="px-1.5 py-0.5 rounded bg-white hover:bg-amber-100 border border-amber-300 text-amber-900 font-mono font-semibold cursor-pointer"
                                                    >
                                                      1h00
                                                    </button>
                                                  </div>

                                                  <div className="grid grid-cols-2 gap-1">
                                                    <div>
                                                      <label className="block text-[9px] text-amber-900 font-semibold">
                                                        Início
                                                      </label>
                                                      <input
                                                        type="time"
                                                        aria-label="Início do almoço"
                                                        value={lunchStartDraft}
                                                        onChange={(e) =>
                                                          setLunchStartDraft(e.target.value)
                                                        }
                                                        className="w-full px-1 py-0.5 bg-white border border-amber-300 rounded font-mono text-[10px] text-slate-900"
                                                      />
                                                    </div>
                                                    <div>
                                                      <label className="block text-[9px] text-amber-900 font-semibold">
                                                        Fim
                                                      </label>
                                                      <input
                                                        type="time"
                                                        aria-label="Fim do almoço"
                                                        value={lunchEndDraft}
                                                        onChange={(e) =>
                                                          setLunchEndDraft(e.target.value)
                                                        }
                                                        className="w-full px-1 py-0.5 bg-white border border-amber-300 rounded font-mono text-[10px] text-slate-900"
                                                      />
                                                    </div>
                                                  </div>

                                                  <div className="flex items-center gap-1 flex-wrap">
                                                    {[1, 2, 3, 4].map((w) => {
                                                      const active =
                                                        lunchWeeksDraft.includes(w);
                                                      return (
                                                        <button
                                                          key={w}
                                                          type="button"
                                                          onClick={() =>
                                                            setLunchWeeksDraft((prev) =>
                                                              prev.includes(w)
                                                                ? prev.length > 1
                                                                  ? prev.filter((x) => x !== w)
                                                                  : prev
                                                                : [...prev, w].sort(
                                                                    (a, b) => a - b
                                                                  )
                                                            )
                                                          }
                                                          className={`px-1.5 py-0.5 rounded border text-[9px] font-bold cursor-pointer ${
                                                            active
                                                              ? 'bg-amber-700 text-white border-amber-700'
                                                              : 'bg-white text-amber-900 border-amber-300'
                                                          }`}
                                                        >
                                                          S{w}
                                                        </button>
                                                      );
                                                    })}
                                                  </div>

                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      onUpdateEmployeeLunch(
                                                        occupant.id,
                                                        lunchStartDraft,
                                                        lunchEndDraft,
                                                        lunchWeeksDraft
                                                      );
                                                      setInlineLunchEmpId(null);
                                                    }}
                                                    className="w-full py-1 px-2 rounded bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] cursor-pointer"
                                                  >
                                                    Salvar Intervalo
                                                  </button>
                                                </div>
                                              )}
                                            </>
                                          )}

                                          {occupant.contractType !== 'LICENCA_MATERNIDADE' && (() => {
                                            const linkedPartners = (occupant.linkedFolgaIds || [])
                                              .map((id) => preparedEmployees.find((e) => e.id === id))
                                              .filter((e): e is Employee => Boolean(e));
                                            const eligiblePartners = preparedEmployees
                                              .filter(
                                                (e) =>
                                                  e.id !== occupant.id &&
                                                  e.contractType !== 'LICENCA_MATERNIDADE'
                                              )
                                              .sort((a, b) => {
                                                if (a.id === occupant.affinityPartnerId) return -1;
                                                if (b.id === occupant.affinityPartnerId) return 1;
                                                return a.shortName.localeCompare(b.shortName);
                                              });

                                            return (
                                              <>
                                                <button
                                                  type="button"
                                                  data-folga-link-toggle={occupant.id}
                                                  onClick={() =>
                                                    handleToggleFolgaLinkEditor(occupant)
                                                  }
                                                  aria-label={
                                                    linkedPartners.length > 0
                                                      ? `Gerenciar vínculo de folga de ${occupant.shortName}`
                                                      : `Vincular folga de ${occupant.shortName} com outro colaborador`
                                                  }
                                                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-semibold transition cursor-pointer max-w-full ${
                                                    inlineFolgaLinkEmpId === occupant.id
                                                      ? 'bg-indigo-200 text-indigo-950 border-indigo-400'
                                                      : linkedPartners.length > 0
                                                      ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border-indigo-300'
                                                      : 'bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-indigo-800 border-slate-200 hover:border-indigo-300'
                                                  }`}
                                                  title={
                                                    linkedPartners.length > 0
                                                      ? `Folga compartilhada em S1–S4 com: ${linkedPartners
                                                          .map((p) => p.shortName)
                                                          .join(', ')}`
                                                      : 'Vincular a outro colaborador para folgar nos mesmos dias (S1–S4)'
                                                  }
                                                >
                                                  <Link2 className="w-2.5 h-2.5 text-indigo-600 shrink-0" />
                                                  <span className="truncate">
                                                    {linkedPartners.length > 0
                                                      ? `Folga igual: ${linkedPartners
                                                          .map((p) => p.shortName)
                                                          .join(', ')}`
                                                      : 'Vincular folga'}
                                                  </span>
                                                </button>

                                                {inlineFolgaLinkEmpId === occupant.id && (
                                                  <div
                                                    data-folga-link-panel={occupant.id}
                                                    className="w-full mt-1 p-2 rounded-lg bg-indigo-50/95 border border-indigo-300 space-y-1.5 text-[10px]"
                                                  >
                                                    <div className="flex items-center justify-between gap-1 font-bold text-indigo-950">
                                                      <span>Folgar igual (S1–S4)</span>
                                                      <button
                                                        type="button"
                                                        onClick={() => setInlineFolgaLinkEmpId(null)}
                                                        aria-label="Fechar vínculo de folga"
                                                        className="p-0.5 rounded hover:bg-indigo-200 text-indigo-800 cursor-pointer"
                                                      >
                                                        <X className="w-3 h-3" />
                                                      </button>
                                                    </div>

                                                    {linkedPartners.length > 0 && (
                                                      <div className="flex flex-wrap items-center justify-between gap-1 bg-white/90 border border-indigo-200 rounded px-1.5 py-1">
                                                        <span className="text-[9.5px] font-semibold text-indigo-900 truncate">
                                                          Com:{' '}
                                                          {linkedPartners
                                                            .map((p) => p.shortName)
                                                            .join(', ')}
                                                        </span>
                                                        <button
                                                          type="button"
                                                          data-folga-unlink={occupant.id}
                                                          aria-label={`Desvincular folga de ${occupant.shortName}`}
                                                          onClick={() => {
                                                            onUnlinkFolgaPartner?.(occupant.id);
                                                            setInlineFolgaLinkEmpId(null);
                                                          }}
                                                          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-[9px] cursor-pointer shrink-0"
                                                        >
                                                          <Unlink className="w-2.5 h-2.5" />
                                                          <span>Desvincular</span>
                                                        </button>
                                                      </div>
                                                    )}

                                                    <div>
                                                      <label
                                                        htmlFor={`folga-link-select-${occupant.id}`}
                                                        className="block text-[9px] text-indigo-900 font-semibold mb-0.5"
                                                      >
                                                        Colaborador parceiro
                                                      </label>
                                                      <select
                                                        id={`folga-link-select-${occupant.id}`}
                                                        data-folga-link-select={occupant.id}
                                                        value={selectedLinkPartnerId}
                                                        onChange={(e) =>
                                                          setSelectedLinkPartnerId(e.target.value)
                                                        }
                                                        className="w-full px-1.5 py-1 bg-white border border-indigo-300 rounded text-[10px] font-semibold text-slate-900"
                                                      >
                                                        {eligiblePartners.map((p) => {
                                                          const isAff =
                                                            p.id === occupant.affinityPartnerId;
                                                          const isAlready =
                                                            occupant.linkedFolgaIds?.includes(p.id);
                                                          const storeTag =
                                                            p.defaultStore === 'LOJA_1'
                                                              ? 'L1'
                                                              : 'L2';
                                                          return (
                                                            <option key={p.id} value={p.id}>
                                                              {isAff ? '★ Afinidade: ' : ''}
                                                              {p.shortName} ({storeTag})
                                                              {isAlready ? ' ✓ vinculado' : ''}
                                                            </option>
                                                          );
                                                        })}
                                                      </select>
                                                    </div>

                                                    <div className="grid grid-cols-1 gap-1">
                                                      <button
                                                        type="button"
                                                        data-folga-link-follow-partner={occupant.id}
                                                        disabled={!selectedLinkPartnerId}
                                                        onClick={() => {
                                                          if (!selectedLinkPartnerId) return;
                                                          onLinkFolgaPartner?.(
                                                            occupant.id,
                                                            selectedLinkPartnerId,
                                                            true
                                                          );
                                                          setInlineFolgaLinkEmpId(null);
                                                        }}
                                                        className="w-full py-1 px-2 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[9.5px] cursor-pointer disabled:opacity-50"
                                                      >
                                                        Seguir folgas dele(a)
                                                      </button>
                                                      <button
                                                        type="button"
                                                        data-folga-link-apply-mine={occupant.id}
                                                        disabled={!selectedLinkPartnerId}
                                                        onClick={() => {
                                                          if (!selectedLinkPartnerId) return;
                                                          onLinkFolgaPartner?.(
                                                            occupant.id,
                                                            selectedLinkPartnerId,
                                                            false
                                                          );
                                                          setInlineFolgaLinkEmpId(null);
                                                        }}
                                                        className="w-full py-1 px-2 rounded bg-white hover:bg-indigo-100 text-indigo-900 border border-indigo-300 font-bold text-[9.5px] cursor-pointer disabled:opacity-50"
                                                      >
                                                        Aplicar minhas folgas
                                                      </button>
                                                    </div>
                                                  </div>
                                                )}

                                                {/* Botão e Painel Inline: Proibir folga paralela */}
                                                {(() => {
                                                  const noParallelPartners = (
                                                    occupant.noParallelFolgaIds || []
                                                  )
                                                    .map((id) =>
                                                      preparedEmployees.find((e) => e.id === id)
                                                    )
                                                    .filter((e): e is Employee => Boolean(e));

                                                  return (
                                                    <>
                                                      <button
                                                        type="button"
                                                        data-no-parallel-toggle={occupant.id}
                                                        onClick={() =>
                                                          handleToggleNoParallelEditor(occupant)
                                                        }
                                                        aria-label={
                                                          noParallelPartners.length > 0
                                                            ? `Gerenciar proibição de folga paralela de ${occupant.shortName}`
                                                            : `Proibir folga paralela de ${occupant.shortName} com outro colaborador`
                                                        }
                                                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-semibold transition cursor-pointer max-w-full ${
                                                          inlineNoParallelEmpId === occupant.id
                                                            ? 'bg-rose-200 text-rose-950 border-rose-400'
                                                            : noParallelPartners.length > 0
                                                            ? 'bg-rose-50 hover:bg-rose-100 text-rose-900 border-rose-300'
                                                            : 'bg-slate-50 hover:bg-rose-50 text-slate-700 hover:text-rose-800 border-slate-200 hover:border-rose-300'
                                                        }`}
                                                        title={
                                                          noParallelPartners.length > 0
                                                            ? `Não pode folgar nos mesmos dias (Seg–Sáb S1–S4) com: ${noParallelPartners
                                                                .map((p) => p.shortName)
                                                                .join(', ')}`
                                                            : 'Vincular proibição de folga em paralelo (Seg–Sáb S1–S4)'
                                                        }
                                                      >
                                                        <Ban className="w-2.5 h-2.5 text-rose-600 shrink-0" />
                                                        <span className="truncate">
                                                          {noParallelPartners.length > 0
                                                            ? `Sem paralela: ${noParallelPartners
                                                                .map((p) => p.shortName)
                                                                .join(', ')}`
                                                            : 'Proibir folga paralela'}
                                                        </span>
                                                      </button>

                                                      {inlineNoParallelEmpId === occupant.id && (
                                                        <div
                                                          data-no-parallel-panel={occupant.id}
                                                          className="w-full mt-1 p-2 rounded-lg bg-rose-50/95 border border-rose-300 space-y-1.5 text-[10px]"
                                                        >
                                                          <div className="flex items-center justify-between gap-1 font-bold text-rose-950">
                                                            <span>Proibir folga paralela</span>
                                                            <button
                                                              type="button"
                                                              onClick={() =>
                                                                setInlineNoParallelEmpId(null)
                                                              }
                                                              aria-label="Fechar proibição de folga paralela"
                                                              className="p-0.5 rounded hover:bg-rose-200 text-rose-800 cursor-pointer"
                                                            >
                                                              <X className="w-3 h-3" />
                                                            </button>
                                                          </div>

                                                          {noParallelPartners.length > 0 && (
                                                            <div className="flex flex-wrap items-center justify-between gap-1 bg-white/90 border border-rose-200 rounded px-1.5 py-1">
                                                              <span className="text-[9.5px] font-semibold text-rose-900 truncate">
                                                                Bloq.:{' '}
                                                                {noParallelPartners
                                                                  .map((p) => p.shortName)
                                                                  .join(', ')}
                                                              </span>
                                                              <button
                                                                type="button"
                                                                data-no-parallel-unlink={occupant.id}
                                                                aria-label={`Remover proibição de folga paralela de ${occupant.shortName}`}
                                                                onClick={() => {
                                                                  onUnlinkNoParallelFolga?.(
                                                                    occupant.id
                                                                  );
                                                                  setInlineNoParallelEmpId(null);
                                                                }}
                                                                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-300 font-bold text-[9px] cursor-pointer shrink-0"
                                                              >
                                                                <Unlink className="w-2.5 h-2.5" />
                                                                <span>Desvincular</span>
                                                              </button>
                                                            </div>
                                                          )}

                                                          <div>
                                                            <label
                                                              htmlFor={`no-parallel-select-${occupant.id}`}
                                                              className="block text-[9px] text-rose-900 font-semibold mb-0.5"
                                                            >
                                                              Não folgar junto com
                                                            </label>
                                                            <select
                                                              id={`no-parallel-select-${occupant.id}`}
                                                              data-no-parallel-select={occupant.id}
                                                              value={selectedNoParallelPartnerId}
                                                              onChange={(e) =>
                                                                setSelectedNoParallelPartnerId(
                                                                  e.target.value
                                                                )
                                                              }
                                                              className="w-full px-1.5 py-1 bg-white border border-rose-300 rounded text-[10px] font-semibold text-slate-900"
                                                            >
                                                              {eligiblePartners.map((p) => {
                                                                const isBlocked =
                                                                  occupant.noParallelFolgaIds?.includes(
                                                                    p.id
                                                                  );
                                                                return (
                                                                  <option key={p.id} value={p.id}>
                                                                    {p.shortName} (
                                                                    {p.defaultStore === 'LOJA_1'
                                                                      ? 'L1'
                                                                      : 'L2'}
                                                                    ){isBlocked ? ' • Bloq.' : ''}
                                                                  </option>
                                                                );
                                                              })}
                                                            </select>
                                                          </div>

                                                          <div className="flex flex-col gap-1">
                                                            <button
                                                              type="button"
                                                              data-no-parallel-apply-resolve={
                                                                occupant.id
                                                              }
                                                              disabled={!selectedNoParallelPartnerId}
                                                              onClick={() => {
                                                                if (!selectedNoParallelPartnerId)
                                                                  return;
                                                                onLinkNoParallelFolga?.(
                                                                  occupant.id,
                                                                  selectedNoParallelPartnerId,
                                                                  true
                                                                );
                                                                setInlineNoParallelEmpId(null);
                                                              }}
                                                              className="w-full py-1 px-2 rounded bg-rose-600 hover:bg-rose-700 text-white font-bold text-[9.5px] cursor-pointer disabled:opacity-50"
                                                            >
                                                              Vincular e separar conflitos
                                                            </button>
                                                            <button
                                                              type="button"
                                                              data-no-parallel-apply-only={
                                                                occupant.id
                                                              }
                                                              disabled={!selectedNoParallelPartnerId}
                                                              onClick={() => {
                                                                if (!selectedNoParallelPartnerId)
                                                                  return;
                                                                onLinkNoParallelFolga?.(
                                                                  occupant.id,
                                                                  selectedNoParallelPartnerId,
                                                                  false
                                                                );
                                                                setInlineNoParallelEmpId(null);
                                                              }}
                                                              className="w-full py-1 px-2 rounded bg-white hover:bg-rose-100 text-rose-900 border border-rose-300 font-bold text-[9.5px] cursor-pointer disabled:opacity-50"
                                                            >
                                                              Vincular (só bloquear)
                                                            </button>
                                                          </div>
                                                        </div>
                                                      )}
                                                    </>
                                                  );
                                                })()}
                                              </>
                                            );
                                          })()}
                                        </div>
                                      </div>
                                    </td>
                                  )}

                                  {/* Col 2: Indicador da Semana (S1..S4) */}
                                  <td className="py-1.5 px-1 text-center border-r border-slate-200 bg-slate-50">
                                    <span
                                      className={`inline-flex items-center justify-center px-1 py-0.5 rounded-none font-mono text-xs font-extrabold ${
                                        hasRealWeekViolation
                                          ? 'bg-rose-100 text-rose-800 border-rose-300'
                                          : weekDelta > 0.08 || (weekComp && weekComp.restDaysCount === 1 && currentPhase !== 'ATUAL')
                                          ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                                          : 'bg-white text-slate-700 border-slate-200'
                                      }`}
                                      title={`Semana ${weekNum}${
                                        monthlySummary?.offDaysByWeek[weekNum - 1]
                                          ? ` • Folgas: ${monthlySummary.offDaysByWeek[
                                              weekNum - 1
                                            ].join(', ')}`
                                          : ''
                                      }`}
                                    >
                                      S{weekNum}
                                    </span>
                                  </td>

                                  {/* Col 3..N: Dias Visíveis da Semana S{weekNum} */}
                                  {visibleDays.map((day) => {
                                    const shift = weekSched[day.key];
                                    const isWork = shift?.type === 'TRABALHO';
                                    const isLicenca = shift?.type === 'LICENCA';
                                    const isFolga = !isWork && !isLicenca;
                                    const dailyH = shift ? calculateDailyHours(shift) : 0;
                                    const cellKey = `${occupant.id}-${weekNum}-${day.key}`;
                                    const isDragOver = dragOverKey === cellKey;

                                    const effectiveChairId = shift?.chairId || occupant.defaultChairId;
                                    const sectorDef =
                                      SECTOR_DEFINITIONS.find((s) =>
                                        s.chairIds.includes(effectiveChairId)
                                      ) ||
                                      SECTOR_DEFINITIONS.find(
                                        (s) => s.departmentId === occupant.department
                                      );
                                    const sectorDayRes = weekCov.byDay[day.key]?.find(
                                      (r) => r.sector.id === sectorDef?.id
                                    );
                                    const isSectorUncovered = Boolean(
                                      sectorDayRes?.isUncovered && day.key !== 'DOM'
                                    );
                                    const autoSkillInfo =
                                      day.key !== 'DOM' && sectorDayRes
                                        ? sectorDayRes.autoCoveredByPeersOrSkills
                                        : [];
                                    const parallelConflicts =
                                      day.key !== 'DOM'
                                        ? checkParallelFolgaConflict(
                                            preparedEmployees,
                                            occupant.id,
                                            weekNum,
                                            day.key
                                          )
                                        : [];
                                    const hasParallelConflictHere =
                                      isFolga && parallelConflicts.length > 0;
                                    const isDragParallelBlocked =
                                      isDragOver && isWork && parallelConflicts.length > 0;

                                    return (
                                      <td
                                        key={day.key}
                                        data-day-cell={`${occupant.id}-S${weekNum}-${day.key}`}
                                        onDragOver={(e) => {
                                          if (
                                            canDropFolgaOnCell(
                                              dragPayload,
                                              occupant.id,
                                              weekNum,
                                              day.key,
                                              isWork,
                                              isLicenca
                                            )
                                          ) {
                                            e.preventDefault();
                                            e.dataTransfer.dropEffect = 'move';
                                            if (dragOverKey !== cellKey) {
                                              setDragOverKey(cellKey);
                                            }
                                          }
                                        }}
                                        onDragLeave={() => {
                                          if (dragOverKey === cellKey) {
                                            setDragOverKey(null);
                                          }
                                        }}
                                        onDrop={(e) => {
                                          e.preventDefault();
                                          setDragOverKey(null);
                                          if (isLicenca || !isWork) return;

                                          let parsed: FolgaDragPayload | null = dragPayload;
                                          try {
                                            const raw = e.dataTransfer.getData('application/json');
                                            if (raw) {
                                              parsed = JSON.parse(raw) as FolgaDragPayload;
                                            }
                                          } catch {
                                            // fallback to state payload
                                          }
                                          setDragPayload(null);

                                          if (!parsed) return;
                                          if (parsed.kind === 'NEW_FOLGA') {
                                            onMoveOrApplyFolga(occupant.id, weekNum, day.key);
                                          } else if (
                                            parsed.kind === 'MOVE_FOLGA' &&
                                            parsed.employeeId === occupant.id
                                          ) {
                                            onMoveOrApplyFolga(
                                              occupant.id,
                                              weekNum,
                                              day.key,
                                              parsed.sourceDay,
                                              parsed.sourceWeek
                                            );
                                          }
                                        }}
                                        className={`p-0 text-center border-l border-slate-200 align-stretch ${
                                          day.isWeekend ? 'bg-slate-100/60' : 'bg-white'
                                        }`}
                                      >
                                        <div
                                          draggable={isFolga}
                                          data-folga-draggable={isFolga ? 'true' : undefined}
                                          onDragStart={(e) => {
                                            if (!isFolga) return;
                                            const payload: FolgaDragPayload = {
                                              kind: 'MOVE_FOLGA',
                                              employeeId: occupant.id,
                                              sourceWeek: weekNum,
                                              sourceDay: day.key,
                                            };
                                            setDragPayload(payload);
                                            e.dataTransfer.effectAllowed = 'move';
                                            e.dataTransfer.setData(
                                              'application/json',
                                              JSON.stringify(payload)
                                            );
                                            e.dataTransfer.setData(
                                              'text/plain',
                                              `MOVE_FOLGA:${occupant.id}:${weekNum}:${day.key}`
                                            );
                                          }}
                                          onDragEnd={() => {
                                            setDragPayload(null);
                                            setDragOverKey(null);
                                          }}
                                          className={`group/cell relative h-full px-1.5 py-1.5 rounded-none border-b border-t-0 border-r-0 border-l-4 transition text-center select-none ${
                                            isInlineShiftOpenOnThisWeek &&
                                            inlineShiftDraft?.day === day.key
                                              ? 'ring-2 ring-inset ring-blue-600 border-l-blue-700 bg-blue-100'
                                              : isDragParallelBlocked
                                              ? 'ring-2 ring-inset ring-rose-600 border-l-rose-700 bg-rose-200 text-rose-950'
                                              : isDragOver
                                              ? 'ring-2 ring-inset ring-emerald-600 border-l-emerald-700 bg-emerald-200 text-emerald-950'
                                              : hasParallelConflictHere
                                              ? 'bg-rose-200 border-rose-500 border-l-rose-700 text-rose-950 hover:bg-rose-300/80 cursor-grab active:cursor-grabbing'
                                              : isLicenca
                                              ? 'bg-rose-300/85 border-rose-500 border-l-rose-800 text-rose-950'
                                              : isWork
                                              ? day.key === 'SAB'
                                                ? 'bg-sky-50/80 border-slate-200 border-l-indigo-600 text-slate-950 hover:bg-sky-100'
                                                : 'bg-white border-slate-200 border-l-blue-600 text-slate-950 hover:bg-blue-50/70'
                                              : 'bg-emerald-300/90 border-emerald-500 border-l-emerald-800 text-emerald-950 font-semibold hover:bg-emerald-400/80 cursor-grab active:cursor-grabbing'
                                          }`}
                                        >
                                          <div
                                            role="button"
                                            tabIndex={0}
                                            data-day-toggle={`${occupant.id}-S${weekNum}-${day.key}`}
                                            onClick={() =>
                                              handleToggleInlineShiftEditor(
                                                occupant,
                                                day.key,
                                                weekNum
                                              )
                                            }
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                handleToggleInlineShiftEditor(
                                                  occupant,
                                                  day.key,
                                                  weekNum
                                                );
                                              }
                                            }}
                                            aria-label={`Ajustar ${occupant.shortName} ${day.label} semana ${weekNum}: ${
                                              isWork
                                                ? `${shift?.startTime || ''} até ${shift?.endTime || ''}`
                                                : isLicenca
                                                ? 'Licença'
                                                : 'Folga'
                                            }`}
                                            className={`w-full text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded ${
                                              isFolga ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
                                            }`}
                                            title={
                                              isFolga && restDaysAtMinimum
                                                ? `Sem. ${weekNum} • Mínimo de 1 folga semanal. Arraste dentro desta semana ou toque para ajustar.`
                                                : isFolga
                                                ? `Sem. ${weekNum} • Arraste para outro dia (mesma semana ou S1–S4) ou toque para ajustar`
                                                : `Sem. ${weekNum} • Toque para ajustar horário direto na linha ou solte uma Folga aqui`
                                            }
                                          >
                                            {isLicenca ? (
                                              <div className="font-bold text-[10px] text-rose-700 py-0.5">
                                                Licença
                                              </div>
                                            ) : isWork ? (
                                              <div className="flex flex-col leading-tight py-0.5">
                                                <span className="font-bold text-[10px] tracking-tight text-slate-900 whitespace-nowrap">
                                                  {shift?.startTime && shift?.endTime
                                                    ? `${shift.startTime}–${shift.endTime}`
                                                    : 'Trabalho'}
                                                </span>
                                                <span className="text-[9.5px] font-mono font-semibold text-blue-700">
                                                  {formatHoursDecimal(dailyH)}
                                                </span>
                                                {day.key === 'SAB' &&
                                                  shift?.lunchStart &&
                                                  shift?.lunchEnd && (
                                                    <span
                                                      data-saturday-lunch-badge={`${occupant.id}-S${weekNum}`}
                                                      className="text-[8px] font-mono text-indigo-700/90 whitespace-nowrap"
                                                    >
                                                      Alm. {shift.lunchStart}–{shift.lunchEnd}
                                                    </span>
                                                  )}
                                              </div>
                                            ) : (
                                              <div className="flex flex-col py-0.5 items-center">
                                                <span
                                                  className={`inline-flex items-center gap-0.5 text-[10px] font-bold ${
                                                    isSectorUncovered
                                                      ? 'text-rose-600'
                                                      : 'text-emerald-800'
                                                  }`}
                                                >
                                                  <GripVertical className="w-2.5 h-2.5 text-emerald-500 shrink-0" />
                                                  <span>
                                                    {shift?.type === 'FOLGA_DSR' ? 'DSR' : 'Folga'}
                                                  </span>
                                                  {restDaysAtMinimum && (
                                                    <Lock className="w-2.5 h-2.5 text-emerald-600/80 shrink-0" />
                                                  )}
                                                </span>
                                              </div>
                                            )}
                                          </div>

                                          {hasParallelConflictHere && (
                                            <div
                                              data-parallel-conflict-badge={`${occupant.id}-S${weekNum}-${day.key}`}
                                              className="mt-0.5 px-1 py-0.5 rounded bg-rose-100 border border-rose-300 text-rose-800 text-[8.5px] font-black flex items-center justify-center gap-0.5 leading-tight"
                                              title={`Proibição de folga paralela violada: ${parallelConflicts
                                                .map((p) => p.shortName)
                                                .join(', ')} também folga neste dia (S${weekNum}).`}
                                            >
                                              <Ban className="w-2.5 h-2.5 shrink-0 text-rose-700" />
                                              <span className="truncate max-w-[74px]">
                                                Conflito: {parallelConflicts.map((p) => p.shortName).join(', ')}
                                              </span>
                                            </div>
                                          )}

                                          {/* Cobertura na folga (irmão fora do button principal) */}
                                          {!isLicenca && !isWork && (
                                            <div className="flex justify-center mt-0.5">
                                              {shift?.coverage ? (
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    setCoverageTarget({
                                                      employee: { ...occupant, schedule: weekSched },
                                                      day: day.key,
                                                      weekNumber: weekNum,
                                                    })
                                                  }
                                                  className="px-1 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300 text-[8.5px] font-bold flex items-center gap-0.5 hover:bg-emerald-200 transition cursor-pointer max-w-full"
                                                  title={`Coberto por: ${shift.coverage.coveredByName} (Sem. ${weekNum})`}
                                                >
                                                  <ShieldCheck className="w-2.5 h-2.5 text-emerald-700 shrink-0" />
                                                  <span className="truncate max-w-[58px]">
                                                    {shift.coverage.coveredByName.split(' ')[0]}
                                                  </span>
                                                </button>
                                              ) : isSectorUncovered ? (
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    setCoverageTarget({
                                                      employee: { ...occupant, schedule: weekSched },
                                                      day: day.key,
                                                      weekNumber: weekNum,
                                                    })
                                                  }
                                                  className="px-1 py-0.5 rounded bg-rose-100 hover:bg-rose-200 text-rose-900 border border-rose-300 text-[8.5px] font-black flex items-center gap-0.5 transition cursor-pointer"
                                                  title={`Posto descoberto na Semana ${weekNum}! Clique para designar cobertura.`}
                                                >
                                                  <AlertTriangle className="w-2.5 h-2.5 text-rose-700 shrink-0" />
                                                  <span>Descoberto</span>
                                                </button>
                                              ) : autoSkillInfo.length > 0 &&
                                                !autoSkillInfo[0].label.startsWith('Rodízio') ? (
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    setCoverageTarget({
                                                      employee: { ...occupant, schedule: weekSched },
                                                      day: day.key,
                                                      weekNumber: weekNum,
                                                    })
                                                  }
                                                  className="px-1 py-0.5 rounded bg-teal-50 hover:bg-teal-100 text-teal-900 border border-teal-300 text-[8.5px] font-bold flex items-center gap-0.5 transition cursor-pointer max-w-full"
                                                  title={`Coberto automaticamente por colega ativo: ${autoSkillInfo
                                                    .map((c) => c.label)
                                                    .join(', ')} (Sem. ${weekNum}). Clique para personalizar cobertura.`}
                                                >
                                                  <UserCheck className="w-2.5 h-2.5 text-teal-700 shrink-0" />
                                                  <span className="truncate max-w-[58px]">
                                                    {autoSkillInfo[0].label.startsWith('Rodízio')
                                                      ? `Rod: ${autoSkillInfo[0].employeeName}`
                                                      : `Hab: ${autoSkillInfo[0].employeeName}`}
                                                  </span>
                                                </button>
                                              ) : (
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    setCoverageTarget({
                                                      employee: { ...occupant, schedule: weekSched },
                                                      day: day.key,
                                                      weekNumber: weekNum,
                                                    })
                                                  }
                                                  className="opacity-0 group-hover/cell:opacity-100 focus:opacity-100 text-[8.5px] text-blue-600 hover:text-blue-800 font-semibold cursor-pointer transition hover:underline"
                                                  title="Setor atendido por colegas da mesma função. Clique se quiser designar cobertura extra."
                                                >
                                                  + Cobrir
                                                </button>
                                              )}
                                            </div>
                                          )}

                                          {/* Botão de Edição Inline */}
                                          <button
                                            type="button"
                                            aria-label={`Editar turno de ${occupant.shortName} na ${day.label} semana ${weekNum}`}
                                            onClick={() =>
                                              handleToggleInlineShiftEditor(
                                                occupant,
                                                day.key,
                                                weekNum
                                              )
                                            }
                                            className="absolute top-0.5 right-0.5 opacity-0 group-hover/cell:opacity-100 focus:opacity-100 p-0.5 rounded bg-white hover:bg-slate-200 text-slate-700 transition shadow-xs border border-slate-200 cursor-pointer"
                                            title={`Ajustar horário direto na Semana ${weekNum}`}
                                          >
                                            <Edit2 className="w-2.5 h-2.5" />
                                          </button>
                                        </div>
                                      </td>
                                    );
                                  })}

                                  {/* Col 10: Total da Semana & Acúmulo Progressivo (S1 -> S{weekNum}) */}
                                  <td className="py-1.5 px-1.5 text-center border-l border-slate-100">
                                    <div className="flex flex-col items-center leading-tight gap-0.5">
                                      <div className="flex items-center gap-1 font-mono text-[11px] font-black">
                                        <span
                                          className={
                                            hasRealWeekViolation
                                              ? 'text-rose-600'
                                              : 'text-slate-900'
                                          }
                                        >
                                          {formatHoursDecimal(weekHours)}
                                        </span>
                                        <span className="text-slate-400 text-[9px] font-normal">
                                          ({weekComp?.workDaysCount ?? 0}d)
                                        </span>
                                      </div>

                                      <div className="flex items-center gap-1 flex-wrap justify-center">
                                        <span
                                          className={`px-1 py-0.2 rounded font-mono text-[9px] font-bold whitespace-nowrap ${
                                            weekDelta < -0.08
                                              ? 'bg-amber-100 text-amber-900'
                                              : weekDelta > 0.08
                                              ? 'bg-blue-100 text-blue-900'
                                              : 'bg-emerald-100 text-emerald-800'
                                          }`}
                                          title={`Diferença da Semana ${weekNum} contra a meta semanal`}
                                        >
                                          {Math.abs(weekDelta) < 0.08 ? 'OK' : formatSigned(weekDelta)}
                                        </span>

                                        <span
                                          className={`px-1 py-0.2 rounded font-mono text-[9px] font-semibold border whitespace-nowrap ${
                                            accumBalance < -0.08
                                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                                              : accumBalance > 0.08
                                              ? 'bg-blue-50 text-blue-800 border-blue-200'
                                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                          }`}
                                          title={`Acúmulo progressivo de S1 até S${weekNum}: ${formatSigned(
                                            accumBalance
                                          )}`}
                                        >
                                          Ac: {formatSigned(accumBalance)}
                                        </span>

                                        {pmSummary?.isEligibleForBanco && pmWeek && (
                                          <span
                                            data-pontomais-week-bh={`${occupant.id}-S${weekNum}`}
                                            className={`px-1 py-0.2 rounded font-mono text-[8.5px] font-bold border whitespace-nowrap ${
                                              pmWeek.weeklyNetBancoHours > 0.08
                                                ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                                                : pmWeek.weeklyNetBancoHours < -0.08
                                                ? 'bg-amber-50 text-amber-900 border-amber-200'
                                                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                            }`}
                                            title={`Banco de Horas PontoMais (S${weekNum}): Real ${formatHoursDecimal(
                                              pmWeek.realWeeklyHours
                                            )} vs Padrão PM ${formatHoursDecimal(
                                              pmWeek.pontoMaisWeeklyHours
                                            )} • Créd. extras +${formatHoursDecimal(
                                              pmWeek.weeklyCreditHours
                                            )} / Déb. -${formatHoursDecimal(
                                              pmWeek.weeklyDebitHours
                                            )}`}
                                          >
                                            BH: {formatSigned(pmWeek.weeklyNetBancoHours)}
                                          </span>
                                        )}
                                      </div>

                                      {hasRealWeekViolation ? (
                                          <span
                                            className="text-[8.5px] font-bold text-rose-700"
                                            title={weekComp?.violations
                                              .map((v) => v.message)
                                              .join(' | ')}
                                          >
                                            Violação CLT
                                          </span>
                                        ) : weekDelta > 0.08 ? (
                                          <span
                                            className="text-[8.5px] font-semibold text-blue-700"
                                            title="Excedente acima da meta semanal compensável em outra semana do mês"
                                          >
                                            Comp. Mês
                                          </span>
                                        ) : weekComp && weekComp.restDaysCount === 1 && currentPhase !== 'ATUAL' ? (
                                          <span
                                            className="text-[8.5px] font-semibold text-indigo-700"
                                            title="1 folga nesta semana (folga extra compensada em outra semana)"
                                          >
                                            1 folga (comp.)
                                          </span>
                                        ) : null}
                                    </div>
                                  </td>

                                  {/* Col 11: Resumo Mensal Automático (S1-S4) — rowSpan */}
                                  {isFirstRow && (
                                    <td
                                      rowSpan={empRowSpan}
                                      className="py-2 px-2 text-center align-middle bg-slate-50/40 border-l border-slate-200"
                                    >
                                      {monthlySummary ? (
                                        <div className="flex flex-col items-center gap-1.5">
                                          <div className="font-mono text-xs font-black text-slate-900 whitespace-nowrap">
                                            {formatHoursDecimal(monthlySummary.totalMonthlyHours)}
                                            <span className="text-[10px] text-slate-400 font-normal">
                                              /{formatHoursDecimal(monthlySummary.monthlyTargetHours)}
                                            </span>
                                          </div>

                                          <span
                                            className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold border whitespace-nowrap ${
                                              monthlySummary.monthlyBalanceHours < -0.08
                                                ? 'bg-amber-50 text-amber-900 border-amber-300'
                                                : monthlySummary.monthlyBalanceHours > 0.08
                                                ? 'bg-blue-50 text-blue-800 border-blue-300'
                                                : 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                            }`}
                                          >
                                            {monthlySummary.monthlyBalanceHours < -0.08
                                              ? `Mês -${formatHoursDecimal(
                                                  Math.abs(monthlySummary.monthlyBalanceHours)
                                                )}`
                                              : monthlySummary.monthlyBalanceHours > 0.08
                                              ? `Mês +${formatHoursDecimal(
                                                  monthlySummary.monthlyBalanceHours
                                                )}`
                                              : 'Mês Fechado'}
                                          </span>

                                          {monthlySummary.compensatedHours > 0.08 && (
                                            <span
                                              className="text-[9px] font-mono text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded whitespace-nowrap"
                                              title="Horas compensadas automaticamente entre semanas dentro do mês"
                                            >
                                              Compens.: {formatHoursDecimal(monthlySummary.compensatedHours)}
                                            </span>
                                          )}

                                          <div className="text-[9.5px] text-slate-500 font-mono">
                                            Média {formatHoursDecimal(monthlySummary.averageWeeklyHours)}/sem
                                          </div>

                                          {pmSummary?.isEligibleForBanco && (
                                            <div
                                              data-pontomais-month-bh={occupant.id}
                                              className={`w-full px-1.5 py-0.5 rounded border text-[9px] font-mono font-bold leading-tight ${
                                                pmSummary.netBancoHoursMonth > 0.08
                                                  ? 'bg-indigo-50 text-indigo-900 border-indigo-200'
                                                  : pmSummary.netBancoHoursMonth < -0.08
                                                  ? 'bg-amber-50 text-amber-900 border-amber-200'
                                                  : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                              }`}
                                              title={`PontoMais fechado em ${formatHoursDecimal(
                                                pmSummary.pontoMaisWeeklyHours
                                              )}/sem (${formatHoursDecimal(
                                                pmSummary.pontoMaisMonthlyHours
                                              )}/mês). Créd. extras diários: +${formatHoursDecimal(
                                                pmSummary.totalDailyCreditsMonth
                                              )} | Compensações: -${formatHoursDecimal(
                                                pmSummary.totalDailyDebitsMonth
                                              )}`}
                                            >
                                              <div>BH PM: {formatSigned(pmSummary.netBancoHoursMonth)}</div>
                                              <div className="text-[8px] font-normal opacity-85">
                                                +{formatHoursDecimal(pmSummary.totalDailyCreditsMonth)} HE / -
                                                {formatHoursDecimal(pmSummary.totalDailyDebitsMonth)} comp
                                              </div>
                                            </div>
                                          )}

                                          {monthlySummary.status === 'CONFORME' && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[9.5px] font-semibold border border-emerald-200">
                                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                              Conforme
                                            </span>
                                          )}
                                          {monthlySummary.status === 'COMPENSANDO' && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 text-[9.5px] font-semibold border border-amber-200">
                                              <Clock className="w-3 h-3 text-amber-600" />
                                              Saldo Dev.
                                            </span>
                                          )}
                                          {monthlySummary.status === 'HORAS_EXTRAS' && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 text-[9.5px] font-semibold border border-blue-200">
                                              <Clock className="w-3 h-3 text-blue-600" />
                                              Saldo + / HE
                                            </span>
                                          )}
                                          {monthlySummary.status === 'VIOLACAO' && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-800 text-[9.5px] font-semibold border border-rose-200">
                                              <AlertCircle className="w-3 h-3 text-rose-600" />
                                              Violação
                                            </span>
                                          )}
                                        </div>
                                      ) : (
                                        <span className="text-slate-400 text-xs">&mdash;</span>
                                      )}
                                    </td>
                                  )}
                                </tr>

                                {/* Linha Inline de Edição Direta do Dia/Turno (sem abrir modal) */}
                                {isInlineShiftOpenOnThisWeek && inlineShiftDraft && (() => {
                                  const draftDayInfo = DAYS_OF_WEEK.find(
                                    (d) => d.key === inlineShiftDraft.day
                                  );
                                  const draftDayIdx = DAYS_OF_WEEK.findIndex(
                                    (d) => d.key === inlineShiftDraft.day
                                  );
                                  const canWork = canReplaceRestDayWithWork(
                                    weekSched,
                                    inlineShiftDraft.day,
                                    occupant.contractType
                                  );
                                  const draftGrossMinutes = getGrossShiftMinutes(
                                    inlineShiftDraft.startTime,
                                    inlineShiftDraft.endTime
                                  );
                                  const isInternDraft = occupant.contractType === 'ESTAGIARIO';
                                  const includeLunchInDraft =
                                    inlineShiftDraft.type === 'TRABALHO' &&
                                    !isInternDraft &&
                                    (inlineShiftDraft.day !== 'SAB' || draftGrossMinutes > 360);

                                  const simulated: DayShift = {
                                    day: inlineShiftDraft.day,
                                    type: inlineShiftDraft.type,
                                    chairId: inlineShiftDraft.chairId,
                                    startTime:
                                      inlineShiftDraft.type === 'TRABALHO'
                                        ? inlineShiftDraft.startTime
                                        : undefined,
                                    lunchStart: includeLunchInDraft
                                      ? inlineShiftDraft.lunchStart
                                      : undefined,
                                    lunchEnd: includeLunchInDraft
                                      ? inlineShiftDraft.lunchEnd
                                      : undefined,
                                    endTime:
                                      inlineShiftDraft.type === 'TRABALHO'
                                        ? inlineShiftDraft.endTime
                                        : undefined,
                                  };
                                  const draftDailyH = calculateDailyHours(simulated);
                                  const interPrev =
                                    draftDayIdx > 0
                                      ? calculateInterjornadaRest(
                                          weekSched[DAYS_OF_WEEK[draftDayIdx - 1].key],
                                          simulated
                                        )
                                      : null;
                                  const interNext =
                                    draftDayIdx < DAYS_OF_WEEK.length - 1
                                      ? calculateInterjornadaRest(
                                          simulated,
                                          weekSched[DAYS_OF_WEEK[draftDayIdx + 1].key]
                                        )
                                      : null;
                                  const interInvalid = Boolean(
                                    (interPrev && !interPrev.valid) || (interNext && !interNext.valid)
                                  );
                                  const inlineParallelConflicts =
                                    inlineShiftDraft.day !== 'DOM'
                                      ? checkParallelFolgaConflict(
                                          preparedEmployees,
                                          occupant.id,
                                          weekNum,
                                          inlineShiftDraft.day
                                        )
                                      : [];
                                  const blockParallelFolga = inlineParallelConflicts.length > 0;

                                  const buildLabel = () => {
                                    if (inlineShiftDraft.type === 'TRABALHO') {
                                      return `${inlineShiftDraft.startTime}–${inlineShiftDraft.endTime}`;
                                    }
                                    if (inlineShiftDraft.type === 'FOLGA_DSR') return 'DSR';
                                    if (inlineShiftDraft.type === 'LICENCA') return 'Licença';
                                    return 'Folga 5x2';
                                  };

                                  return (
                                    <tr
                                      data-inline-shift-editor={`${occupant.id}-S${weekNum}-${inlineShiftDraft.day}`}
                                      className="bg-blue-50/70 border-t border-blue-200"
                                    >
                                      <td colSpan={2 + visibleDays.length} className="p-2.5">
                                        <div className="bg-white border border-blue-200 rounded-xl p-2.5 shadow-2xs space-y-2 text-[11px]">
                                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-1.5">
                                            <div className="flex flex-wrap items-center gap-2 font-bold text-slate-900">
                                              <Clock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                              <span>
                                                Ajuste Direto: {occupant.shortName} &bull;{' '}
                                                {draftDayInfo?.label} (S{weekNum})
                                              </span>
                                              <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10px]">
                                                {occupant.defaultStore === 'LOJA_1'
                                                  ? 'Loja 1 Matriz'
                                                  : 'Loja 2 Filial'}
                                              </span>
                                              {inlineShiftDraft.type === 'TRABALHO' && (
                                                <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-900 font-mono font-black text-[10px]">
                                                  Carga: {formatHoursDecimal(draftDailyH)}
                                                </span>
                                              )}
                                            </div>
                                            <button
                                              type="button"
                                              onClick={() => setInlineShiftDraft(null)}
                                              aria-label="Fechar ajuste direto"
                                              className="p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-800 cursor-pointer"
                                            >
                                              <X className="w-3.5 h-3.5" />
                                            </button>
                                          </div>

                                          <div className="flex flex-wrap items-end gap-2.5">
                                            {/* Status no dia */}
                                            <div className="flex items-center gap-1">
                                              <button
                                                type="button"
                                                disabled={!canWork.allowed}
                                                onClick={() => {
                                                  if (canWork.allowed) {
                                                    setInlineShiftDraft({
                                                      ...inlineShiftDraft,
                                                      type: 'TRABALHO',
                                                    });
                                                  }
                                                }}
                                                className={`px-2 py-1 rounded-lg border font-bold text-[10px] whitespace-nowrap ${
                                                  !canWork.allowed
                                                    ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                                                    : inlineShiftDraft.type === 'TRABALHO'
                                                    ? 'bg-blue-600 text-white border-blue-600 cursor-pointer'
                                                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 cursor-pointer'
                                                }`}
                                                title={!canWork.allowed ? canWork.reason : undefined}
                                              >
                                                Trabalho
                                              </button>
                                              <button
                                                type="button"
                                                disabled={blockParallelFolga}
                                                data-inline-folga-blocked={
                                                  blockParallelFolga ? 'true' : undefined
                                                }
                                                onClick={() => {
                                                  if (blockParallelFolga) return;
                                                  setInlineShiftDraft({
                                                    ...inlineShiftDraft,
                                                    type: 'FOLGA_5X2',
                                                  });
                                                }}
                                                title={
                                                  blockParallelFolga
                                                    ? `Proibido: ${inlineParallelConflicts
                                                        .map((p) => p.shortName)
                                                        .join(', ')} já está de folga neste dia (S${weekNum}).`
                                                    : 'Definir Folga 5x2 neste dia'
                                                }
                                                className={`px-2 py-1 rounded-lg border font-bold text-[10px] whitespace-nowrap ${
                                                  blockParallelFolga
                                                    ? 'bg-rose-50 text-rose-400 border-rose-200 cursor-not-allowed opacity-75'
                                                    : inlineShiftDraft.type === 'FOLGA_5X2'
                                                    ? 'bg-emerald-600 text-white border-emerald-600 cursor-pointer'
                                                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 cursor-pointer'
                                                }`}
                                              >
                                                {blockParallelFolga ? 'Folga Bloqueada' : 'Folga 5x2'}
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  setInlineShiftDraft({
                                                    ...inlineShiftDraft,
                                                    type: 'FOLGA_DSR',
                                                  })
                                                }
                                                className={`px-2 py-1 rounded-lg border font-bold text-[10px] cursor-pointer whitespace-nowrap ${
                                                  inlineShiftDraft.type === 'FOLGA_DSR'
                                                    ? 'bg-indigo-600 text-white border-indigo-600'
                                                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                                                }`}
                                              >
                                                DSR
                                              </button>
                                            </div>

                                            {inlineShiftDraft.type === 'TRABALHO' && (
                                              <>
                                                <div>
                                                  <label className="block text-[9.5px] font-bold text-slate-600 mb-0.5">
                                                    Entrada
                                                  </label>
                                                  <input
                                                    type="time"
                                                    value={inlineShiftDraft.startTime}
                                                    onChange={(e) =>
                                                      setInlineShiftDraft({
                                                        ...inlineShiftDraft,
                                                        startTime: e.target.value,
                                                      })
                                                    }
                                                    className="px-2 py-1 bg-slate-50 border border-slate-300 rounded font-mono text-[11px] font-bold text-slate-900"
                                                  />
                                                </div>
                                                <div>
                                                  <label className="block text-[9.5px] font-bold text-slate-600 mb-0.5">
                                                    Saída
                                                  </label>
                                                  <input
                                                    type="time"
                                                    value={inlineShiftDraft.endTime}
                                                    onChange={(e) =>
                                                      setInlineShiftDraft({
                                                        ...inlineShiftDraft,
                                                        endTime: e.target.value,
                                                      })
                                                    }
                                                    className="px-2 py-1 bg-slate-50 border border-slate-300 rounded font-mono text-[11px] font-bold text-slate-900"
                                                  />
                                                </div>
                                                 {includeLunchInDraft && (
                                                  <>
                                                    <div>
                                                      <label className="block text-[9.5px] font-bold text-slate-600 mb-0.5">
                                                        Almoço Início
                                                        {inlineShiftDraft.day === 'SAB' && (
                                                          <span className="ml-1 text-[8.5px] text-indigo-700 font-semibold">
                                                            (&gt;6h)
                                                          </span>
                                                        )}
                                                      </label>
                                                      <input
                                                        type="time"
                                                        aria-label="Almoço Início"
                                                        value={inlineShiftDraft.lunchStart}
                                                        onChange={(e) =>
                                                          setInlineShiftDraft({
                                                            ...inlineShiftDraft,
                                                            lunchStart: e.target.value,
                                                          })
                                                        }
                                                        className="px-2 py-1 bg-slate-50 border border-slate-300 rounded font-mono text-[11px] text-slate-900"
                                                      />
                                                    </div>
                                                    <div>
                                                      <label className="block text-[9.5px] font-bold text-slate-600 mb-0.5">
                                                        Almoço Fim
                                                      </label>
                                                      <input
                                                        type="time"
                                                        aria-label="Almoço Fim"
                                                        value={inlineShiftDraft.lunchEnd}
                                                        onChange={(e) =>
                                                          setInlineShiftDraft({
                                                            ...inlineShiftDraft,
                                                            lunchEnd: e.target.value,
                                                          })
                                                        }
                                                        className="px-2 py-1 bg-slate-50 border border-slate-300 rounded font-mono text-[11px] text-slate-900"
                                                      />
                                                    </div>
                                                  </>
                                                )}

                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    const sc =
                                                      storeHours[occupant.defaultStore] ||
                                                      DEFAULT_STORE_HOURS[occupant.defaultStore];
                                                    const nextStart =
                                                      inlineShiftDraft.day === 'SAB'
                                                        ? sc.saturdayOpen
                                                        : sc.weekdayOpen;
                                                    const nextEnd =
                                                      inlineShiftDraft.day === 'SAB'
                                                        ? sc.saturdayClose
                                                        : sc.weekdayClose;
                                                    const resolved = resolveLunchWindowForShift(
                                                      occupant,
                                                      nextStart,
                                                      nextEnd
                                                    );
                                                    setInlineShiftDraft({
                                                      ...inlineShiftDraft,
                                                      startTime: nextStart,
                                                      endTime: nextEnd,
                                                      lunchStart: resolved.lunchStart,
                                                      lunchEnd: resolved.lunchEnd,
                                                    });
                                                  }}
                                                  className="px-2 py-1 rounded border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-800 font-semibold text-[10px] cursor-pointer whitespace-nowrap"
                                                >
                                                  Usar Padrão da Loja
                                                </button>
                                              </>
                                            )}

                                            <div className="flex items-center gap-1.5 ml-auto">
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  onUpdateShift(
                                                    occupant.id,
                                                    inlineShiftDraft.day,
                                                    { ...simulated, label: buildLabel() },
                                                    weekNum
                                                  );
                                                  setInlineShiftDraft(null);
                                                }}
                                                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] cursor-pointer whitespace-nowrap"
                                              >
                                                Aplicar S{weekNum}
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  onUpdateShift(
                                                    occupant.id,
                                                    inlineShiftDraft.day,
                                                    { ...simulated, label: buildLabel() },
                                                    [1, 2, 3, 4]
                                                  );
                                                  setInlineShiftDraft(null);
                                                }}
                                                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-bold text-[10px] cursor-pointer whitespace-nowrap"
                                              >
                                                Aplicar S1–S4
                                              </button>
                                            </div>
                                          </div>

                                          {blockParallelFolga && (
                                            <div className="bg-rose-50 border border-rose-200 rounded-lg px-2.5 py-1.5 text-[10px] text-rose-800 font-semibold flex items-center gap-1.5">
                                              <Ban className="w-3.5 h-3.5 shrink-0 text-rose-600" />
                                              <span>
                                                Proibição de folga paralela ativa:{' '}
                                                <strong>
                                                  {inlineParallelConflicts
                                                    .map((p) => p.shortName)
                                                    .join(', ')}
                                                </strong>{' '}
                                                já folga neste dia (S{weekNum}).
                                              </span>
                                            </div>
                                          )}

                                          {interInvalid && (
                                            <div className="text-[10px] text-rose-700 font-semibold flex items-center gap-1">
                                              <AlertTriangle className="w-3 h-3 shrink-0" />
                                              <span>
                                                Atenção Art. 66 CLT: intervalo interjornada inferior a 11h com dia adjacente.
                                              </span>
                                            </div>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })()}
                                </React.Fragment>
                              );
                            });
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
            );
          })
          .filter(Boolean);

        if (renderedStores.length === 0) {
          return (
            <div
              data-empty-filter-state="true"
              className="bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-xs space-y-2.5"
            >
              <p className="text-sm font-bold text-slate-800">
                Nenhum colaborador ou setor corresponde aos filtros atuais.
              </p>
              <p className="text-xs text-slate-500">
                Ajuste os filtros de loja, setor, colaborador ou busca para visualizar a grade.
              </p>
              {onClearFilters && (
                <button
                  type="button"
                  onClick={onClearFilters}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Limpar filtros</span>
                </button>
              )}
            </div>
          );
        }

        return renderedStores;
      })()}

      {/* Modal de Designação de Cobertura */}
      {coverageTarget && (
        <CoverageAssignModal
          isOpen={Boolean(coverageTarget)}
          onClose={() => setCoverageTarget(null)}
          employee={coverageTarget.employee}
          day={coverageTarget.day}
          allEmployees={getWeekEmployees(coverageTarget.weekNumber)}
          sectorMinimums={sectorMinimums}
          onSaveCoverage={(empId, day, cov) => {
            onUpdateShift(empId, day, { coverage: cov }, coverageTarget.weekNumber);
          }}
        />
      )}

      {/* Modal de Equilíbrio de Horas / Acúmulo Mensal */}
      {balanceTarget && (
        <BalanceHoursModal
          isOpen={Boolean(balanceTarget)}
          onClose={() => setBalanceTarget(null)}
          employee={balanceTarget.employee}
          activeWeekIndex={balanceTarget.weekNumber}
          currentPhase={currentPhase}
          monthlySummary={monthlySummaryMap[balanceTarget.employee.id]}
          onSaveEmployee={(updated, scope, targetWeekNumber) => {
            if (!onBatchUpdateEmployees) return;
            if (scope === 'ALL_WEEKS') {
              onBatchUpdateEmployees(
                preparedEmployees.map((e) => (e.id === updated.id ? updated : e)),
                'ALL_WEEKS'
              );
            } else {
              const wTarget = targetWeekNumber || balanceTarget.weekNumber;
              onBatchUpdateEmployees(
                preparedEmployees.map((e) =>
                  e.id === updated.id ? { ...updated, schedule: updated.schedule } : e
                ),
                'SINGLE_WEEK',
                [wTarget]
              );
            }
          }}
        />
      )}
    </div>
  );
};
