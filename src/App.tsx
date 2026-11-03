import { lazy, Suspense, useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { actionForKey, actionForSwipe, createState, FixedClock, type Action, type GameState } from './game/simulation';
import type { Session } from './GameViewport';
import type { Telemetry } from './render/TowerScene';
import type { Quality } from './game/config';
const GameViewport = lazy(() => import('./GameViewport'));
const format = (n: number) => n.toLocaleString('ja-JP');
function hasTutorial() { try { return localStorage.getItem('daiei-climb.tutorial.v1') === 'done'; } catch { return false; } }
export default function App() {
  const session = useRef<Session>({ state: createState(), inputs: [], clock: new FixedClock() });
  const [snapshot, setSnapshot] = useState<GameState>(session.current.state);
  const [ready, setReady] = useState(false); const [error, setError] = useState('');
  const [tutorial, setTutorial] = useState(false); const [settings, setSettings] = useState(false);
  const [quality, setQuality] = useState<Quality>('medium');
  const [telemetry, setTelemetry] = useState<Telemetry>({ fps: 0, calls: 0, geometries: 0, modules: 18 });
  const gesture = useRef<{ x: number; y: number; id: number } | null>(null);
  const onReady = useCallback(() => setReady(true), []);
  const publish = useCallback(() => setSnapshot({ ...session.current.state }), []);
  const input = useCallback((action: Action) => {
    if (session.current.state.status === 'running' && session.current.inputs.length < 4) session.current.inputs.push(action);
  }, []);
  const start = useCallback(() => {
    session.current = { state: { ...createState(), status: 'running' }, inputs: [], clock: new FixedClock() };
    setSettings(false); setTutorial(false); publish();
  }, [publish]);
  const pause = useCallback(() => {
    const state = session.current.state;
    if (state.status === 'ready') return;
    state.status = state.status === 'running' ? 'paused' : 'running';
    session.current.inputs.length = 0; session.current.clock.reset(); setSettings(false); publish();
  }, [publish]);
  const home = () => { session.current = { state: createState(), inputs: [], clock: new FixedClock() }; setSettings(false); publish(); };
  const begin = () => { if (!ready || error) return; if (hasTutorial()) start(); else setTutorial(true); };
  const finishTutorial = () => { try { localStorage.setItem('daiei-climb.tutorial.v1', 'done'); } catch { /* Private mode: tutorial may repeat. */ } start(); };
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && event.target.closest('input, select, textarea, button')) return;
      if (event.key === 'Escape' && !event.repeat) { event.preventDefault(); pause(); return; }
      const action = actionForKey(event.key);
      if (action && session.current.state.status === 'running') { event.preventDefault(); if (!event.repeat) input(action); }
    };
    const blur = () => { if (session.current.state.status === 'running') { session.current.state.status = 'paused'; session.current.inputs.length = 0; session.current.clock.reset(); publish(); } };
    window.addEventListener('keydown', keydown); window.addEventListener('blur', blur);
    return () => { window.removeEventListener('keydown', keydown); window.removeEventListener('blur', blur); };
  }, [input, pause, publish]);
  const pointerDown = (event: PointerEvent<HTMLElement>) => {
    if (session.current.state.status !== 'running' || !(event.target instanceof HTMLCanvasElement) || !event.isPrimary) return;
    gesture.current = { x: event.clientX, y: event.clientY, id: event.pointerId }; event.currentTarget.setPointerCapture(event.pointerId);
  };
  const pointerUp = (event: PointerEvent<HTMLElement>) => {
    const start = gesture.current; gesture.current = null;
    if (!start || start.id !== event.pointerId) return;
    const action = actionForSwipe(event.clientX - start.x, event.clientY - start.y); if (action) input(action);
  };
  const altitude = Math.floor(snapshot.altitudeMm / 1000);
  const running = snapshot.status === 'running'; const paused = snapshot.status === 'paused';
  const zone = altitude < 100 ? '街と緑の上へ' : altitude < 300 ? '青空を抜けて' : altitude < 500 ? '夕焼けの向こう' : '星の海へ';
  return <main className={`app ${running ? 'is-running' : ''}`} onPointerDown={pointerDown} onPointerUp={pointerUp} onPointerCancel={() => gesture.current = null}>
    <Suspense fallback={<div className="boot">3Dの世界を準備しています…</div>}>
      <GameViewport session={session} quality={quality} onReady={onReady} onError={setError} onSnapshot={setSnapshot} onTelemetry={setTelemetry} />
    </Suspense>
    <div className="vignette" />
    <header className="topbar">
      <div className="brand"><span className="brand-symbol">↟</span><div>DAIEI<span>TOWER CLIMB</span></div></div>
      <div className="build-tag"><span />PHASE 01 <b>開発プレビュー</b></div>
      <button className="icon-button" aria-label={running ? '一時停止' : paused ? '再開' : '画質設定'} onClick={event => { running || paused ? pause() : setSettings(!settings); event.currentTarget.blur(); }}>{running ? 'Ⅱ' : paused ? '▷' : '⚙'}</button>
    </header>
    {snapshot.status !== 'ready' && <section className="hud" aria-label="プレイ情報">
      <div><span>ALTITUDE</span><strong>{format(altitude)}<small>m</small></strong></div>
      <i /> <div><span>COINS</span><strong className="muted-stat">0<small>枚</small></strong></div>
      <i /> <div><span>SCORE</span><strong className="muted-stat">0</strong></div>
      <p>コイン・得点は次フェーズで実装</p>
    </section>}
    {snapshot.status === 'ready' && !tutorial && !settings && !error && <section className="intro">
      <p className="eyebrow"><span /> THE SKY IS ONLY THE BEGINNING</p>
      <h1>大栄鉄塔<br/><em>クライム</em><span>DAIEI TOWER CLIMB</span></h1>
      <p className="lead">空の、その先へ。</p>
      <p className="intro-copy">鉄骨をつかみ、一段ずつ高く。<br/>どこまでも続く空へ、登り出そう。</p>
      <button className="primary" onClick={begin} disabled={!ready}>{ready ? 'GAME START' : 'LOADING…'}<span>↗</span></button>
      <p className="preview-note">無限上昇・操作確認モード<br/>障害物・コイン・ランキングはまだありません</p>
      <div className="intro-meta"><span>01 / FOUNDATION</span><span>PC & MOBILE</span></div>
    </section>}
    <aside className="altitude-rail" aria-label="現在の高度帯"><span>UPWARD<br/>& BEYOND</span><div className="rail"><span style={{ bottom: `${Math.min(96, altitude / 550 * 100)}%` }} /></div><b>{String(altitude).padStart(3, '0')}<small> M</small></b><p>{zone}</p></aside>
    {running && <div className="play-hint"><span className="live-dot"/> FREE CLIMB <b>自由に操作して、上昇を体感</b></div>}
    {running && <nav className="touch-controls" aria-label="ゲーム操作"><button onClick={() => input('left')} aria-label="左へ">←</button><button onClick={() => input('jump')} aria-label="ジャンプ">↑</button><button onClick={() => input('slide')} aria-label="スライド">↓</button><button onClick={() => input('right')} aria-label="右へ">→</button></nav>}
    {(tutorial || paused || settings || error) && <div className="overlay"><section className="panel" role="dialog" aria-modal="true" aria-label={error ? '描画エラー' : tutorial ? '操作ガイド' : settings ? '画質設定' : '一時停止'}>
      <p className="eyebrow">{error ? 'WEBGL ERROR' : tutorial ? 'HOW TO CLIMB' : settings ? 'SETTINGS' : 'TAKE A BREATH'}</p>
      <h2>{error ? '3D画面を表示できません' : tutorial ? 'さあ、空へ登ろう。' : settings ? '画質設定' : 'ひと休み。'}</h2>
      {error ? <><p>{error}</p><button className="primary" onClick={() => window.location.reload()}>再読み込み ↗</button></> : tutorial ? <>
        <p>自動で上へ登ります。キー・スワイプ・画面下のボタンで操作できます。</p>
        <div className="guide-grid"><div><b>← →</b><span>左右移動</span><small>← → / A D</small></div><div><b>↑</b><span>ジャンプ</span><small>↑ / W / Space</small></div><div><b>↓</b><span>スライド</span><small>↓ / S</small></div></div>
        <p className="subtle">今回のプレビューには衝突やゲームオーバーはありません。ジャンプ・スライドは動作確認用です。</p>
        <button className="primary" onClick={event => { finishTutorial(); event.currentTarget.blur(); }}>登りはじめる<span>↗</span></button>
      </> : settings ? <><p>描画解像度を調整します。操作と上昇速度は変わりません。</p><div className="quality-options">{(['low', 'medium', 'high'] as const).map((q, i) => <button className={quality === q ? 'selected' : ''} key={q} aria-pressed={quality === q} onClick={() => setQuality(q)}>{['低', '中', '高'][i]}</button>)}</div><p className="subtle">音源は未導入です。音量設定はサウンド実装時に追加します。</p><button className="primary" onClick={() => setSettings(false)}>戻る<span>↩</span></button></> : <>
        <p>{format(altitude)}mまで上昇。準備ができたら続きを。</p><button className="primary" onClick={event => { pause(); event.currentTarget.blur(); }}>再開する<span>▷</span></button><button className="secondary" onClick={event => { start(); event.currentTarget.blur(); }}>最初から登る</button><div className="panel-links"><button onClick={() => setSettings(true)}>画質設定</button><button onClick={home}>タイトルへ戻る</button></div>
      </>}
    </section></div>}
    <footer className="footer"><span className="controls-caption">← → 移動 <i/> ↑ ジャンプ <i/> ↓ スライド <i/> ESC 一時停止</span><span className="telemetry">{telemetry.fps || '—'} FPS <i/> {telemetry.modules} MODULES <i/> {telemetry.calls} DRAWS</span><span className="disclaimer">高度はゲーム上の演出値です</span></footer>
  </main>;
}
