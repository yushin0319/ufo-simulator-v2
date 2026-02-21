import { Application, Graphics, FillGradient } from 'pixi.js';
import type { GameContext, GameSystem } from './types.ts';
import { MAX_SPEED, BOOST_MULT } from './constants.ts';

interface StarLayer {
  n: number;
  spd: number;
  sz: number;
  alpha: number;
}

interface Star {
  x: number;
  y: number;
  twk: number;   // twinkle phase
  tsp: number;   // twinkle speed (0.6 - 2.6)
}

const LAYERS: StarLayer[] = [
  { n: 260, spd: 0.055, sz: 0.85, alpha: 0.35 },
  { n: 180, spd: 0.13,  sz: 1.40, alpha: 0.62 },
  { n: 90,  spd: 0.26,  sz: 2.30, alpha: 0.92 },
];

export class Environment implements GameSystem {
  private nebulaGfx!: Graphics;
  private starsGfx!: Graphics;
  private vignetteGfx!: Graphics;
  private speedGfx!: Graphics;

  private stars: Star[][] = LAYERS.map(l =>
    Array.from({ length: l.n }, () => ({ x: 0, y: 0, twk: 0, tsp: 1 }))
  );

  private width = 800;
  private height = 600;

  init(app: Application): void {
    this.width = app.screen.width;
    this.height = app.screen.height;

    this.nebulaGfx = new Graphics();
    this.starsGfx = new Graphics();
    this.vignetteGfx = new Graphics();
    this.speedGfx = new Graphics();

    app.stage.addChild(this.nebulaGfx);
    app.stage.addChild(this.starsGfx);
    app.stage.addChild(this.vignetteGfx);
    app.stage.addChild(this.speedGfx);

    this.placeStars();
    this.drawVignette();
  }

  resize(w: number, h: number): void {
    this.width = w;
    this.height = h;
    this.placeStars();
    this.drawVignette();
  }

  private placeStars(): void {
    const W = this.width;
    const H = this.height;
    for (let li = 0; li < LAYERS.length; li++) {
      for (let i = 0; i < LAYERS[li].n; i++) {
        this.stars[li][i] = {
          x: Math.random() * W,
          y: Math.random() * H,
          twk: Math.random() * Math.PI * 2,
          tsp: 0.6 + Math.random() * 2.0,
        };
      }
    }
  }

  private drawVignette(): void {
    const W = this.width;
    const H = this.height;
    const g = this.vignetteGfx;
    g.clear();

    const col = 0x00000c;
    // Layered dark strips from each edge toward center
    // Outer strips have wider depth and higher alpha
    const BANDS = 10;
    for (let i = 0; i < BANDS; i++) {
      const t = (BANDS - i) / BANDS; // 1=outermost, 1/BANDS=innermost
      const a = 0.11 * t;
      const bx = W * 0.30 * t;
      const by = H * 0.30 * t;
      g.rect(0, 0, bx, H).fill({ color: col, alpha: a });             // Left
      g.rect(W - bx, 0, bx, H).fill({ color: col, alpha: a });        // Right
      g.rect(bx, 0, W - 2 * bx, by).fill({ color: col, alpha: a });   // Top
      g.rect(bx, H - by, W - 2 * bx, by).fill({ color: col, alpha: a }); // Bottom
    }
  }

  update(ctx: GameContext): void {
    const { ufo, boost, dt } = ctx;
    const W = this.width;
    const H = this.height;

    // Update parallax + twinkle
    for (let li = 0; li < LAYERS.length; li++) {
      const layer = LAYERS[li];
      for (let i = 0; i < layer.n; i++) {
        const star = this.stars[li][i];
        star.twk += star.tsp * dt;
        star.x -= ufo.vx * dt * layer.spd;
        star.x = ((star.x % W) + W) % W;
      }
    }

    this.drawNebula(ufo.glowPhase, W, H);
    this.drawStars(W, H);

    const speed = Math.hypot(ufo.vx, ufo.vy);
    if (speed > 140) {
      this.drawSpeedLines(ufo, boost.isBoosting, speed, W, H);
    } else {
      this.speedGfx.clear();
    }
  }

  private drawNebula(glowPhase: number, W: number, H: number): void {
    const g = this.nebulaGfx;
    g.clear();
    const nb = glowPhase * 0.06;

    // Blob 1 - purple
    const b1x = W * (0.27 + 0.035 * Math.sin(nb * 0.7));
    const b1y = H * (0.38 + 0.035 * Math.cos(nb * 0.5));
    const b1r = W * 0.52;
    for (let i = 0; i < 5; i++) {
      const t = (i + 1) / 5;
      g.ellipse(b1x, b1y, b1r * t, b1r * t * 0.65)
       .fill({ color: 0x6600bb, alpha: 0.035 * (1 - t * 0.5) });
    }

    // Blob 2 - blue
    const b2x = W * (0.73 + 0.03 * Math.cos(nb * 0.55));
    const b2y = H * (0.58 + 0.03 * Math.sin(nb * 0.80));
    const b2r = W * 0.44;
    for (let i = 0; i < 5; i++) {
      const t = (i + 1) / 5;
      g.ellipse(b2x, b2y, b2r * t, b2r * t * 0.65)
       .fill({ color: 0x0033cc, alpha: 0.035 * (1 - t * 0.5) });
    }
  }

  private drawStars(W: number, H: number): void {
    const g = this.starsGfx;
    g.clear();
    for (let li = 0; li < LAYERS.length; li++) {
      const layer = LAYERS[li];
      for (let i = 0; i < layer.n; i++) {
        const star = this.stars[li][i];
        const tw = 0.55 + 0.45 * Math.sin(star.twk);
        const alpha = layer.alpha * tw;
        const size = layer.sz * tw;
        g.circle(star.x, star.y, size).fill({ color: 0xffffff, alpha });
      }
    }
  }

  private drawSpeedLines(
    ufo: { x: number; y: number; vx: number; vy: number },
    isBoosting: boolean,
    speed: number,
    W: number,
    H: number,
  ): void {
    const g = this.speedGfx;
    g.clear();

    const t = Math.min(1, (speed - 140) / (MAX_SPEED * BOOST_MULT - 140));
    const count = Math.floor(t * 28);
    const len = 65 + t * 130;
    const spread = 170 + t * 220;
    const alpha = t * 0.30;
    const color = isBoosting ? 0xffaa33 : 0x66ccff;

    // Direction: opposite of UFO movement
    const dx = -ufo.vx / speed;
    const dy = -ufo.vy / speed;
    // Perpendicular (for spread offset)
    const px = -dy;
    const py = dx;

    for (let i = 0; i < count; i++) {
      const offset = (Math.random() - 0.5) * 2 * spread;
      const sx = ufo.x + px * offset;
      const sy = ufo.y + py * offset;
      const lineWidth = 0.5 + Math.random();
      g.moveTo(sx, sy)
       .lineTo(sx + dx * len, sy + dy * len)
       .stroke({ width: lineWidth, color, alpha });
    }
  }
}
