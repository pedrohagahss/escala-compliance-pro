import {
  DayOfWeek,
  DayShift,
  DepartmentId,
  Employee,
  Scenario,
  StoreHoursMap,
} from '../types/schedule';
import {
  calculateDailyHours,
  calculateEmployeeMonthlySummary,
  calculateWeeklyHours,
  checkMonthlyTeamOperationalAndAffinities,
  DEFAULT_STORE_HOURS,
  ensureEmployeeWeeksSchedule,
  parseTimeToMinutes,
} from './compliance';
import { calculateWeeklyCoverageSummary, DEFAULT_SECTOR_MINIMUMS } from './coverage';
import { getDefaultPontoMaisConfig } from './pontoMais';

export const OPTIMIZED_SCENARIO_IDS = {
  TRAD_5050: 'scen-opt-trad-5050',
  TRAD_3SAB: 'scen-opt-trad-3sab',
  CENB_5050: 'scen-opt-b-est-5050',
  CENB_3SAB: 'scen-opt-b-est-3sab',
} as const;

export const DEFAULT_ACTIVE_OPTIMIZED_SCENARIO_ID = OPTIMIZED_SCENARIO_IDS.TRAD_5050;

type ShiftWindow = {
  startTime: string;
  lunchStart: string;
  lunchEnd: string;
  endTime: string;
};

type EmployeeCyclePlan = {
  satOffWeeks: number[];
  weekdayOffByWeek: Partial<Record<1 | 2 | 3 | 4, 'SEG' | 'TER' | 'QUA' | 'QUI' | 'SEX'>>;
  closingWeeks?: boolean; // No Cenário B (08:00–18:00), alterna Abertura vs Fechamento (ambos 8h24)
  closingShiftWindow?: ShiftWindow;
  openingShiftWindow?: ShiftWindow;
  saturdayChairByWeek?: Partial<Record<1 | 2 | 3 | 4, string>>;
};

export interface ProlongedWeekendRecord {
  employeeId: string;
  shortName: string;
  department: DepartmentId;
  transitionLabel: string; // ex: "Sáb S1 → Dom S1 → Seg S2"
}

export interface ScenarioSectorHeadcountRow {
  sectorId: string;
  sectorTitle: string;
  weekdayMin: number;
  saturdayMin: number;
  minObservedWeekday: number;
  maxObservedWeekday: number;
  minObservedSaturday: number;
  maxObservedSaturday: number;
  uncoveredCount: number;
}

export interface ScenarioAnalysisMetrics {
  scenarioId: string;
  maxDailyHoursObserved: number;
  maxDailyMinutesObserved: number;
  within8h24Cap: boolean;
  avgWeeklyHoursClt: number;
  avgMonthlyHoursClt: number;
  utilization42hPct: number;
  minMonthlyHoursClt: number;
  maxMonthlyHoursClt: number;
  rotatingCltCount: number;
  complianceErrorCount: number;
  operationalWarningCount: number;
  uncoveredSectorsTotal: number;
  saturdayAvgActiveClt: number;
  saturdayAvgTotalActive: number;
  thursdayAvgPct: number;
  fridayAvgPct: number;
  mondayAvgPct: number;
  prolongedWeekendsCount: number;
  employeesWithProlongedWeekend: number;
  prolongedWeekends: ProlongedWeekendRecord[];
  sectorCoverageRows: ScenarioSectorHeadcountRow[];
  storeHoursSummary: string;
}

// Janelas exatas de 8h24 líquidos (504 min) dentro do horário padrão (08:00–17:30)
// Abertura: 08:00–17:24 c/ 1h00 almoço = 8h24
// Fechamento Zeladoria/Apoio: 08:06–17:30 c/ 1h00 almoço = 8h24
const TRAD_OPEN_L1: Record<number, ShiftWindow> = {
  0: { startTime: '08:00', lunchStart: '11:30', lunchEnd: '12:30', endTime: '17:24' },
  1: { startTime: '08:00', lunchStart: '12:00', lunchEnd: '13:00', endTime: '17:24' },
  2: { startTime: '08:00', lunchStart: '12:30', lunchEnd: '13:30', endTime: '17:24' },
  3: { startTime: '08:00', lunchStart: '13:00', lunchEnd: '14:00', endTime: '17:24' },
};

const TRAD_CLOSE_530: ShiftWindow = {
  startTime: '08:06',
  lunchStart: '12:30',
  lunchEnd: '13:30',
  endTime: '17:30',
};

// Janelas exatas de 8h24 líquidos (504 min) para Cenário B Estendido (08:00–18:00 Seg–Sex / 08:00–14:00 Sáb)
const CENB_OPEN_SLOTS: ShiftWindow[] = [
  { startTime: '08:00', lunchStart: '11:30', lunchEnd: '12:30', endTime: '17:24' },
  { startTime: '08:00', lunchStart: '12:00', lunchEnd: '13:00', endTime: '17:24' },
];

const CENB_CLOSE_SLOTS: ShiftWindow[] = [
  { startTime: '08:36', lunchStart: '12:30', lunchEnd: '13:30', endTime: '18:00' },
  { startTime: '08:36', lunchStart: '13:00', lunchEnd: '14:00', endTime: '18:00' },
];

