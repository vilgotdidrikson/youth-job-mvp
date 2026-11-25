export type TabKeyOrientation = "horizontal" | "vertical";

/**
 * Index of the tab a WAI-ARIA tab key moves to, or null for keys tabs ignore.
 * Arrow keys wrap and skip disabled tabs; Home/End go to the first/last enabled tab.
 */
export function tabIndexForKey(key: string, current: number, enabled: readonly boolean[], orientation: TabKeyOrientation = "horizontal"): number | null {
  const count = enabled.length;
  if (!enabled.some(Boolean)) return null;
  const [previous, next] = orientation === "vertical" ? ["ArrowUp", "ArrowDown"] : ["ArrowLeft", "ArrowRight"];
  const step = key === next ? 1 : key === previous ? -1 : 0;
  if (step) {
    let index = current < 0 || current >= count ? (step > 0 ? -1 : count) : current;
    do index = (index + step + count) % count; while (!enabled[index]);
    return index;
  }
  if (key === "Home") return enabled.indexOf(true);
  if (key === "End") return enabled.lastIndexOf(true);
  return null;
}

export function tabId(listId: string, value: string): string {
  return `${listId}-tab-${value}`;
}

export function tabPanelId(listId: string): string {
  return `${listId}-panel`;
}

/** Props for the panel the selected tab controls. Only the selected panel is rendered. */
export function tabPanelProps(listId: string, selected: string) {
  return { role: "tabpanel", id: tabPanelId(listId), "aria-labelledby": tabId(listId, selected) } as const;
}
