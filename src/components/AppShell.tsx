import { useEffect } from 'react';
import { MapView } from './MapView';
import { Panel } from './Panel';
import { POIDetailDialog } from './POIDetailDialog';
import { LoadingBadge } from './LoadingBadge';
import { useAppStore } from '@/store/useAppStore';

export function AppShell() {
  const trace = useAppStore((s) => s.trace);

  // Dès qu'une trace est chargée, on bascule en mode app.
  // On ne retire pas automatiquement la classe quand trace = null :
  // l'utilisateur peut vouloir « changer de trace » sans repasser par la landing.
  // Le bouton « Home » de la sidebar gère le retour explicite à la landing.
  useEffect(() => {
    if (trace) document.body.classList.add('is-app');
  }, [trace]);

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <main className="relative min-w-0 flex-1">
        <MapView />
        <LoadingBadge />
      </main>
      <Panel />
      <POIDetailDialog />
    </div>
  );
}
