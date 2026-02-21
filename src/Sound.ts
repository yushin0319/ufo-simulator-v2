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

  // LFO for ambient tremolo
  private lfo: OscillatorNode | null = null;
  private lfoGain: GainNode | null = null;

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

    // --- LFO for ambient tremolo (ブースト中にゲイン変調) ---
    this.lfo = ctx.createOscillator();
    this.lfo.type = 'sine';
    this.lfo.frequency.value = 0.8;
    this.lfoGain = ctx.createGain();
    this.lfoGain.gain.value = 0;
    this.lfo.connect(this.lfoGain);
    this.lfoGain.connect(this.ambientGain.gain);
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

    // Boost jet - 状態変化でフェードイン/アウト + ピッチスイープ
    const nowBoosting = ctx.boost.isBoosting;
    if (nowBoosting !== this.prevBoosting && this.jetGain && this.jetOsc && this.audioCtx) {
      const t = this.audioCtx.currentTime;
      this.jetGain.gain.cancelScheduledValues(t);
      this.jetGain.gain.setValueAtTime(this.jetGain.gain.value, t);
      if (nowBoosting) {
        this.jetGain.gain.linearRampToValueAtTime(0.10, t + 0.15);
        // ブースト再開: 周波数を50Hzにリセット
        this.jetOsc.frequency.cancelScheduledValues(t);
        this.jetOsc.frequency.setValueAtTime(50, t);
      } else {
        this.jetGain.gain.linearRampToValueAtTime(0, t + 0.3);
        // ブースト終了: 50Hz→22Hz へピッチ下降スイープ
        this.jetOsc.frequency.setValueAtTime(50, t);
        this.jetOsc.frequency.exponentialRampToValueAtTime(22, t + 0.5);
      }
      this.prevBoosting = nowBoosting;
    }

    // Ambient BGM - 高速時デチューン + ブースト時LFOトレモロ
    if (this.ambientOscs.length > 0 && this.lfoGain && this.audioCtx) {
      const t = this.audioCtx.currentTime;
      const speedRatio = Math.min(1, speed / MAX_SPEED);
      const detuneAmt = speedRatio > 0.7 ? (speedRatio - 0.7) / 0.3 * 12 : 0;
      this.ambientOscs.forEach((osc, i) => {
        const sign = i % 2 === 0 ? 1 : -1;
        osc.detune.setTargetAtTime(sign * detuneAmt, t, 0.5);
      });
      const targetLfo = ctx.boost.isBoosting ? 0.015 : 0;
      this.lfoGain.gain.setTargetAtTime(targetLfo, t, 0.2);
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
    this.lfo?.start();
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
