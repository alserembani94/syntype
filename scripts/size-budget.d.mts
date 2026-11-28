// Types for scripts/size-budget.mjs, which scripts/visual/size.ts imports.
export const BUDGET: { js: number; css: number }
export function firstLoadFiles(dist: string, html: string): string[]
export function gzipKb(...files: string[]): number
export function firstLoad(dist: string): { js: number; css: number }
export function overBudget(size: { js: number; css: number }, budget?: { js: number; css: number }): string[]
export const OVER_BUDGET_HELP: string
