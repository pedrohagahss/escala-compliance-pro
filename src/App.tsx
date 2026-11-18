import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  DayOfWeek,
  DayShift,
  DepartmentId,
  Employee,
  EmployeeComplianceResult,
  EmployeeMonthlySummary,
  EmployeePontoMaisSummary,
  LegalPhase,
  PontoMaisStandardConfig,
  Scenario,
  SectorMinimumConfig,
  SectorMinimumsMap,
  StoreHoursMap,
  StoreId,
  StoreOperatingHours,
} from './types/schedule';
import { createDefaultScenarios } from './data/seuCarroData';
import {
  applyStoreOperatingHours,
  balanceActiveWeekForMonthlyTarget,
  balanceAllWeeksToMonthlyTarget,
  balanceScheduleToTarget,
  calculateEmployeeMonthlySummary,
  DEFAULT_STORE_HOURS,
  ensureEmployeeWeeksSchedule,
  formatHoursDecimal,
  LEGAL_PHASES,
  linkEmployeesForNoParallelFolga,
  linkEmployeesForSameFolga,
  moveOrApplyFolgaAcrossWeeks,
  propagateLinkedFolgas,
  replaceEmployeeWeekSchedule,
  unlinkEmployeeFolga,
  unlinkEmployeeNoParallelFolga,
  updateEmployeeLunchHours,
  updateEmployeeShiftAcrossWeeks,
  validateEmployeeCompliance,
} from './utils/compliance';
import {
  autoAssignCirculatingCoverage,
  calculateWeeklyCoverageSummary,
  DEFAULT_SECTOR_MINIMUMS,
} from './utils/coverage';
import {
  calculateEmployeePontoMaisSummary,
  calculatePontoMaisWeeklyHours,
  getDefaultPontoMaisConfig,
  getEffectivePontoMaisConfig,
  validatePontoMaisStandardCap,
} from './utils/pontoMais';
import { getFilteredEmployeeOptions } from './utils/scheduleFilters';
import { getDefaultTodayIso } from './utils/realCalendar';
import { FloorPlanDayView } from './components/FloorPlanDayView';
import { RealCalendarView } from './components/RealCalendarView';
import { MainViewMode, ViewModeBar } from './components/ViewModeBar';
import {
  createNewMember,
  deleteMemberFromTeam,
  NewMemberInput,
  updateMemberProfile,
} from './utils/teamManagement';
import { LeftControlSidebar } from './components/LeftControlSidebar';
import { StoreTopStrip } from './components/StoreTopStrip';
import { ChairScheduleGrid } from './components/ChairScheduleGrid';
import { PrintScheduleModal } from './components/PrintScheduleModal';
import { MemberEditorModal } from './components/MemberEditorModal';
import {
  BAKED_ESCALA_DEFINIDA,
  ESCALA_DEFINIDA_ID,
  SABADO_REGRA_TEXTO,
  snapshotAsEscalaDefinida,
} from './data/escalaDefinida';
import { DEFAULT_ACTIVE_OPTIMIZED_SCENARIO_ID } from './utils/scenarioProposals';
import { Check, AlertTriangle, X, BadgeCheck, Save } from 'lucide-react';

const LOCAL_STORAGE_KEY_SCENARIOS = 'seu_carro_pe_scenarios_v8';
const LOCAL_STORAGE_KEY_ACTIVE_SCENARIO = 'seu_carro_pe_active_scenario_v8';
const LOCAL_STORAGE_KEY_SIDEBAR_COLLAPSED = 'seu_carro_pe_sidebar_collapsed';
const LOCAL_STORAGE_KEY_DEFINIDA_SAVED_AT = 'seu_carro_pe_escala_definida_saved_at';

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* armazenamento indisponível */
  }
}

