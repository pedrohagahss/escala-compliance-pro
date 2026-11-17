import React, { useMemo, useState } from 'react';
import { Printer, X, FileDown, CalendarCheck2, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { Employee, EmployeeMonthlySummary, EmployeePontoMaisSummary, LegalPhase, Scenario } from '../types/schedule';
import {
  DAYS_OF_WEEK,
  ensureEmployeeWeeksSchedule,
  formatHoursDecimal,
  LEGAL_PHASES,
} from '../utils/compliance';
import { analyzeScenarioMetrics, OPTIMIZED_SCENARIO_IDS } from '../utils/scenarioProposals';

interface ComparativePdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  scenarios: Scenario[];
  activeScenario: Scenario;
  employees: Employee[];
  monthlySummaryMap: Record<string, EmployeeMonthlySummary>;
  pontoMaisSummaryMap?: Record<string, EmployeePontoMaisSummary>;
  currentPhase: LegalPhase;
}

const OPTIMIZED_ID_LIST: string[] = Object.values(OPTIMIZED_SCENARIO_IDS);

export const ComparativePdfModal: React.FC<ComparativePdfModalProps> = ({
  isOpen,
  onClose,
  scenarios,
  activeScenario,
  employees,
  monthlySummaryMap,
  pontoMaisSummaryMap,
  currentPhase,
}) => {
  const [sectionFilter, setSectionFilter] = useState<'ALL' | 'COMPARATIVO' | 'GRADE'>('ALL');

  const optimizedScenarios = useMemo(() => {
    const filtered = scenarios.filter((s) => OPTIMIZED_ID_LIST.includes(s.id));
    return filtered.length > 0 ? filtered : scenarios;
  }, [scenarios]);

  const metricsList = useMemo(
    () => optimizedScenarios.map((scen) => ({ scen, metrics: analyzeScenarioMetrics(scen) })),
    [optimizedScenarios]
  );

  const activeMetrics = useMemo(
    () => analyzeScenarioMetrics(activeScenario),
    [activeScenario]
  );

  const preparedEmployees = useMemo(
    () => employees.map(ensureEmployeeWeeksSchedule),
    [employees]
  );

  if (!isOpen) return null;

  const phaseConfig = LEGAL_PHASES[currentPhase];
  const todayStr = new Date().toLocaleDateString('pt-BR');
  const isCenB = activeScenario.id.includes('-b-est-');

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-start justify-center p-4 overflow-y-auto print:static print:bg-white print:p-0 print:block">
      <div className="bg-white rounded-2xl w-full max-w-6xl shadow-2xl border border-slate-200 overflow-hidden my-4 print:shadow-none print:border-none print:m-0 print:max-w-none print:rounded-none">
        {/* Modal Action Bar (Oculto na impressão) */}
        <div className="no-print bg-slate-50 px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center border border-emerald-200">
              <FileDown className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-slate-900">
                Organizador &amp; Exportação PDF — Cenários 42h / Máx. 8h24
              </h2>
              <p className="text-xs text-slate-500">
                Selecione o escopo do documento A4 e clique em Salvar PDF / Imprimir.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="inline-flex rounded-xl border border-slate-200 bg-white p-0.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setSectionFilter('ALL')}
                className={`px-2.5 py-1 rounded-lg cursor-pointer transition ${
                  sectionFilter === 'ALL' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Completo (Comparativo + Grade)
              </button>
              <button
                type="button"
                onClick={() => setSectionFilter('COMPARATIVO')}
                className={`px-2.5 py-1 rounded-lg cursor-pointer transition ${
                  sectionFilter === 'COMPARATIVO' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Só Comparativo
              </button>
              <button
                type="button"
                onClick={() => setSectionFilter('GRADE')}
                className={`px-2.5 py-1 rounded-lg cursor-pointer transition ${
                  sectionFilter === 'GRADE' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Só Grade Ativa
              </button>
            </div>

            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow cursor-pointer transition"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir / Salvar PDF</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar relatório PDF"
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div
          id="comparative-pdf-printable"
          className="p-7 bg-white text-slate-900 space-y-6 max-h-[82vh] overflow-y-auto print:max-h-none print:overflow-visible print:p-0"
        >
          {/* Cabeçalho Institucional */}
          <div className="border-b-2 border-slate-900 pb-3 flex flex-col sm:flex-row sm:items-end justify-between gap-2">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
                SEU CARRO PE VEÍCULOS LTDA &bull; MATRIZ 546 &amp; FILIAL 777 &bull; EC 141/2026
              </div>
              <h1 className="text-lg font-black text-slate-900 uppercase tracking-tight mt-0.5">
                Estudo Comparativo de Escalas 5x2 (42h/sem &bull; Teto 8h24/dia)
              </h1>
            </div>
            <div className="text-right text-[11px] font-mono text-slate-600">
              <div>Regime: {phaseConfig.shortName}</div>
              <div>Emissão: {todayStr}</div>
            </div>
          </div>

          {/* BLOCO 1: Comparativo dos 4 Cenários + Setores + FDS Prolongados */}
          {(sectionFilter === 'ALL' || sectionFilter === 'COMPARATIVO') && (
            <div className="space-y-5">
              {/* Síntese Estratégica */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-700 leading-relaxed">
                <strong className="text-slate-900 block mb-1">
                  Premissa Matemática Respeitada em 100% dos Cenários:
                </strong>
                Para manter <strong>5 dias de trabalho + 2 folgas semanais (5x2)</strong> com jornada máxima diária de{' '}
                <strong>8h24 (504 min)</strong>: nas semanas sem sábado atinge-se{' '}
                <strong>5 × 8h24 = 42h00 (100%)</strong>; já nas semanas com sábado no horário atual (08h–13h = 5h) o teto é{' '}
                <strong>38h36</strong>, chegando a <strong>39h36</strong> no Cenário B (Sáb 08h–14h = 6h corridas sem obrigatoriedade de almoço). Alternar sábados é o caminho legal para maximizar as 42h e conceder <strong>fins de semana prolongados (Sáb → Dom → Seg)</strong> sem descobrir setores críticos.
              </div>

              {/* Tabela Comparativa */}
              <div>
                <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 mb-2">
                  1. Quadro Comparativo das 4 Propostas Otimizadas
                </h2>
                <table className="w-full text-[11px] text-left border-collapse border border-slate-300">
                  <thead>
                    <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300 text-[10px] uppercase">
                      <th className="py-2 px-2 border border-slate-300">Proposta</th>
                      <th className="py-2 px-2 border border-slate-300">Horário Lojas</th>
                      <th className="py-2 px-2 border border-slate-300 text-center">Máx. Dia</th>
                      <th className="py-2 px-2 border border-slate-300 text-center">Média Sem / Mês CLT</th>
                      <th className="py-2 px-2 border border-slate-300 text-center">% das 42h</th>
                      <th className="py-2 px-2 border border-slate-300 text-center">Sábados (Méd.)</th>
                      <th className="py-2 px-2 border border-slate-300 text-center">Qui / Sex</th>
                      <th className="py-2 px-2 border border-slate-300 text-center">FDS Prol.</th>
                      <th className="py-2 px-2 border border-slate-300 text-center">Erros / Descob.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metricsList.map(({ scen, metrics }) => (
                      <tr
                        key={`pdf-cmp-${scen.id}`}
                        className={`border-b border-slate-200 ${
                          scen.id === activeScenario.id ? 'bg-blue-50/70 font-semibold' : ''
                        }`}
                      >
                        <td className="py-1.5 px-2 border border-slate-300 font-bold text-slate-900">
                          {scen.name}
                          {scen.id === activeScenario.id && (
                            <span className="ml-1.5 text-[9px] text-blue-800 font-mono uppercase">
                              [Ativo]
                            </span>
                          )}
                        </td>
                        <td className="py-1.5 px-2 border border-slate-300 font-mono text-[10px]">
                          {metrics.storeHoursSummary}
                        </td>
                        <td className="py-1.5 px-2 border border-slate-300 text-center font-mono font-bold text-emerald-800">
                          {formatHoursDecimal(metrics.maxDailyHoursObserved)}
                        </td>
                        <td className="py-1.5 px-2 border border-slate-300 text-center font-mono font-bold">
                          {formatHoursDecimal(metrics.avgWeeklyHoursClt)} &bull;{' '}
                          {formatHoursDecimal(metrics.avgMonthlyHoursClt)}
                        </td>
                        <td className="py-1.5 px-2 border border-slate-300 text-center font-mono font-extrabold text-indigo-900">
                          {metrics.utilization42hPct}%
                        </td>
                        <td className="py-1.5 px-2 border border-slate-300 text-center font-mono">
                          {metrics.saturdayAvgActiveClt} CLT + 1 Est.
                        </td>
                        <td className="py-1.5 px-2 border border-slate-300 text-center font-mono">
                          {metrics.thursdayAvgPct}% / {metrics.fridayAvgPct}%
                        </td>
                        <td className="py-1.5 px-2 border border-slate-300 text-center font-mono font-bold text-emerald-800">
                          {metrics.prolongedWeekendsCount} ({metrics.employeesWithProlongedWeekend} p.)
                        </td>
                        <td className="py-1.5 px-2 border border-slate-300 text-center font-mono font-bold text-emerald-800">
                          {metrics.complianceErrorCount} / {metrics.uncoveredSectorsTotal}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Cobertura por Setor + Rodízio FDS Prolongado do Cenário Ativo */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 break-inside-avoid">
                <div>
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 mb-2 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-700" />
                    <span>2. Cobertura por Setor ({activeScenario.shortTag})</span>
                  </h3>
                  <table className="w-full text-[10px] border-collapse border border-slate-300">
                    <thead>
                      <tr className="bg-slate-100 font-bold border-b border-slate-300">
                        <th className="py-1.5 px-2 border border-slate-300 text-left">Setor</th>
                        <th className="py-1.5 px-2 border border-slate-300 text-center">Úteis (Ativ / Mín)</th>
                        <th className="py-1.5 px-2 border border-slate-300 text-center">Sáb (Ativ / Mín)</th>
                        <th className="py-1.5 px-2 border border-slate-300 text-center">Déficit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeMetrics.sectorCoverageRows.map((row) => (
                        <tr key={`pdf-sec-${row.sectorId}`} className="border-b border-slate-200">
                          <td className="py-1 px-2 border border-slate-300 font-semibold">
                            {row.sectorTitle}
                          </td>
                          <td className="py-1 px-2 border border-slate-300 text-center font-mono">
                            {row.minObservedWeekday}–{row.maxObservedWeekday} / mín {row.weekdayMin}
                          </td>
                          <td className="py-1 px-2 border border-slate-300 text-center font-mono">
                            {row.minObservedSaturday}–{row.maxObservedSaturday} / mín {row.saturdayMin}
                          </td>
                          <td className="py-1 px-2 border border-slate-300 text-center font-bold text-emerald-800">
                            {row.uncoveredCount === 0 ? '0 (OK)' : row.uncoveredCount}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div>
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 mb-2 flex items-center gap-1.5">
                    <CalendarCheck2 className="w-3.5 h-3.5 text-emerald-700" />
                    <span>3. Rodízio de FDS Prolongados ({activeScenario.shortTag})</span>
                  </h3>
                  <div className="border border-slate-300 rounded-lg p-2 bg-slate-50/40 grid grid-cols-1 sm:grid-cols-2 gap-1 text-[10px]">
                    {activeMetrics.prolongedWeekends.map((pw, idx) => (
                      <div
                        key={`pdf-pw-${pw.employeeId}-${idx}`}
                        className="flex items-center justify-between px-2 py-0.5 bg-white border border-slate-200 rounded"
                      >
                        <span className="font-bold text-slate-900">{pw.shortName}</span>
                        <span className="font-mono text-emerald-800">{pw.transitionLabel}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* BLOCO 2: Grade Completa S1–S4 do Cenário Ativo */}
          {(sectionFilter === 'ALL' || sectionFilter === 'GRADE') && (
            <div className={`space-y-3 ${sectionFilter === 'ALL' ? 'print:break-before-page pt-2' : ''}`}>
              <div className="flex items-center justify-between border-b border-slate-300 pb-2">
                <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                  <span>4. Grade Detalhada S1–S4 — {activeScenario.name}</span>
                </h2>
                <span className="text-[10px] font-mono text-slate-600">
                  {activeMetrics.storeHoursSummary}
                </span>
              </div>

              <table className="w-full text-left border-collapse border border-slate-300 text-[10px]">
                <thead>
                  <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300 uppercase">
                    <th className="py-1.5 px-2 border border-slate-300">Colaborador / Cargo</th>
                    <th className="py-1.5 px-1 text-center border border-slate-300">Sem.</th>
                    <th className="py-1.5 px-1 text-center border border-slate-300">Seg</th>
                    <th className="py-1.5 px-1 text-center border border-slate-300">Ter</th>
                    <th className="py-1.5 px-1 text-center border border-slate-300">Qua</th>
                    <th className="py-1.5 px-1 text-center border border-slate-300">Qui</th>
                    <th className="py-1.5 px-1 text-center border border-slate-300">Sex</th>
                    <th className="py-1.5 px-1 text-center border border-slate-300 bg-slate-200/50">Sáb</th>
                    <th className="py-1.5 px-1 text-center border border-slate-300 bg-slate-200/50">Dom</th>
                    <th className="py-1.5 px-2 text-center border border-slate-300">Sem. / Mês</th>
                  </tr>
                </thead>
                <tbody>
                  {preparedEmployees.map((emp) => {
                    const mSum = monthlySummaryMap[emp.id];
                    return [1, 2, 3, 4].map((wNum, wIdx) => {
                      const weekSched = emp.weeksSchedule?.[wNum] || emp.schedule;
                      const weekHours = mSum?.weeklyHours[wNum - 1] ?? 0;
                      const isFirst = wIdx === 0;

                      return (
                        <tr key={`pdf-grid-${emp.id}-s${wNum}`} className="border-b border-slate-200 break-inside-avoid">
                          {isFirst && (
                            <td rowSpan={4} className="py-1.5 px-2 border border-slate-300 align-top">
                              <div className="font-bold text-slate-900">{emp.name}</div>
                              <div className="text-[9px] text-slate-600">
                                {emp.role} &bull; {emp.department} ({emp.defaultStore === 'LOJA_1' ? 'Matriz' : 'Filial'})
                              </div>
                              {pontoMaisSummaryMap?.[emp.id]?.isEligibleForBanco && (
                                <div className="text-[9px] text-blue-800 font-mono mt-0.5">
                                  BH Mês:{' '}
                                  {Math.abs(pontoMaisSummaryMap[emp.id].netBancoHoursMonth) < 0.08
                                    ? '0h00'
                                    : `${pontoMaisSummaryMap[emp.id].netBancoHoursMonth > 0 ? '+' : '-'}${formatHoursDecimal(
                                        Math.abs(pontoMaisSummaryMap[emp.id].netBancoHoursMonth)
                                      )}`}
                                </div>
                              )}
                            </td>
                          )}
                          <td className="py-1 px-1 text-center border border-slate-300 font-mono font-bold">
                            S{wNum}
                          </td>
                          {DAYS_OF_WEEK.map((d) => {
                            const shift = weekSched[d.key];
                            return (
                              <td
                                key={d.key}
                                className={`py-1 px-1 text-center border border-slate-300 font-mono text-[9px] ${
                                  d.isWeekend ? 'bg-slate-50' : ''
                                }`}
                              >
                                {shift?.type === 'TRABALHO' ? (
                                  <div>
                                    <div className="font-bold">
                                      {shift.startTime}-{shift.endTime}
                                    </div>
                                    {shift.lunchStart && shift.lunchEnd && (
                                      <div className="text-[8px] text-slate-500">
                                        A:{shift.lunchStart}-{shift.lunchEnd}
                                      </div>
                                    )}
                                  </div>
                                ) : shift?.type === 'FOLGA_5X2' ? (
                                  <span className="font-bold text-slate-600">Folga 5x2</span>
                                ) : shift?.type === 'FOLGA_DSR' ? (
                                  <span className="font-bold text-slate-500">DSR</span>
                                ) : shift?.type === 'LICENCA' ? (
                                  <span className="font-bold text-pink-700">Licença</span>
                                ) : (
                                  <span>Folga</span>
                                )}
                              </td>
                            );
                          })}
                          <td className="py-1 px-1.5 text-center border border-slate-300 font-mono">
                            <div className="font-bold">{formatHoursDecimal(weekHours)}</div>
                            {isFirst && mSum && emp.contractType !== 'LICENCA_MATERNIDADE' && (
                              <div className="text-[8px] text-slate-500">
                                Mês: {formatHoursDecimal(mSum.totalMonthlyHours)}/{formatHoursDecimal(mSum.monthlyTargetHours)}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    });
                  })}
                </tbody>
              </table>

              <div className="pt-3 border-t border-slate-200 text-[10px] text-slate-600 leading-relaxed">
                <strong>Conformidade Legal (Art. 59 §2º / Art. 66 / Art. 71 CLT &amp; EC 141/2026):</strong>{' '}
                Todas as jornadas respeitam o limite diário de até 8h24, descanso interjornada mínimo de 11h, intervalo intrajornada de 1h00 nos dias úteis, expediente de sábado de{' '}
                {isCenB ? '08:00 às 14:00 (6h00 corridas dentro do teto de Art. 71 CLT)' : '08:00 às 13:00 (5h00 corridas)'}, e regime de Estágio Lei nº 11.788/2008 integralmente preservado.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
