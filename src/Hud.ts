import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { GameContext, GameSystem } from './types';
import { MAX_SPEED } from './constants';

export class Hud implements GameSystem {
  // z-order: hudContainer → flashGfx (最前面)
  private hudContainer = new Container();
  private flashGfx = new Graphics();

  // 毎フレーム clear() → 再描画する Graphics
  private ctrlPanelGfx = new Graphics();
  private barsGfx = new Graphics();

  // 永続 Text (text プロパティのみ更新)
  private speedText = new Text({
    text: 'SPEED     0',
    style: new TextStyle({ fontFamily: 'monospace', fontSize: 11, fontWeight: 'bold', fill: '#88c8ff' }),
  });
  // ブーストラベルは色が変わるため 3 種類用意して visible 切り替え
  private boostTextLow = new Text({
    text: '',
    style: new TextStyle({ fontFamily: 'monospace', fontSize: 11, fontWeight: 'bold', fill: '#ff6655' }),
  });
  private boostTextMid = new Text({
    text: '',
    style: new TextStyle({ fontFamily: 'monospace', fontSize: 11, fontWeight: 'bold', fill: '#ffaa44' }),
  });
  private boostTextHigh = new Text({
    text: '',
    style: new TextStyle({ fontFamily: 'monospace', fontSize: 11, fontWeight: 'bold', fill: '#44ffaa' }),
  });

  private boostingText = new Text({
    text: '◀ BOOSTING',
    style: new TextStyle({ fontFamily: 'monospace', fontSize: 10, fill: '#ffcc44' }),
  });
  private rechargingText = new Text({
    text: 'RECHARGING',
    style: new TextStyle({ fontFamily: 'monospace', fontSize: 10, fill: '#ff6655' }),
  });

  // コントロールオーバーレイ用テキスト群
  private ctrlTexts: Text[] = [];
  private ctrlAlpha = 1.0;

  // ワープフラッシュ
  private warpFlashAlpha = 0;
  private warpEdge: string | null = null;

  private readonly PAD = 22;

  init(app: Application): void {
    // コントロールオーバーレイ テキスト定義
    const ctrlItems: Array<{ text: string; fill: string; fontSize: number; bold?: boolean }> = [
      { text: '── CONTROLS ──',         fill: '#88ccff', fontSize: 12, bold: true },
      { text: 'WASD / ↑↓←→   Move',    fill: '#aaddff', fontSize: 11 },
      { text: 'SHIFT / SPACE   Boost',  fill: '#aaddff', fontSize: 11 },
      { text: 'Screen wraps at edges',  fill: '#557799', fontSize: 10 },
      { text: 'Stars move with parallax', fill: '#557799', fontSize: 10 },
      { text: 'Fly, UFO!',              fill: '#44aaee', fontSize: 11, bold: true },
    ];
    for (const item of ctrlItems) {
      const t = new Text({
        text: item.text,
        style: new TextStyle({
          fontFamily: 'monospace',
          fontSize: item.fontSize,
          fontWeight: item.bold ? 'bold' : 'normal',
          fill: item.fill,
        }),
      });
      this.ctrlTexts.push(t);
    }

    // z-order: 奥から順に addChild
    // 1. コントロールパネル背景
    this.hudContainer.addChild(this.ctrlPanelGfx);
    for (const t of this.ctrlTexts) this.hudContainer.addChild(t);

    // 2. HUD パネル背景 + バー
    this.hudContainer.addChild(this.barsGfx);

    // 3. HUD テキスト (バーの手前)
    this.hudContainer.addChild(this.speedText);
    this.hudContainer.addChild(this.boostTextLow);
    this.hudContainer.addChild(this.boostTextMid);
    this.hudContainer.addChild(this.boostTextHigh);
    this.hudContainer.addChild(this.boostingText);
    this.hudContainer.addChild(this.rechargingText);

    // HUD コンテナ → フラッシュ (最前面) の順で stage に追加
    app.stage.addChild(this.hudContainer);
    app.stage.addChild(this.flashGfx);
  }

