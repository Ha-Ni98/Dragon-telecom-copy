// S29 — POS focus mode. Web-only: nothing back-end knows this exists. localStorage rather than a
// store setting, for the same reason as LABEL_SIZE_STORAGE_KEY (label-print.types.ts) — this is a
// property of the individual till's browser, not of the store.
export const WORKSPACE_FOCUS_STORAGE_KEY = "dt_pos_focus";
