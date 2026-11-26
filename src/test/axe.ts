/** Runs axe-core in the browser test page and returns WCAG 2.2 A/AA violations (the bar in scripts/visual/a11y.ts). */
import axe from 'axe-core'

/** A rule switched off for some elements, with the reason it doesn't apply there. */
export interface Exemption {
  rule: string
  selector: string
  why: string
}

/**
 * The colour pairs axe finds too low in contrast, as "foreground on background: ratio
 * (needed)", without duplicates: for listing known failures before the contrast round.
 */
export async function contrastFailures(exemptions: Exemption[] = []) {
  const found = await run(exemptions)
  const pairs = found.filter((v) => v.id === 'color-contrast').flatMap((v) => v.nodes.map((n) => n.any[0]?.data as { fgColor: string; bgColor: string; contrastRatio: number; expectedContrastRatio: string } | undefined))
  return [...new Set(pairs.filter((d) => d).map((d) => `${d!.fgColor} on ${d!.bgColor}: ${d!.contrastRatio} (${d!.expectedContrastRatio})`))].sort()
}

/** Every violation except colour contrast (see contrastFailures). */
export async function nonContrastViolations(exemptions: Exemption[] = []) {
  return format((await run(exemptions)).filter((v) => v.id !== 'color-contrast'))
}

export async function wcagViolations(exemptions: Exemption[] = []) {
  return format(await run(exemptions))
}

async function run(exemptions: Exemption[]) {
  // Measure the settled page: finish entry animations and theme cross-fades, then let a frame paint.
  // (Endless ones, such as a spinner, can't finish and don't change colours.)
  // Twice, with a style pass between: a finished fade can start transitions on controls that use its colours.
  const finish = () => {
    for (const a of document.getAnimations()) if (a.effect?.getComputedTiming().endTime !== Infinity) a.finish()
  }
  finish()
  void getComputedStyle(document.body).color
  finish()
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
  const result = await axe.run(document, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'] },
    resultTypes: ['violations'],
  })
  const exempt = (rule: string, node: Element | null) => exemptions.some((e) => e.rule === rule && node?.closest(e.selector))
  return result.violations
    .map((v) => ({ ...v, nodes: v.nodes.filter((n) => !exempt(v.id, document.querySelector(String(n.target[0])))) }))
    .filter((v) => v.nodes.length)
}

function format(violations: Awaited<ReturnType<typeof run>>) {
  return violations.map((v) => `${v.id}: ${v.nodes.map((n) => `${n.target.join(' ')} (${n.any.map((a) => a.message).join('; ')})`).join(', ')}`)
}
