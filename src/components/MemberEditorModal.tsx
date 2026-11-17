import React, { useEffect, useMemo, useState } from 'react';
import { STORES } from '../data/seuCarroData';
import {
  ContractType,
  DayOfWeek,
  DepartmentId,
  Employee,
  StoreId,
} from '../types/schedule';
import {
  deriveShortName,
  generateNextChairId,
  getDepartmentBadgeColor,
  NewMemberInput,
} from '../utils/teamManagement';
import {
  AlertTriangle,
  Briefcase,
  Building2,
  Check,
  Clock,
  Palette,
  RefreshCw,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';

interface MemberEditorModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  initialEmployee?: Employee;
  employees: Employee[];
  onClose: () => void;
  onCreateMember: (input: NewMemberInput) => void;
  onUpdateMember: (
    memberId: string,
    patch: Partial<NewMemberInput>,
    rebuildWorkShifts: boolean
  ) => void;
  onDeleteMember: (memberId: string) => void;
}

const DEPARTMENT_OPTIONS: Array<{ id: DepartmentId; label: string }> = [
  { id: 'SDR', label: 'SDR / Pré-Vendas' },
  { id: 'VENDAS', label: 'Vendas / Consultores' },
  { id: 'PREPARACAO', label: 'Preparação / Zeladoria' },
  { id: 'DOCUMENTACAO', label: 'Documentação / Despacho' },
  { id: 'FINANCEIRO', label: 'Financeiro' },
  { id: 'SUCESSO_CLIENTE', label: 'Sucesso do Cliente' },
  { id: 'MARKETING', label: 'Marketing' },
  { id: 'GESTAO', label: 'Gestão / Liderança' },
];

const CONTRACT_OPTIONS: Array<{ id: ContractType; label: string; hint: string }> = [
  { id: 'CLT_ATIVO', label: 'CLT Ativo', hint: 'Escala 5x2 respeitando teto legal vigente' },
  { id: 'CLT_TEMPORARIO', label: 'CLT Temporário', hint: 'Escala 5x2 temporária / substituição' },
  { id: 'ESTAGIARIO', label: 'Estagiário (Lei 11.788)', hint: 'Carga máxima reduzida (24h/sem), sem almoço obrigatório' },
  { id: 'LIDERANCA', label: 'Liderança Circulante', hint: 'Gestão itinerante entre Loja 1 e Loja 2' },
  { id: 'LICENCA_MATERNIDADE', label: 'Licença Maternidade', hint: 'Afastamento integral registrado em S1–S4' },
];

const WEEKDAY_OFF_OPTIONS: Array<{ key: DayOfWeek; label: string }> = [
  { key: 'SEG', label: 'Segunda-feira' },
  { key: 'TER', label: 'Terça-feira' },
  { key: 'QUA', label: 'Quarta-feira' },
  { key: 'QUI', label: 'Quinta-feira' },
  { key: 'SEX', label: 'Sexta-feira' },
];

const COLOR_PRESETS = [
  '#2563EB',
  '#0EA5E9',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#EC4899',
  '#475569',
];

