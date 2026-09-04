import { useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";

/**
 * Navigate by plain path, the way the old hand-rolled router did. The router's
 * own `navigate` wants a literal route path; the pages build theirs from a row
 * id, so the string is passed through.
 */
export function useGo(): (to: string) => void {
  const navigate = useNavigate();
  return useCallback((to: string) => void navigate({ to: to as never }), [navigate]);
}
