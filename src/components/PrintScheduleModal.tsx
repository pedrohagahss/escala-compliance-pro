import React, { useState } from 'react';
import {
  Employee,
  EmployeeComplianceResult,
  EmployeeMonthlySummary,
  EmployeePontoMaisSummary,
  LegalPhase,
  PontoMaisStandardConfig,
} from '../types/schedule';
import { DAYS_OF_WEEK, LEGAL_PHASES, ensureEmployeeWeeksSchedule, formatHoursDecimal } from '../utils/compliance';
import { calculatePontoMaisWeeklyHours } from '../utils/pontoMais';
import { Printer, X } from 'lucide-react';

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
}) => {
  const [printWeek, setPrintWeek] = useState<'ALL' | number>(
    selectedWeekFilter === 'ALL' ? 'ALL' : activeWeekIndex
  );

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-5xl w-full border border-slate-200 shadow-2xl overflow-hidden my-6">
        {/* Modal Top Bar (Hidden on print) */}
        <div className="no-print flex flex-wrap items-center justify-between gap-2 px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-blue-600" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Visualização do Quadro de Escala Oficial (Art. 74 CLT &amp; EC 141/2026)
              </h3>
              <p className="text-xs text-slate-500">
                Layout diagramado para impressão em papel A4 ou salvamento em PDF para fiscalização trabalhista
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 bg-slate-200/70 p-1 rounded-lg text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setPrintWeek('ALL')}
                className={`px-2 py-1 rounded transition cursor-pointer ${
                  printWeek === 'ALL' ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-white'
                }`}
              >
                Todas (S1–S4)
              </button>
              {[1, 2, 3, 4].map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setPrintWeek(w)}
                  className={`px-2 py-1 rounded transition cursor-pointer ${
                    printWeek === w ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-white'
                  }`}
                >
                  S{w}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow cursor-pointer transition"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir / Salvar PDF</span>
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

        {/* Printable Document Area */}
        <div className="p-8 bg-white text-slate-900 space-y-6 max-h-[80vh] overflow-y-auto print:max-h-none print:overflow-visible print:p-0">
          {/* Official Document Header */}
          <div className="border-b-2 border-slate-800 pb-4 text-center">
            <div className="text-xs uppercase font-mono tracking-widest text-slate-600">
              REPÚBLICA FEDERATIVA DO BRASIL &bull; MINISTÉRIO DO TRABALHO E EMPREGO
            </div>
            <h1 className="text-lg font-black tracking-tight text-slate-900 uppercase mt-1">
              Quadro de Horário de Trabalho e Escala de Revezamento 5x2
            </h1>
            <p className="text-xs text-slate-600 mt-0.5">
              Conforme exigido pelo Artigo 74, § 2º da CLT e adequado aos termos da Emenda Constitucional nº 141/2026 (STF ADIs 8041/8042).
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs mt-3 pt-3 border-t border-slate-200 text-left">
              <div>
                <span className="font-bold text-slate-700 block">Razão Social / Nome Fantasia:</span>
                <span className="font-semibold text-slate-900">Seu Carro PE Veículos Ltda</span>
              </div>
              <div>
                <span className="font-bold text-slate-700 block">Unidades Operacionais:</span>
                <span>Matriz 546 &bull; Filial 777</span>
              </div>
              <div>
                <span className="font-bold text-slate-700 block">Regime / PontoMais Fechado:</span>
                <span className="font-semibold text-blue-900">
                  {phaseConfig.shortName}
                  {pontoMaisConfig &&
                    ` • PM ${formatHoursDecimal(calculatePontoMaisWeeklyHours(pontoMaisConfig))}/sem`}
                </span>
              </div>
              <div>
                <span className="font-bold text-slate-700 block">Ciclo / Emissão:</span>
                <span>
                  {printWeek === 'ALL' ? 'Ciclo Mensal (S1–S4)' : `Semana ${printWeek} de 4`} &bull;{' '}
                  {todayStr}
                </span>
              </div>
            </div>
          </div>

          {/* Schedule Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse border border-slate-300 text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300 text-[10px] uppercase">
                  <th className="py-2 px-2 border border-slate-300">Colaborador / Cargo / Cadeira</th>
                  <th className="py-2 px-1 text-center border border-slate-300">Sem.</th>
                  <th className="py-2 px-1 text-center border border-slate-300">Seg</th>
                  <th className="py-2 px-1 text-center border border-slate-300">Ter</th>
                  <th className="py-2 px-1 text-center border border-slate-300">Qua</th>
                  <th className="py-2 px-1 text-center border border-slate-300">Qui</th>
                  <th className="py-2 px-1 text-center border border-slate-300">Sex</th>
                  <th className="py-2 px-1 text-center border border-slate-300 bg-slate-200/50">Sáb</th>
                  <th className="py-2 px-1 text-center border border-slate-300 bg-slate-200/50">Dom</th>
                  <th className="py-2 px-2 text-center border border-slate-300">Sem. / Mês</th>
                  <th className="py-2 px-2 text-center border border-slate-300">Status</th>
                </tr>
              </thead>
              <tbody>
                {preparedEmployees.map((emp) => {
                  const mSum = monthlySummaryMap?.[emp.id];
                  const fallbackComp = complianceMap[emp.id];

                  return weeksToPrint.map((wNum, wIdx) => {
                    const weekSched = emp.weeksSchedule?.[wNum] || emp.schedule;
                    const weekHours = mSum?.weeklyHours[wNum - 1] ?? fallbackComp?.totalWeeklyHours ?? 0;
                    const weekComp = mSum?.complianceByWeek[wNum - 1] || fallbackComp;
                    const isFirst = wIdx === 0;

                    return (
                      <tr key={`${emp.id}-p-${wNum}`} className="border-b border-slate-200">
                        {isFirst && (
                          <td
                            rowSpan={weeksToPrint.length}
                            className="py-2 px-2 border border-slate-300 font-medium align-top"
                          >
                            <div className="font-bold text-slate-900">{emp.name}</div>
                            <div className="text-[10px] text-slate-600">
                              {emp.role} &bull; {emp.department} (
                              {emp.defaultStore === 'LOJA_1' ? 'Matriz' : 'Filial'})
                            </div>
                          </td>
                        )}

                        <td className="py-1.5 px-1 text-center border border-slate-300 font-mono font-bold text-[10px]">
                          S{wNum}
                        </td>

                        {DAYS_OF_WEEK.map((d) => {
                          const shift = weekSched[d.key];
                          return (
                            <td
                              key={d.key}
                              className={`py-1.5 px-1 text-center border border-slate-300 font-mono text-[10px] ${
                                d.isWeekend ? 'bg-slate-50' : ''
                              }`}
                            >
                              {shift?.type === 'TRABALHO' ? (
                                <span className="font-bold">
                                  {shift.startTime}-{shift.endTime}
                                </span>
                              ) : shift?.type === 'FOLGA_5X2' ? (
                                <span className="font-bold text-slate-700">Folga 5x2</span>
                              ) : shift?.type === 'FOLGA_DSR' ? (
                                <span className="font-bold text-slate-700">DSR</span>
                              ) : shift?.type === 'LICENCA' ? (
                                <span className="font-bold text-pink-700">Licença</span>
                              ) : (
                                <span>Folga</span>
                              )}
                            </td>
                          );
                        })}

                        <td className="py-1.5 px-2 text-center border border-slate-300 font-mono font-bold text-[10px]">
                          <div>{formatHoursDecimal(weekHours)}</div>
                          {mSum && isFirst && emp.contractType !== 'LICENCA_MATERNIDADE' && (
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
                      </tr>
                    );
                  });
                })}
              </tbody>
            </table>
          </div>

          {/* Legal Notes & Signatures */}
          <div className="space-y-4 pt-4 border-t border-slate-200 text-xs text-slate-600">
            <p className="leading-relaxed">
              <strong>Declaração de Conformidade Trabalhista:</strong> Certificamos que a presente escala de horários respeita o intervalo legal interjornada de 11 (onze) horas consecutivas entre duas jornadas diárias (Art. 66 CLT), o intervalo intrajornada para repouso e alimentação de segunda a sexta-feira (Art. 71 CLT), o expediente corrido de sábado até 5h (08:00 às 13:00), o regime de compensação/horas extras (Art. 59 CLT), a Lei nº 11.788/2008 para estagiários, e o teto da Emenda Constitucional nº 141/2026 com escala 5x2 e rodízio mensal de folgas aos sábados.
            </p>

            <div className="grid grid-cols-2 gap-8 pt-8">
              <div className="text-center border-t border-slate-400 pt-2">
                <span className="block font-bold text-slate-800">Diretoria / Gestão de Recursos Humanos</span>
                <span className="text-[10px] text-slate-500">Seu Carro PE &bull; Representante Legal</span>
              </div>
              <div className="text-center border-t border-slate-400 pt-2">
                <span className="block font-bold text-slate-800">Comissão de Empregados</span>
                <span className="text-[10px] text-slate-500">Ciência e Acompanhamento da Escala 5x2</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
