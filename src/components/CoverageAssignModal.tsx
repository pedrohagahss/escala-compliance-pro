import React, { useState } from 'react';
import { DayOfWeek, Employee, SectorMinimumsMap, ShiftCoverage } from '../types/schedule';
import { DAYS_OF_WEEK } from '../utils/compliance';
import { resolveSectorMinimum, SECTOR_DEFINITIONS } from '../utils/coverage';
import { LEADERSHIP_TEAM } from '../data/seuCarroData';
import { Shield, UserCheck, X, AlertTriangle, Users, Check } from 'lucide-react';

interface CoverageAssignModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee;
  day: DayOfWeek;
  allEmployees: Employee[];
  sectorMinimums?: SectorMinimumsMap;
  onSaveCoverage: (employeeId: string, day: DayOfWeek, coverage: ShiftCoverage | undefined) => void;
}

export const CoverageAssignModal: React.FC<CoverageAssignModalProps> = ({
  isOpen,
  onClose,
  employee,
  day,
  allEmployees,
  sectorMinimums,
  onSaveCoverage,
}) => {
  if (!isOpen) return null;

  const dayInfo = DAYS_OF_WEEK.find((d) => d.key === day) || DAYS_OF_WEEK[0];
  const currentShift = employee.schedule[day];
  const currentCoverage = currentShift?.coverage;

  // Setor deste colaborador
  const sector = SECTOR_DEFINITIONS.find(
    (s) => s.chairIds.includes(employee.defaultChairId) || s.departmentId === employee.department
  );

  // Lista de líderes circulantes
  const leadershipOptions = [
    { id: 'emp-edvania', name: 'Edvania Maria', role: 'Supervisora Comercial', focus: 'Apoio direto a Vendedores e SDRs na Matriz 546' },
    { id: 'emp-lorena', name: 'Lorena Maria Reis', role: 'Gerente Geral', focus: 'Supervisão de todos os setores na Matriz 546' },
    { id: 'emp-pedro', name: 'Pedro Henrique', role: 'Sócio / Operações', focus: 'Compras, Avaliação e Vendas na Filial 777' },
    { id: 'emp-igor', name: 'Igor Rafael', role: 'Sócio Administrador', focus: 'Financeiro, Pagamentos e Marketing' },
    { id: 'emp-anibal', name: 'Aníbal', role: 'Qualidade / DETRAN', focus: 'Demandas externas, cartórios e documentação' },
  ];

  // Colegas do mesmo setor que trabalham neste dia
  const peerOptions = allEmployees.filter(
    (e) =>
      e.id !== employee.id &&
      e.department === employee.department &&
      e.contractType !== 'LICENCA_MATERNIDADE' &&
      e.contractType !== 'ESTAGIARIO'
  );

  const [selectedId, setSelectedId] = useState<string>(
    currentCoverage?.coveredByEmployeeId || sector?.primaryBackups[0]?.id || 'emp-edvania'
  );
  const [notes, setNotes] = useState<string>(
    currentCoverage?.notes || `Cobertura de posto durante folga semanal de ${employee.shortName}`
  );

  const handleConfirm = () => {
    // Procura no leadership ou nos pares
    const leader = leadershipOptions.find((l) => l.id === selectedId);
    if (leader) {
      onSaveCoverage(employee.id, day, {
        coveredByEmployeeId: leader.id,
        coveredByName: leader.name,
        coveredByRole: leader.role,
        notes,
      });
      onClose();
      return;
    }

    const peer = peerOptions.find((p) => p.id === selectedId);
    if (peer) {
      onSaveCoverage(employee.id, day, {
        coveredByEmployeeId: peer.id,
        coveredByName: peer.name,
        coveredByRole: `${peer.role} (Colega de Setor)`,
        notes,
      });
      onClose();
      return;
    }

    onClose();
  };

  const handleRemove = () => {
    onSaveCoverage(employee.id, day, undefined);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden my-6 animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Designar Cobertura de Posto / Substituto
              </h3>
              <p className="text-xs text-slate-500">
                Garante que o setor não fique desfalque ou 100% descoberto
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

        {/* Body */}
        <div className="p-6 space-y-5 text-xs text-slate-700">
          {/* Card do Colaborador Ausente */}
          <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 text-sm">{employee.name}</span>
              <span className="px-2 py-0.5 rounded bg-blue-200 text-blue-900 font-bold text-[10px]">
                {dayInfo.label}
              </span>
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <span>{employee.role}</span>
              <span>&bull;</span>
              <span>{sector?.storeName || 'Loja'}</span>
              <span>&bull;</span>
              <span className="font-semibold text-blue-800">
                {currentShift?.label || 'Folga 5x2'}
              </span>
            </div>
            {sector && (
              <div className="text-[11px] text-slate-600 pt-1 border-t border-blue-200/60 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>
                  Setor: <strong>{sector.title}</strong> (mínimo configurado:{' '}
                  {resolveSectorMinimum(sector, day === 'SAB', sectorMinimums)} profissionais)
                </span>
              </div>
            )}
          </div>

          {/* Seleção do Substituto */}
          <div className="space-y-3">
            <label className="font-bold text-slate-900 block">
              Quem irá cobrir este posto no dia {dayInfo.label}?
            </label>

            {/* Grupo 1: Liderança Circulante (Recomendada) */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Liderança Circulante Oficial (Sem Posto Rígido)
              </span>
              <div className="space-y-1.5">
                {leadershipOptions.map((l) => (
                  <label
                    key={l.id}
                    onClick={() => setSelectedId(l.id)}
                    className={`flex items-start gap-3 p-2.5 rounded-xl border cursor-pointer transition ${
                      selectedId === l.id
                        ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-500/20'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="coverageTarget"
                      checked={selectedId === l.id}
                      onChange={() => setSelectedId(l.id)}
                      className="mt-0.5 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <strong className="text-slate-900">{l.name}</strong>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 font-medium">
                          {l.role}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">{l.focus}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Grupo 2: Pares de Setor Disponíveis */}
            {peerOptions.length > 0 && (
              <div className="space-y-1.5 pt-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Pares do Mesmo Setor
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {peerOptions.map((p) => (
                    <label
                      key={p.id}
                      onClick={() => setSelectedId(p.id)}
                      className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition ${
                        selectedId === p.id
                          ? 'bg-blue-50 border-blue-400 font-bold'
                          : 'bg-white border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="coverageTarget"
                        checked={selectedId === p.id}
                        onChange={() => setSelectedId(p.id)}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-slate-900 truncate">{p.shortName}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Observações / Descrição da Cobertura */}
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-700 block">
              Orientações para o substituto (opcional):
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Cobrir atendimento telefônico e recepção de showroom das 08h às 17h30"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-800 text-xs focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50">
          <div>
            {currentCoverage && (
              <button
                type="button"
                onClick={handleRemove}
                className="text-rose-600 hover:text-rose-700 text-xs font-semibold hover:underline"
              >
                Remover Cobertura
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-200 font-semibold transition"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center gap-1.5 shadow-xs transition"
            >
              <Check className="w-4 h-4" />
              <span>Confirmar Cobertura</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
