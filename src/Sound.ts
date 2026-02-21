import type { Application } from 'pixi.js';
import type { GameContext, GameSystem } from './types';
import { MAX_SPEED } from './constants';

export class SoundManager implements GameSystem {
  private audioCtx: AudioContext | null = null;

  // Engine hum
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;

  // Boost jet
  private jetOsc: OscillatorNode | null = null;
  private jetGain: GainNode | null = null;
  private noiseSource: AudioBufferSourceNode | null = null;
  private noiseGain: GainNode | null = null;

  // Ambient BGM
  private ambientOscs: OscillatorNode[] = [];
  private ambientGain: GainNode | null = null;

  private started = false;
  private prevBoosting = false;

  private readonly BASE_FREQ = 95; // 80-120Hz range

  init(_app: Application): void {
    this.audioCtx = new AudioContext();
    const ctx = this.audioCtx;

    // --- Engine hum ---
    this.engineFilter = ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 600;

    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;

    this.engineOsc = ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = this.BASE_FREQ;

    this.engineOsc.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(ctx.destination);

    // --- Boost jet with distortion ---
    const waveShaper = ctx.createWaveShaper();
    waveShaper.curve = this.makeDistortionCurve(200);
    waveShaper.oversample = '2x';

    this.jetGain = ctx.createGain();
    this.jetGain.gain.value = 0;

    this.jetOsc = ctx.createOscillator();
    this.jetOsc.type = 'sawtooth';
    this.jetOsc.frequency.value = 50; // 40-60Hz 低い轟音

    this.jetOsc.connect(waveShaper);
    waveShaper.connect(this.jetGain);

    // White noise (AudioBufferSourceNode ループ)
    this.noiseGain = ctx.createGain();
    this.noiseGain.gain.value = 0.4;
    const noiseBuffer = this.createNoiseBuffer(ctx, 2.0);
    this.noiseSource = ctx.createBufferSource();
    this.noiseSource.buffer = noiseBuffer;
    this.noiseSource.loop = true;
    this.noiseSource.connect(this.noiseGain);
    this.noiseGain.connect(this.jetGain);

    this.jetGain.connect(ctx.destination);

    // --- Ambient BGM (A1 パワーコード: 55Hz, 82.5Hz, 110Hz) ---
    this.ambientGain = ctx.createGain();
    this.ambientGain.gain.value = 0.03;
    this.ambientGain.connect(ctx.destination);

    for (const freq of [55, 82.5, 110]) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.connect(this.ambientGain);
      this.ambientOscs.push(osc);
    }
  }

  update(ctx: GameContext): void {
    if (!this.audioCtx) return;

    // AudioContext resume on first user interaction
    if (ctx.anyKeyPressed && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().then(() => this.startOscillators());
    }

    if (!this.started) return;

    const speed = Math.hypot(ctx.ufo.vx, ctx.ufo.vy);

    // Engine hum - ピッチとゲインを速度に連動
    if (this.engineOsc && this.engineGain && this.engineFilter) {
      this.engineOsc.frequency.value = this.BASE_FREQ + (speed / MAX_SPEED) * 80;
      this.engineGain.gain.value = Math.min(0.15, speed / (MAX_SPEED * 2));
      this.engineFilter.frequency.value = 400 + (speed / MAX_SPEED) * 400;
    }

    // Boost jet - 状態変化でフェードイン/アウト
    const nowBoosting = ctx.boost.isBoosting;
    if (nowBoosting !== this.prevBoosting && this.jetGain && this.audioCtx) {
      const t = this.audioCtx.currentTime;
      this.jetGain.gain.cancelScheduledValues(t);
      this.jetGain.gain.setValueAtTime(this.jetGain.gain.value, t);
      if (nowBoosting) {
        this.jetGain.gain.linearRampToValueAtTime(0.10, t + 0.15);
      } else {
        this.jetGain.gain.linearRampToValueAtTime(0, t + 0.3);
      }
      this.prevBoosting = nowBoosting;
    }
  }

  resize(_w: number, _h: number): void {}

  private startOscillators(): void {
    if (this.started) return;
    this.started = true;
    this.engineOsc?.start();
    this.jetOsc?.start();
    this.noiseSource?.start();
    for (const osc of this.ambientOscs) osc.start();
  }

  private makeDistortionCurve(amount: number): Float32Array<ArrayBuffer> {
    const n = 256;
    const curve = new Float32Array(new ArrayBuffer(n * 4));
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      curve[i] = ((Math.PI + amount) * x) / (Math.PI + amount * Math.abs(x));
    }
    return curve;
  }

  private createNoiseBuffer(ctx: AudioContext, durationSec: number): AudioBuffer {
    const sampleRate = ctx.sampleRate;
    const frameCount = Math.floor(sampleRate * durationSec);
    const buffer = ctx.createBuffer(1, frameCount, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frameCount; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }
}
