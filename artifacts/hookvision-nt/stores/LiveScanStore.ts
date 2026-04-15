/**
 * LiveScanStore — bridges the Live Camera tab and the Scan tab.
 *
 * When Live tab captures a photo (manually or via boat mode auto-scan),
 * it pushes the image here instead of doing its own API call.
 * The Scan tab subscribes and auto-triggers analysis immediately.
 *
 * This keeps all analysis, streaming results, and the full analysis card
 * in one place (Scan tab) while boat mode keeps auto-capturing in the background.
 */

export type LiveScanSource = 'live' | 'boat';

export interface LiveScanPayload {
  base64: string;
  uri:    string;
  source: LiveScanSource;
}

type Listener = (payload: LiveScanPayload) => void;

let pendingPayload: LiveScanPayload | null = null;
let listeners:      Listener[]             = [];
let _boatActive     = false;
let _scanCount      = 0;

export const LiveScanStore = {
  /** True while boat mode is running in the Live tab */
  get boatActive() { return _boatActive; },

  /** Total scans pushed in this boat mode session */
  get scanCount() { return _scanCount; },

  /** Push an image from the live/boat camera to the Scan tab. */
  push(base64: string, uri: string, source: LiveScanSource) {
    pendingPayload = { base64, uri, source };
    if (source === 'boat') _scanCount++;
    const payload = pendingPayload;
    listeners.forEach(l => l(payload!));
  },

  /** Called by Live tab when boat mode is toggled. */
  setBoatActive(active: boolean) {
    _boatActive = active;
    if (!active) _scanCount = 0;
  },

  /** Subscribe to new image pushes. Returns an unsubscribe function. */
  subscribe(listener: Listener): () => void {
    listeners = [...listeners, listener];
    return () => { listeners = listeners.filter(l => l !== listener); };
  },

  clear() { pendingPayload = null; },
};
