import { Scenario } from '../types/schedule';

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
    ...found,
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
    ...JSON.parse(JSON.stringify(source)),
    id: ESCALA_DEFINIDA_ID,
    name: ESCALA_DEFINIDA_NAME,
    shortTag: ESCALA_DEFINIDA_TAG,
    description:
      'Escala inicial aprovada em reunião. Ponto de partida oficial: ajustes futuros devem partir desta configuração.',
    createdAt: new Date().toISOString(),
  };
}
