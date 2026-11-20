import {
  DayOfWeek,
  DepartmentId,
  Employee,
  SectorMinimumsMap,
  StoreId,
} from '../types/schedule';
import { DAYS_OF_WEEK } from './compliance';

export interface CrossSkillRule {
  employeeId: string;
  employeeName: string;
  skillLabel: string;
  /** Dias em que essa habilidade cobre naturalmente uma folga regular */
  blockedDays?: DayOfWeek[];
}

export interface SectorDefinition {
  id: string;
  storeId: StoreId;
  departmentId: DepartmentId;
  title: string;
  storeName: string;
  chairIds: string[];
  minRequiredWeekday: number;
  minRequiredSaturday: number;
  criticalWeekday?: DayOfWeek;
  criticalReason?: string;
  /** Colaboradores com escala fixa em outro posto que possuem habilidade para cobrir este setor quando ativos */
  crossSkillBackups?: CrossSkillRule[];
  /** Permite cobertura por colegas ativos da mesma função em outra loja (ex: Vendedores L1 <-> L2 rodízio) */
  allowSameFunctionPeerRotation?: boolean;
  /** Liderança sem horário fixo que cobre o setor em folga regular 5x2 */
  leadershipCoversSingleRestDay?: boolean;
  primaryBackups: Array<{ id: string; name: string; role: string }>;
}