const STORE_HOURS_TRADITIONAL: StoreHoursMap = JSON.parse(
  JSON.stringify(DEFAULT_STORE_HOURS)
) as StoreHoursMap;

const STORE_HOURS_CENARIO_B: StoreHoursMap = {
  LOJA_1: {
    ...DEFAULT_STORE_HOURS.LOJA_1,
    weekdayOpen: '08:00',
    weekdayClose: '18:00',
    saturdayOpen: '08:00',
    saturdayClose: '14:00',
  },
  LOJA_2: {
    ...DEFAULT_STORE_HOURS.LOJA_2,
    weekdayOpen: '08:00',
    weekdayClose: '18:00',
    saturdayOpen: '08:00',
    saturdayClose: '14:00',
  },
};

function buildWeekScheduleFromPlan(
  emp: Employee,
  weekNum: 1 | 2 | 3 | 4,
  plan: EmployeeCyclePlan,
  weekdayWindow: ShiftWindow,
  saturdayEnd: '13:00' | '14:00'
): Record<DayOfWeek, DayShift> {
  const isSatOff = plan.satOffWeeks.includes(weekNum);
  const weekdayOff = plan.weekdayOffByWeek[weekNum];
  const weekDays: Array<'SEG' | 'TER' | 'QUA' | 'QUI' | 'SEX'> = [
    'SEG',
    'TER',
    'QUA',
    'QUI',
    'SEX',
  ];

  const sched = {} as Record<DayOfWeek, DayShift>;

  weekDays.forEach((day) => {
    if (!isSatOff && weekdayOff === day) {
      sched[day] = {
        day,
        type: 'FOLGA_5X2',
        chairId: emp.defaultChairId,
        label: 'Folga 5x2',
      };
    } else {
      sched[day] = {
        day,
        type: 'TRABALHO',
        chairId: emp.defaultChairId,
        startTime: weekdayWindow.startTime,
        lunchStart: weekdayWindow.lunchStart,
        lunchEnd: weekdayWindow.lunchEnd,
        endTime: weekdayWindow.endTime,
      };
    }
  });

  if (isSatOff) {
    sched.SAB = {
      day: 'SAB',
      type: 'FOLGA_5X2',
      chairId: emp.defaultChairId,
      label: 'Folga Sábado (5x2)',
    };
  } else {
    const satChair = plan.saturdayChairByWeek?.[weekNum] || emp.defaultChairId;
    sched.SAB = {
      day: 'SAB',
      type: 'TRABALHO',
      chairId: satChair,
      startTime: '08:00',
      endTime: saturdayEnd,
    };
  }

  sched.DOM = {
    day: 'DOM',
    type: 'FOLGA_DSR',
    chairId: emp.defaultChairId,
    label: 'Folga DSR',
  };

  return sched;
}

function applyCyclePlansToTeam(
  baseEmployees: Employee[],
  plansByEmployeeId: Record<string, EmployeeCyclePlan>,
  windowsByEmployeeId: Record<string, ShiftWindow>,
  saturdayEnd: '13:00' | '14:00'
): Employee[] {
  return baseEmployees.map((rawEmp) => {
    const emp = JSON.parse(JSON.stringify(rawEmp)) as Employee;

    // Preserva integralmente Estagiário (24h, restrição escolar) e Licença-Maternidade
    if (emp.contractType === 'ESTAGIARIO' || emp.contractType === 'LICENCA_MATERNIDADE') {
      return ensureEmployeeWeeksSchedule(emp);
    }

    const plan = plansByEmployeeId[emp.id];
    const win = windowsByEmployeeId[emp.id] || TRAD_OPEN_L1[1];
    if (!plan) {
      return ensureEmployeeWeeksSchedule(emp);
    }

    const weeksSchedule: Record<number, Record<DayOfWeek, DayShift>> = {};
    for (const w of [1, 2, 3, 4] as const) {
      const wWin =
        w % 2 === 1 && plan.openingShiftWindow
          ? plan.openingShiftWindow
          : w % 2 === 0 && plan.closingShiftWindow
          ? plan.closingShiftWindow
          : win;
      weeksSchedule[w] = buildWeekScheduleFromPlan(emp, w, plan, wWin, saturdayEnd);
    }

    emp.defaultLunchStart = win.lunchStart;
    emp.defaultLunchEnd = win.lunchEnd;
    emp.weeksSchedule = weeksSchedule;
    emp.schedule = JSON.parse(JSON.stringify(weeksSchedule[1])) as Record<DayOfWeek, DayShift>;

    return emp;
  });
}

