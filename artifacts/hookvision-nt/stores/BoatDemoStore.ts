/**
 * BoatDemoStore — bridges the Demo tab to the Live tab's boat mode.
 *
 * Demo tab loads live sonar reference images (demos 6-9), stores them here,
 * then navigates to Live tab. Live tab reads this in silentCapture so the full
 * boat-cycle pipeline runs on the demo frames instead of the real camera.
 */

export interface BoatDemoFrame { base64: string; uri: string; }

let _frames: BoatDemoFrame[] = [];
let _cursor = 0;
let _active = false;

export const BoatDemoStore = {
  get active() { return _active; },
  get length()  { return _frames.length; },

  setFrames(frames: BoatDemoFrame[]) {
    _frames = [...frames];
    _cursor = 0;
    _active = _frames.length > 0;
  },

  /** Returns next frame, cycling through the list indefinitely. */
  nextFrame(): BoatDemoFrame | null {
    if (_frames.length === 0) return null;
    const frame = _frames[_cursor % _frames.length]!;
    _cursor++;
    return frame;
  },

  clear() { _frames = []; _cursor = 0; _active = false; },
};
