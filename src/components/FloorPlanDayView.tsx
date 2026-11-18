import React, { useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Calendar,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Grid,
  Sparkles,
} from 'lucide-react';
import { DepartmentId, Employee, SectorMinimumsMap, StoreHoursMap, StoreId } from '../types/schedule';
import { DEFAULT_STORE_HOURS, formatHoursDecimal } from '../utils/compliance';
import {
  addDaysIso,
  buildRealDayFloorPlanSnapshot,
  getDefaultTodayIso,
  getWeekDatesAround,
} from '../utils/realCalendar';

interface FloorPlanDayViewProps {
  employees: Employee[];
  selectedDateIso: string;
  onChangeDateIso: (dateIso: string) => void;
  storeHours: StoreHoursMap;
  sectorMinimums: SectorMinimumsMap;
  selectedStore: 'ALL' | StoreId;
  selectedDept: 'ALL' | DepartmentId;
  selectedEmployeeFilter: 'ALL' | string;
  searchQuery: string;
  onOpenCalendarView: () => void;
  onOpenGridView: (focusWeek?: number, focusDay?: string) => void;
}

export const FloorPlanDayView: React.FC<FloorPlanDayViewProps> = ({
  employees,
  selectedDateIso,
  onChangeDateIso,
  storeHours,
  sectorMinimums,
  selectedStore,
  selectedDept,
  selectedEmployeeFilter,
  searchQuery,
  onOpenCalendarView,
  onOpenGridView,
}) => {
  const todayIso = useMemo(() => getDefaultTodayIso(), []);
  const isToday = selectedDateIso === todayIso;

  const snapshot = useMemo(
    () => buildRealDayFloorPlanSnapshot(employees, selectedDateIso, storeHours, sectorMinimums),
    [employees, selectedDateIso, storeHours, sectorMinimums]
  );

  const weekStrip = useMemo(() => getWeekDatesAround(selectedDateIso), [selectedDateIso]);

  // Suporte às setas do teclado (<- / ->) quando não está digitando em input/select
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onChangeDateIso(addDaysIso(selectedDateIso, -1));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        onChangeDateIso(addDaysIso(selectedDateIso, 1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedDateIso, onChangeDateIso]);

  const queryNorm = searchQuery.trim().toLowerCase();

  const visibleStores: Array<{ storeId: StoreId; title: string; code: string }> = [
    { storeId: 'LOJA_1' as StoreId, title: 'Loja 1 — Matriz 546', code: 'MATRIZ 546' },
    { storeId: 'LOJA_2' as StoreId, title: 'Loja 2 — Filial 777', code: 'FILIAL 777' },
  ].filter((s) => selectedStore === 'ALL' || selectedStore === s.storeId);

  const renderRoomWindowHeader = (storeId: StoreId) => {
    const cfg = storeHours[storeId] || DEFAULT_STORE_HOURS[storeId];
    if (snapshot.dayKey === 'DOM') return 'Domingo — Loja Fechada (DSR)';
    if (snapshot.dayKey === 'SAB') return `Sábado: ${cfg.saturdayOpen}–${cfg.saturdayClose}`;
    return `Abertura–Fechamento: ${cfg.weekdayOpen}–${cfg.weekdayClose}`;
  };

  return (
    <section
      data-floor-plan-view="true"
      aria-label="Planta Simulada dos Setores no Dia"
      className="bg-white border border-slate-300"
    >
      {/* Barra de Navegação Real por Data com Setas — Estilo Flat alinhado ao cabeçalho dos dias */}
      <div className="bg-slate-900 text-white px-4 py-3 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 border-b border-slate-800">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center">
            <button
              type="button"
              data-floor-prev-day="true"
              onClick={() => onChangeDateIso(addDaysIso(selectedDateIso, -1))}
              className="px-3 py-2 bg-slate-800 hover:bg-blue-700 text-white font-bold text-xs border border-slate-600 flex items-center gap-1.5 transition cursor-pointer"
              title="Dia anterior (seta esquerda no teclado)"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Anterior</span>
            </button>

            <button
              type="button"
              data-floor-next-day="true"
              onClick={() => onChangeDateIso(addDaysIso(selectedDateIso, 1))}
              className="px-3 py-2 bg-slate-800 hover:bg-blue-700 text-white font-bold text-xs border border-l-0 border-slate-600 flex items-center gap-1.5 transition cursor-pointer"
              title="Próximo dia (seta direita no teclado)"
            >
              <span>Próximo</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div>
            <div className="flex items-baseline gap-2.5 flex-wrap">
              <h2
                data-floor-current-date-title="true"
                className="text-base sm:text-lg font-extrabold tracking-tight text-white"
              >
                {snapshot.dateMeta.fullTitle}
              </h2>
              {isToday && (
                <span className="text-xs font-extrabold text-emerald-400 uppercase tracking-wider">
                  &bull; Hoje
                </span>
              )}
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Ciclo mensal: Semana S{snapshot.cycleWeek} &bull; Use as setas{' '}
              <span className="text-white font-semibold">&larr; / &rarr;</span> do teclado ou os botões acima para percorrer os dias
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            aria-label="Escolher data real na planta"
            value={selectedDateIso}
            onChange={(e) => {
              if (e.target.value) onChangeDateIso(e.target.value);
            }}
            className="px-2.5 py-1.5 bg-slate-800 border border-slate-600 text-white text-xs font-mono font-bold focus:outline-none focus:border-blue-400 cursor-pointer"
          />

        </div>
      </div>

      {/* Faixa Plana dos 7 Dias da Semana Real (conceito visual flat igual ao cabeçalho das tabelas) */}
      <div className="grid grid-cols-7 border-b border-slate-300 bg-slate-100">
        {weekStrip.map((wDay) => {
          const active = wDay.dateIso === selectedDateIso;
          const isRealToday = wDay.dateIso === todayIso;
          return (
            <button
              key={wDay.dateIso}
              type="button"
              onClick={() => onChangeDateIso(wDay.dateIso)}
              aria-pressed={active}
              className={`py-2 px-1.5 text-center border-r last:border-r-0 border-slate-300 transition cursor-pointer ${
                active
                  ? 'bg-blue-700 text-white font-extrabold'
                  : wDay.dayKey === 'DOM'
                  ? 'bg-slate-200/80 text-slate-700 hover:bg-slate-300/70'
                  : 'bg-slate-100 text-slate-800 hover:bg-white'
              }`}
            >
              <div className="text-xs font-extrabold uppercase tracking-wide flex items-center justify-center gap-1">
                <span>{wDay.weekdayShort}</span>
                <span className="font-mono">{String(wDay.dayNumber).padStart(2, '0')}/{wDay.monthShort}</span>
              </div>
              <div
                className={`text-[11px] font-medium mt-0.5 ${
                  active ? 'text-blue-100' : isRealToday ? 'text-emerald-700 font-bold' : 'text-slate-500'
                }`}
              >
                {isRealToday ? 'Hoje' : `S${wDay.cycleWeek}`}
              </div>
            </button>
          );
        })}
      </div>

      {/* Resumo Direto do Dia — Textos Livres (sem caixas/pílulas em volta!) */}
      <div className="px-4 py-3 border-b border-slate-300 bg-white flex flex-wrap items-center justify-between gap-4 text-sm">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 bg-white border-2 border-slate-800 inline-block shrink-0" />
            <span className="font-semibold text-slate-600">Em operação nos setores:</span>
            <strong className="text-slate-950 font-mono text-base">{snapshot.totals.working}</strong>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 bg-emerald-600 inline-block shrink-0" />
            <span className="font-semibold text-slate-600">De folga 5x2 hoje:</span>
            <strong className="text-emerald-700 font-mono text-base">{snapshot.totals.folga5x2}</strong>
          </div>

          {snapshot.totals.dsr > 0 && (
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 bg-slate-800 inline-block shrink-0" />
              <span className="font-semibold text-slate-600">DSR Domingo:</span>
              <strong className="text-slate-900 font-mono text-base">{snapshot.totals.dsr}</strong>
            </div>
          )}

          <div>
            <span className="font-semibold text-slate-600">Status cobertura: </span>
            <strong
              className={
                snapshot.totals.uncoveredSectors === 0 ? 'text-emerald-700' : 'text-rose-700'
              }
            >
              {snapshot.totals.uncoveredSectors === 0
                ? 'Todos os setores cobertos'
                : `${snapshot.totals.uncoveredSectors} setor(es) abaixo do mínimo`}
            </strong>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onChangeDateIso(addDaysIso(selectedDateIso, -7))}
            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 text-xs font-bold flex items-center gap-1 cursor-pointer"
            title="Voltar 7 dias no calendário"
          >
            <ArrowLeft className="w-3 h-3" />
            <span>-7 dias</span>
          </button>
          <button
            type="button"
            onClick={() => onChangeDateIso(addDaysIso(selectedDateIso, 7))}
            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 text-xs font-bold flex items-center gap-1 cursor-pointer"
            title="Avançar 7 dias no calendário"
          >
            <span>+7 dias</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Plantas Simuladas das Lojas — Arquitetura Flat com Paredes Retas */}
      <div className="p-4 bg-slate-100 space-y-5">
        <div
          className={`grid grid-cols-1 ${
            visibleStores.length > 1 ? 'xl:grid-cols-2' : ''
          } gap-5`}
        >
          {visibleStores.map((storeMeta) => {
            const rooms = snapshot.roomsByStore[storeMeta.storeId].filter((room) => {
              if (selectedDept !== 'ALL' && room.departmentId !== selectedDept) return false;
              if (selectedEmployeeFilter !== 'ALL') {
                const hasEmp = room.occupants.some(
                  (o) => o.employee.id === selectedEmployeeFilter
                );
                if (!hasEmp) return false;
              }
              if (queryNorm) {
                const matchesTitle = room.sector.title.toLowerCase().includes(queryNorm);
                const matchesPerson = room.occupants.some(
                  (o) =>
                    o.employee.name.toLowerCase().includes(queryNorm) ||
                    o.employee.shortName.toLowerCase().includes(queryNorm) ||
                    o.effectiveChairId.toLowerCase().includes(queryNorm)
                );
                if (!matchesTitle && !matchesPerson) return false;
              }
              return true;
            });

            return (
              <div
                key={storeMeta.storeId}
                data-floor-store={storeMeta.storeId}
                className="bg-white border-2 border-slate-800 flex flex-col"
              >
                {/* Cabeçalho Arquitetônico da Loja */}
                <div className="bg-slate-800 text-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-blue-300 shrink-0" />
                    <span className="font-extrabold text-sm tracking-wide uppercase">
                      {storeMeta.title}
                    </span>
                  </div>
                  <span className="text-xs font-mono text-slate-200">
                    {renderRoomWindowHeader(storeMeta.storeId)}
                  </span>
                </div>

                {/* Planta dos Setores Internos (Paredes Retas) */}
                {rooms.length === 0 ? (
                  <div className="p-6 text-center text-sm text-slate-500">
                    Nenhum setor corresponde aos filtros atuais nesta unidade.
                  </div>
                ) : (
                  <div className="divide-y-2 divide-slate-800">
                    {rooms.map((room) => {
                      const roomPeople = room.occupants.filter((o) => {
                        if (selectedEmployeeFilter !== 'ALL' && o.employee.id !== selectedEmployeeFilter) {
                          return false;
                        }
                        if (queryNorm) {
                          return (
                            o.employee.name.toLowerCase().includes(queryNorm) ||
                            o.employee.shortName.toLowerCase().includes(queryNorm) ||
                            o.effectiveChairId.toLowerCase().includes(queryNorm) ||
                            room.sector.title.toLowerCase().includes(queryNorm)
                          );
                        }
                        return true;
                      });

                      return (
                        <div
                          key={room.sector.id}
                          data-floor-sector={room.sector.id}
                          className="p-3.5 bg-white"
                        >
                          {/* Identificação da Sala/Setor — Textos Livres */}
                          <div className="flex flex-wrap items-baseline justify-between gap-2 pb-2.5 mb-3 border-b border-slate-300">
                            <div>
                              <h3 className="text-sm font-extrabold text-slate-900">
                                {room.sector.title}
                              </h3>
                              {room.coverage?.autoCoveredByPeersOrSkills &&
                                room.coverage.autoCoveredByPeersOrSkills.length > 0 && (
                                  <p className="text-xs text-blue-700 font-medium mt-0.5">
                                    Apoio no dia: {room.coverage.autoCoveredByPeersOrSkills.join(' • ')}
                                  </p>
                                )}
                            </div>

                            <div className="text-xs font-mono font-bold">
                              <span
                                className={
                                  room.isUncovered
                                    ? 'text-rose-700 font-extrabold'
                                    : snapshot.dayKey === 'DOM'
                                    ? 'text-slate-600'
                                    : 'text-emerald-700'
                                }
                              >
                                {snapshot.dayKey === 'DOM'
                                  ? 'DSR Sem Operação'
                                  : `${room.workingCount} ativo(s) / mín. ${room.minRequired}`}
                              </span>
                              {room.folgaCount > 0 && snapshot.dayKey !== 'DOM' && (
                                <span className="text-slate-500 ml-2 font-normal">
                                  &bull; {room.folgaCount} folga
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Baias / Pessoas Dentro do Setor (Alto Contraste Trabalho vs Folga) */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {roomPeople.map((person) => {
                              const st = person.shift;
                              const isOff5x2 = person.isFolga5x2;
                              const isDsr = person.isDsr;
                              const isLicenca = person.isLicenca;

                              const cardColors = isOff5x2
                                ? 'bg-emerald-600 text-white border-emerald-900'
                                : isDsr
                                ? 'bg-slate-800 text-slate-100 border-slate-950'
                                : isLicenca
                                ? 'bg-rose-700 text-white border-rose-950'
                                : 'bg-white text-slate-950 border-slate-300 border-l-4 border-l-blue-700';

                              return (
                                <div
                                  key={person.employee.id}
                                  data-floor-person={`${room.sector.id}::${person.employee.id}`}
                                  data-floor-status={
                                    person.isWork
                                      ? 'TRABALHO'
                                      : isOff5x2
                                      ? 'FOLGA'
                                      : isDsr
                                      ? 'DSR'
                                      : 'LICENCA'
                                  }
                                  className={`p-2.5 border transition flex flex-col justify-between gap-1 ${cardColors}`}
                                >
                                  <div className="flex items-baseline justify-between gap-2">
                                    <span className="font-extrabold text-sm truncate">
                                      {person.employee.shortName}
                                    </span>
                                    <span
                                      className={`font-mono text-xs font-bold shrink-0 ${
                                        person.isWork ? 'text-slate-500' : 'text-white/80'
                                      }`}
                                    >
                                      {person.effectiveChairId}
                                    </span>
                                  </div>

                                  {person.isWork ? (
                                    <div className="space-y-0.5">
                                      <div className="font-mono text-sm font-black text-blue-800">
                                        {st.startTime || '08:00'}–{st.endTime || '17:24'}
                                        <span className="text-slate-500 font-semibold ml-1.5 text-xs">
                                          ({formatHoursDecimal(person.dailyHours)})
                                        </span>
                                      </div>
                                      <div className="text-xs text-slate-600">
                                        {person.employee.contractType === 'ESTAGIARIO'
                                          ? 'Estágio 4h (sem intervalo)'
                                          : st.lunchStart && st.lunchEnd
                                          ? `Almoço ${st.lunchStart}–${st.lunchEnd}`
                                          : 'Turno contínuo (sem almoço)'}
                                      </div>
                                    </div>
                                  ) : isOff5x2 ? (
                                    <div className="space-y-0.5">
                                      <div className="text-sm font-black uppercase tracking-wide text-white">
                                        FOLGA 5x2
                                      </div>
                                      <div className="text-xs text-emerald-100">
                                        {st.coverage
                                          ? `Coberto por ${st.coverage.coveredByName}`
                                          : person.isProlongedWeekendPart
                                          ? 'Fim de semana prolongado (Sáb→Dom→Seg)'
                                          : 'Ausente em folga regular'}
                                      </div>
                                    </div>
                                  ) : isDsr ? (
                                    <div className="text-xs font-bold text-slate-200 uppercase tracking-wide">
                                      DSR — Descanso Semanal
                                    </div>
                                  ) : (
                                    <div className="text-xs font-bold text-rose-100 uppercase tracking-wide">
                                      Licença Maternidade
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Rodapé Comparativo Rápido do Dia: Quem Opera vs Quem Folga */}
        <div className="bg-white border border-slate-300 grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-300">
          <div className="p-3.5">
            <div className="text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-700" />
              <span>Ativos nos Postos Neste Dia ({snapshot.totals.working})</span>
            </div>
            <p className="text-sm text-slate-900 leading-relaxed">
              {snapshot.allPeopleStatuses.filter((p) => p.isWork).length > 0
                ? snapshot.allPeopleStatuses
                    .filter((p) => p.isWork)
                    .map(
                      (p) =>
                        `${p.employee.shortName} (${p.shift.startTime || '08:00'}–${p.shift.endTime || '17:24'})`
                    )
                    .join(' • ')
                : 'Domingo DSR — Lojas fechadas sem expediente presencial.'}
            </p>
          </div>

          <div className="p-3.5 bg-emerald-50/40">
            <div className="text-xs font-extrabold uppercase tracking-wider text-emerald-900 mb-1.5 flex items-center gap-1.5">
              <CalendarDays className="w-3.5 h-3.5 text-emerald-700" />
              <span>Em Folga 5x2 / DSR Neste Dia ({snapshot.totals.folga5x2 + snapshot.totals.dsr})</span>
            </div>
            <p className="text-sm text-emerald-950 leading-relaxed">
              {snapshot.allPeopleStatuses.filter((p) => p.isFolga5x2 || p.isDsr).length > 0
                ? snapshot.allPeopleStatuses
                    .filter((p) => p.isFolga5x2 || p.isDsr)
                    .map(
                      (p) =>
                        `${p.employee.shortName} (${p.isDsr ? 'DSR' : p.isProlongedWeekendPart ? 'Folga FDS Prol.' : 'Folga'})`
                    )
                    .join(' • ')
                : 'Toda a equipe regular em atividade neste dia.'}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
