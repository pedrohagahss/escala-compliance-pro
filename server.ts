import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ChatMessageInput {
  role: 'user' | 'model';
  text: string;
}

interface SnapshotEmployee {
  id: string;
  name: string;
  shortName: string;
  department: string;
  defaultStore: string;
  defaultChairId: string;
  contractType: string;
  monthlyHours: number;
  monthlyTargetHours: number;
  monthlyBalanceHours: number;
  status: string;
  linkedFolgaNames?: string[];
  noParallelFolgaNames?: string[];
  parallelConflicts?: string[];
  weeklyHours?: number[];
  pontoMaisNetBancoMonth?: number;
}

interface SnapshotUncoveredAlert {
  week: number;
  day: string;
  sectorTitle: string;
  storeName: string;
  message: string;
}

interface ScheduleSnapshot {
  phase?: string;
  phaseBadge?: string;
  maxWeeklyHours?: number;
  monthlyTargetHours?: number;
  pontoMaisWeeklyHours?: number;
  pontoMaisLabel?: string;
  employees?: SnapshotEmployee[];
  uncoveredAlerts?: SnapshotUncoveredAlert[];
  parallelConflicts?: string[];
  sameFolgaLinks?: string[];
  noParallelLinks?: string[];
  operationalAlerts?: string[];
}

function hasValidGeminiKey(key?: string): boolean {
  if (!key) return false;
  const trimmed = key.trim();
  if (trimmed.length <= 10) return false;
  if (trimmed === 'MY_GEMINI_API_KEY' || trimmed === 'YOUR_API_KEY') return false;
  return true;
}

