import React, { useState } from 'react';
import {
  DayOfWeek,
  DayShift,
  Employee,
  StoreId,
} from '../types/schedule';
import { DAYS_OF_WEEK, formatHoursDecimal, parseTimeToMinutes, minutesToTimeString } from '../utils/compliance';
import { Clock, Coffee, Building2, Calendar } from 'lucide-react';

interface DailyGanttTimelineProps {
  employees: Employee[];
  onUpdateShift: (employeeId: string, day: DayOfWeek, newShift: Partial<DayShift>) => void;
  onEditEmployeeShiftModal: (employee: Employee, day: DayOfWeek) => void;
}

export const DailyGanttTimeline: React.FC<DailyGanttTimelineProps> = ({
  employees,
  onUpdateShift,
  onEditEmployeeShiftModal,
}) => {
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>('SEG');
  const [selectedStore, setSelectedStore] = useState<'ALL' | StoreId>('ALL');

  // Timeline: 07:30 (450m) às 18:30 (1110m) = 660 minutos
  const TIMELINE_START = 450; // 07:30
  const TIMELINE_END = 1110;  // 18:30
  const TOTAL_MINUTES = TIMELINE_END - TIMELINE_START; // 660 min

  const OPENING_MIN = 480;  // 08:00
  const CLOSING_MIN = 1050; // 17:30
  const LUNCH_WINDOW_START = 690; // 11:30
  const LUNCH_WINDOW_END = 870;   // 14:30

  const hourTicks = [
    { label: '07:30', min: 450 },
    { label: '08:00', min: 480 },
    { label: '09:00', min: 540 },
    { label: '10:00', min: 600 },
    { label: '11:00', min: 660 },
    { label: '12:00', min: 720 },
    { label: '13:00', min: 780 },
    { label: '14:00', min: 840 },
    { label: '15:00', min: 900 },
    { label: '16:00', min: 960 },
    { label: '17:00', min: 1020 },
    { label: '17:30', min: 1050 },
    { label: '18:00', min: 1080 },
    { label: '18:30', min: 1110 },
  ];

  const filteredEmployees = employees.filter((emp) => {
    if (emp.contractType === 'LICENCA_MATERNIDADE' || emp.isCirculating) return false;
    if (selectedStore !== 'ALL' && emp.defaultStore !== selectedStore) return false;
    return true;
  });

  const getPercent = (minutes: number) => {
    const clamped = Math.max(TIMELINE_START, Math.min(TIMELINE_END, minutes));
    return ((clamped - TIMELINE_START) / TOTAL_MINUTES) * 100;
  };

  const adjustLunchDuration = (emp: Employee, durationMin: number) => {
    const shift = emp.schedule[selectedDay];
    if (!shift || shift.type !== 'TRABALHO' || !shift.lunchStart) return;

    const lStartMin = parseTimeToMinutes(shift.lunchStart);
    const newLEndMin = lStartMin + durationMin;
    const newLEndStr = minutesToTimeString(newLEndMin);

    onUpdateShift(emp.id, selectedDay, {
      lunchEnd: newLEndStr,
    });
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
      {/* Top Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        {/* Seletor do Dia */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
          <Calendar className="w-3.5 h-3.5 text-slate-500 ml-1.5" />
          {DAYS_OF_WEEK.map((d) => (
            <button
              key={d.key}
              onClick={() => setSelectedDay(d.key)}
              className={`px-3 py-1.5 rounded-lg font-bold transition ${
                selectedDay === d.key
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {d.shortLabel}
            </button>
          ))}
        </div>

        {/* Filtro de Loja & Legenda */}
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <Building2 className="w-3.5 h-3.5 text-slate-500 ml-1" />
            <button
              onClick={() => setSelectedStore('ALL')}
              className={`px-2.5 py-1 rounded-md transition font-medium ${
                selectedStore === 'ALL' ? 'bg-white text-blue-700 font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Ambas as Lojas
            </button>
            <button
              onClick={() => setSelectedStore('LOJA_1')}
              className={`px-2.5 py-1 rounded-md transition font-medium ${
                selectedStore === 'LOJA_1' ? 'bg-white text-blue-700 font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Loja 1
            </button>
            <button
              onClick={() => setSelectedStore('LOJA_2')}
              className={`px-2.5 py-1 rounded-md transition font-medium ${
                selectedStore === 'LOJA_2' ? 'bg-white text-blue-700 font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Loja 2
            </button>
          </div>

          <div className="hidden md:flex items-center gap-3 text-slate-600 text-[11px]">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-blue-500 inline-block" /> Turno Manhã
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-amber-400 inline-block" /> Almoço (1h30)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-indigo-500 inline-block" /> Turno Tarde
            </span>
          </div>
        </div>
      </div>

      {/* Canvas da Timeline */}
      <div className="relative overflow-x-auto select-none pt-2">
        <div className="min-w-[860px]">
          {/* Régua de Horas */}
          <div className="relative h-10 border-b border-slate-200 text-[11px] font-mono text-slate-500">
            {/* Janela de Almoço */}
            <div
              className="absolute top-0 bottom-0 bg-amber-500/10 border-x border-amber-500/20 pointer-events-none"
              style={{
                left: `${getPercent(LUNCH_WINDOW_START)}%`,
                width: `${getPercent(LUNCH_WINDOW_END) - getPercent(LUNCH_WINDOW_START)}%`,
              }}
            >
              <span className="absolute top-1 left-2 text-[10px] text-amber-800 uppercase font-sans font-bold tracking-wider">
                Janela de Almoço (11:30 às 14:30)
              </span>
            </div>

            {/* Marcador Abertura 08:00 */}
            <div
              className="absolute top-0 bottom-0 border-l-2 border-emerald-500 z-10"
              style={{ left: `${getPercent(OPENING_MIN)}%` }}
            >
              <span className="absolute -top-1 left-1 text-[10px] bg-emerald-600 text-white font-bold px-1.5 py-0.2 rounded shadow-xs">
                08h Abertura
              </span>
            </div>

            {/* Marcador Fechamento 17:30 */}
            <div
              className="absolute top-0 bottom-0 border-l-2 border-rose-500 z-10"
              style={{ left: `${getPercent(CLOSING_MIN)}%` }}
            >
              <span className="absolute -top-1 right-1 text-[10px] bg-rose-600 text-white font-bold px-1.5 py-0.2 rounded shadow-xs">
                17h30 Fechamento
              </span>
            </div>

            {/* Marcadores das Horas */}
            {hourTicks.map((tick) => (
              <div
                key={tick.min}
                className="absolute top-4 -translate-x-1/2 flex flex-col items-center"
                style={{ left: `${getPercent(tick.min)}%` }}
              >
                <div className="w-px h-2 bg-slate-300" />
                <span className="mt-1">{tick.label}</span>
              </div>
            ))}
          </div>

          {/* Linhas de Colaboradores */}
          <div className="divide-y divide-slate-100">
            {filteredEmployees.map((emp) => {
              const shift = emp.schedule[selectedDay];
              const isWork = shift?.type === 'TRABALHO';
              const startMin = shift?.startTime ? parseTimeToMinutes(shift.startTime) : 0;
              const endMin = shift?.endTime ? parseTimeToMinutes(shift.endTime) : 0;
              const lunchStartMin = shift?.lunchStart ? parseTimeToMinutes(shift.lunchStart) : 0;
              const lunchEndMin = shift?.lunchEnd ? parseTimeToMinutes(shift.lunchEnd) : 0;

              const hasLunch = shift?.lunchStart && shift?.lunchEnd && lunchEndMin > lunchStartMin;

              return (
                <div
                  key={emp.id}
                  className="relative flex items-center py-2.5 hover:bg-slate-50 transition group"
                >
                  {/* Nome do Colaborador */}
                  <div className="w-52 pr-3 flex flex-col shrink-0">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: emp.badgeColor }} />
                      <span className="text-xs font-bold text-slate-900 truncate">
                        {emp.shortName}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500 truncate flex items-center gap-1">
                      <span>{emp.role}</span>
                      <span className="text-slate-300">&bull;</span>
                      <span className="font-mono text-slate-600 font-medium">{shift?.chairId || emp.defaultChairId}</span>
                    </div>
                  </div>

                  {/* Barras Gantt */}
                  <div className="relative flex-1 h-9 bg-slate-100/70 rounded-lg border border-slate-200 overflow-hidden">
                    {/* Linhas guias verticais */}
                    <div
                      className="absolute top-0 bottom-0 border-l border-emerald-400/40 z-0 pointer-events-none"
                      style={{ left: `${getPercent(OPENING_MIN)}%` }}
                    />
                    <div
                      className="absolute top-0 bottom-0 border-l border-rose-400/40 z-0 pointer-events-none"
                      style={{ left: `${getPercent(CLOSING_MIN)}%` }}
                    />

                    {isWork ? (
                      hasLunch ? (
                        <>
                          {/* Segmento Manhã */}
                          <div
                            onClick={() => onEditEmployeeShiftModal(emp, selectedDay)}
                            className="absolute top-1 bottom-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-semibold flex items-center px-2 cursor-pointer shadow-xs transition"
                            style={{
                              left: `${getPercent(startMin)}%`,
                              width: `${getPercent(lunchStartMin) - getPercent(startMin)}%`,
                            }}
                            title={`Turno Manhã: ${shift.startTime} às ${shift.lunchStart}`}
                          >
                            <span className="truncate">{shift.startTime}–{shift.lunchStart}</span>
                          </div>

                          {/* Intervalo de Almoço */}
                          <div
                            className="absolute top-1.5 bottom-1.5 rounded bg-amber-100 border border-amber-300 text-amber-900 text-[9px] flex items-center justify-center font-mono font-bold select-none"
                            style={{
                              left: `${getPercent(lunchStartMin)}%`,
                              width: `${getPercent(lunchEndMin) - getPercent(lunchStartMin)}%`,
                            }}
                            title={`Almoço: ${shift.lunchStart} às ${shift.lunchEnd} (${lunchEndMin - lunchStartMin} minutos)`}
                          >
                            <Coffee className="w-2.5 h-2.5 mr-0.5 text-amber-700" />
                            <span>{lunchEndMin - lunchStartMin}m</span>
                          </div>

                          {/* Segmento Tarde */}
                          <div
                            onClick={() => onEditEmployeeShiftModal(emp, selectedDay)}
                            className="absolute top-1 bottom-1 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-semibold flex items-center px-2 cursor-pointer shadow-xs transition"
                            style={{
                              left: `${getPercent(lunchEndMin)}%`,
                              width: `${getPercent(endMin) - getPercent(lunchEndMin)}%`,
                            }}
                            title={`Turno Tarde: ${shift.lunchEnd} às ${shift.endTime}`}
                          >
                            <span className="truncate">{shift.lunchEnd}–{shift.endTime}</span>
                          </div>
                        </>
                      ) : (
                        /* Turno Único Contínuo (ex: Sábado 08:00 às 13:00) */
                        <div
                          onClick={() => onEditEmployeeShiftModal(emp, selectedDay)}
                          className="absolute top-1 bottom-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-semibold flex items-center justify-between px-2.5 cursor-pointer shadow-xs transition"
                          style={{
                            left: `${getPercent(startMin)}%`,
                            width: `${getPercent(endMin) - getPercent(startMin)}%`,
                          }}
                          title={`Turno Contínuo: ${shift.startTime} às ${shift.endTime}`}
                        >
                          <span className="truncate">{shift.startTime}–{shift.endTime} (5h)</span>
                        </div>
                      )
                    ) : (
                      /* Folga */
                      <div className="absolute inset-0 flex items-center justify-center bg-slate-50 text-slate-400 text-xs font-medium">
                        {shift?.type === 'FOLGA_DSR' ? 'Descanso Semanal Remunerado (DSR)' : 'Folga 5x2'}
                      </div>
                    )}
                  </div>

                  {/* Ajustes Rápidos de Almoço */}
                  {isWork && hasLunch && (
                    <div className="hidden lg:flex items-center gap-1 pl-3 shrink-0 opacity-60 group-hover:opacity-100 transition">
                      <span className="text-[10px] text-slate-500 font-medium">Almoço:</span>
                      <button
                        onClick={() => adjustLunchDuration(emp, 60)}
                        className="px-1.5 py-0.5 rounded bg-white hover:bg-slate-100 text-slate-700 text-[10px] border border-slate-200 shadow-2xs font-mono"
                        title="1 hora de almoço"
                      >
                        1h00
                      </button>
                      <button
                        onClick={() => adjustLunchDuration(emp, 90)}
                        className="px-1.5 py-0.5 rounded bg-white hover:bg-slate-100 text-slate-700 text-[10px] border border-slate-200 shadow-2xs font-mono font-bold"
                        title="1 hora e 30 minutos (Padrão)"
                      >
                        1h30
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
