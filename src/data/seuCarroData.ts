import {
  ChairDefinition,
  DepartmentId,
  Employee,
  Scenario,
  StoreId,
} from '../types/schedule';
import { ensureEmployeeWeeksSchedule } from '../utils/compliance';
import { createOptimizedScenarios } from '../utils/scenarioProposals';
import { BAKED_ESCALA_DEFINIDA } from './escalaDefinida';

export const STORES: { id: StoreId; name: string; subtitle: string; code: string }[] = [
  {
    id: 'LOJA_1',
    name: 'Loja 1 — Matriz 546',
    subtitle: 'Showroom Principal, Pátio e Base da Preparação',
    code: 'L1-MATRIZ',
  },
  {
    id: 'LOJA_2',
    name: 'Loja 2 — Filial 777',
    subtitle: 'Compras de Veículos, Atendimento, Pós-Venda e Serviços',
    code: 'L2-FILIAL',
  },
];

export const DEPARTMENTS: {
  id: DepartmentId;
  name: string;
  badgeColor: string;
  shortDesc: string;
}[] = [
  { id: 'SDR', name: 'SDRs (Pré-vendas)', badgeColor: '#2563EB', shortDesc: 'Atendimento inicial e qualificação de leads' },
  { id: 'VENDAS', name: 'Vendedores (Pátio)', badgeColor: '#059669', shortDesc: 'Negociação e fechamento presencial' },
  { id: 'PREPARACAO', name: 'Preparação & Zeladoria', badgeColor: '#D97706', shortDesc: 'Estoque, higienização e abertura/fechamento' },
  { id: 'DOCUMENTACAO', name: 'Documentação / Pós-Venda', badgeColor: '#7C3AED', shortDesc: 'DETRAN, transferências e OS' },
  { id: 'FINANCEIRO', name: 'Financeiro / Pagamentos', badgeColor: '#DB2777', shortDesc: 'Caixa, liquidações e fechamento bancário' },
  { id: 'SUCESSO_CLIENTE', name: 'Sucesso do Cliente', badgeColor: '#0891B2', shortDesc: 'Assistência técnica e relacionamento' },
  { id: 'MARKETING', name: 'Marketing & Conteúdo', badgeColor: '#4F46E5', shortDesc: 'Social media, fotos e campanhas' },
  { id: 'GESTAO', name: 'Liderança Volante', badgeColor: '#475569', shortDesc: 'Gestão executiva e suporte operacional' },
];

export const CHAIRS: ChairDefinition[] = [
  // Loja 1 — Matriz 546
  { id: 'SDR-1', code: 'SDR-1', name: 'Baia SDR 1 (Winona)', store: 'LOJA_1', department: 'SDR', description: 'Sala de SDRs — Posição 1' },
  { id: 'SDR-2', code: 'SDR-2', name: 'Baia SDR 2 (Andria)', store: 'LOJA_1', department: 'SDR', description: 'Sala de SDRs — Posição 2' },
  { id: 'SDR-3', code: 'SDR-3', name: 'Baia SDR 3 (Diana)', store: 'LOJA_1', department: 'SDR', description: 'Sala de SDRs — Posição 3' },
  { id: 'SDR-4', code: 'SDR-4', name: 'Baia SDR 4 (Adriane)', store: 'LOJA_1', department: 'SDR', description: 'Sala de SDRs — Posição 4' },

  { id: 'VEND-L1-1', code: 'VEND-L1-1', name: 'Mesa Pátio 1 (Jair)', store: 'LOJA_1', department: 'VENDAS', description: 'Pátio de Vendas — Mesa 1' },
  { id: 'VEND-L1-2', code: 'VEND-L1-2', name: 'Mesa Pátio 2 (João Alexandre)', store: 'LOJA_1', department: 'VENDAS', description: 'Pátio de Vendas — Mesa 2' },
  { id: 'VEND-L1-3', code: 'VEND-L1-3', name: 'Mesa Pátio 3 (Marcos Antonio)', store: 'LOJA_1', department: 'VENDAS', description: 'Pátio de Vendas — Mesa 3' },
  { id: 'VEND-L1-4', code: 'VEND-L1-4', name: 'Mesa Pátio 4 (Rayssa)', store: 'LOJA_1', department: 'VENDAS', description: 'Pátio de Vendas — Mesa 4' },

  { id: 'PREP-1', code: 'PREP-1', name: 'Posto Preparação 1 (Allisson)', store: 'LOJA_1', department: 'PREPARACAO', description: 'Supervisão de Preparação e Assistência' },
  { id: 'PREP-2', code: 'PREP-2', name: 'Posto Preparação 2 (Rodolfo)', store: 'LOJA_1', department: 'PREPARACAO', description: 'Organização de Loja e Assistência' },
  { id: 'PREP-3', code: 'PREP-3', name: 'Posto Preparação 3 (Marcos Florentino)', store: 'LOJA_1', department: 'PREPARACAO', description: 'Zeladoria, Abertura e Fechamento' },
  { id: 'PREP-4', code: 'PREP-4', name: 'Posto Preparação 4 (Alefy)', store: 'LOJA_1', department: 'PREPARACAO', description: 'Zeladoria, Abertura e Fechamento' },

  { id: 'VEND-L1-5', code: 'VEND-L1-5', name: 'Mesa Pátio 5 (Jorginho)', store: 'LOJA_1', department: 'VENDAS', description: 'Pátio de Vendas — Mesa 5' },
  { id: 'VEND-L1-6', code: 'VEND-L1-6', name: 'Mesa Pátio 6 (Marcos Antonio)', store: 'LOJA_1', department: 'VENDAS', description: 'Pátio de Vendas — Mesa 6' },

  { id: 'MKT-1', code: 'MKT-1', name: 'Mesa Marketing (Nailson)', store: 'LOJA_1', department: 'MARKETING', description: 'Social Media e Produção de Conteúdo' },

  // Loja 2 — Filial 777
  { id: 'VEND-L2-EXT', code: 'VEND-L2-EXT', name: 'Cadeira Vendedor Externo (sem titular)', store: 'LOJA_2', department: 'VENDAS', description: 'Atendimento presencial na área externa da Filial', isExternalOrRotating: true },
  { id: 'DOC-SUP', code: 'DOC-SUP', name: 'Baia Documentação (Marielly)', store: 'LOJA_2', department: 'DOCUMENTACAO', description: 'Supervisão de DETRAN e Pagamentos' },
  { id: 'DOC-AUX', code: 'DOC-AUX', name: 'Baia Documentação (Mayana)', store: 'LOJA_2', department: 'DOCUMENTACAO', description: 'Processamento de Transferências e NFs' },
  { id: 'DOC-EST', code: 'DOC-EST', name: 'Baia Estágio (Matheus Coutinho)', store: 'LOJA_2', department: 'DOCUMENTACAO', description: 'Abertura de OS e Apoio (Tarde)' },
  { id: 'SC-1', code: 'SC-1', name: 'Baia Sucesso do Cliente (Jorge Vinicius)', store: 'LOJA_2', department: 'SUCESSO_CLIENTE', description: 'Assistência Técnica (Cobrindo Grazy)' },
  { id: 'FIN-1', code: 'FIN-1', name: 'Escritório 2 — Financeiro (João Pedro)', store: 'LOJA_2', department: 'FINANCEIRO', description: 'Controle de Caixa e Pagamentos' },
];

