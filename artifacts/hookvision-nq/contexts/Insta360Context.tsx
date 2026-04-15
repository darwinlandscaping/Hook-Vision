/**
 * Shared Insta360 context — one camera + pipeline instance for the whole app.
 * Auto-starts WiFi search on mount so the camera connects without any
 * manual button press. The 360° tab and Live tab both share this instance.
 */
import React, { createContext, useContext, useEffect } from "react";
import { useInsta360, type UseInsta360Result } from "@/hooks/useInsta360";
import {
  useInsta360Pipelines,
  type Insta360PipelineState,
} from "@/hooks/useInsta360Pipelines";

interface Insta360ContextValue {
  camera: UseInsta360Result;
  pipelines: Insta360PipelineState;
}

const Insta360Context = createContext<Insta360ContextValue | null>(null);

export function Insta360Provider({ children }: { children: React.ReactNode }) {
  const camera    = useInsta360();
  const pipelines = useInsta360Pipelines(camera);

  // Auto-start WiFi search when the app loads — no button press needed.
  // The hook guards against double-start internally (active.current flag).
  useEffect(() => {
    camera.startSearch();
    // No cleanup: keep searching/connected for the lifetime of the app.
    // The hook's own unmount cleanup handles the interval.
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Insta360Context.Provider value={{ camera, pipelines }}>
      {children}
    </Insta360Context.Provider>
  );
}

export function useInsta360Context(): Insta360ContextValue {
  const ctx = useContext(Insta360Context);
  if (!ctx) throw new Error("useInsta360Context must be used inside <Insta360Provider>");
  return ctx;
}
