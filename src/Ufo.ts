import { Application, Container, Graphics, FillGradient } from 'pixi.js';
import type { GameContext, GameSystem } from './types.ts';
import { UFO_RX, UFO_RY } from './constants.ts';

export class Ufo implements GameSystem {
  private container: Container = new Container();
  private gfx: Graphics = new Graphics();

  init(app: Application): void {
    this.container.addChild(this.gfx);
    app.stage.addChild(this.container);
  }

  update(ctx: GameContext): void {
    const { ufo, boost } = ctx;

    this.container.x = ufo.x;
    this.container.y = ufo.y + Math.sin(ufo.bob) * 2.8 + ufo.shake;
    this.container.rotation = ufo.tilt;

    const gw = 0.72 + 0.28 * Math.sin(ufo.glowPhase);
    this.drawAll(gw, ufo.rimPhase, boost.isBoosting);
  }

  private drawAll(gw: number, rimPhase: number, boosting: boolean): void {
    this.gfx.clear();

    // 1. 外側グロー (同心楕円で放射グラデーション近似)
    this.drawOuterGlow(gw);

    // 2. エンジン下部グロー
    this.drawEngineGlow(boosting, gw);

    // 3. メインディスク (線形グラデーション)
    this.drawMainDisk(gw);

    // 4. パネルアークライン
    this.drawPanelArcs();

    // 5. リムライト
    this.drawRimLights(rimPhase, boosting);

    // 6. ドーム
    this.drawDome(gw);

    // 7. 中央下部エミッター
    this.drawCenterEmitter(gw);
  }

  // 1. 外側グロー: 同心楕円を段階的透明度で重ねる
  private drawOuterGlow(gw: number): void {
    const steps = 8;
    const rx = 95, ry = 60;
    for (let i = steps; i >= 1; i--) {
      const ratio = i / steps;
      const alpha = (1 - ratio) * 0.18 * gw;
      this.gfx.ellipse(0, 0, rx * ratio, ry * ratio)
        .fill({ color: 0x00e5ff, alpha });
    }
  }

  // 2. エンジン下部グロー
  private drawEngineGlow(boosting: boolean, gw: number): void {
    const color = boosting ? 0xff6600 : 0x0088ff;
    const steps = 5;
    for (let i = steps; i >= 1; i--) {
      const ratio = i / steps;
      const alpha = (1 - ratio) * 0.45 * gw;
      this.gfx.ellipse(0, UFO_RY + 4, 30 * ratio, 22 * ratio)
        .fill({ color, alpha });
    }
  }

  // 3. メインディスク (FillGradient 線形グラデーション)
  private drawMainDisk(gw: number): void {
    const grad = new FillGradient({ type: 'linear', start: { x: 0, y: -UFO_RY }, end: { x: 0, y: UFO_RY } });
    grad.addColorStop(0, 0x4a5f90);
    grad.addColorStop(0.35, 0x6888c0);
    grad.addColorStop(0.7, 0x3a5080);
    grad.addColorStop(1, 0x1e2e50);

    this.gfx.ellipse(0, 0, UFO_RX, UFO_RY).fill({ fill: grad });

    // ストローク: シアン系、glowPhase連動alpha
    this.gfx.ellipse(0, 0, UFO_RX, UFO_RY)
      .stroke({ width: 1.2, color: 0x00e5ff, alpha: 0.4 + 0.4 * gw });
  }

  // 4. パネルアークライン (3本の装飾的ベジエ曲線)
  private drawPanelArcs(): void {
    const rx = UFO_RX, ry = UFO_RY;
    const arcs = [
      { sx: -rx * 0.7, sy: -ry * 0.2, cx: 0, cy: -ry * 0.6, ex: rx * 0.7, ey: -ry * 0.2 },
      { sx: -rx * 0.5, sy: ry * 0.1, cx: 0, cy: -ry * 0.3, ex: rx * 0.5, ey: ry * 0.1 },
      { sx: -rx * 0.3, sy: ry * 0.3, cx: 0, cy: ry * 0.0, ex: rx * 0.3, ey: ry * 0.3 },
    ];
    for (const a of arcs) {
      this.gfx
        .moveTo(a.sx, a.sy)
        .quadraticCurveTo(a.cx, a.cy, a.ex, a.ey)
        .stroke({ width: 0.8, color: 0x88aadd, alpha: 0.5 });
    }
  }

