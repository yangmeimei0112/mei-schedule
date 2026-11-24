// ============================================================================
// MeiSchedule v1.4.0 — Royalty-Free Offline Focus Light Music & Ambient Engine
// 100% Original Web Audio API Synthesis + Natural Ambient Layers + Local Audio
// ============================================================================

export type FocusMusicTrackId =
  | 'sky-piano'
  | 'warm-lofi'
  | 'starlight-box'
  | 'alpha-pad'
  | 'local-file';

export type FocusAmbientId = 'none' | 'rain' | 'forest' | 'fireplace';

export interface FocusTrackOption {
  id: Exclude<FocusMusicTrackId, 'local-file'>;
  name: string;
  subtitle: string;
  icon: string;
}

export interface FocusAmbientOption {
  id: FocusAmbientId;
  name: string;
  icon: string;
}

export interface FocusAudioPreferences {
  trackId: FocusMusicTrackId;
  ambientId: FocusAmbientId;
  musicVolume: number; // 0..1
  ambientVolume: number; // 0..1
  isMuted: boolean;
  autoSyncWithTimer: boolean;
  chimeEnabled: boolean;
}

export interface FocusAudioSnapshot extends FocusAudioPreferences {
  isPlaying: boolean;
  localFileName: string | null;
  hasLocalFile: boolean;
}

export const FOCUS_AUDIO_STORAGE_KEY = 'mei_schedule_focus_audio_v1';

export const FOCUS_TRACK_OPTIONS: FocusTrackOption[] = [
  {
    id: 'sky-piano',
    name: '晴空鋼琴',
    subtitle: '溫暖柔和電鋼琴琶音',
    icon: 'music'
  },
  {
    id: 'warm-lofi',
    name: '暖陽 Lo-Fi',
    subtitle: '低通柔霧舒緩節奏和弦',
    icon: 'disc-3'
  },
  {
    id: 'starlight-box',
    name: '星夜八音盒',
    subtitle: '清透五聲音階靜謐旋律',
    icon: 'sparkles'
  },
  {
    id: 'alpha-pad',
    name: '心流氛圍',
    subtitle: '緩慢呼吸感深度和聲鋪底',
    icon: 'headphones'
  }
];

export const FOCUS_AMBIENT_OPTIONS: FocusAmbientOption[] = [
  { id: 'none', name: '無環境音', icon: 'volume-x' },
  { id: 'rain', name: '細雨微落', icon: 'cloud-rain' },
  { id: 'forest', name: '森林微風', icon: 'trees' },
  { id: 'fireplace', name: '壁爐暖音', icon: 'flame' }
];

const DEFAULT_AUDIO_PREFS: FocusAudioPreferences = {
  trackId: 'sky-piano',
  ambientId: 'none',
  musicVolume: 0.55,
  ambientVolume: 0.35,
  isMuted: false,
  autoSyncWithTimer: true,
  chimeEnabled: true
};

const VALID_TRACK_IDS: FocusMusicTrackId[] = [
  'sky-piano',
  'warm-lofi',
  'starlight-box',
  'alpha-pad',
  'local-file'
];

const VALID_AMBIENT_IDS: FocusAmbientId[] = ['none', 'rain', 'forest', 'fireplace'];

function clampVolume(v: number): number {
  if (!Number.isFinite(v)) return 0.5;
  return Math.max(0, Math.min(1, Math.round(v * 100) / 100));
}

function readStoredPrefs(): FocusAudioPreferences {
  if (typeof window === 'undefined') return { ...DEFAULT_AUDIO_PREFS };
  try {
    const raw = window.localStorage?.getItem(FOCUS_AUDIO_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_AUDIO_PREFS };
    const parsed = JSON.parse(raw) as Partial<FocusAudioPreferences>;
    // Never restore 'local-file' after reload because ObjectURLs are session-scoped
    const rawTrack = parsed.trackId;
    const safeTrack: FocusMusicTrackId =
      rawTrack && rawTrack !== 'local-file' && VALID_TRACK_IDS.includes(rawTrack)
        ? rawTrack
        : DEFAULT_AUDIO_PREFS.trackId;
    const safeAmbient: FocusAmbientId =
      parsed.ambientId && VALID_AMBIENT_IDS.includes(parsed.ambientId)
        ? parsed.ambientId
        : DEFAULT_AUDIO_PREFS.ambientId;
    return {
      trackId: safeTrack,
      ambientId: safeAmbient,
      musicVolume:
        typeof parsed.musicVolume === 'number'
          ? clampVolume(parsed.musicVolume)
          : DEFAULT_AUDIO_PREFS.musicVolume,
      ambientVolume:
        typeof parsed.ambientVolume === 'number'
          ? clampVolume(parsed.ambientVolume)
          : DEFAULT_AUDIO_PREFS.ambientVolume,
      isMuted: Boolean(parsed.isMuted),
      autoSyncWithTimer:
        typeof parsed.autoSyncWithTimer === 'boolean'
          ? parsed.autoSyncWithTimer
          : DEFAULT_AUDIO_PREFS.autoSyncWithTimer,
      chimeEnabled:
        typeof parsed.chimeEnabled === 'boolean'
          ? parsed.chimeEnabled
          : DEFAULT_AUDIO_PREFS.chimeEnabled
    };
  } catch {
    return { ...DEFAULT_AUDIO_PREFS };
  }
}

