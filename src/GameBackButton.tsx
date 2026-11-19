import { useEffect, useState } from 'react';

/**
 * Overlay "home" button for /game.
 * Does not modify the game: it only observes whether the title screen (.intro) is shown,
 * and is visible only there (hidden during play, pause, game over, and modals).
 */
export default function GameBackButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const check = () => setVisible(document.querySelector('.intro') !== null);
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.getElementById('root')!, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  if (!visible) return null;

  return (
    <a
      href="/"
      aria-label="トップへ戻る"
      style={{
        position: 'fixed',
        left: 'calc(env(safe-area-inset-left, 0px) + 16px)',
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 48px)',
        zIndex: 10,
        width: 44,
        height: 44,
        display: 'grid',
        placeItems: 'center',
        borderRadius: '50%',
        background: '#1f3a5fe6',
        border: '1px solid #ffffff4d',
        color: '#fff',
        fontSize: 20,
        textDecoration: 'none',
      }}
    >
      ⌂
    </a>
  );
}
