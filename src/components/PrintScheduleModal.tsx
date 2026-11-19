import React, { useEffect, useState } from 'react';
import {
  DayOfWeek,
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
import { CHAIRS } from '../data/seuCarroData';
import {
  DAYS_OF_WEEK,
  DEFAULT_STORE_HOURS,
  LEGAL_PHASES,
  ensureEmployeeWeeksSchedule,
  formatHoursDecimal,
} from '../utils/compliance';
import { DEFAULT_SECTOR_MINIMUMS, SECTOR_DEFINITIONS } from '../utils/coverage';
import { calculatePontoMaisWeeklyHours } from '../utils/pontoMais';
import { findChairOccupant } from '../utils/scheduleFilters';
import { buildSectionChairs } from '../utils/teamManagement';
import { CalendarOff, Clock, Layers, Printer, Table2, X } from 'lucide-react';

export interface PrintableSectorDefinition {
  key: string;
  storeId: StoreId;
  storeName: string;
  storeCode: string;
  deptId: DepartmentId;
  title: string;
  shortTitle: string;
  iconColor: string;
  chairIds: string[];
}

export const PRINTABLE_SECTORS: PrintableSectorDefinition[] = [
  {
    key: 'LOJA_1::SDR',
    storeId: 'LOJA_1',
    storeName: 'Loja 1 — Matriz 546',
    storeCode: 'MATRIZ 546',
    deptId: 'SDR',
    title: 'Sala de SDRs (Pré-vendas)',
    shortTitle: 'L1 • SDR (Pré-vendas)',
    iconColor: '#2563EB',
    chairIds: ['SDR-1', 'SDR-2', 'SDR-3', 'SDR-4'],
  },
  {
    key: 'LOJA_1::VENDAS',
    storeId: 'LOJA_1',
    storeName: 'Loja 1 — Matriz 546',
    storeCode: 'MATRIZ 546',
    deptId: 'VENDAS',
    title: 'Pátio de Vendedores',
    shortTitle: 'L1 • Vendas Matriz',
    iconColor: '#059669',
    chairIds: ['VEND-L1-1', 'VEND-L1-2', 'VEND-L1-3', 'VEND-L1-4'],
  },
  {
    key: 'LOJA_1::PREPARACAO',
    storeId: 'LOJA_1',
    storeName: 'Loja 1 — Matriz 546',
    storeCode: 'MATRIZ 546',
    deptId: 'PREPARACAO',
    title: 'Base da Preparação & Zeladoria',
    shortTitle: 'L1 • Preparação & Zeladoria',
    iconColor: '#D97706',
    chairIds: ['PREP-1', 'PREP-2', 'PREP-3', 'PREP-4'],
  },
  {
    key: 'LOJA_1::MARKETING',
    storeId: 'LOJA_1',
    storeName: 'Loja 1 — Matriz 546',
    storeCode: 'MATRIZ 546',
    deptId: 'MARKETING',
    title: 'Marketing & Conteúdo',
    shortTitle: 'L1 • Marketing',
    iconColor: '#4F46E5',
    chairIds: ['MKT-1'],
  },
  {
    key: 'LOJA_2::VENDAS',
    storeId: 'LOJA_2',
    storeName: 'Loja 2 — Filial 777',
    storeCode: 'FILIAL 777',
    deptId: 'VENDAS',
    title: 'Área Externa (Vendedor Externo)',
    shortTitle: 'L2 • Vendas Filial 777',
    iconColor: '#059669',
    chairIds: ['VEND-L2-EXT'],
  },
  {
    key: 'LOJA_2::DOCUMENTACAO',
    storeId: 'LOJA_2',
    storeName: 'Loja 2 — Filial 777',
    storeCode: 'FILIAL 777',
    deptId: 'DOCUMENTACAO',
    title: 'Escritório de Atendimento (Baias de Doc & Pós-Venda)',
    shortTitle: 'L2 • Documentação & Pós-Venda',
    iconColor: '#7C3AED',
    chairIds: ['DOC-SUP', 'DOC-AUX', 'DOC-EST', 'SC-1'],
  },
  {
    key: 'LOJA_2::FINANCEIRO',
    storeId: 'LOJA_2',
    storeName: 'Loja 2 — Filial 777',
    storeCode: 'FILIAL 777',
    deptId: 'FINANCEIRO',
    title: 'Escritório 2 — Financeiro & Pagamentos',
    shortTitle: 'L2 • Financeiro',
    iconColor: '#DB2777',
    chairIds: ['FIN-1'],
  },
];

const DAY_FULL_LABEL: Record<DayOfWeek, string> = {
  SEG: 'Segunda-feira',
  TER: 'Terça-feira',
  QUA: 'Quarta-feira',
  QUI: 'Quinta-feira',
  SEX: 'Sexta-feira',
  SAB: 'Sábado',
  DOM: 'Domingo',
};

const DAY_SHORT_LABEL: Record<DayOfWeek, string> = {
  SEG: 'Segunda',
  TER: 'Terça',
  QUA: 'Quarta',
  QUI: 'Quinta',
  SEX: 'Sexta',
  SAB: 'Sábado',
  DOM: 'Domingo',
};

interface PrintScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  complianceMap: Record<string, EmployeeComplianceResult>;
  monthlySummaryMap?: Record<string, EmployeeMonthlySummary>;
  pontoMaisConfig?: PontoMaisStandardConfig;
  pontoMaisSummaryMap?: Record<string, EmployeePontoMaisSummary>;
  activeWeekIndex?: number;
  selectedWeekFilter?: 'ALL' | number;
  currentPhase: LegalPhase;
  storeHours?: StoreHoursMap;
  sectorMinimums?: SectorMinimumsMap;
  initialStoreFilter?: 'ALL' | StoreId;
  initialSectorKey?: 'ALL' | string;
  initialFolgasOnly?: boolean;
}

