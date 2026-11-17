import React, { useMemo } from 'react';
import { Scenario } from '../types/schedule';
import { formatHoursDecimal } from '../utils/compliance';
import { analyzeScenarioMetrics, OPTIMIZED_SCENARIO_IDS } from '../utils/scenarioProposals';
import {
  X,
  CheckCircle2,
  Layers,
  ArrowRight,
  ShieldCheck,
  Clock,
  CalendarCheck2,
  FileDown,
  Store,
} from 'lucide-react';

interface ScenarioComparatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  scenarios: Scenario[];
  activeScenarioId: string;
  onSelectScenario: (id: string) => void;
  onOpenComparativePdf?: () => void;
}

const OPTIMIZED_ID_LIST: string[] = Object.values(OPTIMIZED_SCENARIO_IDS);

export const ScenarioComparatorModal: React.FC<ScenarioComparatorModalProps> = ({
  isOpen,
  onClose,
  scenarios,
  activeScenarioId,
  onSelectScenario,
  onOpenComparativePdf,
}) => {
  const optimizedScenarios = useMemo(() => {
    const filtered = scenarios.filter((s) => OPTIMIZED_ID_LIST.includes(s.id));
    return filtered.length > 0 ? filtered : scenarios;
  }, [scenarios]);

  const metricsList = useMemo(
    () => optimizedScenarios.map((scen) => ({ scen, metrics: analyzeScenarioMetrics(scen) })),
    [optimizedScenarios]
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-6xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col my-6 max-h-[92vh]">
        {/* Modal Header */}
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center border border-blue-200 shadow-xs shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">
                Comparador Executivo de Cenários — Meta 42h / Teto 8h24
              </h2>
              <p className="text-xs text-slate-500">
                Comparação objetiva dos 4 cenários otimizados (Horário Atual vs. Cenário B Estendido 18h/14h), cobertura por setor e rodízio de FDS prolongados.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onOpenComparativePdf && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenComparativePdf();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs cursor-pointer transition"
              >
                <FileDown className="w-3.5 h-3.5" />
                <span>Gerar PDF Comparativo</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar comparador"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-200 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Tabela Comparativa Resumida */}
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-[11px] uppercase">
                  <th className="py-2.5 px-3">Cenário Proposto</th>
                  <th className="py-2.5 px-3">Janela Lojas</th>
                  <th className="py-2.5 px-3 text-center">Máx. Diário</th>
                  <th className="py-2.5 px-3 text-center">Média CLT / Sem</th>
                  <th className="py-2.5 px-3 text-center">% das 42h</th>
                  <th className="py-2.5 px-3 text-center">Sábados (Méd.)</th>
                  <th className="py-2.5 px-3 text-center">Qui / Sex</th>
                  <th className="py-2.5 px-3 text-center">FDS Prol.</th>
                  <th className="py-2.5 px-3 text-center">Violações / Descob.</th>
                </tr>
              </thead>
              <tbody>
                {metricsList.map(({ scen, metrics }) => {
                  const isActive = scen.id === activeScenarioId;
                  return (
                    <tr
                      key={`tbl-${scen.id}`}
                      className={`border-b border-slate-100 ${
                        isActive ? 'bg-blue-50/70 font-semibold' : 'bg-white'
                      }`}
                    >
                      <td className="py-2 px-3 text-slate-900 font-bold">{scen.shortTag}</td>
                      <td className="py-2 px-3 text-slate-600 font-mono text-[11px]">
                        {metrics.storeHoursSummary}
                      </td>
                      <td className="py-2 px-3 text-center font-mono">
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                          {formatHoursDecimal(metrics.maxDailyHoursObserved)}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center font-mono font-bold text-slate-900">
                        {formatHoursDecimal(metrics.avgWeeklyHoursClt)} ({formatHoursDecimal(metrics.avgMonthlyHoursClt)}/mês)
                      </td>
                      <td className="py-2 px-3 text-center font-mono font-extrabold text-indigo-800">
                        {metrics.utilization42hPct}%
                      </td>
                      <td className="py-2 px-3 text-center font-mono">
                        {metrics.saturdayAvgActiveClt} CLT + 1 Est.
                      </td>
                      <td className="py-2 px-3 text-center font-mono text-emerald-800">
                        {metrics.thursdayAvgPct}% / {metrics.fridayAvgPct}%
                      </td>
                      <td className="py-2 px-3 text-center font-mono font-bold text-emerald-700">
                        {metrics.prolongedWeekendsCount} ({metrics.employeesWithProlongedWeekend} p.)
                      </td>
                      <td className="py-2 px-3 text-center font-mono">
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                          {metrics.complianceErrorCount} / {metrics.uncoveredSectorsTotal}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 4 Cards Detalhados */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {metricsList.map(({ scen, metrics }, idx) => {
              const isActive = scen.id === activeScenarioId;
              const isCenB = scen.id.includes('-b-est-');

              return (
                <div
                  key={scen.id}
                  className={`rounded-2xl border p-4 flex flex-col justify-between transition-all ${
                    isActive
                      ? 'bg-blue-50/50 border-blue-500 ring-2 ring-blue-500/20 shadow-md'
                      : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-md font-bold border ${
                          isCenB
                            ? 'bg-purple-50 text-purple-800 border-purple-200'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        Proposta {idx + 1} &bull; {isCenB ? 'Cenário B (18h/14h)' : 'Loja Atual'}
                      </span>
                      {isActive && (
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                          Ativo Agora
                        </span>
                      )}
                    </div>

                    <h3 className="text-sm font-extrabold text-slate-900 mb-1.5 leading-snug">
                      {scen.name}
                    </h3>
                    <p className="text-[11px] text-slate-600 mb-3 leading-relaxed">
                      {scen.description}
                    </p>

                    <div className="space-y-2 text-[11px] border-t border-slate-100 pt-3">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 flex items-center gap-1">
                          <Store className="w-3.5 h-3.5 text-slate-500" />
                          Janela Lojas:
                        </span>
                        <span className="font-bold text-slate-900 font-mono text-[10px]">
                          {isCenB ? '08–18h | Sáb 14h' : '08–17:30 | Sáb 13h'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-blue-600" />
                          Aproveitamento 42h:
                        </span>
                        <span className="font-bold text-blue-800 font-mono">
                          {formatHoursDecimal(metrics.avgWeeklyHoursClt)}/sem ({metrics.utilization42hPct}%)
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 flex items-center gap-1">
                          <CalendarCheck2 className="w-3.5 h-3.5 text-emerald-600" />
                          FDS Prol. Sáb→Seg:
                        </span>
                        <span className="font-bold text-emerald-700 font-mono">
                          {metrics.prolongedWeekendsCount} ({metrics.employeesWithProlongedWeekend} colab.)
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
                          Sábado (Ativos):
                        </span>
                        <span className="font-bold text-slate-900 font-mono">
                          {metrics.saturdayAvgActiveClt} CLTs + Matheus
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 mt-4 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => {
                        onSelectScenario(scen.id);
                        onClose();
                      }}
                      className={`w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                        isActive
                          ? 'bg-slate-100 text-slate-600'
                          : 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs'
                      }`}
                    >
                      <span>{isActive ? 'Cenário Demonstrado' : 'Demonstrar Este Cenário'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Síntese Matemática do Gargalo de 42h */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-700 space-y-1.5">
            <div className="font-bold text-slate-900 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Síntese Matemática: Por que o teto de 8h24/dia exige alternância de sábados</span>
            </div>
            <p className="text-slate-600 leading-relaxed">
              Na escala <strong>5x2 (máx. 5 dias/semana)</strong> respeitando estritamente o limite de{' '}
              <strong>8h24/dia (504 min)</strong>: quem folga o sábado fecha exatamente{' '}
              <strong>5 × 8h24 = 42h00 (100%)</strong>. Quem trabalha no sábado atual (<strong>08:00–13:00 = 5h00</strong>) alcança no máximo{' '}
              <strong>4 × 8h24 + 5h00 = 38h36</strong>; já no <strong>Cenário B (Sáb 08:00–14:00 = 6h00 corridas)</strong> com turnos escalonados de <strong>08:00–17:24</strong> e <strong>08:36–18:00</strong>, alcança{' '}
              <strong>39h36</strong> e chega a <strong>97,3% das 42h (40h52/sem)</strong> no revezamento 50/50 — mantendo todos os setores 100% cobertos.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
