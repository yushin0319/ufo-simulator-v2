import { type Application, Graphics } from 'pixi.js';
import { BOOST_MULT, MAX_SPEED } from './constants.ts';
import type { GameContext, GameSystem } from './types.ts';

interface StarLayer {
  n: number;
  spd: number;
  sz: number;
  alpha: number;
}

interface Star {
  x: number;
  y: number;
  twk: number; // twinkle phase
  tsp: number; // twinkle speed (0.6 - 2.6)
  color: number; // star color temperature
}

interface ShootingStar {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  len: number;
}

const STAR_COLORS = [0xffccaa, 0xffddcc, 0xffffff, 0xeef0ff, 0xaabbff];
const STAR_WEIGHTS = [0.08, 0.12, 0.5, 0.18, 0.12];

const LAYERS: StarLayer[] = [
  { n: 260, spd: 0.055, sz: 0.85, alpha: 0.35 },
  { n: 180, spd: 0.13, sz: 1.4, alpha: 0.62 },
  { n: 90, spd: 0.26, sz: 2.3, alpha: 0.92 },
];

export class Environment implements GameSystem {
  private nebulaGfx!: Graphics;
  private starsGfx!: Graphics;
  private vignetteGfx!: Graphics;
  private speedGfx!: Graphics;

  private stars: Star[][] = LAYERS.map((l) =>
    Array.from({ length: l.n }, () => ({
      x: 0,
      y: 0,
      twk: 0,
      tsp: 1,
      color: 0xffffff,
    })),
  );
  private shootingStars: ShootingStar[] = [];

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
          color: weightedChoice(STAR_COLORS, STAR_WEIGHTS),
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
      const bx = W * 0.3 * t;
      const by = H * 0.3 * t;
      g.rect(0, 0, bx, H).fill({ color: col, alpha: a }); // Left
      g.rect(W - bx, 0, bx, H).fill({ color: col, alpha: a }); // Right
      g.rect(bx, 0, W - 2 * bx, by).fill({ color: col, alpha: a }); // Top
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
        star.y -= ufo.vy * dt * layer.spd;
        star.y = ((star.y % H) + H) % H;
      }
    }

    this.drawNebula(ufo.glowPhase, W, H);
    this.drawStars(W, H);
    this.drawShootingStars(dt, W, H);

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
      g.ellipse(b1x, b1y, b1r * t, b1r * t * 0.65).fill({
        color: 0x6600bb,
        alpha: 0.035 * (1 - t * 0.5),
      });
    }

    // Blob 2 - blue
    const b2x = W * (0.73 + 0.03 * Math.cos(nb * 0.55));
    const b2y = H * (0.58 + 0.03 * Math.sin(nb * 0.8));
    const b2r = W * 0.44;
    for (let i = 0; i < 5; i++) {
      const t = (i + 1) / 5;
      g.ellipse(b2x, b2y, b2r * t, b2r * t * 0.65).fill({
        color: 0x0033cc,
        alpha: 0.035 * (1 - t * 0.5),
      });
    }
  }

  private drawStars(_W: number, _H: number): void {
    const g = this.starsGfx;
    g.clear();
    for (let li = 0; li < LAYERS.length; li++) {
      const layer = LAYERS[li];
      for (let i = 0; i < layer.n; i++) {
        const star = this.stars[li][i];
        const tw = 0.55 + 0.45 * Math.sin(star.twk);
        const alpha = layer.alpha * tw;
        const size = layer.sz * tw;
        g.circle(star.x, star.y, size).fill({ color: star.color, alpha });
      }
    }
  }

  private drawShootingStars(dt: number, W: number, H: number): void {
    if (Math.random() < 0.003 * dt * 60) {
      this.shootingStars.push({
        x: Math.random() * W,
        y: Math.random() * H * 0.4,
        vx: 200 + Math.random() * 300,
        vy: 50 + Math.random() * 100,
        life: 1.2,
        maxLife: 1.2,
        len: 60 + Math.random() * 80,
      });
    }

    const g = this.starsGfx;
    for (const s of this.shootingStars) {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;
      if (s.life <= 0) continue;
      const ratio = s.life / s.maxLife;
      const spd = Math.hypot(s.vx, s.vy);
      const ex = s.x - (s.vx / spd) * s.len * ratio;
      const ey = s.y - (s.vy / spd) * s.len * ratio;
      g.moveTo(s.x, s.y)
        .lineTo(ex, ey)
        .stroke({ width: 1.5, color: 0xffffff, alpha: ratio * 0.9 });
    }
    this.shootingStars = this.shootingStars.filter((s) => s.life > 0);
  }

  private drawSpeedLines(
    ufo: { x: number; y: number; vx: number; vy: number },
    isBoosting: boolean,
    speed: number,
    _W: number,
    _H: number,
  ): void {
    const g = this.speedGfx;
    g.clear();

    const t = Math.min(1, (speed - 140) / (MAX_SPEED * BOOST_MULT - 140));
    const count = Math.floor(t * 28);
    const len = 65 + t * 130;
    const spread = 170 + t * 220;
    const alpha = t * 0.3;
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

function weightedChoice(items: number[], weights: number[]): number {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}
