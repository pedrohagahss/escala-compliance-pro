import React, { useMemo, useState } from 'react';
import {
  CalendarCheck2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  FileDown,
  Layers,
  ShieldCheck,
  Sparkles,
  Store,
  AlertTriangle,
} from 'lucide-react';
import { Scenario } from '../types/schedule';
import { formatHoursDecimal } from '../utils/compliance';
import { analyzeScenarioMetrics, OPTIMIZED_SCENARIO_IDS } from '../utils/scenarioProposals';

interface ScenarioSwitcherBarProps {
  scenarios: Scenario[];
  activeScenario: Scenario;
  onSelectScenario: (scenarioId: string) => void;
  onOpenComparator: () => void;
  onOpenComparativePdf: () => void;
}

const OPTIMIZED_ID_LIST: string[] = Object.values(OPTIMIZED_SCENARIO_IDS);

export const ScenarioSwitcherBar: React.FC<ScenarioSwitcherBarProps> = ({
  scenarios,
  activeScenario,
  onSelectScenario,
  onOpenComparator,
  onOpenComparativePdf,
}) => {
  const [detailsExpanded, setDetailsExpanded] = useState(false);

  const metricsMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof analyzeScenarioMetrics>>();
    scenarios.forEach((s) => {
      map.set(s.id, analyzeScenarioMetrics(s));
    });
    return map;
  }, [scenarios]);

  const optimizedScenarios = scenarios.filter((s) => OPTIMIZED_ID_LIST.includes(s.id));
  const legacyScenarios = scenarios.filter((s) => !OPTIMIZED_ID_LIST.includes(s.id));
  const activeMetrics = metricsMap.get(activeScenario.id) || analyzeScenarioMetrics(activeScenario);

  return (
    <section
      aria-label="Seletor e Indicadores de Cenários Propostos"
      className="no-print bg-white border border-slate-300 rounded-none shadow-none overflow-hidden"
    >
      {/* Top Bar Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 text-white flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-blue-300" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-extrabold tracking-tight">
                Simulador 42h / Teto 8h24 — Demonstração de Cenários (1 por vez)
              </h2>
              <span className="text-xs font-mono text-emerald-300 font-bold">
                {activeMetrics.within8h24Cap ? 'Máx Diário ≤ 8h24 OK' : 'Atenção Teto Diário'}
              </span>
            </div>
            <p className="text-[11px] text-slate-300 mt-0.5">
              Clique em um cenário abaixo para atualizar toda a grade S1–S4, conferir a cobertura de setores e os fins de semana prolongados (Sáb→Dom→Seg).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <button
            type="button"
            onClick={onOpenComparator}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-semibold transition cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5 text-blue-300" />
            <span>Comparar Todos ({optimizedScenarios.length})</span>
          </button>
          <button
            type="button"
            onClick={onOpenComparativePdf}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold shadow-xs transition cursor-pointer"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span>Organizar &amp; Salvar PDF</span>
          </button>
        </div>
      </div>

      {/* 4 Optimized Scenarios Cards (1-click switcher) */}
      <div className="p-3 bg-slate-50/70 border-b border-slate-200">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
          {optimizedScenarios.map((scen, idx) => {
            const m = metricsMap.get(scen.id)!;
            const isActive = scen.id === activeScenario.id;
            const isCenB = scen.id.includes('-b-est-');
            return (
              <button
                key={scen.id}
                type="button"
                onClick={() => onSelectScenario(scen.id)}
                data-testid={`scenario-btn-${scen.id}`}
                aria-pressed={isActive}
                className={`text-left rounded-none p-3 border transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                  isActive
                    ? 'bg-blue-50 border-blue-600 ring-2 ring-blue-500/20 shadow-sm'
                    : 'bg-white border-slate-200 hover:border-blue-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between gap-1.5">
                  <span
                    className={`text-[11px] font-extrabold px-1.5 py-0.5 rounded-none border ${
                      isCenB
                        ? 'bg-purple-50 text-purple-800 border-purple-200'
                        : 'bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    Cenário {idx + 1} &bull; {isCenB ? 'Estendido 18h/14h' : 'Loja Atual 17:30/13h'}
                  </span>
                  {isActive && (
                    <span className="text-[10px] font-extrabold text-blue-700 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Ativo
                    </span>
                  )}
                </div>

                <div>
                  <div className="text-xs font-extrabold text-slate-900 leading-snug">
                    {scen.shortTag}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5 line-clamp-2">
                    {scen.description}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[10px] font-mono">
                  <span className="font-bold text-blue-800">
                    {formatHoursDecimal(m.avgWeeklyHoursClt)}/sem ({m.utilization42hPct}%)
                  </span>
                  <span className="text-emerald-700 font-semibold">
                    {m.prolongedWeekendsCount} FDS prol.
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Baselines Originais & Expand Button */}
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
            <span className="text-slate-500 font-semibold mr-1">Baselines originais:</span>
            {legacyScenarios.map((scen) => {
              const isActive = scen.id === activeScenario.id;
              return (
                <button
                  key={scen.id}
                  type="button"
                  onClick={() => onSelectScenario(scen.id)}
                  className={`px-2 py-0.5 rounded-lg border text-[11px] font-semibold transition cursor-pointer ${
                    isActive
                      ? 'bg-slate-800 text-white border-slate-800'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {scen.shortTag}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setDetailsExpanded((v) => !v)}
            className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 hover:text-blue-900 cursor-pointer"
          >
            {detailsExpanded ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" />
                <span>Ocultar matriz de FDS prolongados &amp; setores</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                <span>Ver matriz de FDS prolongados &amp; cobertura por setor</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Live KPI Summary of Active Scenario */}
      <div className="px-4 py-2.5 bg-white grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
        <div className="flex items-center gap-2">
          <Store className="w-4 h-4 text-slate-500 shrink-0" />
          <div>
            <div className="text-[10px] text-slate-500 font-medium">Janela das Lojas</div>
            <div className="font-bold text-slate-900 text-[11px]">
              {activeMetrics.storeHoursSummary}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-600 shrink-0" />
          <div>
            <div className="text-[10px] text-slate-500 font-medium">Máx. Diário Observado</div>
            <div
              className={`font-extrabold text-[11px] ${
                activeMetrics.within8h24Cap ? 'text-emerald-700' : 'text-rose-700'
              }`}
            >
              {formatHoursDecimal(activeMetrics.maxDailyHoursObserved)} (teto 8h24)
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
          <div>
            <div className="text-[10px] text-slate-500 font-medium">Aproveitamento 42h</div>
            <div className="font-extrabold text-indigo-900 text-[11px]">
              {formatHoursDecimal(activeMetrics.avgWeeklyHoursClt)}/sem ({activeMetrics.utilization42hPct}%)
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <CalendarCheck2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <div>
            <div className="text-[10px] text-slate-500 font-medium">FDS Prolongados (Sáb→Seg)</div>
            <div className="font-bold text-emerald-800 text-[11px]">
              {activeMetrics.prolongedWeekendsCount} no ciclo ({activeMetrics.employeesWithProlongedWeekend} colab.)
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0" />
          <div>
            <div className="text-[10px] text-slate-500 font-medium">Picos Qui / Sex / Sáb</div>
            <div className="font-bold text-slate-900 text-[11px]">
              Qui {activeMetrics.thursdayAvgPct}% &bull; Sex {activeMetrics.fridayAvgPct}% &bull; Sáb {activeMetrics.saturdayAvgActiveClt} CLT
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {activeMetrics.complianceErrorCount === 0 && activeMetrics.uncoveredSectorsTotal === 0 ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <div>
            <div className="text-xs text-slate-600 font-medium">Conformidade S1–S4</div>
            <div
              className={`font-extrabold text-xs ${
                activeMetrics.complianceErrorCount === 0 && activeMetrics.uncoveredSectorsTotal === 0
                  ? 'text-emerald-700'
                  : 'text-rose-700'
              }`}
            >
              {activeMetrics.complianceErrorCount} erros &bull; {activeMetrics.uncoveredSectorsTotal} descob.
            </div>
          </div>
        </div>
      </div>

      {/* Expandable Detail Matrix: FDS Prolongados & Efetivo por Setor */}
      {detailsExpanded && (
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-300 grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
          {/* Coluna 1: Quem faz Fim de Semana Prolongado */}
          <div className="bg-white border border-slate-300 rounded-none p-3">
            <h3 className="font-extrabold text-slate-900 text-xs mb-2 flex items-center gap-1.5">
              <CalendarCheck2 className="w-4 h-4 text-emerald-700" />
              <span>Rodízio de Finais de Semana Prolongados (Sáb + Dom + Seg)</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-52 overflow-y-auto pr-1">
              {activeMetrics.prolongedWeekends.map((pw, idx) => (
                <div
                  key={`${pw.employeeId}-${idx}`}
                  className="flex items-center justify-between px-2 py-1 border-b border-emerald-300 bg-emerald-100/70 text-xs"
                >
                  <span className="font-bold text-slate-900">{pw.shortName}</span>
                  <span className="font-mono font-semibold text-emerald-900">{pw.transitionLabel}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Coluna 2: Efetivo Min/Máx por Setor (Seg–Sex e Sábado) */}
          <div className="bg-white border border-slate-300 rounded-none p-3">
            <h3 className="font-extrabold text-slate-900 text-xs mb-2 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-blue-700" />
              <span>Efetivo Observado vs. Mínimo Exigido por Setor (S1–S4)</span>
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                    <th className="py-1 px-2 text-left">Setor</th>
                    <th className="py-1 px-2 text-center">Seg–Sex (Ativo / Mín)</th>
                    <th className="py-1 px-2 text-center">Sábado (Ativo / Mín)</th>
                    <th className="py-1 px-2 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {activeMetrics.sectorCoverageRows.map((row) => (
                    <tr key={row.sectorId} className="border-b border-slate-200">
                      <td className="py-1 px-2 font-semibold text-slate-900">{row.sectorTitle}</td>
                      <td className="py-1 px-2 text-center font-mono">
                        {row.minObservedWeekday === row.maxObservedWeekday
                          ? `${row.minObservedWeekday}`
                          : `${row.minObservedWeekday}–${row.maxObservedWeekday}`}{' '}
                        / <span className="text-slate-600">mín {row.weekdayMin}</span>
                      </td>
                      <td className="py-1 px-2 text-center font-mono">
                        {row.minObservedSaturday === row.maxObservedSaturday
                          ? `${row.minObservedSaturday}`
                          : `${row.minObservedSaturday}–${row.maxObservedSaturday}`}{' '}
                        / <span className="text-slate-600">mín {row.saturdayMin}</span>
                      </td>
                      <td className="py-1 px-2 text-center">
                        <span
                          className={`font-bold text-xs ${
                            row.uncoveredCount === 0
                              ? 'text-emerald-800'
                              : 'text-rose-800'
                          }`}
                        >
                          {row.uncoveredCount === 0 ? '100% Coberto' : `${row.uncoveredCount} déficit`}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
