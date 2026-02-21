import { Application, Container, Graphics, FillGradient, BlurFilter } from 'pixi.js';
import type { GameContext, GameSystem } from './types.ts';
import { UFO_RX, UFO_RY } from './constants.ts';

export class Ufo implements GameSystem {
  private container: Container = new Container();
  private gfx: Graphics = new Graphics();

  // Glow layer: BlurFilter + additive blend（UFO本体グロー・エンジングロー）
  private glowContainer: Container = new Container();
  private glowGfx: Graphics = new Graphics();
  private blurFilter: BlurFilter = new BlurFilter({ strength: 18, quality: 4 });

  // Rim lights layer: additive blend
  private rimContainer: Container = new Container();
  private rimGfx: Graphics = new Graphics();

  init(app: Application): void {
    // 1. グローレイヤー（最背面）
    this.glowContainer.addChild(this.glowGfx);
    this.glowContainer.filters = [this.blurFilter];
    this.glowContainer.blendMode = 'add';
    app.stage.addChild(this.glowContainer);

    // 2. UFO本体
    this.container.addChild(this.gfx);
    app.stage.addChild(this.container);

    // 3. リムライトレイヤー（最前面）
    this.rimContainer.addChild(this.rimGfx);
    this.rimContainer.blendMode = 'add';
    app.stage.addChild(this.rimContainer);
  }

  update(ctx: GameContext): void {
    const { ufo, boost } = ctx;

    const posX = ufo.x;
    const posY = ufo.y + Math.sin(ufo.bob) * 2.8 + ufo.shake;

    this.container.x = posX;
    this.container.y = posY;
    this.container.rotation = ufo.tilt;

    // グローレイヤーとリムレイヤーも同一トランスフォームで追従
    this.glowContainer.x = posX;
    this.glowContainer.y = posY;
    this.glowContainer.rotation = ufo.tilt;

    this.rimContainer.x = posX;
    this.rimContainer.y = posY;
    this.rimContainer.rotation = ufo.tilt;

    const gw = 0.72 + 0.28 * Math.sin(ufo.glowPhase);

    // BlurFilter の strength を glowPhase 連動で変化させる
    this.blurFilter.strength = 14 + 8 * gw;

    this.drawAll(gw, ufo.rimPhase, boost.isBoosting);
  }

  private drawAll(gw: number, rimPhase: number, boosting: boolean): void {
    this.gfx.clear();
    this.glowGfx.clear();
    this.rimGfx.clear();

    // 1. グローレイヤー（BlurFilter適用済みコンテナに描画）
    this.drawGlowLayer(gw, boosting);

    // 2. メインディスク (線形グラデーション)
    this.drawMainDisk(gw);

    // 3. パネルアークライン
    this.drawPanelArcs();

    // 4. リムライト（additive blend コンテナに描画）
    this.drawRimLights(rimPhase, boosting);

    // 5. ドーム
    this.drawDome(gw);

    // 6. 中央下部エミッター
    this.drawCenterEmitter(gw);
  }

  // 1. グローレイヤー: UFO本体グロー + エンジン下部グロー
  //    （旧 drawOuterGlow + drawEngineGlow を統合）
  private drawGlowLayer(gw: number, boosting: boolean): void {
    // UFO本体シアングロー（BlurFilter が広げるので単純な楕円1つでOK）
    this.glowGfx.ellipse(0, 0, UFO_RX * 0.9, UFO_RY * 0.9)
      .fill({ color: 0x00e5ff, alpha: 0.55 * gw });

    // エンジン下部グロー
    const engColor = boosting ? 0xff6600 : 0x0088ff;
    this.glowGfx.ellipse(0, UFO_RY + 4, 22, 15)
      .fill({ color: engColor, alpha: 0.7 * gw });
  }

  // 2. メインディスク (FillGradient 線形グラデーション)
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

  // 3. パネルアークライン (3本の装飾的ベジエ曲線)
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

  // 4. リムライト (12個、rimPhase連動) - rimGfx に描画（additive blend）
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
        this.rimGfx.circle(lx, ly, 4.5).fill({ color, alpha: 0.3 });
        this.rimGfx.circle(lx, ly, 2.5).fill({ color, alpha: 0.7 });
      }
      this.rimGfx.circle(lx, ly, 1.8).fill({ color, alpha: 1.0 });
    }
  }

  // 5. ドーム (上半球楕円、放射グラデーション近似)
  private drawDome(gw: number): void {
    const domeRX = UFO_RX * 0.48;
    const domeRY = UFO_RY * 2.2;

    // ドーム本体: 同心楕円で放射グラデーション近似
    const steps = 6;
    for (let i = steps; i >= 1; i--) {
      const ratio = i / steps;
      const baseColor = lerpColor(0x1a3a6a, 0x6aacee, 1 - ratio);
      const alpha = 0.55 + 0.3 * (1 - ratio);
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

  // 6. 中央下部エミッター (放射グラデーション近似)
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