function persistPrefs(prefs: FocusAudioPreferences): void {
  if (typeof window === 'undefined') return;
  try {
    const toStore: FocusAudioPreferences = {
      ...prefs,
      trackId: prefs.trackId === 'local-file' ? 'sky-piano' : prefs.trackId
    };
    window.localStorage?.setItem(FOCUS_AUDIO_STORAGE_KEY, JSON.stringify(toStore));
  } catch {
    // Ignore storage quota / privacy restrictions
  }
}

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// ============================================================================
// Melodic Progressions (Original Royalty-Free Pentatonic & Maj9 Voicings)
// ============================================================================

const SKY_PIANO_CHORDS: number[][] = [
  [60, 64, 67, 71, 74], // Cmaj9
  [57, 60, 64, 67, 71], // Am9
  [53, 57, 60, 64, 67], // Fmaj9
  [55, 59, 62, 64, 67] // G6
];

const WARM_LOFI_CHORDS: number[][] = [
  [50, 57, 60, 64, 69], // Dm9
  [55, 59, 62, 65, 69], // G9
  [48, 55, 59, 62, 64], // Cmaj9
  [57, 60, 64, 67, 71] // Am9
];

const STARLIGHT_MELODY_STEPS: Array<number | null> = [
  72, 76, 79, null, 84, 79, 76, null,
  74, 79, 81, null, 79, 76, 74, null,
  72, 74, 76, 79, 84, null, 81, 79,
  76, null, 74, 72, 76, null, 79, null
];

const ALPHA_PAD_CHORDS: number[][] = [
  [48, 55, 60, 64, 67], // Lush C5/add9
  [45, 52, 57, 60, 64], // Warm Am7
  [41, 48, 53, 57, 60], // Soft Fmaj7
  [43, 50, 55, 59, 62] // Gentle G
];

type AudioContextCtor = typeof AudioContext;

function getAudioContextCtor(): AudioContextCtor | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };
  return win.AudioContext || win.webkitAudioContext || null;
}

class FocusAudioEngine {
  private state: FocusAudioSnapshot;
  private listeners = new Set<(snap: FocusAudioSnapshot) => void>();

  private ctx: AudioContext | null = null;
  private musicMasterGain: GainNode | null = null;
  private ambientMasterGain: GainNode | null = null;
  private musicBusFilter: BiquadFilterNode | null = null;
  private delayNode: DelayNode | null = null;
  private delayFeedbackGain: GainNode | null = null;

  private musicTimer: ReturnType<typeof setInterval> | null = null;
  private fadeOutTimer: ReturnType<typeof setTimeout> | null = null;
  private stepIndex = 0;

  private activePadNodes: Array<{ osc: OscillatorNode; gain: GainNode }> = [];
  private activeAmbientNodes: {
    source?: AudioBufferSourceNode;
    lfo?: OscillatorNode;
    crackleTimer?: ReturnType<typeof setInterval>;
    cleanupNodes: AudioNode[];
  } | null = null;

  private localAudioEl: HTMLAudioElement | null = null;
  private localObjectUrl: string | null = null;

  constructor() {
    const prefs = readStoredPrefs();
    this.state = {
      ...prefs,
      isPlaying: false,
      localFileName: null,
      hasLocalFile: false
    };
  }

  public getSnapshot(): FocusAudioSnapshot {
    return { ...this.state };
  }

