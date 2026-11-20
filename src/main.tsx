import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { TeamPublishedView } from './components/TeamPublishedView.tsx';
import './index.css';

// "#equipe" abre a escala publicada (somente leitura) para o time;
// sem hash, abre o planejador da gerência.
const isTeamRoute = () => window.location.hash.replace(/^#\/?/, '').startsWith('equipe');

function Root() {
  const [team, setTeam] = useState(isTeamRoute);
  useEffect(() => {
    const onHash = () => setTeam(isTeamRoute());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  useEffect(() => {
    document.title = team
      ? 'Escala da Equipe — Seu Carro PE'
      : 'Planejador Visual de Escala 5x2 — Seu Carro PE';
  }, [team]);
  return team ? <TeamPublishedView /> : <App />;
}

createRoot(document.getElementById('root')!).render(<Root />);