  // 5. リムライト (12個、rimPhase連動)
  private drawRimLights(rimPhase: number, boosting: boolean): void {
    const count = 12;
    const rx = UFO_RX, ry = UFO_RY;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + rimPhase;
      const lx = Math.cos(angle) * rx * 0.88;
      const ly = Math.sin(angle) * ry * 0.7;

      const hue = boosting ? 15 + i * 6 : 180 + i * 9;
      const bright = 0.4 + 0.6 * Math.abs(Math.sin(angle));
      const color = hslToHex(hue, 100, bright * 100);

      if (bright > 0.55) {
        // グロー効果: 外側のソフト円
        this.gfx.circle(lx, ly, 4.5).fill({ color, alpha: 0.3 });
        this.gfx.circle(lx, ly, 2.5).fill({ color, alpha: 0.7 });
      }
      this.gfx.circle(lx, ly, 1.8).fill({ color, alpha: 1.0 });
    }
  }

  // 6. ドーム (上半球楕円、放射グラデーション近似)
  private drawDome(gw: number): void {
    const domeRX = UFO_RX * 0.48;
    const domeRY = UFO_RY * 2.2;

    // ドーム本体: 同心楕円で放射グラデーション近似
    const steps = 6;
    for (let i = steps; i >= 1; i--) {
      const ratio = i / steps;
      const baseColor = lerpColor(0x1a3a6a, 0x6aacee, 1 - ratio);
      const alpha = 0.55 + 0.3 * (1 - ratio);
      // 上半球のみ描画（clipRect の代わりに y オフセットで調整）
      this.gfx.ellipse(0, -UFO_RY * 0.3, domeRX * ratio, domeRY * ratio * 0.5)
        .fill({ color: baseColor, alpha });
    }

    // スペキュラハイライト
    const specSteps = 4;
    for (let i = specSteps; i >= 1; i--) {
      const ratio = i / specSteps;
      this.gfx.ellipse(-domeRX * 0.2, -UFO_RY * 0.9, domeRX * 0.35 * ratio, domeRY * 0.12 * ratio)
        .fill({ color: 0xffffff, alpha: 0.12 * (1 - ratio) + 0.04 });
    }

    // ドームアウトライン
    this.gfx.ellipse(0, -UFO_RY * 0.3, domeRX, domeRY * 0.5)
      .stroke({ width: 1.0, color: 0x00e5ff, alpha: 0.3 + 0.3 * gw });
  }

  // 7. 中央下部エミッター (放射グラデーション近似)
  private drawCenterEmitter(gw: number): void {
    const radius = 15;
    const steps = 5;
    for (let i = steps; i >= 1; i--) {
      const ratio = i / steps;
      const alpha = (1 - ratio) * 0.6 * gw;
      this.gfx.circle(0, UFO_RY * 0.5, radius * ratio)
        .fill({ color: 0x44ddff, alpha });
    }
    // コア
    this.gfx.circle(0, UFO_RY * 0.5, 3).fill({ color: 0xffffff, alpha: 0.8 * gw });
  }
}

// HSL -> 0xRRGGBB
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

// 2色の線形補間 (0xRRGGBB)
function lerpColor(c1: number, c2: number, t: number): number {
  const r1 = (c1 >> 16) & 0xff, g1 = (c1 >> 8) & 0xff, b1 = c1 & 0xff;
  const r2 = (c2 >> 16) & 0xff, g2 = (c2 >> 8) & 0xff, b2 = c2 & 0xff;
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return (r << 16) | (g << 8) | b;
}