  public subscribe(listener: (snap: FocusAudioSnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    const snap = this.getSnapshot();
    this.listeners.forEach((cb) => {
      try {
        cb(snap);
      } catch {
        // Ignore subscriber error
      }
    });
  }

  private ensureAudioGraph(): AudioContext | null {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    }

    const Ctor = getAudioContextCtor();
    if (!Ctor) return null;

    try {
      const ctx = new Ctor();
      const musicMaster = ctx.createGain();
      const ambientMaster = ctx.createGain();
      const musicFilter = ctx.createBiquadFilter();
      musicFilter.type = 'lowpass';
      musicFilter.frequency.value = 3200;
      musicFilter.Q.value = 0.7;

      // Gentle warm feedback echo for lush spacious light-music tone
      const delay = ctx.createDelay(1.0);
      delay.delayTime.value = 0.32;
      const delayFeedback = ctx.createGain();
      delayFeedback.gain.value = 0.24;
      const delayWet = ctx.createGain();
      delayWet.gain.value = 0.22;

      musicFilter.connect(musicMaster);
      musicFilter.connect(delay);
      delay.connect(delayFeedback);
      delayFeedback.connect(delay);
      delay.connect(delayWet);
      delayWet.connect(musicMaster);

      musicMaster.gain.value = 0.0001;
      ambientMaster.gain.value = 0.0001;

      musicMaster.connect(ctx.destination);
      ambientMaster.connect(ctx.destination);

      this.ctx = ctx;
      this.musicMasterGain = musicMaster;
      this.ambientMasterGain = ambientMaster;
      this.musicBusFilter = musicFilter;
      this.delayNode = delay;
      this.delayFeedbackGain = delayFeedback;

      if (ctx.state === 'suspended') {
        void ctx.resume().catch(() => {});
      }
      return ctx;
    } catch {
      return null;
    }
  }

  private applyGains(rampSeconds = 0.18): void {
    const musicTarget =
      this.state.isPlaying && !this.state.isMuted ? Math.max(0.0001, this.state.musicVolume * 0.42) : 0.0001;
    const ambientTarget =
      this.state.isPlaying && !this.state.isMuted && this.state.ambientId !== 'none'
        ? Math.max(0.0001, this.state.ambientVolume * 0.34)
        : 0.0001;

    if (this.ctx && this.musicMasterGain && this.ambientMasterGain) {
      const now = this.ctx.currentTime;
      try {
        this.musicMasterGain.gain.cancelScheduledValues(now);
        this.musicMasterGain.gain.setValueAtTime(
          Math.max(0.0001, this.musicMasterGain.gain.value),
          now
        );
        this.musicMasterGain.gain.linearRampToValueAtTime(musicTarget, now + rampSeconds);

        this.ambientMasterGain.gain.cancelScheduledValues(now);
        this.ambientMasterGain.gain.setValueAtTime(
          Math.max(0.0001, this.ambientMasterGain.gain.value),
          now
        );
        this.ambientMasterGain.gain.linearRampToValueAtTime(ambientTarget, now + rampSeconds);
      } catch {
        // Ignore ramp error in mock/non-standard contexts
      }
    }

    if (this.localAudioEl) {
      const vol = this.state.isMuted ? 0 : this.state.musicVolume;
      this.localAudioEl.volume = Math.max(0, Math.min(1, vol));
    }
  }

  private stopSynthMusicNodes(): void {
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    for (const item of this.activePadNodes) {
      try {
        item.osc.stop();
        item.osc.disconnect();
        item.gain.disconnect();
      } catch {
        // Ignore already stopped oscillators
      }
    }
    this.activePadNodes = [];
  }

  private stopLocalAudio(): void {
    if (this.localAudioEl) {
      try {
        this.localAudioEl.pause();
      } catch {
        // Ignore jsdom pause warnings
      }
    }
  }

  private stopAmbientNodes(): void {
    if (!this.activeAmbientNodes) return;
    if (this.activeAmbientNodes.crackleTimer) {
      clearInterval(this.activeAmbientNodes.crackleTimer);
    }
    try {
      this.activeAmbientNodes.source?.stop();
    } catch {}
    try {
      this.activeAmbientNodes.lfo?.stop();
    } catch {}
    for (const node of this.activeAmbientNodes.cleanupNodes) {
      try {
        node.disconnect();
      } catch {}
    }
    this.activeAmbientNodes = null;
  }

