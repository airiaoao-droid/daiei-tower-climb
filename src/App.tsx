import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type PointerEvent,
} from 'react';
import {
  actionForKey,
  actionForSwipe,
  createPlayState,
  createState,
  FixedClock,
  getJstWeekId,
  type Action,
  type GameEvent,
  type GameState,
  type ItemType,
  type ObstacleType,
} from './game/simulation';
import { CONFIG, type Quality } from './game/config';
import type { Session } from './GameViewport';
import type { Telemetry } from './render/TowerScene';
import { SoundManager, type AudioSettings } from './audio/SoundManager';
import {
  fetchWeeklyRanking,
  getOrCreatePlayerId,
  getSavedNickname,
  registerPlayerNickname,
  submitRunRecord,
} from './api/rankingClient';
import type { WeeklyLeaderboardView } from './game/replay';
import { AUDIO_ASSETS, IMAGE_ASSETS, MODEL_ASSETS } from './assets/manifest';

const GameViewport = lazy(() => import('./GameViewport'));
const format = (n: number) => n.toLocaleString('ja-JP');

const ITEM_META: Record<ItemType, { label: string; color: string; icon: string }> = {
  magnet: { label: 'コインマグネット', color: '#45d9ff', icon: '🧲' },
  double: { label: 'コイン2倍', color: '#ffc940', icon: '×2' },
  slow: { label: 'スローモーション', color: '#b57cff', icon: '⏳' },
  high_jump: { label: 'ハイジャンプ', color: '#4ce08a', icon: '⏫' },
};

const FAIL_REASON_TEXT: Record<ObstacleType, string> = {
  beam_low: '下部の水平鉄骨に接触しました（↑ジャンプで回避）',
  beam_high: '上部の看板・梁に接触しました（↓スライドで回避）',
  missing_foothold: '足場の欠損箇所で落下しました（↑ジャンプまたはレーン移動で回避）',
  moving_load: '移動する吊り荷・鉄骨に接触しました（タイミングを見て安全レーンへ回避）',
};

function hasTutorial() {
  try {
    return localStorage.getItem('daiei-climb.tutorial.v1') === 'done';
  } catch {
    return false;
  }
}

