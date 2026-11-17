import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Bot,
  Loader2,
  RotateCcw,
  Send,
  Sparkles,
  User,
  X,
} from 'lucide-react';

interface ChatMessageItem {
  id: string;
  role: 'user' | 'model';
  text: string;
  source?: 'gemini' | 'local_assistant' | 'system';
  timestamp: string;
}

interface AiScheduleChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  contextSummary: string;
  scheduleSnapshot: Record<string, unknown>;
  phaseLabel: string;
  employeesCount: number;
  parallelConflictsCount: number;
  uncoveredCount: number;
}

const QUICK_PROMPTS = [
  {
    id: 'saldo',
    label: 'Saldos & Horas Faltantes',
    prompt: 'Quais colaboradores estão com saldo de horas negativo ou devendo horas no mês?',
  },
  {
    id: 'paralela',
    label: 'Conflitos de Folga Paralela',
    prompt: 'Existe algum conflito de folga paralela ou pares vinculados atualmente?',
  },
  {
    id: 'cobertura',
    label: 'Cobertura Lojas 1 e 2',
    prompt: 'Como está a cobertura operacional dos setores nas Lojas 1 e 2 em S1–S4?',
  },
  {
    id: 'pontomais',
    label: 'PontoMais 42h & CLT',
    prompt: 'Explique como está fechado o PontoMais em 42h, banco de horas e almoço aos sábados.',
  },
];

function renderFormattedInline(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={idx} className="font-bold text-slate-900">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code
          key={idx}
          className="px-1 py-0.5 rounded bg-slate-200/80 text-slate-900 font-mono text-[10.5px]"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return (
        <em key={idx} className="italic text-slate-700">
          {part.slice(1, -1)}
        </em>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

function FormattedMarkdownText({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <div className="space-y-1.5 text-xs leading-relaxed text-slate-700">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={i} className="h-1" />;
        }
        if (trimmed.startsWith('### ')) {
          return (
            <h4 key={i} className="text-[12.5px] font-black text-slate-900 pt-1">
              {renderFormattedInline(trimmed.slice(4))}
            </h4>
          );
        }
        if (trimmed.startsWith('## ')) {
          return (
            <h3 key={i} className="text-[13px] font-black text-slate-900 pt-1">
              {renderFormattedInline(trimmed.slice(3))}
            </h3>
          );
        }
        if (trimmed.startsWith('> ')) {
          return (
            <div
              key={i}
              className="border-l-3 border-indigo-400 bg-indigo-50/70 px-2.5 py-1.5 rounded-r-lg text-[11px] text-indigo-950"
            >
              {renderFormattedInline(trimmed.slice(2))}
            </div>
          );
        }
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          return (
            <div key={i} className="flex items-start gap-1.5 pl-1">
              <span className="text-indigo-500 font-bold mt-0.5">•</span>
              <span className="flex-1">{renderFormattedInline(trimmed.slice(2))}</span>
            </div>
          );
        }
        return <p key={i}>{renderFormattedInline(trimmed)}</p>;
      })}
    </div>
  );
}

function formatNowTime(): string {
  const now = new Date();
  return `${now.getHours().toString().padStart(2, '0')}:${now
    .getMinutes()
    .toString()
    .padStart(2, '0')}`;
}