export const SECTOR_DEFINITIONS: SectorDefinition[] = [
  // Loja 1 — Matriz 546
  {
    id: 'L1-SDR',
    storeId: 'LOJA_1',
    departmentId: 'SDR',
    title: 'Sala de SDRs (Pré-vendas)',
    storeName: 'Matriz 546',
    chairIds: ['SDR-1', 'SDR-2', 'SDR-3', 'SDR-4'],
    minRequiredWeekday: 2,
    minRequiredSaturday: 2,
    criticalWeekday: 'SEG',
    criticalReason: 'Segunda-feira é pico de entrada de novos leads gerados no fim de semana.',
    primaryBackups: [
      { id: 'emp-edvania', name: 'Edvania Maria', role: 'Supervisora Comercial' },
      { id: 'emp-lorena', name: 'Lorena Maria Reis', role: 'Gerente Geral' },
    ],
  },
  {
    id: 'L1-VENDAS',
    storeId: 'LOJA_1',
    departmentId: 'VENDAS',
    title: 'Pátio de Vendedores (Showroom)',
    storeName: 'Matriz 546',
    chairIds: ['VEND-L1-1', 'VEND-L1-2', 'VEND-L1-3', 'VEND-L1-4', 'VEND-L1-5', 'VEND-L1-6'],
    minRequiredWeekday: 2,
    minRequiredSaturday: 2,
    criticalWeekday: 'SAB',
    criticalReason: 'Sábado é o dia com maior fluxo de clientes presenciais no showroom.',
    primaryBackups: [
      { id: 'emp-edvania', name: 'Edvania Maria', role: 'Supervisora Comercial' },
      { id: 'emp-lorena', name: 'Lorena Maria Reis', role: 'Gerente Geral' },
      { id: 'emp-pedro', name: 'Pedro Henrique', role: 'Sócio / Apoio Vendas' },
    ],
  },
  {
    id: 'L1-PREP',
    storeId: 'LOJA_1',
    departmentId: 'PREPARACAO',
    title: 'Base da Preparação & Zeladoria',
    storeName: 'Matriz 546',
    chairIds: ['PREP-1', 'PREP-2', 'PREP-3', 'PREP-4'],
    minRequiredWeekday: 2,
    minRequiredSaturday: 1,
    criticalWeekday: 'SEX',
    criticalReason: 'Sexta-feira concentra a preparação e polimento dos veículos para entrega.',
    primaryBackups: [
      { id: 'emp-lorena', name: 'Lorena Maria Reis', role: 'Gerente Geral (Acompanhamento)' },
    ],
  },
  {
    id: 'L1-MKT',
    storeId: 'LOJA_1',
    departmentId: 'MARKETING',
    title: 'Marketing & Conteúdo',
    storeName: 'Matriz 546',
    chairIds: ['MKT-1'],
    minRequiredWeekday: 1,
    minRequiredSaturday: 0,
    leadershipCoversSingleRestDay: true,
    primaryBackups: [
      { id: 'emp-igor', name: 'Igor Rafael', role: 'Sócio Administrador / Marketing e Câmeras' },
      { id: 'emp-lorena', name: 'Lorena Maria Reis', role: 'Gerente Geral (Conteúdo)' },
    ],
  },

  // Loja 2 — Filial 777
  {
    id: 'L2-VENDAS-EXT',
    storeId: 'LOJA_2',
    departmentId: 'VENDAS',
    title: 'Área Externa (Vendas Filial)',
    storeName: 'Filial 777',
    chairIds: ['VEND-L2-EXT'],
    minRequiredWeekday: 0,
    minRequiredSaturday: 0,
    criticalWeekday: 'SAB',
    criticalReason: 'Cadeira essencial de recepção de clientes de compra e troca na Filial.',
    allowSameFunctionPeerRotation: true,
    primaryBackups: [
      { id: 'emp-pedro', name: 'Pedro Henrique', role: 'Sócio / Avaliação de Veículos' },
      { id: 'emp-jair', name: 'Jair', role: 'Vendedor Sênior (Rodízio)' },
      { id: 'emp-rayssa', name: 'Rayssa', role: 'Vendedora (Rodízio)' },
    ],
  },
  {
    id: 'L2-DOC',
    storeId: 'LOJA_2',
    departmentId: 'DOCUMENTACAO',
    title: 'Escritório de Atendimento (Baias de Doc & Pós-Venda)',
    storeName: 'Filial 777',
    chairIds: ['DOC-SUP', 'DOC-AUX', 'DOC-EST', 'SC-1'],
    minRequiredWeekday: 2,
    minRequiredSaturday: 1,
    criticalWeekday: 'QUI',
    criticalReason: 'Quinta e Sexta concentram emissão de ATPV-e e transferências no DETRAN.',
    crossSkillBackups: [
      {
        employeeId: 'emp-allisson',
        employeeName: 'Allisson',
        skillLabel: 'Assistência / Preparação',
      },
    ],
    primaryBackups: [
      { id: 'emp-anibal', name: 'Aníbal', role: 'Qualidade / Demandas Externas DETRAN' },
      { id: 'emp-pedro', name: 'Pedro Henrique', role: 'Sócio' },
    ],
  },
  {
    id: 'L2-FIN',
    storeId: 'LOJA_2',
    departmentId: 'FINANCEIRO',
    title: 'Escritório 2 — Financeiro & Pagamentos',
    storeName: 'Filial 777',
    chairIds: ['FIN-1'],
    minRequiredWeekday: 1,
    minRequiredSaturday: 0,
    criticalWeekday: 'SEX',
    criticalReason: 'Sexta-feira é dia indispensável de fechamento semanal e pagamentos a fornecedores.',
    crossSkillBackups: [
      {
        employeeId: 'emp-marielly',
        employeeName: 'Marielly',
        skillLabel: 'Domínio de pagamentos (L2)',
        blockedDays: ['SEX'], // Sexta é dia crítico de pagamentos; requer titular ou diretoria
      },
    ],
    primaryBackups: [
      { id: 'emp-igor', name: 'Igor Rafael', role: 'Sócio Administrador / Pagamentos' },
      { id: 'emp-pedro', name: 'Pedro Henrique', role: 'Sócio' },
    ],
  },
];

export const DEFAULT_SECTOR_MINIMUMS: SectorMinimumsMap = SECTOR_DEFINITIONS.reduce(
  (acc, sec) => {
    acc[sec.id] = {
      weekday: sec.minRequiredWeekday,
      saturday: sec.minRequiredSaturday,
    };
    return acc;
  },
  {} as SectorMinimumsMap
);

