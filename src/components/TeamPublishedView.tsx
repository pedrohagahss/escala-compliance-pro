import React, { useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Lock, Printer, Store, User } from 'lucide-react';
import { DepartmentId, Employee, StoreId } from '../types/schedule';
import { BAKED_ESCALA_DEFINIDA, ESCALA_DEFINIDA_VIGENCIA_ISO, SABADO_REGRA_TEXTO } from '../data/escalaDefinida';
import { createDefaultScenarios, DEPARTMENTS } from '../data/seuCarroData';
import { ensureEmployeeWeeksSchedule } from '../utils/compliance';
import {
  addDaysIso,
  getDefaultTodayIso,
  getDayOfWeekForDateIso,
  getEmployeeShiftForDate,
  getFullDateLabelPt,
  getHolidayForDateIso,
} from '../utils/realCalendar';

/**
 * Página "Escala Publicada" para o time (somente leitura).
 * Usa SOMENTE a escala oficial gravada no código — nunca o que está salvo no navegador.
 */

const ME_KEY = 'seu_carro_pe_equipe_eu';
const safeGet = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const safeSet = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* sem armazenamento: só não lembra a escolha */
  }
};

const STORE_LABEL: Record<StoreId, string> = { LOJA_1: 'Matriz 546', LOJA_2: 'Filial 777' };
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
const deptMeta = (d: DepartmentId) => DEPARTMENTS.find((x) => x.id === d);
const WEEKDAY_SHORT = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

function mondayOf(dateIso: string): string {
  const idx = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB', 'DOM'].indexOf(getDayOfWeekForDateIso(dateIso));
  return addDaysIso(dateIso, -idx);
}
const ddmm = (iso: string) => getFullDateLabelPt(iso).brShort.slice(0, 5);

type DayInfo = ReturnType<typeof getEmployeeShiftForDate>;

function describe(info: DayInfo): { kind: 'work' | 'off' | 'dsr' | 'lic'; text: string; lunch?: string } {
  if (info.isLicenca) return { kind: 'lic', text: 'Licença' };
  if (info.isDsr) return { kind: 'dsr', text: 'Descanso (domingo)' };
  if (!info.isWork) return { kind: 'off', text: 'Folga' };
  const s = info.shift;
  return {
    kind: 'work',
    text: `${s.startTime}–${s.endTime}`,
    lunch: s.lunchStart ? `almoço ${s.lunchStart}–${s.lunchEnd}` : undefined,
  };
}

