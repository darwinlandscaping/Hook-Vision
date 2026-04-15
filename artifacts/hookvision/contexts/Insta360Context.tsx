/**
 * Shared Insta360 context — one camera + pipeline instance for the whole app.
 * Wrap the tab layout with <Insta360Provider> so Live tab and 360 tab share
 * the same connection and pipeline state without double-connecting.
 */
import React, { createContext, useContext } from "react";
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