export function resolveSectorMinimum(
  sector: SectorDefinition,
  isSaturday: boolean,
  sectorMinimums?: SectorMinimumsMap,
  maxChairsOverride?: number
): number {
  const custom = sectorMinimums?.[sector.id];
  const raw = isSaturday
    ? (custom?.saturday ?? sector.minRequiredSaturday)
    : (custom?.weekday ?? sector.minRequiredWeekday);
  const maxAllowed =
    maxChairsOverride !== undefined
      ? Math.max(sector.chairIds.length, maxChairsOverride)
      : sector.chairIds.length;
  return Math.max(0, Math.min(maxAllowed, Math.round(raw)));
}

export interface AutoPeerOrSkillCoverage {
  employeeName: string;
  label: string;
}

export interface SectorDailyCoverageResult {
  sector: SectorDefinition;
  day: DayOfWeek;
  totalChairs: number;
  activeHeadcount: number;
  offHeadcount: number;
  coveredHeadcount: number; // Cobertura explícita manual/auto atribuída na célula
  autoCoveredByPeersOrSkills: AutoPeerOrSkillCoverage[]; // Cobertura natural por mesma função ou habilidade
  effectiveHeadcount: number; // ativos + cobertos explícitos + cobertos por função/habilidade
  minRequired: number;
  isUncovered: boolean;
  /** Setor com múltiplas cadeiras operando em dia único com apenas 1 pessoa ativa (demanda concentrada, porém gerenciável e coberta) */
  isSinglePersonManageableLoad: boolean;
  status: 'SEGURO' | 'ALERTA' | 'CRITICO';
  message: string;
  uncoveredEmployees: Array<{
    id: string;
    name: string;
    role: string;
    chairId: string;
  }>;
  suggestedBackups: Array<{ id: string; name: string; role: string }>;
}

/**
 * Calcula a cobertura de postos de cada setor para um dia da semana,
 * considerando o efetivo mínimo configurado de cada setor, colegas ativos e habilidades cruzadas.
 */
