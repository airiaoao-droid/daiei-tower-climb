import React from 'react';
import { createRoot } from 'react-dom/client';

const root = createRoot(document.getElementById('root')!);
const isGame = window.location.pathname.replace(/\/+$/, '') === '/game';

if (isGame) {
  // Existing game: loaded exactly as before (App + styles.css unchanged)
  Promise.all([import('./App'), import('./GameBackButton'), import('./styles.css')]).then(
    ([{ default: App }, { default: GameBackButton }]) => {
      root.render(
        <React.StrictMode>
          <App />
          <GameBackButton />
        </React.StrictMode>
      );
    }
  );
} else {
  // New lightweight top page (no Three.js / game code loaded)
  Promise.all([import('./top/TopPage'), import('./top/top.css')]).then(([{ default: TopPage }]) => {
    root.render(
      <React.StrictMode>
        <TopPage />
      </React.StrictMode>
    );
  });
}
