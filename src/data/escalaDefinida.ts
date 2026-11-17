import { DayShift, Employee, Scenario } from '../types/schedule';

/**
 * Escala Inicial — definida em reunião.
 *
 * Esta é a escala oficial em vigor. Ela é gravada aqui (no código) para que não
 * dependa apenas do navegador: qualquer computador que abrir o sistema verá a
 * mesma escala. Quando o arquivo `escalaDefinida.json` estiver preenchido com o
 * cenário exportado pelo botão "Salvar Escala Definida", ele vira a escala padrão.
 */
export const ESCALA_DEFINIDA_ID = 'scen-escala-definida';
export const ESCALA_DEFINIDA_NAME = 'Escala Inicial — Definida em Reunião';
export const ESCALA_DEFINIDA_TAG = 'Escala Inicial (Reunião)';

/** Início da vigência: sábado 21/11/2026. */
export const ESCALA_DEFINIDA_VIGENCIA_ISO = '2026-11-21';

/**
 * Regra do sábado definida em reunião:
 * - Horário formal: 08:00–17:00 com 1h de intervalo (8h líquidas). Na tela da reunião
 *   o sábado foi lançado como "largar às 16h" só porque não dava para marcar o almoço.
 * - É o horário em que o colaborador deve estar à disposição; conforme o movimento do
 *   comércio local, a liderança pode liberar a equipe mais cedo.
 */
export const SABADO_FORMAL = { start: '08:00', end: '17:00', lunchMinutes: 60 } as const;
export const SABADO_LUNCH_SLOTS = ['11:30', '12:30', '13:30'] as const;
export const SABADO_REGRA_TEXTO =
  'Sábado: horário formal 08:00–17:00 com 1h de intervalo (escalonado 11:30 / 12:30 / 13:30). ' +
  'Os colaboradores devem estar à disposição nesse horário; conforme o movimento do comércio local, ' +
  'a liderança pode liberá-los mais cedo.';

const toMin = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
};
const toTime = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

/**
 * Aplica o horário formal de sábado (08:00–17:00 + 1h de almoço) a todo sábado trabalhado
 * por CLT (estagiários mantêm o turno de estágio). Os almoços são escalonados dentro de
 * cada setor para nunca tirar o setor inteiro ao mesmo tempo.
 */
export function applySabadoFormal(scenario: Scenario): Scenario {
  const employees: Employee[] = JSON.parse(JSON.stringify(scenario.employees));
  const weekNumbers = new Set<number>();
  employees.forEach((e) =>
    Object.keys(e.weeksSchedule || {}).forEach((w) => weekNumbers.add(Number(w)))
  );
  if (weekNumbers.size === 0) weekNumbers.add(1);

  const formalize = (shift: DayShift, slotIndex: number): DayShift => {
    const lunchStart = SABADO_LUNCH_SLOTS[slotIndex % SABADO_LUNCH_SLOTS.length];
    return {
      ...shift,
      startTime: SABADO_FORMAL.start,
      endTime: SABADO_FORMAL.end,
      lunchStart,
      lunchEnd: toTime(toMin(lunchStart) + SABADO_FORMAL.lunchMinutes),
      label: `${SABADO_FORMAL.start}–${SABADO_FORMAL.end}`,
      customHours: undefined,
    };
  };

  for (const w of weekNumbers) {
    const slotByDept: Record<string, number> = {};
    for (const emp of employees) {
      if (emp.contractType === 'ESTAGIARIO') continue;
      const week = emp.weeksSchedule?.[w] || (w === 1 ? emp.schedule : undefined);
      const sat = week?.SAB;
      if (!week || !sat || sat.type !== 'TRABALHO') continue;
      const slot = slotByDept[emp.department] ?? 0;
      slotByDept[emp.department] = slot + 1;
      week.SAB = formalize(sat, slot);
      if (w === 1 && emp.weeksSchedule?.[1]) emp.schedule = emp.weeksSchedule[1];
    }
  }

  const storeHours = scenario.storeHours
    ? Object.fromEntries(
        Object.entries(scenario.storeHours).map(([k, v]) => [
          k,
          { ...v, saturdayOpen: SABADO_FORMAL.start, saturdayClose: SABADO_FORMAL.end },
        ])
      )
    : {
        LOJA_1: { weekdayOpen: '08:00', weekdayClose: '17:30', saturdayOpen: SABADO_FORMAL.start, saturdayClose: SABADO_FORMAL.end },
        LOJA_2: { weekdayOpen: '08:00', weekdayClose: '17:30', saturdayOpen: SABADO_FORMAL.start, saturdayClose: SABADO_FORMAL.end },
      };

  return { ...scenario, employees, storeHours: storeHours as Scenario['storeHours'] };
}

// import.meta.glob só existe no build do Vite; em scripts/testes (tsx) fica vazio.
const modules: Record<string, { default: Scenario | Scenario[] }> =
  import.meta.env
    ? import.meta.glob<{ default: Scenario | Scenario[] }>('./escalaDefinida.json', { eager: true })
    : {};

function loadBakedScenario(): Scenario | null {
  const mod = Object.values(modules)[0];
  if (!mod) return null;
  const raw = mod.default;
  const list = Array.isArray(raw) ? raw : [raw];
  const found = list.find((s) => s && s.id === ESCALA_DEFINIDA_ID) || list[0];
  if (!found || !Array.isArray(found.employees) || found.employees.length === 0) return null;
  return {
    ...applySabadoFormal(found),
    id: ESCALA_DEFINIDA_ID,
    name: ESCALA_DEFINIDA_NAME,
    shortTag: ESCALA_DEFINIDA_TAG,
  };
}

/** Escala definida gravada no código (ou null enquanto não for gravada). */
export const BAKED_ESCALA_DEFINIDA: Scenario | null = loadBakedScenario();

/** Cria o cenário "Escala Definida" a partir do cenário atualmente em tela. */
export function snapshotAsEscalaDefinida(source: Scenario): Scenario {
  return {
    ...applySabadoFormal(JSON.parse(JSON.stringify(source))),
    id: ESCALA_DEFINIDA_ID,
    name: ESCALA_DEFINIDA_NAME,
    shortTag: ESCALA_DEFINIDA_TAG,
    description:
      `Escala inicial aprovada em reunião, vigente a partir de sábado 21/11/2026. ${SABADO_REGRA_TEXTO}`,
    createdAt: new Date().toISOString(),
  };
}