export default function App() {
  // 1. Scenarios State
  const [scenarios, setScenarios] = useState<Scenario[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY_SCENARIOS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Garante que a Escala Definida gravada no código esteja sempre disponível
          if (BAKED_ESCALA_DEFINIDA && !parsed.some((s: Scenario) => s.id === ESCALA_DEFINIDA_ID)) {
            return [BAKED_ESCALA_DEFINIDA, ...parsed];
          }
          return parsed;
        }
      }
    } catch (e) {
      console.error('Error loading saved scenarios', e);
    }
    return createDefaultScenarios();
  });

  // 2. Active Scenario ID
  // Quando existe a Escala Definida (salva), ela é sempre a escala exibida.
  const [activeScenarioId, setActiveScenarioId] = useState<string>(() => {
    if (scenarios.some((s) => s.id === ESCALA_DEFINIDA_ID)) return ESCALA_DEFINIDA_ID;
    const saved = safeGet(LOCAL_STORAGE_KEY_ACTIVE_SCENARIO);
    return saved || DEFAULT_ACTIVE_OPTIMIZED_SCENARIO_ID;
  });

  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(
    () => safeGet(LOCAL_STORAGE_KEY_SIDEBAR_COLLAPSED) === '1'
  );
  useEffect(() => {
    safeSet(LOCAL_STORAGE_KEY_SIDEBAR_COLLAPSED, sidebarCollapsed ? '1' : '0');
  }, [sidebarCollapsed]);

  const [definidaSavedAt, setDefinidaSavedAt] = useState<string | null>(
    () => safeGet(LOCAL_STORAGE_KEY_DEFINIDA_SAVED_AT) || BAKED_ESCALA_DEFINIDA?.createdAt || null
  );

  const activeScenario = useMemo(() => {
    return scenarios.find((s) => s.id === activeScenarioId) || scenarios[0];
  }, [scenarios, activeScenarioId]);

  // 3. Legal Phase, Store Hours & Sector Minimums
  const currentPhase = activeScenario?.phase || 'FASE_1';
  const storeHours: StoreHoursMap = activeScenario?.storeHours || DEFAULT_STORE_HOURS;
  const sectorMinimums: SectorMinimumsMap = activeScenario?.sectorMinimums || DEFAULT_SECTOR_MINIMUMS;

  // 4. Visualização: 'ALL' (todas as semanas S1–S4 ao mesmo tempo) ou foco em 1..4
  const [selectedWeekFilter, setSelectedWeekFilter] = useState<'ALL' | number>('ALL');

  // 5. Sidebar & Dock Filter States
  const [selectedStore, setSelectedStore] = useState<'ALL' | StoreId>('ALL');
  const [selectedDept, setSelectedDept] = useState<'ALL' | DepartmentId>('ALL');
  const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState<'ALL' | string>('ALL');
  const [selectedDayFilter, setSelectedDayFilter] = useState<'ALL' | DayOfWeek>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // 6. Modals State
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [memberModalState, setMemberModalState] = useState<{
    isOpen: boolean;
    mode: 'create' | 'edit';
    employee?: Employee;
  }>({ isOpen: false, mode: 'create' });
  const [activeMainView, setActiveMainView] = useState<MainViewMode>('FLOOR_PLAN');
  const [selectedRealDateIso, setSelectedRealDateIso] = useState<string>(() => getDefaultTodayIso());

  // Toast message
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Sync to LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_SCENARIOS, JSON.stringify(scenarios));
    } catch (e) {
      console.error('Error saving scenarios to localStorage', e);
    }
  }, [scenarios]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_ACTIVE_SCENARIO, activeScenarioId);
    } catch (e) {
      console.error('Error saving active scenario to localStorage', e);
    }
  }, [activeScenarioId]);

  // Equipe sempre preparada com as 4 semanas S1..S4 independentes
  const preparedEmployees = useMemo(() => {
    if (!activeScenario) return [];
    return activeScenario.employees.map(ensureEmployeeWeeksSchedule);
  }, [activeScenario]);

  const employeeFilterOptions = useMemo(
    () => getFilteredEmployeeOptions(preparedEmployees, selectedStore, selectedDept),
    [preparedEmployees, selectedStore, selectedDept]
  );

  useEffect(() => {
    if (
      selectedEmployeeFilter !== 'ALL' &&
      !employeeFilterOptions.some((opt) => opt.id === selectedEmployeeFilter)
    ) {
      setSelectedEmployeeFilter('ALL');
    }
  }, [employeeFilterOptions, selectedEmployeeFilter]);

  const handleClearAllFilters = () => {
    setSelectedWeekFilter('ALL');
    setSelectedStore('ALL');
    setSelectedDept('ALL');
    setSelectedEmployeeFilter('ALL');
    setSelectedDayFilter('ALL');
    setSearchQuery('');
  };

  const effectiveSingleWeek = selectedWeekFilter === 'ALL' ? 1 : selectedWeekFilter;

  // Equipe projetada para uma única semana (usada em impressão/cálculos pontuais)
  const employeesForSelectedWeek = useMemo(() => {
    return preparedEmployees.map((emp) => ({
      ...emp,
      schedule: emp.weeksSchedule?.[effectiveSingleWeek] || emp.schedule,
    }));
  }, [preparedEmployees, effectiveSingleWeek]);

  // Cálculo mensal automático a cada mudança (soma S1..S4, acúmulo progressivo, folgas por semana)
  const monthlySummaryMap = useMemo(() => {
    const map: Record<string, EmployeeMonthlySummary> = {};
    preparedEmployees.forEach((emp) => {
      map[emp.id] = calculateEmployeeMonthlySummary(emp, currentPhase);
    });
    return map;
  }, [preparedEmployees, currentPhase]);

  // Configuração Padrão do PontoMais (mantida fechada <= teto 42h/40h) e Banco de Horas Automático vs Escala Real
  const pontoMaisConfig = useMemo(
    () => getEffectivePontoMaisConfig(activeScenario, currentPhase),
    [activeScenario, currentPhase]
  );

  const pontoMaisSummaryMap = useMemo(() => {
    const map: Record<string, EmployeePontoMaisSummary> = {};
    preparedEmployees.forEach((emp) => {
      map[emp.id] = calculateEmployeePontoMaisSummary(emp, pontoMaisConfig, currentPhase);
    });
    return map;
  }, [preparedEmployees, pontoMaisConfig, currentPhase]);


  // Compliance calculations (considerando todas as 4 semanas no modo ALL, ou a semana filtrada)
  const complianceMap = useMemo(() => {
    const map: Record<string, EmployeeComplianceResult> = {};
    preparedEmployees.forEach((emp) => {
      const mSum = monthlySummaryMap[emp.id];
      if (selectedWeekFilter === 'ALL' && mSum) {
        const anyViolation = mSum.status === 'VIOLACAO';
        const allViolations = mSum.complianceByWeek.flatMap((c) => c.violations);
        map[emp.id] = {
          employeeId: emp.id,
          totalWeeklyHours: mSum.averageWeeklyHours,
          regularHours: Math.min(mSum.averageWeeklyHours, mSum.weeklyTargetHours),
          overtimeHours: mSum.totalOvertimeHours,
          dailyOvertimeTotal: 0,
          workDaysCount: Math.round(
            mSum.workDaysCountByWeek.reduce((a, b) => a + b, 0) / 4
          ),
          restDaysCount: 7 - Math.round(mSum.workDaysCountByWeek.reduce((a, b) => a + b, 0) / 4),
          isCompliant: !anyViolation,
          hasOvertime: mSum.monthlyBalanceHours > 0.08,
          status: anyViolation
            ? 'VIOLACAO'
            : mSum.monthlyBalanceHours > 0.08
            ? 'HORAS_EXTRAS'
            : 'CONFORME',
          violations: allViolations,
          balanceHours: mSum.monthlyBalanceHours,
        };
      } else {
        const weekSched = emp.weeksSchedule?.[effectiveSingleWeek] || emp.schedule;
        map[emp.id] = validateEmployeeCompliance(emp, currentPhase, weekSched);
      }
    });
    return map;
  }, [preparedEmployees, monthlySummaryMap, selectedWeekFilter, effectiveSingleWeek, currentPhase]);

  const complianceResults = useMemo(() => Object.values(complianceMap), [complianceMap]);
  const compliantCount = complianceResults.filter((r) => r.isCompliant).length;
  const violationCount = complianceResults.filter((r) => r.status === 'VIOLACAO').length;
  const overtimeCount = complianceResults.filter((r) => r.hasOvertime).length;

  // Contagem de pessoas com horas faltantes na semana filtrada
  const shortfallCount = useMemo(() => {
    return employeesForSelectedWeek.filter((e) => {
      if (e.contractType === 'LICENCA_MATERNIDADE' || e.isCirculating) return false;
      const comp = validateEmployeeCompliance(e, currentPhase);
      const maxWeekly = e.contractType === 'ESTAGIARIO' ? 24 : LEGAL_PHASES[currentPhase].maxWeeklyHours;
      return comp.totalWeeklyHours < maxWeekly - 0.08;
    }).length;
  }, [employeesForSelectedWeek, currentPhase]);

  // Contagens mensais automáticas (S1–S4)
  const { monthlyClosedCount, monthlyShortfallCount, monthlyOvertimeCount } = useMemo(() => {
    let closed = 0;
    let shortfall = 0;
    let overtime = 0;
    preparedEmployees.forEach((e) => {
      if (e.contractType === 'LICENCA_MATERNIDADE' || e.isCirculating) return;
      const mSum = monthlySummaryMap[e.id];
      if (!mSum) return;
      if (mSum.monthlyBalanceHours < -0.08) shortfall++;
      else if (mSum.monthlyBalanceHours > 0.08) overtime++;
      else closed++;
    });
    return {
      monthlyClosedCount: closed,
      monthlyShortfallCount: shortfall,
      monthlyOvertimeCount: overtime,
    };
  }, [preparedEmployees, monthlySummaryMap]);

  // Cobertura (de todas as 4 semanas no modo ALL, ou da semana filtrada)
  const coverageStats = useMemo(() => {
    const weeks = selectedWeekFilter === 'ALL' ? [1, 2, 3, 4] : [selectedWeekFilter];
    let critical = 0;
    let alert = 0;
    weeks.forEach((w) => {
      const weekEmps = preparedEmployees.map((emp) => ({
        ...emp,
        schedule: emp.weeksSchedule?.[w] || emp.schedule,
      }));
      const cov = calculateWeeklyCoverageSummary(weekEmps, sectorMinimums);
      critical += cov.totalCriticalUncovered;
      alert += cov.totalAlertUncovered;
    });
    return { critical, alert };
  }, [preparedEmployees, selectedWeekFilter, sectorMinimums]);

  // Atualização de turno na semana (ou múltiplas semanas) direto da grade inline
  const handleUpdateShift = (
    employeeId: string,
    day: DayOfWeek,
    newShift: Partial<DayShift>,
    weekNumberOrList: number | number[]
  ) => {
    const targetWeeks = Array.isArray(weekNumberOrList) ? weekNumberOrList : [weekNumberOrList];
    const shouldSyncFolgas = 'type' in newShift;
    const currentEmp = activeScenario?.employees.find((e) => e.id === employeeId);
    const linkedPartnerNames =
      shouldSyncFolgas && currentEmp?.linkedFolgaIds?.length
        ? currentEmp.linkedFolgaIds
            .map((id) => activeScenario?.employees.find((e) => e.id === id)?.shortName)
            .filter((n): n is string => Boolean(n))
        : [];

    setScenarios((prev) =>
      prev.map((scen) => {
        if (scen.id !== activeScenarioId) return scen;
        const cfg = scen.storeHours || DEFAULT_STORE_HOURS;

        let updatedEmployees = scen.employees.map((emp) => {
          if (emp.id !== employeeId) return emp;
          let updated = emp;
          for (const w of targetWeeks) {
            updated = updateEmployeeShiftAcrossWeeks(updated, w, day, newShift);
          }
          return updated;
        });

        if (shouldSyncFolgas) {
          updatedEmployees = propagateLinkedFolgas(
            updatedEmployees,
            employeeId,
            targetWeeks,
            cfg
          ).employees;
        }

        return {
          ...scen,
          employees: updatedEmployees,
        };
      })
    );

    if (linkedPartnerNames.length > 0) {
      showToast(
        `Folga/escala de ${currentEmp?.shortName} sincronizada com ${linkedPartnerNames.join(', ')}!`
      );
    }
  };

  // Arrastar e soltar Folga (mesma semana OU entre semanas S1-S4 mantendo >=1 folga/sem)
  const handleMoveOrApplyFolga = (
    employeeId: string,
    targetWeek: number,
    targetDay: DayOfWeek,
    sourceDay?: DayOfWeek,
    sourceWeek?: number
  ) => {
    let feedbackMessage: string | undefined;
    const affectedWeeks =
      sourceWeek && sourceWeek !== targetWeek ? [sourceWeek, targetWeek] : [targetWeek];

    if (activeScenario) {
      const cfgPreview = activeScenario.storeHours || DEFAULT_STORE_HOURS;
      const targetEmp = activeScenario.employees.find((e) => e.id === employeeId);
      if (targetEmp) {
        const previewRes = moveOrApplyFolgaAcrossWeeks(targetEmp, targetWeek, targetDay, {
          sourceWeek,
          sourceDay,
          storeHours: cfgPreview,
          allEmployees: activeScenario.employees,
        });
        feedbackMessage = previewRes.message;
        if (previewRes.changed && targetEmp.linkedFolgaIds?.length) {
          const partnerNames = targetEmp.linkedFolgaIds
            .map((id) => activeScenario.employees.find((e) => e.id === id)?.shortName)
            .filter((n): n is string => Boolean(n));
          if (partnerNames.length > 0 && feedbackMessage) {
            feedbackMessage = `${feedbackMessage} (Sincronizado com ${partnerNames.join(', ')})`;
          }
        }
      }
    }

    setScenarios((prev) =>
      prev.map((scen) => {
        if (scen.id !== activeScenarioId) return scen;
        const cfg = scen.storeHours || DEFAULT_STORE_HOURS;
        let changed = false;
        let updatedEmployees = scen.employees.map((emp) => {
          if (emp.id !== employeeId) return emp;
          const res = moveOrApplyFolgaAcrossWeeks(emp, targetWeek, targetDay, {
            sourceWeek,
            sourceDay,
            storeHours: cfg,
            allEmployees: scen.employees,
          });
          changed = res.changed;
          return res.employee;
        });

        if (changed) {
          updatedEmployees = propagateLinkedFolgas(
            updatedEmployees,
            employeeId,
            affectedWeeks,
            cfg
          ).employees;
        }

        return {
          ...scen,
          employees: updatedEmployees,
        };
      })
    );

    if (feedbackMessage) {
      showToast(feedbackMessage);
    }
  };

  // Vincular colaboradores para compartilharem os mesmos dias de folga (S1–S4)
  const handleLinkEmployeesFolga = (
    sourceId: string,
    partnerId: string,
    followPartnerFolgas: boolean
  ) => {
    const sourceEmp = activeScenario?.employees.find((e) => e.id === sourceId);
    const partnerEmp = activeScenario?.employees.find((e) => e.id === partnerId);

    setScenarios((prev) =>
      prev.map((scen) => {
        if (scen.id !== activeScenarioId) return scen;
        const cfg = scen.storeHours || DEFAULT_STORE_HOURS;
        const res = linkEmployeesForSameFolga(
          scen.employees,
          sourceId,
          partnerId,
          followPartnerFolgas,
          cfg
        );
        return {
          ...scen,
          employees: res.employees,
        };
      })
    );

    if (sourceEmp && partnerEmp) {
      const refName = followPartnerFolgas ? partnerEmp.shortName : sourceEmp.shortName;
      showToast(
        `${sourceEmp.shortName} e ${partnerEmp.shortName} vinculados para folgar igual em S1–S4 (padrão de ${refName})!`
      );
    }
  };

  // Desvincular colaborador do grupo de folgas compartilhadas
  const handleUnlinkEmployeeFolga = (employeeId: string) => {
    const targetEmp = activeScenario?.employees.find((e) => e.id === employeeId);

    setScenarios((prev) =>
      prev.map((scen) => {
        if (scen.id !== activeScenarioId) return scen;
        const res = unlinkEmployeeFolga(scen.employees, employeeId);
        return {
          ...scen,
          employees: res.employees,
        };
      })
    );

    if (targetEmp) {
      showToast(`Vínculo de folga igual de ${targetEmp.shortName} removido.`);
    }
  };

  // Vincular proibição de folga em paralelo entre colaboradores (Seg–Sáb S1–S4)
  const handleLinkNoParallelFolga = (
    sourceId: string,
    partnerId: string,
    resolveConflicts: boolean
  ) => {
    const sourceEmp = activeScenario?.employees.find((e) => e.id === sourceId);
    const partnerEmp = activeScenario?.employees.find((e) => e.id === partnerId);
    let resolvedCount = 0;

    if (activeScenario) {
      const cfgPreview = activeScenario.storeHours || DEFAULT_STORE_HOURS;
      resolvedCount = linkEmployeesForNoParallelFolga(
        activeScenario.employees,
        sourceId,
        partnerId,
        resolveConflicts,
        cfgPreview
      ).resolvedConflictsCount;
    }

    setScenarios((prev) =>
      prev.map((scen) => {
        if (scen.id !== activeScenarioId) return scen;
        const cfg = scen.storeHours || DEFAULT_STORE_HOURS;
        const res = linkEmployeesForNoParallelFolga(
          scen.employees,
          sourceId,
          partnerId,
          resolveConflicts,
          cfg
        );
        return {
          ...scen,
          employees: res.employees,
        };
      })
    );

    if (sourceEmp && partnerEmp) {
      const resolvedNote =
        resolveConflicts && resolvedCount > 0
          ? ` (${resolvedCount} conflito(s) em S1–S4 separado(s) automaticamente)`
          : '';
      showToast(
        `Proibição de folga paralela ativa entre ${sourceEmp.shortName} e ${partnerEmp.shortName}${resolvedNote}.`
      );
    }
  };

  // Remover proibição de folga paralela
  const handleUnlinkNoParallelFolga = (employeeId: string, partnerId?: string) => {
    const targetEmp = activeScenario?.employees.find((e) => e.id === employeeId);

    setScenarios((prev) =>
      prev.map((scen) => {
        if (scen.id !== activeScenarioId) return scen;
        const res = unlinkEmployeeNoParallelFolga(scen.employees, employeeId, partnerId);
        return {
          ...scen,
          employees: res.employees,
        };
      })
    );

    if (targetEmp) {
      showToast(`Proibição de folga paralela de ${targetEmp.shortName} removida.`);
    }
  };

  // CRUD de Membros: Incluir
  const handleCreateMember = (input: NewMemberInput) => {
    const cfg = activeScenario?.storeHours || DEFAULT_STORE_HOURS;
    const createdPreview = createNewMember(input, activeScenario?.employees || [], cfg);

    setScenarios((prev) =>
      prev.map((scen) => {
        if (scen.id !== activeScenarioId) return scen;
        const scenCfg = scen.storeHours || DEFAULT_STORE_HOURS;
        const newEmp = createNewMember(input, scen.employees, scenCfg);
        return {
          ...scen,
          employees: [...scen.employees, newEmp],
        };
      })
    );

    showToast(`Colaborador(a) ${createdPreview.shortName} incluído(a) no posto ${createdPreview.defaultChairId}!`);
  };

  // CRUD de Membros: Editar
  const handleUpdateMember = (
    memberId: string,
    patch: Partial<NewMemberInput>,
    rebuildWorkShifts: boolean
  ) => {
    setScenarios((prev) =>
      prev.map((scen) => {
        if (scen.id !== activeScenarioId) return scen;
        const scenCfg = scen.storeHours || DEFAULT_STORE_HOURS;
        return {
          ...scen,
          employees: updateMemberProfile(scen.employees, memberId, patch, {
            rebuildScheduleWithStoreHours: rebuildWorkShifts,
            storeHours: scenCfg,
          }),
        };
      })
    );

    const displayName = patch.shortName || patch.name || 'Membro';
    showToast(`Cadastro de ${displayName} atualizado com sucesso!`);
  };

  // CRUD de Membros: Excluir
  const handleDeleteMember = (memberId: string) => {
    const targetEmp = activeScenario?.employees.find((e) => e.id === memberId);

    setScenarios((prev) =>
      prev.map((scen) => {
        if (scen.id !== activeScenarioId) return scen;
        const res = deleteMemberFromTeam(scen.employees, memberId);
        return {
          ...scen,
          employees: res.employees,
        };
      })
    );

    if (selectedEmployeeFilter === memberId) {
      setSelectedEmployeeFilter('ALL');
    }

    if (targetEmp) {
      showToast(`${targetEmp.shortName} (${targetEmp.defaultChairId}) removido(a) da escala.`);
    }
  };

  // Ajuste rápido apenas do horário de almoço de um colaborador
  const handleUpdateEmployeeLunch = (
    employeeId: string,
    lunchStart: string,
    lunchEnd: string,
    targetWeeks: number[]
  ) => {
    setScenarios((prev) =>
      prev.map((scen) => {
        if (scen.id !== activeScenarioId) return scen;
        const updatedEmployees = scen.employees.map((emp) => {
          if (emp.id !== employeeId) return emp;
          return updateEmployeeLunchHours(emp, lunchStart, lunchEnd, targetWeeks);
        });
        return {
          ...scen,
          employees: updatedEmployees,
        };
      })
    );
    showToast(`Almoço atualizado para ${lunchStart}–${lunchEnd} (${targetWeeks.map((w) => `S${w}`).join(', ')})!`);
  };

  // Atualizar horário de abertura/fechamento de um estabelecimento (Loja 1 ou Loja 2)
  const handleUpdateStoreHours = (
    storeId: StoreId,
    hours: StoreOperatingHours,
    applyToTeam: boolean
  ) => {
    setScenarios((prev) =>
      prev.map((scen) => {
        if (scen.id !== activeScenarioId) return scen;
        const nextStoreHours: StoreHoursMap = {
          ...(scen.storeHours || DEFAULT_STORE_HOURS),
          [storeId]: hours,
        };
        const nextEmployees = applyToTeam
          ? applyStoreOperatingHours(scen.employees, storeId, hours)
          : scen.employees;

        return {
          ...scen,
          storeHours: nextStoreHours,
          employees: nextEmployees,
        };
      })
    );

    const storeLabel = storeId === 'LOJA_1' ? 'Loja 1 (Matriz 546)' : 'Loja 2 (Filial 777)';
    showToast(
      applyToTeam
        ? `Horário da ${storeLabel} atualizado e aplicado aos turnos ativos!`
        : `Horário de referência da ${storeLabel} salvo.`
    );
  };

  // Atualizar efetivo mínimo de um setor (Seg-Sex e Sábado) para definir coberto vs descoberto
  const handleUpdateSectorMinimum = (
    sectorId: string,
    config: SectorMinimumConfig,
    sectorTitle?: string
  ) => {
    setScenarios((prev) =>
      prev.map((scen) => {
        if (scen.id !== activeScenarioId) return scen;
        const nextMinimums: SectorMinimumsMap = {
          ...(scen.sectorMinimums || DEFAULT_SECTOR_MINIMUMS),
          [sectorId]: config,
        };
        return {
          ...scen,
          sectorMinimums: nextMinimums,
        };
      })
    );
    showToast(
      `Efetivo mínimo${sectorTitle ? ` de ${sectorTitle}` : ''}: ${config.weekday} (Seg–Sex) / ${config.saturday} (Sáb).`
    );
  };

  // Batch update com suporte a semana única, múltiplas semanas selecionadas ou todas as 4 semanas
  const handleBatchUpdateEmployees = (
    updatedEmployees: Employee[],
    scope: 'SINGLE_WEEK' | 'SELECTED_WEEKS' | 'ALL_WEEKS' = 'SINGLE_WEEK',
    targetWeeks?: number[]
  ) => {
    const updatedById = new Map(updatedEmployees.map((emp) => [emp.id, emp]));

    setScenarios((prev) =>
      prev.map((scen) => {
        if (scen.id !== activeScenarioId) return scen;

        const mergedEmployees = scen.employees.map((origEmp) => {
          const updatedEmp = updatedById.get(origEmp.id);
          if (!updatedEmp) return origEmp;

          if (scope === 'ALL_WEEKS') {
            const prepared = ensureEmployeeWeeksSchedule(updatedEmp);
            const weeks = JSON.parse(JSON.stringify(prepared.weeksSchedule!));
            return {
              ...prepared,
              weeksSchedule: weeks,
              schedule: weeks[1] || prepared.schedule,
            };
          }

          if (scope === 'SELECTED_WEEKS' && targetWeeks && targetWeeks.length > 0) {
            let current = ensureEmployeeWeeksSchedule(origEmp);
            for (const w of targetWeeks) {
              current = replaceEmployeeWeekSchedule(current, w, updatedEmp.schedule);
            }
            return current;
          }

          const singleWeek = targetWeeks?.[0] || effectiveSingleWeek;
          return replaceEmployeeWeekSchedule(origEmp, singleWeek, updatedEmp.schedule);
        });

        return {
          ...scen,
          employees: mergedEmployees,
        };
      })
    );
  };

  // 1. Equilibrar apenas a semana filtrada (sem mexer nas outras semanas)
  const handleAutoBalanceWeek = () => {
    const maxWeekly = LEGAL_PHASES[currentPhase].maxWeeklyHours;
    const balanced = employeesForSelectedWeek.map((emp) => {
      if (emp.contractType === 'LICENCA_MATERNIDADE' || emp.isCirculating) return emp;
      const targetH = emp.contractType === 'ESTAGIARIO' ? 24 : maxWeekly;
      const newSched = balanceScheduleToTarget(
        emp.schedule,
        targetH,
        'AUTO',
        emp.contractType === 'ESTAGIARIO'
      );
      return { ...emp, schedule: newSched };
    });

    handleBatchUpdateEmployees(balanced, 'SINGLE_WEEK', [effectiveSingleWeek]);
    showToast(`Semana ${effectiveSingleWeek} equilibrada sem alterar as demais semanas!`);
  };

  // 2. Ajustar SOMENTE a semana filtrada para fechar a soma do mês todo
  const handleBalanceWeekForMonth = () => {
    const adjusted = preparedEmployees.map((emp) => {
      if (emp.contractType === 'LICENCA_MATERNIDADE' || emp.isCirculating) return emp;
      const res = balanceActiveWeekForMonthlyTarget(emp, effectiveSingleWeek, currentPhase, 'AUTO');
      const weekSched = res.weeksSchedule?.[effectiveSingleWeek] || res.schedule;
      return { ...res, schedule: weekSched };
    });

    handleBatchUpdateEmployees(adjusted, 'SINGLE_WEEK', [effectiveSingleWeek]);
    showToast(`Semana ${effectiveSingleWeek} ajustada para compensar o acúmulo do mês!`);
  };

  // 3. Ajustar todas as 4 semanas para fechar a soma do mês todo (mantendo folgas de cada semana)
  const handleBalanceAllWeeksForMonth = () => {
    const adjusted = preparedEmployees.map((emp) => {
      if (emp.contractType === 'LICENCA_MATERNIDADE' || emp.isCirculating) return emp;
      return balanceAllWeeksToMonthlyTarget(emp, currentPhase, 'AUTO');
    });

    handleBatchUpdateEmployees(adjusted, 'ALL_WEEKS');
    showToast('Soma das 4 semanas ajustada para fechar a meta mensal preservando as folgas!');
  };

  // Auto-cobrir todas as semanas (quando 'ALL') ou apenas a semana filtrada
  const handleAutoCoverWeeks = () => {
    if (selectedWeekFilter === 'ALL') {
      const updatedAll = preparedEmployees.map((emp) => JSON.parse(JSON.stringify(emp)) as Employee);
      for (let w = 1; w <= 4; w++) {
        const weekTeam = updatedAll.map((emp) => ({
          ...emp,
          schedule: emp.weeksSchedule?.[w] || emp.schedule,
        }));
        const covered = autoAssignCirculatingCoverage(weekTeam, undefined, sectorMinimums);
        covered.forEach((covEmp, idx) => {
          updatedAll[idx].weeksSchedule![w] = covEmp.schedule;
          if (w === 1) updatedAll[idx].schedule = covEmp.schedule;
        });
      }
      handleBatchUpdateEmployees(updatedAll, 'ALL_WEEKS');
      showToast('Coberturas aplicadas automaticamente em todas as 4 semanas (S1–S4)!');
    } else {
      const covered = autoAssignCirculatingCoverage(employeesForSelectedWeek, undefined, sectorMinimums);
      handleBatchUpdateEmployees(covered, 'SINGLE_WEEK', [selectedWeekFilter]);
      showToast(`Coberturas aplicadas na Semana ${selectedWeekFilter}!`);
    }
  };

  // Atualizar Padrão PontoMais (mantendo fechado <= 42h/40h e SEM alterar Escala Real da equipe)
  const handleUpdatePontoMaisConfig = (nextConfig: PontoMaisStandardConfig) => {
    const validation = validatePontoMaisStandardCap(nextConfig, currentPhase);
    if (!validation.valid) {
      showToast(
        validation.message ||
          `PontoMais deve ficar fechado em até ${formatHoursDecimal(validation.maxAllowed)} semanais.`
      );
      return;
    }

    setScenarios((prev) =>
      prev.map((scen) =>
        scen.id === activeScenarioId ? { ...scen, pontoMaisConfig: nextConfig } : scen
      )
    );
    const weeklyH = calculatePontoMaisWeeklyHours(nextConfig);
    showToast(
      `PontoMais fechado em ${formatHoursDecimal(weeklyH)}/sem (${nextConfig.label}). Escala Real preservada para Banco de Horas!`
    );
  };

  // Change legal phase of active scenario
  const handlePhaseChange = (phase: LegalPhase) => {
    setScenarios((prev) =>
      prev.map((scen) => {
        if (scen.id !== activeScenarioId) return scen;
        const currentPm = scen.pontoMaisConfig;
        const nextPm =
          currentPm && validatePontoMaisStandardCap(currentPm, phase).valid
            ? currentPm
            : getDefaultPontoMaisConfig(phase);
        return { ...scen, phase, pontoMaisConfig: nextPm };
      })
    );
    showToast(`Fase legal atualizada para: ${LEGAL_PHASES[phase].badge}`);
  };

  // Export JSON backup
  const handleExportJson = () => {
    const dataStr = JSON.stringify(scenarios, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `seu_carro_pe_escala_atual_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Backup JSON da escala exportado com sucesso.');
  };

  // Import JSON backup
  const handleImportJson = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].employees) {
          setScenarios(parsed);
          setActiveScenarioId(parsed[0].id);
          showToast(`Importados ${parsed.length} cenários com sucesso!`);
        } else {
          showToast('Arquivo JSON inválido. Verifique o formato do backup.');
        }
      } catch {
        showToast('Erro ao processar arquivo JSON.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Salvar a escala atual como a Escala Inicial definida em reunião
  const handleSaveEscalaDefinida = () => {
    if (!activeScenario) return;
    const definida = snapshotAsEscalaDefinida({ ...activeScenario, employees: preparedEmployees });
    setScenarios((prev) => [definida, ...prev.filter((s) => s.id !== ESCALA_DEFINIDA_ID)]);
    setActiveScenarioId(ESCALA_DEFINIDA_ID);
    setDefinidaSavedAt(definida.createdAt);
    safeSet(LOCAL_STORAGE_KEY_DEFINIDA_SAVED_AT, definida.createdAt);

    // Cópia em arquivo (pode ser guardada/enviada e gravada no sistema)
    const blob = new Blob([JSON.stringify(definida, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `escala_definida_seu_carro_pe_${definida.createdAt.slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Escala Inicial salva! Uma cópia (.json) foi baixada para o computador.');
  };

  const handlePrint = () => {
    window.print();
  };

  // Reset to default scenario (in-app confirm modal) — preserva a Escala Definida
  const confirmResetScenarios = () => {
    const definida = scenarios.find((s) => s.id === ESCALA_DEFINIDA_ID);
    const defaults = createDefaultScenarios().filter((s) => s.id !== ESCALA_DEFINIDA_ID);
    setScenarios(definida ? [definida, ...defaults] : defaults);
    setActiveScenarioId(definida ? ESCALA_DEFINIDA_ID : DEFAULT_ACTIVE_OPTIMIZED_SCENARIO_ID);
    setSelectedWeekFilter('ALL');
    setResetConfirmOpen(false);
    showToast('Cenários otimizados e escala padrão restaurados com sucesso.');
  };

  // Sábado active count (média nas 4 semanas se 'ALL', ou da semana filtrada)
  const saturdayActiveCount = useMemo(() => {
    if (selectedWeekFilter === 'ALL') {
      let totalSat = 0;
      for (let w = 1; w <= 4; w++) {
        totalSat += preparedEmployees.filter(
          (e) => e.weeksSchedule?.[w]?.SAB?.type === 'TRABALHO'
        ).length;
      }
      return Math.round(totalSat / 4);
    }
    return employeesForSelectedWeek.filter((e) => e.schedule.SAB?.type === 'TRABALHO').length;
  }, [preparedEmployees, employeesForSelectedWeek, selectedWeekFilter]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileChange}
        className="hidden"
      />

      <div
        className={`flex flex-col lg:flex-row flex-1 min-w-0 ${
          printModalOpen ? 'no-print' : ''
        }`}
      >
      {/* Controladores Fixados do Lado Esquerdo */}
      <LeftControlSidebar
        currentPhase={currentPhase}
        onPhaseChange={handlePhaseChange}
        selectedWeekFilter={selectedWeekFilter}
        onSelectWeekFilter={setSelectedWeekFilter}
        selectedStore={selectedStore}
        onSelectStore={setSelectedStore}
        selectedDept={selectedDept}
        onSelectDept={setSelectedDept}
        selectedEmployeeFilter={selectedEmployeeFilter}
        onSelectEmployeeFilter={setSelectedEmployeeFilter}
        employeeOptions={employeeFilterOptions}
        selectedDayFilter={selectedDayFilter}
        onSelectDayFilter={setSelectedDayFilter}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        complianceSummary={{
          totalEmployees: preparedEmployees.length,
          compliantCount,
          violationCount,
          overtimeCount,
          shortfallCount,
          monthlyClosedCount,
          monthlyShortfallCount,
          monthlyOvertimeCount,
          saturdayActiveCount,
          uncoveredCriticalCount: coverageStats.critical,
          uncoveredAlertCount: coverageStats.alert,
        }}
        onAutoBalanceWeek={handleAutoBalanceWeek}
        onBalanceWeekForMonth={handleBalanceWeekForMonth}
        onBalanceAllWeeksForMonth={handleBalanceAllWeeksForMonth}
        onAutoCoverWeeks={handleAutoCoverWeeks}
        pontoMaisConfig={pontoMaisConfig}
        pontoMaisWeeklyHours={calculatePontoMaisWeeklyHours(pontoMaisConfig)}
        onUpdatePontoMaisConfig={handleUpdatePontoMaisConfig}
        onOpenPrintModal={handlePrint}
        onSaveEscalaDefinida={handleSaveEscalaDefinida}
        isEscalaDefinida={activeScenario?.id === ESCALA_DEFINIDA_ID}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((v) => !v)}
        onExportJson={handleExportJson}
        onImportJson={handleImportJson}
        onResetDefaults={() => setResetConfirmOpen(true)}
        onOpenAddMember={() => setMemberModalState({ isOpen: true, mode: 'create' })}
        onOpenManageMembers={() =>
          setMemberModalState({
            isOpen: true,
            mode: 'edit',
            employee: preparedEmployees[0],
          })
        }
      />

      {/* Área Principal à Direita: Rola independentemente dos controladores fixos */}
      <div className="flex-1 min-w-0 flex flex-col">
        <main className="flex-1 w-full px-2 sm:px-3 py-3 space-y-3">
          {/* Toast Alert */}
          {toastMessage && (
            <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 text-xs border border-slate-700 animate-in fade-in slide-in-from-bottom-2">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="font-semibold">{toastMessage}</span>
            </div>
          )}

          {/* Topo: horário das lojas + minimapa da equipe na data ativa */}
          <StoreTopStrip
            storeHours={storeHours}
            onApplyStoreHours={(storeId, hours) => handleUpdateStoreHours(storeId, hours, true)}
            employees={preparedEmployees}
            dateIso={selectedRealDateIso}
          />

          {/* Alternador Principal de Visualizações (Tela Inicial: Planta Simulada do Dia) */}
          <ViewModeBar
            activeView={activeMainView}
            onChangeView={setActiveMainView}
            selectedDateIso={selectedRealDateIso}
            onJumpToday={() => {
              setSelectedRealDateIso(getDefaultTodayIso());
              setActiveMainView('FLOOR_PLAN');
            }}
          />

          {/* Faixa da Escala em Vigor (substitui os botões de sugestão de cenários) */}
          {activeScenario && (
            <section
              aria-label="Escala em vigor"
              className={`no-print border px-3 py-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs ${
                activeScenario.id === ESCALA_DEFINIDA_ID
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  : 'bg-amber-50 border-amber-300 text-amber-900'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                {activeScenario.id === ESCALA_DEFINIDA_ID ? (
                  <BadgeCheck className="w-4 h-4 shrink-0 text-emerald-600" />
                ) : (
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                )}
                <span className="font-bold truncate">
                  {activeScenario.id === ESCALA_DEFINIDA_ID
                    ? activeScenario.name
                    : `${activeScenario.shortTag} — ainda não salva (use "Salvar Escala Definida" no menu lateral)`}
                </span>
                {activeScenario.id === ESCALA_DEFINIDA_ID && (
                  <span className="font-mono text-[11px] text-emerald-700 shrink-0">
                    {definidaSavedAt &&
                      `salva em ${new Date(definidaSavedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}`}
                  </span>
                )}
              </div>
            </section>
          )}

          {/* Regra do sábado (aparece também na impressão) */}
          <p className="border border-slate-300 bg-white px-3 py-2 text-[11px] text-slate-700 leading-snug">
            <strong className="text-slate-900">Escala inicial — vigente a partir de sábado 21/11/2026.</strong>{' '}
            {SABADO_REGRA_TEXTO}
          </p>

          {/* Visualização 1 (Padrão Inicial): Planta Simulada do Dia por Setor com Setas */}
          {activeMainView === 'FLOOR_PLAN' && (
            <FloorPlanDayView
              employees={preparedEmployees}
              selectedDateIso={selectedRealDateIso}
              onChangeDateIso={setSelectedRealDateIso}
              storeHours={storeHours}
              sectorMinimums={sectorMinimums}
              selectedStore={selectedStore}
              selectedDept={selectedDept}
              selectedEmployeeFilter={selectedEmployeeFilter}
              searchQuery={searchQuery}
              onOpenCalendarView={() => setActiveMainView('REAL_CALENDAR')}
              onOpenGridView={(focusWeek, focusDay) => {
                if (focusWeek && focusWeek >= 1 && focusWeek <= 4) {
                  setSelectedWeekFilter(focusWeek as 1 | 2 | 3 | 4);
                }
                if (
                  focusDay &&
                  ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB', 'DOM'].includes(focusDay)
                ) {
                  setSelectedDayFilter(focusDay as DayOfWeek);
                }
                setActiveMainView('WEEKLY_GRID');
              }}
            />
          )}

          {/* Visualização 2: Calendário Real (Mês / Projeção / Zoom Out Multi-Mês) */}
          {activeMainView === 'REAL_CALENDAR' && (
            <RealCalendarView
              employees={preparedEmployees}
              selectedDateIso={selectedRealDateIso}
              onSelectDateAndOpenFloorPlan={(dateIso) => {
                setSelectedRealDateIso(dateIso);
                setActiveMainView('FLOOR_PLAN');
              }}
              storeHours={storeHours}
              sectorMinimums={sectorMinimums}
              selectedStore={selectedStore}
              selectedDept={selectedDept}
              selectedEmployeeFilter={selectedEmployeeFilter}
              onSelectEmployeeFilter={setSelectedEmployeeFilter}
            />
          )}

          {/* Visualização 3: O Tabuleiro Principal com Todas as Semanas Simultâneas ou Semana Filtrada */}
          {activeMainView === 'WEEKLY_GRID' && (
            <ChairScheduleGrid
            employees={preparedEmployees}
            currentPhase={currentPhase}
            selectedWeekFilter={selectedWeekFilter}
            onSelectWeekFilter={setSelectedWeekFilter}
            selectedStore={selectedStore}
            onSelectStore={setSelectedStore}
            selectedDept={selectedDept}
            onSelectDept={setSelectedDept}
            selectedEmployeeFilter={selectedEmployeeFilter}
            onSelectEmployeeFilter={setSelectedEmployeeFilter}
            employeeOptions={employeeFilterOptions}
            selectedDayFilter={selectedDayFilter}
            onSelectDayFilter={setSelectedDayFilter}
            searchQuery={searchQuery}
            onClearFilters={handleClearAllFilters}
            monthlySummaryMap={monthlySummaryMap}
            pontoMaisSummaryMap={pontoMaisSummaryMap}
            storeHours={storeHours}
            sectorMinimums={sectorMinimums}
            onUpdateShift={handleUpdateShift}
            onBatchUpdateEmployees={handleBatchUpdateEmployees}
            onMoveOrApplyFolga={handleMoveOrApplyFolga}
            onUpdateEmployeeLunch={handleUpdateEmployeeLunch}
            onUpdateStoreHours={handleUpdateStoreHours}
            onUpdateSectorMinimum={handleUpdateSectorMinimum}
            onLinkFolgaPartner={handleLinkEmployeesFolga}
            onUnlinkFolgaPartner={handleUnlinkEmployeeFolga}
            onLinkNoParallelFolga={handleLinkNoParallelFolga}
            onUnlinkNoParallelFolga={handleUnlinkNoParallelFolga}
            onOpenAddMember={() => setMemberModalState({ isOpen: true, mode: 'create' })}
            onOpenEditMember={(emp) =>
              setMemberModalState({ isOpen: true, mode: 'edit', employee: emp })
            }
                onNotify={showToast}
            />
          )}
        </main>

        {/* App Footer */}
        <footer className="no-print bg-white border-t border-slate-200 py-4 text-xs text-slate-500 mt-8">
          <div className="px-3 flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
            <div>
              <strong className="text-slate-900">Seu Carro PE</strong> &bull; Sistema de Gestão Operacional de Escala 5x2 (EC 141/2026 &amp; CLT)
            </div>
            <div className="font-mono text-slate-400">
              Matriz 546 &bull; Filial 777 &bull; Visão Simultânea S1–S4 c/ Acúmulo Mensal Automático
            </div>
          </div>
        </footer>
      </div>
      </div>

      {/* Modal de Confirmação de Restauração */}
      {resetConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2 text-rose-700 font-bold text-sm">
                <AlertTriangle className="w-5 h-5" />
                <span>Restaurar Escala Padrão</span>
              </div>
              <button
                type="button"
                onClick={() => setResetConfirmOpen(false)}
                aria-label="Fechar confirmação"
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 text-xs text-slate-700 leading-relaxed">
              Deseja restaurar a escala padrão da <strong>Seu Carro PE</strong>? Suas alterações salvas nas 4 semanas serão redefinidas.
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-slate-200 bg-slate-50">
              <button
                type="button"
                onClick={() => setResetConfirmOpen(false)}
                className="px-3.5 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-200 font-semibold text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmResetScenarios}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs cursor-pointer"
              >
                Sim, Restaurar Padrão
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals Auxiliares */}
      {printModalOpen && (
        <PrintScheduleModal
          isOpen={printModalOpen}
          onClose={() => setPrintModalOpen(false)}
          employees={preparedEmployees}
          complianceMap={complianceMap}
          monthlySummaryMap={monthlySummaryMap}
          pontoMaisConfig={pontoMaisConfig}
          pontoMaisSummaryMap={pontoMaisSummaryMap}
          activeWeekIndex={effectiveSingleWeek}
          selectedWeekFilter={selectedWeekFilter}
          currentPhase={currentPhase}
        />
      )}

      {memberModalState.isOpen && (
        <MemberEditorModal
          isOpen={memberModalState.isOpen}
          mode={memberModalState.mode}
          initialEmployee={memberModalState.employee}
          employees={preparedEmployees}
          onClose={() => setMemberModalState({ isOpen: false, mode: 'create' })}
          onCreateMember={handleCreateMember}
          onUpdateMember={handleUpdateMember}
          onDeleteMember={handleDeleteMember}
        />
      )}


    </div>
  );
}

