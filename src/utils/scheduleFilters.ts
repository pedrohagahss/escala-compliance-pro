import {
  ChairDefinition,
  DayOfWeek,
  DepartmentId,
  Employee,
  StoreId,
} from '../types/schedule';

export interface DayColumnInfo {
  key: DayOfWeek;
  label: string;
  shortLabel: string;
  isWeekend: boolean;
}

export interface ScheduleFilterCriteria {
  selectedStore: 'ALL' | StoreId;
  selectedDept: 'ALL' | DepartmentId;
  selectedEmployeeId: 'ALL' | string;
  selectedDay: 'ALL' | DayOfWeek;
  searchQuery: string;
}

/**
 * Retorna os dias da semana visíveis na grade conforme o filtro de dia.
 */
export function getVisibleDays(
  allDays: DayColumnInfo[],
  selectedDay: 'ALL' | DayOfWeek
): DayColumnInfo[] {
  if (selectedDay === 'ALL') return allDays;
  const matched = allDays.filter((d) => d.key === selectedDay);
  return matched.length > 0 ? matched : allDays;
}

/**
 * Resolve o ocupante principal de uma cadeira considerando as semanas visíveis.
 * Sempre prioriza o titular cadastrado na cadeira (defaultChairId === chairId) para
 * jamais duplicar outro colaborador que apenas tenha feito cobertura/rodízio nela.
 */
export function findChairOccupant(
  chairId: string,
  employees: Employee[],
  visibleWeeks: number[]
): Employee | undefined {
  const primaryOwner = employees.find((emp) => emp.defaultChairId === chairId);
  if (primaryOwner) {
    return primaryOwner;
  }

  return employees.find(
    (emp) =>
      !emp.defaultChairId &&
      visibleWeeks.some((w) =>
        Object.values(emp.weeksSchedule?.[w] || emp.schedule).some(
          (s) => s.chairId === chairId && s.type === 'TRABALHO'
        )
      )
  );
}

/**
 * Filtra as cadeiras de uma seção por colaborador selecionado e busca textual.
 */
export function filterSectionChairs(
  chairDefs: ChairDefinition[],
  employees: Employee[],
  visibleWeeks: number[],
  selectedEmployeeId: 'ALL' | string,
  searchQuery: string
): ChairDefinition[] {
  const q = searchQuery.trim().toLowerCase();

  return chairDefs.filter((chair) => {
    const occupant = findChairOccupant(chair.id, employees, visibleWeeks);

    if (selectedEmployeeId !== 'ALL') {
      if (!occupant || occupant.id !== selectedEmployeeId) {
        return false;
      }
    }

    if (!q) return true;

    return (
      chair.name.toLowerCase().includes(q) ||
      chair.code.toLowerCase().includes(q) ||
      (occupant ? occupant.name.toLowerCase().includes(q) || occupant.shortName.toLowerCase().includes(q) : false)
    );
  });
}

/**
 * Lista colaboradores selecionáveis no filtro (respeitando loja e setor ativos).
 */
export function getFilteredEmployeeOptions(
  employees: Employee[],
  selectedStore: 'ALL' | StoreId,
  selectedDept: 'ALL' | DepartmentId
): { id: string; label: string; department: DepartmentId; store: StoreId }[] {
  return employees
    .filter((emp) => {
      if (emp.contractType === 'LICENCA_MATERNIDADE' || emp.isCirculating) return false;
      if (selectedStore !== 'ALL' && emp.defaultStore !== selectedStore) return false;
      if (selectedDept !== 'ALL' && emp.department !== selectedDept) return false;
      return true;
    })
    .map((emp) => ({
      id: emp.id,
      label: `${emp.shortName} (${emp.defaultChairId})`,
      department: emp.department,
      store: emp.defaultStore,
    }));
}
