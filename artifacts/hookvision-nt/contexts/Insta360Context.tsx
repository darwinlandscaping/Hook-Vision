/**
 * Shared Insta360 context — one camera + pipeline + OSC instance for the whole app.
 * Auto-starts WiFi search on mount so the camera connects without any button press.
 * Exposes the full Open Platform OSC API via the `osc` field.
 */
import React, { createContext, useContext, useEffect } from "react";
import { useInsta360, type UseInsta360Result }         from "@/hooks/useInsta360";
import { useInsta360Pipelines, type Insta360PipelineState } from "@/hooks/useInsta360Pipelines";
import { useInsta360OSC, type UseInsta360OSCResult }   from "@/hooks/useInsta360OSC";

interface Insta360ContextValue {
  camera:    UseInsta360Result;
  pipelines: Insta360PipelineState;
  osc:       UseInsta360OSCResult;
}

const Insta360Context = createContext<Insta360ContextValue | null>(null);

export function Insta360Provider({ children }: { children: React.ReactNode }) {
  const camera    = useInsta360();
  const pipelines = useInsta360Pipelines(camera);
  const osc       = useInsta360OSC(camera.activeBaseUrl, camera.status === "connected");

  useEffect(() => {
    camera.startSearch();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Insta360Context.Provider value={{ camera, pipelines, osc }}>
      {children}
    </Insta360Context.Provider>
  );
}

export function useInsta360Context(): Insta360ContextValue {
  const ctx = useContext(Insta360Context);
  if (!ctx) throw new Error("useInsta360Context must be used inside <Insta360Provider>");
  return ctx;
}
