import React from 'react';
import { LEADERSHIP_TEAM, STORES } from '../data/seuCarroData';
import { Users, Building2, Award, CheckCircle2 } from 'lucide-react';

export const LeadershipPanel: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Estrutura Física */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-600" />
            Estrutura Física & Lojas — Seu Carro PE
          </h2>
          <p className="text-xs text-slate-500">
            Distribuição dos postos de trabalho e baias físicas em Pernambuco
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {STORES.map((store) => (
            <div key={store.id} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-slate-900 text-sm">{store.name}</span>
                <span className="font-mono text-[10px] px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 font-bold border border-blue-200">
                  {store.code}
                </span>
              </div>
              <p className="text-slate-600">{store.subtitle}</p>
              <div className="text-slate-600 text-[11px] pt-2 border-t border-slate-200">
                {store.id === 'LOJA_1' ? (
                  <ul className="list-disc list-inside space-y-1">
                    <li><strong>Sala de SDRs:</strong> 4 baias fixas (Winona, Andria, Diana e Adriane)</li>
                    <li><strong>Pátio de Vendedores:</strong> 4 mesas fixas (Jair, João Alexandre, Marcos Antonio e Rayssa)</li>
                    <li><strong>Base da Preparação & Zeladoria:</strong> 4 postos (Allisson, Rodolfo, Marcos Florentino e Alefy)</li>
                    <li><strong>Marketing:</strong> 1 mesa (Nailson)</li>
                  </ul>
                ) : (
                  <ul className="list-disc list-inside space-y-1">
                    <li><strong>Área Externa:</strong> 1 cadeira em rodízio entre vendedores (Jorginho / Vendedor do dia)</li>
                    <li><strong>Escritório de Atendimento:</strong> Baias DOC-SUP (Marielly), DOC-AUX (Mayana), DOC-EST (Matheus) e SC-1 (Jorge cobrindo Grazy)</li>
                    <li><strong>Escritório 2:</strong> Mesa FIN-1 (João Pedro) e posições de Liderança</li>
                    <li><strong>Área de Serviços em Loja:</strong> Espaço presencial de entrega e assistência</li>
                  </ul>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Liderança Volante */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-600" />
            Liderança e Gestão Circulante (Sem Cadeira Fixa)
          </h2>
          <p className="text-xs text-slate-500">
            Sócios e gestores com atuação itinerante entre a Matriz e a Filial
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
          {LEADERSHIP_TEAM.map((leader, i) => (
            <div
              key={i}
              className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col justify-between space-y-3 shadow-2xs"
            >
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-slate-900 text-sm">{leader.name}</span>
                  <Award className="w-4 h-4 text-amber-600" />
                </div>
                <div className="text-xs font-bold text-blue-700 mb-2">
                  {leader.role}
                </div>
                <p className="text-slate-600 leading-relaxed text-[11px]">
                  {leader.focus}
                </p>
              </div>

              <div className="pt-2 border-t border-slate-200 flex items-center gap-1.5 text-[10px] text-slate-500 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                <span>Atuação volante entre Matriz 546 e Filial 777</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