// Planos 50/50 (2 Sábados por mês em revezamento + FDS Prolongados + Blindagem Qui/Sex)
function getPlans5050(): Record<string, EmployeeCyclePlan> {
  return {
    // --- SDRs (4 pessoas: 2/sáb sempre, Andria 100% nas Segundas) ---
    'emp-winona': {
      satOffWeeks: [2, 4],
      weekdayOffByWeek: { 1: 'SEG', 3: 'TER' }, // S4 Sáb -> S1 Seg (FDS Prol S4->S1) + afinidade João Alex.
    },
    'emp-diana': {
      satOffWeeks: [2, 4],
      weekdayOffByWeek: { 1: 'TER', 3: 'SEG' }, // S2 Sáb -> S3 Seg (FDS Prol S2->S3)
    },
    'emp-adriane': {
      satOffWeeks: [1, 3],
      weekdayOffByWeek: { 2: 'SEG', 4: 'SEG' }, // S1->S2 e S3->S4 (2 FDS Prolongados! Andria nunca pega Seg)
    },
    'emp-andria': {
      satOffWeeks: [1, 3],
      weekdayOffByWeek: { 2: 'TER', 4: 'TER' }, // Nunca folga Seg; folga junto c/ João Pedro no Sáb
    },

    // --- Vendedores (5 pessoas: sempre 3/sáb = 2 L1 + 1 L2, cada um c/ FDS Prolongado Sáb+Dom+Seg) ---
    'emp-joao-alexandre': {
      satOffWeeks: [2, 4],
      weekdayOffByWeek: { 1: 'SEG', 3: 'TER' }, // Espelha Winona (FDS Prol S4->S1 juntos!)
    },
    'emp-jair': {
      satOffWeeks: [2, 4],
      weekdayOffByWeek: { 1: 'TER', 3: 'SEG' }, // FDS Prol S2->S3
    },
    'emp-rosinaldo': {
      satOffWeeks: [1, 3],
      weekdayOffByWeek: { 2: 'TER', 4: 'SEG' }, // FDS Prol S3->S4; L1 tem 3 ativos na Seg S4 (>=3 -> auto-cobre L2) e 4 na Ter S2
    },
    'emp-rayssa': {
      satOffWeeks: [1], // S2/S4 em L1 + S3 cobrindo L2-EXT -> S1 Sáb -> S2 Seg (FDS Prol S1->S2)
      weekdayOffByWeek: { 2: 'SEG', 3: 'QUA', 4: 'QUA' },
      saturdayChairByWeek: { 3: 'VEND-L2-EXT' },
    },
    'emp-marcos-antonio': {
      satOffWeeks: [3], // S2/S4 em L1 + S1 cobrindo L2-EXT -> S3 Sáb -> S4 Seg (FDS Prol S3->S4)
      weekdayOffByWeek: { 1: 'QUA', 2: 'QUA', 4: 'SEG' },
      saturdayChairByWeek: { 1: 'VEND-L2-EXT' },
    },

    // --- Preparação & Zeladoria (4 pessoas: 2/sáb sempre, Qui & Sex 100% ativos, 100% FDS Prol) ---
    'emp-allisson': {
      satOffWeeks: [2, 4],
      weekdayOffByWeek: { 1: 'SEG', 3: 'TER' }, // FDS Prol S4->S1
    },
    'emp-marcos-florentino': {
      satOffWeeks: [2, 4],
      weekdayOffByWeek: { 1: 'TER', 3: 'SEG' }, // FDS Prol S2->S3
    },
    'emp-rodolfo': {
      satOffWeeks: [1, 3],
      weekdayOffByWeek: { 2: 'SEG', 4: 'TER' }, // FDS Prol S1->S2
    },
    'emp-alefy': {
      satOffWeeks: [1, 3],
      weekdayOffByWeek: { 2: 'TER', 4: 'SEG' }, // FDS Prol S3->S4
    },

    // --- Documentação / Sucesso do Cliente (3 CLTs + Matheus Estagiário: 2-3/sáb, Qui 100%, Sex 100%) ---
    'emp-marielly': {
      satOffWeeks: [2, 3],
      weekdayOffByWeek: { 1: 'TER', 4: 'SEG' }, // FDS Prol S3->S4; S1/S2/S3 Seg ativa apoiando L2
    },
    'emp-mayana': {
      satOffWeeks: [1, 3],
      weekdayOffByWeek: { 2: 'SEG', 4: 'TER' }, // FDS Prol S1->S2
    },
    'emp-jorge': {
      satOffWeeks: [1, 4],
      weekdayOffByWeek: { 2: 'TER', 3: 'SEG' }, // S2 Sáb (c/ Mayana+Matheus), S3 Sáb (sozinho CLT + Matheus) -> S1 Sáb->S2? Espera: S1 folgou Sáb, S2 trabalh. Sáb, S3 Seg (não folgou S2 Sáb); ajusta p/ satOffWeeks [1, 2] e S3 Seg!
    },

    // --- Postos Exclusivos Seg–Sex (100% das 42h semanais sem descobrir Sábado) ---
    'emp-nailson': {
      satOffWeeks: [1, 2, 3, 4],
      weekdayOffByWeek: {},
    },
    'emp-joao-pedro': {
      satOffWeeks: [1, 2, 3, 4],
      weekdayOffByWeek: {},
    },
  };
}

