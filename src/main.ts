import { Application } from 'pixi.js';
import type { GameContext, GameSystem, UfoState, BoostState } from './types.js';
import { InputManager } from './input.js';
import {
  ACCEL, MAX_SPEED, BOOST_MULT, FRICTION,
  BOOST_DRAIN, BOOST_REGEN,
} from './constants.js';
import { Environment } from './Environment.js';
import { Particles } from './Particles.js';
import { Ufo } from './Ufo.js';
import { Trail } from './Trail.js';
import { SoundManager } from './Sound.js';
import { Hud } from './Hud.js';

async function main() {
  const app = new Application();
  await app.init({
    background: '#00060f',
    resizeTo: window,
    antialias: true,
  });

  document.body.appendChild(app.canvas);
  document.body.style.cursor = 'none';

  const input = new InputManager();

  const ufo: UfoState = {
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
    vx: 0,
    vy: 0,
    tilt: 0,
    bob: 0,
    glowPhase: 0,
    rimPhase: 0,
    shake: 0,
  };

  const boost: BoostState = {
    meter: 1,
    isBoosting: false,
    prevBoosting: false,
    flashAlpha: 0,
  };

  // Systems in render order: environment (back) → trail → particles → ufo → sound → hud (front)
  const systems: GameSystem[] = [
    new Environment(),
    new Trail(),
    new Particles(),
    new Ufo(),
    new SoundManager(),
    new Hud(),
  ];

  for (const sys of systems) {
    sys.init(app);
  }

  let width = window.innerWidth;
  let height = window.innerHeight;

  window.addEventListener('resize', () => {
    width = window.innerWidth;
    height = window.innerHeight;
    for (const sys of systems) {
      sys.resize?.(width, height);
    }
  });

  app.ticker.add((ticker) => {
    const dt = ticker.deltaMS / 1000;

    // --- Input ---
    const inputState = input.getState();

    // --- Boost management ---
    const wantBoost = inputState.boost;
    boost.prevBoosting = boost.isBoosting;
    boost.isBoosting = wantBoost && boost.meter > 0.01;

    if (boost.isBoosting && !boost.prevBoosting) {
      boost.flashAlpha = 0.4;
    }

    if (boost.isBoosting) {
      boost.meter = Math.max(0, boost.meter - BOOST_DRAIN * dt);
    } else {
      boost.meter = Math.min(1, boost.meter + BOOST_REGEN * dt);
    }

    boost.flashAlpha = Math.max(0, boost.flashAlpha - dt * 2);

    // --- Acceleration ---
    const speedMult = boost.isBoosting ? BOOST_MULT : 1;
    const accel = ACCEL * speedMult * dt;

    if (inputState.left)  ufo.vx -= accel;
    if (inputState.right) ufo.vx += accel;
    if (inputState.up)    ufo.vy -= accel;
    if (inputState.down)  ufo.vy += accel;

    // --- Speed cap ---
    const maxSpeed = MAX_SPEED * speedMult;
    const speed = Math.sqrt(ufo.vx * ufo.vx + ufo.vy * ufo.vy);
    if (speed > maxSpeed) {
      const ratio = maxSpeed / speed;
      ufo.vx *= ratio;
      ufo.vy *= ratio;
    }

    // --- Friction ---
    const frictionBase = boost.isBoosting ? 0.983 : FRICTION;
    const frictionFactor = Math.pow(frictionBase, dt * 60);
    ufo.vx *= frictionFactor;
    ufo.vy *= frictionFactor;

    // --- Position update ---
    ufo.x += ufo.vx * dt;
    ufo.y += ufo.vy * dt;

    // --- Screen wrap ---
    const margin = 60;
    ufo.x = ((ufo.x + margin) % (width + margin * 2) + (width + margin * 2)) % (width + margin * 2) - margin;
    ufo.y = ((ufo.y + margin) % (height + margin * 2) + (height + margin * 2)) % (height + margin * 2) - margin;

    // --- UFO visual state ---
    const targetTilt = (ufo.vx / MAX_SPEED) * 0.45;
    ufo.tilt += (targetTilt - ufo.tilt) * Math.min(1, dt * 6);

    ufo.bob += dt;
    ufo.glowPhase += dt * 1.2;
    ufo.rimPhase += dt * 2.5;

    const shakeTarget = boost.isBoosting ? 1.8 : 0;
    ufo.shake += (shakeTarget - ufo.shake) * Math.min(1, dt * 10);

    // --- Build context ---
    const ctx: GameContext = {
      app,
      width,
      height,
      ufo,
      boost,
      input: inputState,
      dt,
      anyKeyPressed: input.anyKeyPressed,
    };

    // --- Update all systems ---
    for (const sys of systems) {
      sys.update(ctx);
    }
  });
}

main().catch(console.error);