function formatHoursSimple(hours: number): string {
  const abs = Math.abs(hours);
  const totalMin = Math.round(abs * 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h${m.toString().padStart(2, '0')}`;
}

function generateLocalScheduleAssistantReply(
  userQuestion: string,
  contextSummary: string,
  scheduleSnapshot?: ScheduleSnapshot
): string {
  const q = (userQuestion || '').toLowerCase();
  const emps = scheduleSnapshot?.employees || [];
  const activeEmps = emps.filter(
    (e) => e.contractType !== 'LICENCA_MATERNIDADE' && e.contractType !== 'LIDERANCA'
  );
  const targetMonthly = scheduleSnapshot?.monthlyTargetHours ?? 168;
  const targetWeekly = scheduleSnapshot?.maxWeeklyHours ?? 42;
  const phaseLabel = scheduleSnapshot?.phaseBadge || 'Fase 1 — 42h (EC 141/2026)';

  const shortfall = activeEmps.filter((e) => e.monthlyBalanceHours < -0.08);
  const overtime = activeEmps.filter((e) => e.monthlyBalanceHours > 0.08);
  const closed = activeEmps.filter((e) => Math.abs(e.monthlyBalanceHours) <= 0.08);
  const parallelConflicts = scheduleSnapshot?.parallelConflicts || [];
  const uncoveredAlerts = scheduleSnapshot?.uncoveredAlerts || [];
  const operationalAlerts = scheduleSnapshot?.operationalAlerts || [];

  // 1. Saldo mensal / horas extras / banco de horas / faltantes
  if (
    q.includes('saldo') ||
    q.includes('devendo') ||
    q.includes('negativ') ||
    q.includes('falt') ||
    q.includes('fechar') ||
    q.includes('hora extra') ||
    q.includes('exced') ||
    q.includes('168') ||
    q.includes('160')
  ) {
    const lines: string[] = [
      `### Análise de Saldo Mensal — ${phaseLabel}`,
      `- **Meta mensal CLT:** **${targetMonthly}h00** (${targetWeekly}h/semana em 4 semanas; Estágio: 96h00 / 24h por semana).`,
      `- **Fechados na meta:** ${closed.length} de ${activeEmps.length} colaboradores ativos.`,
    ];

    if (shortfall.length > 0) {
      lines.push('');
      lines.push(`**Colaboradores com saldo negativo (${shortfall.length}):**`);
      shortfall.slice(0, 12).forEach((e) => {
        lines.push(
          `- **${e.shortName}** (${e.defaultChairId}): ${formatHoursSimple(e.monthlyHours)} / ${formatHoursSimple(e.monthlyTargetHours)} (**-${formatHoursSimple(e.monthlyBalanceHours)}**)`
        );
      });
      lines.push('');
      lines.push(
        '> **Sugestão:** Use o botão **"Fechar Soma das 4 Semanas"** na barra lateral para distribuir a compensação em dias úteis sem alterar as folgas já definidas.'
      );
    } else {
      lines.push('- Nenhum colaborador está devendo horas no ciclo mensal S1–S4.');
    }

    if (overtime.length > 0) {
      lines.push('');
      lines.push(`**Colaboradores com saldo positivo / horas extras (${overtime.length}):**`);
      overtime.slice(0, 12).forEach((e) => {
        lines.push(
          `- **${e.shortName}** (${e.defaultChairId}): +${formatHoursSimple(e.monthlyBalanceHours)} no mês (${formatHoursSimple(e.monthlyHours)} totais)`
        );
      });
    }

    return lines.join('\n');
  }

  // 2. Folga paralela / folgar igual / conflito
  if (
    q.includes('paralel') ||
    q.includes('junto') ||
    q.includes('igual') ||
    q.includes('víncul') ||
    q.includes('vincul') ||
    q.includes('conflito')
  ) {
    const lines: string[] = ['### Vínculos de Folga e Conflitos em Paralelo (S1–S4)'];

    const noParallelList = scheduleSnapshot?.noParallelLinks || [];
    const sameFolgaList = scheduleSnapshot?.sameFolgaLinks || [];

    if (noParallelList.length > 0) {
      lines.push(`**Proibição de folga em paralelo ativa (${noParallelList.length}):**`);
      noParallelList.forEach((item) => lines.push(`- ${item}`));
    } else {
      lines.push('- Nenhum vínculo de **proibição de folga paralela** configurado no momento. Use o botão **"Proibir folga paralela"** na coluna do colaborador para impedir que dois membros folguem no mesmo dia.');
    }

    if (parallelConflicts.length > 0) {
      lines.push('');
      lines.push(`**Conflitos detectados (Seg–Sáb):**`);
      parallelConflicts.forEach((c) => lines.push(`- ${c}`));
      lines.push(
        '> **Como resolver:** No painel **"Proibir folga paralela"**, clique em **"Vincular e separar conflitos"** para realocar automaticamente a folga conflitante em outro dia útil/sábado livre.'
      );
    } else if (noParallelList.length > 0) {
      lines.push('- **Status paralelo:** Sem conflitos de folga em paralelo nas semanas S1–S4.');
    }

    if (sameFolgaList.length > 0) {
      lines.push('');
      lines.push(`**Vínculos para folgar igual (${sameFolgaList.length}):**`);
      sameFolgaList.forEach((item) => lines.push(`- ${item}`));
    }

    return lines.join('\n');
  }

  // 3. Cobertura / setores descobertos / Loja 1 / Loja 2
  if (
    q.includes('cobert') ||
    q.includes('descobert') ||
    q.includes('setor') ||
    q.includes('loja') ||
    q.includes('abertura') ||
    q.includes('fechamento')
  ) {
    const lines: string[] = ['### Cobertura Operacional por Setor (Matriz 546 & Filial 777)'];

    if (uncoveredAlerts.length > 0) {
      lines.push(`**Setores abaixo do efetivo mínimo configurado (${uncoveredAlerts.length} ocorrência(s) em S1–S4):**`);
      uncoveredAlerts.slice(0, 12).forEach((a) => {
        lines.push(`- **S${a.week} · ${a.day}** — ${a.storeName} / ${a.sectorTitle}: ${a.message}`);
      });
      lines.push('');
      lines.push(
        '> **Ação rápida:** Clique em **"Auto-Cobrir Todas (S1–S4)"** na barra lateral ou designe um substituto diretamente na célula em folga.'
      );
    } else {
      lines.push('- Todos os setores da Matriz 546 e da Filial 777 atingem o efetivo mínimo configurado em S1–S4!');
    }

    if (operationalAlerts.length > 0) {
      lines.push('');
      lines.push('**Alertas operacionais / afinidades:**');
      operationalAlerts.slice(0, 8).forEach((al) => lines.push(`- ${al}`));
    }

    return lines.join('\n');
  }

  // 4. PontoMais / Banco de Horas / EC 141 / CLT / Estágio
  if (
    q.includes('pontomais') ||
    q.includes('ponto') ||
    q.includes('banco') ||
    q.includes('clt') ||
    q.includes('ec 141') ||
    q.includes('almoç') ||
    q.includes('almoc') ||
    q.includes('estági') ||
    q.includes('estagi') ||
    q.includes('matheus')
  ) {
    const pmWeekly = scheduleSnapshot?.pontoMaisWeeklyHours ?? targetWeekly;
    const pmLabel = scheduleSnapshot?.pontoMaisLabel || 'Jornada Padrão PontoMais';
    return [
      '### Conformidade Legal, PontoMais & Regras da Seu Carro PE',
      `- **PontoMais (Base Formal):** Fechado em **${formatHoursSimple(pmWeekly)}/semana** (*${pmLabel}*), mantendo a conformidade de fechamento sem estourar o teto de **${targetWeekly}h/sem** da ${phaseLabel}.`,
      '- **Banco de Horas Automático:** As diferenças diárias entre a **Escala Real** executada pelos colaboradores e o **Padrão PontoMais** são apuradas automaticamente coluna a coluna (`BH: +/-`).',
      '- **Almoço obrigatório (Art. 71 CLT):** Qualquer turno superior a 6 horas contínuas (inclusive aos sábados) recebe automaticamente intervalo de repouso/alimentação.',
      '- **Interjornada (Art. 66 CLT):** Mínimo obrigatório de **11h consecutivas** entre a saída de um dia e a entrada do dia seguinte.',
      '- **Estagiário (Lei 11.788/2008 — Matheus Coutinho):** Máximo de 6h/dia e 30h/sem (24h vigentes), sem alocações antes das 12h30 em dias úteis.',
    ].join('\n');
  }

  // 4.5 Cenários 42h / Teto 8h24 / FDS prolongados
  if (
    q.includes('cenár') ||
    q.includes('cenar') ||
    q.includes('42h') ||
    q.includes('8h24') ||
    q.includes('aproveit') ||
    q.includes('prolong') ||
    q.includes('sáb') ||
    q.includes('sab')
  ) {
    const cltEmps = activeEmps.filter((e) => e.contractType !== 'ESTAGIARIO');
    const avgMonthlyClt =
      cltEmps.length > 0
        ? cltEmps.reduce((acc, e) => acc + e.monthlyHours, 0) / cltEmps.length
        : 0;
    const avgWeeklyClt = avgMonthlyClt / 4;
    const pct42 = targetWeekly > 0 ? Math.round((avgWeeklyClt / targetWeekly) * 1000) / 10 : 0;
    return [
      `### Aproveitamento das ${targetWeekly}h com Teto Diário de 8h24`,
      cltEmps.length > 0
        ? `- **Escala ativa neste momento (${cltEmps.length} CLTs):** média de **${formatHoursSimple(avgWeeklyClt)}/sem** (**${formatHoursSimple(avgMonthlyClt)}/mês**, equivalente a **${pct42}%** das ${targetWeekly}h), sem ultrapassar 8h24 líquidos/dia.`
        : '- Simulação ativa monitorada com limite diário máximo de **8h24/dia**.',
      '- **Por que alternar sábados maximiza as 42h:** na escala 5x2 (máx. 5 dias/sem) com teto de **8h24/dia**, semanas sem sábado atingem exatas **5 × 8h24 = 42h00**. Já em semanas com sábado na loja atual (`08:00–13:00` = `5h00`), o teto físico fica em **38h36**; no Cenário B (`Sáb 08:00–14:00` = `6h00` corridas + turnos escalonados até `18h00`), chega a **39h36**.',
      '- **Ranking dos 4 cenários validados (0 violações CLT e 0 descobertos S1–S4):**',
      '  1. **Prop. 3 — Cen. B Estendido 50/50:** **40h52/sem (97,3%)**, Seg–Sex `08:00–18:00`, Sáb `08:00–14:00`, `16` FDS prolongados (`Sáb→Dom→Seg`).',
      '  2. **Prop. 1 — Loja Atual 50/50 (recomendado sem mudar horário):** **40h24/sem (96,2%)**, Seg–Sex `08:00–17:30`, Sáb `08:00–13:00`, `16` FDS prolongados.',
      '  3. **Prop. 4 — Cen. B Estendido 75% Sáb:** **40h24/sem (96,2%)** com `12 CLTs + Matheus` aos sábados até `14h00` e `15` FDS prolongados.',
      '  4. **Prop. 2 — Loja Atual 75% Sáb:** **39h44/sem (94,6%)** com `12 CLTs + Matheus` aos sábados até `13h00` sem mudar horário da loja.',
    ].join('\n');
  }

  // 5. Resumo executivo completo padrão
  const lines: string[] = [
    `### Diagnóstico da Escala — ${phaseLabel}`,
    `- **Equipe monitorada:** ${emps.length} colaborador(es) (${activeEmps.length} ativos em escala regular/estágio).`,
    `- **Saldos Mensais (S1–S4):** ${closed.length} fechado(s) na meta de ${targetMonthly}h | ${shortfall.length} com horas a compensar | ${overtime.length} com saldo positivo.`,
    `- **Cobertura de Setores:** ${uncoveredAlerts.length === 0 ? '100% coberto dentro dos mínimos definidos.' : `${uncoveredAlerts.length} alerta(s) de efetivo abaixo do mínimo em S1–S4.`}`,
    `- **Conflitos de Folga Paralela:** ${parallelConflicts.length === 0 ? 'Nenhum conflito detectado.' : `${parallelConflicts.length} conflito(s) encontrado(s).`}`,
  ];

  if (shortfall.length > 0) {
    lines.push(
      `- **Atenção em horas faltantes:** ${shortfall
        .slice(0, 5)
        .map((e) => `${e.shortName} (-${formatHoursSimple(e.monthlyBalanceHours)})`)
        .join(', ')}.`
    );
  }
  if (parallelConflicts.length > 0) {
    lines.push(`- **Conflitos paralelos:** ${parallelConflicts.slice(0, 3).join(' | ')}`);
  }
  if (uncoveredAlerts.length > 0) {
    lines.push(
      `- **Setores críticos:** ${uncoveredAlerts
        .slice(0, 3)
        .map((a) => `S${a.week} ${a.day} (${a.sectorTitle})`)
        .join(', ')}.`
    );
  }

  if (contextSummary && !scheduleSnapshot) {
    lines.push('');
    lines.push(contextSummary.slice(0, 600));
  }

  lines.push('');
  lines.push(
    'Posso detalhar **saldos individuais**, **conflitos de folga paralela**, **cobertura de setores (Matriz/Filial)** ou **PontoMais & Banco de Horas**. O que deseja analisar?'
  );

  return lines.join('\n');
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // Endpoint de Saúde do Servidor
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      aiMode: hasValidGeminiKey(process.env.GEMINI_API_KEY) ? 'gemini' : 'local_assistant',
    });
  });

  // Endpoint de Chat com IA sobre a Escala
  app.post('/api/ai/chat', async (req, res) => {
    try {
      const body = req.body || {};
      const rawMessages = Array.isArray(body.messages) ? (body.messages as ChatMessageInput[]) : [];
      const contextSummary = typeof body.contextSummary === 'string' ? body.contextSummary : '';
      const scheduleSnapshot = body.scheduleSnapshot as ScheduleSnapshot | undefined;

      const lastUserMessage =
        [...rawMessages].reverse().find((m) => m.role === 'user')?.text?.trim() ||
        'Faça um diagnóstico geral da escala atual.';

      const apiKey = process.env.GEMINI_API_KEY;
      if (hasValidGeminiKey(apiKey)) {
        try {
          const ai = new GoogleGenAI({
            apiKey: apiKey!.trim(),
            httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
          });

          const systemInstruction = [
            'Você é o Assistente Especialista em Escalas Trabalhistas 5x2 (EC 141/2026, CLT e Lei do Estágio) da empresa Seu Carro PE (Loja 1 Matriz 546 e Loja 2 Filial 777).',
            'Responda SEMPRE em português do Brasil claro, objetivo, prático e usando Markdown legível.',
            'Baseie todas as suas respostas EXCLUSIVAMENTE nos dados reais da escala atual fornecidos abaixo. Nunca invente nomes de colaboradores ou números fora do contexto.',
            '',
            '=== CONTEXTO AO VIVO DA ESCALA ===',
            contextSummary || 'Nenhum contexto detalhado enviado.',
          ].join('\n');

          const conversationLines = rawMessages
            .slice(-10)
            .map((m) => `${m.role === 'user' ? 'Usuário' : 'Assistente'}: ${m.text}`)
            .join('\n');

          const candidateModels = Array.from(
            new Set([process.env.GEMINI_MODEL?.trim() || 'gemini-3.8-flash'].filter(Boolean))
          );

          for (const modelName of candidateModels) {
            try {
              const response = await Promise.race([
                ai.models.generateContent({
                  model: modelName,
                  contents: conversationLines || lastUserMessage,
                  config: {
                    systemInstruction,
                    abortSignal: AbortSignal.timeout(6000),
                  },
                }),
                new Promise<never>((_, reject) =>
                  setTimeout(() => reject(new Error('Timeout de 6s na API Gemini')), 6000)
                ),
              ]);
              const replyText = response.text?.trim();
              if (replyText) {
                return res.json({ reply: replyText, source: 'gemini', model: modelName });
              }
            } catch (modelErr) {
              console.warn(`[AI Chat] Falha no modelo ${modelName}:`, (modelErr as Error)?.message);
            }
          }
        } catch (geminiErr) {
          console.warn('[AI Chat] Erro ao chamar Gemini API, usando assistente local:', (geminiErr as Error)?.message);
        }
      }

      const fallbackReply = generateLocalScheduleAssistantReply(
        lastUserMessage,
        contextSummary,
        scheduleSnapshot
      );
      return res.json({ reply: fallbackReply, source: 'local_assistant' });
    } catch (err) {
      console.error('[AI Chat] Erro inesperado no endpoint /api/ai/chat:', err);
      return res.status(500).json({
        error: 'Não foi possível processar a solicitação do chat de IA no momento.',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`Seu Carro PE — Servidor rodando em http://localhost:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Falha crítica ao iniciar o servidor:', err);
  process.exit(1);
});