// Garante que Jorge (Doc/SC) faça S2 folga sábado -> S3 Segunda (FDS Prolongado S2->S3)
function getPlans5050Fixed(): Record<string, EmployeeCyclePlan> {
  const plans = getPlans5050();
  plans['emp-jorge'] = {
    satOffWeeks: [2, 4],
    weekdayOffByWeek: { 1: 'TER', 3: 'SEG' }, // S1 trabaja (c/ Marielly), S2 folga Sáb -> S3 folga Seg (FDS Prol S2->S3!)
  };
  // Ajusta Marielly e Mayana para manter 2 CLTs + Matheus todo sábado:
  // S1 Sat: Marielly + Jorge (+ Matheus) | S2 Sat: Mayana (+ Matheus = 2!)
  // S3 Sat: Marielly + Jorge (+ Matheus) | S4 Sat: Mayana + Jorge? Se Jorge folga S2/S4, S4 fica Mayana (+ Matheus = 2!)
  plans['emp-marielly'] = {
    satOffWeeks: [2, 4],
    weekdayOffByWeek: { 1: 'SEG', 3: 'TER' }, // FDS Prol S4->S1! S4 Sáb folga -> S1 Seg folga
  };
  plans['emp-mayana'] = {
    satOffWeeks: [1, 3],
    weekdayOffByWeek: { 2: 'SEG', 4: 'TER' }, // FDS Prol S1->S2! S1 Sáb folga -> S2 Seg folga
  };
  // Conferência Qui/Sex para L2-DOC:
  // S1: Seg (Marielly off -> 2 CLTs+Matheus), Ter (Jorge off -> 2 CLTs+Matheus), Qui/Sex (3 CLTs + Matheus = 100%!)
  // S2: Seg (Mayana off), Qui/Sex (100%!)
  // S3: Seg (Jorge off), Ter (Marielly off), Qui/Sex (100%!)
  // S4: Ter (Mayana off), Qui/Sex (100%!)
  return plans;
}

// Planos 3 Sábados por Mês (75% de efetivo aos sábados + 1 FDS Prolongado Sáb->Dom->Seg para todos)
function getPlans3Sab(): Record<string, EmployeeCyclePlan> {
  return {
    // --- SDRs (4 pessoas: 3 trabalham todo sábado, 1 folga Sáb -> volta c/ Seg folga) ---
    'emp-winona': {
      satOffWeeks: [1],
      weekdayOffByWeek: { 2: 'SEG', 3: 'QUA', 4: 'QUA' }, // FDS Prol S1->S2
    },
    'emp-diana': {
      satOffWeeks: [2],
      weekdayOffByWeek: { 1: 'TER', 3: 'SEG', 4: 'TER' }, // FDS Prol S2->S3
    },
    'emp-andria': {
      satOffWeeks: [3],
      weekdayOffByWeek: { 1: 'QUA', 2: 'TER', 4: 'TER' }, // Nunca folga SEG; S3 folga Sáb c/ João Pedro
    },
    'emp-adriane': {
      satOffWeeks: [4],
      weekdayOffByWeek: { 1: 'SEG', 2: 'QUA', 3: 'TER' }, // FDS Prol S4->S1
    },

    // --- Vendedores (5 pessoas: 3-4 trabalham todo sábado = >=2 L1 + 1 L2 sempre) ---
    'emp-joao-alexandre': {
      satOffWeeks: [1],
      weekdayOffByWeek: { 2: 'SEG', 3: 'QUA', 4: 'QUA' }, // Espelha Winona 100%!
    },
    'emp-jair': {
      satOffWeeks: [1],
      weekdayOffByWeek: { 2: 'TER', 3: 'TER', 4: 'SEG' }, // Ou S1 off -> S2 Seg! Vamos deixar J.Alex & Jair juntos S2 Seg (2 L1 ficam: Marcos+Rayssa + Jorginho L2)
    },
    'emp-rosinaldo': {
      satOffWeeks: [2],
      weekdayOffByWeek: { 1: 'QUA', 3: 'SEG', 4: 'TER' }, // FDS Prol S2->S3; na S2 Sáb Marcos assume VEND-L2-EXT!
    },
    'emp-marcos-antonio': {
      satOffWeeks: [3],
      weekdayOffByWeek: { 1: 'TER', 2: 'QUA', 4: 'SEG' }, // FDS Prol S3->S4
      saturdayChairByWeek: { 2: 'VEND-L2-EXT' },
    },
    'emp-rayssa': {
      satOffWeeks: [4],
      weekdayOffByWeek: { 1: 'SEG', 2: 'TER', 3: 'TER' }, // FDS Prol S4->S1
    },

    // --- Preparação & Zeladoria (4 pessoas: 3 trabalham todo sábado, 100% em Qui & Sex!) ---
    'emp-allisson': {
      satOffWeeks: [1],
      weekdayOffByWeek: { 2: 'SEG', 3: 'TER', 4: 'QUA' }, // FDS Prol S1->S2
    },
    'emp-rodolfo': {
      satOffWeeks: [2],
      weekdayOffByWeek: { 1: 'TER', 3: 'SEG', 4: 'TER' }, // FDS Prol S2->S3
    },
    'emp-marcos-florentino': {
      satOffWeeks: [3],
      weekdayOffByWeek: { 1: 'QUA', 2: 'TER', 4: 'SEG' }, // FDS Prol S3->S4
    },
    'emp-alefy': {
      satOffWeeks: [4],
      weekdayOffByWeek: { 1: 'SEG', 2: 'QUA', 3: 'QUA' }, // FDS Prol S4->S1
    },

    // --- Documentação / Sucesso do Cliente (3 CLTs + Matheus: Qui & Sex 100% ativos!) ---
    'emp-marielly': {
      satOffWeeks: [1],
      weekdayOffByWeek: { 2: 'SEG', 3: 'TER', 4: 'TER' }, // FDS Prol S1->S2
    },
    'emp-jorge': {
      satOffWeeks: [2],
      weekdayOffByWeek: { 1: 'TER', 3: 'SEG', 4: 'QUA' }, // FDS Prol S2->S3
    },
    'emp-mayana': {
      satOffWeeks: [3],
      weekdayOffByWeek: { 1: 'QUA', 2: 'TER', 4: 'SEG' }, // FDS Prol S3->S4
    },

    // --- Postos Exclusivos Seg–Sex (42h00 completas toda semana) ---
    'emp-nailson': {
      satOffWeeks: [1, 2, 3, 4],
      weekdayOffByWeek: {},
    },
    'emp-joao-pedro': {
      satOffWeeks: [1, 2, 3, 4],
      weekdayOffByWeek: {},
    },
  };
}

