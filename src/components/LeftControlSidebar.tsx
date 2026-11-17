import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  FileText,
  Filter,
  Layers,
  MessageSquare,
  Printer,
  RotateCcw,
  Scale,
  Search,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Upload,
  UserPlus,
  Users,
  X,
  Zap,
} from 'lucide-react';
import {
  DayOfWeek,
  DepartmentId,
  LegalPhase,
  PontoMaisDayRule,
  PontoMaisStandardConfig,
  StoreId,
} from '../types/schedule';
import { DEPARTMENTS } from '../data/seuCarroData';
import { DAYS_OF_WEEK, formatHoursDecimal, LEGAL_PHASES } from '../utils/compliance';
import {
  calculatePontoMaisDayHours,
  PONTOMAIS_PRESET_CONFIGS,
  validatePontoMaisStandardCap,
} from '../utils/pontoMais';

interface LeftControlSidebarProps {
  currentPhase: LegalPhase;
  onPhaseChange: (phase: LegalPhase) => void;
  selectedWeekFilter: 'ALL' | number;
  onSelectWeekFilter: (w: 'ALL' | number) => void;
  selectedStore: 'ALL' | StoreId;
  onSelectStore: (store: 'ALL' | StoreId) => void;
  selectedDept: 'ALL' | DepartmentId;
  onSelectDept: (dept: 'ALL' | DepartmentId) => void;
  selectedEmployeeFilter: 'ALL' | string;
  onSelectEmployeeFilter: (empId: 'ALL' | string) => void;
  employeeOptions: { id: string; label: string }[];
  selectedDayFilter: 'ALL' | DayOfWeek;
  onSelectDayFilter: (day: 'ALL' | DayOfWeek) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  complianceSummary: {
    totalEmployees: number;
    compliantCount: number;
    violationCount: number;
    overtimeCount: number;
    shortfallCount: number;
    monthlyClosedCount: number;
    monthlyShortfallCount: number;
    monthlyOvertimeCount: number;
    saturdayActiveCount: number;
    uncoveredCriticalCount: number;
    uncoveredAlertCount: number;
  };
  onAutoBalanceWeek: () => void;
  onBalanceWeekForMonth: () => void;
  onBalanceAllWeeksForMonth: () => void;
  onAutoCoverWeeks: () => void;
  pontoMaisConfig: PontoMaisStandardConfig;
  pontoMaisWeeklyHours: number;
  onUpdatePontoMaisConfig: (config: PontoMaisStandardConfig) => void;
  onOpenPrintModal: () => void;
  onExportJson: () => void;
  onImportJson: () => void;
  onResetDefaults: () => void;
  onOpenAddMember: () => void;
  onOpenManageMembers: () => void;
  onOpenAiChat: () => void;
}

