import type { Application } from 'pixi.js';

export interface UfoState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  tilt: number;
  bob: number;
  glowPhase: number;
  rimPhase: number;
  shake: number;
}

export interface BoostState {
  meter: number;
  isBoosting: boolean;
  prevBoosting: boolean;
  flashAlpha: number;
}

export interface InputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  boost: boolean;
}

export interface GameContext {
  app: Application;
  width: number;
  height: number;
  ufo: UfoState;
  boost: BoostState;
  input: InputState;
  dt: number;
  anyKeyPressed: boolean;
  wrapEdge?: 'left' | 'right' | 'top' | 'bottom' | null;
}

export interface GameSystem {
  init(app: Application): void;
  update(ctx: GameContext): void;
  resize?(width: number, height: number): void;
}