export const LEADERSHIP_TEAM = [
  { name: 'Lorena Maria Reis', role: 'Gerente Geral', focus: 'Articula todos os setores na Loja 1 (Preparação, SDR, Vendas e Marketing). Não costuma vir aos sábados.' },
  { name: 'Edvania Maria', role: 'Gerente Comercial', focus: 'Apoia Vendedores e SDRs na Loja 1. Não costuma vir aos sábados.' },
  { name: 'Pedro Henrique', role: 'Sócio / Processos e TI', focus: 'Escritório 2 na Loja 2. Sem horário fixo; não costuma vir aos sábados.' },
  { name: 'Igor Rafael', role: 'Sócio Administrador / Marketing e Pagamentos', focus: 'Marketing (câmeras/conteúdo) e pagamentos de compras. Não costuma vir aos sábados.' },
  { name: 'Aníbal', role: 'Qualidade / NFs / Externo', focus: 'Escritório 2 na Loja 2. Inspeção de qualidade, NFs e demandas externas de DETRAN/Cartório.' },
];

/**
 * Cria a equipe base completa com as 20 pessoas ativas + 1 licença
 * Horário padrão nos dias úteis: 08:00 às 17:30 com 1h30 de almoço (exatamente 8h00 de trabalho líquido).
 */
