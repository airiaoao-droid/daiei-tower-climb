import { AUDIO_ASSETS } from '../assets/manifest';

export type SoundEffectId = 'coin' | 'jump' | 'land' | 'lane' | 'item' | 'gameover' | 'newrecord';
export type BgmZone = 'none' | 'normal' | 'space';

export interface AudioSettings {
  bgmVolume: number;
  seVolume: number;
  muted: boolean;
}

const STORAGE_KEY = 'daiei-climb.audio.v1';

export class SoundManager {
  private ctx: AudioContext | null = null;
  private settings: AudioSettings = { bgmVolume: 0.55, seVolume: 0.75, muted: false };
  private bgmZone: BgmZone = 'none';
  private paused = false;
  private windLevel = 0;
  private bgmTimer: number | null = null;
  private stepNote = 0;
  private htmlAudios = new Map<string, HTMLAudioElement>();

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
  }

  unlock() {
    if (typeof window === 'undefined') return;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    if (!this.ctx) {
      try {
        this.ctx = new AudioCtx();
      } catch {
        return;
      }
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  setPaused(paused: boolean) {
    this.paused = paused;
    for (const audio of this.htmlAudios.values()) {
      if (paused) audio.pause();
    }
  }

  setBgmZone(zone: BgmZone, windStrength = 0) {
    this.windLevel = windStrength;
    if (this.bgmZone === zone) return;
    this.bgmZone = zone;
    if (this.bgmTimer !== null && typeof window !== 'undefined') {
      window.clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
    if (zone === 'none' || typeof window === 'undefined') return;

    this.bgmTimer = window.setInterval(() => {
      if (this.paused || this.settings.muted || this.settings.bgmVolume <= 0.01) return;
      this.playProceduralBgmPulse();
    }, zone === 'space' ? 520 : 360);
  }

  playSe(effect: SoundEffectId) {
    if (this.paused || this.settings.muted || this.settings.seVolume <= 0.01) return;
    this.unlock();
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

  private playProceduralBgmPulse() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const vol = this.settings.bgmVolume * 0.05;
    const normalScale = [261.63, 329.63, 392.0, 440.0, 392.0, 329.63, 293.66, 349.23];
    const spaceScale = [220.0, 277.18, 329.63, 440.0, 493.88, 440.0, 329.63, 246.94];
    const scale = this.bgmZone === 'space' ? spaceScale : normalScale;
    const freq = scale[this.stepNote % scale.length];
    this.stepNote++;
    this.tone(freq, now, this.bgmZone === 'space' ? 0.38 : 0.22, 'sine', vol);
    if (this.windLevel !== 0 && this.stepNote % 2 === 0) {
      this.sweep(180, 230, now, 0.25, 'sine', vol * 0.65);
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
      const base = spec?.category === 'bgm' ? this.settings.bgmVolume : this.settings.seVolume;
      audio.volume = this.settings.muted ? 0 : base;
    }
  }

  dispose() {
    if (this.bgmTimer !== null && typeof window !== 'undefined') {
      window.clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}
