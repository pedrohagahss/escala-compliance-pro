import React, { useMemo, useState } from 'react';
import { Check, Pencil, X } from 'lucide-react';
import {
  DepartmentId,
  Employee,
  StoreHoursMap,
  StoreId,
  StoreOperatingHours,
} from '../types/schedule';
import { CHAIRS, DEPARTMENTS } from '../data/seuCarroData';
import { DEFAULT_STORE_HOURS } from '../utils/compliance';
import { getEmployeeShiftForDate, getFullDateLabelPt } from '../utils/realCalendar';

interface StoreTopStripProps {
  storeHours: StoreHoursMap;
  onApplyStoreHours: (storeId: StoreId, hours: StoreOperatingHours) => void;
  employees: Employee[];
  dateIso: string;
}

const STORES: { id: StoreId; label: string }[] = [
  { id: 'LOJA_1', label: 'Matriz' },
  { id: 'LOJA_2', label: 'Filial' },
];

const DEPT_ORDER: DepartmentId[] = [
  'SDR',
  'VENDAS',
  'PREPARACAO',
  'MARKETING',
  'DOCUMENTACAO',
  'SUCESSO_CLIENTE',
  'FINANCEIRO',
  'GESTAO',
];
const deptColor = (d: DepartmentId) => DEPARTMENTS.find((x) => x.id === d)?.badgeColor || '#64748b';
const deptName = (d: DepartmentId) => DEPARTMENTS.find((x) => x.id === d)?.name || d;
const chairStore = new Map(CHAIRS.map((c) => [c.id, c.store]));

const timeInput =
  'w-[84px] px-1 py-0.5 bg-white border border-slate-300 font-mono text-[11px] font-bold text-slate-900 focus:border-blue-500 focus:outline-none';

/**
 * Faixa compacta do topo: horário de abertura/fechamento das lojas (editável)
 * e um minimapa com um ponto por colaborador na data ativa.
 */