export function createBaseEmployees(): Employee[] {
  return [
    // ==============================================================
    // LOJA 1 — MATRIZ 546: SDRs (Pré-Vendas)
    // ==============================================================
    {
      id: 'emp-winona',
      name: 'Winona (Nona)',
      shortName: 'Winona',
      role: 'SDR (Pré-vendas)',
      contractType: 'CLT_ATIVO',
      department: 'SDR',
      defaultStore: 'LOJA_1',
      defaultChairId: 'SDR-1',
      badgeColor: '#2563EB',
      defaultLunchStart: '13:00',
      defaultLunchEnd: '14:30',
      affinityPartnerId: 'emp-joao-alexandre',
      rulesAndRestrictions: 'Afinidade: folga preferencialmente junto com João Alexandre (Vendedor).',
      schedule: {
        SEG: { day: 'SEG', type: 'TRABALHO', chairId: 'SDR-1', startTime: '08:00', lunchStart: '13:00', lunchEnd: '14:30', endTime: '17:30' },
        TER: { day: 'TER', type: 'TRABALHO', chairId: 'SDR-1', startTime: '08:00', lunchStart: '13:00', lunchEnd: '14:30', endTime: '17:30' },
        QUA: { day: 'QUA', type: 'TRABALHO', chairId: 'SDR-1', startTime: '08:00', lunchStart: '13:00', lunchEnd: '14:30', endTime: '17:30' },
        QUI: { day: 'QUI', type: 'TRABALHO', chairId: 'SDR-1', startTime: '08:00', lunchStart: '13:00', lunchEnd: '14:30', endTime: '17:30' },
        SEX: { day: 'SEX', type: 'TRABALHO', chairId: 'SDR-1', startTime: '08:00', lunchStart: '13:00', lunchEnd: '14:30', endTime: '17:30' },
        SAB: { day: 'SAB', type: 'FOLGA_5X2', chairId: 'SDR-1' },
        DOM: { day: 'DOM', type: 'FOLGA_DSR', chairId: 'SDR-1' },
      },
    },
    {
      id: 'emp-andria',
      name: 'Andria Helen',
      shortName: 'Andria',
      role: 'SDR (Pré-vendas)',
      contractType: 'CLT_ATIVO',
      department: 'SDR',
      defaultStore: 'LOJA_1',
      defaultChairId: 'SDR-2',
      badgeColor: '#2563EB',
      defaultLunchStart: '12:00',
      defaultLunchEnd: '13:30',
      affinityPartnerId: 'emp-joao-pedro',
      rulesAndRestrictions: 'Segunda-feira é crítica (acúmulo de leads de fim de semana). Afinidade com João Pedro.',
      schedule: {
        SEG: { day: 'SEG', type: 'TRABALHO', chairId: 'SDR-2', startTime: '08:00', lunchStart: '12:00', lunchEnd: '13:30', endTime: '17:30' },
        TER: { day: 'TER', type: 'TRABALHO', chairId: 'SDR-2', startTime: '08:00', lunchStart: '12:00', lunchEnd: '13:30', endTime: '17:30' },
        QUA: { day: 'QUA', type: 'TRABALHO', chairId: 'SDR-2', startTime: '08:00', lunchStart: '12:00', lunchEnd: '13:30', endTime: '17:30' },
        QUI: { day: 'QUI', type: 'TRABALHO', chairId: 'SDR-2', startTime: '08:00', lunchStart: '12:00', lunchEnd: '13:30', endTime: '17:30' },
        SEX: { day: 'SEX', type: 'TRABALHO', chairId: 'SDR-2', startTime: '08:00', lunchStart: '12:00', lunchEnd: '13:30', endTime: '17:30' },
        SAB: { day: 'SAB', type: 'FOLGA_5X2', chairId: 'SDR-2' },
        DOM: { day: 'DOM', type: 'FOLGA_DSR', chairId: 'SDR-2' },
      },
    },
    {
      id: 'emp-diana',
      name: 'Diana Kelly',
      shortName: 'Diana',
      role: 'SDR (Pré-vendas)',
      contractType: 'CLT_ATIVO',
      department: 'SDR',
      defaultStore: 'LOJA_1',
      defaultChairId: 'SDR-3',
      badgeColor: '#2563EB',
      defaultLunchStart: '11:30',
      defaultLunchEnd: '13:00',
      rulesAndRestrictions: 'Sem restrições de escala.',
      schedule: {
        SEG: { day: 'SEG', type: 'TRABALHO', chairId: 'SDR-3', startTime: '08:00', lunchStart: '11:30', lunchEnd: '13:00', endTime: '17:30' },
        TER: { day: 'TER', type: 'TRABALHO', chairId: 'SDR-3', startTime: '08:00', lunchStart: '11:30', lunchEnd: '13:00', endTime: '17:30' },
        QUA: { day: 'QUA', type: 'TRABALHO', chairId: 'SDR-3', startTime: '08:00', lunchStart: '11:30', lunchEnd: '13:00', endTime: '17:30' },
        QUI: { day: 'QUI', type: 'TRABALHO', chairId: 'SDR-3', startTime: '08:00', lunchStart: '11:30', lunchEnd: '13:00', endTime: '17:30' },
        SEX: { day: 'SEX', type: 'TRABALHO', chairId: 'SDR-3', startTime: '08:00', lunchStart: '11:30', lunchEnd: '13:00', endTime: '17:30' },
        SAB: { day: 'SAB', type: 'FOLGA_5X2', chairId: 'SDR-3' },
        DOM: { day: 'DOM', type: 'FOLGA_DSR', chairId: 'SDR-3' },
      },
    },
    {
      id: 'emp-adriane',
      name: 'Adriane Gabrielle',
      shortName: 'Adriane',
      role: 'SDR (Pré-vendas)',
      contractType: 'CLT_ATIVO',
      department: 'SDR',
      defaultStore: 'LOJA_1',
      defaultChairId: 'SDR-4',
      badgeColor: '#2563EB',
      defaultLunchStart: '12:30',
      defaultLunchEnd: '14:00',
      rulesAndRestrictions: 'Admissão recente (nov/2026). Sem restrições de escala.',
      schedule: {
        SEG: { day: 'SEG', type: 'TRABALHO', chairId: 'SDR-4', startTime: '08:00', lunchStart: '12:30', lunchEnd: '14:00', endTime: '17:30' },
        TER: { day: 'TER', type: 'TRABALHO', chairId: 'SDR-4', startTime: '08:00', lunchStart: '12:30', lunchEnd: '14:00', endTime: '17:30' },
        QUA: { day: 'QUA', type: 'TRABALHO', chairId: 'SDR-4', startTime: '08:00', lunchStart: '12:30', lunchEnd: '14:00', endTime: '17:30' },
        QUI: { day: 'QUI', type: 'TRABALHO', chairId: 'SDR-4', startTime: '08:00', lunchStart: '12:30', lunchEnd: '14:00', endTime: '17:30' },
        SEX: { day: 'SEX', type: 'TRABALHO', chairId: 'SDR-4', startTime: '08:00', lunchStart: '12:30', lunchEnd: '14:00', endTime: '17:30' },
        SAB: { day: 'SAB', type: 'FOLGA_5X2', chairId: 'SDR-4' },
        DOM: { day: 'DOM', type: 'FOLGA_DSR', chairId: 'SDR-4' },
      },
    },

    // ==============================================================
    // LOJA 1 — MATRIZ 546: Vendedores (Pátio)
    // ==============================================================
    {
      id: 'emp-jair',
      name: 'Jair',
      shortName: 'Jair',
      role: 'Consultor de Vendas',
      contractType: 'CLT_ATIVO',
      department: 'VENDAS',
      defaultStore: 'LOJA_1',
      defaultChairId: 'VEND-L1-1',
      badgeColor: '#059669',
      defaultLunchStart: '11:30',
      defaultLunchEnd: '13:00',
      rulesAndRestrictions: 'Entrou no lugar de Denny; atende no Pátio e faz rodízio na Loja 2.',
      schedule: {
        SEG: { day: 'SEG', type: 'TRABALHO', chairId: 'VEND-L1-1', startTime: '08:00', lunchStart: '11:30', lunchEnd: '13:00', endTime: '17:30' },
        TER: { day: 'TER', type: 'TRABALHO', chairId: 'VEND-L1-1', startTime: '08:00', lunchStart: '11:30', lunchEnd: '13:00', endTime: '17:30' },
        QUA: { day: 'QUA', type: 'TRABALHO', chairId: 'VEND-L1-1', startTime: '08:00', lunchStart: '11:30', lunchEnd: '13:00', endTime: '17:30' },
        QUI: { day: 'QUI', type: 'TRABALHO', chairId: 'VEND-L1-1', startTime: '08:00', lunchStart: '11:30', lunchEnd: '13:00', endTime: '17:30' },
        SEX: { day: 'SEX', type: 'TRABALHO', chairId: 'VEND-L1-1', startTime: '08:00', lunchStart: '11:30', lunchEnd: '13:00', endTime: '17:30' },
        SAB: { day: 'SAB', type: 'FOLGA_5X2', chairId: 'VEND-L1-1' },
        DOM: { day: 'DOM', type: 'FOLGA_DSR', chairId: 'VEND-L1-1' },
      },
    },
    {
      id: 'emp-joao-alexandre',
      name: 'João Alexandre',
      shortName: 'João Alex.',
      role: 'Consultor de Vendas',
      contractType: 'CLT_ATIVO',
      department: 'VENDAS',
      defaultStore: 'LOJA_1',
      defaultChairId: 'VEND-L1-2',
      badgeColor: '#059669',
      defaultLunchStart: '13:00',
      defaultLunchEnd: '14:30',
      affinityPartnerId: 'emp-winona',
      rulesAndRestrictions: 'Afinidade: folga preferencialmente junto com a esposa Winona (SDR).',
      schedule: {
        SEG: { day: 'SEG', type: 'TRABALHO', chairId: 'VEND-L1-2', startTime: '08:00', lunchStart: '13:00', lunchEnd: '14:30', endTime: '17:30' },
        TER: { day: 'TER', type: 'TRABALHO', chairId: 'VEND-L1-2', startTime: '08:00', lunchStart: '13:00', lunchEnd: '14:30', endTime: '17:30' },
        QUA: { day: 'QUA', type: 'TRABALHO', chairId: 'VEND-L1-2', startTime: '08:00', lunchStart: '13:00', lunchEnd: '14:30', endTime: '17:30' },
        QUI: { day: 'QUI', type: 'TRABALHO', chairId: 'VEND-L1-2', startTime: '08:00', lunchStart: '13:00', lunchEnd: '14:30', endTime: '17:30' },
        SEX: { day: 'SEX', type: 'TRABALHO', chairId: 'VEND-L1-2', startTime: '08:00', lunchStart: '13:00', lunchEnd: '14:30', endTime: '17:30' },
        SAB: { day: 'SAB', type: 'FOLGA_5X2', chairId: 'VEND-L1-2' },
        DOM: { day: 'DOM', type: 'FOLGA_DSR', chairId: 'VEND-L1-2' },
      },
    },
    {
      id: 'emp-marcos-antonio',
      name: 'Marcos Antonio',
      shortName: 'Marcos Ant.',
      role: 'Consultor de Vendas',
      contractType: 'CLT_ATIVO',
      department: 'VENDAS',
      defaultStore: 'LOJA_1',
      defaultChairId: 'VEND-L1-3',
      badgeColor: '#059669',
      defaultLunchStart: '12:30',
      defaultLunchEnd: '14:00',
      rulesAndRestrictions: 'Sem restrições; participa do rodízio na Loja 2.',
      schedule: {
        SEG: { day: 'SEG', type: 'TRABALHO', chairId: 'VEND-L1-3', startTime: '08:00', lunchStart: '12:30', lunchEnd: '14:00', endTime: '17:30' },
        TER: { day: 'TER', type: 'TRABALHO', chairId: 'VEND-L1-3', startTime: '08:00', lunchStart: '12:30', lunchEnd: '14:00', endTime: '17:30' },
        QUA: { day: 'QUA', type: 'TRABALHO', chairId: 'VEND-L1-3', startTime: '08:00', lunchStart: '12:30', lunchEnd: '14:00', endTime: '17:30' },
        QUI: { day: 'QUI', type: 'TRABALHO', chairId: 'VEND-L1-3', startTime: '08:00', lunchStart: '12:30', lunchEnd: '14:00', endTime: '17:30' },
        SEX: { day: 'SEX', type: 'TRABALHO', chairId: 'VEND-L1-3', startTime: '08:00', lunchStart: '12:30', lunchEnd: '14:00', endTime: '17:30' },
        SAB: { day: 'SAB', type: 'FOLGA_5X2', chairId: 'VEND-L1-3' },
        DOM: { day: 'DOM', type: 'FOLGA_DSR', chairId: 'VEND-L1-3' },
      },
    },
    {
      id: 'emp-rayssa',
      name: 'Rayssa Sizenando',
      shortName: 'Rayssa',
      role: 'Consultora de Vendas',
      contractType: 'CLT_ATIVO',
      department: 'VENDAS',
      defaultStore: 'LOJA_1',
      defaultChairId: 'VEND-L1-4',
      badgeColor: '#059669',
      defaultLunchStart: '12:00',
      defaultLunchEnd: '13:30',
      rulesAndRestrictions: 'Retornou das férias; participa do rodízio na Loja 2.',
      schedule: {
        SEG: { day: 'SEG', type: 'TRABALHO', chairId: 'VEND-L1-4', startTime: '08:00', lunchStart: '12:00', lunchEnd: '13:30', endTime: '17:30' },
        TER: { day: 'TER', type: 'TRABALHO', chairId: 'VEND-L1-4', startTime: '08:00', lunchStart: '12:00', lunchEnd: '13:30', endTime: '17:30' },
        QUA: { day: 'QUA', type: 'TRABALHO', chairId: 'VEND-L1-4', startTime: '08:00', lunchStart: '12:00', lunchEnd: '13:30', endTime: '17:30' },
        QUI: { day: 'QUI', type: 'TRABALHO', chairId: 'VEND-L1-4', startTime: '08:00', lunchStart: '12:00', lunchEnd: '13:30', endTime: '17:30' },
        SEX: { day: 'SEX', type: 'TRABALHO', chairId: 'VEND-L1-4', startTime: '08:00', lunchStart: '12:00', lunchEnd: '13:30', endTime: '17:30' },
        SAB: { day: 'SAB', type: 'FOLGA_5X2', chairId: 'VEND-L1-4' },
        DOM: { day: 'DOM', type: 'FOLGA_DSR', chairId: 'VEND-L1-4' },
      },
    },

    // ==============================================================
    // LOJA 1 — MATRIZ 546: Base da Preparação & Zeladoria
    // ==============================================================
    {
      id: 'emp-allisson',
      name: 'Allisson Laurentino',
      shortName: 'Allisson',
      role: 'Supervisor de Preparação',
      contractType: 'CLT_ATIVO',
      department: 'PREPARACAO',
      defaultStore: 'LOJA_1',
      defaultChairId: 'PREP-1',
      badgeColor: '#D97706',
      defaultLunchStart: '12:00',
      defaultLunchEnd: '13:30',
      rulesAndRestrictions: 'Supervisão do preparo de veículos e assistência. Seg/Ter leves; Qui/Sex pesadas.',
      schedule: {
        SEG: { day: 'SEG', type: 'TRABALHO', chairId: 'PREP-1', startTime: '08:00', lunchStart: '12:00', lunchEnd: '13:30', endTime: '17:30' },
        TER: { day: 'TER', type: 'TRABALHO', chairId: 'PREP-1', startTime: '08:00', lunchStart: '12:00', lunchEnd: '13:30', endTime: '17:30' },
        QUA: { day: 'QUA', type: 'TRABALHO', chairId: 'PREP-1', startTime: '08:00', lunchStart: '12:00', lunchEnd: '13:30', endTime: '17:30' },
        QUI: { day: 'QUI', type: 'TRABALHO', chairId: 'PREP-1', startTime: '08:00', lunchStart: '12:00', lunchEnd: '13:30', endTime: '17:30' },
        SEX: { day: 'SEX', type: 'TRABALHO', chairId: 'PREP-1', startTime: '08:00', lunchStart: '12:00', lunchEnd: '13:30', endTime: '17:30' },
        SAB: { day: 'SAB', type: 'FOLGA_5X2', chairId: 'PREP-1' },
        DOM: { day: 'DOM', type: 'FOLGA_DSR', chairId: 'PREP-1' },
      },
    },
    {
      id: 'emp-rodolfo',
      name: 'Rodolfo Andrade',
      shortName: 'Rodolfo',
      role: 'Preparação / Auxiliar de Loja',
      contractType: 'CLT_ATIVO',
      department: 'PREPARACAO',
      defaultStore: 'LOJA_1',
      defaultChairId: 'PREP-2',
      badgeColor: '#D97706',
      defaultLunchStart: '11:30',
      defaultLunchEnd: '13:00',
      rulesAndRestrictions: 'Organização de loja/carros, assistência e apoio zeladoria (abertura/fechamento).',
      schedule: {
        SEG: { day: 'SEG', type: 'TRABALHO', chairId: 'PREP-2', startTime: '08:00', lunchStart: '11:30', lunchEnd: '13:00', endTime: '17:30' },
        TER: { day: 'TER', type: 'TRABALHO', chairId: 'PREP-2', startTime: '08:00', lunchStart: '11:30', lunchEnd: '13:00', endTime: '17:30' },
        QUA: { day: 'QUA', type: 'TRABALHO', chairId: 'PREP-2', startTime: '08:00', lunchStart: '11:30', lunchEnd: '13:00', endTime: '17:30' },
        QUI: { day: 'QUI', type: 'TRABALHO', chairId: 'PREP-2', startTime: '08:00', lunchStart: '11:30', lunchEnd: '13:00', endTime: '17:30' },
        SEX: { day: 'SEX', type: 'TRABALHO', chairId: 'PREP-2', startTime: '08:00', lunchStart: '11:30', lunchEnd: '13:00', endTime: '17:30' },
        SAB: { day: 'SAB', type: 'FOLGA_5X2', chairId: 'PREP-2' },
        DOM: { day: 'DOM', type: 'FOLGA_DSR', chairId: 'PREP-2' },
      },
    },
    {
      id: 'emp-marcos-florentino',
      name: 'Marcos Florentino',
      shortName: 'Marcos Flor.',
      role: 'Preparação / Zeladoria',
      contractType: 'CLT_ATIVO',
      department: 'PREPARACAO',
      defaultStore: 'LOJA_1',
      defaultChairId: 'PREP-3',
      badgeColor: '#D97706',
      defaultLunchStart: '12:30',
      defaultLunchEnd: '14:00',
      rulesAndRestrictions: 'Cobre Serviços Gerais (crítico na abertura 08:00 e fechamento 17:30).',
      schedule: {
        SEG: { day: 'SEG', type: 'TRABALHO', chairId: 'PREP-3', startTime: '08:00', lunchStart: '12:30', lunchEnd: '14:00', endTime: '17:30' },
        TER: { day: 'TER', type: 'TRABALHO', chairId: 'PREP-3', startTime: '08:00', lunchStart: '12:30', lunchEnd: '14:00', endTime: '17:30' },
        QUA: { day: 'QUA', type: 'TRABALHO', chairId: 'PREP-3', startTime: '08:00', lunchStart: '12:30', lunchEnd: '14:00', endTime: '17:30' },
        QUI: { day: 'QUI', type: 'TRABALHO', chairId: 'PREP-3', startTime: '08:00', lunchStart: '12:30', lunchEnd: '14:00', endTime: '17:30' },
        SEX: { day: 'SEX', type: 'TRABALHO', chairId: 'PREP-3', startTime: '08:00', lunchStart: '12:30', lunchEnd: '14:00', endTime: '17:30' },
        SAB: { day: 'SAB', type: 'FOLGA_5X2', chairId: 'PREP-3' },
        DOM: { day: 'DOM', type: 'FOLGA_DSR', chairId: 'PREP-3' },
      },
    },
    {
      id: 'emp-alefy',
      name: 'Alefy (Allify)',
      shortName: 'Alefy',
      role: 'Preparação / Zeladoria',
      contractType: 'CLT_ATIVO',
      department: 'PREPARACAO',
      defaultStore: 'LOJA_1',
      defaultChairId: 'PREP-4',
      badgeColor: '#D97706',
      defaultLunchStart: '12:00',
      defaultLunchEnd: '13:30',
      rulesAndRestrictions: 'Cobre Serviços Gerais (crítico na abertura 08:00 e fechamento 17:30).',
      schedule: {
        SEG: { day: 'SEG', type: 'TRABALHO', chairId: 'PREP-4', startTime: '08:00', lunchStart: '12:00', lunchEnd: '13:30', endTime: '17:30' },
        TER: { day: 'TER', type: 'TRABALHO', chairId: 'PREP-4', startTime: '08:00', lunchStart: '12:00', lunchEnd: '13:30', endTime: '17:30' },
        QUA: { day: 'QUA', type: 'TRABALHO', chairId: 'PREP-4', startTime: '08:00', lunchStart: '12:00', lunchEnd: '13:30', endTime: '17:30' },
        QUI: { day: 'QUI', type: 'TRABALHO', chairId: 'PREP-4', startTime: '08:00', lunchStart: '12:00', lunchEnd: '13:30', endTime: '17:30' },
        SEX: { day: 'SEX', type: 'TRABALHO', chairId: 'PREP-4', startTime: '08:00', lunchStart: '12:00', lunchEnd: '13:30', endTime: '17:30' },
        SAB: { day: 'SAB', type: 'FOLGA_5X2', chairId: 'PREP-4' },
        DOM: { day: 'DOM', type: 'FOLGA_DSR', chairId: 'PREP-4' },
      },
    },

    // ==============================================================
    // LOJA 1 — MATRIZ 546: Marketing
    // ==============================================================
    {
      id: 'emp-nailson',
      name: 'Nailson Wagner',
      shortName: 'Nailson',
      role: 'Marketing (Social Media)',
      contractType: 'CLT_ATIVO',
      department: 'MARKETING',
      defaultStore: 'LOJA_1',
      defaultChairId: 'MKT-1',
      badgeColor: '#4F46E5',
      defaultLunchStart: '12:00',
      defaultLunchEnd: '13:30',
      rulesAndRestrictions: 'Social Media; férias programadas jan/2027 (Igor e Lorena cobrem).',
      schedule: {
        SEG: { day: 'SEG', type: 'TRABALHO', chairId: 'MKT-1', startTime: '08:00', lunchStart: '12:00', lunchEnd: '13:30', endTime: '17:30' },
        TER: { day: 'TER', type: 'TRABALHO', chairId: 'MKT-1', startTime: '08:00', lunchStart: '12:00', lunchEnd: '13:30', endTime: '17:30' },
        QUA: { day: 'QUA', type: 'TRABALHO', chairId: 'MKT-1', startTime: '08:00', lunchStart: '12:00', lunchEnd: '13:30', endTime: '17:30' },
        QUI: { day: 'QUI', type: 'TRABALHO', chairId: 'MKT-1', startTime: '08:00', lunchStart: '12:00', lunchEnd: '13:30', endTime: '17:30' },
        SEX: { day: 'SEX', type: 'TRABALHO', chairId: 'MKT-1', startTime: '08:00', lunchStart: '12:00', lunchEnd: '13:30', endTime: '17:30' },
        SAB: { day: 'SAB', type: 'FOLGA_5X2', chairId: 'MKT-1' },
        DOM: { day: 'DOM', type: 'FOLGA_DSR', chairId: 'MKT-1' },
      },
    },

    // ==============================================================
    // LOJA 2 — FILIAL 777: Vendedor Área Externa
    // ==============================================================
    {
      id: 'emp-rosinaldo',
      name: 'Rosinaldo (Jorginho)',
      shortName: 'Jorginho',
      role: 'Consultor de Vendas',
      contractType: 'CLT_ATIVO',
      department: 'VENDAS',
      defaultStore: 'LOJA_1',
      defaultChairId: 'VEND-L1-5',
      badgeColor: '#059669',
      defaultLunchStart: '11:30',
      defaultLunchEnd: '13:00',
      rulesAndRestrictions: 'Vendedor da Matriz (Mesa Pátio 5).',
      schedule: {
        SEG: { day: 'SEG', type: 'TRABALHO', chairId: 'VEND-L1-5', startTime: '08:00', lunchStart: '11:30', lunchEnd: '13:00', endTime: '17:30' },
        TER: { day: 'TER', type: 'TRABALHO', chairId: 'VEND-L1-5', startTime: '08:00', lunchStart: '11:30', lunchEnd: '13:00', endTime: '17:30' },
        QUA: { day: 'QUA', type: 'TRABALHO', chairId: 'VEND-L1-5', startTime: '08:00', lunchStart: '11:30', lunchEnd: '13:00', endTime: '17:30' },
        QUI: { day: 'QUI', type: 'TRABALHO', chairId: 'VEND-L1-5', startTime: '08:00', lunchStart: '11:30', lunchEnd: '13:00', endTime: '17:30' },
        SEX: { day: 'SEX', type: 'TRABALHO', chairId: 'VEND-L1-5', startTime: '08:00', lunchStart: '11:30', lunchEnd: '13:00', endTime: '17:30' },
        SAB: { day: 'SAB', type: 'FOLGA_5X2', chairId: 'VEND-L1-5' },
        DOM: { day: 'DOM', type: 'FOLGA_DSR', chairId: 'VEND-L1-5' },
      },
    },

    // ==============================================================
    // LOJA 2 — FILIAL 777: Baias de Atendimento (Doc & Sucesso)
    // ==============================================================
    {
      id: 'emp-marielly',
      name: 'Marielly Nascimento',
      shortName: 'Marielly',
      role: 'Supervisora de Documentação',
      contractType: 'CLT_ATIVO',
      department: 'DOCUMENTACAO',
      defaultStore: 'LOJA_2',
      defaultChairId: 'DOC-SUP',
      badgeColor: '#7C3AED',
      defaultLunchStart: '11:30',
      defaultLunchEnd: '13:00',
      rulesAndRestrictions: 'Interna; foco em DETRAN + domínio de pagamentos.',
      schedule: {
        SEG: { day: 'SEG', type: 'TRABALHO', chairId: 'DOC-SUP', startTime: '08:00', lunchStart: '11:30', lunchEnd: '13:00', endTime: '17:30' },
        TER: { day: 'TER', type: 'TRABALHO', chairId: 'DOC-SUP', startTime: '08:00', lunchStart: '11:30', lunchEnd: '13:00', endTime: '17:30' },
        QUA: { day: 'QUA', type: 'TRABALHO', chairId: 'DOC-SUP', startTime: '08:00', lunchStart: '11:30', lunchEnd: '13:00', endTime: '17:30' },
        QUI: { day: 'QUI', type: 'TRABALHO', chairId: 'DOC-SUP', startTime: '08:00', lunchStart: '11:30', lunchEnd: '13:00', endTime: '17:30' },
        SEX: { day: 'SEX', type: 'TRABALHO', chairId: 'DOC-SUP', startTime: '08:00', lunchStart: '11:30', lunchEnd: '13:00', endTime: '17:30' },
        SAB: { day: 'SAB', type: 'FOLGA_5X2', chairId: 'DOC-SUP' },
        DOM: { day: 'DOM', type: 'FOLGA_DSR', chairId: 'DOC-SUP' },
      },
    },
    {
      id: 'emp-mayana',
      name: 'Mayana da Silva',
      shortName: 'Mayana',
      role: 'Auxiliar Administrativa (Doc)',
      contractType: 'CLT_ATIVO',
      department: 'DOCUMENTACAO',
      defaultStore: 'LOJA_2',
      defaultChairId: 'DOC-AUX',
      badgeColor: '#7C3AED',
      defaultLunchStart: '13:00',
      defaultLunchEnd: '14:30',
      rulesAndRestrictions: 'Transferências e NFs. Sem restrições de escala.',
      schedule: {
        SEG: { day: 'SEG', type: 'TRABALHO', chairId: 'DOC-AUX', startTime: '08:00', lunchStart: '13:00', lunchEnd: '14:30', endTime: '17:30' },
        TER: { day: 'TER', type: 'TRABALHO', chairId: 'DOC-AUX', startTime: '08:00', lunchStart: '13:00', lunchEnd: '14:30', endTime: '17:30' },
        QUA: { day: 'QUA', type: 'TRABALHO', chairId: 'DOC-AUX', startTime: '08:00', lunchStart: '13:00', lunchEnd: '14:30', endTime: '17:30' },
        QUI: { day: 'QUI', type: 'TRABALHO', chairId: 'DOC-AUX', startTime: '08:00', lunchStart: '13:00', lunchEnd: '14:30', endTime: '17:30' },
        SEX: { day: 'SEX', type: 'TRABALHO', chairId: 'DOC-AUX', startTime: '08:00', lunchStart: '13:00', lunchEnd: '14:30', endTime: '17:30' },
        SAB: { day: 'SAB', type: 'FOLGA_5X2', chairId: 'DOC-AUX' },
        DOM: { day: 'DOM', type: 'FOLGA_DSR', chairId: 'DOC-AUX' },
      },
    },
    {
      id: 'emp-matheus',
      name: 'Matheus Coutinho',
      shortName: 'Matheus (Estagiário)',
      role: 'Estagiário Documentação / OS',
      contractType: 'ESTAGIARIO',
      department: 'DOCUMENTACAO',
      defaultStore: 'LOJA_2',
      defaultChairId: 'DOC-EST',
      badgeColor: '#7C3AED',
      rulesAndRestrictions: 'Lei 11.788/2008: Máx 6h/dia e 30h/sem (24h vigentes). Seg–Sex 13:00–17:00 (4h) e Sáb 08:40–12:40 (4h).',
      schedule: {
        SEG: { day: 'SEG', type: 'TRABALHO', chairId: 'DOC-EST', startTime: '13:00', endTime: '17:00' },
        TER: { day: 'TER', type: 'TRABALHO', chairId: 'DOC-EST', startTime: '13:00', endTime: '17:00' },
        QUA: { day: 'QUA', type: 'TRABALHO', chairId: 'DOC-EST', startTime: '13:00', endTime: '17:00' },
        QUI: { day: 'QUI', type: 'TRABALHO', chairId: 'DOC-EST', startTime: '13:00', endTime: '17:00' },
        SEX: { day: 'SEX', type: 'TRABALHO', chairId: 'DOC-EST', startTime: '13:00', endTime: '17:00' },
        SAB: { day: 'SAB', type: 'TRABALHO', chairId: 'DOC-EST', startTime: '08:40', endTime: '12:40' },
        DOM: { day: 'DOM', type: 'FOLGA_DSR', chairId: 'DOC-EST' },
      },
    },
    {
      id: 'emp-jorge',
      name: 'Jorge Vinicius',
      shortName: 'Jorge Vinicius',
      role: 'Sucesso do Cliente / Assistência',
      contractType: 'CLT_TEMPORARIO',
      department: 'SUCESSO_CLIENTE',
      defaultStore: 'LOJA_2',
      defaultChairId: 'SC-1',
      badgeColor: '#0891B2',
      defaultLunchStart: '12:00',
      defaultLunchEnd: '13:30',
      rulesAndRestrictions: 'CLT Temporário (~6 meses). Cobre licença-maternidade + férias da Grazy.',
      schedule: {
        SEG: { day: 'SEG', type: 'TRABALHO', chairId: 'SC-1', startTime: '08:00', lunchStart: '12:00', lunchEnd: '13:30', endTime: '17:30' },
        TER: { day: 'TER', type: 'TRABALHO', chairId: 'SC-1', startTime: '08:00', lunchStart: '12:00', lunchEnd: '13:30', endTime: '17:30' },
        QUA: { day: 'QUA', type: 'TRABALHO', chairId: 'SC-1', startTime: '08:00', lunchStart: '12:00', lunchEnd: '13:30', endTime: '17:30' },
        QUI: { day: 'QUI', type: 'TRABALHO', chairId: 'SC-1', startTime: '08:00', lunchStart: '12:00', lunchEnd: '13:30', endTime: '17:30' },
        SEX: { day: 'SEX', type: 'TRABALHO', chairId: 'SC-1', startTime: '08:00', lunchStart: '12:00', lunchEnd: '13:30', endTime: '17:30' },
        SAB: { day: 'SAB', type: 'FOLGA_5X2', chairId: 'SC-1' },
        DOM: { day: 'DOM', type: 'FOLGA_DSR', chairId: 'SC-1' },
      },
    },
    {
      id: 'emp-grazy',
      name: 'Grazielly (Grazy)',
      shortName: 'Grazy (Licença)',
      role: 'Sucesso do Cliente',
      contractType: 'LICENCA_MATERNIDADE',
      department: 'SUCESSO_CLIENTE',
      defaultStore: 'LOJA_2',
      defaultChairId: 'SC-1',
      badgeColor: '#0891B2',
      rulesAndRestrictions: 'Em Licença-Maternidade (~6 meses contando férias). Jorge Vinicius cobre o posto.',
      schedule: {
        SEG: { day: 'SEG', type: 'LICENCA', chairId: 'SC-1' },
        TER: { day: 'TER', type: 'LICENCA', chairId: 'SC-1' },
        QUA: { day: 'QUA', type: 'LICENCA', chairId: 'SC-1' },
        QUI: { day: 'QUI', type: 'LICENCA', chairId: 'SC-1' },
        SEX: { day: 'SEX', type: 'LICENCA', chairId: 'SC-1' },
        SAB: { day: 'SAB', type: 'LICENCA', chairId: 'SC-1' },
        DOM: { day: 'DOM', type: 'LICENCA', chairId: 'SC-1' },
      },
    },

    // ==============================================================
    // LOJA 2 — FILIAL 777: Escritório 2 (Financeiro)
    // ==============================================================
    {
      id: 'emp-joao-pedro',
      name: 'João Pedro Ferreira',
      shortName: 'João Pedro',
      role: 'Financeiro / Pagamentos',
      contractType: 'CLT_ATIVO',
      department: 'FINANCEIRO',
      defaultStore: 'LOJA_2',
      defaultChairId: 'FIN-1',
      badgeColor: '#DB2777',
      defaultLunchStart: '12:00',
      defaultLunchEnd: '13:30',
      affinityPartnerId: 'emp-andria',
      rulesAndRestrictions: 'Sexta crítica (maior fluxo de pagamentos de compras). Afinidade com Andria.',
      schedule: {
        SEG: { day: 'SEG', type: 'TRABALHO', chairId: 'FIN-1', startTime: '08:00', lunchStart: '12:00', lunchEnd: '13:30', endTime: '17:30' },
        TER: { day: 'TER', type: 'TRABALHO', chairId: 'FIN-1', startTime: '08:00', lunchStart: '12:00', lunchEnd: '13:30', endTime: '17:30' },
        QUA: { day: 'QUA', type: 'TRABALHO', chairId: 'FIN-1', startTime: '08:00', lunchStart: '12:00', lunchEnd: '13:30', endTime: '17:30' },
        QUI: { day: 'QUI', type: 'TRABALHO', chairId: 'FIN-1', startTime: '08:00', lunchStart: '12:00', lunchEnd: '13:30', endTime: '17:30' },
        SEX: { day: 'SEX', type: 'TRABALHO', chairId: 'FIN-1', startTime: '08:00', lunchStart: '12:00', lunchEnd: '13:30', endTime: '17:30' },
        SAB: { day: 'SAB', type: 'FOLGA_5X2', chairId: 'FIN-1' },
        DOM: { day: 'DOM', type: 'FOLGA_DSR', chairId: 'FIN-1' },
      },
    },
  ];
}

