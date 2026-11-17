import React from 'react';
import { Employee, LegalPhase } from '../types/schedule';
import {
  calculateEmployeeMonthlySummary,
  distributeMonthlySaturdayOff,
  setEmployeeMonthlySaturdayOff,
  formatHoursDecimal,
  LEGAL_PHASES,
} from '../utils/compliance';
import {
  Calendar,
  CheckCircle2,
  Clock,
  Sparkles,
  Users,
  ShieldCheck,
  TrendingUp,
  Info,
  Layers,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';

interface MonthlyPlannerViewProps {
  employees: Employee[];
  currentPhase: LegalPhase;
  activeWeekIndex: number;
  onSelectWeek: (week: number) => void;
  onUpdateEmployee: (updatedEmployee: Employee) => void;
  onBatchUpdateEmployees: (updatedEmployees: Employee[]) => void;
}

export const MonthlyPlannerView: React.FC<MonthlyPlannerViewProps> = ({
  employees,
  currentPhase,
  activeWeekIndex,
  onSelectWeek,
  onUpdateEmployee,
  onBatchUpdateEmployees,
}) => {
  const phaseConfig = LEGAL_PHASES[currentPhase];

  // Colaboradores que participam da operação de sábado
  const saturdayEligible = employees.filter(
    (e) =>
      e.contractType !== 'LICENCA_MATERNIDADE' &&
      e.contractType !== 'ESTAGIARIO' &&
      !e.isCirculating
  );

  // Calcula resumos mensais
  const monthlySummaries = employees.map((emp) =>
    calculateEmployeeMonthlySummary(emp, currentPhase)
  );

  // Contagem de pessoas ativas em cada sábado do mês
  const satCoverage = [1, 2, 3, 4].map((weekNum) => {
    let sellers = 0;
    let sdrs = 0;
    let prep = 0;
    let doc = 0;

    employees.forEach((emp) => {
      if (emp.contractType === 'LICENCA_MATERNIDADE' || emp.isCirculating) return;

      // Se for estagiário, trabalha sábados 08:40 às 12:40
      if (emp.contractType === 'ESTAGIARIO') {
        doc++;
        return;
      }

      const isOffThisSat = (emp.saturdayOffWeek || 1) === weekNum;
      if (!isOffThisSat) {
        if (emp.department === 'VENDAS') sellers++;
        if (emp.department === 'SDR') sdrs++;
        if (emp.department === 'PREPARACAO') prep++;
        if (emp.department === 'DOCUMENTACAO') doc++;
      }
    });

    return {
      weekNum,
      total: sellers + sdrs + prep + doc,
      sellers,
      sdrs,
      prep,
      doc,
    };
  });

  // Handler para trocar o sábado de folga de um colaborador e sincronizar as 4 semanas
  const handleSetSaturdayOff = (emp: Employee, newWeek: number) => {
    const updated = setEmployeeMonthlySaturdayOff(emp, newWeek);
    onUpdateEmployee(updated);
  };

  // Handler para redistribuir automaticamente 1 sábado de folga por mês
  const handleAutoDistribute = () => {
    const distributed = distributeMonthlySaturdayOff(employees, currentPhase);
    onBatchUpdateEmployees(distributed);
  };

  return (
    <div className="space-y-6">
      {/* Banner Explicativo de Horas Extras e Visão Mensal */}
      <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-white border border-blue-200 rounded-2xl p-5 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-xs">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">
                Planejamento Mensal & Rodízio de 1 Sábado de Folga por Mês
              </h2>
              <p className="text-xs text-slate-600">
                Equilíbrio da jornada em ciclo de 4 semanas com banco de horas e horas extras compensadas
              </p>
            </div>
          </div>

          <button
            onClick={handleAutoDistribute}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-2 shadow-xs transition"
          >
            <Sparkles className="w-4 h-4" />
            <span>Balancear Rodízio (1 Sábado Folga/Mês)</span>
          </button>
        </div>

        {/* Quadro Informativo CLT Art. 59 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs pt-2 border-t border-blue-200/60">
          <div className="bg-white/80 p-3 rounded-xl border border-blue-200/80">
            <span className="font-bold text-slate-900 block mb-1 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-blue-600" />
              Jornada Padrão e Horas Extras:
            </span>
            <p className="text-slate-600 leading-relaxed text-[11px]">
              O limite legal padrão diário é de <strong>8h00</strong>. Horas além de 8h (até o teto de 10h diárias, Art. 59 CLT) são horas suplementares remuneradas com <strong>adicional mínimo de 50%</strong> ou compensadas via <strong>Banco de Horas formal</strong>.
            </p>
          </div>

          <div className="bg-white/80 p-3 rounded-xl border border-blue-200/80">
            <span className="font-bold text-slate-900 block mb-1 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Compensação Mensal (1 Sáb Folga):
            </span>
            <p className="text-slate-600 leading-relaxed text-[11px]">
              Quem trabalha 3 sábados (37h com folga útil) e folga 1 sábado no mês (40h úteis) atinge média semanal de <strong>37h45</strong>, ficando <strong>100% abaixo do teto de 40h de 2027</strong> e eliminando passivo trabalhista!
            </p>
          </div>

          <div className="bg-white/80 p-3 rounded-xl border border-blue-200/80">
            <span className="font-bold text-slate-900 block mb-1 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-indigo-600" />
              Divisor Salarial Mensal:
            </span>
            <p className="text-slate-600 leading-relaxed text-[11px]">
              Com a EC 141/2026, o divisor salarial é de <strong>{phaseConfig.divisor}</strong> na {phaseConfig.shortName}. O valor da hora de trabalho aumenta sem redução do salário nominal do colaborador.
            </p>
          </div>
        </div>
      </div>

      {/* Seletor da Semana Ativa para Visualização / Edição */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-xs text-xs">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-700">Visualizar Semana Específica:</span>
          <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 font-semibold">
            {[1, 2, 3, 4].map((w) => (
              <button
                key={w}
                onClick={() => onSelectWeek(w)}
                className={`px-3 py-1.5 rounded-md transition ${
                  activeWeekIndex === w
                    ? 'bg-blue-600 text-white shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Semana {w}
              </button>
            ))}
          </div>
        </div>

        <span className="text-slate-500 text-[11px]">
          Alternando a semana, o tabuleiro visual adapta os sábados trabalhados e folgas úteis.
        </span>
      </div>

      {/* Cartões de Cobertura nos 4 Sábados do Mês */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        {satCoverage.map((sc) => (
          <div
            key={sc.weekNum}
            className={`border rounded-xl p-4 space-y-2 transition shadow-xs ${
              activeWeekIndex === sc.weekNum
                ? 'bg-blue-50/60 border-blue-400 ring-2 ring-blue-500/20'
                : 'bg-white border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900">
                Sábado — Semana {sc.weekNum}
              </span>
              <span className="font-mono text-[10px] px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 font-bold">
                08h às 13h
              </span>
            </div>

            <div className="text-xl font-black text-slate-900 font-mono">
              {sc.total} <span className="text-xs font-normal text-slate-500">ativos em loja</span>
            </div>

            <div className="text-[11px] text-slate-600 space-y-0.5 pt-1 border-t border-slate-100">
              <div className="flex justify-between">
                <span>Vendedores ativos:</span>
                <strong className="text-slate-900">{sc.sellers} mesas</strong>
              </div>
              <div className="flex justify-between">
                <span>SDRs ativos:</span>
                <strong className="text-slate-900">{sc.sdrs} baias</strong>
              </div>
              <div className="flex justify-between">
                <span>Preparação/Zeladoria:</span>
                <strong className="text-slate-900">{sc.prep} postos</strong>
              </div>
              <div className="flex justify-between">
                <span>Documentação:</span>
                <strong className="text-slate-900">{sc.doc} postos</strong>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabela de Matriz Mensal de Sábados */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Matriz do Rodízio Mensal de Sábados da Equipe
            </h3>
            <p className="text-xs text-slate-500">
              Defina individualmente em qual sábado do mês cada colaborador usufrui da sua folga mensal
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[880px]">
            <thead>
              <tr className="bg-white border-b border-slate-200 text-slate-600 font-semibold uppercase text-[11px]">
                <th className="py-3 px-4 w-60">Colaborador / Cargo</th>
                <th className="py-3 px-3 text-center w-28">1º Sábado</th>
                <th className="py-3 px-3 text-center w-28">2º Sábado</th>
                <th className="py-3 px-3 text-center w-28">3º Sábado</th>
                <th className="py-3 px-3 text-center w-28">4º Sábado</th>
                <th className="py-3 px-3 text-center w-36">Sábado de Folga</th>
                <th className="py-3 px-4 text-center w-36">Média Semanal & HE</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {saturdayEligible.map((emp) => {
                const summary = monthlySummaries.find((s) => s.employeeId === emp.id);
                const satOff = emp.saturdayOffWeek || 1;

                return (
                  <tr key={emp.id} className="hover:bg-slate-50 transition">
                    {/* Nome & Cargo */}
                    <td className="py-3 px-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900">{emp.name}</span>
                        <span className="text-[11px] text-slate-500">
                          {emp.role} &bull; {emp.defaultStore === 'LOJA_1' ? 'Matriz' : 'Filial'}
                        </span>
                      </div>
                    </td>

                    {/* Semanas 1, 2, 3, 4 com Horas Calculadas e Status do Sábado */}
                    {[1, 2, 3, 4].map((weekNum) => {
                      const isOff = satOff === weekNum;
                      const weekH = summary?.weeklyHours[weekNum - 1] || 0;
                      return (
                        <td key={weekNum} className="py-2 px-2 text-center">
                          <div
                            className={`p-1.5 rounded-xl border transition ${
                              activeWeekIndex === weekNum
                                ? 'bg-blue-50/70 border-blue-400 ring-2 ring-blue-500/20'
                                : 'bg-slate-50/50 border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1 px-1">
                              <span className="font-mono font-bold text-slate-900 text-[11px]">
                                {formatHoursDecimal(weekH)}
                              </span>
                              <button
                                onClick={() => onSelectWeek(weekNum)}
                                className="text-[9px] text-blue-600 hover:text-blue-800 font-bold hover:underline cursor-pointer"
                                title={`Abrir escala detalhada da Semana ${weekNum}`}
                              >
                                S{weekNum} &rarr;
                              </button>
                            </div>

                            <button
                              onClick={() => handleSetSaturdayOff(emp, weekNum)}
                              className={`w-full py-1 px-1.5 rounded-lg text-center font-bold text-[10px] transition shadow-2xs border cursor-pointer ${
                                isOff
                                  ? 'bg-emerald-100 border-emerald-300 text-emerald-900 hover:bg-emerald-200'
                                  : 'bg-blue-50 border-blue-200 text-blue-900 hover:bg-blue-100'
                              }`}
                              title={`Clique para definir o ${weekNum}º Sábado como o de folga deste colaborador`}
                            >
                              {isOff ? 'Folga Mensal' : '08h–13h (5h)'}
                            </button>
                          </div>
                        </td>
                      );
                    })}

                    {/* Seletor Rápido do Sábado de Folga */}
                    <td className="py-2.5 px-3 text-center">
                      <select
                        value={satOff}
                        onChange={(e) => handleSetSaturdayOff(emp, parseInt(e.target.value, 10))}
                        className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-slate-800 font-semibold text-xs focus:outline-none focus:border-blue-500 shadow-2xs"
                      >
                        <option value={1}>1º Sábado</option>
                        <option value={2}>2º Sábado</option>
                        <option value={3}>3º Sábado</option>
                        <option value={4}>4º Sábado</option>
                      </select>
                    </td>

                    {/* Resumo Mensal & Horas Extras */}
                    <td className="py-3 px-4 text-center">
                      <div className="flex flex-col items-center">
                        <span className="font-mono font-black text-slate-900 text-xs">
                          {formatHoursDecimal(summary?.averageWeeklyHours || 0)} / sem
                        </span>
                        <span className="text-[10px] text-slate-500 mt-0.5">
                          {summary?.totalOvertimeHours && summary.totalOvertimeHours > 0 ? (
                            <span className="text-amber-700 font-bold">
                              +{formatHoursDecimal(summary.totalOvertimeHours)} HE (50%)
                            </span>
                          ) : (
                            <span className="text-emerald-700 font-medium">Sem HE acumulada</span>
                          )}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
