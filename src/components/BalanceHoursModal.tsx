import React, { useState } from 'react';
import { Employee, EmployeeMonthlySummary, LegalPhase } from '../types/schedule';
import {
  balanceActiveWeekForMonthlyTarget,
  balanceAllWeeksToMonthlyTarget,
  balanceScheduleToTarget,
  calculateEmployeeMonthlySummary,
  ensureEmployeeWeeksSchedule,
  formatHoursDecimal,
  LEGAL_PHASES,
  replaceEmployeeWeekSchedule,
} from '../utils/compliance';
import { Scale, X, Sparkles, AlertCircle, Layers, Calendar } from 'lucide-react';

interface BalanceHoursModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee;
  activeWeekIndex: number;
  currentPhase: LegalPhase;
  monthlySummary?: EmployeeMonthlySummary;
  onSaveEmployee: (
    updated: Employee,
    scope: 'ACTIVE_WEEK' | 'ALL_WEEKS',
    targetWeekNumber?: number
  ) => void;
}

export const BalanceHoursModal: React.FC<BalanceHoursModalProps> = ({
  isOpen,
  onClose,
  employee,
  activeWeekIndex,
  currentPhase,
  monthlySummary,
  onSaveEmployee,
}) => {
  if (!isOpen) return null;

  const preparedEmployee = ensureEmployeeWeeksSchedule(employee);
  const phaseConfig = LEGAL_PHASES[currentPhase];
  const targetWeeklyHours =
    preparedEmployee.contractType === 'ESTAGIARIO' ? 24.0 : phaseConfig.maxWeeklyHours;

  const computedSummary =
    monthlySummary || calculateEmployeeMonthlySummary(preparedEmployee, currentPhase);

  const [targetWeek, setTargetWeek] = useState<number>(activeWeekIndex);

  const selectedWeekHours = computedSummary.weeklyHours[targetWeek - 1] ?? 0;
  const weekDiffHours = Number((targetWeeklyHours - selectedWeekHours).toFixed(2));
  const isWeekShortfall = weekDiffHours > 0.05;
  const isWeekOvertime = weekDiffHours < -0.05;

  const monthlyDiffHours = Number(
    (computedSummary.monthlyTargetHours - computedSummary.totalMonthlyHours).toFixed(2)
  );
  const isMonthShortfall = monthlyDiffHours > 0.05;
  const isMonthOvertime = monthlyDiffHours < -0.05;

  const [balanceScope, setBalanceScope] = useState<
    'ACTIVE_WEEK_ONLY' | 'ACTIVE_WEEK_TO_MONTH' | 'ALL_WEEKS_TO_MONTH'
  >('ALL_WEEKS_TO_MONTH');
  const [strategy, setStrategy] = useState<'AUTO' | 'EXTEND_EXIT' | 'REDUCE_LUNCH'>('AUTO');

  const selectedWeekSched =
    preparedEmployee.weeksSchedule?.[targetWeek] || preparedEmployee.schedule;
  const activeWorkDays = Object.values(selectedWeekSched).filter((s) => s.type === 'TRABALHO');

  const formatSigned = (val: number): string => {
    if (Math.abs(val) < 0.05) return '0h00';
    return `${val > 0 ? '+' : '-'}${formatHoursDecimal(Math.abs(val))}`;
  };

  const handleApplyBalance = () => {
    if (balanceScope === 'ACTIVE_WEEK_ONLY') {
      const balancedSched = balanceScheduleToTarget(
        selectedWeekSched,
        targetWeeklyHours,
        strategy,
        preparedEmployee.contractType === 'ESTAGIARIO'
      );
      const updated = replaceEmployeeWeekSchedule(preparedEmployee, targetWeek, balancedSched);
      onSaveEmployee({ ...updated, schedule: balancedSched }, 'ACTIVE_WEEK', targetWeek);
    } else if (balanceScope === 'ACTIVE_WEEK_TO_MONTH') {
      const balanced = balanceActiveWeekForMonthlyTarget(
        preparedEmployee,
        targetWeek,
        currentPhase,
        strategy
      );
      const updatedWeek = balanced.weeksSchedule?.[targetWeek] || balanced.schedule;
      onSaveEmployee({ ...balanced, schedule: updatedWeek }, 'ACTIVE_WEEK', targetWeek);
    } else {
      const balancedAll = balanceAllWeeksToMonthlyTarget(
        preparedEmployee,
        currentPhase,
        strategy
      );
      const activeWeekSched =
        balancedAll.weeksSchedule?.[targetWeek] || balancedAll.schedule;
      onSaveEmployee({ ...balancedAll, schedule: activeWeekSched }, 'ALL_WEEKS');
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden my-6 animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Equilibrar Carga Horária &amp; Acúmulo Mensal (S1–S4)
              </h3>
              <p className="text-xs text-slate-500">
                Compense o acúmulo entre semanas preservando as folgas individuais de cada semana
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar modal"
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 text-xs text-slate-700 max-h-[75vh] overflow-y-auto">
          {/* Card Resumo do Colaborador */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-slate-900 text-sm">{preparedEmployee.name}</span>
              <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold text-[10px]">
                {preparedEmployee.role}
              </span>
            </div>

            {/* Resumo Rápido Semana Selecionada vs Mês */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-200 text-center font-mono">
              <div className="p-2 bg-white rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-500 block">Semana {targetWeek}</span>
                <span className="font-bold text-slate-900 text-sm">
                  {formatHoursDecimal(selectedWeekHours)}
                </span>
                <span className="text-[10px] text-slate-400 block">
                  Meta {formatHoursDecimal(targetWeeklyHours)}
                </span>
              </div>

              <div
                className={`p-2 rounded-lg border ${
                  isWeekShortfall
                    ? 'bg-amber-50 border-amber-300 text-amber-900'
                    : isWeekOvertime
                    ? 'bg-blue-50 border-blue-300 text-blue-900'
                    : 'bg-emerald-50 border-emerald-300 text-emerald-900'
                }`}
              >
                <span className="text-[10px] block">Saldo Sem. {targetWeek}</span>
                <span className="font-bold text-sm">
                  {isWeekShortfall
                    ? `-${formatHoursDecimal(weekDiffHours)}`
                    : isWeekOvertime
                    ? `+${formatHoursDecimal(Math.abs(weekDiffHours))}`
                    : '0h00'}
                </span>
              </div>

              <div className="p-2 bg-white rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-500 block">Soma Mês (S1–S4)</span>
                <span className="font-bold text-slate-900 text-sm">
                  {formatHoursDecimal(computedSummary.totalMonthlyHours)}
                </span>
                <span className="text-[10px] text-slate-400 block">
                  Meta {formatHoursDecimal(computedSummary.monthlyTargetHours)}
                </span>
              </div>

              <div
                className={`p-2 rounded-lg border ${
                  isMonthShortfall
                    ? 'bg-amber-50 border-amber-300 text-amber-900'
                    : isMonthOvertime
                    ? 'bg-blue-50 border-blue-300 text-blue-900'
                    : 'bg-emerald-50 border-emerald-300 text-emerald-900'
                }`}
              >
                <span className="text-[10px] block">Saldo Final Mês</span>
                <span className="font-bold text-sm">
                  {isMonthShortfall
                    ? `-${formatHoursDecimal(monthlyDiffHours)}`
                    : isMonthOvertime
                    ? `+${formatHoursDecimal(Math.abs(monthlyDiffHours))}`
                    : '0h00'}
                </span>
              </div>
            </div>

            {/* Quebra Interativa pelas 4 Semanas com Acúmulo e Folgas */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                Acúmulo semana a semana (clique para selecionar a semana-alvo):
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-center font-mono text-[10px]">
                {computedSummary.weeklyHours.map((wh, idx) => {
                  const wNum = idx + 1;
                  const isActive = wNum === targetWeek;
                  const accum = computedSummary.accumulatedBalances[idx] ?? 0;
                  const offDays = computedSummary.offDaysByWeek[idx] || [];
                  return (
                    <button
                      key={wNum}
                      type="button"
                      onClick={() => setTargetWeek(wNum)}
                      className={`p-2 rounded-lg border text-left transition cursor-pointer ${
                        isActive
                          ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-500/20 text-blue-950'
                          : 'bg-white border-slate-200 hover:bg-slate-100 text-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between font-bold">
                        <span>S{wNum}</span>
                        <span>{formatHoursDecimal(wh)}</span>
                      </div>
                      <div
                        className={`text-[9px] mt-0.5 font-semibold ${
                          accum < -0.08
                            ? 'text-amber-800'
                            : accum > 0.08
                            ? 'text-blue-700'
                            : 'text-emerald-700'
                        }`}
                      >
                        Acum: {formatSigned(accum)}
                      </div>
                      <div className="text-[9px] text-slate-500 truncate mt-0.5 font-sans">
                        Folgas: {offDays.length > 0 ? offDays.join(', ') : 'Nenhuma'}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Escolha de Escopo (Isolamento vs Acúmulo Mensal) */}
          <div className="space-y-2">
            <span className="font-bold text-slate-900 block">
              Qual abrangência aplicar?
            </span>

            <div className="space-y-2">
              <label
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                  balanceScope === 'ALL_WEEKS_TO_MONTH'
                    ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-500/20'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="balanceScope"
                  checked={balanceScope === 'ALL_WEEKS_TO_MONTH'}
                  onChange={() => setBalanceScope('ALL_WEEKS_TO_MONTH')}
                  className="mt-0.5 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <strong className="text-slate-900 flex items-center gap-1.5">
                    <Scale className="w-3.5 h-3.5 text-emerald-600" />
                    Fechar Soma do Mês nas 4 Semanas (S1+S2+S3+S4 = {formatHoursDecimal(computedSummary.monthlyTargetHours)})
                  </strong>
                  <span className="text-slate-500 text-[11px]">
                    Distribui o saldo acumulado entre as 4 semanas preservando os dias de folga específicos de cada semana.
                  </span>
                </div>
              </label>

              <label
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                  balanceScope === 'ACTIVE_WEEK_TO_MONTH'
                    ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-500/20'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="balanceScope"
                  checked={balanceScope === 'ACTIVE_WEEK_TO_MONTH'}
                  onChange={() => setBalanceScope('ACTIVE_WEEK_TO_MONTH')}
                  className="mt-0.5 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <strong className="text-slate-900 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-indigo-600" />
                    Compensar Acúmulo apenas na Semana {targetWeek} ({formatHoursDecimal(computedSummary.monthlyTargetHours)} no mês)
                  </strong>
                  <span className="text-slate-500 text-[11px]">
                    Usa apenas a Semana {targetWeek} para absorver créditos/débitos acumulados das semanas S
                    {[1, 2, 3, 4].filter((w) => w !== targetWeek).join(', S')}, mantendo-as inalteradas (teto 10h/dia CLT).
                  </span>
                </div>
              </label>

              <label
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                  balanceScope === 'ACTIVE_WEEK_ONLY'
                    ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-500/20'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="balanceScope"
                  checked={balanceScope === 'ACTIVE_WEEK_ONLY'}
                  onChange={() => setBalanceScope('ACTIVE_WEEK_ONLY')}
                  className="mt-0.5 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <strong className="text-slate-900 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-blue-600" />
                    Equilibrar apenas a Semana {targetWeek} (Meta {formatHoursDecimal(targetWeeklyHours)})
                  </strong>
                  <span className="text-slate-500 text-[11px]">
                    Altera exclusivamente a Semana {targetWeek}, mantendo as outras 3 semanas 100% intactas.
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Escolha da Estratégia de Compensação */}
          {(isWeekShortfall || isMonthShortfall) && (
            <div className="space-y-2 border-t border-slate-200 pt-3">
              <span className="font-bold text-slate-900 block">
                Como deseja compensar as horas faltantes nos dias úteis ({activeWorkDays.length} dias ativos na Sem. {targetWeek})?
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label
                  className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition ${
                    strategy === 'AUTO'
                      ? 'bg-blue-50 border-blue-400'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="strategy"
                    checked={strategy === 'AUTO'}
                    onChange={() => setStrategy('AUTO')}
                    className="mt-0.5 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <strong className="text-slate-900 block">Estender Saída</strong>
                    <span className="text-slate-500 text-[11px]">
                      Mantém almoço de 1h30 e ajusta o horário final dos dias úteis.
                    </span>
                  </div>
                </label>

                <label
                  className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition ${
                    strategy === 'REDUCE_LUNCH'
                      ? 'bg-blue-50 border-blue-400'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="strategy"
                    checked={strategy === 'REDUCE_LUNCH'}
                    onChange={() => setStrategy('REDUCE_LUNCH')}
                    className="mt-0.5 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <strong className="text-slate-900 block">Reduzir Almoço (1h00)</strong>
                    <span className="text-slate-500 text-[11px]">
                      Reduz intervalo até o mínimo CLT de 1h00 (Art. 71) antes de estender saída.
                    </span>
                  </div>
                </label>
              </div>
            </div>
          )}

          {(isWeekOvertime || isMonthOvertime) && (
            <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3 text-blue-900 leading-relaxed text-[11px] flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                Há saldo excedente acumulado (<strong>Horas Extras +50%</strong> ou{' '}
                <strong>Banco de Horas</strong> conforme Art. 59 CLT). Aplicar o equilíbrio ajustará os horários de saída para fechar exatamente a meta selecionada.
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-200 font-semibold transition cursor-pointer"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleApplyBalance}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>
              {balanceScope === 'ACTIVE_WEEK_ONLY'
                ? `Aplicar na Semana ${targetWeek}`
                : balanceScope === 'ACTIVE_WEEK_TO_MONTH'
                ? `Fechar Mês via Semana ${targetWeek}`
                : `Fechar Soma das 4 Semanas`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
