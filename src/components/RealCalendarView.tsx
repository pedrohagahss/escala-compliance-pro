import React, { useMemo, useState } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Users,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { DepartmentId, Employee, SectorMinimumsMap, StoreHoursMap, StoreId } from '../types/schedule';
import { formatHoursDecimal } from '../utils/compliance';
import {
  addMonthsToYearMonth,
  buildRealMonthProjection,
  CALENDAR_WEEKDAY_HEADERS_SUN_FIRST,
  getDefaultTodayIso,
  parseDateIsoLocal,
  PT_MONTH_NAMES,
} from '../utils/realCalendar';

type CalendarZoomMode = 1 | 4 | 6 | 12;

interface RealCalendarViewProps {
  employees: Employee[];
  selectedDateIso: string;
  onSelectDateAndOpenFloorPlan: (dateIso: string) => void;
  storeHours: StoreHoursMap;
  sectorMinimums: SectorMinimumsMap;
  selectedStore: 'ALL' | StoreId;
  selectedDept: 'ALL' | DepartmentId;
  selectedEmployeeFilter: 'ALL' | string;
  onSelectEmployeeFilter?: (empId: 'ALL' | string) => void;
}

export const RealCalendarView: React.FC<RealCalendarViewProps> = ({
  employees,
  selectedDateIso,
  onSelectDateAndOpenFloorPlan,
  storeHours,
  sectorMinimums,
  selectedStore,
  selectedDept,
  selectedEmployeeFilter,
  onSelectEmployeeFilter,
}) => {
  const initialDate = useMemo(() => parseDateIsoLocal(selectedDateIso), [selectedDateIso]);
  const [cursorYear, setCursorYear] = useState<number>(initialDate.getFullYear());
  const [cursorMonth0, setCursorMonth0] = useState<number>(initialDate.getMonth());
  const [zoomMonths, setZoomMonths] = useState<CalendarZoomMode>(1);

  const todayIso = useMemo(() => getDefaultTodayIso(), []);
  const activeEmployees = useMemo(
    () =>
      employees.filter((e) => {
        if (e.isCirculating) return false;
        if (selectedStore !== 'ALL' && e.defaultStore !== selectedStore) return false;
        if (selectedDept !== 'ALL' && e.department !== selectedDept) return false;
        return true;
      }),
    [employees, selectedStore, selectedDept]
  );

  const effectiveFocusEmpId =
    selectedEmployeeFilter !== 'ALL' && activeEmployees.some((e) => e.id === selectedEmployeeFilter)
      ? selectedEmployeeFilter
      : selectedEmployeeFilter !== 'ALL' && employees.some((e) => e.id === selectedEmployeeFilter)
      ? selectedEmployeeFilter
      : 'ALL';

  const focusedEmp = useMemo(
    () =>
      effectiveFocusEmpId !== 'ALL'
        ? employees.find((e) => e.id === effectiveFocusEmpId)
        : undefined,
    [employees, effectiveFocusEmpId]
  );

  const monthsToRender = useMemo(() => {
    const list = [];
    for (let i = 0; i < zoomMonths; i++) {
      const { year, month0 } = addMonthsToYearMonth(cursorYear, cursorMonth0, i);
      list.push(
        buildRealMonthProjection(
          employees,
          year,
          month0,
          storeHours,
          sectorMinimums,
          effectiveFocusEmpId,
          selectedDept,
          selectedStore
        )
      );
    }
    return list;
  }, [
    zoomMonths,
    cursorYear,
    cursorMonth0,
    employees,
    storeHours,
    sectorMinimums,
    effectiveFocusEmpId,
    selectedDept,
    selectedStore,
  ]);

  const handleStepMonths = (delta: number) => {
    const next = addMonthsToYearMonth(cursorYear, cursorMonth0, delta);
    setCursorYear(next.year);
    setCursorMonth0(next.month0);
  };

  const handleResetToday = () => {
    const t = parseDateIsoLocal(todayIso);
    setCursorYear(t.getFullYear());
    setCursorMonth0(t.getMonth());
  };

  return (
    <section
      data-real-calendar-view="true"
      aria-label="Calendário Real com Projeção Mensal e Multi-Meses"
      className="bg-white border border-slate-300"
    >
      {/* Topo Flat do Calendário */}
      <div className="bg-slate-900 text-white px-4 py-3 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3 border-b border-slate-800">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center">
            <button
              type="button"
              data-cal-prev-month="true"
              onClick={() => handleStepMonths(zoomMonths === 12 ? -12 : -1)}
              className="px-3 py-2 bg-slate-800 hover:bg-blue-700 text-white font-bold text-xs border border-slate-600 flex items-center gap-1 cursor-pointer"
              title={zoomMonths === 12 ? 'Voltar 1 ano' : 'Mês anterior'}
            >
              <ChevronLeft className="w-4 h-4" />
              <span>{zoomMonths === 12 ? 'Ano Ant.' : 'Mês Ant.'}</span>
            </button>

            <button
              type="button"
              data-cal-next-month="true"
              onClick={() => handleStepMonths(zoomMonths === 12 ? 12 : 1)}
              className="px-3 py-2 bg-slate-800 hover:bg-blue-700 text-white font-bold text-xs border border-l-0 border-slate-600 flex items-center gap-1 cursor-pointer"
              title={zoomMonths === 12 ? 'Avançar 1 ano' : 'Próximo mês'}
            >
              <span>{zoomMonths === 12 ? 'Próx. Ano' : 'Próx. Mês'}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <select
              aria-label="Selecionar Mês Inicial"
              value={cursorMonth0}
              onChange={(e) => setCursorMonth0(Number(e.target.value))}
              className="px-2.5 py-1.5 bg-slate-800 border border-slate-600 text-white text-sm font-extrabold focus:outline-none focus:border-blue-400 cursor-pointer"
            >
              {PT_MONTH_NAMES.map((name, idx) => (
                <option key={name} value={idx}>
                  {name}
                </option>
              ))}
            </select>

            <select
              aria-label="Selecionar Ano"
              value={cursorYear}
              onChange={(e) => setCursorYear(Number(e.target.value))}
              className="px-2.5 py-1.5 bg-slate-800 border border-slate-600 text-white text-sm font-mono font-extrabold focus:outline-none focus:border-blue-400 cursor-pointer"
            >
              {[2025, 2026, 2027, 2028, 2029].map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleResetToday}
              className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold border border-emerald-500 cursor-pointer"
            >
              Hoje
            </button>
          </div>
        </div>

        {/* Controles de Foco de Colaborador e Zoom Multi-Meses */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div
            role="group"
            aria-label="Nível de Zoom do Calendário"
            className="inline-flex items-center border border-slate-600"
          >
            <button
              type="button"
              data-cal-zoom="1"
              aria-pressed={zoomMonths === 1}
              onClick={() => setZoomMonths(1)}
              className={`px-2.5 py-1.5 text-xs font-bold flex items-center gap-1 cursor-pointer transition ${
                zoomMonths === 1
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
              }`}
              title="Zoom aproximado: 1 mês detalhado"
            >
              <ZoomIn className="w-3.5 h-3.5" />
              <span>1 Mês</span>
            </button>
            {[4, 6, 12].map((count) => (
              <button
                key={count}
                type="button"
                data-cal-zoom={count}
                aria-pressed={zoomMonths === count}
                onClick={() => setZoomMonths(count as CalendarZoomMode)}
                className={`px-2.5 py-1.5 text-xs font-bold border-l border-slate-600 flex items-center gap-1 cursor-pointer transition ${
                  zoomMonths === count
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                }`}
                title={`Tirar zoom para visualizar ${count} meses projetados`}
              >
                {count === 4 && <ZoomOut className="w-3.5 h-3.5" />}
                <span>{count === 12 ? '12 Meses (Ano)' : `${count} Meses`}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Legenda Livre e Dica de Navegação (sem bordas em volta de textos!) */}
      <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-300 flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm">
        <div className="flex flex-wrap items-center gap-5">
          <span className="inline-flex items-center gap-1.5 font-semibold text-slate-800">
            <span className="w-3.5 h-3.5 bg-white border border-slate-400 inline-block" />
            <span>Dia de Trabalho</span>
          </span>
          <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-900">
            <span className="w-3.5 h-3.5 bg-emerald-600 inline-block" />
            <span>Folga 5x2</span>
          </span>
          <span className="inline-flex items-center gap-1.5 font-semibold text-slate-800">
            <span className="w-3.5 h-3.5 bg-slate-800 inline-block" />
            <span>DSR (Domingo)</span>
          </span>
          <span className="inline-flex items-center gap-1.5 font-semibold text-amber-900">
            <span className="w-3.5 h-3.5 bg-amber-400 inline-block" />
            <span>FDS Prolongado (Sáb+Dom+Seg)</span>
          </span>
        </div>

        <span className="text-xs text-slate-600 font-medium">
          Clique em qualquer data para abrir a{' '}
          <strong className="text-slate-900">Planta Simulada</strong> daquele dia.
          {zoomMonths > 1 && ' Clique no nome de um mês para aproximar o zoom.'}
        </span>
      </div>

      {/* Área do Calendário: Zoom 1 Mês vs Panorâmica Multi-Meses */}
      {zoomMonths === 1 ? (
        // ZOOM DETALHADO (1 Mês Completo Flat)
        (() => {
          const monthData = monthsToRender[0];
          return (
            <div className="p-4 bg-white space-y-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2 pb-2 border-b border-slate-300">
                <div>
                  <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">
                    {monthData.monthName} {monthData.year}
                    {focusedEmp && (
                      <span className="text-blue-700 font-extrabold ml-2 normal-case text-base">
                        &bull; {focusedEmp.shortName} ({focusedEmp.role})
                      </span>
                    )}
                  </h3>
                </div>

                <div className="flex flex-wrap items-center gap-5 text-sm font-mono">
                  {focusedEmp ? (
                    <>
                      <span className="text-slate-900 font-bold">
                        {monthData.summary.workDaysCount} dias úteis trabalhados
                      </span>
                      <span className="text-emerald-700 font-extrabold">
                        {monthData.summary.folga5x2DaysCount} folgas 5x2
                      </span>
                      <span className="text-amber-700 font-extrabold">
                        {monthData.summary.prolongedWeekendsStarts} FDS prolongado(s)
                      </span>
                      <span className="text-blue-800 font-black">
                        Total real no mês: {formatHoursDecimal(monthData.summary.totalFocusHours)}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-slate-700 font-bold">
                        {monthData.summary.prolongedWeekendsStarts} FDS prolongado(s) no mês
                      </span>
                      <span
                        className={
                          monthData.summary.uncoveredDaysCount === 0
                            ? 'text-emerald-700 font-extrabold'
                            : 'text-rose-700 font-extrabold'
                        }
                      >
                        {monthData.summary.uncoveredDaysCount === 0
                          ? '0 dias descobertos'
                          : `${monthData.summary.uncoveredDaysCount} dia(s) com déficit`}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Grade Calendário 7 Colunas Estilo Flat */}
              <div className="border-t border-l border-slate-300">
                <div className="grid grid-cols-7 bg-slate-100 border-b border-slate-300">
                  {CALENDAR_WEEKDAY_HEADERS_SUN_FIRST.map((wd) => (
                    <div
                      key={wd.dayKey}
                      className={`py-2 px-2 text-center text-xs font-extrabold uppercase tracking-wider border-r border-slate-300 ${
                        wd.dayKey === 'DOM'
                          ? 'bg-slate-200 text-slate-800'
                          : wd.dayKey === 'SAB'
                          ? 'bg-blue-50 text-blue-900'
                          : 'text-slate-800'
                      }`}
                    >
                      {wd.label}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7">
                  {monthData.cells.map((cell) => {
                    const isTodayCell = cell.dateIso === todayIso;
                    const isSelectedCell = cell.dateIso === selectedDateIso;

                    const focus = cell.focusEmployee;
                    let cellBg = 'bg-white text-slate-900 hover:bg-blue-50/40';
                    if (!cell.inCurrentMonth) {
                      cellBg = 'bg-slate-100/70 text-slate-400 hover:bg-slate-200/70';
                    } else if (focus) {
                      if (focus.isFolga5x2) {
                        cellBg = 'bg-emerald-600 text-white hover:bg-emerald-700';
                      } else if (focus.isDsr) {
                        cellBg = 'bg-slate-800 text-slate-100 hover:bg-slate-900';
                      } else if (focus.isLicenca) {
                        cellBg = 'bg-rose-700 text-white hover:bg-rose-800';
                      } else if (cell.dayKey === 'SAB') {
                        cellBg = 'bg-sky-50 text-slate-950 hover:bg-sky-100';
                      } else {
                        cellBg = 'bg-white text-slate-950 hover:bg-slate-50';
                      }
                    } else {
                      // Visão Equipe Completa
                      if (cell.dayKey === 'DOM') {
                        cellBg = 'bg-slate-800 text-slate-100 hover:bg-slate-900';
                      } else if (cell.uncoveredSectorsCount > 0) {
                        cellBg = 'bg-rose-50 text-rose-950 hover:bg-rose-100';
                      } else if (cell.prolongedFolgaNames.length > 0 && (cell.dayKey === 'SAB' || cell.dayKey === 'SEG')) {
                        cellBg = 'bg-emerald-50 text-slate-950 hover:bg-emerald-100';
                      }
                    }

                    const isDarkCell =
                      (cell.inCurrentMonth &&
                        focus &&
                        (focus.isFolga5x2 || focus.isDsr || focus.isLicenca)) ||
                      (cell.inCurrentMonth && !focus && cell.dayKey === 'DOM');

                    const hasProlongedRibbon =
                      cell.inCurrentMonth &&
                      (focus ? focus.isProlongedWeekendPart : cell.prolongedFolgaNames.length > 0);

                    return (
                      <button
                        key={cell.dateIso}
                        type="button"
                        data-cal-day={cell.dateIso}
                        onClick={() => onSelectDateAndOpenFloorPlan(cell.dateIso)}
                        className={`min-h-[104px] p-2 text-left border-r border-b border-slate-300 transition cursor-pointer flex flex-col justify-between relative ${cellBg} ${
                          hasProlongedRibbon ? 'border-t-4 border-t-amber-400' : ''
                        } ${isSelectedCell ? 'ring-2 ring-inset ring-blue-500' : ''}`}
                      >
                        <div className="flex items-baseline justify-between gap-1">
                          <span
                            className={`text-base font-mono font-black ${
                              !cell.inCurrentMonth
                                ? 'text-slate-400'
                                : isTodayCell
                                ? isDarkCell
                                  ? 'text-amber-300 underline'
                                  : 'text-blue-700 underline'
                                : ''
                            }`}
                          >
                            {String(cell.dayNumber).padStart(2, '0')}
                          </span>
                          <span
                            className={`text-[11px] font-mono font-semibold ${
                              !cell.inCurrentMonth
                                ? 'text-slate-400'
                                : isDarkCell
                                ? 'text-white/80'
                                : 'text-slate-500'
                            }`}
                          >
                            {isTodayCell ? 'Hoje' : `S${cell.cycleWeek}`}
                          </span>
                        </div>

                        {cell.inCurrentMonth && (
                          <div className="mt-1 space-y-1">
                            {focus ? (
                              focus.isWork ? (
                                <>
                                  <div className="font-mono text-xs sm:text-sm font-black text-slate-900">
                                    {focus.shift.startTime || '08:00'}–{focus.shift.endTime || '17:24'}
                                  </div>
                                  <div className="text-xs font-mono font-bold text-blue-700">
                                    {formatHoursDecimal(focus.dailyHours)}
                                  </div>
                                </>
                              ) : focus.isFolga5x2 ? (
                                <>
                                  <div className="text-xs sm:text-sm font-black uppercase tracking-wide text-white">
                                    FOLGA 5x2
                                  </div>
                                  {focus.isProlongedWeekendPart && (
                                    <div className="text-[11px] font-bold text-amber-200">
                                      FDS Prolongado
                                    </div>
                                  )}
                                </>
                              ) : focus.isDsr ? (
                                <div className="text-xs font-extrabold uppercase tracking-wide text-slate-200">
                                  DSR {focus.isProlongedWeekendPart ? '• FDS Prol.' : ''}
                                </div>
                              ) : (
                                <div className="text-xs font-extrabold uppercase text-rose-100">
                                  Licença
                                </div>
                              )
                            ) : cell.dayKey === 'DOM' ? (
                              <div className="text-xs font-bold text-slate-200">
                                DSR Sem Expediente
                              </div>
                            ) : (
                              <>
                                <div className="text-xs font-bold text-slate-900">
                                  {cell.workingCount} trabalhando
                                </div>
                                {cell.folgaNames.length > 0 && (
                                  <div className="bg-emerald-600 text-white px-1.5 py-1 text-[11px] font-semibold leading-tight">
                                    <div className="font-extrabold">
                                      {cell.folgaNames.length} folga{cell.folgaNames.length > 1 ? 's' : ''}:
                                    </div>
                                    <div className="line-clamp-2 font-normal text-emerald-50">
                                      {cell.folgaNames.slice(0, 4).join(', ')}
                                      {cell.folgaNames.length > 4
                                        ? ` +${cell.folgaNames.length - 4}`
                                        : ''}
                                    </div>
                                  </div>
                                )}
                                {cell.uncoveredSectorsCount > 0 && (
                                  <div className="text-[11px] font-extrabold text-rose-700">
                                    {cell.uncoveredSectorsCount} setor descoberto
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })()
      ) : (
        // TIRAR ZOOM: PROJEÇÃO MULTI-MESES / ANO INTEIRO LADO A LADO
        <div
          data-cal-zoom-out-grid="true"
          className="p-4 bg-slate-100 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4"
        >
          {monthsToRender.map((mProj) => (
            <div
              key={`${mProj.year}-${mProj.month0}`}
              data-cal-mini-month={`${mProj.year}-${String(mProj.month0 + 1).padStart(2, '0')}`}
              className="bg-white border border-slate-400 flex flex-col"
            >
              <button
                type="button"
                onClick={() => {
                  setCursorYear(mProj.year);
                  setCursorMonth0(mProj.month0);
                  setZoomMonths(1);
                }}
                className="w-full px-3 py-2 bg-slate-900 hover:bg-blue-800 text-white flex items-center justify-between gap-2 transition cursor-pointer border-b border-slate-700"
                title={`Dar zoom em ${mProj.monthName} ${mProj.year}`}
              >
                <span className="font-extrabold text-sm tracking-tight">
                  {mProj.monthName} {mProj.year}
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] text-slate-200 font-semibold">
                  {focusedEmp
                    ? `${formatHoursDecimal(mProj.summary.totalFocusHours)} • ${mProj.summary.folga5x2DaysCount}f`
                    : `${mProj.summary.prolongedWeekendsStarts} FDS prol.`}
                  <Maximize2 className="w-3 h-3 text-blue-300" />
                </span>
              </button>

              <div className="grid grid-cols-7 bg-slate-100 border-b border-slate-300 text-center text-[10px] font-extrabold text-slate-700 uppercase">
                {CALENDAR_WEEKDAY_HEADERS_SUN_FIRST.map((wd) => (
                  <div key={wd.dayKey} className="py-1 border-r last:border-r-0 border-slate-300">
                    {wd.short.slice(0, 1)}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 flex-1">
                {mProj.cells.map((cell) => {
                  const isTodayCell = cell.dateIso === todayIso;
                  const focus = cell.focusEmployee;
                  let miniStyle = 'bg-white text-slate-900 hover:bg-blue-100';

                  if (!cell.inCurrentMonth) {
                    miniStyle = 'bg-slate-50 text-slate-300';
                  } else if (focus) {
                    if (focus.isFolga5x2) {
                      miniStyle = 'bg-emerald-600 text-white font-black hover:bg-emerald-700';
                    } else if (focus.isDsr) {
                      miniStyle = 'bg-slate-800 text-slate-100 font-bold hover:bg-slate-900';
                    } else if (focus.isLicenca) {
                      miniStyle = 'bg-rose-700 text-white';
                    } else if (cell.dayKey === 'SAB') {
                      miniStyle = 'bg-sky-100 text-slate-900 font-bold hover:bg-sky-200';
                    }
                  } else {
                    if (cell.dayKey === 'DOM') {
                      miniStyle = 'bg-slate-800 text-slate-200 hover:bg-slate-900';
                    } else if (cell.uncoveredSectorsCount > 0) {
                      miniStyle = 'bg-rose-600 text-white font-bold';
                    } else if (cell.folgaCount >= 7) {
                      // Sábados (metade ou 25% folga) vs dias úteis
                      miniStyle = 'bg-emerald-600 text-white font-bold hover:bg-emerald-700';
                    } else if (cell.prolongedFolgaNames.length > 0 && cell.dayKey === 'SEG') {
                      miniStyle = 'bg-emerald-100 text-emerald-950 font-bold hover:bg-emerald-200';
                    }
                  }

                  return (
                    <button
                      key={cell.dateIso}
                      type="button"
                      onClick={() => onSelectDateAndOpenFloorPlan(cell.dateIso)}
                      title={`${cell.dateIso} (S${cell.cycleWeek}) • ${
                        focus
                          ? focus.isWork
                            ? `${focus.shift.startTime}-${focus.shift.endTime}`
                            : focus.isFolga5x2
                            ? 'Folga 5x2'
                            : 'DSR'
                          : `${cell.workingCount} trab. / ${cell.folgaCount} folga`
                      }`}
                      className={`h-8 text-[11px] font-mono border-r border-b border-slate-200 flex items-center justify-center cursor-pointer transition ${miniStyle} ${
                        isTodayCell ? 'ring-2 ring-inset ring-amber-400' : ''
                      }`}
                    >
                      {cell.dayNumber}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
