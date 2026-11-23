# Guia — VR Ponto Mais (SuperPortal VR): turnos da escala 5x2

Aprendizados da configuração feita em 23/11/2026 (escala vigente desde sábado 21/11/2026).

## Acesso
- O acesso de **gestor/admin** não fica mais no `app2.pontomais.com.br` — lá só aparece a visão de colaborador e o aviso "Seu acesso agora é pelo SuperPortal VR".
- Admin: `https://superportal-empregador.vr.com.br/pontomais/...` (empresa SEU CARRO PE).
  - Turnos: `/pontomais/turnos` · novo: `/pontomais/turnos/novo` · editar: `/pontomais/turnos/editar/<id>`
  - Colaboradores (mostra o turno de cada um): `/pontomais/colaboradores`
  - Conferência do dia (quem está de folga/trabalhando): `/pontomais/minha-equipe/resumo`
  - Espelho de ponto: `/pontomais/controle-de-ponto/<id do colaborador>`
- A sessão cai com frequência; se a página ficar em branco, recarregar ou navegar de novo pela URL.

## Como o rodízio de 4 semanas foi modelado
- **Um turno por colaborador** (tipo *Semanal*, com **4 semanas**: botão "Adicionar semana"). Nomenclatura: código `5X2-NOME`, descrição `5x2 Rodizio 4 sem - Nome (Sem1=S3 21/11)`.
- Semanas do Ponto Mais vão de **domingo a sábado**; as do projeto (S1–S4) de segunda a domingo. Como domingo é sempre DSR, os dias seg–sáb coincidem.
- Ciclo do projeto: âncora segunda 02/11/2026 = S1 (`src/utils/realCalendar.ts`). 21/11/2026 cai em **S3**.
- Mapeamento usado: **Semana 1 = S3, Semana 2 = S4, Semana 3 = S1, Semana 4 = S2**.
- Ao vincular: data **21/11/2026** e campo **"Início no turno" = Semana 1**. Esse campo é o que alinha o rodízio.
- Validação feita: Rayssa aparece "De folga" em 23/11 (S4 segunda), conforme a escala.

## Fluxo para criar um turno (mais rápido)
1. Novo turno → aba **Geral**: botão **"Usar configurações existentes"** copia as opções gerais de outro turno (não copia horários). Preencher Código e Descrição → Próximo.
2. Aba **Horários**: clicar de novo em **"Usar configurações existentes"** → copia **as 4 semanas** de outro turno (classificação + horários). Escolher como base o turno mais parecido.
3. Ajustar a **Classificação** de cada dia (Dia de trabalho / Dia de descanso) para as folgas.
4. Linha **"Preenchimento automático"** + botão **Preencher**: aplica entrada/almoço/saída a **todos os dias de trabalho de seg a sex** das 4 semanas (não mexe no sábado). Depois ajustar sábado e exceções (ex.: saída 17:24) linha a linha.
5. Para um dia **sem almoço** (ex.: estágio 13:00–17:00), deixar 2ª entrada/2ª saída vazias (selecionar campo, Ctrl+A, Delete).
6. Conferir a "Carga horária regular total" de cada semana antes de salvar.
7. **Salvar** → abre o resumo com **"Vincule colaboradores ao turno"**: escolher colaboradores, data inicial e "Início no turno" → **Salvar edição**. Mensagem esperada: "Vínculo realizado. A atualização do ponto do colaborador pode levar alguns minutos."

## Editar turno existente
- Turnos → seta da linha → **Editar**. Ao salvar aparece um resumo das alterações e depois a pergunta de a partir de quando aplicar.
- O resumo sempre lista "Jornada nos feriados: Não" — é o valor atual (checkbox desativado na empresa), não uma alteração.
- Mudar só a aba Geral (descrição) e trocar para Horários antes de salvar pode perder a alteração da descrição — salvar a descrição separadamente.

## Regras de jornada usadas (validar com a contabilidade)
- Seg–sex 08:00–17:30 com **1h06 de almoço** = 8h24/dia; sábado 08:00–17:00 com 1h = 8h; semana ≈ 41h36 (≤ 42h).
- CLT art. 71: jornada > 6h → intervalo mínimo 1h (máx. 2h); > 4h até 6h → 15 min.
- Liminar do Min. Flávio Dino (STF, ADIs 8.041/8.042, nov/2026): 42h semanais a partir de 16/12/2026; sem acordo coletivo até 15/12, até 8h24/dia em 5 dias sem hora extra sobre os 24 min. Antes de 16/12 a compensação precisa de acordo. A liminar ainda estava sob julgamento no plenário.
- Estagiário (Matheus) **não bate ponto** e não está cadastrado no Ponto Mais (Lei 11.788/2008 não exige ponto; recomendável folha de frequência). O turno `ESTAG-MATHEUS` existe mas está sem vínculo.

## Almoços intercalados (nenhum setor vazio no almoço)
| Setor | 11:30 | 12:00 | 12:30 | 13:00 |
|---|---|---|---|---|
| Vendas | Jair, Jorginho | Rayssa | Marcos Antonio | João Alexandre |
| SDR | Diana | Andria | Adriane | Winona |
| Preparação | Rodolfo | Alefy | Marcos Florentino | Allisson |
| Documentação | Marielly | — | — | Mayana |
| Outros | — | Nailson, Jorge, João Pedro | — | — |

Sábado: mesmo início de almoço, com 1h. Marielly, Mayana e João Pedro trabalham sábado 08:00–17:00.

## Fora da escala 5x2 (não alterados)
Grazielly (licença), Edvania, Lorena e Pedro Hagah continuam nos turnos antigos.