export const TeamPublishedView: React.FC = () => {
  const team: Employee[] = useMemo(() => {
    const source = BAKED_ESCALA_DEFINIDA || createDefaultScenarios()[0];
    return source.employees
      .map(ensureEmployeeWeeksSchedule)
      .filter((e) => !e.isCirculating)
      .sort((a, b) => a.shortName.localeCompare(b.shortName, 'pt-BR'));
  }, []);

  const todayIso = useMemo(() => getDefaultTodayIso(), []);
  const [meId, setMeId] = useState<string>(() => {
    const saved = safeGet(ME_KEY);
    return saved && team.some((e) => e.id === saved) ? saved : '';
  });
  const me = team.find((e) => e.id === meId);
  const [dayIso, setDayIso] = useState<string>(() =>
    todayIso < ESCALA_DEFINIDA_VIGENCIA_ISO ? ESCALA_DEFINIDA_VIGENCIA_ISO : todayIso
  );
  const [weekStart, setWeekStart] = useState<string>(() => mondayOf(dayIso));

  const chooseMe = (id: string) => {
    setMeId(id);
    safeSet(ME_KEY, id);
  };

  // Minhas próximas 5 semanas (a partir da semana atual)
  const myWeeks = useMemo(() => {
    if (!me) return [];
    const start = mondayOf(todayIso);
    return Array.from({ length: 5 }, (_, w) => {
      const days = Array.from({ length: 7 }, (_, d) => {
        const iso = addDaysIso(start, w * 7 + d);
        const info = getEmployeeShiftForDate(me, iso);
        return { iso, info, desc: describe(info), holiday: getHolidayForDateIso(iso) };
      });
      return { start: addDaysIso(start, w * 7), cycleWeek: days[0].info.cycleWeek, days };
    });
  }, [me, todayIso]);

  const nextFolgas = useMemo(() => {
    if (!me) return [];
    const out: string[] = [];
    for (let i = 0; i < 60 && out.length < 4; i++) {
      const iso = addDaysIso(todayIso, i);
      if (getEmployeeShiftForDate(me, iso).isFolga5x2) out.push(iso);
    }
    return out;
  }, [me, todayIso]);

  // Quem está na loja no dia escolhido
  const dayBoard = useMemo(() => {
    const rows = team.map((e) => ({ e, info: getEmployeeShiftForDate(e, dayIso) }));
    return (['LOJA_1', 'LOJA_2'] as StoreId[]).map((store) => ({
      store,
      depts: DEPT_ORDER.map((dept) => ({
        dept,
        people: rows.filter((r) => r.e.defaultStore === store && r.e.department === dept),
      })).filter((g) => g.people.length > 0),
    }));
  }, [team, dayIso]);

  // Folgas da semana escolhida
  const weekFolgas = useMemo(
    () =>
      Array.from({ length: 6 }, (_, d) => {
        const iso = addDaysIso(weekStart, d);
        return {
          iso,
          holiday: getHolidayForDateIso(iso),
          off: team.filter((e) => getEmployeeShiftForDate(e, iso).isFolga5x2),
        };
      }),
    [team, weekStart]
  );
  const weekCycle = getEmployeeShiftForDate(team[0], weekStart).cycleWeek;

  const dayLabel = getFullDateLabelPt(dayIso);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="bg-slate-900 text-white">
        <div className="max-w-5xl mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-extrabold tracking-tight">Escala da Equipe — Seu Carro PE</h1>
            <p className="text-xs text-slate-300 flex items-center gap-1.5 mt-0.5">
              <Lock className="w-3 h-3" /> Escala publicada pela gerência · vigente desde 21/11/2026 · somente
              consulta
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="no-print inline-flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-bold cursor-pointer"
          >
            <Printer className="w-4 h-4" /> Imprimir
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-4 space-y-4">
        <p className="text-xs text-slate-600 bg-white border border-slate-200 px-3 py-2">{SABADO_REGRA_TEXTO}</p>

        {/* Minha escala */}
        <section className="bg-white border border-slate-300" aria-label="Minha escala">
          <div className="px-4 py-3 border-b border-slate-200 flex flex-wrap items-center gap-3">
            <User className="w-4 h-4 text-blue-600" />
            <label htmlFor="eu" className="text-sm font-bold">
              Quem é você?
            </label>
            <select
              id="eu"
              value={meId}
              onChange={(e) => chooseMe(e.target.value)}
              className="flex-1 min-w-[180px] max-w-xs px-2 py-1.5 border border-slate-300 bg-white text-sm font-semibold"
            >
              <option value="">Escolha seu nome</option>
              {team
                .filter((e) => e.contractType !== 'LICENCA_MATERNIDADE')
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.shortName}
                  </option>
                ))}
            </select>
          </div>

          {me ? (
            <div className="p-4 space-y-4">
              <div className="grid sm:grid-cols-2 gap-3">
                {(() => {
                  const d = describe(getEmployeeShiftForDate(me, todayIso));
                  return (
                    <div
                      className={`border px-3 py-2.5 ${
                        d.kind === 'work' ? 'border-blue-200 bg-blue-50' : 'border-emerald-200 bg-emerald-50'
                      }`}
                    >
                      <div className="text-[11px] uppercase font-bold text-slate-500">
                        Hoje · {getFullDateLabelPt(todayIso).weekdayShort} {ddmm(todayIso)}
                      </div>
                      <div className="text-xl font-extrabold font-mono">{d.text}</div>
                      {d.lunch && <div className="text-xs text-slate-600">{d.lunch}</div>}
                    </div>
                  );
                })()}
                <div className="border border-emerald-200 bg-emerald-50 px-3 py-2.5">
                  <div className="text-[11px] uppercase font-bold text-slate-500">Próximas folgas</div>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {nextFolgas.map((iso) => (
                      <span key={iso} className="px-2 py-0.5 bg-emerald-600 text-white text-xs font-bold">
                        {getFullDateLabelPt(iso).weekdayShort} {ddmm(iso)}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="border border-slate-200 px-2 py-1.5 text-left">Semana</th>
                      {WEEKDAY_SHORT.map((d) => (
                        <th key={d} className="border border-slate-200 px-2 py-1.5">
                          {d}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {myWeeks.map((w) => (
                      <tr key={w.start}>
                        <td className="border border-slate-200 px-2 py-1.5 font-bold whitespace-nowrap">
                          S{w.cycleWeek}
                          <div className="font-normal text-slate-500">{ddmm(w.start)}</div>
                        </td>
                        {w.days.map(({ iso, desc, holiday }) => (
                          <td
                            key={iso}
                            className={`border border-slate-200 px-1.5 py-1.5 text-center align-top ${
                              iso === todayIso ? 'outline-2 outline-blue-500 -outline-offset-2' : ''
                            } ${
                              desc.kind === 'off'
                                ? 'bg-emerald-600 text-white'
                                : desc.kind === 'work'
                                  ? 'bg-white'
                                  : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            <div className="text-[10px] opacity-70">{ddmm(iso)}</div>
                            <div className="font-bold font-mono">
                              {desc.kind === 'off' ? 'FOLGA' : desc.kind === 'dsr' ? 'DSR' : desc.text}
                            </div>
                            {desc.lunch && (
                              <div className="text-[10px] text-slate-500">{desc.lunch.replace('almoço ', 'alm. ')}</div>
                            )}
                            {holiday && (
                              <div className="text-[9px] font-bold text-rose-700 bg-rose-50 mt-0.5">
                                {holiday.shortName.replace(/^Feriado:\s*/, '')}
                              </div>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="p-4 text-sm text-slate-500">
              Escolha seu nome para ver seus horários, almoço e folgas das próximas semanas.
            </p>
          )}
        </section>

        {/* Na loja no dia */}
        <section className="bg-white border border-slate-300" aria-label="Quem está na loja">
          <div className="px-4 py-3 border-b border-slate-200 flex flex-wrap items-center gap-2">
            <Store className="w-4 h-4 text-blue-600" />
            <h2 className="text-sm font-bold flex-1">
              Na loja · {dayLabel.weekdayFull}, {ddmm(dayIso)}
              {getHolidayForDateIso(dayIso) && (
                <span className="ml-2 text-rose-700">★ {getHolidayForDateIso(dayIso)!.shortName}</span>
              )}
            </h2>
            <button
              type="button"
              aria-label="Dia anterior"
              onClick={() => setDayIso(addDaysIso(dayIso, -1))}
              className="no-print p-1.5 border border-slate-300 hover:bg-slate-100 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              aria-label="Próximo dia"
              onClick={() => setDayIso(addDaysIso(dayIso, 1))}
              className="no-print p-1.5 border border-slate-300 hover:bg-slate-100 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="p-4 grid md:grid-cols-2 gap-4">
            {dayBoard.map(({ store, depts }) => (
              <div key={store} className="space-y-2">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">{STORE_LABEL[store]}</h3>
                {depts.map(({ dept, people }) => (
                  <div key={dept} className="border-l-4 pl-2.5" style={{ borderColor: deptMeta(dept)?.badgeColor }}>
                    <div className="text-xs font-bold text-slate-700">{deptMeta(dept)?.name || dept}</div>
                    <ul className="text-xs space-y-0.5 mt-0.5">
                      {people.map(({ e, info }) => {
                        const d = describe(info);
                        return (
                          <li key={e.id} className="flex justify-between gap-2">
                            <span className={d.kind === 'work' ? 'font-semibold' : 'text-slate-400'}>{e.shortName}</span>
                            <span
                              className={`font-mono ${
                                d.kind === 'work' ? 'text-slate-700' : d.kind === 'off' ? 'text-emerald-700 font-bold' : 'text-slate-400'
                              }`}
                            >
                              {d.kind === 'work' ? `${d.text}${d.lunch ? ` · ${d.lunch.replace('almoço ', 'alm. ')}` : ''}` : d.text}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>

        {/* Folgas da semana */}
        <section className="bg-white border border-slate-300" aria-label="Folgas da semana">
          <div className="px-4 py-3 border-b border-slate-200 flex flex-wrap items-center gap-2">
            <CalendarDays className="w-4 h-4 text-blue-600" />
            <h2 className="text-sm font-bold flex-1">
              Folgas da semana S{weekCycle} · {ddmm(weekStart)} a {ddmm(addDaysIso(weekStart, 6))}
            </h2>
            <button
              type="button"
              aria-label="Semana anterior"
              onClick={() => setWeekStart(addDaysIso(weekStart, -7))}
              className="no-print p-1.5 border border-slate-300 hover:bg-slate-100 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              aria-label="Próxima semana"
              onClick={() => setWeekStart(addDaysIso(weekStart, 7))}
              className="no-print p-1.5 border border-slate-300 hover:bg-slate-100 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px bg-slate-200">
            {weekFolgas.map(({ iso, holiday, off }) => (
              <div key={iso} className="bg-white p-2.5 min-h-[90px]">
                <div className="text-xs font-bold">
                  {getFullDateLabelPt(iso).weekdayShort} {ddmm(iso)}
                </div>
                {holiday && <div className="text-[10px] font-bold text-rose-700">★ {holiday.shortName}</div>}
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {off.length === 0 && <span className="text-[11px] text-slate-400">Ninguém de folga</span>}
                  {off.map((e) => (
                    <span
                      key={e.id}
                      className={`px-1.5 py-0.5 text-[11px] font-bold border ${
                        e.id === meId ? 'bg-emerald-600 text-white border-emerald-600' : 'border-emerald-300 text-emerald-800'
                      }`}
                    >
                      {e.shortName}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="px-4 py-2 text-[11px] text-slate-500 border-t border-slate-200">Domingo: descanso de todos (DSR).</p>
        </section>

        <p className="text-[11px] text-slate-400 text-center pb-4">
          Dúvidas sobre sua escala? Fale com a gerência (Pedro, Edvania, Igor ou Lorena).
        </p>
      </main>
    </div>
  );
};