function getPlans3SabConsistent(): Record<string, EmployeeCyclePlan> {
  const plans = getPlans3Sab();
  // Jair folga Seg S2 junto com João Alex para completar FDS Prol S1->S2 (L1 fica Marcos+Rayssa = 2/2 + Jorginho = 1/1)
  plans['emp-jair'] = {
    satOffWeeks: [1],
    weekdayOffByWeek: { 2: 'SEG', 3: 'TER', 4: 'TER' }, // FDS Prol S1->S2
  };
  return plans;
}

// Janelas para Loja Tradicional (Seg–Sex 08:00–17:30): todos <= 8h24/dia, Preparação fecha às 17:30!
function getTraditionalWindows(): Record<string, ShiftWindow> {
  return {
    'emp-winona': TRAD_OPEN_L1[3], // 13:00–14:00
    'emp-andria': TRAD_OPEN_L1[1], // 12:00–13:00
    'emp-diana': TRAD_OPEN_L1[0], // 11:30–12:30
    'emp-adriane': TRAD_OPEN_L1[2], // 12:30–13:30

    'emp-jair': TRAD_OPEN_L1[0], // 11:30–12:30
    'emp-joao-alexandre': TRAD_OPEN_L1[3], // 13:00–14:00 (c/ Winona)
    'emp-marcos-antonio': TRAD_OPEN_L1[2], // 12:30–13:30
    'emp-rayssa': TRAD_OPEN_L1[1], // 12:00–13:00
    'emp-rosinaldo': TRAD_OPEN_L1[0],

    // Preparação: Allisson & Rodolfo abrem (08:00–17:24), Marcos Flor. & Alefy fecham até 17:30 (08:06–17:30)! Ambos 8h24 exatos!
    'emp-allisson': TRAD_OPEN_L1[1],
    'emp-rodolfo': TRAD_OPEN_L1[0],
    'emp-marcos-florentino': TRAD_CLOSE_530,
    'emp-alefy': TRAD_CLOSE_530,

    'emp-nailson': TRAD_OPEN_L1[1],
    'emp-marielly': TRAD_OPEN_L1[0],
    'emp-mayana': TRAD_OPEN_L1[3],
    'emp-jorge': TRAD_OPEN_L1[1],
    'emp-joao-pedro': TRAD_OPEN_L1[1],
  };
}

// Janelas para Cenário B (Seg–Sex 08:00–18:00): pares escalonados Abertura (08:00–17:24) e Fechamento (08:36–18:00) em todos os setores!
function getScenarioBWindows(): Record<string, ShiftWindow> {
  return {
    // SDR: 2 Abertura + 2 Fechamento -> Loja 1 coberta 08:00–18:00 com 8h24 máx/dia!
    'emp-winona': CENB_OPEN_SLOTS[1],
    'emp-andria': CENB_OPEN_SLOTS[0],
    'emp-diana': CENB_CLOSE_SLOTS[0],
    'emp-adriane': CENB_CLOSE_SLOTS[1],

    // Vendedores: 2 Abertura + 2 Fechamento L1 + Jorginho L2 (08:36–18:00 ou 08:00–17:24 alternado — fixamos Abertura para interjornada folgada e alinhar Pátio)
    'emp-jair': CENB_OPEN_SLOTS[0],
    'emp-joao-alexandre': CENB_OPEN_SLOTS[1],
    'emp-marcos-antonio': CENB_CLOSE_SLOTS[0],
    'emp-rayssa': CENB_CLOSE_SLOTS[1],
    'emp-rosinaldo': CENB_OPEN_SLOTS[1],

    // Preparação & Zeladoria: Allisson + Marcos Flor. (Abertura 08:00) e Rodolfo + Alefy (Fechamento 18:00)! Sempre >=1 abertura e >=1 fechamento mesmo nas folgas!
    'emp-allisson': CENB_OPEN_SLOTS[1],
    'emp-marcos-florentino': CENB_OPEN_SLOTS[0],
    'emp-rodolfo': CENB_CLOSE_SLOTS[0],
    'emp-alefy': CENB_CLOSE_SLOTS[1],

    'emp-nailson': CENB_OPEN_SLOTS[1],

    // Doc / Sucesso do Cliente: Marielly (Abertura 08:00) + Jorge & Mayana (Fechamento 18:00) -> abertura e fechamento 100% cobertos em L2!
    'emp-marielly': CENB_OPEN_SLOTS[0],
    'emp-mayana': CENB_CLOSE_SLOTS[1],
    'emp-jorge': CENB_CLOSE_SLOTS[0],

    'emp-joao-pedro': CENB_OPEN_SLOTS[1],
  };
}

