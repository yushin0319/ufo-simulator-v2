import { Application, Graphics } from 'pixi.js';
import type { GameContext, GameSystem } from './types.ts';
import { POOL_SIZE, UFO_RX, UFO_RY } from './constants.ts';

interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  r: number;
  g: number;
  b: number;
}

export class Particles implements GameSystem {
  private gfx!: Graphics;
  private pool: Particle[];

  constructor() {
    this.pool = Array.from({ length: POOL_SIZE }, () => ({
      active: false, x: 0, y: 0, vx: 0, vy: 0,
      life: 0, maxLife: 1, size: 0, r: 0, g: 0, b: 0,
    }));
  }

  init(app: Application): void {
    this.gfx = new Graphics();
    app.stage.addChild(this.gfx);
  }

  emit(
    x: number, y: number,
    vx: number, vy: number,
    life: number, size: number,
    r: number, g: number, b: number,
  ): void {
    for (let i = 0; i < POOL_SIZE; i++) {
      const p = this.pool[i];
      if (!p.active) {
        p.active = true;
        p.x = x;    p.y = y;
        p.vx = vx;  p.vy = vy;
        p.life = life; p.maxLife = life;
        p.size = size;
        p.r = r; p.g = g; p.b = b;
        return;
      }
    }
    // Pool exhausted — silently drop
  }

  update(ctx: GameContext): void {
    const { ufo, boost, input, dt } = ctx;
    const speed = Math.hypot(ufo.vx, ufo.vy);

    this.emitEngine(ufo, boost, input, speed, dt);
    this.emitRimSparkle(ufo);
    if (boost.isBoosting) {
      this.emitBoostStarburst(ufo);
    }

    const drag = Math.pow(0.89, dt * 60);
    const gfx = this.gfx;
    gfx.clear();

    for (let i = 0; i < POOL_SIZE; i++) {
      const p = this.pool[i];
      if (!p.active) continue;

      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= drag;
      p.vy *= drag;

      const ratio = p.life / p.maxLife;
      const alpha = ratio * 0.92;
      const drawSize = p.size * (0.25 + 0.75 * ratio);
      const color = ((p.r & 0xff) << 16) | ((p.g & 0xff) << 8) | (p.b & 0xff);

      gfx.circle(p.x, p.y, drawSize).fill({ color, alpha });
    }
  }

  private emitEngine(
    ufo: { x: number; y: number; vx: number; vy: number },
    boost: { isBoosting: boolean },
    input: { up: boolean; down: boolean; left: boolean; right: boolean },
    speed: number,
    _dt: number,
  ): void {
    const moving = input.up || input.down || input.left || input.right || speed > 25;
    if (!moving) return;

    const mag = Math.max(speed, 1);
    const dirX = -ufo.vx / mag;
    const dirY = -ufo.vy / mag;

    if (boost.isBoosting) {
      // 7 particles/frame, orange exhaust
      for (let i = 0; i < 7; i++) {
        const life = 0.45 + Math.random() * 0.40;
        const size = 3 + Math.random() * 5;
        const spd = 130 + Math.random() * 130;
        const vx = dirX * spd + (Math.random() - 0.5) * 1.3 * spd;
        const vy = dirY * spd + (Math.random() - 0.5) * 1.3 * spd;
        this.emit(
          ufo.x + (Math.random() - 0.5) * 18, ufo.y + UFO_RY,
          vx, vy, life, size,
          255, Math.floor(70 + Math.random() * 130), Math.floor(Math.random() * 30),
        );
      }
    } else {
      // 2 particles/frame, blue exhaust
      for (let i = 0; i < 2; i++) {
        const life = 0.22 + Math.random() * 0.20;
        const size = 1.5 + Math.random() * 2.5;
        const spd = 130 + Math.random() * 130;
        const vx = dirX * spd + (Math.random() - 0.5) * 0.75 * spd;
        const vy = dirY * spd + (Math.random() - 0.5) * 0.75 * spd;
        this.emit(
          ufo.x + (Math.random() - 0.5) * 18, ufo.y + UFO_RY,
          vx, vy, life, size,
          Math.floor(70 + Math.random() * 80), Math.floor(160 + Math.random() * 70), 255,
        );
      }
    }
  }

  // 45% chance per frame (always active)
  private emitRimSparkle(ufo: { x: number; y: number }): void {
    if (Math.random() > 0.45) return;
    const angle = Math.random() * Math.PI * 2;
    const x = ufo.x + Math.cos(angle) * UFO_RX;
    const y = ufo.y + Math.sin(angle) * UFO_RY;
    const vx = (Math.random() - 0.5) * 14;
    const vy = -(18 + Math.random() * 22);
    const life = 0.4 + Math.random() * 0.5;
    const size = 0.9 + Math.random() * 1.1;
    this.emit(x, y, vx, vy, life, size, 160, 235, 255);
  }

  // 45% chance per frame, 6 particles when triggered
  private emitBoostStarburst(ufo: { x: number; y: number }): void {
    if (Math.random() > 0.45) return;
    for (let i = 0; i < 6; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = 90 + Math.random() * 110;
      const vx = Math.cos(angle) * spd;
      const vy = Math.sin(angle) * spd;
      const life = 0.3 + Math.random() * 0.4;
      const size = 2 + Math.random() * 3;
      this.emit(ufo.x, ufo.y, vx, vy, life, size, 255, Math.floor(190 + Math.random() * 65), 40);
    }
  }
}