export const StoreTopStrip: React.FC<StoreTopStripProps> = ({
  storeHours,
  onApplyStoreHours,
  employees,
  dateIso,
}) => {
  const [editing, setEditing] = useState<StoreId | null>(null);
  const [draft, setDraft] = useState<StoreOperatingHours | null>(null);

  const dateLabel = getFullDateLabelPt(dateIso);

  // Onde cada colaborador está na data ativa (a cobertura pode mudar a loja do dia)
  const dots = useMemo(() => {
    return employees.map((emp) => {
      const info = getEmployeeShiftForDate(emp, dateIso);
      const store = (info.isWork && chairStore.get(info.effectiveChairId)) || emp.defaultStore;
      const status = info.isLicenca
        ? 'licenca'
        : info.isWork
          ? 'work'
          : 'off';
      const detail = info.isWork
        ? `${info.shift.startTime}–${info.shift.endTime}${
            info.shift.lunchStart ? ` · almoço ${info.shift.lunchStart}–${info.shift.lunchEnd}` : ''
          }`
        : info.isLicenca
          ? 'Licença'
          : info.isDsr
            ? 'DSR (domingo)'
            : 'Folga 5x2';
      return { emp, store, status, detail, cycleWeek: info.cycleWeek };
    });
  }, [employees, dateIso]);

  const cycleWeek = dots[0]?.cycleWeek;
  const workingCount = dots.filter((d) => d.status === 'work').length;

  const startEdit = (id: StoreId) => {
    setEditing(id);
    setDraft({ ...(storeHours[id] || DEFAULT_STORE_HOURS[id]) });
  };

  return (
    <section
      aria-label="Horário das lojas e mapa da equipe"
      className="no-print bg-white border border-slate-300 px-3 py-1.5 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[11px]"
    >
      {/* Horário das lojas */}
      {STORES.map(({ id, label }) => {
        const cfg = storeHours[id] || DEFAULT_STORE_HOURS[id];
        const isEditing = editing === id && draft;
        return (
          <div key={id} className="flex items-center gap-1.5" data-top-store-hours={id}>
            <span className="font-extrabold text-slate-900 uppercase tracking-wide text-[10px]">
              {label}
            </span>
            {isEditing ? (
              <>
                <span className="text-slate-500">Seg–Sex</span>
                <input
                  type="time"
                  aria-label={`${label} abertura seg–sex`}
                  className={timeInput}
                  value={draft.weekdayOpen}
                  onChange={(e) => setDraft({ ...draft, weekdayOpen: e.target.value })}
                />
                <input
                  type="time"
                  aria-label={`${label} fechamento seg–sex`}
                  className={timeInput}
                  value={draft.weekdayClose}
                  onChange={(e) => setDraft({ ...draft, weekdayClose: e.target.value })}
                />
                <span className="text-slate-500">Sáb</span>
                <input
                  type="time"
                  aria-label={`${label} abertura sábado`}
                  className={timeInput}
                  value={draft.saturdayOpen}
                  onChange={(e) => setDraft({ ...draft, saturdayOpen: e.target.value })}
                />
                <input
                  type="time"
                  aria-label={`${label} fechamento sábado`}
                  className={timeInput}
                  value={draft.saturdayClose}
                  onChange={(e) => setDraft({ ...draft, saturdayClose: e.target.value })}
                />
                <button
                  type="button"
                  title={`Aplicar na ${label} (S1–S4)`}
                  aria-label={`Aplicar horário na ${label}`}
                  onClick={() => {
                    onApplyStoreHours(id, draft);
                    setEditing(null);
                  }}
                  className="p-1 bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
                >
                  <Check className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  title="Cancelar"
                  aria-label="Cancelar edição de horário"
                  onClick={() => setEditing(null)}
                  className="p-1 border border-slate-300 hover:bg-slate-100 text-slate-600 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => startEdit(id)}
                title={`Editar abertura e fechamento da ${label}`}
                className="inline-flex items-center gap-1 font-mono text-slate-700 hover:text-blue-700 cursor-pointer"
              >
                <span>
                  {cfg.weekdayOpen}–{cfg.weekdayClose}
                </span>
                <span className="text-slate-400">·</span>
                <span>
                  Sáb {cfg.saturdayOpen}–{cfg.saturdayClose}
                </span>
                <Pencil className="w-2.5 h-2.5 text-slate-400" />
              </button>
            )}
          </div>
        );
      })}

      {/* Minimapa da equipe */}
      <div className="flex items-center gap-2 ml-auto" data-team-minimap="true">
        <span className="text-slate-500 whitespace-nowrap">
          <strong className="text-slate-800">
            {dateLabel.weekdayShort} {dateLabel.brShort.slice(0, 5)}
          </strong>
          {cycleWeek ? ` · S${cycleWeek}` : ''} · {workingCount} em serviço
        </span>
        {STORES.map(({ id, label }) => {
          const here = dots.filter((d) => d.store === id);
          const depts = DEPT_ORDER.filter((dep) => here.some((d) => d.emp.department === dep));
          return (
            <div
              key={id}
              className="flex items-center gap-1 border border-slate-300 bg-slate-50 px-1.5 py-1"
              title={label}
            >
              <span className="text-[9px] font-bold text-slate-500 uppercase">{label.slice(0, 3)}</span>
              {depts.map((dep) => (
                <span
                  key={dep}
                  className="flex items-center gap-[3px] px-1 border-l border-slate-200 first:border-l-0"
                  title={deptName(dep)}
                >
                  {here
                    .filter((d) => d.emp.department === dep)
                    .map((d) => (
                      <span
                        key={d.emp.id}
                        title={`${d.emp.shortName} — ${d.detail}`}
                        aria-label={`${d.emp.shortName}: ${d.detail}`}
                        className="block w-2 h-2 rounded-full"
                        style={
                          d.status === 'work'
                            ? { background: deptColor(dep) }
                            : d.status === 'licenca'
                              ? { background: '#cbd5e1' }
                              : { border: `1.5px solid ${deptColor(dep)}`, opacity: 0.55 }
                        }
                      />
                    ))}
                </span>
              ))}
            </div>
          );
        })}
        <span className="hidden xl:inline text-[10px] text-slate-400 whitespace-nowrap">
          ● em serviço ○ folga
        </span>
      </div>
    </section>
  );
};
