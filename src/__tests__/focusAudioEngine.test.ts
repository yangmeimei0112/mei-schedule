import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FOCUS_AMBIENT_OPTIONS,
  FOCUS_AUDIO_STORAGE_KEY,
  FOCUS_TRACK_OPTIONS,
  focusAudioEngine
} from '../services/focusAudioEngine';

describe('FocusAudioEngine: Royalty-Free Light Music, Ambient Layering, Local Audio & Persistence', () => {
  beforeEach(() => {
    focusAudioEngine.__resetForTests();
  });

  afterEach(() => {
    focusAudioEngine.__resetForTests();
    vi.restoreAllMocks();
  });

  it('exposes 4 original light music tracks and 4 natural ambient soundscape options', () => {
    expect(FOCUS_TRACK_OPTIONS.map((t) => t.id)).toEqual([
      'sky-piano',
      'warm-lofi',
      'starlight-box',
      'alpha-pad'
    ]);
    expect(FOCUS_AMBIENT_OPTIONS.map((a) => a.id)).toEqual([
      'none',
      'rain',
      'forest',
      'fireplace'
    ]);

    const initial = focusAudioEngine.getSnapshot();
    expect(initial.trackId).toBe('sky-piano');
    expect(initial.ambientId).toBe('none');
    expect(initial.isPlaying).toBe(false);
    expect(initial.autoSyncWithTimer).toBe(true);
    expect(initial.chimeEnabled).toBe(true);
  });

  it('switches tracks, ambient layers, dual volumes, mute, and persists preferences to localStorage', () => {
    const snapshots: string[] = [];
    const unsub = focusAudioEngine.subscribe((snap) => {
      snapshots.push(`${snap.trackId}:${snap.ambientId}:${snap.isPlaying}:${snap.isMuted}`);
    });

    focusAudioEngine.setTrack('warm-lofi');
    focusAudioEngine.setAmbient('rain');
    focusAudioEngine.setMusicVolume(0.72);
    focusAudioEngine.setAmbientVolume(0.48);
    focusAudioEngine.start();

    let snap = focusAudioEngine.getSnapshot();
    expect(snap.trackId).toBe('warm-lofi');
    expect(snap.ambientId).toBe('rain');
    expect(snap.musicVolume).toBe(0.72);
    expect(snap.ambientVolume).toBe(0.48);
    expect(snap.isPlaying).toBe(true);

    // Toggle mute on, then raising volume automatically unmutes
    focusAudioEngine.toggleMute();
    expect(focusAudioEngine.getSnapshot().isMuted).toBe(true);
    focusAudioEngine.setMusicVolume(0.6);
    expect(focusAudioEngine.getSnapshot().isMuted).toBe(false);

    // Check localStorage persistence
    const saved = JSON.parse(window.localStorage.getItem(FOCUS_AUDIO_STORAGE_KEY) || '{}');
    expect(saved.trackId).toBe('warm-lofi');
    expect(saved.ambientId).toBe('rain');
    expect(saved.musicVolume).toBe(0.6);
    expect(saved.ambientVolume).toBe(0.48);

    // Toggles for autoSync & chime
    focusAudioEngine.setAutoSyncWithTimer(false);
    focusAudioEngine.setChimeEnabled(false);
    expect(focusAudioEngine.playCompletionChime(false)).toBe(false);
    expect(focusAudioEngine.playCompletionChime(true)).toBe(true);

    focusAudioEngine.stop(true);
    snap = focusAudioEngine.getSnapshot();
    expect(snap.isPlaying).toBe(false);
    expect(snapshots.length).toBeGreaterThanOrEqual(6);

    unsub();
  });

  it('loads and clears a local user audio file cleanly without leaking object URLs', () => {
    const file = new File(['mock-audio-bytes'], 'study-lofi.mp3', { type: 'audio/mpeg' });
    const res = focusAudioEngine.loadLocalFile(file);

    expect(res.success).toBe(true);
    expect(res.fileName).toBe('study-lofi.mp3');

    let snap = focusAudioEngine.getSnapshot();
    expect(snap.hasLocalFile).toBe(true);
    expect(snap.localFileName).toBe('study-lofi.mp3');
    expect(snap.trackId).toBe('local-file');

    focusAudioEngine.clearLocalFile();
    snap = focusAudioEngine.getSnapshot();
    expect(snap.hasLocalFile).toBe(false);
    expect(snap.localFileName).toBeNull();
    expect(snap.trackId).toBe('sky-piano');
  });
});
