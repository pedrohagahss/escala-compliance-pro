import React, { useState } from 'react';
import { DepartmentId, Employee, LegalPhase } from '../types/schedule';
import { DAYS_OF_WEEK, LEGAL_PHASES, formatHoursDecimal, suggest5x2Redistribution } from '../utils/compliance';
import { DEPARTMENTS } from '../data/seuCarroData';
import { Sparkles, X, CheckCircle2, ShieldCheck, RefreshCw } from 'lucide-react';

interface RedistributionModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  currentPhase: LegalPhase;
  defaultDepartment?: DepartmentId | 'ALL';
  onApplyRedistribution: (updatedEmployees: Employee[]) => void;
}

export const RedistributionModal: React.FC<RedistributionModalProps> = ({
  isOpen,
  onClose,
  employees,
  currentPhase,
  defaultDepartment = 'ALL',
  onApplyRedistribution,
}) => {
  const [selectedDept, setSelectedDept] = useState<DepartmentId | 'ALL'>(defaultDepartment);
  const [strategy, setStrategy] = useState<'COMMERCIAL_5X2' | 'WEEKEND_ROTATION'>('COMMERCIAL_5X2');

  const phaseConfig = LEGAL_PHASES[currentPhase];

  if (!isOpen) return null;

  const targetEmployees = employees.filter((emp) => {
    if (emp.contractType === 'LICENCA_MATERNIDADE' || emp.contractType === 'ESTAGIARIO') return false;
    if (selectedDept === 'ALL') return true;
    return emp.department === selectedDept;
  });

  const previewEmployees: Employee[] = employees.map((emp) => {
    if (emp.contractType === 'LICENCA_MATERNIDADE' || emp.contractType === 'ESTAGIARIO') return emp;
    const isTarget = selectedDept === 'ALL' || emp.department === selectedDept;
    if (!isTarget) return emp;

    let rotationPattern = 0;
    if (strategy === 'WEEKEND_ROTATION') {
      const indexInDept = targetEmployees.findIndex((e) => e.id === emp.id);
      rotationPattern = indexInDept % 2; // 0 = Seg-Sex, 1 = Ter-Sáb
    }

    const newSchedule = suggest5x2Redistribution(emp, currentPhase, strategy, rotationPattern);

    return {
      ...emp,
      schedule: newSchedule,
    };
  });

  const handleApply = () => {
    onApplyRedistribution(previewEmployees);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Assistente de Redistribuição 5x2 (EC 141/2026)
              </h3>
              <p className="text-xs text-slate-500">
                Adequação automática às diretrizes da {phaseConfig.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Configuration Body */}
        <div className="p-6 space-y-5 text-xs">
          {/* Target Department */}
          <div>
            <label className="block font-bold text-slate-800 mb-1.5">
              Escopo da Redistribuição por Setor
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setSelectedDept('ALL')}
                className={`py-2 px-3 rounded-lg border text-center font-medium transition ${
                  selectedDept === 'ALL'
                    ? 'border-blue-600 bg-blue-50 text-blue-800 font-bold'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                Toda Equipe ({targetEmployees.length})
              </button>
              {DEPARTMENTS.slice(0, 7).map((dept) => {
                const count = employees.filter(
                  (e) => e.department === dept.id && e.contractType !== 'LICENCA_MATERNIDADE' && e.contractType !== 'ESTAGIARIO'
                ).length;
                if (count === 0) return null;
                return (
                  <button
                    key={dept.id}
                    type="button"
                    onClick={() => setSelectedDept(dept.id)}
                    className={`py-2 px-3 rounded-lg border text-center font-medium transition ${
                      selectedDept === dept.id
                        ? 'border-blue-600 bg-blue-50 text-blue-800 font-bold'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {dept.name.split(' ')[0]} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* Strategy Selection */}
          <div>
            <label className="block font-bold text-slate-800 mb-1.5">
              Estratégia Operacional 5x2
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Option 1: Commercial */}
              <button
                type="button"
                onClick={() => setStrategy('COMMERCIAL_5X2')}
                className={`p-3.5 rounded-xl border text-left transition ${
                  strategy === 'COMMERCIAL_5X2'
                    ? 'border-emerald-600 bg-emerald-50 shadow-xs ring-1 ring-emerald-600'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-slate-900 text-sm">
                    Segunda a Sexta (5x2 Comercial)
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                    Sábado Livre
                  </span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Elimina o expediente aos sábados para os colaboradores selecionados. Distribui 40h de segunda a sexta (8h/dia com almoço de 1h30).
                </p>
              </button>

              {/* Option 2: Weekend Rotation */}
              <button
                type="button"
                onClick={() => setStrategy('WEEKEND_ROTATION')}
                className={`p-3.5 rounded-xl border text-left transition ${
                  strategy === 'WEEKEND_ROTATION'
                    ? 'border-emerald-600 bg-emerald-50 shadow-xs ring-1 ring-emerald-600'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-slate-900 text-sm">
                    Revezamento 5x2 com Sábado
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                    Sábado 08h–13h
                  </span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Alterna parte da equipe no sábado (08:00 às 13:00 = 5h), com folga útil na segunda-feira para preservar os 2 descansos semanais obrigatórios.
                </p>
              </button>
            </div>
          </div>

          {/* Impact Comparison Summary */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <h4 className="font-bold text-slate-900 text-xs mb-2 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Resultado Previsto após Aplicação
            </h4>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-500 block">Colaboradores</span>
                <span className="text-base font-extrabold font-mono text-slate-900">
                  {targetEmployees.length}
                </span>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-500 block">Carga Prevista</span>
                <span className="text-base font-extrabold font-mono text-emerald-700">
                  {strategy === 'COMMERCIAL_5X2' ? '40h00' : '37h00 / 40h00'}
                </span>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-500 block">Conformidade Legal</span>
                <span className="text-base font-extrabold font-mono text-emerald-700">
                  100% 5x2
                </span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl transition"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition shadow-xs"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Aplicar Redistribuição 5x2</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