  update(ctx: GameContext): void {
    const { width: W, height: H, dt } = ctx;
    const pad = this.PAD;

    // ---- ブーストフラッシュ（全画面・最前面）----
    this.flashGfx.clear();
    if (ctx.boost.flashAlpha > 0) {
      const color = ctx.boost.isBoosting ? 0xff8800 : 0x0088ff;
      this.flashGfx.rect(0, 0, W, H);
      this.flashGfx.fill({ color, alpha: ctx.boost.flashAlpha * 0.55 });
    }

    // ---- ワープフラッシュ（エッジストリップ）----
    if (ctx.wrapEdge) {
      this.warpFlashAlpha = 0.6;
      this.warpEdge = ctx.wrapEdge;
    }
    this.warpFlashAlpha = Math.max(0, this.warpFlashAlpha - dt * 3);
    if (this.warpFlashAlpha > 0) {
      const stripW = 40;
      const warpColor = 0x88ddff;
      const warpAlpha = this.warpFlashAlpha * 0.7;
      switch (this.warpEdge) {
        case 'right':  this.flashGfx.rect(W - stripW, 0, stripW, H).fill({ color: warpColor, alpha: warpAlpha }); break;
        case 'left':   this.flashGfx.rect(0, 0, stripW, H).fill({ color: warpColor, alpha: warpAlpha }); break;
        case 'top':    this.flashGfx.rect(0, 0, W, stripW).fill({ color: warpColor, alpha: warpAlpha }); break;
        case 'bottom': this.flashGfx.rect(0, H - stripW, W, stripW).fill({ color: warpColor, alpha: warpAlpha }); break;
      }
    }

    // ---- コントロールオーバーレイ フェードアウト ----
    if (ctx.anyKeyPressed && this.ctrlAlpha > 0) {
      this.ctrlAlpha = Math.max(0, this.ctrlAlpha - dt * 0.22);
    }

    const speed = Math.hypot(ctx.ufo.vx, ctx.ufo.vy);
    const speedRatio = Math.min(1, speed / MAX_SPEED);
    const meter = ctx.boost.meter; // 0.0〜1.0

    // ---- スピードテキスト更新 ----
    this.speedText.text = `SPEED  ${String(Math.floor(speed)).padStart(4, ' ')}`;

    // ---- ブーストラベル (色別テキスト切り替え) ----
    const boostLabel = `BOOST  ${String(Math.floor(meter * 100)).padStart(3, ' ')}%`;
    this.boostTextLow.text  = boostLabel;
    this.boostTextMid.text  = boostLabel;
    this.boostTextHigh.text = boostLabel;
    const meterLow  = meter < 0.2;
    const meterMid  = meter >= 0.2 && meter < 0.5;
    this.boostTextLow.visible  = meterLow;
    this.boostTextMid.visible  = meterMid;
    this.boostTextHigh.visible = !meterLow && !meterMid;

    // ---- オプションテキスト表示切り替え ----
    this.boostingText.visible   = ctx.boost.isBoosting;
    this.rechargingText.visible = !ctx.boost.isBoosting && meterLow;

    // ---- レイアウト計算 ----
    const panelX = pad;
    const panelY = H - 82;
    const panelW = 210;
    const panelH = 72;
    const barX   = panelX + 10;
    const barW   = 165;
    const barH   = 9;
    const speedBarLabelY = panelY + 12;
    const speedBarY      = speedBarLabelY + 14;
    const boostBarLabelY = speedBarLabelY + 24 + barH;
    const boostBarY      = boostBarLabelY + 14;

    // テキスト位置
    this.speedText.x = barX;
    this.speedText.y = speedBarLabelY;

    for (const t of [this.boostTextLow, this.boostTextMid, this.boostTextHigh]) {
      t.x = barX;
      t.y = boostBarLabelY;
    }
    this.boostingText.x = barX + 110;
    this.boostingText.y = boostBarLabelY;
    this.rechargingText.x = barX + 100;
    this.rechargingText.y = boostBarLabelY;

    // ---- バー & パネル描画（毎フレーム clear → 再描画）----
    this.barsGfx.clear();

    // HUD パネル背景
    this.barsGfx.roundRect(panelX, panelY, panelW, panelH, 8);
    this.barsGfx.fill({ color: 0x000818, alpha: 0.68 });

    // スピードバー背景
    this.barsGfx.roundRect(barX, speedBarY, barW, barH, 3);
    this.barsGfx.fill({ color: 0xffffff, alpha: 0.08 });

    // スピードバー fill
    if (speedRatio > 0) {
      let speedColor: number;
      if (speedRatio > 0.78)      speedColor = 0xff3300; // hue=20 オレンジ赤
      else if (speedRatio > 0.45) speedColor = 0xffcc00; // hue=50 黄
      else                        speedColor = 0x0088ff; // hue=200 青
      this.barsGfx.roundRect(barX, speedBarY, barW * speedRatio, barH, 3);
      this.barsGfx.fill({ color: speedColor, alpha: 1 });
    }

    // ブーストバー背景
    this.barsGfx.roundRect(barX, boostBarY, barW, barH, 3);
    this.barsGfx.fill({ color: 0xffffff, alpha: 0.08 });

    // ブーストバー fill
    if (meter > 0) {
      let boostBarColor: number;
      if (meter < 0.2)      boostBarColor = 0xff2200; // hue=0
      else if (meter < 0.5) boostBarColor = 0xff8800; // hue=35
      else                  boostBarColor = 0x00cc66; // hue=148
      this.barsGfx.roundRect(barX, boostBarY, barW * meter, barH, 3);
      this.barsGfx.fill({ color: boostBarColor, alpha: 1 });
    }

    // ---- コントロールオーバーレイ（右下）----
    this.ctrlPanelGfx.clear();
    if (this.ctrlAlpha > 0) {
      const ctrlX = W - 240;
      const ctrlY = H - 170;

      // パネル背景
      this.ctrlPanelGfx.roundRect(ctrlX, ctrlY, 220, 148, 8);
      this.ctrlPanelGfx.fill({ color: 0x000818, alpha: 0.78 * this.ctrlAlpha });

      // テキスト位置 & 透明度
      const offsets = [
        { dx: 20, dy: 12 },
        { dx: 16, dy: 34 },
        { dx: 16, dy: 52 },
        { dx: 16, dy: 74 },
        { dx: 16, dy: 88 },
        { dx: 16, dy: 110 },
      ];
      this.ctrlTexts.forEach((t, i) => {
        t.x = ctrlX + offsets[i].dx;
        t.y = ctrlY + offsets[i].dy;
        t.alpha = this.ctrlAlpha;
        t.visible = true;
      });
    } else {
      this.ctrlTexts.forEach(t => { t.visible = false; });
    }
  }

  resize(_w: number, _h: number): void {
    // 寸法は update() の ctx から毎フレーム取得するため no-op
  }
}
