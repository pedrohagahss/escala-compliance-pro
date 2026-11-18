import json, subprocess, wave, sys
d = json.load(open('/home/user/escala-compliance-pro/src/data/escalaDefinida.json'))
emps = [e for e in d['employees'] if e['contractType'] != 'LICENCA_MATERNIDADE']
nm = lambda e: e['shortName'].replace(' (Estagiário)', '').replace('Alex.', 'Alexandre').replace('Ant.', 'Antônio').replace('Flor.', 'Florentino')
def lst(xs): xs=list(xs); return xs[0] if len(xs)==1 else ', '.join(xs[:-1]) + ' e ' + xs[-1]
DATES = {3:'dezesseis a vinte e dois de novembro',4:'vinte e três a vinte e nove de novembro',1:'trinta de novembro a seis de dezembro',2:'sete a treze de dezembro'}
def satoff(w): return [nm(e) for e in emps if e['weeksSchedule'][str(w)]['SAB']['type'] != 'TRABALHO']
J = next(e for e in emps if e['id']=='emp-rosinaldo')
DL = {'SEG':'segunda','TER':'terça','QUA':'quarta','QUI':'quinta','SEX':'sexta','SAB':'sábado'}
cov = []
for w in (3,4,1,2):
    for dd,x in J['weeksSchedule'][str(w)].items():
        if x.get('coverage'): cov.append(f"na S{w}, {DL[dd]}, cobre {x['coverage']['coveredByName'].replace('Alex.','Alexandre').replace('Ant.','Antônio')}")
work21 = [nm(e) for e in emps if e['weeksSchedule']['3']['SAB']['type']=='TRABALHO']
N = [
 "Olá, equipe Seu Carro P E. Esta é a escala inicial de trabalho e folgas, definida em reunião. Ela começa a valer no sábado, vinte e um de novembro. Neste vídeo vamos explicar como ela funciona e mostrar as folgas de cada semana.",
 "A escala segue o modelo cinco por dois. Cada pessoa trabalha cinco dias e folga dois: o domingo, e mais um dia, que muda conforme a semana. De segunda a sexta, o horário é das oito da manhã às cinco e meia da tarde, com cerca de uma hora de almoço, em horários alternados para o setor nunca ficar vazio. A escala roda em um ciclo de quatro semanas, chamadas S um, S dois, S três e S quatro. Os sábados são feitos em rodízio, e quem trabalha no sábado folga em um dia útil daquela semana. A carga semanal fica dentro do limite de quarenta e duas horas.",
 "Sobre o sábado. O horário formal é das oito da manhã às cinco da tarde, com uma hora de intervalo. Esse é o horário em que todos devem estar à disposição da loja. Mas, dependendo do movimento do comércio local, a liderança pode liberar a equipe mais cedo. Documentação, financeiro e estágio da filial seguem com o sábado só pela manhã.",
 "Qual semana é qual? O ciclo se repete a cada quatro semanas. A semana de dezesseis a vinte e dois de novembro é a S três, e o primeiro sábado da escala, dia vinte e um, é o sábado da S três. Depois vêm a S quatro, a S um e a S dois, e o ciclo recomeça.",
]
for w in (3,4,1,2):
    N.append(f"Semana S {w}, de {DATES[w]}, e repete a cada quatro semanas. As folgas aparecem em verde. Nesta semana, folgam no sábado: {lst(satoff(w))}. Os demais trabalham no sábado e folgam no dia útil marcado em verde na tabela." + (" Em laranja, o vendedor que vai cobrir a filial." if any(e['weeksSchedule'][str(w)][dd].get('label','').endswith('Filial') for e in emps for dd in DL) else ""))
N += [
 "Este é o resumo: a folga semanal de cada colaborador, além do domingo, nas quatro semanas do ciclo. Vale a pena guardar esta tabela, ou tirar uma foto, para consultar sua folga.",
 "Na filial, o Jorginho fica fixo na área externa, como no formato original. Nas folgas dele, um vendedor da matriz vai para a filial. Cada vendedor cobre uma vez a cada quatro semanas, e ninguém repete antes de todos terem ido. Assim: " + '; '.join(cov) + ".",
 f"No primeiro sábado, dia vinte e um de novembro, trabalham {len(work21)} pessoas. O João Alexandre cobre a filial, porque é folga do Jorginho. O horário é das oito às cinco, com uma hora de almoço, e a liderança pode liberar mais cedo conforme o movimento.",
 "Um ajuste foi feito depois da reunião. Winona e João Alexandre folgam juntos. Na versão da reunião, a semana S dois ficava sem folga, e a S três tinha duas. A folga de sábado passou da S três para a S dois. Agora as folgas dos dois são: quinta na S um, sábado na S dois, quinta na S três e segunda na S quatro.",
 "Lembrando: esta é a escala inicial. Ela começa no sábado, vinte e um de novembro, e pode ser ajustada conforme a operação das lojas. Em caso de dúvida sobre a sua folga ou o seu horário, procure a liderança. Bom trabalho a todos!",
]
L = json.load(open('video/slides.json'))
assert len(L) == len(N), (len(L), len(N))
for i, t in enumerate(N):
    f = f'video/n{i+1:02d}.wav'
    subprocess.run(['python3','-m','piper','-m','tts/pt.onnx','--length-scale','1.05','-f',f], input=t.encode(), check=True, capture_output=True)
    with wave.open(f) as w: dur = w.getnframes()/w.getframerate()
    L[i]['wav'] = f; L[i]['dur'] = round(dur + 1.6, 2)
    print(i+1, round(dur,1))
json.dump(L, open('video/slides_audio.json','w'), indent=1)