/**
 * Constrói os 4 cenários otimizados (máx 8h24/dia, 0 violações, 0 setores descobertos, rodízio Sáb→Dom→Seg).
 */
export function createOptimizedScenarios(baseEmployees: Employee[]): Scenario[] {
  const pmConfig42 = getDefaultPontoMaisConfig('FASE_1');

  const empTrad5050 = applyCyclePlansToTeam(
    baseEmployees,
    getPlans5050Fixed(),
    getTraditionalWindows(),
    '13:00'
  );

  const empTrad3Sab = applyCyclePlansToTeam(
    baseEmployees,
    getPlans3SabConsistent(),
    getTraditionalWindows(),
    '13:00'
  );

  const empCenB5050 = applyCyclePlansToTeam(
    baseEmployees,
    getPlans5050Fixed(),
    getScenarioBWindows(),
    '14:00'
  );

  const empCenB3Sab = applyCyclePlansToTeam(
    baseEmployees,
    getPlans3SabConsistent(),
    getScenarioBWindows(),
    '14:00'
  );

  return [
    {
      id: OPTIMIZED_SCENARIO_IDS.TRAD_5050,
      name: 'Proposta 1 — Loja Atual (Revezamento 50/50 + Média 40h24/sem)',
      shortTag: 'Prop. 1: Atual 50/50 (40h24)',
      description:
        'Mantém abertura e fechamento atuais (Seg–Sex 08:00–17:30, Sáb 08:00–13:00). Jornadas úteis de 8h24 (1h00 de almoço escalonado), zeladoria alternando 17:24/17:30 e revezamento aos sábados (média global CLT 40h24/sem = 96,2% das 42h; 161h12–168h00/mês), com 16 FDS prolongados Sáb→Dom→Seg e 100% da equipe na Qui/Sex.',
      phase: 'FASE_1',
      employees: empTrad5050,
      storeHours: JSON.parse(JSON.stringify(STORE_HOURS_TRADITIONAL)) as StoreHoursMap,
      sectorMinimums: JSON.parse(JSON.stringify(DEFAULT_SECTOR_MINIMUMS)),
      pontoMaisConfig: pmConfig42,
      createdAt: '2026-11-14T11:30:00Z',
    },
    {
      id: OPTIMIZED_SCENARIO_IDS.TRAD_3SAB,
      name: 'Proposta 2 — Loja Atual (75% Sábados + FDS Prolongado 39h44/sem)',
      shortTag: 'Prop. 2: Atual 75% Sáb (39h44)',
      description:
        'Preserva integralmente o horário tradicional da empresa (08:00–17:30 / Sáb 08:00–13:00) com teto estrito de 8h24/dia. Garante 75% da força comercial todo sábado (12 CLTs + Matheus) enquanto todos usufruem de folga de sábado (42h00 na semana) engatada em segunda-feira (15 FDS prolongados Sáb+Dom+Seg; média global CLT 39h44/sem = 94,6%).',
      phase: 'FASE_1',
      employees: empTrad3Sab,
      storeHours: JSON.parse(JSON.stringify(STORE_HOURS_TRADITIONAL)) as StoreHoursMap,
      sectorMinimums: JSON.parse(JSON.stringify(DEFAULT_SECTOR_MINIMUMS)),
      pontoMaisConfig: pmConfig42,
      createdAt: '2026-11-14T11:30:00Z',
    },
    {
      id: OPTIMIZED_SCENARIO_IDS.CENB_5050,
      name: 'Proposta 3 — Cenário B Estendido 50/50 (18h / Sáb 14h = 40h52/sem)',
      shortTag: 'Prop. 3: Cen. B 50/50 (40h52)',
      description:
        'Aproveitamento máximo teórico das 42h (média global CLT 40h52/sem = 97,3%; até 163h12–168h00/mês) sem jamais passar de 8h24/dia: turnos escalonados na Seg–Sex (Abertura 08:00–17:24 e Fechamento 08:36–18:00 c/ 1h00 almoço) + Sábado corrido 08:00–14:00 (6h00 dentro da CLT Art. 71), com 16 FDS prolongados Sáb→Dom→Seg.',
      phase: 'FASE_1',
      employees: empCenB5050,
      storeHours: JSON.parse(JSON.stringify(STORE_HOURS_CENARIO_B)) as StoreHoursMap,
      sectorMinimums: JSON.parse(JSON.stringify(DEFAULT_SECTOR_MINIMUMS)),
      pontoMaisConfig: pmConfig42,
      createdAt: '2026-11-14T11:30:00Z',
    },
    {
      id: OPTIMIZED_SCENARIO_IDS.CENB_3SAB,
      name: 'Proposta 4 — Cenário B Estendido 75% Sábados (18h / Sáb 14h = 40h24/sem)',
      shortTag: 'Prop. 4: Cen. B 75% Sáb (40h24)',
      description:
        'União do horário comercial ampliado (Seg–Sex 08:00–18:00 em turnos Abertura/Fechamento de 8h24 + Sábado 08:00–14:00) com alta cobertura de 75% nos sábados (12 CLTs + Matheus). Entrega média global CLT de 40h24/sem (96,2% das 42h), abertura 08:00–18:00 integral e 15 FDS prolongados (Sáb+Dom+Seg) no ciclo.',
      phase: 'FASE_1',
      employees: empCenB3Sab,
      storeHours: JSON.parse(JSON.stringify(STORE_HOURS_CENARIO_B)) as StoreHoursMap,
      sectorMinimums: JSON.parse(JSON.stringify(DEFAULT_SECTOR_MINIMUMS)),
      pontoMaisConfig: pmConfig42,
      createdAt: '2026-11-14T11:30:00Z',
    },
  ];
}