export const PrintScheduleModal: React.FC<PrintScheduleModalProps> = ({
  isOpen,
  onClose,
  employees,
  complianceMap,
  monthlySummaryMap,
  pontoMaisConfig,
  pontoMaisSummaryMap,
  activeWeekIndex = 1,
  selectedWeekFilter = 'ALL',
  currentPhase,
  storeHours = DEFAULT_STORE_HOURS,
  sectorMinimums = DEFAULT_SECTOR_MINIMUMS,
  initialStoreFilter = 'ALL',
  initialSectorKey = 'ALL',
  initialFolgasOnly = false,
}) => {
  const [printWeek, setPrintWeek] = useState<'ALL' | number>(
    selectedWeekFilter === 'ALL' ? 'ALL' : activeWeekIndex
  );
  const [printMode, setPrintMode] = useState<'BY_SECTOR' | 'UNIFIED'>('BY_SECTOR');
  const [folgasOnly, setFolgasOnly] = useState<boolean>(initialFolgasOnly);
  const [folgasLayout, setFolgasLayout] = useState<'BOTH' | 'SUMMARY_S1_S4' | 'GRID_NO_HOURS'>(
    'BOTH'
  );
  const [storeFilter, setStoreFilter] = useState<'ALL' | StoreId>(initialStoreFilter);
  const [sectorKeyFilter, setSectorKeyFilter] = useState<'ALL' | string>(initialSectorKey);
  const [pageBreakPerSector, setPageBreakPerSector] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setPrintWeek(selectedWeekFilter === 'ALL' ? 'ALL' : activeWeekIndex);
      setStoreFilter(initialStoreFilter);
      setSectorKeyFilter(initialSectorKey);
      setFolgasOnly(initialFolgasOnly);
      setPrintMode('BY_SECTOR');
    }
  }, [
    isOpen,
    selectedWeekFilter,
    activeWeekIndex,
    initialStoreFilter,
    initialSectorKey,
    initialFolgasOnly,
  ]);

  if (!isOpen) return null;

  const phaseConfig = LEGAL_PHASES[currentPhase];
  const todayStr = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const preparedEmployees = employees.map(ensureEmployeeWeeksSchedule);
  const weeksToPrint = printWeek === 'ALL' ? [1, 2, 3, 4] : [printWeek];

  const handlePrint = () => {
    window.print();
  };

  const handleSelectSingleSectorAndPrint = (
    sec: PrintableSectorDefinition,
    onlyFolgas?: boolean
  ) => {
    setPrintMode('BY_SECTOR');
    setStoreFilter(sec.storeId);
    setSectorKeyFilter(sec.key);
    if (onlyFolgas !== undefined) {
      setFolgasOnly(onlyFolgas);
    }
    window.setTimeout(() => {
      window.print();
    }, 80);
  };

  const visibleSectors = PRINTABLE_SECTORS.filter((sec) => {
    if (storeFilter !== 'ALL' && sec.storeId !== storeFilter) return false;
    if (sectorKeyFilter === 'ALL') return true;
    if (sectorKeyFilter.startsWith('DEPT::')) {
      const deptId = sectorKeyFilter.replace('DEPT::', '');
      if (deptId === 'SUCESSO_CLIENTE' && sec.key === 'LOJA_2::DOCUMENTACAO') return true;
      return sec.deptId === deptId;
    }
    return sec.key === sectorKeyFilter;
  });

  const visibleUnifiedEmployees = preparedEmployees.filter((emp) => {
    if (storeFilter !== 'ALL' && emp.defaultStore !== storeFilter) return false;
    if (sectorKeyFilter === 'ALL') return true;
    if (sectorKeyFilter.startsWith('DEPT::')) {
      const deptId = sectorKeyFilter.replace('DEPT::', '');
      return emp.department === deptId;
    }
    const targetSec = PRINTABLE_SECTORS.find((s) => s.key === sectorKeyFilter);
    if (!targetSec) return true;
    const chairDefs = buildSectionChairs(
      targetSec.chairIds,
      targetSec.storeId,
      targetSec.deptId,
      preparedEmployees,
      CHAIRS
    );
    const chairIdSet = new Set(chairDefs.map((c) => c.id));
    return chairIdSet.has(emp.defaultChairId);
  });

  const getWeekFolgaDays = (emp: Employee, weekNum: number): DayOfWeek[] => {
    const weekSched = emp.weeksSchedule?.[weekNum] || emp.schedule;
    return (['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'] as DayOfWeek[]).filter(
      (d) => weekSched[d] && weekSched[d].type !== 'TRABALHO'
    );
  };

  // Renderiza o quadro resumo S1 a S4 focado 100% nas folgas (1 linha por colaborador, sem horários)
  const renderFolgasSummaryTable = (
    rows: Array<{ emp: Employee; chairCode?: string; chairName?: string }>
  ) => {
    return (
      <div className="overflow-x-auto">
        <table
          data-folgas-summary-table="true"
          className="w-full text-left border-collapse border border-slate-300 text-xs"
        >
          <thead>
            <tr className="bg-emerald-900 text-white font-bold border-b border-slate-300 text-[10px] uppercase print:bg-slate-200 print:text-slate-900">
              <th className="py-2 px-2.5 border border-slate-300 w-[24%]">
                Cadeira / Colaborador / Função
              </th>
              <th className="py-2 px-2 text-center border border-slate-300 w-[13%]">
                Horário de Intervalo
              </th>
              {weeksToPrint.map((wNum) => (
                <th
                  key={`sum-head-s${wNum}`}
                  className="py-2 px-2 text-center border border-slate-300"
                >
                  Folga 5x2 — Semana S{wNum}
                </th>
              ))}
              <th className="py-2 px-2 text-center border border-slate-300 w-[11%]">
                Descanso Fixo (DSR)
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ emp, chairCode, chairName }) => {
              if (emp.contractType === 'LICENCA_MATERNIDADE') {
                return (
                  <tr
                    key={`${emp.id}-folga-sum-lic`}
                    className="border-b border-slate-300 bg-rose-50/40"
                  >
                    <td className="py-2 px-2.5 border border-slate-300 font-medium">
                      <div className="flex items-center gap-1.5">
                        {chairCode && (
                          <span className="font-mono text-[10px] font-bold px-1 py-0.5 bg-slate-100 border border-slate-300 text-slate-800">
                            {chairCode}
                          </span>
                        )}
                        <span className="font-bold text-slate-900">{emp.name}</span>
                      </div>
                      <div className="text-[10px] text-slate-600 mt-0.5">
                        {chairName ? `${chairName} • ` : ''}
                        {emp.role}
                      </div>
                    </td>
                    <td
                      colSpan={weeksToPrint.length + 2}
                      className="py-2 px-2 text-center border border-slate-300 text-[10.5px] font-bold text-rose-800"
                    >
                      Licença-Maternidade (Afastamento Integral)
                    </td>
                  </tr>
                );
              }

              return (
                <tr key={`${emp.id}-folga-sum`} className="border-b border-slate-300">
                  <td className="py-2 px-2.5 border border-slate-300 font-medium">
                    <div className="flex flex-wrap items-center gap-1">
                      {chairCode && (
                        <span className="font-mono text-[10px] font-bold px-1 py-0.5 bg-slate-100 border border-slate-300 text-slate-800">
                          {chairCode}
                        </span>
                      )}
                      <span className="font-bold text-slate-900">{emp.name}</span>
                    </div>
                    <div className="text-[10px] text-slate-600 mt-0.5">
                      {chairName ? `${chairName} • ` : ''}
                      {emp.role} ({emp.defaultStore === 'LOJA_1' ? 'Matriz 546' : 'Filial 777'})
                    </div>
                  </td>

                  <td className="py-2 px-2 text-center border border-slate-300 font-mono font-bold text-[10.5px] text-amber-950 bg-amber-50/50">
                    {emp.contractType === 'ESTAGIARIO'
                      ? 'Sem intervalo (Estágio)'
                      : `${emp.defaultLunchStart || '12:00'}–${emp.defaultLunchEnd || '13:30'}`}
                  </td>

                  {weeksToPrint.map((wNum) => {
                    const offDays = getWeekFolgaDays(emp, wNum);
                    return (
                      <td
                        key={`${emp.id}-fsum-w${wNum}`}
                        className="py-2 px-2 text-center border border-slate-300 align-middle"
                      >
                        {offDays.length > 0 ? (
                          <div className="inline-flex flex-wrap items-center justify-center gap-1">
                            {offDays.map((dKey) => (
                              <span
                                key={dKey}
                                className={`px-2 py-0.5 font-extrabold text-[11px] border ${
                                  dKey === 'SAB'
                                    ? 'bg-blue-700 text-white border-blue-900 print:bg-blue-100 print:text-blue-950 print:border-blue-800'
                                    : 'bg-emerald-700 text-white border-emerald-900 print:bg-emerald-100 print:text-emerald-950 print:border-emerald-800'
                                }`}
                              >
                                {DAY_FULL_LABEL[dKey]}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[10.5px] font-semibold text-slate-500">
                            Seg a Sáb (Estágio / Só Dom)
                          </span>
                        )}
                      </td>
                    );
                  })}

                  <td className="py-2 px-2 text-center border border-slate-300 font-bold text-[10.5px] text-slate-700 bg-slate-50">
                    Domingo (DSR)
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  // Renderiza as linhas da grade Seg..Dom (com horários ou SÓ FOLGAS sem horários)
  const renderEmployeeRows = (
    rows: Array<{ emp: Employee; chairCode?: string; chairName?: string }>
  ) => {
    return rows.map(({ emp, chairCode, chairName }) => {
      const mSum = monthlySummaryMap?.[emp.id];
      const fallbackComp = complianceMap[emp.id];

      if (emp.contractType === 'LICENCA_MATERNIDADE') {
        return (
          <tr key={`${emp.id}-licenca`} className="border-b border-slate-300 bg-rose-50/30">
            <td className="py-2 px-2 border border-slate-300 font-medium align-top">
              <div className="flex items-center gap-1.5">
                {chairCode && (
                  <span className="font-mono text-[10px] font-bold px-1 py-0.5 bg-slate-100 border border-slate-300 text-slate-800">
                    {chairCode}
                  </span>
                )}
                <span className="font-bold text-slate-900">{emp.name}</span>
              </div>
              <div className="text-[10px] text-slate-600 mt-0.5">
                {chairName ? `${chairName} • ` : ''}
                {emp.role} ({emp.defaultStore === 'LOJA_1' ? 'Matriz 546' : 'Filial 777'})
              </div>
            </td>
            <td className="py-1.5 px-1 text-center border border-slate-300 font-mono font-bold text-[10px] text-rose-700">
              {printWeek === 'ALL' ? 'S1–S4' : `S${printWeek}`}
            </td>
            <td
              colSpan={DAYS_OF_WEEK.length}
              className="py-1.5 px-2 text-center border border-slate-300 text-[10px] font-semibold text-rose-800"
            >
              Licença-Maternidade &bull; Posto coberto na operação
            </td>
            {folgasOnly ? (
              <td className="py-1.5 px-2 text-center border border-slate-300 font-semibold text-[10px] text-rose-700">
                Licença Integral
              </td>
            ) : (
              <>
                <td className="py-1.5 px-2 text-center border border-slate-300 font-mono text-[10px] text-slate-500">
                  0h00
                </td>
                <td className="py-1.5 px-2 text-center border border-slate-300 font-semibold text-[10px] text-emerald-700">
                  Conforme
                </td>
              </>
            )}
          </tr>
        );
      }

      return weeksToPrint.map((wNum, wIdx) => {
        const weekSched = emp.weeksSchedule?.[wNum] || emp.schedule;
        const weekHours = mSum?.weeklyHours[wNum - 1] ?? fallbackComp?.totalWeeklyHours ?? 0;
        const weekComp = mSum?.complianceByWeek[wNum - 1] || fallbackComp;
        const isFirst = wIdx === 0;
        const offDaysInWeek = getWeekFolgaDays(emp, wNum);

        return (
          <tr
            key={`${emp.id}-p-${wNum}`}
            className={`border-b border-slate-200 ${
              isFirst ? 'border-t-2 border-t-slate-300' : ''
            }`}
          >
            {isFirst && (
              <td
                rowSpan={weeksToPrint.length}
                className="py-2 px-2 border border-slate-300 font-medium align-top"
              >
                <div className="flex flex-wrap items-center gap-1">
                  {chairCode && (
                    <span className="font-mono text-[10px] font-bold px-1 py-0.5 bg-slate-100 border border-slate-300 text-slate-800">
                      {chairCode}
                    </span>
                  )}
                  <span className="font-bold text-slate-900">{emp.name}</span>
                </div>
                <div className="text-[10px] text-slate-600 mt-0.5">
                  {chairName ? `${chairName} • ` : ''}
                  {emp.role} ({emp.defaultStore === 'LOJA_1' ? 'Matriz 546' : 'Filial 777'})
                </div>
                <div className="text-[9.5px] font-mono text-slate-700 mt-0.5">
                  {emp.contractType === 'ESTAGIARIO'
                    ? 'Estágio 24h/sem (Sem intervalo)'
                    : `Intervalo / Almoço: ${emp.defaultLunchStart || '12:00'}–${emp.defaultLunchEnd || '13:30'}`}
                </div>
              </td>
            )}

            <td className="py-1.5 px-1 text-center border border-slate-300 font-mono font-bold text-[10px]">
              S{wNum}
            </td>

            {DAYS_OF_WEEK.map((d) => {
              const shift = weekSched[d.key];
              const isOff5x2 = shift?.type === 'FOLGA_5X2';
              const isDsr = shift?.type === 'FOLGA_DSR';
              const isLic = shift?.type === 'LICENCA';
              const isWork = shift?.type === 'TRABALHO';

              if (folgasOnly) {
                return (
                  <td
                    key={d.key}
                    className={`py-1.5 px-1 text-center border border-slate-300 text-[10px] ${
                      isOff5x2
                        ? 'bg-emerald-700 text-white font-black print:bg-emerald-100 print:text-emerald-950'
                        : isDsr
                        ? 'bg-slate-200 text-slate-800 font-bold'
                        : 'bg-white text-slate-300'
                    }`}
                  >
                    {isOff5x2 ? (
                      <span className="uppercase tracking-wide font-extrabold">FOLGA</span>
                    ) : isDsr ? (
                      <span className="font-bold text-slate-700">DSR</span>
                    ) : isLic ? (
                      <span className="font-bold text-pink-700">Licença</span>
                    ) : (
                      <span className="text-slate-300 select-none">&mdash;</span>
                    )}
                  </td>
                );
              }

              return (
                <td
                  key={d.key}
                  className={`py-1.5 px-1 text-center border border-slate-300 font-mono text-[10px] ${
                    d.isWeekend ? 'bg-slate-50' : ''
                  }`}
                >
                  {isWork ? (
                    <span className="font-bold text-slate-900">
                      {shift.startTime}-{shift.endTime}
                    </span>
                  ) : isOff5x2 ? (
                    <span className="font-bold text-emerald-800 bg-emerald-50 px-1 py-0.5 border border-emerald-300 inline-block">
                      Folga 5x2
                    </span>
                  ) : isDsr ? (
                    <span className="font-bold text-slate-700">DSR</span>
                  ) : isLic ? (
                    <span className="font-bold text-pink-700">Licença</span>
                  ) : (
                    <span>Folga</span>
                  )}
                </td>
              );
            })}

            {folgasOnly ? (
              <td className="py-1.5 px-2 text-center border border-slate-300 font-bold text-[10.5px] text-emerald-900 bg-emerald-50/50">
                {offDaysInWeek.length > 0
                  ? `${offDaysInWeek.map((d) => DAY_SHORT_LABEL[d]).join(' + ')} + Dom`
                  : 'Domingo (DSR)'}
              </td>
            ) : (
              <>
                <td className="py-1.5 px-2 text-center border border-slate-300 font-mono font-bold text-[10px]">
                  <div>{formatHoursDecimal(weekHours)}</div>
                  {mSum && isFirst && (
                    <div className="text-[9px] text-slate-500 font-normal">
                      Mês: {formatHoursDecimal(mSum.totalMonthlyHours)}/
                      {formatHoursDecimal(mSum.monthlyTargetHours)}
                    </div>
                  )}
                  {isFirst && pontoMaisSummaryMap?.[emp.id]?.isEligibleForBanco && (
                    <div className="text-[9px] text-blue-800 font-semibold">
                      BH Mês:{' '}
                      {Math.abs(pontoMaisSummaryMap[emp.id].netBancoHoursMonth) < 0.08
                        ? '0h00'
                        : `${
                            pontoMaisSummaryMap[emp.id].netBancoHoursMonth > 0 ? '+' : '-'
                          }${formatHoursDecimal(
                            Math.abs(pontoMaisSummaryMap[emp.id].netBancoHoursMonth)
                          )}`}
                    </div>
                  )}
                </td>

                {isFirst && (
                  <td
                    rowSpan={weeksToPrint.length}
                    className="py-2 px-2 text-center border border-slate-300 font-semibold text-[10px] align-middle"
                  >
                    {mSum?.status === 'VIOLACAO' || weekComp?.status === 'VIOLACAO' ? (
                      <span className="text-rose-700">Irregular (&gt;10h ou &lt;2 folgas)</span>
                    ) : mSum?.status === 'HORAS_EXTRAS' ? (
                      <span className="text-blue-800">Banco / Saldo +</span>
                    ) : mSum?.status === 'COMPENSANDO' ? (
                      <span className="text-amber-800">Saldo em Compensação</span>
                    ) : (
                      <span className="text-emerald-700">Conforme (5x2)</span>
                    )}
                  </td>
                )}
              </>
            )}
          </tr>
        );
      });
    });
  };

  return (
    <div
      data-print-schedule-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto print:static print:p-0 print:bg-white print:block"
    >
      <div className="bg-white rounded-2xl max-w-6xl w-full border border-slate-200 shadow-2xl overflow-hidden my-6 print:my-0 print:max-w-none print:border-0 print:shadow-none print:rounded-none">
        {/* Modal Top Bar (Hidden on print) */}
        <div className="no-print px-6 py-4 border-b border-slate-200 bg-slate-50 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {folgasOnly ? (
                <CalendarOff className="w-5 h-5 text-emerald-600" />
              ) : (
                <Printer className="w-5 h-5 text-blue-600" />
              )}
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {folgasOnly
                    ? 'Impressão Exclusiva de Folgas 5x2 (Sem Horários do Dia a Dia)'
                    : 'Impressão de Tabelas por Setor & Quadro Oficial (Art. 74 CLT & EC 141/2026)'}
                </h3>
                <p className="text-xs text-slate-500">
                  {folgasOnly
                    ? 'Foco 100% nos dias de folga de cada colaborador por setor e semana (S1 a S4), ocultando horários de entrada, almoço e saída'
                    : 'Imprima todos os setores separados por tabela, escolha apenas 1 setor específico ou alterne para o modo Só Folgas'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Alternador Principal: Só Folgas (Sem Horários) vs Com Horários Completos */}
              <div className="flex items-center gap-1 bg-slate-200/80 p-1 rounded-lg text-[11px] font-bold">
                <button
                  type="button"
                  data-print-content-mode="FOLGAS_ONLY"
                  onClick={() => setFolgasOnly(true)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded transition cursor-pointer ${
                    folgasOnly
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'text-slate-700 hover:bg-white'
                  }`}
                  title="Exibir e imprimir apenas os dias de folga, sem horários de entrada/saída ou almoço"
                >
                  <CalendarOff className="w-3.5 h-3.5" />
                  <span>Só Folgas (Sem Horários)</span>
                </button>
                <button
                  type="button"
                  data-print-content-mode="FULL_HOURS"
                  onClick={() => setFolgasOnly(false)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded transition cursor-pointer ${
                    !folgasOnly
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'text-slate-700 hover:bg-white'
                  }`}
                  title="Exibir quadro completo com horários diários, almoço e carga horária"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Com Horários</span>
                </button>
              </div>

              {/* Alternador: Por Setor vs Tabela Única */}
              <div className="flex items-center gap-1 bg-slate-200/80 p-1 rounded-lg text-[11px] font-bold">
                <button
                  type="button"
                  data-print-mode="BY_SECTOR"
                  onClick={() => setPrintMode('BY_SECTOR')}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded transition cursor-pointer ${
                    printMode === 'BY_SECTOR'
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'text-slate-700 hover:bg-white'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Por Setor</span>
                </button>
                <button
                  type="button"
                  data-print-mode="UNIFIED"
                  onClick={() => setPrintMode('UNIFIED')}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded transition cursor-pointer ${
                    printMode === 'UNIFIED'
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'text-slate-700 hover:bg-white'
                  }`}
                >
                  <Table2 className="w-3.5 h-3.5" />
                  <span>Tabela Única</span>
                </button>
              </div>

              <div className="flex items-center gap-1 bg-slate-200/80 p-1 rounded-lg text-[11px] font-bold">
                <button
                  type="button"
                  data-print-week="ALL"
                  onClick={() => setPrintWeek('ALL')}
                  className={`px-2 py-1 rounded transition cursor-pointer ${
                    printWeek === 'ALL'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-700 hover:bg-white'
                  }`}
                >
                  Todas (S1–S4)
                </button>
                {[1, 2, 3, 4].map((w) => (
                  <button
                    key={w}
                    type="button"
                    data-print-week={w}
                    onClick={() => setPrintWeek(w)}
                    className={`px-2 py-1 rounded transition cursor-pointer ${
                      printWeek === w
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-700 hover:bg-white'
                    }`}
                  >
                    S{w}
                  </button>
                ))}
              </div>

              <button
                type="button"
                data-print-execute="true"
                onClick={handlePrint}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white rounded-lg shadow cursor-pointer transition ${
                  folgasOnly
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                <Printer className="w-4 h-4" />
                <span>{folgasOnly ? 'Imprimir Só Folgas / PDF' : 'Imprimir / Salvar PDF'}</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="Fechar impressão"
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/80">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-600 mr-1">Unidade:</span>
              {(
                [
                  { id: 'ALL', label: 'Todas as Lojas' },
                  { id: 'LOJA_1', label: 'Loja 1 — Matriz 546' },
                  { id: 'LOJA_2', label: 'Loja 2 — Filial 777' },
                ] as const
              ).map((st) => (
                <button
                  key={st.id}
                  type="button"
                  data-print-store-filter={st.id}
                  onClick={() => {
                    setStoreFilter(st.id);
                    if (
                      st.id !== 'ALL' &&
                      sectorKeyFilter !== 'ALL' &&
                      !sectorKeyFilter.startsWith('DEPT::') &&
                      !sectorKeyFilter.startsWith(`${st.id}::`)
                    ) {
                      setSectorKeyFilter('ALL');
                    }
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                    storeFilter === st.id
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {folgasOnly && (
                <div className="flex items-center gap-1 bg-emerald-100/80 p-1 rounded-lg border border-emerald-300 text-[10.5px] font-bold">
                  <button
                    type="button"
                    data-folgas-layout="BOTH"
                    onClick={() => setFolgasLayout('BOTH')}
                    className={`px-2 py-0.5 rounded cursor-pointer transition ${
                      folgasLayout === 'BOTH'
                        ? 'bg-emerald-700 text-white'
                        : 'text-emerald-950 hover:bg-white'
                    }`}
                  >
                    Resumo S1–S4 + Grade
                  </button>
                  <button
                    type="button"
                    data-folgas-layout="SUMMARY_S1_S4"
                    onClick={() => setFolgasLayout('SUMMARY_S1_S4')}
                    className={`px-2 py-0.5 rounded cursor-pointer transition ${
                      folgasLayout === 'SUMMARY_S1_S4'
                        ? 'bg-emerald-700 text-white'
                        : 'text-emerald-950 hover:bg-white'
                    }`}
                  >
                    Só Resumo S1–S4 (Compacto)
                  </button>
                  <button
                    type="button"
                    data-folgas-layout="GRID_NO_HOURS"
                    onClick={() => setFolgasLayout('GRID_NO_HOURS')}
                    className={`px-2 py-0.5 rounded cursor-pointer transition ${
                      folgasLayout === 'GRID_NO_HOURS'
                        ? 'bg-emerald-700 text-white'
                        : 'text-emerald-950 hover:bg-white'
                    }`}
                  >
                    Só Grade Seg–Dom
                  </button>
                </div>
              )}

              {printMode === 'BY_SECTOR' && visibleSectors.length > 1 && (
                <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 cursor-pointer select-none bg-white px-2.5 py-1 rounded-lg border border-slate-300">
                  <input
                    type="checkbox"
                    data-print-page-break-toggle="true"
                    checked={pageBreakPerSector}
                    onChange={(e) => setPageBreakPerSector(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600"
                  />
                  <span>1 Setor por Página (A4)</span>
                </label>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-600 mr-1">Setor:</span>
            <button
              type="button"
              data-print-sector-filter="ALL"
              onClick={() => setSectorKeyFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                sectorKeyFilter === 'ALL'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
              }`}
            >
              Todos os Setores ({PRINTABLE_SECTORS.filter((s) => storeFilter === 'ALL' || s.storeId === storeFilter).length})
            </button>

            {PRINTABLE_SECTORS.filter(
              (sec) => storeFilter === 'ALL' || sec.storeId === storeFilter
            ).map((sec) => {
              const active = sectorKeyFilter === sec.key;
              return (
                <button
                  key={sec.key}
                  type="button"
                  data-print-sector-filter={sec.key}
                  onClick={() => setSectorKeyFilter(sec.key)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                    active
                      ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{
                      backgroundColor: active ? '#FFFFFF' : sec.iconColor,
                    }}
                  />
                  <span>{sec.shortTitle}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Printable Document Area — Foco direto no Setor e Cronograma (sem cabeçalho burocrático e sem assinaturas) */}
        <div className="p-5 bg-white text-slate-900 space-y-5 max-h-[80vh] overflow-y-auto print:max-h-none print:overflow-visible print:p-0">
          {printMode === 'BY_SECTOR' ? (
            <div className="space-y-5">
              {visibleSectors.map((sec, secIdx) => {
                const chairDefs = buildSectionChairs(
                  sec.chairIds,
                  sec.storeId,
                  sec.deptId,
                  preparedEmployees,
                  CHAIRS
                );
                const sectorRows = chairDefs
                  .map((chair) => {
                    const occupant = findChairOccupant(
                      chair.id,
                      preparedEmployees,
                      weeksToPrint
                    );
                    if (!occupant) return null;
                    return {
                      emp: occupant,
                      chairCode: chair.code,
                      chairName: chair.name,
                    };
                  })
                  .filter(
                    (
                      item
                    ): item is {
                      emp: Employee;
                      chairCode: string;
                      chairName: string;
                    } => Boolean(item)
                  );

                const shouldBreakAfter =
                  pageBreakPerSector && secIdx < visibleSectors.length - 1;

                return (
                  <section
                    key={sec.key}
                    data-printable-sector-table={sec.key}
                    className={`border-2 border-slate-800 bg-white ${
                      shouldBreakAfter ? 'print-page-break' : ''
                    }`}
                  >
                    <div className="bg-slate-900 text-white px-4 py-2 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 print:bg-slate-100 print:text-slate-900 print:border-b-2 print:border-slate-800">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full shrink-0 border border-white/40"
                          style={{ backgroundColor: sec.iconColor }}
                        />
                        <span className="text-[10px] font-mono font-extrabold uppercase px-1.5 py-0.5 bg-slate-800 text-blue-200 border border-slate-700 print:bg-white print:text-slate-900 print:border-slate-500">
                          {sec.storeCode}
                        </span>
                        <h2 className="text-sm font-extrabold tracking-tight">
                          {sec.title}
                        </h2>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-mono font-bold text-slate-200 print:text-slate-800">
                          {printWeek === 'ALL' ? 'Ciclo S1–S4' : `Semana S${printWeek}`}
                        </span>

                        {visibleSectors.length > 1 && (
                          <button
                            type="button"
                            data-print-only-this-sector={sec.key}
                            onClick={() => handleSelectSingleSectorAndPrint(sec)}
                            className="no-print inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold text-[10.5px] cursor-pointer transition"
                            title={`Filtrar e imprimir apenas a tabela de ${sec.title}`}
                          >
                            <Printer className="w-3 h-3" />
                            <span>Imprimir só este setor</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Se estiver no modo SÓ FOLGAS e exibir o Resumo S1–S4 */}
                    {folgasOnly &&
                      (folgasLayout === 'BOTH' || folgasLayout === 'SUMMARY_S1_S4') && (
                        <div className="p-3 bg-emerald-50/30 border-b border-slate-300">
                          <div className="text-[10.5px] font-extrabold uppercase tracking-wider text-emerald-950 mb-1.5">
                            Resumo Direto das Folgas por Semana ({sec.title})
                          </div>
                          {renderFolgasSummaryTable(sectorRows)}
                        </div>
                      )}

                    {/* Grade Seg..Dom (exibida sempre no modo Com Horários, ou quando folgasLayout !== SUMMARY_S1_S4) */}
                    {(!folgasOnly || folgasLayout !== 'SUMMARY_S1_S4') && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300 text-[10px] uppercase">
                              <th className="py-2 px-2 border border-slate-300 w-[23%]">
                                Cadeira / Colaborador / Intervalo
                              </th>
                              <th className="py-2 px-1 text-center border border-slate-300 w-[5%]">
                                Sem.
                              </th>
                              <th className="py-2 px-1 text-center border border-slate-300">Seg</th>
                              <th className="py-2 px-1 text-center border border-slate-300">Ter</th>
                              <th className="py-2 px-1 text-center border border-slate-300">Qua</th>
                              <th className="py-2 px-1 text-center border border-slate-300">Qui</th>
                              <th className="py-2 px-1 text-center border border-slate-300">Sex</th>
                              <th className="py-2 px-1 text-center border border-slate-300 bg-slate-200/50">
                                Sáb
                              </th>
                              <th className="py-2 px-1 text-center border border-slate-300 bg-slate-200/50">
                                Dom
                              </th>
                              {folgasOnly ? (
                                <th className="py-2 px-2 text-center border border-slate-300 w-[18%]">
                                  Dias de Folga na Semana
                                </th>
                              ) : (
                                <>
                                  <th className="py-2 px-2 text-center border border-slate-300 w-[11%]">
                                    Sem. / Mês
                                  </th>
                                  <th className="py-2 px-2 text-center border border-slate-300 w-[11%]">
                                    Status
                                  </th>
                                </>
                              )}
                            </tr>
                          </thead>
                          <tbody>
                            {sectorRows.length === 0 ? (
                              <tr>
                                <td
                                  colSpan={folgasOnly ? 10 : 11}
                                  className="py-4 px-3 text-center text-slate-500 italic"
                                >
                                  Nenhum colaborador alocado neste setor.
                                </td>
                              </tr>
                            ) : (
                              renderEmployeeRows(sectorRows)
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          ) : (
            <div className="space-y-5">
              {folgasOnly &&
                (folgasLayout === 'BOTH' || folgasLayout === 'SUMMARY_S1_S4') && (
                  <div className="space-y-1.5">
                    <div className="text-xs font-extrabold uppercase tracking-wider text-emerald-950">
                      Resumo Geral de Folgas por Colaborador (S1 a S4)
                    </div>
                    {renderFolgasSummaryTable(
                      visibleUnifiedEmployees.map((emp) => ({
                        emp,
                        chairCode: emp.defaultChairId,
                        chairName: emp.department,
                      }))
                    )}
                  </div>
                )}

              {(!folgasOnly || folgasLayout !== 'SUMMARY_S1_S4') && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse border border-slate-300 text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300 text-[10px] uppercase">
                        <th className="py-2 px-2 border border-slate-300">
                          Colaborador / Cargo / Cadeira
                        </th>
                        <th className="py-2 px-1 text-center border border-slate-300">Sem.</th>
                        <th className="py-2 px-1 text-center border border-slate-300">Seg</th>
                        <th className="py-2 px-1 text-center border border-slate-300">Ter</th>
                        <th className="py-2 px-1 text-center border border-slate-300">Qua</th>
                        <th className="py-2 px-1 text-center border border-slate-300">Qui</th>
                        <th className="py-2 px-1 text-center border border-slate-300">Sex</th>
                        <th className="py-2 px-1 text-center border border-slate-300 bg-slate-200/50">
                          Sáb
                        </th>
                        <th className="py-2 px-1 text-center border border-slate-300 bg-slate-200/50">
                          Dom
                        </th>
                        {folgasOnly ? (
                          <th className="py-2 px-2 text-center border border-slate-300">
                            Dias de Folga na Semana
                          </th>
                        ) : (
                          <>
                            <th className="py-2 px-2 text-center border border-slate-300">
                              Sem. / Mês
                            </th>
                            <th className="py-2 px-2 text-center border border-slate-300">
                              Status
                            </th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {renderEmployeeRows(
                        visibleUnifiedEmployees.map((emp) => ({
                          emp,
                          chairCode: emp.defaultChairId,
                          chairName: emp.department,
                        }))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