export function calculateSectorDailyCoverage(
  employees: Employee[],
  day: DayOfWeek,
  sectorMinimums?: SectorMinimumsMap
): SectorDailyCoverageResult[] {
  const isSaturday = day === 'SAB';
  const isSunday = day === 'DOM';
  const empById = new Map(employees.map((e) => [e.id, e]));

  // Conta vendedores ativos na Loja 1 (para verificar capacidade de rodízio para Loja 2)
  const l1SellerChairs = ['VEND-L1-1', 'VEND-L1-2', 'VEND-L1-3', 'VEND-L1-4', 'VEND-L1-5', 'VEND-L1-6'];
  const activeL1Sellers = employees.filter((emp) => {
    if (emp.contractType === 'LICENCA_MATERNIDADE') return false;
    const shift = emp.schedule[day];
    if (shift?.type !== 'TRABALHO') return false;
    return (
      l1SellerChairs.includes(shift.chairId || emp.defaultChairId) ||
      (emp.defaultStore === 'LOJA_1' && emp.department === 'VENDAS')
    );
  });

  // Conta pessoal ativo de Preparação na Loja 1 (para checar folga de assistência de Allisson)
  const l1PrepActiveCount = employees.filter((emp) => {
    if (emp.department !== 'PREPARACAO' || emp.contractType === 'LICENCA_MATERNIDADE') return false;
    return emp.schedule[day]?.type === 'TRABALHO';
  }).length;

  return SECTOR_DEFINITIONS.map((sector) => {
    // Colaboradores alocados neste setor (incluindo membros adicionados/movidos dinamicamente)
    const sectorEmployees = employees.filter((emp) => {
      if (emp.contractType === 'LICENCA_MATERNIDADE' || emp.isCirculating) return false;
      const shift = emp.schedule[day];
      if (shift && sector.chairIds.includes(shift.chairId)) return true;
      if (sector.chairIds.includes(emp.defaultChairId)) return true;
      if (emp.defaultStore === sector.storeId) {
        if (emp.department === sector.departmentId) return true;
        if (sector.id === 'L2-DOC' && emp.department === 'SUCESSO_CLIENTE') return true;
      }
      return false;
    });

    const totalChairs = Math.max(sector.chairIds.length, sectorEmployees.length);
    const minRequired = isSunday
      ? 0
      : resolveSectorMinimum(sector, isSaturday, sectorMinimums, totalChairs);

    let activeHeadcount = 0;
    let coveredHeadcount = 0;
    let offHeadcount = 0;
    const uncoveredEmployees: SectorDailyCoverageResult['uncoveredEmployees'] = [];

    sectorEmployees.forEach((emp) => {
      const shift = emp.schedule[day];
      if (shift?.type === 'TRABALHO') {
        activeHeadcount++;
      } else {
        offHeadcount++;
        if (shift?.coverage?.coveredByEmployeeId) {
          coveredHeadcount++;
        } else {
          uncoveredEmployees.push({
            id: emp.id,
            name: emp.shortName,
            role: emp.role,
            chairId: emp.defaultChairId,
          });
        }
      }
    });

    const autoCoveredByPeersOrSkills: AutoPeerOrSkillCoverage[] = [];
    let currentEffective = activeHeadcount + coveredHeadcount;

    // 1. Rodízio pela mesma função (ex: Vendedores da Matriz cobrindo Área Externa da Filial 777)
    if (
      minRequired > 0 &&
      currentEffective < minRequired &&
      sector.allowSameFunctionPeerRotation &&
      activeL1Sellers.length >= 3
    ) {
      const rotCandidate = activeL1Sellers[0];
      autoCoveredByPeersOrSkills.push({
        employeeName: rotCandidate.shortName,
        label: `Rodízio Vendas (${rotCandidate.shortName})`,
      });
      currentEffective += 1;
    }

    // 2. Cobertura por habilidade cruzada de colaborador ativo em outro setor (ex: Marielly c/ pagamentos)
    if (minRequired > 0 && currentEffective < minRequired && sector.crossSkillBackups) {
      for (const rule of sector.crossSkillBackups) {
        if (currentEffective >= minRequired) break;
        if (rule.blockedDays?.includes(day)) continue;
        const backupEmp = empById.get(rule.employeeId);
        if (!backupEmp || backupEmp.contractType === 'LICENCA_MATERNIDADE') continue;
        if (backupEmp.schedule[day]?.type !== 'TRABALHO') continue;

        // Se for Allisson cobrindo Loja 2 Doc/Assistência, garante que Preparação L1 não fique desfalcada
        if (rule.employeeId === 'emp-allisson' && l1PrepActiveCount <= 2) continue;

        autoCoveredByPeersOrSkills.push({
          employeeName: backupEmp.shortName,
          label: `${backupEmp.shortName} (${rule.skillLabel})`,
        });
        currentEffective += 1;
      }
    }

    // 3. Setor unitário com cobertura nativa da liderança circulante em folga regular 5x2 (ex: Marketing -> Igor/Lorena)
    if (
      minRequired > 0 &&
      currentEffective < minRequired &&
      sector.leadershipCoversSingleRestDay &&
      day !== 'DOM' &&
      sector.primaryBackups.length > 0
    ) {
      const lead = sector.primaryBackups[0];
      const leadShort = lead.name.split(' ')[0];
      autoCoveredByPeersOrSkills.push({
        employeeName: leadShort,
        label: `${leadShort} (Conteúdo/Liderança)`,
      });
      currentEffective += 1;
    }

    const effectiveHeadcount = currentEffective;
    const isUncovered = minRequired > 0 && effectiveHeadcount < minRequired;
    const isSinglePersonManageableLoad =
      !isUncovered &&
      minRequired > 0 &&
      effectiveHeadcount === 1 &&
      totalChairs >= 2;

    let status: SectorDailyCoverageResult['status'] = 'SEGURO';
    let message = `${effectiveHeadcount}/${minRequired} postos preenchidos`;

    if (minRequired === 0) {
      status = 'SEGURO';
      message = 'Sem exigência mínima operacional neste dia';
    } else if (effectiveHeadcount === 0) {
      status = 'CRITICO';
      message = `Setor DESCOBERTO! Zero ativos e sem cobertura compatível (mínimo ${minRequired}).`;
    } else if (effectiveHeadcount < minRequired) {
      status = 'ALERTA';
      message = `Abaixo do mínimo definido: ${effectiveHeadcount}/${minRequired} postos.`;
    } else if (autoCoveredByPeersOrSkills.length > 0) {
      status = 'SEGURO';
      message = `Coberto por habilidade/função: ${autoCoveredByPeersOrSkills
        .map((c) => c.label)
        .join(', ')}.`;
    } else if (isSinglePersonManageableLoad) {
      status = 'SEGURO';
      message = `Coberto por 1 de ${totalChairs} colaboradores (demanda concentrada e gerenciável).`;
    } else if (coveredHeadcount > 0) {
      status = 'SEGURO';
      message = `${activeHeadcount} ativos + ${coveredHeadcount} cobertos manualmente.`;
    }

    return {
      sector,
      day,
      totalChairs,
      activeHeadcount,
      offHeadcount,
      coveredHeadcount,
      autoCoveredByPeersOrSkills,
      effectiveHeadcount,
      minRequired,
      isUncovered,
      isSinglePersonManageableLoad,
      status,
      message,
      uncoveredEmployees,
      suggestedBackups: sector.primaryBackups,
    };
  });
}

