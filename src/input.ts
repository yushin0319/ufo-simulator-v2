import type { InputState } from './types.js';

const PREVENT_KEYS = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Space',
  ' ',
]);

export class InputManager {
  private state: InputState = {
    up: false,
    down: false,
    left: false,
    right: false,
    boost: false,
  };

  private _anyKeyPressed = false;

  constructor() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  get anyKeyPressed(): boolean {
    return this._anyKeyPressed;
  }

  getState(): InputState {
    return { ...this.state };
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (PREVENT_KEYS.has(e.key) || PREVENT_KEYS.has(e.code)) {
      e.preventDefault();
    }
    this.applyKey(e.key, e.code, true);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.applyKey(e.key, e.code, false);
  };

  private applyKey(key: string, code: string, pressed: boolean): void {
    if (pressed) this._anyKeyPressed = true;

    switch (key) {
      case 'ArrowUp':
      case 'w':
      case 'W':
        this.state.up = pressed;
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        this.state.down = pressed;
        break;
      case 'ArrowLeft':
      case 'a':
      case 'A':
        this.state.left = pressed;
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        this.state.right = pressed;
        break;
      case 'Shift':
      case ' ':
        this.state.boost = pressed;
        break;
    }

    // code-based fallback for non-standard layouts
    switch (code) {
      case 'ShiftLeft':
      case 'ShiftRight':
      case 'Space':
        this.state.boost = pressed;
        break;
    }
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
  }
}
