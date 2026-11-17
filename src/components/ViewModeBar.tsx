import React from 'react';
import { Building2, CalendarDays, Grid } from 'lucide-react';

export type MainViewMode = 'FLOOR_PLAN' | 'REAL_CALENDAR' | 'WEEKLY_GRID';

interface ViewModeBarProps {
  activeView: MainViewMode;
  onChangeView: (view: MainViewMode) => void;
  selectedDateIso: string;
  onJumpToday: () => void;
}

export const ViewModeBar: React.FC<ViewModeBarProps> = ({
  activeView,
  onChangeView,
  selectedDateIso,
  onJumpToday,
}) => {
  const tabs: Array<{
    id: MainViewMode;
    label: string;
    subtitle: string;
    icon: React.ReactNode;
  }> = [
    {
      id: 'FLOOR_PLAN',
      label: 'Planta do Dia (Setores Hoje)',
      subtitle: 'Visão simulada com pessoas nas baias e setas de dia',
      icon: <Building2 className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'REAL_CALENDAR',
      label: 'Calendário Real & Zoom',
      subtitle: 'Datas reais, projeção mensal e visão panorâmica (4–12 meses)',
      icon: <CalendarDays className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'WEEKLY_GRID',
      label: 'Grade Completa (S1–S4)',
      subtitle: 'Tabela completa de turnos, almoço, BH e PontoMais',
      icon: <Grid className="w-4 h-4 shrink-0" />,
    },
  ];

  return (
    <div
      data-testid="main-view-switcher"
      className="no-print bg-white border border-slate-300 rounded-none flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2 p-2"
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 flex-1">
        {tabs.map((tab) => {
          const isActive = activeView === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              data-main-view-tab={tab.id}
              aria-pressed={isActive}
              onClick={() => onChangeView(tab.id)}
              className={`text-left px-3 py-2 border transition cursor-pointer flex items-center gap-2.5 ${
                isActive
                  ? 'bg-slate-900 border-slate-900 text-white'
                  : 'bg-slate-50 border-slate-300 text-slate-900 hover:bg-slate-100'
              }`}
            >
              <span className={isActive ? 'text-emerald-400' : 'text-blue-700'}>{tab.icon}</span>
              <span className="min-w-0">
                <span className="block text-xs font-extrabold leading-tight truncate">{tab.label}</span>
                <span
                  className={`block text-[11px] leading-tight truncate ${
                    isActive ? 'text-slate-300' : 'text-slate-600'
                  }`}
                >
                  {tab.subtitle}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between lg:justify-end gap-3 px-2 py-1 border-t lg:border-t-0 lg:border-l border-slate-300 shrink-0">
        <div className="text-xs text-slate-700 font-medium">
          Data ativa:{' '}
          <strong className="font-mono text-slate-950">{selectedDateIso.split('-').reverse().join('/')}</strong>
        </div>
        <button
          type="button"
          data-jump-today-button="true"
          onClick={onJumpToday}
          className="px-2.5 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold border border-blue-800 cursor-pointer transition whitespace-nowrap"
        >
          Ir para Hoje
        </button>
      </div>
    </div>
  );
};