/**
 * Calcula a cobertura da semana inteira (Segunda a Sábado) para todos os setores
 */
export function calculateWeeklyCoverageSummary(
  employees: Employee[],
  sectorMinimums?: SectorMinimumsMap
): {
  byDay: Record<DayOfWeek, SectorDailyCoverageResult[]>;
  totalCriticalUncovered: number;
  totalAlertUncovered: number;
  hasCoverageIssue: boolean;
} {
  const byDay: Record<DayOfWeek, SectorDailyCoverageResult[]> = {
    SEG: [],
    TER: [],
    QUA: [],
    QUI: [],
    SEX: [],
    SAB: [],
    DOM: [],
  };

  let totalCriticalUncovered = 0;
  let totalAlertUncovered = 0;

  DAYS_OF_WEEK.forEach((d) => {
    const dailyResults = calculateSectorDailyCoverage(employees, d.key, sectorMinimums);
    byDay[d.key] = dailyResults;

    if (d.key !== 'DOM') {
      dailyResults.forEach((res) => {
        if (res.status === 'CRITICO') totalCriticalUncovered++;
        else if (res.status === 'ALERTA') totalAlertUncovered++;
      });
    }
  });

  return {
    byDay,
    totalCriticalUncovered,
    totalAlertUncovered,
    hasCoverageIssue: totalCriticalUncovered > 0 || totalAlertUncovered > 0,
  };
}

/**
 * Auto-designa coberturas inteligentes para os postos que REALMENTE estiverem
 * descobertos (abaixo do mínimo configurado mesmo após considerar colegas e habilidades).
 */
export function autoAssignCirculatingCoverage(
  employees: Employee[],
  targetDay?: DayOfWeek,
  sectorMinimums?: SectorMinimumsMap
): Employee[] {
  const daysToProcess = targetDay
    ? [targetDay]
    : (['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'] as DayOfWeek[]);

  const clonedEmployees = JSON.parse(JSON.stringify(employees)) as Employee[];

  daysToProcess.forEach((day) => {
    const coverages = calculateSectorDailyCoverage(clonedEmployees, day, sectorMinimums);

    coverages.forEach((cov) => {
      if (cov.isUncovered && cov.uncoveredEmployees.length > 0) {
        const deficit = Math.max(1, cov.minRequired - cov.effectiveHeadcount);
        const toCover = cov.uncoveredEmployees.slice(0, deficit);

        toCover.forEach((unc, idx) => {
          const emp = clonedEmployees.find((e) => e.id === unc.id);
          if (emp && emp.schedule[day] && emp.schedule[day].type !== 'TRABALHO') {
            const selectedBackup = cov.suggestedBackups[idx % cov.suggestedBackups.length];
            if (!selectedBackup) return;
            emp.schedule[day].coverage = {
              coveredByEmployeeId: selectedBackup.id,
              coveredByName: selectedBackup.name,
              coveredByRole: selectedBackup.role,
              notes: 'Designação automática de liderança circulante/backup operacional',
            };
          }
        });
      }
    });
  });

  return clonedEmployees;
}
