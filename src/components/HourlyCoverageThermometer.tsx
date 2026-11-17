import React, { useState } from 'react';
import { DayOfWeek, DepartmentId, Employee, StoreId } from '../types/schedule';
import { calculateStoreCoverage, DAYS_OF_WEEK } from '../utils/compliance';
import { DEPARTMENTS } from '../data/seuCarroData';
import { Building2, Calendar, CheckCircle2, AlertTriangle, TrendingUp } from 'lucide-react';

interface HourlyCoverageThermometerProps {
  employees: Employee[];
}

export const HourlyCoverageThermometer: React.FC<HourlyCoverageThermometerProps> = ({ employees }) => {
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>('SEG');
  const [selectedStore, setSelectedStore] = useState<'ALL' | StoreId>('LOJA_1');

  const coverage = calculateStoreCoverage(employees, selectedDay);

  const maxStaff = Math.max(
    ...coverage.map((c) =>
      selectedStore === 'ALL'
        ? c.totalLoja1 + c.totalLoja2
        : selectedStore === 'LOJA_1'
        ? c.totalLoja1
        : c.totalLoja2
    ),
    1
  );

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-5">
      {/* Top Header & Day Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            Termômetro de Cobertura Horária
          </h2>
          <p className="text-xs text-slate-500">
            Contingente de colaboradores ativos em loja por horário (07:30 às 18:30)
          </p>
        </div>

        {/* Day Selector */}
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

        {/* Store Selector */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-medium">
          <Building2 className="w-3.5 h-3.5 text-slate-500 ml-1" />
          <button
            onClick={() => setSelectedStore('LOJA_1')}
            className={`px-2.5 py-1 rounded-md transition ${
              selectedStore === 'LOJA_1' ? 'bg-white text-blue-700 font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Loja 1 (Matriz 546)
          </button>
          <button
            onClick={() => setSelectedStore('LOJA_2')}
            className={`px-2.5 py-1 rounded-md transition ${
              selectedStore === 'LOJA_2' ? 'bg-white text-blue-700 font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Loja 2 (Filial 777)
          </button>
          <button
            onClick={() => setSelectedStore('ALL')}
            className={`px-2.5 py-1 rounded-md transition ${
              selectedStore === 'ALL' ? 'bg-white text-blue-700 font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Ambas
          </button>
        </div>
      </div>

      {/* Critical Windows Indicators */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        {/* Abertura 08:00 */}
        {(() => {
          const slot = coverage.find((c) => c.hourStr === '08:00');
          const count = slot
            ? selectedStore === 'ALL'
              ? slot.totalLoja1 + slot.totalLoja2
              : selectedStore === 'LOJA_1'
              ? slot.totalLoja1
              : slot.totalLoja2
            : 0;
          const isOk = count >= (selectedStore === 'LOJA_2' ? 2 : 4);

          return (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between">
              <div>
                <div className="text-slate-500 font-medium">Abertura (08:00)</div>
                <div className="text-lg font-black text-slate-900 font-mono mt-0.5">{count} ativos</div>
              </div>
              <span
                className={`px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 ${
                  isOk ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-amber-100 text-amber-800 border border-amber-200'
                }`}
              >
                {isOk ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                {isOk ? 'Normal' : 'Atenção'}
              </span>
            </div>
          );
        })()}

        {/* Janela de Almoço 12:30 */}
        {(() => {
          const slot = coverage.find((c) => c.hourStr === '12:30');
          const count = slot
            ? selectedStore === 'ALL'
              ? slot.totalLoja1 + slot.totalLoja2
              : selectedStore === 'LOJA_1'
              ? slot.totalLoja1
              : slot.totalLoja2
            : 0;

          return (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between">
              <div>
                <div className="text-slate-500 font-medium">Almoço (12:30)</div>
                <div className="text-lg font-black text-slate-900 font-mono mt-0.5">{count} ativos em loja</div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                Revezamento 1h30
              </span>
            </div>
          );
        })()}

        {/* Fechamento 17:30 */}
        {(() => {
          const slot = coverage.find((c) => c.hourStr === '17:00');
          const count = slot
            ? selectedStore === 'ALL'
              ? slot.totalLoja1 + slot.totalLoja2
              : selectedStore === 'LOJA_1'
              ? slot.totalLoja1
              : slot.totalLoja2
            : 0;
          const isOk = count >= (selectedStore === 'LOJA_2' ? 2 : 3);

          return (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between">
              <div>
                <div className="text-slate-500 font-medium">Fechamento (17:30)</div>
                <div className="text-lg font-black text-slate-900 font-mono mt-0.5">{count} ativos</div>
              </div>
              <span
                className={`px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 ${
                  isOk ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-rose-100 text-rose-800 border border-rose-200'
                }`}
              >
                {isOk ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                {isOk ? 'Fechamento Seguro' : 'Mínimo'}
              </span>
            </div>
          );
        })()}
      </div>

      {/* Gráfico de Barras */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 overflow-x-auto">
        <div className="min-w-[700px] h-56 flex items-end gap-2 pt-6 pb-2 px-2 border-b border-slate-200 relative">
          {coverage.map((slot) => {
            const count =
              selectedStore === 'ALL'
                ? slot.totalLoja1 + slot.totalLoja2
                : selectedStore === 'LOJA_1'
                ? slot.totalLoja1
                : slot.totalLoja2;

            const heightPercent = maxStaff > 0 ? (count / maxStaff) * 100 : 0;
            const isZero = count === 0;

            return (
              <div
                key={slot.hourStr}
                className="flex-1 flex flex-col items-center h-full justify-end group relative"
              >
                <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-[10px] p-1.5 rounded-md shadow-lg pointer-events-none whitespace-nowrap z-20">
                  <div className="font-bold">{slot.hourStr}</div>
                  <div>{count} ativos</div>
                </div>

                <span className="text-[10px] font-mono font-bold text-slate-600 mb-1">
                  {count > 0 ? count : ''}
                </span>

                <div
                  className={`w-full rounded-t transition-all ${
                    isZero
                      ? 'bg-slate-200 h-1'
                      : slot.isOpeningWindow
                      ? 'bg-emerald-500 hover:bg-emerald-600'
                      : slot.isLunchWindow
                      ? 'bg-amber-400 hover:bg-amber-500'
                      : slot.isClosingWindow
                      ? 'bg-indigo-500 hover:bg-indigo-600'
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                  style={{ height: `${Math.max(4, heightPercent)}%` }}
                />

                <span className="text-[10px] font-mono text-slate-500 mt-2 truncate">
                  {slot.hourStr.endsWith(':00') ? slot.hourStr : ''}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