function makeSession(running: boolean): Session {
  const weekId = getJstWeekId();
  return {
    runId: `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    state: running ? createPlayState(weekId) : createState({ courseId: weekId, hazardsEnabled: true }),
    inputs: [],
    actionLog: [],
    clock: new FixedClock(),
    submitted: false,
  };
}

export default function App() {
  const playerId = useRef<string>(getOrCreatePlayerId());
  const sound = useRef<SoundManager | null>(null);
  if (!sound.current && typeof window !== 'undefined') {
    sound.current = new SoundManager();
  }

  const session = useRef<Session>(makeSession(false));
  const [snapshot, setSnapshot] = useState<GameState>(session.current.state);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [tutorial, setTutorial] = useState(false);
  const [settings, setSettings] = useState(false);
  const [rankingOpen, setRankingOpen] = useState(false);
  const [assetModalOpen, setAssetModalOpen] = useState(false);
  const [quality, setQuality] = useState<Quality>('medium');
  const [autoQuality, setAutoQuality] = useState(true);
  const [audioSettings, setAudioSettings] = useState<AudioSettings>(
    () => sound.current?.getSettings() ?? { bgmVolume: 0.55, seVolume: 0.75, muted: false }
  );
  const [telemetry, setTelemetry] = useState<Telemetry>({
    fps: 0,
    calls: 0,
    geometries: 0,
    modules: 18,
  });

  const [rankingView, setRankingView] = useState<WeeklyLeaderboardView | null>(null);
  const [rankingStatus, setRankingStatus] = useState<'idle' | 'loading' | 'submitting' | 'saved' | 'error'>('idle');
  const [nicknameInput, setNicknameInput] = useState<string>(() => getSavedNickname());
  const [nicknameMessage, setNicknameMessage] = useState<string>('');
  const [isNewPersonalBest, setIsNewPersonalBest] = useState(false);

  const gesture = useRef<{ x: number; y: number; id: number } | null>(null);
  const onReady = useCallback(() => setReady(true), []);
  const publish = useCallback(() => setSnapshot({ ...session.current.state }), []);

  const refreshRanking = useCallback(async (weekId: string) => {
    setRankingStatus('loading');
    try {
      const view = await fetchWeeklyRanking(weekId, playerId.current);
      setRankingView(view);
      setRankingStatus('idle');
    } catch {
      setRankingStatus('error');
    }
  }, []);

  useEffect(() => {
    refreshRanking(session.current.state.courseId);
    return () => {
      sound.current?.dispose();
    };
  }, [refreshRanking]);

  const handleGameOverSubmit = useCallback(async () => {
    const current = session.current;
    if (current.submitted) return;
    current.submitted = true;
    setRankingStatus('submitting');
    setIsNewPersonalBest(false);

    try {
      const savedNick = getSavedNickname();
      const result = await submitRunRecord({
        runId: current.runId,
        playerId: playerId.current,
        courseId: current.state.courseId,
        ruleVersion: CONFIG.ruleVersion,
        totalTicks: current.state.tick,
        actions: current.actionLog,
        claimedScore: current.state.score,
        claimedAltitudeMeters: Math.floor(current.state.altitudeMm / 1000),
        claimedEffectiveCoins: current.state.effectiveCoins,
        nickname: savedNick || null,
      });
      setRankingView(result.view);
      setRankingStatus(result.accepted ? 'saved' : 'error');
      if (result.updatedPersonalBest) {
        setIsNewPersonalBest(true);
        sound.current?.playSe('newrecord');
      }
    } catch {
      setRankingStatus('error');
    }
  }, []);

  const onGameEvent = useCallback(
    (event: GameEvent, state: GameState) => {
      if (event === 'coin') sound.current?.playSe('coin');
      else if (event === 'item') sound.current?.playSe('item');
      else if (event === 'jump') sound.current?.playSe('jump');
      else if (event === 'land') sound.current?.playSe('land');
      else if (event === 'lane') sound.current?.playSe('lane');
      else if (event === 'gameover') {
        sound.current?.playSe('gameover');
        sound.current?.setBgmZone('none');
        handleGameOverSubmit();
      }
      if (state.status === 'running') {
        const alt = state.altitudeMm / 1000;
        sound.current?.setBgmZone(alt >= 500 ? 'space' : 'normal', Math.abs(state.windDirection));
      }
    },
    [handleGameOverSubmit]
  );

  // Automatic quality adjustment based on measured FPS
  useEffect(() => {
    if (!autoQuality || snapshot.status !== 'running' || telemetry.fps <= 0) return;
    if (telemetry.fps < 26 && quality !== 'low') {
      setQuality('low');
    } else if (telemetry.fps < 42 && quality === 'high') {
      setQuality('medium');
    }
  }, [autoQuality, telemetry.fps, quality, snapshot.status]);

  const input = useCallback((action: Action) => {
    if (session.current.state.status === 'running' && session.current.inputs.length < 4) {
      session.current.inputs.push(action);
    }
  }, []);

  const start = useCallback(() => {
    sound.current?.unlock();
    session.current = makeSession(true);
    sound.current?.setPaused(false);
    sound.current?.setBgmZone('normal');
    setSettings(false);
    setTutorial(false);
    setRankingOpen(false);
    setAssetModalOpen(false);
    setNicknameMessage('');
    setIsNewPersonalBest(false);
    publish();
  }, [publish]);

  const pause = useCallback(() => {
    const state = session.current.state;
    if (state.status === 'ready' || state.status === 'gameover') return;
    state.status = state.status === 'running' ? 'paused' : 'running';
    sound.current?.setPaused(state.status === 'paused');
    session.current.inputs.length = 0;
    session.current.clock.reset();
    setSettings(false);
    publish();
  }, [publish]);

  const home = () => {
    session.current = makeSession(false);
    sound.current?.setBgmZone('none');
    setSettings(false);
    setRankingOpen(false);
    publish();
  };

  const begin = () => {
    if (!ready || error) return;
    sound.current?.unlock();
    if (hasTutorial()) start();
    else setTutorial(true);
  };

  const finishTutorial = () => {
    try {
      localStorage.setItem('daiei-climb.tutorial.v1', 'done');
    } catch {
      /* Private mode */
    }
    start();
  };

  const handleNicknameSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setNicknameMessage('登録中…');
    const res = await registerPlayerNickname(
      session.current.state.courseId,
      playerId.current,
      nicknameInput
    );
    if (!res.ok) {
      setNicknameMessage(res.error || '登録に失敗しました。');
      return;
    }
    if (res.view) setRankingView(res.view);
    setNicknameMessage('週間ランキングに公開登録しました！');
  };

  const updateAudio = (partial: Partial<AudioSettings>) => {
    if (!sound.current) return;
    sound.current.updateSettings(partial);
    setAudioSettings(sound.current.getSettings());
  };

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && event.target.closest('input, select, textarea, button'))
        return;
      if (event.key === 'Escape' && !event.repeat) {
        event.preventDefault();
        pause();
        return;
      }
      const action = actionForKey(event.key);
      if (action && session.current.state.status === 'running') {
        event.preventDefault();
        if (!event.repeat) input(action);
      }
    };
    const blur = () => {
      if (session.current.state.status === 'running') {
        session.current.state.status = 'paused';
        sound.current?.setPaused(true);
        session.current.inputs.length = 0;
        session.current.clock.reset();
        publish();
      }
    };
    window.addEventListener('keydown', keydown);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', keydown);
      window.removeEventListener('blur', blur);
    };
  }, [input, pause, publish]);

  const pointerDown = (event: PointerEvent<HTMLElement>) => {
    if (
      session.current.state.status !== 'running' ||
      !(event.target instanceof HTMLCanvasElement) ||
      !event.isPrimary
    )
      return;
    gesture.current = { x: event.clientX, y: event.clientY, id: event.pointerId };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const pointerUp = (event: PointerEvent<HTMLElement>) => {
    const startPt = gesture.current;
    gesture.current = null;
    if (!startPt || startPt.id !== event.pointerId) return;
    const action = actionForSwipe(event.clientX - startPt.x, event.clientY - startPt.y);
    if (action) input(action);
  };

  const altitude = Math.floor(snapshot.altitudeMm / 1000);
  const running = snapshot.status === 'running';
  const paused = snapshot.status === 'paused';
  const gameover = snapshot.status === 'gameover';
  const zone =
    altitude < 100
      ? '街と緑の上へ'
      : altitude < 300
        ? '青空を抜けて'
        : altitude < 500
          ? '夕焼けの向こう'
          : '星の海へ';

  const activeItemsList = (Object.keys(ITEM_META) as ItemType[]).filter(
    k => snapshot.items[k] > 0
  );

  return (
    <main
      className={`app ${running ? 'is-running' : ''}`}
      onPointerDown={pointerDown}
      onPointerUp={pointerUp}
      onPointerCancel={() => (gesture.current = null)}
    >
      <Suspense fallback={<div className="boot">3Dの世界を準備しています…</div>}>
        <GameViewport
          session={session}
          quality={quality}
          onReady={onReady}
          onError={setError}
          onSnapshot={setSnapshot}
          onTelemetry={setTelemetry}
          onGameEvent={onGameEvent}
        />
      </Suspense>
      <div className="vignette" />

      <header className="topbar">
        <div className="brand">
          <span className="brand-symbol">↟</span>
          <div>
            DAIEI<span>TOWER CLIMB</span>
          </div>
        </div>
        <div className="build-tag">
          <span />
          WEEK {snapshot.courseId} <b>週間共通コース</b>
        </div>
        {snapshot.status === 'ready' && (
          <button
            className="nav-pill"
            onClick={() => {
              refreshRanking(snapshot.courseId);
              setRankingOpen(true);
            }}
          >
            🏆 ランキング
          </button>
        )}
        <button
          className="icon-button"
          aria-label={running ? '一時停止' : paused ? '再開' : '設定'}
          onClick={event => {
            if (running || paused) pause();
            else setSettings(!settings);
            event.currentTarget.blur();
          }}
        >
          {running ? 'Ⅱ' : paused ? '▷' : '⚙'}
        </button>
      </header>

      {snapshot.status !== 'ready' && (
        <section className="hud" aria-label="プレイ情報">
          <div>
            <span>ALTITUDE</span>
            <strong>
              {format(altitude)}
              <small>m</small>
            </strong>
          </div>
          <i />
          <div>
            <span>COINS {snapshot.items.double > 0 ? '×2' : ''}</span>
            <strong>
              {format(snapshot.effectiveCoins)}
              <small>枚</small>
            </strong>
          </div>
          <i />
          <div>
            <span>SCORE</span>
            <strong>{format(snapshot.score)}</strong>
          </div>
          <p>SCORE = 有効コイン枚数 × 到達高度(m)</p>
        </section>
      )}

      {running && activeItemsList.length > 0 && (
        <aside className="item-timers" aria-label="発動中アイテム">
          {activeItemsList.map(key => {
            const meta = ITEM_META[key];
            const sec = (snapshot.items[key] / CONFIG.stepHz).toFixed(1);
            const pct = Math.min(100, (snapshot.items[key] / CONFIG.itemDurationSteps) * 100);
            return (
              <div className="item-badge" key={key} style={{ borderColor: meta.color }}>
                <span>
                  {meta.icon} {meta.label}
                </span>
                <b>{sec}s</b>
                <div className="item-bar">
                  <i style={{ width: `${pct}%`, background: meta.color }} />
                </div>
              </div>
            );
          })}
        </aside>
      )}

      {running && snapshot.pickupEffectSteps > 0 && snapshot.lastPickedItem && (
        <div
          className="pickup-toast"
          role="status"
          style={{ borderColor: ITEM_META[snapshot.lastPickedItem].color }}
        >
          <span>{ITEM_META[snapshot.lastPickedItem].icon}</span>
          <b>{ITEM_META[snapshot.lastPickedItem].label} GET!</b>
          <small>5.0秒間発動</small>
        </div>
      )}

      {running && (snapshot.windDirection !== 0 || snapshot.windWarningDirection !== 0) && (
        <div className={`wind-banner ${snapshot.windDirection !== 0 ? 'is-active' : ''}`}>
          <span>
            {snapshot.windDirection !== 0 ? '🌬 強風発生中' : '⚠ 強風エリア接近'}
          </span>
          <b>
            {(snapshot.windDirection || snapshot.windWarningDirection) < 0
              ? '← 左方向への風圧'
              : '右方向への風圧 →'}
          </b>
        </div>
      )}

      {snapshot.status === 'ready' &&
        !tutorial &&
        !settings &&
        !rankingOpen &&
        !assetModalOpen &&
        !error && (
          <section className="intro">
            <p className="eyebrow">
              <span /> THE SKY IS ONLY THE BEGINNING
            </p>
            <h1>
              大栄鉄塔
              <br />
              <em>クライム</em>
              <span>DAIEI TOWER CLIMB</span>
            </h1>
            <p className="lead">空の、その先へ。</p>
            <p className="intro-copy">
              障害物をかわし、コインを集めながら一段ずつ高く。
              <br />
              街から青空、夕焼け、そして宇宙へ続く3Dエンドレスクライム。
            </p>
            <button className="primary" onClick={begin} disabled={!ready}>
              {ready ? 'GAME START' : 'LOADING…'}
              <span>↗</span>
            </button>
            <div className="intro-actions">
              <button
                className="secondary-inline"
                onClick={() => {
                  refreshRanking(snapshot.courseId);
                  setRankingOpen(true);
                }}
              >
                🏆 週間TOP100ランキング
              </button>
              <button className="secondary-inline" onClick={() => setTutorial(true)}>
                操作ガイド
              </button>
              <button className="secondary-inline" onClick={() => setAssetModalOpen(true)}>
                素材仕様一覧
              </button>
            </div>
            <div className="intro-meta">
              <span>WEEK: {snapshot.courseId}</span>
              <span>PC &amp; MOBILE 3-LANE 3D</span>
            </div>
          </section>
        )}

      <aside className="altitude-rail" aria-label="現在の高度帯">
        <span>
          UPWARD
          <br />
          &amp; BEYOND
        </span>
        <div className="rail">
          <span style={{ bottom: `${Math.min(96, (altitude / 550) * 100)}%` }} />
        </div>
        <b>
          {String(altitude).padStart(3, '0')}
          <small> M</small>
        </b>
        <p>{zone}</p>
      </aside>

      {running && (
        <nav className="touch-controls" aria-label="ゲーム操作">
          <button onClick={() => input('left')} aria-label="左へ">
            ←
          </button>
          <button onClick={() => input('jump')} aria-label="ジャンプ">
            ↑
          </button>
          <button onClick={() => input('slide')} aria-label="スライド">
            ↓
          </button>
          <button onClick={() => input('right')} aria-label="右へ">
            →
          </button>
        </nav>
      )}

      {(tutorial || paused || settings || gameover || rankingOpen || assetModalOpen || error) && (
        <div className="overlay">
          <section
            className={`panel ${rankingOpen || assetModalOpen ? 'panel-wide' : ''}`}
            role="dialog"
            aria-modal="true"
            aria-label={
              error
                ? '描画エラー'
                : gameover
                  ? 'ゲームオーバー'
                  : rankingOpen
                    ? '週間ランキング'
                    : assetModalOpen
                      ? '差し替え素材仕様'
                      : tutorial
                        ? '操作ガイド'
                        : settings
                          ? '設定'
                          : '一時停止'
            }
          >
            {error ? (
              <>
                <p className="eyebrow">WEBGL ERROR</p>
                <h2>3D画面を表示できません</h2>
                <p>{error}</p>
                <button className="primary" onClick={() => window.location.reload()}>
                  再読み込み ↗
                </button>
              </>
            ) : gameover ? (
              <>
                <p className="eyebrow">
                  {isNewPersonalBest ? '✨ NEW WEEKLY RECORD!' : 'CLIMB FINISHED'}
                </p>
                <h2>GAME OVER</h2>
                {snapshot.failReason && (
                  <p className="fail-reason">{FAIL_REASON_TEXT[snapshot.failReason]}</p>
                )}
                <div className="result-grid">
                  <div>
                    <span>FINAL SCORE</span>
                    <strong>{format(snapshot.score)}</strong>
                  </div>
                  <div>
                    <span>ALTITUDE</span>
                    <strong>
                      {format(altitude)}
                      <small>m</small>
                    </strong>
                  </div>
                  <div>
                    <span>COINS</span>
                    <strong>
                      {format(snapshot.effectiveCoins)}
                      <small>枚</small>
                    </strong>
                  </div>
                </div>

                <div className="rank-status-box">
                  {rankingStatus === 'submitting' ? (
                    <p>サーバーで操作履歴を検証・集計中…</p>
                  ) : rankingView?.myRecord ? (
                    <p>
                      今週の自己ベスト: <b>{format(rankingView.myRecord.score)}点</b>（
                      {rankingView.myRecord.rank
                        ? `週間 ${rankingView.myRecord.rank}位`
                        : '仮記録として保存済み・ニックネーム登録でランキング掲載'}
                      ）
                    </p>
                  ) : (
                    <p>記録を保存しました。</p>
                  )}

                  <form className="nickname-form" onSubmit={handleNicknameSubmit}>
                    <input
                      type="text"
                      maxLength={12}
                      placeholder="ニックネーム (1〜12文字)"
                      value={nicknameInput}
                      onChange={e => setNicknameInput(e.target.value)}
                      aria-label="ランキング掲載用ニックネーム"
                    />
                    <button type="submit" className="secondary-btn">
                      ランキングに登録
                    </button>
                  </form>
                  {nicknameMessage && <small className="nick-feedback">{nicknameMessage}</small>}
                </div>

                <button
                  className="primary"
                  onClick={event => {
                    start();
                    event.currentTarget.blur();
                  }}
                >
                  もう一度登る（即時再挑戦）<span>↻</span>
                </button>
                <div className="panel-links">
                  <button
                    onClick={() => {
                      setRankingOpen(true);
                    }}
                  >
                    🏆 週間ランキングを見る
                  </button>
                  <button onClick={home}>タイトルへ戻る</button>
                </div>
              </>
            ) : rankingOpen ? (
              <>
                <p className="eyebrow">WEEKLY LEADERBOARD (JST MONDAY 00:00 RESET)</p>
                <h2>週間TOP100ランキング</h2>
                <p className="subtle">
                  対象週: <b>{snapshot.courseId}</b>（毎週月曜0:00 JST切替・全プレイヤー同一シードコース）
                </p>

                {rankingView && rankingView.podium.length > 0 && (
                  <div className="podium-grid" aria-label="上位3名表彰台">
                    {rankingView.podium.map(p => (
                      <div className={`podium-card rank-${p.rank}`} key={p.playerId}>
                        <span className="medal">
                          {p.rank === 1 ? '🥇 1st' : p.rank === 2 ? '🥈 2nd' : '🥉 3rd'}
                        </span>
                        <strong>{p.nickname}</strong>
                        <b>{format(p.score)} pt</b>
                        <small>
                          {format(p.altitudeMeters)}m × {format(p.effectiveCoins)}枚
                        </small>
                      </div>
                    ))}
                  </div>
                )}

                <div className="ranking-list" role="region" aria-label="4位〜100位一覧">
                  {rankingView && rankingView.top100.length > 3 ? (
                    rankingView.top100.slice(3).map(entry => (
                      <div
                        className={`ranking-row ${entry.playerId === playerId.current ? 'is-me' : ''}`}
                        key={entry.playerId}
                      >
                        <span className="r-rank">#{entry.rank}</span>
                        <span className="r-name">{entry.nickname}</span>
                        <span className="r-detail">
                          {format(entry.altitudeMeters)}m / {format(entry.effectiveCoins)}枚
                        </span>
                        <strong className="r-score">{format(entry.score)}</strong>
                      </div>
                    ))
                  ) : (
                    <p className="subtle">4位以下の記録はまだありません。</p>
                  )}
                </div>

                <div className="my-rank-bar">
                  <span>あなたの今週の最高記録:</span>
                  {rankingView?.myRecord ? (
                    <b>
                      {rankingView.myRecord.rank
                        ? `${rankingView.myRecord.rank}位`
                        : '未公開（仮記録）'}{' '}
                      / {format(rankingView.myRecord.score)}点（
                      {format(rankingView.myRecord.altitudeMeters)}m・
                      {format(rankingView.myRecord.effectiveCoins)}枚）
                    </b>
                  ) : (
                    <b>未記録（プレイすると自動集計されます）</b>
                  )}
                </div>

                <button className="primary" onClick={() => setRankingOpen(false)}>
                  閉じる<span>↩</span>
                </button>
              </>
            ) : assetModalOpen ? (
              <>
                <p className="eyebrow">REPLACEABLE ASSET MANIFEST</p>
                <h2>自作素材（GLB・PNG・MP3/WAV）差し替え仕様</h2>
                <div className="ranking-list">
                  <p className="subtle">
                    <b>3Dモデル (GLB形式 / public/assets/models/)</b>
                  </p>
                  {MODEL_ASSETS.map(m => (
                    <div className="ranking-row" key={m.id}>
                      <span className="r-name">{m.fileName}</span>
                      <span className="r-detail">
                        {m.dimensionsMeters.width}×{m.dimensionsMeters.height}×
                        {m.dimensionsMeters.depth}m
                      </span>
                      <small>{m.description}</small>
                    </div>
                  ))}
                  <p className="subtle">
                    <b>画像 (PNG形式 / public/assets/images/)</b>
                  </p>
                  {IMAGE_ASSETS.map(img => (
                    <div className="ranking-row" key={img.id}>
                      <span className="r-name">{img.fileName}</span>
                      <span className="r-detail">
                        {img.aspectRatio} ({img.pixelSize.width}×{img.pixelSize.height}px)
                      </span>
                      <small>{img.description}</small>
                    </div>
                  ))}
                  <p className="subtle">
                    <b>音源 (MP3・WAV形式 / public/assets/audio/)</b>
                  </p>
                  {AUDIO_ASSETS.map(aud => (
                    <div className="ranking-row" key={aud.id}>
                      <span className="r-name">{aud.fileName}</span>
                      <span className="r-detail">
                        {aud.durationSeconds} / {aud.loop ? 'ループ' : '単発'}
                      </span>
                      <small>{aud.description}</small>
                    </div>
                  ))}
                </div>
                <button className="primary" onClick={() => setAssetModalOpen(false)}>
                  閉じる<span>↩</span>
                </button>
              </>
            ) : tutorial ? (
              <>
                <p className="eyebrow">HOW TO CLIMB</p>
                <h2>さあ、空へ登ろう。</h2>
                <p>
                  自動で鉄塔を登ります。障害物に1回接触するとゲームオーバー。コインを集めて高みを目指しましょう！
                </p>
                <div className="guide-grid">
                  <div>
                    <b>← →</b>
                    <span>左右レーン移動</span>
                    <small>← → / A D / 左右スワイプ</small>
                  </div>
                  <div>
                    <b>↑</b>
                    <span>ジャンプ（低い梁・欠損回避）</span>
                    <small>↑ / W / Space / 上スワイプ</small>
                  </div>
                  <div>
                    <b>↓</b>
                    <span>スライド（高い梁くぐり）</span>
                    <small>↓ / S / 下スワイプ</small>
                  </div>
                </div>
                <p className="subtle">
                  特殊アイテム（マグネット・コイン2倍・スロー・ハイジャンプ）は各5秒間有効です。
                </p>
                <button
                  className="primary"
                  onClick={event => {
                    finishTutorial();
                    event.currentTarget.blur();
                  }}
                >
                  登りはじめる<span>↗</span>
                </button>
              </>
            ) : settings ? (
              <>
                <p className="eyebrow">SETTINGS</p>
                <h2>画質・サウンド設定</h2>
                <p>描画解像度とBGM・効果音の音量を調整します。</p>
                <div className="quality-options">
                  {(['low', 'medium', 'high'] as const).map((q, i) => (
                    <button
                      className={quality === q ? 'selected' : ''}
                      key={q}
                      aria-pressed={quality === q}
                      onClick={() => {
                        setAutoQuality(false);
                        setQuality(q);
                      }}
                    >
                      {['低', '中', '高'][i]}
                    </button>
                  ))}
                </div>
                <label className="setting-row">
                  <span>自動画質調整（FPS連動）</span>
                  <input
                    type="checkbox"
                    checked={autoQuality}
                    onChange={e => setAutoQuality(e.target.checked)}
                  />
                </label>
                <label className="setting-row">
                  <span>ミュート（消音）</span>
                  <input
                    type="checkbox"
                    checked={audioSettings.muted}
                    onChange={e => updateAudio({ muted: e.target.checked })}
                  />
                </label>
                <label className="setting-row">
                  <span>BGM音量 ({Math.round(audioSettings.bgmVolume * 100)}%)</span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={audioSettings.bgmVolume}
                    onChange={e => updateAudio({ bgmVolume: Number(e.target.value) })}
                  />
                </label>
                <label className="setting-row">
                  <span>効果音音量 ({Math.round(audioSettings.seVolume * 100)}%)</span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={audioSettings.seVolume}
                    onChange={e => updateAudio({ seVolume: Number(e.target.value) })}
                  />
                </label>
                <button className="primary" onClick={() => setSettings(false)}>
                  戻る<span>↩</span>
                </button>
              </>
            ) : (
              <>
                <p className="eyebrow">TAKE A BREATH</p>
                <h2>一時停止中</h2>
                <p>
                  {format(altitude)}mまで上昇（現在スコア: {format(snapshot.score)}点）。
                </p>
                <button
                  className="primary"
                  onClick={event => {
                    pause();
                    event.currentTarget.blur();
                  }}
                >
                  再開する<span>▷</span>
                </button>
                <button
                  className="secondary"
                  onClick={event => {
                    start();
                    event.currentTarget.blur();
                  }}
                >
                  最初から登る（リスタート）
                </button>
                <div className="panel-links">
                  <button onClick={() => setSettings(true)}>画質・音量設定</button>
                  <button onClick={home}>終了してタイトルへ戻る</button>
                </div>
              </>
            )}
          </section>
        </div>
      )}

      <footer className="footer">
        <span className="controls-caption">
          ← → 移動 <i /> ↑ ジャンプ <i /> ↓ スライド <i /> ESC 一時停止
        </span>
        <span className="telemetry">
          {telemetry.fps || '—'} FPS <i /> {telemetry.modules} MODULES <i /> {telemetry.calls} DRAWS
        </span>
        <span className="disclaimer">高度はゲーム上の演出値です</span>
      </footer>
    </main>
  );
}
