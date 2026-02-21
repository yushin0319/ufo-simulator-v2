import { Application, Graphics } from 'pixi.js';
import type { GameContext, GameSystem } from './types.ts';
import { TRAIL_LEN } from './constants.ts';

interface TrailPoint {
  x: number;
  y: number;
  boost: boolean;
  brk: boolean;
}

export class Trail implements GameSystem {
  private gfx: Graphics = new Graphics();
  private points: TrailPoint[] = [];

  init(app: Application): void {
    app.stage.addChildAt(this.gfx, 0);
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
    this.gfx.clear();
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

      const alpha = t * 0.48;
      const lineWidth = t * 4.5;
      const color = hslToHex(hue, sat, light);

      this.gfx
        .moveTo(prev.x, prev.y)
        .lineTo(pt.x, pt.y)
        .stroke({ width: lineWidth, color, alpha, cap: 'round' });
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
