/** Runs axe-core in the browser test page and returns WCAG 2.2 A/AA violations (the bar in scripts/visual/a11y.ts). */
import axe from 'axe-core'

/** A rule switched off for some elements, with the reason it doesn't apply there. */
export interface Exemption {
  rule: string
  selector: string
  why: string
}

export async function wcagViolations(exemptions: Exemption[] = []) {
  // Measure the settled page: finish entry animations and theme cross-fades, then let a frame paint.
  document.getAnimations().forEach((a) => a.finish())
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
  const result = await axe.run(document, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'] },
    resultTypes: ['violations'],
  })
  const exempt = (rule: string, node: Element | null) => exemptions.some((e) => e.rule === rule && node?.closest(e.selector))
  return result.violations.flatMap((v) => {
    const nodes = v.nodes.filter((n) => !exempt(v.id, document.querySelector(String(n.target[0]))))
    return nodes.length ? [`${v.id}: ${nodes.map((n) => `${n.target.join(' ')} (${n.any.map((a) => a.message).join('; ')})`).join(', ')}`] : []
  })
}