export const LeftControlSidebar: React.FC<LeftControlSidebarProps> = ({
  currentPhase,
  onPhaseChange,
  selectedWeekFilter,
  onSelectWeekFilter,
  selectedStore,
  onSelectStore,
  selectedDept,
  onSelectDept,
  selectedEmployeeFilter,
  onSelectEmployeeFilter,
  employeeOptions,
  selectedDayFilter,
  onSelectDayFilter,
  searchQuery,
  onSearchChange,
  complianceSummary,
  onAutoBalanceWeek,
  onBalanceWeekForMonth,
  onBalanceAllWeeksForMonth,
  onAutoCoverWeeks,
  pontoMaisConfig,
  pontoMaisWeeklyHours,
  onUpdatePontoMaisConfig,
  onOpenPrintModal,
  onExportJson,
  onImportJson,
  onResetDefaults,
  onOpenAddMember,
  onOpenManageMembers,
  onOpenAiChat,
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState(pontoMaisConfig.note || '');
  const [showPontoMaisTimes, setShowPontoMaisTimes] = useState(false);
  const [pmDraft, setPmDraft] = useState<PontoMaisStandardConfig>(pontoMaisConfig);

  useEffect(() => {
    setNoteDraft(pontoMaisConfig.note || '');
    setPmDraft(pontoMaisConfig);
  }, [pontoMaisConfig]);

  const phaseConfig = LEGAL_PHASES[currentPhase];
  const monthlyTargetHours = phaseConfig.maxWeeklyHours * 4;
  const totalUncovered =
    complianceSummary.uncoveredCriticalCount + complianceSummary.uncoveredAlertCount;

  const hasActiveFilters =
    selectedStore !== 'ALL' ||
    selectedDept !== 'ALL' ||
    selectedEmployeeFilter !== 'ALL' ||
    selectedDayFilter !== 'ALL' ||
    searchQuery.trim().length > 0;

  return (
    <aside
      aria-label="Controladores da Escala"
      className="no-print w-full lg:w-[310px] xl:w-[325px] lg:shrink-0 lg:sticky lg:top-0 lg:h-screen bg-white border-b lg:border-b-0 lg:border-r border-slate-200 z-30 flex flex-col shadow-xs"
    >
      {/* Cabeçalho Fixo da Barra Lateral + Botão Mobile */}
      <div className="px-4 py-3.5 border-b border-slate-200 bg-slate-900 text-white flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-none bg-blue-600 flex items-center justify-center font-extrabold text-sm font-mono shrink-0">
            SC
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="text-sm font-black tracking-tight truncate">Seu Carro PE</h1>
              <span className="text-xs text-blue-300 font-bold shrink-0">
                5x2
              </span>
            </div>
            <p className="text-xs text-slate-300 truncate">
              EC 141/2026 &bull; Matriz 546 &amp; Filial 777
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen((prev) => !prev)}
          aria-expanded={mobileOpen}
          className="lg:hidden inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xs bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white border border-slate-700 transition cursor-pointer shrink-0"
        >
          <SlidersHorizontal className="w-3.5 h-3.5 text-blue-400" />
          <span>{mobileOpen ? 'Ocultar' : 'Controles'}</span>
          {mobileOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Resumo Rápido Mobile quando recolhido */}
      {!mobileOpen && (
        <div className="lg:hidden px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-blue-800">
              {phaseConfig.badge.split(' ')[0]} {phaseConfig.maxWeeklyHours}h
            </span>
            <span className="text-slate-400">&bull;</span>
            <span className="font-bold text-slate-800">
              {selectedWeekFilter === 'ALL'
                ? `Todas S1–S4 (${monthlyTargetHours}h)`
                : `Semana ${selectedWeekFilter} (${monthlyTargetHours}h)`}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {complianceSummary.violationCount > 0 ? (
              <span className="font-bold text-rose-700">
                {complianceSummary.violationCount} viol.
              </span>
            ) : (
              <span className="font-bold text-emerald-700">
                {complianceSummary.compliantCount}/{complianceSummary.totalEmployees} OK
              </span>
            )}
          </div>
        </div>
      )}

      {/* Conteúdo Rolável da Sidebar Fixa */}
      <div
        className={`${
          mobileOpen ? 'flex' : 'hidden'
        } lg:flex flex-col flex-1 overflow-y-auto p-4 space-y-4 text-xs`}
      >
        {/* 0. Equipe & Assistente IA */}
        <section className="space-y-2 pb-3 border-b border-slate-200">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500">
            <span className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-indigo-600" />
              Equipe & Assistente IA
            </span>
            <span className="text-[10px] font-mono text-slate-400">
              {complianceSummary.totalEmployees} ativos
            </span>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              data-sidebar-add-member="true"
              onClick={onOpenAddMember}
              className="px-2.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center justify-center gap-1 shadow-2xs transition-colors"
            >
              <UserPlus className="w-3.5 h-3.5 shrink-0" />
              <span>Incluir Membro</span>
            </button>
            <button
              type="button"
              data-sidebar-manage-members="true"
              onClick={onOpenManageMembers}
              className="px-2.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 font-bold flex items-center justify-center gap-1 transition-colors"
            >
              <Users className="w-3.5 h-3.5 shrink-0 text-slate-600" />
              <span>Editar / Excluir</span>
            </button>
          </div>

          <button
            type="button"
            data-sidebar-open-ai-chat="true"
            onClick={onOpenAiChat}
            className="w-full px-3 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all"
          >
            <MessageSquare className="w-3.5 h-3.5 shrink-0" />
            <span>Chat com IA sobre Escala</span>
            <Sparkles className="w-3 h-3 text-amber-300 shrink-0" />
          </button>
        </section>

        {/* 1. Seletor de Fase Legal */}
        <section className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Scale className="w-3.5 h-3.5 text-blue-600" />
              Teto Legal Vigente
            </span>
            <span className="text-[10px] font-mono text-slate-400">
              Div. {phaseConfig.divisor}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => onPhaseChange('FASE_1')}
              aria-pressed={currentPhase === 'FASE_1'}
              className={`py-1.5 px-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                currentPhase === 'FASE_1'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
              title="Fase 1 da EC 141/2026: Teto de 42h/sem (168h/mês)"
            >
              Fase 1 (42h)
            </button>
            <button
              type="button"
              onClick={() => onPhaseChange('FASE_2')}
              aria-pressed={currentPhase === 'FASE_2'}
              className={`py-1.5 px-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                currentPhase === 'FASE_2'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
              title="Fase 2 definitiva: Teto de 40h/sem (160h/mês)"
            >
              Fase 2 (40h)
            </button>
            <button
              type="button"
              onClick={() => onPhaseChange('ATUAL')}
              aria-pressed={currentPhase === 'ATUAL'}
              className={`py-1.5 px-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                currentPhase === 'ATUAL'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
              title="Regime tradicional CLT: 44h/sem (176h/mês)"
            >
              44h (6x1)
            </button>
          </div>
        </section>

        {/* 2. Visualização das Semanas & Cálculo Mensal Automático */}
        <section className="space-y-2 bg-slate-50 border border-slate-300 rounded-none p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              Semanas &amp; Acúmulo
            </span>
            <span className="text-xs font-mono font-bold text-blue-800 whitespace-nowrap shrink-0">
              Mês: {monthlyTargetHours}h00
            </span>
          </div>

          <button
            type="button"
            data-week-button="ALL"
            aria-pressed={selectedWeekFilter === 'ALL'}
            onClick={() => onSelectWeekFilter('ALL')}
            className={`w-full py-2 px-2.5 rounded-lg font-bold text-xs border transition cursor-pointer flex items-center justify-center gap-1.5 ${
              selectedWeekFilter === 'ALL'
                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
            title="Exibe as 4 semanas (S1 a S4) simultaneamente com acúmulo progressivo"
          >
            <Layers className="w-3.5 h-3.5 shrink-0" />
            <span>Todas as Semanas (S1–S4)</span>
          </button>

          <div className="grid grid-cols-4 gap-1.5">
            {[1, 2, 3, 4].map((w) => (
              <button
                key={w}
                type="button"
                data-week-button={w}
                aria-pressed={selectedWeekFilter === w}
                onClick={() => onSelectWeekFilter(w)}
                className={`py-1.5 rounded-lg font-bold text-[11px] border transition cursor-pointer ${
                  selectedWeekFilter === w
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
                title={`Filtrar quadro para focar apenas na Semana ${w}`}
              >
                Sem. {w}
              </button>
            ))}
          </div>

          <p className="text-[10px] text-slate-500 leading-snug">
            Cálculo mensal automático a cada clique. Folgas podem variar entre S1–S4 e horas sobrando/faltando acumulam para a semana seguinte.
          </p>

          {/* Resumo Automático do Mês + Botões de Equilíbrio */}
          <div className="pt-2 border-t border-slate-200 space-y-2">
            <div className="grid grid-cols-2 gap-1.5 text-[11px]">
              <div className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5">
                <span className="text-[10px] text-slate-500 block">
                  {selectedWeekFilter === 'ALL' ? 'Mês Fechado' : `Saldo Sem. ${selectedWeekFilter}`}
                </span>
                {selectedWeekFilter === 'ALL' ? (
                  <strong className="text-slate-900 font-mono">
                    {complianceSummary.monthlyClosedCount}/{Math.max(0, complianceSummary.totalEmployees - 1)} colab.
                  </strong>
                ) : complianceSummary.shortfallCount > 0 ? (
                  <strong className="text-amber-800 font-mono">
                    {complianceSummary.shortfallCount} devendo
                  </strong>
                ) : (
                  <strong className="text-emerald-700 font-mono">Equilibrada</strong>
                )}
              </div>

              <div className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5">
                <span className="text-[10px] text-slate-500 block">Saldo Mês (S1–S4)</span>
                {complianceSummary.monthlyShortfallCount > 0 ? (
                  <strong className="text-amber-800 font-mono">
                    {complianceSummary.monthlyShortfallCount} devendo
                  </strong>
                ) : complianceSummary.monthlyOvertimeCount > 0 ? (
                  <strong className="text-blue-700 font-mono">
                    {complianceSummary.monthlyOvertimeCount} c/ saldo +
                  </strong>
                ) : (
                  <strong className="text-emerald-700 font-mono">100% Fechado</strong>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              {selectedWeekFilter !== 'ALL' && complianceSummary.shortfallCount > 0 && (
                <button
                  type="button"
                  onClick={onAutoBalanceWeek}
                  className="w-full py-2 px-3 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-[11px] flex items-center justify-center gap-1.5 shadow-2xs transition cursor-pointer"
                  title={`Compensa apenas a Semana ${selectedWeekFilter} até ${phaseConfig.maxWeeklyHours}h00 sem mexer nas outras semanas`}
                >
                  <Sparkles className="w-3.5 h-3.5 shrink-0" />
                  <span>Equilibrar Só Semana {selectedWeekFilter}</span>
                </button>
              )}

              {selectedWeekFilter !== 'ALL' && (
                <button
                  type="button"
                  onClick={onBalanceWeekForMonth}
                  className="w-full py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] flex items-center justify-center gap-1.5 shadow-2xs transition cursor-pointer"
                  title={`Ajusta apenas a Semana ${selectedWeekFilter} para que S1+S2+S3+S4 feche ${monthlyTargetHours}h00 no mês`}
                >
                  <Layers className="w-3.5 h-3.5 shrink-0" />
                  <span>Ajustar Sem. {selectedWeekFilter} p/ Soma do Mês</span>
                </button>
              )}

              <button
                type="button"
                onClick={onBalanceAllWeeksForMonth}
                className={`w-full py-2 px-3 rounded-lg font-bold text-[11px] flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  selectedWeekFilter === 'ALL'
                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-2xs'
                    : 'bg-white hover:bg-slate-100 text-slate-800 border border-slate-200'
                }`}
                title={`Ajusta as 4 semanas em conjunto para somar exatamente ${monthlyTargetHours}h00 no mês, preservando as folgas de cada semana`}
              >
                <Scale className="w-3.5 h-3.5 shrink-0" />
                <span>Fechar Soma das 4 Semanas ({monthlyTargetHours}h)</span>
              </button>
            </div>
          </div>
        </section>

        {/* 3. Filtros do Tabuleiro */}
        <section className="space-y-2.5 border-t border-slate-200 pt-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-blue-600" />
              Filtros do Quadro
            </span>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => {
                  onSelectStore('ALL');
                  onSelectDept('ALL');
                  onSelectEmployeeFilter('ALL');
                  onSelectDayFilter('ALL');
                  onSearchChange('');
                }}
                className="text-[10px] font-bold text-blue-600 hover:underline cursor-pointer"
              >
                Limpar filtros
              </button>
            )}
          </div>

          {/* Filtro por Loja */}
          <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => onSelectStore('ALL')}
              aria-pressed={selectedStore === 'ALL'}
              className={`py-1.5 px-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                selectedStore === 'ALL'
                  ? 'bg-white text-blue-700 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Todas
            </button>
            <button
              type="button"
              onClick={() => onSelectStore('LOJA_1')}
              aria-pressed={selectedStore === 'LOJA_1'}
              className={`py-1.5 px-1 rounded-lg text-[11px] font-semibold transition flex items-center justify-center gap-1 cursor-pointer ${
                selectedStore === 'LOJA_1'
                  ? 'bg-white text-blue-700 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building2 className="w-3 h-3 text-blue-600 shrink-0" />
              <span>Matriz</span>
            </button>
            <button
              type="button"
              onClick={() => onSelectStore('LOJA_2')}
              aria-pressed={selectedStore === 'LOJA_2'}
              className={`py-1.5 px-1 rounded-lg text-[11px] font-semibold transition flex items-center justify-center gap-1 cursor-pointer ${
                selectedStore === 'LOJA_2'
                  ? 'bg-white text-blue-700 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building2 className="w-3 h-3 text-blue-600 shrink-0" />
              <span>Filial 777</span>
            </button>
          </div>

          {/* Filtro por Setor */}
          <div className="space-y-1">
            <label htmlFor="sidebar-dept-filter" className="text-[11px] font-semibold text-slate-600 block">
              Setor / Grupo:
            </label>
            <select
              id="sidebar-dept-filter"
              value={selectedDept}
              onChange={(e) => onSelectDept(e.target.value as 'ALL' | DepartmentId)}
              className="w-full bg-white text-slate-800 font-medium px-2.5 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-blue-500 text-xs shadow-2xs"
            >
              <option value="ALL">Todos os Setores</option>
              {DEPARTMENTS.slice(0, 7).map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro por Colaborador */}
          <div className="space-y-1">
            <label htmlFor="sidebar-employee-filter" className="text-[11px] font-semibold text-slate-600 block">
              Colaborador:
            </label>
            <select
              id="sidebar-employee-filter"
              value={selectedEmployeeFilter}
              onChange={(e) => onSelectEmployeeFilter(e.target.value)}
              className="w-full bg-white text-slate-800 font-medium px-2.5 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-blue-500 text-xs shadow-2xs"
            >
              <option value="ALL">Todos os Colaboradores</option>
              {employeeOptions.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.label}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro por Dia da Semana */}
          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-slate-600 block">
              Dia da semana:
            </span>
            <div className="grid grid-cols-4 gap-1">
              <button
                type="button"
                data-sidebar-day-filter="ALL"
                aria-pressed={selectedDayFilter === 'ALL'}
                onClick={() => onSelectDayFilter('ALL')}
                className={`py-1 px-1 rounded-lg font-bold text-[10.5px] border transition cursor-pointer ${
                  selectedDayFilter === 'ALL'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Todos
              </button>
              {DAYS_OF_WEEK.map((day) => (
                <button
                  key={day.key}
                  type="button"
                  data-sidebar-day-filter={day.key}
                  aria-pressed={selectedDayFilter === day.key}
                  onClick={() =>
                    onSelectDayFilter(selectedDayFilter === day.key ? 'ALL' : day.key)
                  }
                  className={`py-1 px-1 rounded-lg font-bold text-[10.5px] border transition cursor-pointer ${
                    selectedDayFilter === day.key
                      ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {day.shortLabel}
                </button>
              ))}
            </div>
          </div>

          {/* Busca por Colaborador */}
          <div className="space-y-1">
            <label htmlFor="sidebar-search-input" className="text-[11px] font-semibold text-slate-600 block">
              Buscar colaborador ou cadeira:
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="sidebar-search-input"
                type="text"
                placeholder="Ex: Winona, SDR-1..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-7 py-2 text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 text-xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => onSearchChange('')}
                  aria-label="Limpar busca"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </section>

        {/* 4. Status Operacional & Cobertura */}
        <section className="space-y-2 border-t border-slate-200 pt-3">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-blue-600" />
            {selectedWeekFilter === 'ALL'
              ? 'Status Geral (S1–S4)'
              : `Status da Semana ${selectedWeekFilter}`}
          </span>

          <div className="space-y-1.5 text-[11px]">
            <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-slate-600 flex items-center gap-1.5">
                {complianceSummary.violationCount === 0 ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                )}
                Conformidade 5x2
              </span>
              <strong
                className={`font-mono ${
                  complianceSummary.violationCount === 0 ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                {complianceSummary.compliantCount}/{complianceSummary.totalEmployees}
              </strong>
            </div>

            <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-slate-600 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-indigo-600" />
                {selectedWeekFilter === 'ALL' ? 'Média Sábados (S1–S4)' : 'Sábado (08h–13h)'}
              </span>
              <strong className="font-mono text-slate-900">
                {complianceSummary.saturdayActiveCount} ativos
              </strong>
            </div>

            <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-slate-600 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                Cobertura de Postos
              </span>
              {totalUncovered > 0 ? (
                <strong className="font-mono text-rose-700">{totalUncovered} alerta(s)</strong>
              ) : (
                <strong className="font-mono text-emerald-700">100% Coberto</strong>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onAutoCoverWeeks}
            className="w-full py-2 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] flex items-center justify-center gap-1.5 transition cursor-pointer"
            title="Designa liderança circulante para cobrir postos descobertos"
          >
            <Zap className="w-3.5 h-3.5 text-amber-300 shrink-0" />
            <span>
              {selectedWeekFilter === 'ALL'
                ? 'Auto-Cobrir Todas (S1–S4)'
                : `Auto-Cobrir Semana ${selectedWeekFilter}`}
            </span>
          </button>
        </section>

        {/* 4.5. Anotação PontoMais (Horário Padrão p/ Conformidade) */}
        <section
          data-sidebar-pontomais="true"
          className="space-y-2 border-t border-slate-200 pt-3"
        >
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              Anotação PontoMais
            </span>
            <span
              data-pontomais-cap-badge="true"
              className="text-xs font-mono font-bold text-emerald-800 whitespace-nowrap"
            >
              {formatHoursDecimal(pontoMaisWeeklyHours)}/sem
            </span>
          </div>

          {currentPhase !== 'FASE_2' && (
            <div className="grid grid-cols-2 gap-1 text-[10px]">
              <button
                type="button"
                data-pontomais-preset="42H_LUN1H_SEX"
                onClick={() => onUpdatePontoMaisConfig(PONTOMAIS_PRESET_CONFIGS['42H_LUN1H_SEX'])}
                className={`py-1 px-1.5 rounded-lg border font-bold transition cursor-pointer ${
                  pontoMaisConfig.presetId === '42H_LUN1H_SEX'
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
                title="Seg–Qui 08h–17h30 (8h30) + Sex 08h–17h (8h00) = 42h00"
              >
                42h (8h30/8h)
              </button>
              <button
                type="button"
                data-pontomais-preset="42H_8H24_DIA"
                onClick={() => onUpdatePontoMaisConfig(PONTOMAIS_PRESET_CONFIGS['42H_8H24_DIA'])}
                className={`py-1 px-1.5 rounded-lg border font-bold transition cursor-pointer ${
                  pontoMaisConfig.presetId === '42H_8H24_DIA'
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
                title="Seg–Sex 08h–17h24 (8h24/dia) = 42h00"
              >
                42h (8h24/dia)
              </button>
            </div>
          )}

          <div className="space-y-1">
            <label
              htmlFor="pontomais-note-input"
              className="text-[10px] font-semibold text-slate-500 block"
            >
              Nota de horário no PontoMais (para manter conformidade):
            </label>
            <textarea
              id="pontomais-note-input"
              data-pontomais-note-input="true"
              rows={3}
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              onBlur={() => {
                if (noteDraft !== (pontoMaisConfig.note || '')) {
                  onUpdatePontoMaisConfig({ ...pontoMaisConfig, note: noteDraft });
                }
              }}
              placeholder="Ex: Seg–Qui 08:00–17:30 (1h almoço) + Sex 08:00–17:00 = 42h00 fechadas..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-emerald-500 focus:outline-none p-2 text-[10.5px] leading-snug text-slate-800 resize-y"
            />
          </div>

          <div className="flex items-center justify-between gap-1.5">
            <button
              type="button"
              data-pontomais-toggle="true"
              onClick={() => setShowPontoMaisTimes((prev) => !prev)}
              className="text-[10px] font-bold text-emerald-700 hover:underline cursor-pointer"
            >
              {showPontoMaisTimes ? 'Ocultar horários base' : 'Editar horários base'}
            </button>
            {noteDraft !== (pontoMaisConfig.note || '') && (
              <button
                type="button"
                data-pontomais-save-note="true"
                onClick={() => onUpdatePontoMaisConfig({ ...pontoMaisConfig, note: noteDraft })}
                className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] cursor-pointer"
              >
                Salvar nota
              </button>
            )}
          </div>

          {showPontoMaisTimes && (() => {
            const draftValidation = validatePontoMaisStandardCap(pmDraft, currentPhase);
            const updatePmDay = (day: DayOfWeek, patch: Partial<PontoMaisDayRule>) => {
              setPmDraft((prev) => ({
                ...prev,
                presetId: 'CUSTOM',
                label: 'Personalizado PontoMais',
                days: {
                  ...prev.days,
                  [day]: { ...prev.days[day], ...patch },
                },
              }));
            };

            return (
              <div
                data-pontomais-sidebar-editor="true"
                className="p-2 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5 text-[10px]"
              >
                {DAYS_OF_WEEK.map((d) => {
                  const rule = pmDraft.days[d.key];
                  return (
                    <div
                      key={d.key}
                      data-pontomais-day-rule={d.key}
                      className="flex items-center justify-between gap-1 border-b border-slate-100 pb-1 last:border-b-0 last:pb-0"
                    >
                      <label className="flex items-center gap-1 font-bold text-slate-700 cursor-pointer w-12 shrink-0">
                        <input
                          type="checkbox"
                          checked={rule.isWorkDay}
                          onChange={(e) =>
                            updatePmDay(d.key, {
                              isWorkDay: e.target.checked,
                              startTime: rule.startTime === '00:00' ? '08:00' : rule.startTime,
                              endTime:
                                rule.endTime === '00:00'
                                  ? d.key === 'SAB'
                                    ? '12:00'
                                    : '17:00'
                                  : rule.endTime,
                            })
                          }
                          className="rounded border-slate-300 text-emerald-600"
                        />
                        <span>{d.shortLabel}</span>
                      </label>

                      {rule.isWorkDay ? (
                        <div className="flex items-center gap-1 flex-1 min-w-0 justify-end">
                          <input
                            type="time"
                            aria-label={`PontoMais entrada ${d.label}`}
                            value={rule.startTime}
                            onChange={(e) => updatePmDay(d.key, { startTime: e.target.value })}
                            className="px-1 py-0.5 bg-white border border-slate-200 rounded font-mono text-[9.5px] w-[68px]"
                          />
                          <input
                            type="time"
                            aria-label={`PontoMais saída ${d.label}`}
                            value={rule.endTime}
                            onChange={(e) => updatePmDay(d.key, { endTime: e.target.value })}
                            className="px-1 py-0.5 bg-white border border-slate-200 rounded font-mono text-[9.5px] w-[68px]"
                          />
                          <span className="font-mono font-bold text-emerald-700 w-9 text-right shrink-0">
                            {formatHoursDecimal(calculatePontoMaisDayHours(rule))}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 font-semibold">Folga</span>
                      )}
                    </div>
                  );
                })}

                <div className="pt-1 flex items-center justify-between gap-1.5">
                  <span
                    className={`font-mono font-bold text-[10px] ${
                      draftValidation.valid ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {formatHoursDecimal(draftValidation.weeklyHours)} /{' '}
                    {formatHoursDecimal(draftValidation.maxAllowed)}
                  </span>
                  <button
                    type="button"
                    data-pontomais-save-custom="true"
                    onClick={() => onUpdatePontoMaisConfig({ ...pmDraft, note: noteDraft })}
                    className={`px-2.5 py-1 rounded font-bold text-[10px] cursor-pointer ${
                      draftValidation.valid
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : 'bg-rose-600 hover:bg-rose-700 text-white'
                    }`}
                  >
                    Aplicar
                  </button>
                </div>

                {!draftValidation.valid && (
                  <p data-pontomais-cap-error="true" className="text-[9.5px] text-rose-700 font-semibold">
                    {draftValidation.message}
                  </p>
                )}
              </div>
            );
          })()}
        </section>

        {/* 5. Ações de Impressão e Backup */}
        <section className="space-y-2 border-t border-slate-200 pt-3 mt-auto">
          <button
            type="button"
            onClick={onOpenPrintModal}
            className="w-full py-2 px-3 rounded-lg bg-white hover:bg-slate-100 text-slate-900 border border-slate-300 font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs transition cursor-pointer"
          >
            <Printer className="w-4 h-4 text-blue-600" />
            <span>Imprimir Quadro (Art. 74 CLT)</span>
          </button>

          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={onExportJson}
              className="py-1.5 px-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 font-semibold text-[11px] flex items-center justify-center gap-1 transition cursor-pointer"
              title="Exportar Backup da Escala (JSON)"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar</span>
            </button>
            <button
              type="button"
              onClick={onImportJson}
              className="py-1.5 px-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 font-semibold text-[11px] flex items-center justify-center gap-1 transition cursor-pointer"
              title="Importar Backup da Escala (JSON)"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Importar</span>
            </button>
            <button
              type="button"
              onClick={onResetDefaults}
              className="py-1.5 px-2 rounded-lg bg-slate-50 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 text-slate-700 border border-slate-200 font-semibold text-[11px] flex items-center justify-center gap-1 transition cursor-pointer"
              title="Restaurar escala padrão da Seu Carro PE"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Padrão</span>
            </button>
          </div>
        </section>
      </div>
    </aside>
  );
};
