# Log Evolutivo de Auditoria & Melhorias Inteligentes — Escala Seu Carro PE

> **Protocolo Evolutivo (Ciclo de 30 minutos):** Cada nova rodada executa `npx.cmd tsx scripts/audit_schedules.ts`, lê todas as rodadas anteriores registradas neste documento e formula uma melhoria **estritamente mais inteligente, granular e cumulativa** com base nos achados prévios — **sem repetir sugestões já documentadas**.

---

## Rodada #1 — Diagnóstico Profundo & Baseline Inicial (2026-11-14T15:04-03:00)

### 1. Telemetria Observada na Auditoria (`npx.cmd tsx scripts/audit_schedules.ts`)
- **Horário Base Lojas**: Seg–Sex `08:00–17:30`, Sáb `08:00–13:00`.
- **Falha Crítica em Cenários Legados**:
  - `scen-b` (Cenário B — Almoço 1h00): pico diário observado de **510 min (`EXCEDEU 8h24`)**, violando o teto máximo diário permitido (504 min).
  - `scen-c` (Revezamento 50/50 legado): **3 setores descobertos** no ciclo S1–S4 e apenas `89,9%` de aproveitamento semanal (`37h45/sem`).
- **Desempenho dos 4 Cenários Otimizados (0 erros de compliance, 0 setores descobertos, pico <= 504 min / 8h24 OK)**:
  1. `scen-opt-trad-5050` (Loja Atual 50/50): aproveitamento **96,2%** (`40h24/sem`), **16** FDS prolongados, dispersão mensal CLT de **10.2h**.
  2. `scen-opt-trad-3sab` (Loja Atual 75% Sáb): aproveitamento **94,6%** (`39h44/sem`), **15** FDS prolongados, dispersão mensal CLT de **10.2h**.
  3. `scen-opt-b-est-5050` (Cenário B Estendido 18h / Sáb 14h — 50/50): aproveitamento **97,3%** (`40h52/sem`), **16** FDS prolongados, dispersão mensal CLT de **7.2h**, menor interjornada **14.00h (`840 min`)** (`Diana SEX->SAB`).
  4. `scen-opt-b-est-3sab` (Cenário B Estendido 75% Sáb): aproveitamento **96,2%** (`40h24/sem`), **15** FDS prolongados, dispersão mensal CLT de **7.2h**.

### 2. Falhas Operacionais Ocultas Detectadas (Além dos Alertas Básicos de Compliance)
1. **Blackout de Almoço Simultâneo (Gargalo Intradia no Pátio & Atendimento)**:
   - Em `scen-opt-trad-3sab`, na terça-feira (`TER 12:30`), **3 de 3 (`100%`)** dos colaboradores ativos da Preparação (`Allisson + Marcos Flor. + Alefy`) saem para almoçar simultaneamente (com Rodolfo de folga no dia), deixando pátio e assistência desguarnecidos na hora do pico.
   - Em `scen-opt-trad-5050`, na quarta-feira (`QUA 12:30`), **3 de 4 (`75%`)** da Preparação (`Allisson + Marcos Flor. + Alefy`) ficam fora juntos; no SDR (`SEG 12:00`) **2 de 3 (`Andria + Diana`)** e em Vendas (`SEG 12:00`) **2 de 3 (`Jair + Rayssa`)** coincidem no mesmo horário.
   - No `scen-opt-b-est-5050` / `scen-opt-b-est-3sab`, SDR e Vendas ainda atingem **2 de 3 fora simultaneamente** nas janelas de `12:00` e `13:00`.
2. **Assimetria na Roleta de Finais de Semana Prolongados (Sáb+Dom+Seg) e Dispersão Mensal**:
   - Nos 4 cenários otimizados, **3 CLTs têm ZERO FDS prolongado** nas 4 semanas (`Andria`, `Nailson`, `João Pedro`). Enquanto `Nailson` e `João Pedro` possuem sábado fixo de folga por regra operacional/estratégica, `Andria` (vinculada em folga paralela/estratégia a `João Pedro`) acaba sempre com sábado + dia fixo distinto ou nunca recebe a combinação `Sáb S(k) -> Dom S(k) -> Seg S(k+1)`.
   - Como quem folga aos sábados cumpre `42h/sem` exatas (`5 x 8h24`) e quem trabalha sábado reduz `3h24` (sábado de 5h) ou `2h24` (sábado de 6h) na semana sem recomposição plena na semana seguinte, surge uma **dispersão mensal CLT de 10.2h** (`scen-opt-trad-*`) e **7.2h** (`scen-opt-b-est-*`).
3. **Vulnerabilidade de Especialistas Únicos (`Jorginho` & `Jorge Vinicius`) nas Folgas Úteis**:
   - `Jorginho [VENDAS L2 Externo]` e `Jorge Vinicius [SUCESSO_CLIENTE]` possuem **4 dias de folga** ao longo do ciclo S1–S4 onde o posto fica dependente de cobertura ad-hoc da liderança ou rodízio informal.

### 3. Melhoria Inteligente #1 (Ação Base p/ Construção das Próximas Rodadas)
- **Escalonamento Anti-Blackout de Almoço em Três Ondas (`11:15`, `12:15`, `13:15`) preservando exatas `8h24` (`504 min`)**:
  - Dividir SDRs (`4` cadeiras), Vendedores (`4` cadeiras) e Preparação (`4` postos) em janelas desencontradas de 1h00 (`Wave 1: 11:15–12:15`, `Wave 2: 12:15–13:15`, `Wave 3: 13:15–14:15`) conforme dia de folga na semana. Como os turnos continuam com `9h24` de amplitude total (`08:00–17:24` ou `08:36–18:00`) menos `1h00` de almoço = `8h24` exatas, a empresa **elimina 100% dos blackouts de almoço (`máx <= 1/3` fora por setor) sem acrescentar nenhum minuto na jornada diária e sem abrir mão de zero cobertura na abertura/fechamento**.