export const AiScheduleChatDrawer: React.FC<AiScheduleChatDrawerProps> = ({
  isOpen,
  onClose,
  contextSummary,
  scheduleSnapshot,
  phaseLabel,
  employeesCount,
  parallelConflictsCount,
  uncoveredCount,
}) => {
  const buildWelcomeMessage = (): ChatMessageItem => ({
    id: 'msg-welcome',
    role: 'model',
    source: 'system',
    timestamp: formatNowTime(),
    text: [
      `### Assistente da Escala — Seu Carro PE`,
      `Estou conectado aos dados ao vivo da escala (**${employeesCount} colaboradores**, ${phaseLabel}).`,
      `- **Conflitos de folga paralela:** ${
        parallelConflictsCount === 0 ? 'nenhum detectado' : `${parallelConflictsCount} ativo(s)`
      }`,
      `- **Setores descobertos (S1–S4):** ${
        uncoveredCount === 0 ? 'tudo coberto' : `${uncoveredCount} alerta(s)`
      }`,
      `Use uma pergunta rápida abaixo ou escreva sua dúvida para analisar saldos, folgas, cobertura ou regras do PontoMais.`,
    ].join('\n'),
  });

  const [messages, setMessages] = useState<ChatMessageItem[]>([buildWelcomeMessage()]);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [isOpen, messages, isSending]);

  if (!isOpen) return null;

  const sendMessageText = async (rawText: string) => {
    const trimmed = rawText.trim();
    if (!trimmed || isSending) return;

    setErrorMsg(null);
    const userMsg: ChatMessageItem = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: trimmed,
      timestamp: formatNowTime(),
    };

    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInputValue('');
    setIsSending(true);

    try {
      const apiMessages = nextHistory
        .filter((m) => m.id !== 'msg-welcome')
        .map((m) => ({
          role: m.role,
          text: m.text,
        }));

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: apiMessages,
          contextSummary,
          scheduleSnapshot,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || `Erro HTTP ${res.status}`);
      }

      const replyText =
        typeof data?.reply === 'string' && data.reply.trim()
          ? data.reply.trim()
          : 'Não recebi conteúdo de resposta do servidor.';

      const assistantMsg: ChatMessageItem = {
        id: `model-${Date.now()}`,
        role: 'model',
        source: data?.source === 'gemini' ? 'gemini' : 'local_assistant',
        text: replyText,
        timestamp: formatNowTime(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'Falha de comunicação com o servidor';
      setErrorMsg(`Não foi possível obter resposta agora: ${detail}`);
    } finally {
      setIsSending(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void sendMessageText(inputValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendMessageText(inputValue);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex justify-end"
      onClick={onClose}
    >
      <aside
        data-ai-chat-drawer="true"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md h-full bg-white shadow-2xl border-l border-slate-200 flex flex-col"
      >
        {/* Header */}
        <div className="px-4 py-3.5 bg-gradient-to-r from-indigo-700 via-blue-700 to-slate-900 text-white flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-black truncate flex items-center gap-1.5">
                Chat com IA — Copiloto da Escala
              </h3>
              <p className="text-[11px] text-indigo-100 truncate">
                {employeesCount} membros • {phaseLabel}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => {
                setMessages([buildWelcomeMessage()]);
                setErrorMsg(null);
              }}
              title="Reiniciar conversa"
              className="p-1.5 rounded-lg text-indigo-100 hover:text-white hover:bg-white/15 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              title="Fechar assistente"
              className="p-1.5 rounded-lg text-indigo-100 hover:text-white hover:bg-white/15 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Quick Prompts */}
        <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-200 shrink-0 space-y-1.5">
          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
            Perguntas rápidas sobre a escala atual
          </div>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_PROMPTS.map((qp) => (
              <button
                key={qp.id}
                type="button"
                data-ai-quick-prompt={qp.id}
                disabled={isSending}
                onClick={() => void sendMessageText(qp.prompt)}
                className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-300 transition-colors disabled:opacity-50"
              >
                {qp.label}
              </button>
            ))}
          </div>
        </div>

        {/* Messages */}
        <div
          data-ai-chat-messages="true"
          className="flex-1 overflow-y-auto p-3.5 space-y-3 bg-slate-100/70"
        >
          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                data-ai-message-role={msg.role}
                className={`flex items-start gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 shadow-2xs ${
                    isUser
                      ? 'bg-blue-600 text-white rounded-tr-xs'
                      : 'bg-white border border-slate-200 text-slate-800 rounded-tl-xs'
                  }`}
                >
                  {isUser ? (
                    <p className="text-xs leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                  ) : (
                    <FormattedMarkdownText text={msg.text} />
                  )}

                  <div
                    className={`mt-1.5 flex items-center justify-between gap-2 text-[9.5px] ${
                      isUser ? 'text-blue-100' : 'text-slate-400'
                    }`}
                  >
                    <span>
                      {msg.source === 'gemini'
                        ? 'Gemini AI'
                        : msg.source === 'local_assistant'
                        ? 'Consultor da Escala'
                        : msg.source === 'system'
                        ? 'Contexto Ao Vivo'
                        : 'Você'}
                    </span>
                    <span>{msg.timestamp}</span>
                  </div>
                </div>

                {isUser && (
                  <div className="w-7 h-7 rounded-lg bg-slate-800 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })}

          {isSending && (
            <div className="flex items-start gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="w-4 h-4" />
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-xs px-3.5 py-2.5 text-xs text-slate-600 flex items-center gap-2 shadow-2xs">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                <span>Analisando escala, saldos e conflitos...</span>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 text-xs text-rose-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Footer */}
        <form
          onSubmit={handleFormSubmit}
          className="p-3 bg-white border-t border-slate-200 shrink-0 space-y-1.5"
        >
          <div className="flex items-end gap-2">
            <textarea
              data-ai-chat-input="true"
              rows={2}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Pergunte sobre folgas paralelas, saldos de horas, cobertura ou CLT..."
              className="flex-1 resize-none px-3 py-2 text-xs border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="submit"
              data-ai-chat-send="true"
              disabled={!inputValue.trim() || isSending}
              className="px-3.5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shrink-0"
              title="Enviar pergunta"
            >
              <Send className="w-3.5 h-3.5" />
              Enviar
            </button>
          </div>
          <div className="text-[10px] text-slate-400 flex items-center justify-between">
            <span>Enter envia • Shift+Enter quebra linha</span>
            <span>Dados reais de S1–S4</span>
          </div>
        </form>
      </aside>
    </div>
  );
};
