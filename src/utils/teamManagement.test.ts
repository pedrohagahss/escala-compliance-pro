import test from 'node:test';
import assert from 'node:assert/strict';
import { CHAIRS, createBaseEmployees } from '../data/seuCarroData';
import { DEFAULT_STORE_HOURS, ensureEmployeeWeeksSchedule } from './compliance';
import { calculateSectorDailyCoverage } from './coverage';
import {
  buildSectionChairs,
  createNewMember,
  deleteMemberFromTeam,
  generateNextChairId,
  updateMemberProfile,
} from './teamManagement';

test('generateNextChairId gera o próximo código sequencial livre para loja e setor', () => {
  const base = createBaseEmployees();
  assert.equal(generateNextChairId('SDR', 'LOJA_1', base, CHAIRS), 'SDR-5');
  assert.equal(generateNextChairId('VENDAS', 'LOJA_1', base, CHAIRS), 'VEND-L1-5');
  assert.equal(generateNextChairId('FINANCEIRO', 'LOJA_2', base, CHAIRS), 'FIN-2');
});

test('createNewMember, buildSectionChairs e calculateSectorDailyCoverage refletem membro incluído', () => {
  const base = createBaseEmployees().map(ensureEmployeeWeeksSchedule);
  const newSdr = createNewMember(
    {
      name: 'Camila Ferreira Santos',
      role: 'SDR Pré-Vendas',
      contractType: 'CLT_ATIVO',
      department: 'SDR',
      defaultStore: 'LOJA_1',
      saturdayOffWeek: 2,
      weekdayOff: 'QUA',
    },
    base,
    DEFAULT_STORE_HOURS
  );

  assert.equal(newSdr.defaultChairId, 'SDR-5');
  assert.equal(newSdr.shortName, 'Camila');
  assert.equal(newSdr.weeksSchedule![2].SAB.type, 'FOLGA_5X2');
  assert.equal(newSdr.weeksSchedule![1].QUA.type, 'FOLGA_5X2');
  assert.equal(newSdr.weeksSchedule![1].DOM.type, 'FOLGA_DSR');

  const expandedTeam = [...base, newSdr];
  const sdrChairs = buildSectionChairs(
    ['SDR-1', 'SDR-2', 'SDR-3', 'SDR-4'],
    'LOJA_1',
    'SDR',
    expandedTeam,
    CHAIRS
  );
  assert.equal(sdrChairs.length, 5);
  assert.equal(sdrChairs.some((c) => c.id === 'SDR-5'), true);

  // Cobertura dinâmica do setor SDR (Loja 1) deve contabilizar +1 cadeira total e +1 ativo na QUI
  const covBefore = calculateSectorDailyCoverage(base, 'QUI').find(
    (r) => r.sector.storeId === 'LOJA_1' && r.sector.departmentId === 'SDR'
  )!;
  const covRes = calculateSectorDailyCoverage(expandedTeam, 'QUI').find(
    (r) => r.sector.storeId === 'LOJA_1' && r.sector.departmentId === 'SDR'
  )!;
  assert.equal(covRes.totalChairs, covBefore.totalChairs + 1);
  assert.equal(covRes.activeHeadcount, covBefore.activeHeadcount + 1);
});

test('updateMemberProfile atualiza nome curto, muda loja/setor/cadeira e recalcula turno', () => {
  const base = createBaseEmployees().map(ensureEmployeeWeeksSchedule);
  const updatedList = updateMemberProfile(
    base,
    'emp-winona',
    {
      shortName: 'Winona S.',
      defaultStore: 'LOJA_2',
      department: 'FINANCEIRO',
      role: 'Analista Financeira Jr',
    },
    { rebuildScheduleWithStoreHours: true, storeHours: DEFAULT_STORE_HOURS }
  );

  const edited = updatedList.find((e) => e.id === 'emp-winona')!;
  assert.equal(edited.shortName, 'Winona S.');
  assert.equal(edited.defaultStore, 'LOJA_2');
  assert.equal(edited.department, 'FINANCEIRO');
  assert.equal(edited.defaultChairId, 'FIN-2');
  assert.equal(edited.weeksSchedule![1].SEG.chairId, 'FIN-2');
});

test('deleteMemberFromTeam remove colaborador e limpa vínculos e coberturas associadas', () => {
  const base = createBaseEmployees().map(ensureEmployeeWeeksSchedule).map((e) => {
    if (e.id === 'emp-andria') {
      return {
        ...e,
        linkedFolgaIds: ['emp-winona'],
        noParallelFolgaIds: ['emp-winona'],
        affinityPartnerId: 'emp-winona',
        schedule: {
          ...e.schedule,
          SEG: {
            ...e.schedule.SEG,
            coverage: {
              coveredByEmployeeId: 'emp-winona',
              coveredByName: 'Winona Silva',
              coveredByRole: 'SDR',
            },
          },
        },
        weeksSchedule: {
          ...e.weeksSchedule!,
          1: {
            ...e.weeksSchedule![1],
            SEG: {
              ...e.weeksSchedule![1].SEG,
              coverage: {
                coveredByEmployeeId: 'emp-winona',
                coveredByName: 'Winona Silva',
                coveredByRole: 'SDR',
              },
            },
          },
        },
      };
    }
    return e;
  });

  const deleted = deleteMemberFromTeam(base, 'emp-winona');
  assert.equal(deleted.deletedMember?.id, 'emp-winona');
  assert.equal(deleted.employees.some((e) => e.id === 'emp-winona'), false);

  const andriaAfter = deleted.employees.find((e) => e.id === 'emp-andria')!;
  assert.equal(andriaAfter.linkedFolgaIds, undefined);
  assert.equal(andriaAfter.noParallelFolgaIds, undefined);
  assert.equal(andriaAfter.affinityPartnerId, undefined);
  assert.equal(andriaAfter.weeksSchedule![1].SEG.coverage, undefined);

  // buildSectionChairs não deve mais incluir SDR-1 após exclusão da Winona
  const sdrChairsAfter = buildSectionChairs(
    ['SDR-1', 'SDR-2', 'SDR-3', 'SDR-4'],
    'LOJA_1',
    'SDR',
    deleted.employees,
    CHAIRS
  );
  assert.equal(sdrChairsAfter.some((c) => c.id === 'SDR-1'), false);
  assert.equal(sdrChairsAfter.length, 3);
});