- **Próximo Alvo Evolutivo (Rodada #2, +30 min)**:
  - Calcular sobre os achados desta Rodada #1 como equilibrar o **FDS prolongado de Andria** (preservando afinidade/regra operacional com `João Pedro` / setor SDR) e reduzir a **dispersão mensal CLT de 10.2h -> <4h** aproveitando `Sáb 14h` / turnos alternados sem estourar o teto de `8h24/dia`.

---

## Rodada #2 — Auditoria de Pontas (Abertura/Fechamento), Raiz da Dispersão CLT & Regra de Andria (2026-11-14T15:31-03:00)

### 1. Evolução da Ferramenta de Auditoria (`scripts/audit_schedules.ts`)
- Adicionados **2 novos sensores quantitativos** (não existentes na Rodada #1):
  1. **Detector de Pontos Cegos de Abertura e Fechamento (`openingClosingBlindspots`)**: checa minuto-a-minuto em `S1–S4` (Seg–Sex) se algum setor opera às `08:00` (abertura) ou até `17:30`/`18:00` (fechamento) com **zero colaboradores ativos**.
  2. **Decomposição Nominal dos Extremos Mensais CLT (`monthlyExtremesLabel`)**: identifica exatamente quais colaboradores compõem o piso e o teto da dispersão mensal.

### 2. Novas Falhas Críticas Descobertas na Telemetria Atual
1. **Apagão Silencioso nos Últimos 6 Minutos do Tradicional (`20/20` dias úteis sem ninguém às `17:30`)**:
   - Em `scen-opt-trad-5050` e `scen-opt-trad-3sab`: **`LOJA_1/SDR`, `LOJA_1/VENDAS`, `LOJA_2/DOC+SC` e `LOJA_2/VENDAS-EXT` somem 20 em 20 dias úteis às `17:24`** (faltando 6 min para fechar às `17:30`). Apenas a `Preparação` (`Marcos Flor.` e `Alefy`, `08:06–17:30`) permanece até o encerramento.
2. **Pontos Cegos de Abertura (`08:00–08:36`) no Cenário B Estendido (`18h`)**:
   - Em `scen-opt-b-est-5050`: **`LOJA_2/DOC+SC` abre sem ninguém às `08:00` em 2 dias (`S1 Seg`, `S3 Ter` — folgas de `Marielly`)** porque `Mayana` e `Jorge Vinicius` entram apenas às `08:36` (`CENB_CLOSE_SLOTS`) e `Matheus` às `13:00`. Além disso, `LOJA_2/VENDAS-EXT` fica sem ninguém na abertura em `S2 Ter`/`S4 Seg` e em **20/20 fechamentos das `18:00`** (Jorginho fixado em `08:00–17:24`).
   - Em `scen-opt-b-est-3sab`: além de `LOJA_2/DOC+SC` descoberta em **3 aberturas (`S2 Seg`, `S3 Ter`, `S4 Ter`)**, **`LOJA_1/VENDAS` abre vazia às `08:00` em `S2 Seg`**! Motivo real: `João Alexandre` e `Jair` (os únicos vendedores do turno `08:00`) tiram a segunda do FDS prolongado juntos na `S2 Seg`, enquanto `Marcos Antonio` e `Rayssa` só iniciam às `08:36` — o Pátio L1 fica 36 minutos sem vendedor na abertura da segunda-feira!
3. **Causa Exata da Dispersão CLT (`10.2h` e `7.2h`) e Prova Matemática da Andria**:
   - Confirmado em `seuCarroData.ts`: `Andria` possui regra `Segunda-feira crítica (leads do FDS)` e afinidade com `João Pedro` (`Sexta crítica`). Dentro do limite `<= 42h/sem` sem horas extras, a única ponte de 3 dias `Sáb+Dom+Seg` exige folgar na Segunda-feira; logo, preservar a Segunda ativa dela impede `Sáb+Dom+Seg` sem gerar déficit de `8h24` (`33h36/sem`).
   - Porém, a dispersão máxima de `10.2h` (`scen-opt-trad-5050`: `157h48` vs `168h00`) e `7.2h` (`scen-opt-b-est-5050`: `160h48` vs `168h00`) é puxada para baixo especificamente por **`Marcos Antonio` e `Rayssa`**, únicos rotativos escalados para **3 sábados** (`1` folga de sábado) num cenário 50/50 enquanto os demais fazem 2 sábados (`161h12` / `163h12`).

### 3. Melhoria Inteligente #2 (Cumulativa sobre a Rodada #1 — Zero Repetição)
1. **Blindagem de Pontas Abertura/Fechamento com Rotação Par-Ímpar S1–S4 (Sem Custo Extra de Horas)**:
   - **No Tradicional (`08:00–17:30`)**: converter 1 colaborador de SDR (`ex: Diana` ou `Adriane`), 1–2 de Vendas L1 (`Marcos Ant.`, `Rayssa`) e 1 de Doc/SC (`Jorge` ou `Mayana`) para o turno **`08:06–17:30` c/ 1h00 de almoço (`8h24` líquidos)** — aproveitando a infraestrutura já existente de `TRAD_CLOSE_530` (e alternando almoço com `13:30–14:30` para manter zero blackout da Rodada #1). **Impacto:** cai de `20/20` para **`0/20` dias sem vendedor/SDR/Doc no fechamento das `17:30`**.
   - **No Cenário B Estendido (`08:00–18:00`)**: ativar os campos ociosos `openingShiftWindow` / `closingShiftWindow` de `EmployeeCyclePlan`:
     - Inverter **`Marcos Antonio` (`08:36`) <-> `Jair` (`08:00`)** ou garantir que **no mínimo 1 vendedor em `S2 Seg` abra às `08:00`** (elimina o apagão de `08:00–08:36` no Pátio L1 na `S2 Seg`).
     - Fazer **`Jorge Vinicius` alternar `08:00–17:24` nas semanas `S1` e `S3`** (justamente quando `Marielly` folga `Seg S1` / `Ter S3`), enquanto `Mayana` garante fechamento até `18:00` — **eliminando 100% das aberturas descobertas da Filial 777 sem afetar nenhuma folga**.
2. **Equalização da Dispersão CLT (`10.2h -> 6.8h` no Tradicional / `7.2h -> 4.8h` no Cenário B Estendido)**:
   - Migrar `Marcos Antonio` e `Rayssa` nos planos `5050Fixed` de 3 sábados para **2 sábados por mês** (`satOffWeeks` com 2 folgas de sábado em revezamento paritário com os colegas de Vendas + cobertura de `L2-EXT` nos 2 sábados de menor fluxo com apoio comercial), elevando o mínimo mensal deles de `157h48 -> 161h12` (Tradicional) e `160h48 -> 163h12` (Cenário B), além de elevar o aproveitamento global das `42h`.
   - Para **equidade emocional com `Andria`** (já que não pode folgar `Segunda` para pegar `Sáb+Dom+Seg`): priorizar sua escala em **50/50 real (2 sábados livres completos com `João Pedro`) + escolha preferencial da janela de almoço / 1 folga útil dupla em semanas compensadas por banco**, evitando que caia em escala de apenas 1 sábado livre (`75%`).

- **Próximo Alvo Evolutivo (Rodada #3, +30 min):**
  - Construir um **simulador "Sandbox Proposta v2"** dentro do `scripts/audit_schedules.ts` testando numericamente a combinação **Rodada #1 (3 ondas de almoço) + Rodada #2 (rotatividade Abertura/Fechamento em pontas + 2 sábados p/ Marcos Ant./Rayssa + Jorge em abertura nas folgas de Marielly)** e comprovar se todos os indicadores (`almoço simultâneo`, `abertura/fechamento descobertos`, `compliance`, `setores`) caem simultaneamente para **`ZERO`** mantendo o teto `<= 8h24/dia`.

---

## Rodada #3 — Validação Experimental no Sandbox v2, Scanner Completo S1–S4 & Teorema `10 < 12` dos Sábados (2026-11-14T16:02-03:00)

### 1. Evolução da Ferramenta de Auditoria (`scripts/audit_schedules.ts`)
- **Scanner de Almoço Ampliado de S1 para Todas as 4 Semanas (`S1–S4`)**: passou a varrer cada semana `1..4` (janela `11:00–15:00`) e revelou um pico oculto não detectado na Rodada #1: em `scen-opt-b-est-3sab` (`S2 SEG 13:00`), `LOJA_1/VENDAS` chegava a `2/2` (`100%` dos vendedores ativos do dia fora ao mesmo tempo — `Marcos Ant. + Rayssa`).
- **Simulador Experimental Integrado (`SIMULADOR SANDBOX v2`)**: implementada execução paralela testando `sandbox-trad-v2` e `sandbox-cenb-v2` sob todas as regras reais de compliance, cobertura e abertura/fechamento.

### 2. Resultados Comprovados na Simulação Live (Rodadas #1 + #2 Combinadas)
- **Tentativa #1 (forçando `2 sábados` para `Marcos Ant.` e `Rayssa` no Sandbox):**
  - A auditoria ao vivo **comprovou numericamente por que o plano original travou em 3 sábados** (`Setores descobertos` subiu de `0 -> 2` nos sábados S2 e S4).
  - **Prova Matemática (`10 < 12` — Princípio da Casa dos Pombos em Vendas):** São necessários `3` vendedores por sábado (`2` L1 + `1` L2) em `4` sábados = **`12` alocações/mês** para apenas **`5` vendedores CLT ativos** (`5 x 2 sáb = 10 < 12`). É matematicamente impossível dar apenas 2 sábados para todos sem deixar déficit de cobertura ou escalar liderança no sábado.
- **Execução #2 (Sandbox v2 `0-Déficit` preservando a cota de sábados e aplicando 4 Ondas de Almoço `11h/12h/13h/14h` + Pontas `17h30`/`18h00` + `Jorge Vinicius` alternado `08:00` em `S1/S3` e fechamento em `S2/S4`):**
  - `sandbox-trad-v2`: **`0` erros**, **`0` avisos**, **`0` setores descobertos**, pico `504 min` (`<= 8h24`), **`ZERO` sobreposições de almoço >= 50% em S1–S4**, e **`ZERO` apagões de abertura/fechamento em todos os setores multi-pessoa (`LOJA_1/SDR`, `LOJA_1/VENDAS`, `LOJA_1/PREPARACAO`, `LOJA_2/DOC+SC`)** (eliminando os `20/20` fechamentos descobertos das `17:30`).
  - `sandbox-cenb-v2`: **`0` erros**, **`0` avisos**, **`0` setores descobertos**, pico `504 min` (`<= 8h24`), aproveitamento **`97.3%` (`40h52/sem`)**, **`ZERO` sobreposições de almoço em S1–S4**, e **`ZERO` apagões em todos os setores multi-pessoa** (eliminando o apagão da `S2 Seg 08:00` no Pátio L1 e de `S1 Seg / S3 Ter 08:00` na Filial 777).
  - **Única pendência física isolada no Sandbox:** apenas `LOJA_2/VENDAS-EXT` (`Jorginho`, posto solo) manteve descobertas nas pontas (`2` aberturas na folga + `20` fechamentos) porque `1` única jornada de `8h24` (`9h24` totais c/ almoço) não cobre `10h00` de loja (`08:00–18:00`).

### 3. Melhoria Inteligente #3 (Construída Sobre o Limite Provado nas Rodadas #1–#2)
1. **Escala Trimestral de Equidade para Vendedores (`Ciclo M1 -> M2 -> M3` de `2,4 sáb/mês`):**
   - Já que `12 vagas / 5 vendedores = 2,4 sábados/mês`, em vez de penalizar perpetuamente `Marcos Antonio` e `Rayssa` com `3` sábados todo mês (`157h48` vs `161h12`), alternar mensalmente a dupla dos `3` sábados (`Mês 1`: `Marcos+Rayssa`; `Mês 2`: `Jair+João Alexandre`; `Mês 3`: `Jorginho + 1 vendedor L1` cobrindo L2). Resultado: **100% dos 5 vendedores convergem à mesma média exata (`159h–160h/mês` no Tradicional / `162h–163h` no Cenário B)** com **0 setores descobertos** em todos os sábados.
2. **Mitigação de Ponta em Posto Solo (`VEND-L2-EXT`) Sem Aumentar Efetivo:**
   - Alternar `Jorginho` (`S1/S3: 08:00–17:24` e `S2/S4: 08:36–18:00`) sincronizando a janela oposta com o atendimento remoto da ponta ativa do Pátio L1/SDR (que nas semanas de Sandbox têm cobertura 100% blindada às `08:00` e `18:00`), reduzindo apagões simultâneos de compra/venda externa em `50%` nas janelas de borda.

- **Próximo Alvo Evolutivo (Rodada #4, +30 min):**
  - Implementar no `scripts/audit_schedules.ts` um **Índice Ponderado de Qualidade Operacional (Score 0–100)** comparando matematicamente todos os cenários (compliance + aproveitamento 42h + blindagem de almoço + cobertura de pontas + equidade de FDS prolongados + estabilidade interjornada) e validar o efeito de alternância semanal também para **`VEND-L2-EXT` (`Jorginho`)** e **suporte na cobertura da licença de `Grazy` (`SC-1`)**.


---

## Rodada #4 — Score Ponderado (0–100), Auditoria de Risco Sênior no Sábado L2 e Sandbox v3 Sem Pontos Cegos (Executada em 2026-11-14 16:31)

- **Novos Indicadores Implementados no [scripts/audit_schedules.ts](file:///C:/Users/seuca/antigravity/Escala-Compliance-Pro-2026-11-14-5e8d9/scripts/audit_schedules.ts):**
  1. **`l2SeniorSaturdayRisk` (`S1–S4`):** detecta sábados em que **`Marielly` (Supervisão Documentação) e `Jorge Vinicius` (Pós-Venda/Sucesso do Cliente, cobertura `SC-1`) folgam juntos**, deixando apenas a auxiliar **`Mayana`** e o estagiário de 4h **`Matheus`** (`08:40–12:40`, deixando Mayana sozinha até 14:00 no Cenário B).
  2. **Índice Ponderado de Qualidade Operacional (`Score 0–100`):** ranking objetivo somando `Legal/8h24 (30)` + `Setores (20)` + `42h (15)` + `Intradia Almoço/Pontas/Sáb L2 (20)` + `Equidade FDS+Dispersão (10)` + `Interjornada (5)`.

- **Descobertas Comparativas Diretas (`RANKING GERAL` Real Observado):**
  1. **`#1 sandbox-cenb-v3` -> `90.8/100`** (`Legal/8h24: 30.0 | Set: 20.0 | 42h: 14.6 (97.3% / 40h52) | Intradia: 16.7 | Equid: 4.5 | Interj: 5.0`)
  2. **`#2 sandbox-trad-v3` -> `89.6/100`** (`Legal/8h24: 30.0 | Set: 20.0 | 42h: 14.4 (96.2% / 40h24) | Intradia: 16.7 | Equid: 3.4 | Interj: 5.0`)
  3. **`#3 sandbox-cenb-v2` -> `87.8/100`** (`+0` almoço, mas ainda sofria 2 riscos de sábado sênior em L2)
  4. **`#4 sandbox-trad-v2` -> `86.6/100`** (`+0` almoço, idem L2 Sáb)
  5. **`#5 scen-a` -> `83.6/100`** (baseline antigo superava propostas `v1` em cobertura intradia por não deixar 17:30 descoberto, apesar de só aproveitar 89.9% das 42h)
  6. **`#6 scen-opt-b-est-3sab` -> `79.5/100`** | **`#7 scen-opt-b-est-5050` -> `77.8/100`**
  7. **`#8 scen-opt-trad-5050` -> `73.9/100`** | **`#9 scen-opt-trad-3sab` -> `73.6/100`** (penalizadas em `Intradia: 1.0/20` pelos 20 dias sem fechamento 17:30 e blackouts de almoço pré-v2)
  8. **`#10 scen-c` -> `71.6/100`** (3 setores descobertos) | **`#11 scen-b` -> `68.1/100`** (estouro diário `510 min > 8h24`)

- **Melhoria Inteligente #4 (Construída Sobre Rodadas #1–#3):**
  - **Desacoplamento Matemático de Sábados + Bordas em `LOJA_2/DOC+SC` (`Sênior/Pós-Venda = ZERO Risco`):**
    - Em `Proposta 1`, `Proposta 3` e `Sandbox v2`, `Marielly` e `Jorge Vinicius` tinham exatamente `[2, 4]` como folgas de sábado (`S2` e `S4` juntos fora). Ao alterar apenas o bloco de L2 Doc+SC no `Sandbox v3` para **`Marielly` (`[1, 3]`, `S2=SEG / S4=TER`, `08:00–17:24`, almoço `11–12`)**, **`Mayana` (`[2, 3]`, `S1=TER / S4=SEG`, `08:06/08:36–17:30/18:00`, almoço `13–14`)** e **`Jorge Vinicius` (`[2, 4]`, `S1=QUA / S3=SEG`, alternando `S1 fecha / S2 abre / S3 fecha / S4 fecha com TER override 08:00–17:24`)**:
      - **`Risco Sábado L2 Doc+SC` caiu de `2 sábados (S2, S4)` para `ZERO`!** Em S1 trabalha `Jorge + Mayana`; em S2, a supervisora **`Marielly`** segura L2; em S3, **`Jorge`** segura L2 + SC; em S4, **`Marielly + Mayana`** trabalham juntas.
      - **`ZERO` pontos cegos de abertura/fechamento em Seg–Sex** na `LOJA_2/DOC+SC`, **`ZERO` picos simultâneos de almoço (`>=50%`)**, **`14.00h` de interjornada mínima** (em `Cenário B v3`; `14.50h` em `Trad v3`) e **todos os 3 colaboradores (`Marielly S1->S2`, `Jorge S2->S3`, `Mayana S3->S4`) mantiveram FDS prolongado (`Sáb+Dom+Seg`)**.
  - **Equilíbrio de Pontas para Mesa Solo (`LOJA_2/VENDAS-EXT` — `Jorginho`):** alternar semanas ímpares na abertura (`08:00–17:24` em S1/S3) e pares no fechamento (`08:06–17:30` ou `08:36–18:00` em S2/S4) reduziu a cegueira permanente do fechamento na Loja 2 Externa de **`20 dias` (100% do mês sem ninguém após 17h24)** para **`12 dias fechamento / 10 dias abertura`**, mantendo mesa solo sem violar 8h24.
  - **Governança de Transição `SC-1` (`Grazy` em `LICENCA_MATERNIDADE` vs `Jorge Vinicius` `CLT_TEMPORARIO ~6 meses`):** formalizar nos dados reais que, no retorno de `Grazy` ou término do contrato temporário de `Jorge`, a cadeira `SC-1` herda exatamente o slot alternado (`open/close` em `S1–S4`) e mantém o vínculo obrigatório de **nunca parear folga de sábado de `SC-1` com `Marielly` (`DOC-L2-SUP`)**. Além disso, para o diretor decidir hoje com segurança: **`sandbox-cenb-v3` (`90.8/100`)** é o cenário campeão absoluto se aceitar fechar 18h/14h; caso mantenha 17h30/13h, **`sandbox-trad-v3` (`89.6/100`)** vence todos os demais cenários tradicionais.

- **Próximo Alvo Evolutivo (Rodada #5, +30 min):**
  - Simular no `scripts/audit_schedules.ts` o **Cenário de Transição Pós-Licença (`Grazy` ativa em `SC-1`) e Capacidade de Atendimento nos Picos de Sábado vs Segunda (`Andria` Seg crítica / `João Pedro` Sex crítica)**, verificando também a possibilidade de elevar `sandbox-trad-v3` e `sandbox-cenb-v3` para **`>= 93/100`** com **cobertura pontual de almoço/fechamento em mesas de 1 pessoa (`Marketing`, `Financeiro`, `Vendas-Ext L2`) via backup cruzado mapeado** e consolidação opcional dos ajustes `v3` direto nas propostas oficiais da UI caso aprovado.

---

## Rodada #5 — 2026-11-14 17:06 (Auditoria Pós-Licença Grazy, Colisão Vendas L1×L2, Saúde de Almoço FIN e Score c/ Cobertura Cruzada)

### 1. Novos Sensores Implementados em `scripts/audit_schedules.ts`
- `jorginhoCollisionDays` (`Colisão Vendas-Ext vs L1 (<100%)`): verifica se alguma folga útil de `Jorginho` (`VEND-L2-EXT`) coincide com desfalque na equipe `LOJA_1/VENDAS`, evitando dupla redução no efetivo comercial.
- `l2FinLunchRiskDays` (`Almoço FIN sem Marielly`): conta quantos dos 20 dias úteis (`Seg–Sex`, `S1–S4`) `João Pedro` (`L2-FIN`) almoça sem cobertura simultânea disponível da backup `Marielly`.
- `criticalDaysMinSummary`: monitora mínimos em dias críticos mapeados (`SDR Seg`, `Vendas Sáb`, `Prep Sex`, `Doc+SC Qui`).
- `coverageAwareScore` (`c/ Cobertura Cruzada Mapeada`): score complementar ao `SCORE QUALIDADE` base (`0–100`) ponderando proteções cruzadas mapeadas.
- Generalização de `l2SeniorSaturdayRisk` (`scHolder`: `emp-jorge` ou `emp-grazy`) + novos cenários simulados `sandbox-trad-v4`, `sandbox-cenb-v4`, `pos-licenca-legado-cenb` e `sandbox-pos-licenca-v4`.

### 2. Resultados Reais da Execução (`npx.cmd tsx scripts/audit_schedules.ts`)
- **Falha Crítica Detectada no Retorno Pós-Licença (`emp-grazy` -> `CLT_ATIVO`) em Produção**:
  - `[pos-licenca-legado-cenb]` (código atual de `src/utils/scenarioProposals.ts`, onde `applyCyclePlansToTeam` referencia apenas `'emp-jorge'` e não `'emp-grazy'`): caiu para **Base `73.5/100` (`76.8/100` c/ Backup Cruzado)** (`#11` no ranking), deixando `Grazy` com **`0h00`** e **`24 dias` ausente** (`dispersão mensal CLT: 168h`), aproveitamento de **`91.9%` (`38h36/sem`)**, risco de sábado em `L2 Doc+SC` nas semanas `S2 Sáb` e `S4 Sáb` (`só Auxiliar Mayana + Estagiário 4h`), `Doc+SC Qui:3/4`, `Almoço FIN sem Marielly: 20/20 dias` e colisão `S4 Seg (3/4 L1)`.
  - `[sandbox-pos-licenca-v4]` (com herança desacoplada da cadeira `SC-1` para `Grazy`): manteve **Base `90.8/100` (`93.8/100` c/ Backup Cruzado)** (`#3` no ranking, empate técnico no teto de base com `#1`/`#2`), **`97.3%` das 42h (`40h52/sem`)**, dispersão mensal de **`7.2h`** (`mín 160h48` vs `máx 168h00`), **`0` erros**, **`0` riscos L2 Sábado** e **`0` picos simultâneos de almoço**.
- **Eliminação Completa da Colisão Vendas L2 × L1 (`v3` vs `v4`)**:
  - `[sandbox-cenb-v3]` (Base `90.8`, `94.1/100` c/ Backup Cruzado) e `[sandbox-trad-v3]` (Base `89.6`, `92.9/100` c/ Backup Cruzado) sofriam colisão em **`S4 Seg (3/4 L1)`** quando `Jorginho` folgava no mesmo dia que `Marcos Ant.`.
  - `[sandbox-cenb-v4]` (**Base `90.8/100`**, **`93.8/100` c/ Backup Cruzado**, `#2`) e `[sandbox-trad-v4]` (**Base `89.6/100`**, **`92.6/100` c/ Backup Cruzado**, `#5`) rearranjaram o rodízio de `VENDAS` (`João Alex.` S4->S1, `Jorginho` folgando `S1 Qua` e `S3 Seg`, `Jair` S1->S2, `Marcos Ant.` S1->S2 cobrindo `VEND-L2-EXT` em `S4`, `Rayssa` S3->S4 cobrindo `VEND-L2-EXT` em `S2`) e alcançaram **`Colisão Vendas-Ext vs L1 (<100%): ZERO (4/4 L1 em TODAS as folgas úteis!)`**, com **`16 FDS prolongados`**, pico diário de **`504 min` (`<= 8h24`)** e **`0` erros**.
- **Salto na Saúde do Almoço `L2-FIN` (`João Pedro` × `Marielly`)**:
  - Todas as 4 propostas legadas (`scen-opt-trad-5050`, `scen-opt-trad-3sab`, `scen-opt-b-est-5050`, `scen-opt-b-est-3sab`) registraram **`20/20 dias` de Almoço FIN sem Marielly**.
  - `sandbox-trad-v2/v3/v4`, `sandbox-cenb-v2/v3/v4` e `sandbox-pos-licenca-v4` reduziram essa vulnerabilidade de `20/20` para apenas **`2/20 dias`** (`90%` dos dias úteis com backup disponível às `12:00–13:00`).
- **Gargalos Residuais Mapeados**:
  - Em `sandbox-cenb-v4`, `LOJA_2/VENDAS-EXT` ainda apresenta `12 dias` sem ninguém na abertura (`08:00`) e `10 dias` sem ninguém no fechamento (`18:00`), e `SDR Seg` opera em `3/4` por conta das folgas de segunda-feira ligadas aos FDS prolongados; além disso, `3 CLTs` permanecem com `ZERO FDS prolongado` (`Andria` SDR, `Nailson` MARKETING, `João Pedro` FINANCEIRO).

### 3. Melhoria Inteligente #5 (Ação Recomendada para o Código de Produção)
1. **Desacoplar `SC-1` por Função/Cadeira em `src/utils/scenarioProposals.ts`**: atualizar `applyCyclePlansToTeam` para aplicar o plano de `SC-1` dinamicamente ao titular ativo (`emp-jorge` ou `emp-grazy` quando em `CLT_ATIVO`), prevenindo imediatamente a queda de score de `90.8` para `73.5` no pós-licença.
2. **Promover a Matriz `v4` (`S1 Qua` / `S3 Seg` + 4 Ondas de Almoço) para os Cenários Oficiais**: eliminar a colisão `S4 Seg (3/4 L1)` de Vendas e cortar o déficit de almoço do Financeiro de `20/20` para `2/20 dias` direto na geração nativa do app.
3. **Alavanca Residual de Almoço FIN (`2/20` -> `0/20`)**: alternar apenas os 2 dias de folga de `Marielly` ou ajustar a janela de almoço de `João Pedro` nos dias exatos em que `Marielly` folga (sem afetar `Doc+SC Qui:4/4`).

### 4. Próximo Alvo Evolutivo (Rodada #6, +30 min)
- Implementar no código de produção (`src/utils/scenarioProposals.ts`) a herança dinâmica de `SC-1` (`emp-jorge` / `emp-grazy`) + blindagem `v4` com 4 ondas de almoço e cobertura zero-risco L2 no sábado, validar com suíte de testes unitários e investigar a redução de `Almoço FIN sem Marielly` de `2/20` para `0/20` bem como uma rotação trimestral (12 semanas) para incluir `Andria` (`SDR`) nos FDS prolongados sem derrubar `SDR Seg` abaixo de `3/4`.

---

## Rodada #6 — 2026-11-14 17:34 (Colisões Internas `< n-1`, Teorema das 4 Segundas, `3Sab v6` Blindado & Auditoria Trimestral 12 Semanas)

### 1. Novos Sensores e Simuladores Adicionados em `scripts/audit_schedules.ts`
- **`internalWeekdayCollisions` (`Colisão Interna < n-1 no setor útil`)**: varre `S1–S4` (`Seg–Sex`) e acusa sempre que `>= 2` CLTs do mesmo setor multi-pessoa folgam juntos (`< 3/4` em `L1-SDR`, `L1-VENDAS`, `L1-PREP` ou `< 2/3` em `L2-DOC+SC CLT`).
- **`sandbox-trad-3sab-v6` & `sandbox-cenb-3sab-v6`**: corrige as colisões ocultas dos cenários 75% de sábado (`S2 Seg` e `S4 Ter`) mantendo `100%` dos FDS prolongados em Vendas.
- **`runQuarterly12WeekComparison()` (`12 Semanas / M1 -> M2 -> M3`)**: compara 3 meses consecutivos reais do modelo atual (`Cenário B 50/50 x 3`) contra o ciclo trimestral `Rodada #6` (equidade de sábados em Vendas + `1` FDS prolongado/trimestre para `Andria`).

### 2. Resultados Comprovados na Execução (`npx.cmd tsx scripts/audit_schedules.ts`)
- **Desmascaramento do Custo Oculto do `Sandbox v4` & Teorema Pareto-Ótimo das 4 Segundas (`4 Segundas < 5 Vendedores`)**:
  - O novo sensor revelou que o `v4` (`sandbox-cenb-v4` / `sandbox-trad-v4` / `sandbox-pos-licenca-v4`), ao tentar zerar a sobreposição de `Jorginho` com `L1`, gerou **2 colisões internas graves em `L1-VENDAS`**: `S2 Seg (2/4 -> Jair+Marcos Ant.)` e `S3 Ter (2/4 -> João Alex.+Marcos Ant.)` — derrubando `activeL1 < 3` (razão exata pela qual `v4` caiu de `94.1` para `93.8`).
  - **Prova estrutural em `4` semanas:** como `5` vendedores exigem `5` Segundas para terem FDS prolongado num mês de apenas `4` Segundas, uma dupla é inevitável; o **`[sandbox-cenb-v3]` (`90.8 Base | 94.1 c/ Backup Cruzado`, `#1` absoluto)** é **Pareto-ótimo** no ciclo mensal porque a única dupla ocorre entre setores (`S4 Seg`: `Marcos Ant. L1` + `Jorginho L2`), preservando **`ZERO` colisões internas `< 3/4` em todo o mês (`activeL1 >= 3` cobre `VEND-L2-EXT`)**.
- **Falha Crítica Corrigida nos Cenários Oficiais `75% Sábados` (`scen-opt-*-3sab` -> `3sab-v6`)**:
  - Os cenários oficiais `scen-opt-trad-3sab` e `scen-opt-b-est-3sab` acumularam **3 colisões `< 3/4`**: `L1-SDR S4 Ter (2/4 -> Andria+Diana)`, `L1-VENDAS S2 Seg (2/4 -> Jair+João Alex., causando apagão às 08:00)` e `L1-VENDAS S3 Ter (2/4 -> Jair+Rayssa)`.
  - **`[sandbox-cenb-3sab-v6]` saltou de `79.5 -> 90.5 Base` (`82.6 -> 93.9 c/ Backup Cruzado`, `#2` geral)** e **`[sandbox-trad-3sab-v6]` subiu de `73.6 -> 89.2 Base` (`73.6 -> 92.6 c/ Backup Cruzado`, `#7`)**, ambos com **`ZERO` colisões internas `< n-1`**, **`ZERO` apagões abertura/fechamento em setores multi-pessoa (`L1+L2 Doc+SC`)**, **`ZERO` picos simultâneos de almoço**, **`ZERO` risco sábado L2**, `Almoço FIN sem Marielly` caindo de `20/20 -> 3/20 dias` e `15 FDS prolongados`.
- **Auditoria Trimestral Real de 12 Semanas (`M1 -> M2 -> M3`)**:
  - **Atual `Cenário B 50/50 x 3`:** `0` erros, mas **`6` riscos sábado L2 Doc+SC**, **`60/60 dias úteis` de déficit almoço FIN**, **`0` FDS prolongados para `Andria`**, e **Vendas desigual `[6T/6F (489h36), 6T/6F, 6T/6F vs 9T/3F (482h24) para Marcos Ant. e Rayssa]`** (`dispersão trimestral 7.2h` / **3 sábados extras** concentrados sempre na mesma dupla).
  - **`Rodada #6 Trimestral Pareto-Ótimo` (`M1 v3 + M2 Rotação + M3 Equidade`):** `0` erros, `0` setores descobertos, **`0` riscos sábado L2 Doc+SC**, **`ZERO` colisões internas `< n-1` em todos os `60` dias úteis do trimestre**, **`Déficit Almoço FIN: 6/60 dias úteis`** (`-90%`), **Vendas equalizada em `[7T/5F (487h12) x4, 8T/4F (484h48) x1]` (`dispersão trimestral 7.2h -> 2.4h`, corte de `66,7%`)**, e **`Andria (SDR)` recebe `1` FDS Prolongado no trimestre (`S5 Sáb -> S6 Seg`) mantendo `SDR Seg >= 3/4`**.

### 3. Melhoria Inteligente #6 (Cumulativa — Zero Repetição)
1. **Substituir a lógica `v4` pela `v3` Pareto-Ótima (com herança `SC-1` `emp-jorge/emp-grazy`) + `3sab-v6`**: em vez de tentar forçar zero colisão inter-lojas em 4 semanas às custas de `2/4` em L1 (`v4`), aplicar **`v3` no 50/50** e **`3sab-v6` no 75%** (`Jorginho` folga `S1 Sáb` junto com `João Alex.`, `Rayssa` cobre `L2-EXT` em `S1 Sáb`, `Diana` passa p/ `S4 Qui`, `Jorge/SC-1` cobre `08:00` nas folgas úteis de `Marielly` via `dayOverride`). Isso elimina simultaneamente as colisões `2/4` de `SDR` e `VENDAS` na produção sem reduzir `FDS prolongados`.
2. **Motor Trimestral `M1->M2->M3` para Zerar Injustiça de Sábados & Incluir `Andria`**: rotacionar mensalmente a cota `8` vs `7` sábados em Vendas (`[7,7,7,7,8]` em 12 sábados) e liberar `1` Segunda-feira de `Andria` a cada 12 semanas (`M2 S6 Seg`, permutada com `Adriane`) com respaldo direto da gerência (`Edvania/Lorena`) e `3/4` SDRs ativas.

### 4. Próximo Alvo Evolutivo (Rodada #7, +30 min)
- Auditar **equidade de carga de turno (`08:00` vs fechamento `17h30/18h00`) entre membros do mesmo setor** (`M1–M3`) e **teste de estresse para cobertura de Férias / Contingência de 1 dia (`Nailson` férias jan/2027 com `Igor/Lorena`, `Matheus` estagiário ausente em período de provas, e simulação de atestado de 1 dia no dia crítico de cada setor)** para medir a resiliência real da escala fora das condições ideais.

---

## Rodada #7 — Auditoria Trimestral de Equidade Intradia (Janelas 08h/18h + Zeladoria) & Testes de Estresse Reais (`coverage.ts`)

**Executado em**: `2026-11-14T21:05:36Z` (`npm.cmd run lint` + `npx.cmd tsx scripts/audit_schedules.ts` via motor real `calculateSectorDailyCoverage` — [audit_schedules.ts](file:///C:/Users/seuca/antigravity/Escala-Compliance-Pro-2026-11-14-5e8d9/scripts/audit_schedules.ts))

### 1. Falha Estrutural Descoberta (Viés Permanente de Janela 18h + Cegueira Matinal de Zeladoria no `Cenário B v3` Fixo)
Ao estender a auditoria trimestral (`M1 -> M2 -> M3`) para medir turnos intradia nos `60` dias úteis (`Seg–Sex`):
- **Concentração injusta de fechamento `18:00` e almoço extremo (`11h`/`14h`)**: mantendo janelas fixas (`[sandbox-cenb-v3] × 3 meses`), o gap de turnos de fechamento dentro do mesmo setor chegava a **`54t` (`0` vs `54` fechamentos)** em `L1-SDR`, `L1-PREP` e `L2-DOC+SC`, e **`51t` (`0` vs `51`)** em `L1-VENDAS`.
- **Serviços Gerais / Zeladoria (`Marcos Flor.` + `Alefy`) ausente às `08:00`**: como `Allisson` e `Rodolfo` monopolizavam `08:00–17:24` enquanto `Marcos Flor.` e `Alefy` ficavam ambos em `08:36–18:00`, a matriz passava **`60/60 dias úteis (100% do trimestre)` sem nenhum colaborador de Zeladoria na abertura das `08:00`**.
- **Invariante crítica do `L2-FIN` (`Marielly` + `João Pedro`)**: testar mover `Marielly` para `08:36–18:00` (`almoço 13h–14h`) gerou pontos cegos de abertura/fechamento em `L2-DOC+SC` (`S1 Ter, S2 Seg, S4 Seg, S4 Ter`) e dessincronizaria o almoço de `Marielly` com a presença matinal de `João Pedro` (`08:00–12:00`), provando que `Marielly` deve permanecer **âncora em `08:00–17:24` (`11:00–12:00`)** nos 3 meses.

### 2. Melhoria Inteligente #7 — Rotação Trimestral de Turnos `M1 -> M2 -> M3 (quinzenal em M3)` com Pareamento de Zeladoria e Ancoragem de `L2-FIN`
Aplicando troca mensal (`M1 -> M2`) com quebra quinzenal (`S1–S2` vs `S3–S4`) em `M3` sobre a base `Pareto-Ótima` da Rodada #6 — pareando `1` Zeladoria às `08:00` + `1` às `18:00` em `L1-PREP` (`Allisson+Marcos Flor.` ↔ `Rodolfo+Alefy`) e alternando `Mayana` para `08:00–17:24 (13h–14h)` nos dias de `S1/S3/S4` em que `Jorge` cobre `18:00` (`M2` e `M3`), sem mover `Marielly`:

| Indicador Trimestral (60d úteis / 12 sem) | Baseline `Cenário B v3 Fixo × 3m` | `Rodada #7 Rotativo (M1+M2+M3)` | Ganho Verificado |
| --- | --- | --- | --- |
| Saúde CLT / Colisões `< n-1` / Blindspots fora Ext. | `0 erros / 0 / ZERO (66)` | `0 erros / 0 / ZERO (67)` | **100% seguro** |
| Menor interjornada / Déficit almoço `L2-FIN` | `14.0h` / `6/60d` | `14.0h` / `6/60d` | **Preservado** |
| Gap Fechamento / Almoço Ext. em `L1-SDR` | `54t` (`0 vs 54`) / `54d` | **`0t` (`27F/27A` todos) / `0d` (`27x` todos)** | **Equidade 100%** |
| Gap Fechamento / Almoço Ext. em `L1-VENDAS` | `51t` (`0 vs 51`) / `54d` | **`2t` (`25–27F`) / `18d`** | **-96% / -67%** |
| Gap Fechamento / Almoço Ext. em `L1-PREP` | `54t` (`0 vs 54`) / `54d` | **`0t` (`27F/27A` todos) / `18d`** | **-100% / -67%** |
| Fechamentos de `Mayana` / Gap `L2-DOC+SC` | `54F/0A` (`Gap 54t`) | **`34F/20A` (`Gap 36t`, Jorge `36F/18A`)** | **-20 fechamentos** |
| Zeladoria sem abertura `08:00` (em `60d` úteis) | `60/60 dias (100%)` | **`6/60 dias (10%)` — só nas 6 folgas** | **-90% de cegueira** |

### 3. Testes de Estresse Reais (`RODADA #7B` via `calculateSectorDailyCoverage`)
Simulações executadas dia a dia (`S1–S4 × Seg–Sáb`) diretamente sobre [coverage.ts](file:///C:/Users/seuca/antigravity/Escala-Compliance-Pro-2026-11-14-5e8d9/src/utils/coverage.ts):
1. **Matriz `N-1` de Falta Imprevista de 1 Dia (`360` dias-colaborador CLT)**:
   - **`[scen-opt-b-est-5050]` & `[sandbox-cenb-v3]`**: **`25/360` faltas sensíveis (`6.9%`)** -> **`9` em `Seg–Sex` vs `16` aos `Sábados`** (com `4` quebras em `L2-VENDAS-EXT`), `CRÍTICO=13` (`L1-SDR:8, L2-VENDAS-EXT:7, L2-FIN:6, L1-VENDAS:4`). Ou seja, o campeão `50/50 v3` (`94.1/100`) concentra **`64%` das suas vulnerabilidades N-1 aos sábados**.
   - **`[sandbox-cenb-3sab-v6]` (`75% Sáb`)**: **`17/360` faltas sensíveis (`4.7%`, `-32%` no total)** -> **derruba vulnerabilidades de Sábado de `16` para apenas `1` (`-93.8%`)**, blindando `L1-SDR`, `L1-VENDAS` e `L2-DOC+SC` contra qualquer falta no sábado. Em contrapartida, como concede `3` folgas úteis no mês aos CLTs, eleva a sensibilidade útil para **`Seg–Sex=16`** (`CRÍTICO=17`, concentrados em `L2-VENDAS-EXT:10` e `L2-FIN:7`).
2. **Sábados em `LOJA_2/L2-DOC+SC` (`08:00–14:00`) & Ausência do Estagiário `Matheus` (`08:40–12:40`)**:
   - Nos cenários `50/50` (`scen-opt-b-est-5050` e `sandbox-cenb-v3`), `2/4` sábados operam com apenas **`1 CLT`**, criando **`4.0h/mês`** com somente `1` pessoa física na loja (`08:00–08:40` e `12:40–14:00`) com `Matheus`, saltando para **`12.0h/mês` solo** caso `Matheus` falte (`0p=0.0h`, `Doc alerta Sáb=0/4`).
   - Em **`[sandbox-cenb-3sab-v6]`**, há `2+ CLTs` em `4/4` sábados: **`0.0h` solo tanto com `Matheus` quanto sem `Matheus`**.
3. **Férias Programadas de `Nailson` (`L1-MKT`, jan/2027 — `20` dias úteis)**:
   - **`20/20` dias úteis (`~168h/mês`)** ficam com `0 CLT` nativo em `L1-MKT`, totalmente absorvidos por `Igor (Liderança)` no motor de cobertura (`20/20`), gerando **`2/20` dias (`v3`)** e **`3/20` dias (`3sab-v6`)** de **sobrecarga dupla** em que `L1-MKT = 0 CLT` coincide exatamente com a folga útil de `Marielly` no `L2-FIN` (ficando apenas o Jovem Aprendiz `João Pedro` até `12h00`).

### 4. Ranking Atualizado (`Base / Cobertura Cruzada Mapeada`) — Top Contenders
- **#1 `[sandbox-cenb-v3]`**: `90.8` base / **`94.1/100`** (`50/50`: máxima resiliência `Seg–Sex`, porém `16` faltas N-1 sensíveis e `4.0h–12.0h` solo em `DOC+SC` aos sábados).
- **#2 `[sandbox-cenb-3sab-v6]`**: `90.5` base / **`93.9/100`** (`75% Sáb`: **`-93.8%` de risco N-1 aos sábados (`1` vs `16`)** e `0.0h` solo em `DOC+SC`, útil como alternativa anti-absenteísmo de sábado).
- **#5 `[sandbox-trad-v3]`** (`89.6 / 92.9`) e **#7 `[sandbox-trad-3sab-v6]`** (`89.2 / 92.6`): líderes quando a abertura/fechamento padrão `08:00–17:30 / Sáb 08:00–13:00` é exigida.

### 5. Próximo Alvo Evolutivo (Rodada #8, +30 min)
1. **Protocolo Anti-Falta Dinâmico (`Banco de Remanejamento N-1`)**: modelar no simulador exatamente qual par entre lojas/setores (`Jair/Rayssa -> VENDAS-EXT`, `Allisson/João Alex. -> DOC/FIN`, `Andria -> RECEPÇÃO/MKT`) zera os `25` casos (`v3`) e `17` casos (`3sab-v6`) da matriz `N-1`, criando uma matriz automática "se faltar X no dia Y -> quem move de janela/cadeira com zero violação `< 11h` e zero colisão `<= 50%`".
2. **Mitigação Específica para Janeiro/2027 (`Férias Nailson`)**: simular um mês especial `jan/2027` travando `Marielly` em `TER/QUA` para evitar colisão `Seg/Qui`, pré-alocando `1–2 blocos/sem` de apoio operacional de `Andria`/`Rayssa` em triagem/postagens sem furar `minW` de `L1-SDR` (`2/4`) nem `L1-VENDAS` (`>= 3/4`).
3. **Promoção Segura para Produção (`src/utils/scenarioProposals.ts`)**: assim que o usuário escolher entre os 4 campeões comparados (ou pedir promoção direta), portar `v3/v6/v7-rotativo` para a UI do app e atualizar os testes unitários em `src/utils/*.test.ts`.


---

## Rodada #8 (Evolutiva sobre Rodadas #1–#7 — Arquitetura Híbrida Setor-Seletiva, Banco Dinâmico N-1 & Contingência `jan/2027`)

*Data/hora da auditoria real (`npx.cmd tsx scripts/audit_schedules.ts`): `2026-11-14T21:33:32.200Z` | Exit code `0` (`npm.cmd run lint` + auditoria de `18` cenários)*

### 1. Novo Salto Arquitetural: `[sandbox-cenb-hibrido-v8]` (Híbrido Setor-Seletivo)
Na Rodada #7, detectou-se um dilema estrutural: o **`50/50` (`v3`)** concentrava **`16` vulnerabilidades N-1 aos sábados** e até `4.0h–12.0h/mês` de operação solo em `LOJA_2/DOC+SC`, enquanto o **`75% Sáb` (`3sab-v6`)** zerava o sábado (`1` alerta N-1 e `0.0h` solo), mas elevava a fragilidade `Seg–Sex` de `9` para `16` por conceder `3` folgas úteis a especialistas únicos (`Marielly`, `Jorginho` e `L1-PREP`).
- **A solução da Rodada #8 (`buildHybridSelectiveV8` em [audit_schedules.ts](file:///C:/Users/seuca/antigravity/Escala-Compliance-Pro-2026-11-14-5e8d9/scripts/audit_schedules.ts))**: aplicar **`75%` de sábado (`3` sábados trabalhados + `3` folgas em `Seg–Sex`) apenas nos setores multi-pessoa de atendimento/retaguarda (`L1-SDR`, `L1-VENDAS` e `Jorge/Mayana` em `DOC+SC`)**, mantendo **os especialistas/âncoras críticos em `50/50` (`2` folgas úteis no mês)**: `Marielly` (`L2-FIN`), `Jorginho` (`L2-VENDAS-EXT`), `L1-PREP` (`4` membros), além dos fixos `Nailson` (`L1-MKT`) e `João Pedro` (`L2-FIN`).
- **Resultados medidos no `[sandbox-cenb-hibrido-v8]`**:
  - **Score**: **`89.7/100`** base / **`93.0/100`** com cobertura cruzada (`Legal/8h24: 30.0/30 | Setores: 20.0/20 | 42h: 14.5/15 [96.7%, média 40h36/sem, pico 504 min, dispersão 7.2h] | Intradia: 16.7/20 | Equid: 3.5/10 | Interj: 5.0/5 [mín 14.00h Winona]`), **`0` erros CLT**, **`0` colisões `< n-1` em dias úteis**, **`0` colisões `Vendas-Ext vs L1`**, **`0` picos de almoço simultâneo** e **`2/20` dias** de déficit de almoço em `L2-FIN`.
  - **Corte de `-52%` na fragilidade `N-1`**: caiu de **`25/360` (`6.9%`)** no `v3` e **`17/360` (`4.7%`)** no `3sab-v6` para **`12/360` (`3.3%`)** (`Seg–Sex = 6` somente em `L2-FIN`, `Sáb = 6` somente por remanejamento interno de `L2-VENDAS-EXT`). **Zero risco `N-1` em `L1-SDR`, `L1-VENDAS`, `L1-PREP`, `L2-DOC` e `L2-SC`** em todos os `24` dias úteis/sábados!
  - **Blindagem total de `LOJA_2/DOC+SC` aos sábados**: `0/4` sábados com `1 CLT` -> **`0.0h` solo tanto com `Matheus` quanto sem `Matheus`**.
  - *Trade-off explícito do ranking (`#5` vs `#1`)*: os `14` FDS prolongados (`Equid: 3.5/10`) penalizaram `1.0` ponto de score em relação ao `v3` (`#1`, `94.1`) porque `Jorginho` manteve `{S1: QUI, S3: QUI}` em vez de `{S3: SEG}` para preservar zero colisão útil em `VENDAS` — facilmente reversível no rodízio trimestral `M2`.

### 2. Matriz Dinâmica de Remanejamento `N-1` (`RODADA #8A`: Camada 1 CLT R\$0 vs Camada 2 Liderança)
O novo solver `runN1RedeploymentSolver()` cruzou todas as `360` simulações `N-1` (`S1–S4 × Seg–Sáb`) usando os backups oficiais de `SECTOR_DEFINITIONS` ([coverage.ts](file:///C:/Users/seuca/antigravity/Escala-Compliance-Pro-2026-11-14-5e8d9/src/utils/coverage.ts)):

| Cenário Auditado | Casos `N-1` Sensíveis (`360d`) | **Camada 1 (`CLT R$ 0`)** | **Camada 2 (Liderança)** | Quem Puxa na Liderança & Redução |
| :--- | :---: | :---: | :---: | :--- |
| `[sandbox-cenb-v3]` (`50/50`) | `25` (`6.9%`) | `15` | `10` | `8× Edvania` (`L1-SDR` aos sábados) + `2× Igor` (`L2-FIN`) — **`25/25` mitigados** |
| `[sandbox-cenb-3sab-v6]` (`75% Sáb`) | `17` (`4.7%`) | `14` | `3` | `3× Igor` (`L2-FIN` em `S2 SEG`, `S3 TER`, `S4 TER`) — **`0× Edvania`** — **`17/17` mitigados** |
| **`[sandbox-cenb-hibrido-v8]` (Híbrido)** | **`12` (`3.3%`)** | **`10`** | **`2`** | Apenas `2× Igor` (`L2-FIN` se `João Pedro` faltar em `S1 TER` ou `S3 SEG`); **`-80%` na Liderança (`10 -> 2`)** — **`12/12` mitigados** |

- **Mecanismo exato da Camada 1 em `[sandbox-cenb-hibrido-v8]` (`10/12` a custo R\$ 0)**:
  - `4× Sextas-feiras` (`S1/S2/S3/S4 SEX`): se `João Pedro` faltar em `L2-FIN`, **aloca-se `Marielly -> FIN-1` em tempo integral**, mantendo `Jorge + Mayana = 2/2 >= minW(2)` em `L2-DOC`. *(Isso supera o `blockedDays: ['SEX']` do backup parcial de almoço porque `Marielly` deixa de dividir atenção com `DOC-SUP` no dia em que `DOC+SC` está `100%` completo).*
  - `6× Sábados` (`S2/S4 SÁB`): se um vendedor `L2-VENDAS-EXT` faltar, **move-se um par de `L1-VENDAS` (`João Alex.`, `Marcos Ant.` ou `Jair`)**, pois `L1-VENDAS` opera com `>= 3` ativos.

### 3. Contingência Férias `Nailson` (`jan/2027`) & Correção Cadastral (`RODADA #8B`)
- **Correção cadastral verificada em [seuCarroData.ts](file:///C:/Users/seuca/antigravity/Escala-Compliance-Pro-2026-11-14-5e8d9/src/data/seuCarroData.ts)**: `emp-joao-pedro` (`FIN-1`) é **`CLT_ATIVO` (`42h/sem`, `08:00–17:30`, `Sexta crítica`)** — o estagiário é `emp-matheus` (`DOC-EST`). Portanto, a sobrecarga dupla registrada na Rodada #7 (`2/20` dias úteis em `jan/2027`) refere-se à ausência de cobertura no **intervalo de almoço (`12h–13h`) de `L2-FIN`** quando `Marielly` folga (não a expediente encerrado ao meio-dia).
- **Plano Especial `jan/2027` (`20` dias úteis, `~168h/mês` de `L1-MKT` com `0 CLT`)**:
  - **Em `[sandbox-cenb-v3]`**: blocos programados de **`1.5h/dia`** com **`Andria` (`L1-SDR >= 3/4`) + `Rayssa` (`L1-VENDAS >= 3/4`)** cobrem **`52.5h/mês` (`31.3%` das `168h`)** sem furar nenhum piso mínimo, reduzindo a carga residual de `Igor/Lorena` para **`115.5h/mês`**; nos **`2/20`** dias de conflito `Marielly OFF`, `Allisson` está livre (`L1-PREP > 2` em `2/2`) para cobrir `L2`.
  - **Em `[sandbox-cenb-hibrido-v8]`**: os mesmos blocos preservam todos os pisos mínimos e geram **`51.0h/mês` (`30.4%` das `168h`)** (carga residual `Igor/Lorena = 117.0h/mês`), também com `Allisson` livre em `L1-PREP > 2` nos **`2/2`** dias de folga de `Marielly` (`S1 TER`, `S3 SEG`).

### 4. Ranking Geral Atualizado (`Top 6` de `18` cenários auditados)
1. `#1 [sandbox-cenb-v3]`: `90.8` base / **`94.1/100`** (`N-1: 25/360`, `Camada 2 Liderança: 10`)
2. `#2 [sandbox-cenb-3sab-v6]`: `90.5` base / **`93.9/100`** (`N-1: 17/360`, `Camada 2 Liderança: 3`)
3. `#3 [sandbox-cenb-v4]`: `90.8` base / **`93.8/100`**
4. `#4 [sandbox-pos-licenca-v4]`: `90.8` base / **`93.8/100`**
5. `#5 [sandbox-cenb-hibrido-v8]`: `89.7` base / **`93.0/100`** (**`N-1: 12/360` — recorde absoluto de resiliência `-52%`**, **`Camada 2 Liderança: 2` (`-80%`)**, **`0.0h` solo Sábado DOC+SC**)
6. `#6 [sandbox-trad-v3]`: `89.6` base / **`92.9/100`** (líder horário padrão `08:00–17:30 / Sáb 08:00–13:00`)

### 5. Próximo Alvo Evolutivo (Rodada #9, +30 min)
1. **Otimização Final de `Equid` no Híbrido (`[sandbox-cenb-hibrido-v9]`)**: ajustar apenas `Jorginho` (`{S1: QUI, S3: SEG}` + pareamento `L1-VENDAS`) e redistribuir `1` folga de sexta/segunda em `L1-VENDAS` para elevar `Equid` de `3.5/10` -> `>= 4.5/10` (`FDS prolongados >= 16`), buscando combinar o **`#1` no Ranking (`~94.0/100`) com o recorde `N-1` (`<= 12/360`)** no mesmo cenário.
2. **Projeção Sazonal de Feriados Reais (`calendário nov–dez/2026 e jan/2027`)**: cruzar os dias úteis e feriados estaduais/nacionais de PE nos turnos reais (especialmente `15/11`, `20/11`, `08/12`, `25/12`, `01/01`) usando `src/utils/holidays.ts` e `coverage.ts` para medir efeito real nas `42h/sem` e folgas compensatórias.
3. **Promoção Segura para Produção (`src/utils/scenarioProposals.ts`)**: aguardando decisão do usuário entre as opções numeradas para promover o modelo campeão + rodízio trimestral + banco `N-1` na interface e suíte de testes unitários.


---

## Rodada #9 (Evolutiva sobre Rodadas #1–#8 — Equilíbrio `#2` Geral no Híbrido `v9` & Projeção Sazonal no Calendário Real `Nov/2026–Jan/2027`)

*Data/hora da auditoria real (`npx.cmd tsx scripts/audit_schedules.ts`): `2026-11-14T22:01:34.716Z` | Exit code `0` (`npm.cmd run lint` + `19` cenários auditados via [realCalendar.ts](file:///C:/Users/seuca/antigravity/Escala-Compliance-Pro-2026-11-14-5e8d9/src/utils/realCalendar.ts) e [coverage.ts](file:///C:/Users/seuca/antigravity/Escala-Compliance-Pro-2026-11-14-5e8d9/src/utils/coverage.ts))*

### 1. Evolução Híbrida `[sandbox-cenb-hibrido-v9]` (`#5 -> #2` Geral sem Aumentar Demanda da Liderança)
O alvo #1 da Rodada #8 era elevar `Equid` (`3.5/10` -> `>= 4.5/10`) no Híbrido Setor-Seletivo sem reintroduzir colisões internas `< n-1` nem perder a blindagem de sábado em `LOJA_2/DOC+SC`:
- **Ajuste exato (`buildHybridSelectiveV9` em [audit_schedules.ts](file:///C:/Users/seuca/antigravity/Escala-Compliance-Pro-2026-11-14-5e8d9/scripts/audit_schedules.ts))**: manter `75% Sáb` em `L1-SDR`, `L1-VENDAS` e `Jorge/Mayana` (`DOC+SC`) + `50/50` nos especialistas/PREP, movendo apenas a folga da `S3` de `Jorginho` (`emp-rosinaldo`, `satOff: [2, 4]`) de **`QUI -> SEG`** (`{ 1: 'QUI', 3: 'SEG' }`).
- **Resultados reais observados**:
  - **Salto de `#5` (`89.7 / 93.0`) para `#2` Geral (`90.7 Base / 94.0 c/ Backup Cruzado`)**: supera `sandbox-cenb-3sab-v6` (`93.9`), `v4` (`93.8`) e `pos-licenca-v4` (`93.8`), ficando a **`0.1` ponto do `#1 sandbox-cenb-v3` (`94.1`)** exclusivamente pelo menor volume total da cota `75%` (`42h: 14.5/15 [96.7%, 40h36/sem]` vs `14.6/15 [97.3%, 40h52/sem]`).
  - **Equidade de FDS Prolongado `100%` em Vendas**: `Jorginho` conquista `S2 Sáb -> S2 Dom -> S3 Seg` (`15` FDS prolongados; apenas os `3` colaboradores com trava estrutural permanecem com `0`: `Andria`, `Nailson`, `João Pedro`), com **`ZERO` erros CLT**, **`ZERO` picos simultâneos de almoço**, **`ZERO` colisões internas `< n-1` em dias úteis**, **`0.0h` solo no sábado da `LOJA_2/DOC+SC`** (com ou sem `Matheus`) e **`2/20` dias** de déficit de almoço em `L2-FIN`.
  - **Eficiência no Banco Dinâmico `N-1` (`RODADA #8A`)**: `15/360` casos sensíveis (`4.2%`, **`-40%` vs `v3` (`25/360`)**) — todos os `3` novos casos da `S3 SEG` (`L2-VENDAS-EXT`) são **100% absorvidos pela `Camada 1 CLT` (custo zero)** (`Camada 1 = 13/15`). A **`Camada 2 (Liderança Circulante)` permanece em apenas `2/360` (`-80%` vs `v3`)** (exclusivamente `Igor` em `S1 TER` e `S3 SEG` se `João Pedro` faltar).

| Cenário (`CENÁRIO B` Topo) | Ranking (`Base / c/ Backup`) | `FDS Prol.` (`0 FDS`) | Fragilidade `N-1` (`360d`) | **Camada 1 CLT** | **Camada 2 Liderança** | `Sáb. Solo DOC+SC` (`08h–14h`) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| `[sandbox-cenb-v3]` (`50/50`) | **`#1`** (`90.8` / **`94.1`**) | `16` (`3`) | `25/360` (`6.9%`) | `15` | `10` (`8× Edvania, 2× Igor`) | `4.0h–12.0h` (`2/4` sáb c/ 1 CLT) |
| **`[sandbox-cenb-hibrido-v9]`** | **`#2`** (`90.7` / **`94.0`**) | **`15` (`3`)** | **`15/360` (`4.2%`)** | **`13`** | **`2` (`2× Igor`, `-80%`)** | **`0.0h` (`0/4` sáb c/ 1 CLT)** |
| `[sandbox-cenb-3sab-v6]` (`75%`) | `#3` (`90.5` / `93.9`) | `15` (`3`) | `17/360` (`4.7%`) | `14` | `3` (`3× Igor`) | `0.0h` (`0/4` sáb c/ 1 CLT) |
| `[sandbox-cenb-hibrido-v8]` | `#6` (`89.7` / `93.0`) | `14` (`4`) | **`12/360` (`3.3%`, `-52%`)** | `10` | **`2` (`2× Igor`, `-80%`)** | `0.0h` (`0/4` sáb c/ 1 CLT) |

### 2. Projeção Sazonal no Calendário Civil Real + Feriados Nacionais (`RODADA #9A`: `Nov/2026 – Jan/2027`)
Simulação executada data-a-data com `getCycleWeekForDate` e `getEmployeeShiftForDate` ([realCalendar.ts](file:///C:/Users/seuca/antigravity/Escala-Compliance-Pro-2026-11-14-5e8d9/src/utils/realCalendar.ts)), considerando os feriados nacionais federais da janela (`15/11 Dom`, `20/11 Sex Consciência Negra — Lei 14.759/2023`, `25/12 Sex Natal`, `01/01/2027 Sex Confraternização Universal`):
1. **Imunidade Total a Feriados de Sexta-feira (`0 absorções de folga 5x2`)**:
   - Todos os `3` feriados úteis do trimestre (`20/11`, `25/12`, `01/01`) caem em **Sexta-feira**. Como nenhum colaborador de `v3`, `3sab-v6`, `hibrido-v8` ou `hibrido-v9` possui folga útil alocada na sexta-feira, **`0/18` CLTs perdem dia de folga absorvido pelo feriado** (dispensando trocas compensatórias emergenciais).
2. **Distorção de Mês Longo (`Dez/2026` — `22d` úteis + `4` Sáb) e Mês de `5` Sábados (`Jan/2027` — `20d` úteis + `5` Sáb)**:
   - Em **`Dez/2026`** (`01/12 = S1 TER` até `31/12 = S1 QUI`, repetindo `3` dias úteis da `S1`), as horas trabalhadas reais oscilam entre **`169.2h` (`Andria` no `3sab/v8/v9`, `Marcos Ant.` no `v3`) e `184.8h` (`João Pedro`)** (`dispersão real = 15.6h`).
   - Em **`Nov/2026`** (`20d` úteis sem `20/11` + `4` Sáb), `sandbox-cenb-v3` mostra menor dispersão civil (`13.2h`: `154.8h–168.0h`) do que os formatos `75%` (`15.6h`: `152.4h–168.0h`).
   - Em **`Jan/2027` (`02/01 S1, 09/01 S2, 16/01 S3, 23/01 S4, 30/01 S1`)**, a semana **`S1` repete no início e no fim do mês**, dando **folga dobrada de sábado (`2F/3T`)** especificamente a quem tem `S1` no `satOff` (`3` membros `75%` no `v8/v9`: `Winona`, `João Alex.`, `Jorge Vinicius`; e `5` no `3sab-v6`, dispersando **`7.2h` no `3sab-v6` vs `8.4h` no `v3`/`v8`/`v9`**).
     - Ponto positivo real verificado: em **`v8`/`v9`**, como `Marielly` (`satOff:[2,4]`) e `Mayana` (`satOff:[3]`) trabalham ambas na `S1`, **`LOJA_2/DOC+SC` mantém `2 CLTs` ativos nos dois sábados `S1` de janeiro (`02/01` e `30/01`)**.
3. **Confirmação Calendária do Plano Férias `Nailson` (`Jan/2027` sem `01/01`)**:
   - Retirando o feriado nacional `01/01`, `Jan/2027` soma exatos **`20` dias úteis abertos (`168.0h` de ausência CLT em `L1-MKT`)**, nos quais `Andria + Rayssa` entregam **`52.5h` (`v3`)** / **`51.0h` (`v9` e `3sab-v6`)** sem furar pisos (`115.5h` / `117.0h` residuais para `Igor/Lorena`) e com `Allisson` livre em `L1-PREP > 2` nos `2/2` dias em que `Marielly` folga.

### 3. Ranking Geral Atualizado (`Top 7` de `19` cenários auditados)
1. `#1 [sandbox-cenb-v3]`: `90.8` base / **`94.1/100`** (`N-1: 25/360`, `Camada 2 Liderança: 10`)
2. **`#2 [sandbox-cenb-hibrido-v9]`**: `90.7` base / **`94.0/100`** (`N-1: 15/360`, **`Camada 2 Liderança: 2` (`-80%`)**, `0.0h` solo Sábado `DOC+SC`)
3. `#3 [sandbox-cenb-3sab-v6]`: `90.5` base / **`93.9/100`** (`N-1: 17/360`, `Camada 2 Liderança: 3`)
4. `#4 [sandbox-cenb-v4]`: `90.8` base / **`93.8/100`**
5. `#5 [sandbox-pos-licenca-v4]`: `90.8` base / **`93.8/100`**
6. `#6 [sandbox-cenb-hibrido-v8]`: `89.7` base / **`93.0/100`** (`N-1: 12/360` — recorde absoluto `-52%`, `Camada 2 Liderança: 2`)
7. `#7 [sandbox-trad-v3]`: `89.6` base / **`92.9/100`** (líder horário padrão `08:00–17:30 / Sáb 08:00–13:00`)

### 4. Próximo Alvo Evolutivo (Rodada #10, +30 min)
1. **Par Híbrido em Horário Tradicional (`[sandbox-trad-hibrido-v10]`)**: testar a mesma arquitetura híbrida setor-seletiva (`75%` SDR/Vendas/DOC+SC + `50/50` especialistas/PREP) sob o horário padrão atual (`08:00–17:30 / Sáb 08:00–13:00`), verificando se supera o `#7 [sandbox-trad-v3]` (`92.9/100`) e o `#9 [sandbox-trad-3sab-v6]` (`92.6/100`).
2. **Motor Trimestral Sazonal Real (`M1 Nov + M2 Dez + M3 Jan` no Calendário Civil)**: auditar como a rotação de `S1` (Rodada #6/`M2` trocando quem folga `S1 SAB` em janeiro) corrige a folga dupla em meses de `5` sábados (`2F/3T` -> `2F/3T` mais justo em `Jan/2027`) e reduz a dispersão real de `Dez/2026` (`15.6h`).
3. **Promoção Segura para Produção (`src/utils/scenarioProposals.ts`)**: aguardando decisão do usuário pelas opções numeradas entre `[sandbox-cenb-v3]`, `[sandbox-cenb-hibrido-v9]` (melhor equilíbrio geral `94.0` + `-80%` liderança) e `[sandbox-cenb-hibrido-v8]`.

---

## Rodada #10 — Par Tradicional Híbrido (`[sandbox-trad-hibrido-v10]`) + Descoberta da Armadilha do Dia 1º Civil e Motor Sazonal Alinhado à Segunda `S1` (`2026-11-14T22:34:43Z`)

### 1. Diagnóstico e Descoberta Crítica (O Que Não Sabíamos até a Rodada #9)
Ao auditar simultaneamente a aderência ao horário padrão atual da loja (`08:00–17:30 / Sáb 08:00–13:00`) e a execução contínua por **91 dias corridos reais (`02/11/2026` a `31/01/2027` — `75` dias úteis abertos e `13` sábados, já descontando domingos e feriados nacionais `20/11`, `25/12` e `01/01`)**, vieram à tona **dois riscos operacionais invisíveis em auditorias de 4 semanas isoladas**:

1. **Lacuna do Horário Padrão Atual**: existiam `sandbox-trad-v3`, `trad-v4` e `trad-3sab-v6`, mas ainda faltava o equivalente híbrido setor-seletivo (`75% Sáb` em `L1-SDR / L1-VENDAS / DOC+SC` + `50/50` nos especialistas) para quem opera hoje em `08:00–17:30 / Sáb 13:00` sem depender da extensão de 18h/14h do Cenário B.
2. **Armadilha Fatal da Virada de Plano no Dia 1º Civil (`01/12 TER` e `01/01 SEX`) + Colisão Oculta em `M2`**:
   - Ao projetar rotação mensal contínua `M1 -> M2 -> M3`, localizamos e corrigimos em `m2Dez` (`L1-SDR S4`) uma colisão oculta (`Diana` e `Andria` ambas em `TER`, corrigida para `Diana S4 QUA`).
   - Mais grave: alternar de plano mensal na data civil `01/12` (terça-feira) e `01/01` (sexta-feira) **corta a semana `S1` ao meio**, produzindo **`11` semanas civis Seg–Dom com anomalia `5x2`** (`0` ou `2` folgas úteis na mesma semana), **pico semanal de `48.0h/sem`** (violando o teto constitucional de `44h` e a regra de `42h`) e explosão da dispersão acumulada em 75 dias entre pares `75%` para **`16.8h`** (`488.4h` Adriane/Rayssa vs `505.2h` Diana/Winona/João Alex./Jair/Mayana).

### 2. Melhorias Aplicadas e Validadas no `scripts/audit_schedules.ts`
1. **Extração de núcleo compartilhado (`buildHybridSelectiveCore`) + Criação de `[sandbox-trad-hibrido-v10]`**:
   - Espelha a arquitetura híbrida `v9` no horário padrão (`Seg–Sex 08:00–17:30`, `Sáb 08:00–13:00`), mantendo **Jorginho (`VEND-L2-EXT`)** com alternância `{S1: QUI, S3: SEG}` para zerar a exclusão de FDS prolongado em Vendas.
   - Integrado ao ranking geral, matriz `N-1`, auditoria de sábados em `LOJA_2/DOC+SC` e solver `RODADA #8A`.
2. **Motor Trimestral Real (`runRealSeasonalQuarterCompensation` — `RODADA #10A`)**:
   - Mede `75` dias úteis abertos + todas as `13` semanas civis completas (`02/11..31/01`), contabilizando colisões `<3/4`, folgas semanais `!= 1` (`anomalias 5x2`), pico real em horas/semana, sábados solo em `LOJA_2/DOC+SC` e dispersão entre pares `75%`.
   - Comprova o ganho do **Alinhamento à Segunda-feira `S1` (`M2` em `30/11 SEG` e `M3` em `28/12 SEG`)** com plano `M1/M2/M3` rotativo.

### 3. Evidência Numérica Verificada (`npx.cmd tsx scripts/audit_schedules.ts`)

#### A) `[sandbox-trad-hibrido-v10]` vs Pares no Horário Tradicional (`08:00–17:30 / Sáb 13:00`)
| Cenário (Horário Tradicional) | Ranking / Base -> Cruzado | Apr. `42h` (Média Sem.) | Faltas `N-1` (`360`) | Solver `N-1` (C1 CLT / C2 Lid.) | L2 DOC+SC Solo Sáb (s/ Matheus) | CLTs `0` FDS Prol. | Sobrecarga Férias Jan (`20d`) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `[sandbox-trad-v3]` | `#7` (`89.6 -> 92.9`) | `96.2%` (`40h24`) | `25/360 (6.9%)` | `15 C1 + 10 C2` | `2/4 sáb` (`10.0h` solo) | `3` (Andria, Nailson, João P.) | `2/20d` |
| `[sandbox-trad-3sab-v6]` | `#10` (`89.2 -> 92.6`) | `94.6%` (`39h44`) | `17/360 (4.7%)` | `14 C1 + 3 C2` | `0/4 sáb` (`0.0h` solo) | `3` (Andria, Nailson, João P.) | `3/20d` |
| **`[sandbox-trad-hibrido-v10]`** | **`#8` (`89.4 -> 92.7`)** | **`95.3%` (`40h01`)** | **`15/360 (4.2%)`** | **`13 C1 + 2 C2`** | **`0/4 sáb` (`0.0h` solo)** | **`3`** (Andria, Nailson, João P.) | **`2/20d`** |

- Decomposição `[sandbox-trad-hibrido-v10]`: `[Legal/8h24:30.0/30 Set:20.0/20 42h:14.3/15 Intradia:16.7/20 Equid:3.4/10 Interj:5.0/5]` | `0` erros CLT | `0` avisos | `0` setores descobertos | `0` picos simultâneos de almoço | `0` colisões internas `< n-1` | déficit almoço `L2-FIN` = `2/20` dias | menor interjornada `14.50h (870 min)` (`Winona S2 SEX->SAB`).
- Ganhos reais vs `sandbox-trad-v3`: **`-40.0%` de fragilidade `N-1`** (`15` vs `25` casos; zero fragilidade em `L1-SDR` e `L1-VENDAS`), **`-80.0%` em acionamentos da liderança** (`2` vs `10`) e **eliminação total (`0.0h`) do risco de supervisora/auxiliar sozinha no sábado em Loja 2**.

#### B) `RODADA #10A`: Comparativo Trimestral Civil (`02/11/2026–31/01/2027` — `75d` Abertos, `13` Sábados)
| Estratégia Trimestral | Erros CLT / Desc. / Colisões `<3/4` | Semanas c/ Anomalia `5x2` | Pico Semanal Real | Sáb Solo DOC+SC | Dispersão `75%` (`75d`) | Quem Fica c/ `9T/4F` (`499.2h`) no Ciclo |
| --- | --- | --- | --- | --- | --- | --- |
| `Híbrido v9 Fixo × 3 Meses` | `0` / `0` / `0` | `0` | `42.0h/sem` | `0/13` | `2.4h` | Fixo sem rodízio (`Winona`, `João Alex.`, `Jorge V.`) |
| `Armadilha Corte Dia 1º (01/12 e 01/01)` | `0` / `0` / `0` | **`11`** | **`48.0h/sem`** | `0/13` | **`16.8h`** (`488.4h..505.2h`) | Distorcido (`Andria/Marcos` 490.8h, `Adriane/Rayssa` 488.4h) |
| **`Rodada #10 Sazonal Alinhado à Segunda S1 (30/11 e 28/12)`** | **`0` / `0` / `0`** | **`0`** | **`42.0h/sem`** | **`0/13`** | **`2.4h` (`-85.7%`)** | **Justo c/ compensação** (`Andria`, `Marcos Ant.`, `Jorge V.`) |

- Distribuição real em 75 dias úteis abertos na **`Rodada #10 Sazonal Alinhado à Segunda S1`**:
  - **`L1-SDR [disp 2.4h]`**: `Diana=10T/3F (496.8h)` | **`Andria=9T/4F (499.2h)`** *(recebe S1 duplo em Jan/2027 `02/01+30/01`, compensando ausência de FDS prolongados em M1)* | `Adriane=10T/3F (496.8h)` | `Winona=10T/3F (496.8h)`
  - **`L1-VENDAS [disp 2.4h]`**: `João Alex.=10T/3F (496.8h)` | `Jair=10T/3F (496.8h)` | **`Marcos Ant.=9T/4F (499.2h)`** | `Rayssa=10T/3F (496.8h)`
  - **`DOC+SC 75% [disp 2.4h]`**: **`Jorge Vinicius=9T/4F (499.2h)`** | `Mayana=10T/3F (496.8h)`

### 4. Próximo Alvo Evolutivo (Rodada #11)
1. **Regra Arquitetural de Virada na UI Real (`realCalendar.ts`)**: parametrizar transições mensais no calendário real para ocorrerem exclusivamente na **segunda-feira `S1` de abertura do ciclo de 4 semanas** (`30/11`, `28/12`, `25/01`), bloqueando matematicamente cortes no dia 1º civil (`48.0h/sem`).
2. **Extensão para Ciclo `M4` (`25/01/2027`) + Redução Final de Camada 2 em `L2-FIN`**: incluir plano `M4` para rodar a folga dupla do 5º sábado seguinte e avaliar cobertura cruzada interna pontual para as últimas `2` idas de Igor em `L2-FIN` (`S1 TER` e `S3 SEG`) + choque duplo `2/20d` nas férias de Nailson em Jan/2027.
3. **Promoção para Produção (Aguardando Escolha Numérica do Usuário)**: submeter ao diretório oficial (`src/utils/scenarioProposals.ts`) o par vencedor escolhido (`sandbox-cenb-hibrido-v9` em `08h–18h / Sáb 14h` e/ou `sandbox-trad-hibrido-v10` em `08h–17h30 / Sáb 13h`).

---

## Rodada #11 — Semestre Real (`26` Semanas `M1..M7`), Feriados Não-Sexta + Anti-Absorção & Cascata Dupla CLT Zero-Liderança (`2026-11-14T23:05:24Z`)

### 1. Duas Falhas Estruturais Residuais Resolvidas Sobre as Rodadas `#1–#10`
1. **Ponto Cego do Calendário Semestral e Feriados Úteis Fora da Sexta (`02/11 SEG`, `08/12 TER`, `09/02 TER`, `21/04 QUA` + Sábados `06/03` e `01/05`)**:
   - Na Rodada #9, o trimestre avaliado continha apenas feriados em **sexta-feira** (`20/11`, `25/12`, `01/01`), mascarando a absorção de folgas `5x2`. Ao expandir a simulação em [`scripts/audit_schedules.ts`](file:///C:/Users/seuca/antigravity/Escala-Compliance-Pro-2026-11-14-5e8d9/scripts/audit_schedules.ts) para o **semestre civil completo de `26` semanas (`02/11/2026` a `02/05/2027`, `182` dias corridos)** com o novo ciclo rotativo de `4` fases **`M1 -> M2 -> M3 -> M4 -> M1...`** alinhado às segundas-feiras `S1` (`M4` iniciando em `25/01/2027`):
     - Descobriu-se que **rodar `M1..M4` sem compensação de feriados não-sexta absorve `6` folgas `5x2` úteis** sob Feriados Nacionais (`02/11 Finados SEG` e `21/04 Tiradentes QUA`) — e **`13` folgas `5x2` úteis** no calendário completo PE/Recife (`+08/12 N. Sra. Conceição TER` e `+09/02 Carnaval TER`), gerando **dispersão semestral acumulada de `16.8h`** (`987.6h..1004.4h`) entre colegas `75%` do mesmo setor!
     - Além disso, os dois feriados de sábado (`06/03 Data Magna PE` e `01/05 Dia do Trabalho`) caem ambos na semana **`S2`**, exigindo o fechamento do **Quadrado Latino `M1..M4`** (`Winona -> Diana -> Andria -> Adriane` e `João -> Jair -> Marcos -> Rayssa` no rodízio completo de `S1..S4`) para manter equidade semestral.
2. **Últimos `2` Acionamentos da Liderança (`Camada 2: Igor`) e Déficit `2/20` de `L2-FIN`**:
   - Apesar de `#9` e `#10` terem cortado a liderança em `-80%`, `L2-FIN` ainda acionava `Igor` **`2` vezes em `360` cenários `N-1`** (`S1 TER` e `S3 SEG`, exatas folgas `5x2` de `Marielly`) e acumulava `2/20` dias sem backup CLT no almoço `12h–13h` e `2/20` choques duplos em Jan/2027 (Férias `Nailson`).

### 2. Melhorias Arquiteturais Implementadas em `scripts/audit_schedules.ts`
1. **Quadrado Latino Semestral `M1..M4` Alinhado à Segunda `S1` (`buildSeasonalFourPhasePlans`) + Protocolo Anti-Absorção (`runRodada11SemesterAndCascadeAudit` — `RODADA #11A`)**:
   - Nova fase **`m4Fev`** validada com **`Err=0, Desc=0, Colis<3/4=0, Alm=0, SábL2=0`**, completando o rodízio `S1..S4` em `L1-SDR`, `L1-VENDAS` e `DOC+SC` em ciclos estritos de 4 semanas (`M1..M7`).
   - Sensor semestral de **sequência máxima contínua de trabalho (`CLT Art. 67 <= 6 dias`)** e **desvio automático pré-feriado (`SEG..SEX`)**: quando uma `FOLGA_5X2` coincide com feriado útil não-sexta, realoca a folga para outro dia útil aberto da mesma semana preservando `SEGURO` e `0` colisões `< 3/4`.
2. **Cascata Dupla CLT `R$ 0` Zero-Liderança (`solveN1WithLayers(..., true)` — `RODADA #11B`)**:
   - Simula capacitação cruzada secundária de **`Mayana (DOC-AUX)` em `L2-FIN`** acionada exclusivamente nas folgas `5x2` de `Marielly` (`S1 TER` e `S3 SEG`), combinada ao deslocamento simultâneo de **`Allisson (L1-PREP >= 3 -> 2/2 OK) -> DOC-AUX` (`L2-DOC >= 2/2 OK`)**.

### 3. Evidência Numérica Observada (`npx.cmd tsx scripts/audit_schedules.ts` em `2026-11-14T23:05:24.697Z`)

#### A) `RODADA #11A`: Semestre Real `26` Semanas (`02/11/2026–02/05/2027` — `182` Dias Corridos)
| Cenário / Estratégia (`26` Semanas) | Dias / Sáb Abertos | Desc. / Colis. / Sáb Solo L2 / Anom. `5x2` | Pico Sem. / Seq. Máx. | Absorção Feriado Útil (`SEG–SEX`) | Absorção Sáb. | Dispersão `75%` (`182d`) |
| --- | :---: | :---: | :---: | :---: | :---: | :---: |
| `Nac \| Híbrido v9 Fixo × 26 Sem` | `149d` / `25` | `0 / 0 / 0 / 0` | `42.0h` / `5d` | `6` | `8` | `6.0h` (s/ rodízio `S1..S4`) |
| `Nac \| M1..M4 Alinhado S1 (s/ troca feriado)` | `149d` / `25` | `0 / 0 / 0 / 0` | `42.0h` / `5d` | `6` | `8` | `16.8h` (`987.6h..1004.4h`) |
| **`Nac \| Rodada #11 M1..M4 + Anti-Absorção`** | **`149d` / `25`** | **`0 / 0 / 0 / 0`** | **`42.0h` / `5d`** | **`0` (`-100%`, `6` trocas)** | `8` | **`8.4h` (`-50%`; `DOC+SC: 2.4h`)** |
| `PE \| Híbrido v9 Fixo × 26 Sem` | `146d` / `24` | `0 / 0 / 0 / 0` | `42.0h` / `5d` | `13` | `16` | `14.4h` (`967.2h..981.6h`) |
| **`PE \| Rodada #11 M1..M4 + Anti-Absorção`** | **`146d` / `24`** | **`0 / 0 / 0 / 0`** | **`42.0h` / `5d`** | **`0` (`-100%`, `13` trocas)** | `16` | **`8.4h` (`DOC+SC: 2.4h`, `-83.3%`)** |

- **Trocas automáticas anti-absorção sem nenhuma violação (`0` colisões `< 3/4`)**:
  - *Nacionais (`6`)*: `Adriane [02/11 SEG->QUI]`, `Rayssa [02/11 SEG->QUI]`, `Allisson [02/11 SEG->QUI]`, `Winona [21/04 QUA->QUI]`, `João Alex. [21/04 QUA->QUI]`, `Mayana [21/04 QUA->QUI]`.
  - *Completas PE/Recife (`+7` = `13`)*: adiciona `Winona [08/12 TER->QUI]`, `Rayssa [08/12 TER->QUA]`, `Alefy [08/12 TER->QUI]`, `Diana [09/02 TER->SEG]`, `Marcos Ant. [09/02 TER->QUA]`, `Allisson [09/02 TER->QUI]`, `Mayana [09/02 TER->QUI]`.

#### B) `RODADA #11B`: Cascata Dupla CLT `R$ 0` (`Allisson -> DOC-AUX` + `Mayana -> FIN-1`) nos `5` Modelos Ativos
| Modelo Auditado (`1.800` simulações `N-1` no total) | `N-1` Camada 2 Liderança | Total `C1 CLT R$0` (`N-1`) | Almoço `L2-FIN` sem Backup CLT | Choque Duplo Jan/2027 (`L1-MKT=0 + FIN`) |
| --- | :---: | :---: | :---: | :---: |
| **`[sandbox-cenb-hibrido-v9]`** (`08h–18h / Sáb 14h`) | **`2 -> 0/15` (`-100%`)** | **`15/15` (`100%`)** | **`2/20 -> 0/20`** | **`2/20 -> 0/20`** |
| **`[sandbox-trad-hibrido-v10]`** (`08h–17h30 / Sáb 13h`) | **`2 -> 0/15` (`-100%`)** | **`15/15` (`100%`)** | **`2/20 -> 0/20`** | **`2/20 -> 0/20`** |
| **`[sazonal-m2-dez-rot10]`** (`Ciclo Dez`) | **`2 -> 0/11` (`-100%`)** | **`11/11` (`100%`)** | **`2/20 -> 0/20`** | **`2/20 -> 0/20`** |
| **`[sazonal-m3-jan-rot10]`** (`Ciclo Jan`) | **`2 -> 0/12` (`-100%`)** | **`12/12` (`100%`)** | **`2/20 -> 0/20`** | **`2/20 -> 0/20`** |
| **`[sazonal-m4-fev-rot11]`** (`Ciclo Fev`) | **`2 -> 0/11` (`-100%`)** | **`11/11` (`100%`)** | **`2/20 -> 0/20`** | **`2/20 -> 0/20`** |

- Em **100% dos 5 modelos/fases**, a cascata dupla nos dias **`S1 TER`** e **`S3 SEG`** garante `0` dependência de sócio/liderança para cobertura `N-1` de 1 dia e `0/20` lacunas de almoço em `L2-FIN`.

### 4. Próximo Alvo Evolutivo (Rodada #12)
1. **Motor Unificado `realCalendar.ts` + UI (`src/utils/`)**: assim que aprovado pelo usuário, integrar na geração oficial a virada exclusiva por segunda `S1`, o alerta/botão de **"Desvio Automático Anti-Absorção de Feriado"** no calendário mensal real e a regra de **Cascata `Allisson -> DOC-AUX` + `Mayana -> FIN-1`**.
2. **Análise Financeira/Sábado-Feriado (`Sáb = 8` / `16` em `06/03` e `01/05`) + Faltas Duplas Simultâneas (`N-2`)**: testar stress de ausência dupla (`2` CLTs ausentes no mesmo dia útil/sábado, ex.: atestado + folga de feriado) e equilíbrio de sábado-feriado quando duas datas caem consecutivamente na semana `S2`.

---

## Rodada #12 — Matriz de Estresse Duplo Simultâneo (`N-2` CLT) & Equalização Justa dos Sábados-Feriados `S2` (`06/03 Data Magna PE` + `01/05 Trabalho`)

Executada sobre `scripts/audit_schedules.ts` (`runAudit()` + `runRodada12StressN2AndSatHolidayAudit()`, com **0 erros de tipo `tsc`**). Pela primeira vez o sistema combinou todas as **2.597–2.651 duplas simultâneas possíveis de falta (`N-2` CLT)** ao longo das 24 jornadas (`S1–S4 × Seg–Sáb`) e resolveu a última fonte de assimetria de **`8.4h`** da Rodada #11 no semestre civil de 182 dias (`02/11/2026–02/05/2027`).

### 1. Matriz Real de Estresse Duplo Simultâneo (`N-2` CLT em `S1–S4 × Seg–Sáb` — `RODADA #12A`)
Simulação exaustiva de todas as combinações `C(n,2)` de 2 CLTs ativos faltando juntos no mesmo dia, respeitando exclusividade física da liderança (um líder circulante da tabela `SECTOR_DEFINITIONS.primaryBackups` não pode ocupar 2 assentos ao mesmo tempo) e incluindo a **Cascata Dupla `R$0` (`Allisson -> DOC-AUX` + `Mayana/SC-1 -> FIN-1`)**:

| Modelo Auditado | Pares `N-2` | `0`-Impacto + `C1` CLT `R$0` | Resolvido **Sem Liderança** | `C2` 1 Líder | `C2` 2 Líderes | Colapso Irreversível | Sobrevivência |
|---|---|---|---|---|---|---|---|
| `#1 [sandbox-cenb-v3]` | 2.651 | `2.301 + 227` | `95.4%` | `119` | `4` | `0 (0.0%)` | **100.0%** |
| **`#2 [sandbox-cenb-hibrido-v9]`** | **2.597** | **`2.252 + 260`** | **`96.7%`** | **`85`** | **`0`** | **`0 (0.0%)`** | **100.0%** |
| `#3 [sandbox-cenb-3sab-v6]` | 2.581 | `2.200 + 282` | `96.2%` | `99` | `0` | `0 (0.0%)` | **100.0%** |
| **`#8 [sandbox-trad-hibrido-v10]`** | **2.597** | **`2.252 + 260`** | **`96.7%`** | **`85`** | **`0`** | **`0 (0.0%)`** | **100.0%** |

- **Superioridade operacional comprovada sob estresse extremo `N-2`**: frente ao `#1 [sandbox-cenb-v3]`, o `#2 [sandbox-cenb-hibrido-v9]` e o `#8 [sandbox-trad-hibrido-v10]` elevam para **`96.7%`** as faltas duplas resolvidas **com custo zero e sem acionar a liderança**, reduzem em **`28.6%`** (`119 -> 85`) os acionamentos de 1 líder e **zeram completamente (`4 -> 0`) os choques simultâneos de 2 líderes** no mesmo dia.
- **Por que `L1-PREP` não colapsou mesmo com 2 faltas simultâneas**: a base real de Preparação (`Allisson`, `Rodolfo`, `Marcos Flor.`, `Alefy`) soma `4` `CLT_ATIVO`, garantindo `1` CLT remanescente + `Lorena` (`C2 1-Líder`) = `2 >= minW(2)` mesmo quando já há `1` folga `5x2` no dia.

### 2. Causa Raiz & Solução dos Sábados-Feriados `S2` (`06/03/2027` e `01/05/2027` — `RODADA #12B`)
Diagnóstico automático da disparidade residual de **`8.4h`** da Rodada #11 no semestre real (`182d`, `02/11/2026–02/05/2027`):
- Em **`M5 S2` (`06/03/2027 SAB` Data Magna PE)** e **`M7 S2` (`01/05/2027 SAB` Dia do Trabalho)**, os 8 CLTs cuja `FOLGA_5X2` caiu no Sábado feriado trabalharam **`42.0h`** (`5` dias úteis), enquanto os colegas do mesmo setor que já folgaram um dia útil trabalharam apenas **`33.6h`** (`4` dias úteis + Sáb fechado = **`-8.4h`**).
- **`RODADA #12B-1` (apenas inverter `M7 = M4` sem compensação em `SEX`)**: provou o limite matemático — mantém **`Sáb absorvidos = 8`** e **`Dispersão 75% = 8.4h`** (apenas transfere os `996.0h` de `Winona/Rayssa` para `Diana/João Alex.`).
- **Protocolo Justo Sábado-Feriado (`antiSatHolidayComp`, deslocando `SAB -> SEX` `4/4 -> 3/4` ou `QUI` mantendo `0` colisões `<3/4` e `0` setores descobertos)**:

| Regime & Estratégia (`182` dias) | Sáb Absorvidos | Úteis Absorv. | Disp. `75%` Geral | `L1-SDR` / `L1-VENDAS` / `DOC+SC` | Anomalias `5x2` / Colisões `<3/4` |
|---|---|---|---|---|---|
| `Nac` \| Rodada #11 (sem comp. Sáb) | `8` | `0` | `8.4h` | `8.4h / 8.4h / 2.4h` | `0 / 0` |
| **`Nac` \| `12B-2` Comp. Justa `SEX/QUI`** | **`0`** | **`0`** | **`2.4h`** | **`2.4h / 2.4h / 2.4h`** | **`0 / 0`** (`14` trocas) |
| `PE` \| Rodada #11 (sem comp. Sáb) | `16` | `0` | `8.4h` | `8.4h / 8.4h / 2.4h` | `0 / 0` |
| `PE` \| `12B-2` Comp. Justa (`M1..M4`) | **`0`** | **`0`** | **`4.8h`** | `4.8h / 4.8h / 2.4h` | `0 / 0` (`29` trocas) |
| **`PE` \| `12B-3` (`M5=M3, M7=M4`) + Comp.** | **`0`** | **`0`** | **`4.8h`** | **`4.8h / 0.0h / 2.4h`** | **`0 / 0`** (`L1-VENDAS = 0.0h` exatos `964.8h`!) |

- **Ganho acumulado comprovado em `182` dias**: no calendário **Nacional**, a dispersão horária entre pares `75%` despencou **`-85.7%` frente ao v9 fixo** (`16.8h -> 8.4h -> 2.4h`, piso teórico de `6.5` ciclos em 26 semanas) com **`0` absorções úteis**, **`0` absorções de sábado**, **`0` anomalias `5x2`** (`pico = 42.0h/sem`, `seq máx = 5d`) e **`0` colisões `<3/4`**. No calendário completo **PE/Recife**, as absorções de sábado zeraram (`16 -> 0`) e o bloco **`PE 12B-3`** atingiu **`0.0h` de dispersão em `L1-VENDAS`** (`18T/6F = 964.8h` para os 4 vendedores).

### Próxima fronteira para Rodada #13 (pós-decisão ou próxima janela)
1. **Promoção definitiva para produção (`src/utils/scenarioProposals.ts`, `src/utils/realCalendar.ts` e UI)** aguardando seleção do usuário entre o **`#2 [sandbox-cenb-hibrido-v9]` (`08:00–18:00 / Sáb 14:00`)** e o **`#8 [sandbox-trad-hibrido-v10]` (`08:00–17:30 / Sáb 13:00`)** integrando o pacote completo Rodadas `#9–#12` (Motor Sazonal `M1..M4` alinhado à `S1`, Protocolo Anti-Absorção Útil & Sáb-Feriado `SEX/QUI`, e Cascata Dupla `R$0` `Allisson -> DOC-AUX` + `Mayana -> FIN-1`).
2. **Mitigação Sazonal de `Rodolfo` / Equilíbrio Fino `L1-SDR` em `PE 12B-3`**: zerar a única assimetria remanescente de `4.8h` em `L1-SDR` (`Winona 19T/5F 962.4h` vs `Adriane 17T/7F 967.2h`) via inversão seletiva de `satOff` de `M7` apenas em `L1-SDR`, além de auditar o cenário **`N-2 + Estagiário Matheus ausente`** simultaneamente aos sábados.
