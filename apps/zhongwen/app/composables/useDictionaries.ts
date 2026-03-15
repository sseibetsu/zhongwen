import type { Word } from "~/utils/types";

export function useDictionaryModules() {
  return import.meta.glob("../assets/dictionaries/*.json", {
    eager: true,
    import: "default",
  }) as Record<string, Word[]>;
}
