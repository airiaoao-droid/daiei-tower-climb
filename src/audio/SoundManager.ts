import { AUDIO_ASSETS } from '../assets/manifest';

export type SoundEffectId = 'coin' | 'jump' | 'land' | 'lane' | 'item' | 'gameover' | 'newrecord';
export type BgmZone = 'none' | 'normal' | 'space';

export interface AudioSettings {
  bgmVolume: number;
  seVolume: number;
  muted: boolean;
}

const STORAGE_KEY = 'daiei-climb.audio.v1';

const SE_PATH_MAP: Record<SoundEffectId, string> = {
  coin: '/assets/audio/se-coin.mp3',
  jump: '/assets/audio/se-jump.mp3',
  land: '/assets/audio/se-land.mp3',
  lane: '/assets/audio/se-lane-move.mp3',
  item: '/assets/audio/se-item-get.mp3',
  gameover: '/assets/audio/se-gameover.mp3',
  newrecord: '/assets/audio/se-new-record.mp3',
};

const BGM_PATH_MAP: Record<Exclude<BgmZone, 'none'>, string> = {
  normal: '/assets/audio/bgm-climb-normal.mp3',
  space: '/assets/audio/bgm-climb-space.mp3',
};

const WIND_AMBIENCE_PATH = '/assets/audio/ambience-wind-loop.mp3';

export class SoundManager {
  private ctx: AudioContext | null = null;
  private settings: AudioSettings = { bgmVolume: 0.55, seVolume: 0.75, muted: false };
  private bgmZone: BgmZone = 'none';
  private paused = false;
  private windLevel = 0;
  private htmlAudios = new Map<string, HTMLAudioElement>();
  private sePool = new Map<SoundEffectId, HTMLAudioElement[]>();