/**
 * Calcula indicadores objetivos de desempenho, conformidade (<=8h24), aproveitamento de 42h,
 * cobertura setorial e fins de semana prolongados (Sáb → Dom → Seg) de um cenário completo S1–S4.
 */
export function analyzeScenarioMetrics(scenario: Scenario): ScenarioAnalysisMetrics {
  const prepared = scenario.employees.map(ensureEmployeeWeeksSchedule);
  const activePhase = scenario.phase || 'FASE_1';
  const cfgHours = scenario.storeHours || DEFAULT_STORE_HOURS;
  const mins = scenario.sectorMinimums || DEFAULT_SECTOR_MINIMUMS;

  let maxDailyHoursObserved = 0;
  let maxDailyMinutesObserved = 0;
  let sumMonthlyClt = 0;
  let countClt = 0;
  let minMonthlyHoursClt = Infinity;
  let maxMonthlyHoursClt = 0;
  let rotatingCltCount = 0;
  let complianceErrorCount = 0;

  const prolongedWeekends: ProlongedWeekendRecord[] = [];
  const employeesWithProlongedSet = new Set<string>();

  prepared.forEach((emp) => {
    const isClt = emp.contractType !== 'ESTAGIARIO' && emp.contractType !== 'LICENCA_MATERNIDADE' && !emp.isCirculating;
    const mSum = calculateEmployeeMonthlySummary(emp, activePhase);

    if (mSum.complianceByWeek.some((c) => !c.isCompliant)) {
      complianceErrorCount += mSum.complianceByWeek.reduce(
        (acc, c) => acc + c.violations.filter((v) => v.severity === 'ERROR').length,
        0
      );
    }

    if (isClt) {
      countClt++;
      sumMonthlyClt += mSum.totalMonthlyHours;
      minMonthlyHoursClt = Math.min(minMonthlyHoursClt, mSum.totalMonthlyHours);
      maxMonthlyHoursClt = Math.max(maxMonthlyHoursClt, mSum.totalMonthlyHours);

      // Verifica se trabalha pelo menos 1 sábado no mês
      const worksAnySat = [1, 2, 3, 4].some((w) => emp.weeksSchedule![w].SAB.type === 'TRABALHO');
      if (worksAnySat) {
        rotatingCltCount++;
      }

      // Detecta FDS Prolongado: SAB + DOM na semana w seguidos de SEG folga na semana (w % 4) + 1
      for (const w of [1, 2, 3, 4] as const) {
        const nextW = ((w % 4) + 1) as 1 | 2 | 3 | 4;
        const currWeek = emp.weeksSchedule![w];
        const nextWeek = emp.weeksSchedule![nextW];
        const satOff = currWeek.SAB?.type !== 'TRABALHO';
        const domOff = currWeek.DOM?.type !== 'TRABALHO';
        const nextSegOff = nextWeek.SEG?.type !== 'TRABALHO';
        if (satOff && domOff && nextSegOff) {
          employeesWithProlongedSet.add(emp.id);
          prolongedWeekends.push({
            employeeId: emp.id,
            shortName: emp.shortName,
            department: emp.department,
            transitionLabel: `Sáb S${w} → Dom S${w} → Seg S${nextW}`,
          });
        }
      }
    }

    for (const w of [1, 2, 3, 4]) {
      const ws = emp.weeksSchedule![w];
      (['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB', 'DOM'] as DayOfWeek[]).forEach((d) => {
        const s = ws[d];
        if (!s || s.type !== 'TRABALHO') return;
        const h = calculateDailyHours(s);
        let minsWorked = Math.round(h * 60);
        if (s.startTime && s.endTime) {
          const st = parseTimeToMinutes(s.startTime);
          const en = parseTimeToMinutes(s.endTime);
          let raw = en >= st ? en - st : en + 1440 - st;
          if (s.lunchStart && s.lunchEnd) {
            const ls = parseTimeToMinutes(s.lunchStart);
            const le = parseTimeToMinutes(s.lunchEnd);
            raw -= le >= ls ? le - ls : le + 1440 - ls;
          }
          minsWorked = Math.max(0, raw);
        }
        if (h > maxDailyHoursObserved) maxDailyHoursObserved = h;
        if (minsWorked > maxDailyMinutesObserved) maxDailyMinutesObserved = minsWorked;
      });
    }
  });

  const operationalAlerts = checkMonthlyTeamOperationalAndAffinities(prepared, cfgHours);
  const operationalWarningCount = operationalAlerts.filter((a) => a.severity === 'ERROR' || a.severity === 'WARNING').length;

  let uncoveredSectorsTotal = 0;
  let satCltSum = 0;
  let satTotalSum = 0;
  let monSum = 0;
  let thuSum = 0;
  let friSum = 0;

  const sectorAgg = new Map<
    string,
    {
      sectorTitle: string;
      weekdayMin: number;
      saturdayMin: number;
      minW: number;
      maxW: number;
      minS: number;
      maxS: number;
      uncoveredCount: number;
    }
  >();

  for (const w of [1, 2, 3, 4]) {
    const weekEmps = prepared.map((e) => ({
      ...e,
      schedule: e.weeksSchedule![w],
    }));

    const cltActive = weekEmps.filter(
      (e) => e.contractType !== 'ESTAGIARIO' && e.contractType !== 'LICENCA_MATERNIDADE' && !e.isCirculating
    );
    monSum += cltActive.filter((e) => e.schedule.SEG?.type === 'TRABALHO').length;
    thuSum += cltActive.filter((e) => e.schedule.QUI?.type === 'TRABALHO').length;
    friSum += cltActive.filter((e) => e.schedule.SEX?.type === 'TRABALHO').length;
    satCltSum += cltActive.filter((e) => e.schedule.SAB?.type === 'TRABALHO').length;
    satTotalSum += weekEmps.filter((e) => e.schedule.SAB?.type === 'TRABALHO').length;

    const cov = calculateWeeklyCoverageSummary(weekEmps, mins);
    uncoveredSectorsTotal += cov.totalCriticalUncovered + cov.totalAlertUncovered;

    (['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'] as DayOfWeek[]).forEach((d) => {
      cov.byDay[d].forEach((res) => {
        const cur = sectorAgg.get(res.sector.id) || {
          sectorTitle: res.sector.title,
          weekdayMin: mins[res.sector.id]?.weekday ?? res.sector.minRequiredWeekday,
          saturdayMin: mins[res.sector.id]?.saturday ?? res.sector.minRequiredSaturday,
          minW: Infinity,
          maxW: 0,
          minS: Infinity,
          maxS: 0,
          uncoveredCount: 0,
        };
        if (res.isUncovered) cur.uncoveredCount++;
        if (d === 'SAB') {
          cur.minS = Math.min(cur.minS, res.activeHeadcount);
          cur.maxS = Math.max(cur.maxS, res.activeHeadcount);
        } else {
          cur.minW = Math.min(cur.minW, res.activeHeadcount);
          cur.maxW = Math.max(cur.maxW, res.activeHeadcount);
        }
        sectorAgg.set(res.sector.id, cur);
      });
    });
  }

  const sectorCoverageRows: ScenarioSectorHeadcountRow[] = Array.from(sectorAgg.entries()).map(
    ([sectorId, data]) => ({
      sectorId,
      sectorTitle: data.sectorTitle,
      weekdayMin: data.weekdayMin,
      saturdayMin: data.saturdayMin,
      minObservedWeekday: data.minW === Infinity ? 0 : data.minW,
      maxObservedWeekday: data.maxW,
      minObservedSaturday: data.minS === Infinity ? 0 : data.minS,
      maxObservedSaturday: data.maxS,
      uncoveredCount: data.uncoveredCount,
    })
  );

  const avgMonthlyHoursClt = countClt > 0 ? Number((sumMonthlyClt / countClt).toFixed(2)) : 0;
  const avgWeeklyHoursClt = Number((avgMonthlyHoursClt / 4).toFixed(2));
  const utilization42hPct = Number(((avgWeeklyHoursClt / 42) * 100).toFixed(1));
  const saturdayAvgActiveClt = Number((satCltSum / 4).toFixed(1));
  const saturdayAvgTotalActive = Number((satTotalSum / 4).toFixed(1));
  const denClt = Math.max(1, countClt * 4);
  const mondayAvgPct = Number(((monSum / denClt) * 100).toFixed(1));
  const thursdayAvgPct = Number(((thuSum / denClt) * 100).toFixed(1));
  const fridayAvgPct = Number(((friSum / denClt) * 100).toFixed(1));

  // Evita unused import warning garantindo uso de calculateWeeklyHours em sanidade
  void calculateWeeklyHours;

  return {
    scenarioId: scenario.id,
    maxDailyHoursObserved: Number(maxDailyHoursObserved.toFixed(2)),
    maxDailyMinutesObserved,
    within8h24Cap: maxDailyMinutesObserved <= 504,
    avgWeeklyHoursClt,
    avgMonthlyHoursClt,
    utilization42hPct,
    minMonthlyHoursClt: minMonthlyHoursClt === Infinity ? 0 : Number(minMonthlyHoursClt.toFixed(2)),
    maxMonthlyHoursClt: Number(maxMonthlyHoursClt.toFixed(2)),
    rotatingCltCount,
    complianceErrorCount,
    operationalWarningCount,
    uncoveredSectorsTotal,
    saturdayAvgActiveClt,
    saturdayAvgTotalActive,
    thursdayAvgPct,
    fridayAvgPct,
    mondayAvgPct,
    prolongedWeekendsCount: prolongedWeekends.length,
    employeesWithProlongedWeekend: employeesWithProlongedSet.size,
    prolongedWeekends,
    sectorCoverageRows,
    storeHoursSummary: `Seg–Sex ${cfgHours.LOJA_1.weekdayOpen}–${cfgHours.LOJA_1.weekdayClose} • Sáb ${cfgHours.LOJA_1.saturdayOpen}–${cfgHours.LOJA_1.saturdayClose}`,
  };
}
