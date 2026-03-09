"use client";

import { createContext, useContext } from "react";

interface WorkspaceContextValue {
  activeWorkspaceId: string | null;
}

export const WorkspaceContext = createContext<WorkspaceContextValue>({
  activeWorkspaceId: null,
});

export function useActiveWorkspace() {
  return useContext(WorkspaceContext);
}