  private playSoftNote(
    freq: number,
    options: {
      type?: OscillatorType;
      harmonicType?: OscillatorType;
      harmonicGain?: number;
      attack?: number;
      duration?: number;
      peakGain?: number;
      detuneCents?: number;
      startDelay?: number;
    }
  ): void {
    if (!this.ctx || !this.musicBusFilter) return;
    const now = this.ctx.currentTime + (options.startDelay ?? 0);
    const attack = options.attack ?? 0.05;
    const duration = options.duration ?? 1.8;
    const peak = options.peakGain ?? 0.14;

    const osc = this.ctx.createOscillator();
    osc.type = options.type ?? 'sine';
    osc.frequency.setValueAtTime(freq, now);
    if (options.detuneCents) {
      osc.detune.setValueAtTime(options.detuneCents, now);
    }

    const noteGain = this.ctx.createGain();
    noteGain.gain.setValueAtTime(0.0001, now);
    noteGain.gain.linearRampToValueAtTime(peak, now + attack);
    noteGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(noteGain);
    noteGain.connect(this.musicBusFilter);
    osc.start(now);
    osc.stop(now + duration + 0.05);

    if (options.harmonicType && (options.harmonicGain ?? 0) > 0) {
      const overtone = this.ctx.createOscillator();
      overtone.type = options.harmonicType;
      overtone.frequency.setValueAtTime(freq * 2, now);
      const ovGain = this.ctx.createGain();
      ovGain.gain.setValueAtTime(0.0001, now);
      ovGain.gain.linearRampToValueAtTime(peak * (options.harmonicGain ?? 0.22), now + attack);
      ovGain.gain.exponentialRampToValueAtTime(0.0001, now + duration * 0.72);
      overtone.connect(ovGain);
      ovGain.connect(this.musicBusFilter);
      overtone.start(now);
      overtone.stop(now + duration + 0.05);
    }
  }