/**
 * Cria os 3 Cenários Prontos definidos na especificação da Seu Carro PE:
 * Cenário A: Almoço 1h30 + 1 folga fixa na semana para quem faz Sábado
 *   - Quem faz sábado: 4 dias x 8h = 32h + 5h no sábado = 37h semanais (pronto para 40h de 2027)
 *   - Quem não faz sábado: 5 dias x 8h = 40h semanais (dentro do teto de 42h)
 *
 * Cenário B: Almoço Reduzido para 1h00 nos Dias Úteis (08:00 às 17:30 = 8h30/dia)
 *   - Quem faz sábado: 4 dias x 8h30 = 34h + 5h = 39h semanais
 *   - Quem não faz sábado: 5 dias x 8h30 = 42h30 semanais
 *
 * Cenário C: Revezamento de Sábado em 2 Grupos (50% por sábado) com Blindagem de Quinta e Sexta
 *   - Folgas compensatórias alocadas na Segunda ou Terça
 */
export function createDefaultScenarios(): Scenario[] {
  const baseTeam = createBaseEmployees();
  const clone = (emps: Employee[]): Employee[] => JSON.parse(JSON.stringify(emps));

  // --- CENÁRIO A: Almoço 1h30 + Folga Fixa na Semana para quem faz Sábado ---
  const teamA = clone(baseTeam);
  // Jair faz sábado e folga na Terça
  const jair = teamA.find((e) => e.id === 'emp-jair');
  if (jair) {
    jair.schedule.TER = { day: 'TER', type: 'FOLGA_5X2', chairId: jair.defaultChairId };
    jair.schedule.SAB = { day: 'SAB', type: 'TRABALHO', chairId: jair.defaultChairId, startTime: '08:00', endTime: '13:00' };
  }
  // Marcos Antonio faz sábado e folga na Quarta
  const marcosAnt = teamA.find((e) => e.id === 'emp-marcos-antonio');
  if (marcosAnt) {
    marcosAnt.schedule.QUA = { day: 'QUA', type: 'FOLGA_5X2', chairId: marcosAnt.defaultChairId };
    marcosAnt.schedule.SAB = { day: 'SAB', type: 'TRABALHO', chairId: 'VEND-L2-EXT', startTime: '08:00', endTime: '13:00' };
  }
  // Rodolfo faz sábado e folga na Segunda
  const rodolfo = teamA.find((e) => e.id === 'emp-rodolfo');
  if (rodolfo) {
    rodolfo.schedule.SEG = { day: 'SEG', type: 'FOLGA_5X2', chairId: rodolfo.defaultChairId };
    rodolfo.schedule.SAB = { day: 'SAB', type: 'TRABALHO', chairId: rodolfo.defaultChairId, startTime: '08:00', endTime: '13:00' };
  }
  // Diana (SDR) faz sábado e folga na Terça
  const diana = teamA.find((e) => e.id === 'emp-diana');
  if (diana) {
    diana.schedule.TER = { day: 'TER', type: 'FOLGA_5X2', chairId: diana.defaultChairId };
    diana.schedule.SAB = { day: 'SAB', type: 'TRABALHO', chairId: diana.defaultChairId, startTime: '08:00', endTime: '13:00' };
  }
  // Mayana (Doc) faz sábado e folga na Quarta
  const mayana = teamA.find((e) => e.id === 'emp-mayana');
  if (mayana) {
    mayana.schedule.QUA = { day: 'QUA', type: 'FOLGA_5X2', chairId: mayana.defaultChairId };
    mayana.schedule.SAB = { day: 'SAB', type: 'TRABALHO', chairId: mayana.defaultChairId, startTime: '08:00', endTime: '13:00' };
  }

  // --- CENÁRIO B: Almoço Otimizado para 1h00 nos Dias Úteis (08:00 às 17:30 = 8h30/dia) ---
  const teamB = clone(teamA).map((emp) => {
    if (emp.contractType === 'ESTAGIARIO' || emp.contractType === 'LICENCA_MATERNIDADE') return emp;
    const newSched = { ...emp.schedule };
    (['SEG', 'TER', 'QUA', 'QUI', 'SEX'] as const).forEach((d) => {
      if (newSched[d].type === 'TRABALHO') {
        newSched[d] = {
          ...newSched[d],
          lunchStart: '12:00',
          lunchEnd: '13:00', // 1h00 de almoço
        };
      }
    });
    return { ...emp, schedule: newSched };
  });

  // --- CENÁRIO C: Revezamento de Sábado em 2 Grupos (50% por Sábado) com Blindagem Qui/Sex ---
  const teamC = clone(baseTeam);
  const g1Sellers = ['emp-jair', 'emp-rayssa'];
  const g1SDRs = ['emp-diana', 'emp-adriane'];
  const g1Prep = ['emp-marcos-florentino', 'emp-rodolfo'];

  teamC.forEach((emp) => {
    if (g1Sellers.includes(emp.id) || g1SDRs.includes(emp.id) || g1Prep.includes(emp.id)) {
      const offDay = emp.department === 'SDR' ? 'TER' : 'SEG';
      emp.schedule[offDay] = { day: offDay, type: 'FOLGA_5X2', chairId: emp.defaultChairId };
      emp.schedule.SAB = {
        day: 'SAB',
        type: 'TRABALHO',
        chairId: emp.id === 'emp-rayssa' ? 'VEND-L2-EXT' : emp.defaultChairId,
        startTime: '08:00',
        endTime: '13:00',
      };
    }
  });

  return [
    ...(BAKED_ESCALA_DEFINIDA
      ? [{ ...BAKED_ESCALA_DEFINIDA, employees: BAKED_ESCALA_DEFINIDA.employees.map(ensureEmployeeWeeksSchedule) }]
      : []),
    {
      id: 'scen-a',
      name: 'Cenário A — Almoço Padrão 1h30 + Folga Fixa na Semana',
      shortTag: 'Cenário A (Almoço 1h30)',
      description:
        'Preserva o almoço tradicional de 1h30 (8h líquidas por dia útil). Quem trabalha no sábado (5h) ganha 1 folga útil na semana, totalizando 37h semanais (já abaixo do teto de 40h de 2027). Quem folga no sábado cumpre exatamente 40h semanais.',
      phase: 'FASE_1',
      employees: teamA.map(ensureEmployeeWeeksSchedule),
      createdAt: '2026-11-12T08:00:00Z',
    },
    {
      id: 'scen-b',
      name: 'Cenário B — Almoço Otimizado (1h00 nos Dias Úteis)',
      shortTag: 'Cenário B (Almoço 1h00)',
      description:
        'Reduz o almoço para 1h00 nos dias úteis (8h30 líquidas/dia). Quem trabalha no sábado cumpre 39h semanais (4 dias de 8h30 + 5h no sábado).',
      phase: 'FASE_1',
      employees: teamB.map(ensureEmployeeWeeksSchedule),
      createdAt: '2026-11-12T08:00:00Z',
    },
    {
      id: 'scen-c',
      name: 'Cenário C — Revezamento de Sábado 50/50 (Blindagem Qui/Sex)',
      shortTag: 'Cenário C (Revezamento 50%)',
      description:
        'Equipe dividida em 2 turmas de sábado (50% ativo). As folgas compensatórias ocorrem na segunda ou terça, blindando 100% da presença na quinta e sexta (dias com maior volume de pagamentos e preparação de entrega).',
      phase: 'FASE_2',
      employees: teamC.map(ensureEmployeeWeeksSchedule),
      createdAt: '2026-11-12T08:00:00Z',
    },
    ...createOptimizedScenarios(baseTeam),
  ];
}
