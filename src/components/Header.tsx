import React from 'react';
import {
  Calendar,
  Scale,
  Clock,
  Printer,
  Download,
  Upload,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  RotateCcw,
  Shield,
  HelpCircle,
} from 'lucide-react';
import { LegalPhase } from '../types/schedule';
import { LEGAL_PHASES } from '../utils/compliance';

interface HeaderProps {
  currentPhase: LegalPhase;
  onPhaseChange: (phase: LegalPhase) => void;
  activeWeekIndex: number;
  onSelectWeek: (w: number) => void;
  complianceSummary: {
    totalEmployees: number;
    compliantCount: number;
    violationCount: number;
    warningCount: number;     // horas extras
    shortfallCount: number;   // horas faltantes (devendo)
  };
  onAutoBalanceAll: () => void;
  onOpenPrintModal: () => void;
  onExportJson: () => void;
  onImportJson: () => void;
  onResetDefaults: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentPhase,
  onPhaseChange,
  activeWeekIndex,
  onSelectWeek,
  complianceSummary,
  onAutoBalanceAll,
  onOpenPrintModal,
  onExportJson,
  onImportJson,
  onResetDefaults,
}) => {
  const phaseConfig = LEGAL_PHASES[currentPhase];

  return (
    <header className="bg-white border-b border-slate-200 text-slate-900 sticky top-0 z-40 shadow-xs">
      {/* Top Banner: Marco Legal EC 141/2026 */}
      <div className="bg-slate-900 text-slate-200 px-4 py-1.5 text-xs flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-bold border border-blue-500/30">
            <Scale className="w-3.5 h-3.5" />
            Marco Legal EC 141/2026 &bull; Escala 5x2
          </span>
          <span className="hidden sm:inline text-slate-500">|</span>
          <span className="hidden md:inline text-slate-300">
            Fase 1 (42h em dez/26) &bull; Fase 2 (40h em dez/27) &bull; CLT Art. 59 (Máx 2h extras/dia)
          </span>
        </div>

        {/* Resumo Rápido de Status */}
        <div className="flex items-center gap-3">
          {complianceSummary.shortfallCount > 0 && (
            <span className="inline-flex items-center gap-1 text-amber-300 font-semibold">
              <Clock className="w-3.5 h-3.5" />
              {complianceSummary.shortfallCount} com horas faltantes
            </span>
          )}

          {complianceSummary.violationCount === 0 ? (
            <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {complianceSummary.compliantCount}/{complianceSummary.totalEmployees} Conformes
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-rose-400 font-semibold animate-pulse">
              <AlertTriangle className="w-3.5 h-3.5" />
              {complianceSummary.violationCount} Violações de Limite
            </span>
          )}
        </div>
      </div>

      {/* Main Bar: Tela Única — Escala Atual */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-md shadow-blue-600/20 text-white font-extrabold text-base font-mono">
            SC
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black tracking-tight text-slate-900">
                Seu Carro PE
              </h1>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-900 font-bold border border-blue-200">
                Quadro de Escala Atual
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Gestão direta por colaborador e grupos &bull; Matriz 546 &bull; Filial 777
            </p>
          </div>
        </div>

        {/* Controles da Tela Única */}
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          {/* Seletor de Fase Legal */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
            <span className="text-slate-500 px-2 font-medium">Teto Legal:</span>
            <button
              onClick={() => onPhaseChange('FASE_1')}
              className={`px-3 py-1.5 rounded-lg transition ${
                currentPhase === 'FASE_1'
                  ? 'bg-blue-600 text-white font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Fase 1 da EC 141/2026: Teto de 42h semanais e divisor salarial 210"
            >
              Fase 1 (42h)
            </button>
            <button
              onClick={() => onPhaseChange('FASE_2')}
              className={`px-3 py-1.5 rounded-lg transition ${
                currentPhase === 'FASE_2'
                  ? 'bg-purple-600 text-white font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Fase 2 definitiva: Teto de 40h semanais e divisor salarial 200"
            >
              Fase 2 (40h)
            </button>
            <button
              onClick={() => onPhaseChange('ATUAL')}
              className={`px-3 py-1.5 rounded-lg transition ${
                currentPhase === 'ATUAL'
                  ? 'bg-slate-700 text-white font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Regime tradicional anterior: até 44h semanais"
            >
              Cenário 44h
            </button>
          </div>

          {/* Seletor de Semana (Ciclo Mensal) */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
            <span className="text-slate-500 pl-2 pr-1 font-medium">Semana:</span>
            {[1, 2, 3, 4].map((w) => (
              <button
                key={w}
                onClick={() => onSelectWeek(w)}
                className={`px-2.5 py-1 rounded-lg font-bold transition ${
                  activeWeekIndex === w
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title={`Visualizar / definir horários da Semana ${w} do mês`}
              >
                S{w}
              </button>
            ))}
          </div>

          {/* Botão de Equilíbrio Geral de Horas Faltantes */}
          {complianceSummary.shortfallCount > 0 && (
            <button
              onClick={onAutoBalanceAll}
              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
              title="Compensa as horas faltantes de quem folgou no sábado distribuindo nos dias úteis"
            >
              <Sparkles className="w-3.5 h-3.5 text-white" />
              <span>Equilibrar Horas Faltantes ({complianceSummary.shortfallCount})</span>
            </button>
          )}

          {/* Ações Rápidas: Imprimir e Backup */}
          <div className="flex items-center gap-1.5 ml-auto">
            <button
              onClick={onOpenPrintModal}
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 text-xs font-bold flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
              title="Imprimir / Salvar PDF do Quadro Oficial (Art. 74 CLT)"
            >
              <Printer className="w-4 h-4 text-blue-600" />
              <span>Imprimir Quadro</span>
            </button>

            <button
              onClick={onExportJson}
              className="p-2 rounded-xl bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 transition cursor-pointer"
              title="Exportar Backup da Escala (JSON)"
            >
              <Download className="w-4 h-4" />
            </button>

            <button
              onClick={onImportJson}
              className="p-2 rounded-xl bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 transition cursor-pointer"
              title="Importar Backup da Escala (JSON)"
            >
              <Upload className="w-4 h-4" />
            </button>

            <button
              onClick={onResetDefaults}
              className="p-2 rounded-xl bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 transition cursor-pointer"
              title="Restaurar escala padrão da Seu Carro PE"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
