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

## Editar turno existente — NÃO usar para mudar horários
- ⚠️ A tela **Editar** de um turno que já foi editado abre a **primeira versão** dele, não a atual. Salvar horários por ali pode desfazer correções (rodízio de 4 semanas vira 1 semana).
- Código e descrição de turno existente **não mudam** pelo SuperPortal (a alteração é ignorada).
- Ao salvar uma edição, o sistema pergunta: "aplicar somente a partir de amanhã" ou "dias futuros e anteriores (desde o último fechamento)".
- O resumo sempre lista "Jornada nos feriados: Não" — é o valor atual (checkbox desativado na empresa), não uma alteração.

## Forma correta de corrigir um turno
1. Criar um **turno novo** (prefixo `R2-`, `R3-`…) copiando o turno antigo mais parecido em "Usar configurações existentes" (aba Horários), ajustar e salvar.
2. Vincular o colaborador ao turno novo **desde a data correta** (ex.: 21/11/2026, "Início no turno" = Semana 1). O vínculo novo substitui o anterior a partir dessa data.
3. Outras formas de trocar o turno de alguém:
   - Colaboradores → marcar 2+ pessoas → **Editar selecionados** → "Turno (horário de trabalho)" → turno, data da mudança, início no turno → Editar → Sim (edição em massa).
   - Colaboradores → abrir a ficha (1 pessoa) → seção **Turno (horário de trabalho)** → escolher turno, data e semana → Salvar. A ficha mostra o histórico de turnos.
- Cuidado no modal "Usar configurações existentes": esperar ele abrir antes de clicar no seletor; um clique fora pode acertar "Remover período" e apagar a 2ª coluna de horários. Sempre conferir as 4 semanas (classificação e totais) antes de salvar.
- Ao digitar a descrição, o campo às vezes mantém um "a" inicial do placeholder (ex.: "a5x2 R2 …") — apenas cosmético.

## Turnos vigentes (desde 21/11/2026)
| Colaborador | Turno |
|---|---|
| Diana, Jair | R2-DIANA-JAIR |
| Rayssa | R2-RAYSSA |
| Rodolfo | R2-RODOLFO |
| Marcos Antonio | R2-MARCOSANT |
| Allisson | R2-ALLISSON |
| Marcos Florentino | R2-MFLORENTINO |
| Marielly | R2-MARIELLY |
| Mayana | R2-MAYANA |
| João Pedro | R2-JOAOPEDRO |
| Winona, João Alexandre | 5X2-WINONA |
| Andria | 5X2-ANDRIA |
| Adriane | 5X2-ADRIANE |
| Alefy | 5X2-ALEFY |
| Nailson | 5X2-MFLOR-NAILSON |
| Jorginho | 5X2-JORGINHO |
| Jorge Vinicius | 5X2-JORGEVINICIUS |

Turnos antigos sem vínculo (podem ser inativados): 5X2-01, 5X2-JAIR, 5X2-DIANA, 5X2-RODOLFO, 5X2-MARCOSANT, 5X2-JOAOALEX, 5X2-ALLISSON, 5X2-MARIELLY, 5X2-MAYANA, 5X2-JOAOPEDRO, ESTAG-MATHEUS.

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