  private startMusicGenerator(): void {
    this.stopSynthMusicNodes();
    this.stopLocalAudio();

    if (this.state.trackId === 'local-file' && this.localAudioEl && this.localObjectUrl) {
      this.localAudioEl.loop = true;
      this.localAudioEl.volume = this.state.isMuted ? 0 : this.state.musicVolume;
      void this.localAudioEl.play?.().catch(() => {});
      return;
    }

    const ctx = this.ensureAudioGraph();
    if (!ctx || !this.musicBusFilter) return;

    this.stepIndex = 0;

    if (this.state.trackId === 'sky-piano') {
      this.musicBusFilter.frequency.setValueAtTime(3400, ctx.currentTime);
      if (this.delayFeedbackGain) this.delayFeedbackGain.gain.setValueAtTime(0.24, ctx.currentTime);
      const tick = () => {
        const chordIdx = Math.floor(this.stepIndex / 8) % SKY_PIANO_CHORDS.length;
        const beatInBar = this.stepIndex % 8;
        const chord = SKY_PIANO_CHORDS[chordIdx];

        if (beatInBar === 0) {
          // Warm bass root + soft triad cushion
          this.playSoftNote(midiToFreq(chord[0] - 12), {
            type: 'sine',
            attack: 0.08,
            duration: 3.1,
            peakGain: 0.16
          });
          chord.slice(0, 3).forEach((note, idx) => {
            this.playSoftNote(midiToFreq(note), {
              type: 'sine',
              harmonicType: 'triangle',
              harmonicGain: 0.18,
              attack: 0.06,
              duration: 2.5,
              peakGain: 0.08,
              startDelay: idx * 0.045
            });
          });
        }

        // Flowing pentatonic right-hand arpeggio
        const arpPattern = [2, 3, 4, 3, 2, 4, 3, 1];
        const noteMidi = chord[arpPattern[beatInBar] % chord.length];
        if (beatInBar !== 7 || chordIdx % 2 === 1) {
          this.playSoftNote(midiToFreq(noteMidi), {
            type: 'sine',
            harmonicType: 'triangle',
            harmonicGain: 0.22,
            attack: 0.035,
            duration: 1.5,
            peakGain: beatInBar % 2 === 0 ? 0.11 : 0.08
          });
        }
        this.stepIndex += 1;
      };
      tick();
      this.musicTimer = setInterval(tick, 415); // ~72 BPM eighth-note pulse
      return;
    }

    if (this.state.trackId === 'warm-lofi') {
      this.musicBusFilter.frequency.setValueAtTime(1450, ctx.currentTime);
      if (this.delayFeedbackGain) this.delayFeedbackGain.gain.setValueAtTime(0.18, ctx.currentTime);
      const tick = () => {
        const chordIdx = Math.floor(this.stepIndex / 8) % WARM_LOFI_CHORDS.length;
        const beatInBar = this.stepIndex % 8;
        const chord = WARM_LOFI_CHORDS[chordIdx];

        if (beatInBar === 0 || beatInBar === 5) {
          // Rhodes warm mellow chord with gentle analog detune
          chord.forEach((m, idx) => {
            this.playSoftNote(midiToFreq(m), {
              type: 'triangle',
              attack: 0.08,
              duration: beatInBar === 0 ? 2.6 : 1.4,
              peakGain: idx === 0 ? 0.11 : 0.065,
              detuneCents: idx % 2 === 0 ? -4 : 5,
              startDelay: idx * 0.025
            });
          });
        }
        // Subtle warm Lo-Fi pulse & melody accent
        if (beatInBar === 2 || beatInBar === 6) {
          const mel = chord[(beatInBar + chordIdx) % chord.length] + 12;
          this.playSoftNote(midiToFreq(mel), {
            type: 'sine',
            attack: 0.04,
            duration: 1.15,
            peakGain: 0.075,
            detuneCents: 3
          });
        }
        this.stepIndex += 1;
      };
      tick();
      this.musicTimer = setInterval(tick, 440); // ~68 BPM laid-back swing
      return;
    }

    if (this.state.trackId === 'starlight-box') {
      this.musicBusFilter.frequency.setValueAtTime(4200, ctx.currentTime);
      if (this.delayFeedbackGain) this.delayFeedbackGain.gain.setValueAtTime(0.32, ctx.currentTime);
      const tick = () => {
        const note = STARLIGHT_MELODY_STEPS[this.stepIndex % STARLIGHT_MELODY_STEPS.length];
        if (note !== null) {
          this.playSoftNote(midiToFreq(note), {
            type: 'sine',
            harmonicType: 'sine',
            harmonicGain: 0.28,
            attack: 0.018,
            duration: 1.9,
            peakGain: 0.095
          });
        }
        if (this.stepIndex % 8 === 0) {
          const bassNotes = [60, 57, 53, 55];
          const bass = bassNotes[Math.floor(this.stepIndex / 8) % bassNotes.length];
          this.playSoftNote(midiToFreq(bass), {
            type: 'sine',
            attack: 0.09,
            duration: 3.0,
            peakGain: 0.09
          });
        }
        this.stepIndex += 1;
      };
      tick();
      this.musicTimer = setInterval(tick, 468); // ~64 BPM lullaby pace
      return;
    }

    // 'alpha-pad' — Deep soothing evolving flow-state harmonic pad
    this.musicBusFilter.frequency.setValueAtTime(1150, ctx.currentTime);
    if (this.delayFeedbackGain) this.delayFeedbackGain.gain.setValueAtTime(0.28, ctx.currentTime);
    const playPadChord = () => {
      const chord = ALPHA_PAD_CHORDS[this.stepIndex % ALPHA_PAD_CHORDS.length];
      chord.forEach((m, idx) => {
        this.playSoftNote(midiToFreq(m), {
          type: idx % 2 === 0 ? 'sine' : 'triangle',
          attack: 1.4,
          duration: 5.8,
          peakGain: idx === 0 ? 0.11 : 0.055,
          detuneCents: idx % 2 === 0 ? -5 : 5
        });
      });
      this.stepIndex += 1;
    };
    playPadChord();
    this.musicTimer = setInterval(playPadChord, 4600);
  }

  private createNoiseBuffer(ctx: AudioContext, kind: 'pink' | 'brown'): AudioBuffer {
    const length = ctx.sampleRate * 3;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    if (kind === 'brown') {
      let lastOut = 0;
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        data[i] = (lastOut + 0.02 * white) / 1.02;
        lastOut = data[i];
        data[i] *= 3.2;
      }
      return buffer;
    }