export const MemberEditorModal: React.FC<MemberEditorModalProps> = ({
  isOpen,
  mode,
  initialEmployee,
  employees,
  onClose,
  onCreateMember,
  onUpdateMember,
  onDeleteMember,
}) => {
  const [activeMode, setActiveMode] = useState<'create' | 'edit'>(mode);
  const [selectedMemberId, setSelectedMemberId] = useState<string>(initialEmployee?.id || '');

  const [name, setName] = useState('');
  const [shortName, setShortName] = useState('');
  const [shortNameManuallyEdited, setShortNameManuallyEdited] = useState(false);
  const [role, setRole] = useState('Consultor(a) / Operação');
  const [defaultStore, setDefaultStore] = useState<StoreId>('LOJA_1');
  const [department, setDepartment] = useState<DepartmentId>('VENDAS');
  const [contractType, setContractType] = useState<ContractType>('CLT_ATIVO');
  const [defaultChairId, setDefaultChairId] = useState('');
  const [chairManuallyEdited, setChairManuallyEdited] = useState(false);
  const [badgeColor, setBadgeColor] = useState('#2563EB');
  const [defaultLunchStart, setDefaultLunchStart] = useState('12:00');
  const [defaultLunchEnd, setDefaultLunchEnd] = useState('13:30');
  const [saturdayOffWeek, setSaturdayOffWeek] = useState<number>(1);
  const [weekdayOff, setWeekdayOff] = useState<DayOfWeek>('SEG');
  const [rulesAndRestrictions, setRulesAndRestrictions] = useState('');
  const [rebuildWorkShifts, setRebuildWorkShifts] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const loadEmployeeIntoForm = (emp: Employee) => {
    setActiveMode('edit');
    setSelectedMemberId(emp.id);
    setName(emp.name);
    setShortName(emp.shortName);
    setShortNameManuallyEdited(true);
    setRole(emp.role);
    setDefaultStore(emp.defaultStore);
    setDepartment(emp.department);
    setContractType(emp.contractType);
    setDefaultChairId(emp.defaultChairId);
    setChairManuallyEdited(false);
    setBadgeColor(emp.badgeColor || getDepartmentBadgeColor(emp.department));
    setDefaultLunchStart(emp.defaultLunchStart || '12:00');
    setDefaultLunchEnd(emp.defaultLunchEnd || '13:30');
    setSaturdayOffWeek(emp.saturdayOffWeek || 1);
    setWeekdayOff('SEG');
    setRulesAndRestrictions(emp.rulesAndRestrictions || '');
    setRebuildWorkShifts(false);
    setConfirmingDelete(false);
    setValidationError(null);
  };

  const resetFormForCreate = (preferredStore: StoreId = 'LOJA_1', preferredDept: DepartmentId = 'VENDAS') => {
    const suggestedChair = generateNextChairId(preferredDept, preferredStore, employees);
    setActiveMode('create');
    setSelectedMemberId('');
    setName('');
    setShortName('');
    setShortNameManuallyEdited(false);
    setRole('Consultor(a) / Operação');
    setDefaultStore(preferredStore);
    setDepartment(preferredDept);
    setContractType('CLT_ATIVO');
    setDefaultChairId(suggestedChair);
    setChairManuallyEdited(false);
    setBadgeColor(getDepartmentBadgeColor(preferredDept));
    setDefaultLunchStart('12:00');
    setDefaultLunchEnd('13:30');
    setSaturdayOffWeek(1);
    setWeekdayOff(preferredDept === 'SDR' ? 'TER' : 'SEG');
    setRulesAndRestrictions('');
    setRebuildWorkShifts(false);
    setConfirmingDelete(false);
    setValidationError(null);
  };

  useEffect(() => {
    if (!isOpen) return;
    if (mode === 'edit' && initialEmployee) {
      loadEmployeeIntoForm(initialEmployee);
    } else if (mode === 'edit' && !initialEmployee && employees.length > 0) {
      loadEmployeeIntoForm(employees[0]);
    } else {
      resetFormForCreate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, mode, initialEmployee?.id]);

  const currentEditingEmployee = useMemo(
    () => employees.find((e) => e.id === selectedMemberId),
    [employees, selectedMemberId]
  );

  const suggestedChairForSelection = useMemo(
    () => generateNextChairId(department, defaultStore, employees),
    [department, defaultStore, employees]
  );

  if (!isOpen) return null;

  const isLunchHidden = contractType === 'ESTAGIARIO' || contractType === 'LICENCA_MATERNIDADE';

  const handleStoreChange = (nextStore: StoreId) => {
    setDefaultStore(nextStore);
    if (!chairManuallyEdited) {
      const sameOriginalSection =
        activeMode === 'edit' &&
        currentEditingEmployee &&
        currentEditingEmployee.defaultStore === nextStore &&
        currentEditingEmployee.department === department;
      setDefaultChairId(
        sameOriginalSection
          ? currentEditingEmployee.defaultChairId
          : generateNextChairId(department, nextStore, employees)
      );
    }
  };

  const handleDepartmentChange = (nextDept: DepartmentId) => {
    setDepartment(nextDept);
    setBadgeColor(getDepartmentBadgeColor(nextDept));
    if (activeMode === 'create') {
      setWeekdayOff(nextDept === 'SDR' ? 'TER' : 'SEG');
    }
    if (!chairManuallyEdited) {
      const sameOriginalSection =
        activeMode === 'edit' &&
        currentEditingEmployee &&
        currentEditingEmployee.defaultStore === defaultStore &&
        currentEditingEmployee.department === nextDept;
      setDefaultChairId(
        sameOriginalSection
          ? currentEditingEmployee.defaultChairId
          : generateNextChairId(nextDept, defaultStore, employees)
      );
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      setValidationError('Informe o nome completo do colaborador para salvar.');
      return;
    }

    const cleanShort = shortName.trim() || deriveShortName(cleanName);
    const cleanRole = role.trim() || 'Colaborador(a)';
    const cleanChair = defaultChairId.trim() || suggestedChairForSelection;

    const payload: NewMemberInput = {
      name: cleanName,
      shortName: cleanShort,
      role: cleanRole,
      contractType,
      department,
      defaultStore,
      defaultChairId: cleanChair,
      badgeColor,
      defaultLunchStart: isLunchHidden ? undefined : defaultLunchStart,
      defaultLunchEnd: isLunchHidden ? undefined : defaultLunchEnd,
      saturdayOffWeek,
      weekdayOff,
      rulesAndRestrictions: rulesAndRestrictions.trim(),
    };

    if (activeMode === 'create') {
      onCreateMember(payload);
    } else if (selectedMemberId) {
      onUpdateMember(selectedMemberId, payload, rebuildWorkShifts);
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        data-member-modal="true"
        data-member-mode={activeMode}
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                activeMode === 'create'
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-blue-100 text-blue-700'
              }`}
            >
              {activeMode === 'create' ? (
                <UserPlus className="w-5 h-5" />
              ) : (
                <UserCheck className="w-5 h-5" />
              )}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-black text-slate-900 truncate">
                {activeMode === 'create'
                  ? 'Incluir Novo Membro na Equipe'
                  : `Editar Cadastro — ${currentEditingEmployee?.shortName || 'Colaborador'}`}
              </h3>
              <p className="text-[11px] text-slate-500">
                Gerencie postos, lojas, contrato, almoço padrão e ciclo mensal S1–S4
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 transition-colors"
            title="Fechar janela"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Barra de troca rápida entre Editar Membro / Novo Membro */}
        <div className="px-5 py-2.5 bg-slate-100/80 border-b border-slate-200 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 flex-1 min-w-[220px]">
            <Users className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <select
              data-member-switcher="true"
              value={activeMode === 'edit' ? selectedMemberId : ''}
              onChange={(e) => {
                const emp = employees.find((item) => item.id === e.target.value);
                if (emp) loadEmployeeIntoForm(emp);
              }}
              className="flex-1 text-xs font-semibold bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800"
            >
              <option value="" disabled>
                Selecionar membro existente para editar...
              </option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.shortName} ({emp.defaultChairId} · {emp.defaultStore === 'LOJA_1' ? 'Loja 1' : 'Loja 2'})
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            data-member-mode-create="true"
            onClick={() => resetFormForCreate(defaultStore, department)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 border transition-colors ${
              activeMode === 'create'
                ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                : 'bg-white text-emerald-700 border-emerald-300 hover:bg-emerald-50'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            + Novo Membro
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {validationError && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl px-3.5 py-2.5 flex items-center gap-2 font-semibold">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Nome Completo + Nome Curto */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1">
              <label className="block font-bold text-slate-700">
                Nome Completo *
              </label>
              <input
                type="text"
                data-member-name-input="true"
                value={name}
                onChange={(e) => {
                  const val = e.target.value;
                  setName(val);
                  setValidationError(null);
                  if (!shortNameManuallyEdited) {
                    setShortName(val.trim() ? deriveShortName(val) : '');
                  }
                }}
                placeholder="Ex: Camila Ferreira dos Santos"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-1">
              <label className="block font-bold text-slate-700">
                Nome na Tabela
              </label>
              <input
                type="text"
                data-member-shortname-input="true"
                value={shortName}
                onChange={(e) => {
                  setShortName(e.target.value);
                  setShortNameManuallyEdited(true);
                }}
                placeholder="Ex: Camila"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Cargo + Contrato */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-slate-700 flex items-center gap-1">
                <Briefcase className="w-3.5 h-3.5 text-slate-500" />
                Cargo / Função
              </label>
              <input
                type="text"
                data-member-role-input="true"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="Ex: SDR Pré-Vendas"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-1">
              <label className="block font-bold text-slate-700">
                Tipo de Contrato
              </label>
              <select
                data-member-contract-select="true"
                value={contractType}
                onChange={(e) => setContractType(e.target.value as ContractType)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {CONTRACT_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-slate-500">
                {CONTRACT_OPTIONS.find((c) => c.id === contractType)?.hint}
              </p>
            </div>
          </div>

          {/* Loja + Setor + Cadeira + Cor */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-slate-700 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-slate-500" />
                Loja Padrão
              </label>
              <select
                data-member-store-select="true"
                value={defaultStore}
                onChange={(e) => handleStoreChange(e.target.value as StoreId)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {STORES.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name} ({st.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="block font-bold text-slate-700">
                Setor Operacional
              </label>
              <select
                data-member-department-select="true"
                value={department}
                onChange={(e) => handleDepartmentChange(e.target.value as DepartmentId)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {DEPARTMENT_OPTIONS.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block font-bold text-slate-700">
                Código do Posto / Cadeira
              </label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  data-member-chair-input="true"
                  value={defaultChairId}
                  onChange={(e) => {
                    setDefaultChairId(e.target.value.toUpperCase());
                    setChairManuallyEdited(true);
                  }}
                  placeholder={suggestedChairForSelection}
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    setDefaultChairId(suggestedChairForSelection);
                    setChairManuallyEdited(false);
                  }}
                  title={`Usar próximo código livre: ${suggestedChairForSelection}`}
                  className="px-2.5 py-2 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold flex items-center gap-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Auto
                </button>
              </div>
              <p className="text-[10px] text-slate-500">
                Sugestão automática para esta loja/setor:{' '}
                <strong className="font-mono text-slate-700">{suggestedChairForSelection}</strong>
              </p>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700 flex items-center gap-1">
                <Palette className="w-3.5 h-3.5 text-slate-500" />
                Cor da Tag na Escala
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  data-member-badge-input="true"
                  value={badgeColor}
                  onChange={(e) => setBadgeColor(e.target.value)}
                  className="w-10 h-9 p-0.5 border border-slate-300 rounded-lg cursor-pointer bg-white"
                />
                <div className="flex flex-wrap gap-1.5">
                  {COLOR_PRESETS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setBadgeColor(c)}
                      className={`w-5 h-5 rounded-full border-2 transition-transform ${
                        badgeColor.toLowerCase() === c.toLowerCase()
                          ? 'border-slate-900 scale-110'
                          : 'border-white shadow-xs'
                      }`}
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Almoço + Folgas */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center gap-1.5 font-bold text-slate-800">
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              <span>Horário de Almoço Padrão & Escala Mensal S1–S4</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {!isLunchHidden ? (
                <>
                  <div className="space-y-1">
                    <label className="block font-semibold text-slate-600">
                      Saída Almoço
                    </label>
                    <input
                      type="time"
                      data-member-lunch-start-input="true"
                      value={defaultLunchStart}
                      onChange={(e) => setDefaultLunchStart(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-semibold text-slate-800"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block font-semibold text-slate-600">
                      Retorno Almoço
                    </label>
                    <input
                      type="time"
                      data-member-lunch-end-input="true"
                      value={defaultLunchEnd}
                      onChange={(e) => setDefaultLunchEnd(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-semibold text-slate-800"
                    />
                  </div>
                </>
              ) : (
                <div className="sm:col-span-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-[11px] text-amber-800 flex items-center">
                  Contrato selecionado ({contractType === 'ESTAGIARIO' ? 'Estágio' : 'Licença'}) não utiliza intervalo padrão de almoço CLT na escala.
                </div>
              )}

              <div className="space-y-1">
                <label className="block font-semibold text-slate-600">
                  Sábado de Folga no Mês
                </label>
                <select
                  data-member-saturday-off-select="true"
                  value={saturdayOffWeek}
                  onChange={(e) => setSaturdayOffWeek(Number(e.target.value))}
                  disabled={isLunchHidden}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-semibold text-slate-800 disabled:opacity-50"
                >
                  {[1, 2, 3, 4].map((w) => (
                    <option key={w} value={w}>
                      Semana {w} (S{w})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {activeMode === 'create' && !isLunchHidden && (
              <div className="space-y-1">
                <label className="block font-semibold text-slate-600">
                  Folga 5x2 Inicial (nas semanas em que trabalha sábado)
                </label>
                <select
                  data-member-weekday-off-select="true"
                  value={weekdayOff}
                  onChange={(e) => setWeekdayOff(e.target.value as DayOfWeek)}
                  className="w-full sm:w-1/2 px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-semibold text-slate-800"
                >
                  {WEEKDAY_OFF_OPTIONS.map((opt) => (
                    <option key={opt.key} value={opt.key}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {activeMode === 'edit' && (
              <label className="flex items-start gap-2 pt-1 cursor-pointer select-none">
                <input
                  type="checkbox"
                  data-member-rebuild-checkbox="true"
                  checked={rebuildWorkShifts}
                  onChange={(e) => setRebuildWorkShifts(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-[11px] text-slate-600 leading-snug">
                  <strong>Recalcular turnos de trabalho em S1–S4</strong> conforme horário da loja e contrato selecionados (preserva as folgas 5x2 e DSR já definidas; trocas de loja/contrato recalculam automaticamente).
                </span>
              </label>
            )}
          </div>

          {/* Regras e Restrições */}
          <div className="space-y-1">
            <label className="block font-bold text-slate-700">
              Regras Operacionais & Restrições Individuais
            </label>
            <textarea
              data-member-rules-input="true"
              rows={2}
              value={rulesAndRestrictions}
              onChange={(e) => setRulesAndRestrictions(e.target.value)}
              placeholder="Ex: Curso às quartas após 18h / Cobre recepção da Loja 2 / Não folgar junto com outro SDR..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Confirmação inline de exclusão */}
          {activeMode === 'edit' && confirmingDelete && currentEditingEmployee && (
            <div
              data-member-delete-confirm-box="true"
              className="bg-rose-50 border border-rose-300 rounded-xl p-3.5 space-y-2.5"
            >
              <div className="flex items-start gap-2 text-rose-900">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="text-[11px] leading-relaxed">
                  <strong>Confirmar exclusão permanente de {currentEditingEmployee.name}?</strong>
                  <br />
                  O posto <strong>{currentEditingEmployee.defaultChairId}</strong> e os vínculos de folga ou cobertura associados a este membro serão removidos do cenário ativo.
                </div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  data-member-delete-cancel-btn="true"
                  onClick={() => setConfirmingDelete(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 font-bold hover:bg-slate-50"
                >
                  Manter Membro
                </button>
                <button
                  type="button"
                  data-member-delete-confirm-btn="true"
                  onClick={() => {
                    onDeleteMember(currentEditingEmployee.id);
                    onClose();
                  }}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Confirmar Exclusão
                </button>
              </div>
            </div>
          )}

          {/* Footer Buttons inside form for proper Enter submit */}
          <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
            <div>
              {activeMode === 'edit' && currentEditingEmployee && !confirmingDelete && (
                <button
                  type="button"
                  data-member-delete-trigger="true"
                  onClick={() => setConfirmingDelete(true)}
                  className="px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold flex items-center gap-1.5 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Excluir Membro
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                data-member-submit-btn="true"
                className={`px-4 py-2 rounded-xl font-bold text-white flex items-center gap-1.5 shadow-sm transition-colors ${
                  activeMode === 'create'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {activeMode === 'create' ? (
                  <>
                    <UserPlus className="w-4 h-4" />
                    Incluir na Escala
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Salvar Alterações
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