  constructor() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        this.settings = {
          bgmVolume: typeof parsed.bgmVolume === 'number' ? Math.max(0, Math.min(1, parsed.bgmVolume)) : 0.55,
          seVolume: typeof parsed.seVolume === 'number' ? Math.max(0, Math.min(1, parsed.seVolume)) : 0.75,
          muted: Boolean(parsed.muted),
        };
      }
    } catch {
      // Ignore storage errors in private mode
    }
    this.preloadAudioElements();
  }

  private preloadAudioElements() {
    if (typeof window === 'undefined' || typeof Audio === 'undefined') return;
    try {
      for (const [zone, path] of Object.entries(BGM_PATH_MAP)) {
        const audio = new Audio(path);
        audio.loop = true;
        audio.preload = 'auto';
        this.htmlAudios.set(`bgm_${zone}`, audio);
      }

      const windAudio = new Audio(WIND_AMBIENCE_PATH);
      windAudio.loop = true;
      windAudio.preload = 'auto';
      this.htmlAudios.set('ambience_wind', windAudio);

      for (const [seId, path] of Object.entries(SE_PATH_MAP) as [SoundEffectId, string][]) {
        const pool: HTMLAudioElement[] = [];
        for (let i = 0; i < 3; i++) {
          const a = new Audio(path);
          a.preload = 'auto';
          pool.push(a);
        }
        this.sePool.set(seId, pool);
      }
      this.syncHtmlAudioVolumes();
    } catch {
      // Ignore in non-browser test environments
    }
  }

  getSettings(): AudioSettings {
    return { ...this.settings };
  }

  updateSettings(partial: Partial<AudioSettings>) {
    this.settings = { ...this.settings, ...partial };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch {
      // Ignore storage errors
    }
    this.syncHtmlAudioVolumes();
    this.syncPlaybackState();
  }

  unlock() {
    if (typeof window === 'undefined') return;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AudioCtx && !this.ctx) {
      try {
        this.ctx = new AudioCtx();
      } catch {
        // Ignore
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    this.syncPlaybackState();
  }

  setPaused(paused: boolean) {
    this.paused = paused;
    this.syncPlaybackState();
  }

  setBgmZone(zone: BgmZone, windStrength = 0) {
    const zoneChanged = this.bgmZone !== zone;
    this.bgmZone = zone;
    this.windLevel = windStrength;

    if (zoneChanged) {
      for (const key of ['bgm_normal', 'bgm_space']) {
        const audio = this.htmlAudios.get(key);
        if (audio && key !== `bgm_${zone}`) {
          audio.pause();
          audio.currentTime = 0;
        }
      }
    }
    this.syncPlaybackState();
  }

  private syncPlaybackState() {
    const canPlay = !this.paused && !this.settings.muted;
    for (const zone of ['normal', 'space'] as const) {
      const audio = this.htmlAudios.get(`bgm_${zone}`);
      if (!audio) continue;
      audio.volume = this.settings.muted ? 0 : this.settings.bgmVolume;
      if (canPlay && this.bgmZone === zone && this.settings.bgmVolume > 0.01) {
        if (audio.paused) {
          audio.play().catch(() => {});
        }
      } else if (!audio.paused) {
        audio.pause();
      }
    }

    const windAudio = this.htmlAudios.get('ambience_wind');
    if (windAudio) {
      windAudio.volume = this.settings.muted ? 0 : Math.min(1, this.settings.seVolume * 0.65);
      if (canPlay && this.bgmZone !== 'none' && this.windLevel !== 0 && this.settings.seVolume > 0.01) {
        if (windAudio.paused) {
          windAudio.play().catch(() => {});
        }
      } else if (!windAudio.paused) {
        windAudio.pause();
      }
    }
  }

  playSe(effect: SoundEffectId) {
    if (this.paused || this.settings.muted || this.settings.seVolume <= 0.01) return;
    this.unlock();

    const pool = this.sePool.get(effect);
    if (pool && pool.length > 0) {
      const target = pool.find(a => a.paused || a.ended) ?? pool[0];
      target.volume = this.settings.seVolume;
      target.currentTime = 0;
      target.play().catch(() => {
        this.playSynthFallback(effect);
      });
      return;
    }

    this.playSynthFallback(effect);
  }

  private playSynthFallback(effect: SoundEffectId) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const gainValue = this.settings.seVolume * 0.18;

    switch (effect) {
      case 'coin':
        this.tone(987.77, now, 0.07, 'sine', gainValue);
        this.tone(1318.51, now + 0.065, 0.14, 'sine', gainValue * 0.9);
        break;
      case 'jump':
        this.sweep(240, 540, now, 0.16, 'triangle', gainValue);
        break;
      case 'land':
        this.sweep(150, 95, now, 0.08, 'sine', gainValue * 0.7);
        break;
      case 'lane':
        this.sweep(320, 420, now, 0.07, 'sine', gainValue * 0.65);
        break;
      case 'item':
        this.tone(523.25, now, 0.08, 'triangle', gainValue);
        this.tone(659.25, now + 0.07, 0.08, 'triangle', gainValue);
        this.tone(783.99, now + 0.14, 0.09, 'triangle', gainValue);
        this.tone(1046.5, now + 0.22, 0.2, 'triangle', gainValue);
        break;
      case 'newrecord':
        this.tone(587.33, now, 0.1, 'triangle', gainValue);
        this.tone(783.99, now + 0.1, 0.1, 'triangle', gainValue);
        this.tone(987.77, now + 0.2, 0.12, 'triangle', gainValue);
        this.tone(1174.66, now + 0.32, 0.28, 'triangle', gainValue);
        break;
      case 'gameover':
        this.sweep(310, 110, now, 0.42, 'sawtooth', gainValue * 0.85);
        break;
    }
  }

  private tone(freq: number, startTime: number, duration: number, type: OscillatorType, volume: number) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(volume, startTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.02);
  }

  private sweep(
    startFreq: number,
    endFreq: number,
    startTime: number,
    duration: number,
    type: OscillatorType,
    volume: number
  ) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, startTime);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), startTime + duration);
    gain.gain.setValueAtTime(volume, startTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.02);
  }

  private syncHtmlAudioVolumes() {
    for (const [id, audio] of this.htmlAudios.entries()) {
      const spec = AUDIO_ASSETS.find(a => a.id === id);
      const base = spec?.category === 'bgm' ? this.settings.bgmVolume : this.settings.seVolume * 0.65;
      audio.volume = this.settings.muted ? 0 : Math.max(0, Math.min(1, base));
    }
    for (const pool of this.sePool.values()) {
      for (const a of pool) {
        a.volume = this.settings.muted ? 0 : Math.max(0, Math.min(1, this.settings.seVolume));
      }
    }
  }

  dispose() {
    for (const audio of this.htmlAudios.values()) {
      audio.pause();
    }
    for (const pool of this.sePool.values()) {
      for (const a of pool) a.pause();
    }
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}
