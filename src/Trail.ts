import { type Application, BlurFilter, Container, Graphics } from 'pixi.js';
import { TRAIL_LEN } from './constants.ts';
import type { GameContext, GameSystem } from './types.ts';

interface TrailPoint {
  x: number;
  y: number;
  boost: boolean;
  brk: boolean;
}

export class Trail implements GameSystem {
  private glowContainer!: Container;
  private glowGfx!: Graphics;
  private coreGfx!: Graphics;
  private points: TrailPoint[] = [];

  init(app: Application): void {
    this.glowContainer = new Container();
    this.glowContainer.blendMode = 'add';
    this.glowContainer.filters = [new BlurFilter({ strength: 8, quality: 3 })];
    this.glowGfx = new Graphics();
    this.glowContainer.addChild(this.glowGfx);

    this.coreGfx = new Graphics();

    app.stage.addChildAt(this.glowContainer, 0);
    app.stage.addChildAt(this.coreGfx, 1);
  }

  update(ctx: GameContext): void {
    const { ufo, width, height } = ctx;
    const prev = this.points[this.points.length - 1];
    const brk =
      prev !== undefined &&
      (Math.abs(ufo.x - prev.x) > width * 0.4 ||
        Math.abs(ufo.y - prev.y) > height * 0.4);

    this.points.push({ x: ufo.x, y: ufo.y, boost: ctx.boost.isBoosting, brk });

    if (this.points.length > TRAIL_LEN) {
      this.points.shift();
    }

    this.draw();
  }

  private draw(): void {
    this.glowGfx.clear();
    this.coreGfx.clear();
    const len = this.points.length;
    if (len < 2) return;

    for (let i = 1; i < len; i++) {
      const pt = this.points[i];
      if (pt.brk) continue;

      const prev = this.points[i - 1];
      const t = i / len;

      let hue: number;
      let sat: number;
      let light: number;
      if (pt.boost) {
        hue = 25 + t * 15;
        sat = 100;
        light = 45 + t * 22;
      } else {
        hue = 200 - t * 15;
        sat = 100;
        light = 55 + t * 15;
      }

      const color = hslToHex(hue, sat, light);

      // Glow layer: fat, colored, blurred
      this.glowGfx
        .moveTo(prev.x, prev.y)
        .lineTo(pt.x, pt.y)
        .stroke({ width: t * 9.0, color, alpha: t * 0.3, cap: 'round' });

      // Core layer: thin, white, sharp
      this.coreGfx
        .moveTo(prev.x, prev.y)
        .lineTo(pt.x, pt.y)
        .stroke({
          width: t * 2.5,
          color: 0xffffff,
          alpha: t * 0.6,
          cap: 'round',
        });
    }
  }
}

function hslToHex(h: number, s: number, l: number): number {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color);
  };
  return (f(0) << 16) | (f(8) << 8) | f(4);
}