    // Paul Kellet refined pink noise approximation
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    let b3 = 0;
    let b4 = 0;
    let b5 = 0;
    let b6 = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      b3 = 0.8665 * b3 + white * 0.3104856;
      b4 = 0.55 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.016898;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }
    return buffer;
  }

  private startAmbientGenerator(): void {
    this.stopAmbientNodes();
    if (this.state.ambientId === 'none') return;

    const ctx = this.ensureAudioGraph();
    if (!ctx || !this.ambientMasterGain) return;

    const cleanupNodes: AudioNode[] = [];

    if (this.state.ambientId === 'rain') {
      const src = ctx.createBufferSource();
      src.buffer = this.createNoiseBuffer(ctx, 'pink');
      src.loop = true;

      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1150;
      bp.Q.value = 0.55;

      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 3400;

      src.connect(bp);
      bp.connect(lp);
      lp.connect(this.ambientMasterGain);
      src.start();

      cleanupNodes.push(src, bp, lp);
      this.activeAmbientNodes = { source: src, cleanupNodes };
      return;
    }

    if (this.state.ambientId === 'forest') {
      const src = ctx.createBufferSource();
      src.buffer = this.createNoiseBuffer(ctx, 'pink');
      src.loop = true;

      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 580;
      lp.Q.value = 1.4;

      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.11;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 260;

      lfo.connect(lfoGain);
      lfoGain.connect(lp.frequency);
      src.connect(lp);
      lp.connect(this.ambientMasterGain);

      src.start();
      lfo.start();

      cleanupNodes.push(src, lp, lfo, lfoGain);
      this.activeAmbientNodes = { source: src, lfo, cleanupNodes };
      return;
    }

    // 'fireplace' — Warm brown-noise hearth + soft occasional gentle wood crackle
    const src = ctx.createBufferSource();
    src.buffer = this.createNoiseBuffer(ctx, 'brown');
    src.loop = true;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 260;

    src.connect(lp);
    lp.connect(this.ambientMasterGain);
    src.start();
    cleanupNodes.push(src, lp);

    const crackleTimer = setInterval(() => {
      if (!this.ctx || !this.ambientMasterGain || !this.state.isPlaying || this.state.isMuted) return;
      if (Math.random() > 0.42) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(600 + Math.random() * 1200, now);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.035 + Math.random() * 0.03, now + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);
      osc.connect(g);
      g.connect(this.ambientMasterGain);
      osc.start(now);
      osc.stop(now + 0.06);
    }, 320);

    this.activeAmbientNodes = { source: src, crackleTimer, cleanupNodes };
  }

  // ==========================================================================
  // Public Playback & Preference Controls
  // ==========================================================================

  public start(): void {
    if (this.fadeOutTimer) {
      clearTimeout(this.fadeOutTimer);
      this.fadeOutTimer = null;
    }
    this.state.isPlaying = true;
    this.ensureAudioGraph();
    this.startMusicGenerator();
    this.startAmbientGenerator();
    this.applyGains(0.8); // Gentle 0.8s sunrise fade-in
    this.emit();
  }

  public stop(immediate = false): void {
    if (this.fadeOutTimer) {
      clearTimeout(this.fadeOutTimer);
      this.fadeOutTimer = null;
    }
    const wasPlaying = this.state.isPlaying;
    this.state.isPlaying = false;

    if (!wasPlaying && !immediate) {
      this.emit();
      return;
    }

    if (immediate || !this.ctx) {
      this.stopSynthMusicNodes();
      this.stopLocalAudio();
      this.stopAmbientNodes();
      this.emit();
      return;
    }

    // Gentle 0.4s fade-out before tearing down oscillators
    this.applyGains(0.4);
    this.fadeOutTimer = setTimeout(() => {
      if (!this.state.isPlaying) {
        this.stopSynthMusicNodes();
        this.stopLocalAudio();
        this.stopAmbientNodes();
      }
      this.fadeOutTimer = null;
    }, 430);

    this.emit();
  }

  public togglePlay(): void {
    if (this.state.isPlaying) {
      this.stop();
    } else {
      this.start();
    }
  }

  public setTrack(trackId: FocusMusicTrackId): void {
    if (!VALID_TRACK_IDS.includes(trackId)) return;
    if (trackId === 'local-file' && !this.state.hasLocalFile) return;
    this.state.trackId = trackId;
    persistPrefs(this.state);
    if (this.state.isPlaying) {
      this.startMusicGenerator();
      this.applyGains(0.25);
    }
    this.emit();
  }

  public setAmbient(ambientId: FocusAmbientId): void {
    if (!VALID_AMBIENT_IDS.includes(ambientId)) return;
    this.state.ambientId = ambientId;
    persistPrefs(this.state);
    if (this.state.isPlaying) {
      this.startAmbientGenerator();
      this.applyGains(0.28);
    }
    this.emit();
  }

  public setMusicVolume(volume: number): void {
    this.state.musicVolume = clampVolume(volume);
    if (this.state.musicVolume > 0 && this.state.isMuted) {
      this.state.isMuted = false;
    }
    persistPrefs(this.state);
    this.applyGains(0.12);
    this.emit();
  }

  public setAmbientVolume(volume: number): void {
    this.state.ambientVolume = clampVolume(volume);
    if (this.state.ambientVolume > 0 && this.state.isMuted) {
      this.state.isMuted = false;
    }
    persistPrefs(this.state);
    this.applyGains(0.12);
    this.emit();
  }

  public toggleMute(): void {
    this.state.isMuted = !this.state.isMuted;
    persistPrefs(this.state);
    this.applyGains(0.18);
    this.emit();
  }

  public setAutoSyncWithTimer(enabled: boolean): void {
    this.state.autoSyncWithTimer = Boolean(enabled);
    persistPrefs(this.state);
    this.emit();
  }

  public setChimeEnabled(enabled: boolean): void {
    this.state.chimeEnabled = Boolean(enabled);
    persistPrefs(this.state);
    this.emit();
  }

  public loadLocalFile(file: File): { success: boolean; fileName: string | null } {
    if (!file) return { success: false, fileName: null };
    this.revokeLocalObjectUrl();

    let objectUrl: string | null = null;
    try {
      if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
        objectUrl = URL.createObjectURL(file);
      } else {
        objectUrl = `blob:local-mock/${encodeURIComponent(file.name)}`;
      }
    } catch {
      objectUrl = null;
    }

    if (!objectUrl) {
      return { success: false, fileName: null };
    }

    this.localObjectUrl = objectUrl;
    if (typeof Audio !== 'undefined') {
      try {
        const audio = new Audio(objectUrl);
        audio.loop = true;
        audio.volume = this.state.isMuted ? 0 : this.state.musicVolume;
        this.localAudioEl = audio;
      } catch {
        this.localAudioEl = null;
      }
    }

    this.state.localFileName = file.name;
    this.state.hasLocalFile = true;
    this.state.trackId = 'local-file';

    if (this.state.isPlaying) {
      this.startMusicGenerator();
      this.applyGains(0.25);
    }

    this.emit();
    return { success: true, fileName: file.name };
  }

  public clearLocalFile(): void {
    this.stopLocalAudio();
    this.revokeLocalObjectUrl();
    this.localAudioEl = null;
    this.state.localFileName = null;
    this.state.hasLocalFile = false;
    if (this.state.trackId === 'local-file') {
      this.state.trackId = 'sky-piano';
      if (this.state.isPlaying) {
        this.startMusicGenerator();
      }
    }
    persistPrefs(this.state);
    this.emit();
  }

  private revokeLocalObjectUrl(): void {
    if (this.localObjectUrl && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
      try {
        URL.revokeObjectURL(this.localObjectUrl);
      } catch {
        // Ignore
      }
    }
    this.localObjectUrl = null;
  }

  /** Gentle ascending wind-chime harmonic chord on Pomodoro completion */
  public playCompletionChime(forcePreview = false): boolean {
    if (!forcePreview && !this.state.chimeEnabled) return false;
    const ctx = this.ensureAudioGraph();
    if (!ctx) return true; // Gracefully acknowledged in headless/test runtime

    const chimeNotes = [72, 76, 79, 84]; // C5 - E5 - G5 - C6 soothing major triad + octave
    const now = ctx.currentTime;
    chimeNotes.forEach((midi, idx) => {
      const start = now + idx * 0.12;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(midiToFreq(midi), start);

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, start);
      g.gain.linearRampToValueAtTime(0.14, start + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 1.35);

      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 1.4);
    });
    return true;
  }

  /** Deterministic cleanup helper for unit tests */
  public __resetForTests(): void {
    this.stop(true);
    this.revokeLocalObjectUrl();
    this.localAudioEl = null;
    if (typeof window !== 'undefined') {
      try {
        window.localStorage?.removeItem(FOCUS_AUDIO_STORAGE_KEY);
      } catch {}
    }
    this.state = {
      ...DEFAULT_AUDIO_PREFS,
      isPlaying: false,
      localFileName: null,
      hasLocalFile: false
    };
    this.emit();
  }
}

export const focusAudioEngine = new FocusAudioEngine();
