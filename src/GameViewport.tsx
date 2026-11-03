import { useEffect, useRef, type MutableRefObject } from 'react';
import { TowerScene, type Telemetry } from './render/TowerScene';
import { FixedClock, step, type Action, type GameState } from './game/simulation';
import type { Quality } from './game/config';
export interface Session { state: GameState; inputs: Action[]; clock: FixedClock; }
interface Props {
  session: MutableRefObject<Session>; quality: Quality;
  onReady: () => void; onError: (message: string) => void;
  onSnapshot: (state: GameState) => void; onTelemetry: (stats: Telemetry) => void;
}
export default function GameViewport({ session, quality, onReady, onError, onSnapshot, onTelemetry }: Props) {
  const host = useRef<HTMLDivElement>(null); const view = useRef<TowerScene | null>(null);
  const initialQuality = useRef(quality);
  useEffect(() => {
    let scene: TowerScene;
    try { scene = new TowerScene(host.current!, initialQuality.current); view.current = scene; }
    catch { onError('3D画面を起動できませんでした。WebGL 2対応ブラウザーで、ハードウェアアクセラレーションを有効にして再読み込みしてください。'); return; }
    let previous = performance.now(); let lastHud = 0;
    const frame = (now: number) => {
      const elapsed = (now - previous) / 1000; previous = now;
      const game = session.current;
      if (game.state.status === 'running') game.clock.advance(elapsed, () => { step(game.state, game.inputs); game.inputs.length = 0; });
      else { game.clock.reset(); game.inputs.length = 0; }
      scene.render(game.state, now);
      if (now - lastHud > 100) { onSnapshot({ ...game.state }); onTelemetry(scene.telemetry()); lastHud = now; }
    };
    const visibility = () => {
      if (document.hidden) {
        if (session.current.state.status === 'running') session.current.state.status = 'paused';
        session.current.inputs.length = 0; session.current.clock.reset();
        scene.renderer.setAnimationLoop(null); onSnapshot({ ...session.current.state });
      } else { previous = performance.now(); scene.renderer.setAnimationLoop(frame); }
    };
    const lost = (event: Event) => { event.preventDefault(); session.current.state.status = 'paused'; scene.renderer.setAnimationLoop(null); onError('3D描画との接続が失われました。ページを再読み込みしてください。'); };
    scene.renderer.domElement.addEventListener('webglcontextlost', lost);
    document.addEventListener('visibilitychange', visibility); visibility(); onReady();
    return () => { document.removeEventListener('visibilitychange', visibility); scene.renderer.domElement.removeEventListener('webglcontextlost', lost); scene.dispose(); view.current = null; };
  }, [session, onReady, onError, onSnapshot, onTelemetry]);
  useEffect(() => { view.current?.setQuality(quality); }, [quality]);
  return <div className="viewport" ref={host} />;
}
