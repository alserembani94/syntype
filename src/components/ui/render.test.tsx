/**
 * Each shadcn component renders without throwing (design system step 7): its
 * main export, with plain children, through React's server renderer. Closed
 * overlays render nothing, which is fine here; the gallery (/admin/gallery)
 * checks every component open and in every state.
 */
import { createElement, type ComponentType } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

const modules = import.meta.glob<Record<string, unknown>>('./*.tsx', { eager: true })
/** alert-dialog.tsx → AlertDialog */
const mainExport = (path: string) =>
  path
    .replace(/^\.\/|\.tsx$/g, '')
    .split('-')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join('')

const cases = Object.entries(modules)
  .filter(([path]) => !path.includes('.test.'))
  .map(([path, mod]) => [mainExport(path), mod[mainExport(path)]] as const)

describe('shadcn components render', () => {
  it('every file has its main export', () => {
    expect(cases.length).toBeGreaterThanOrEqual(31)
    for (const [name, component] of cases) expect(component, name).toBeTypeOf('function')
  })
  it.each(cases)('%s', (name, component) => {
    // Inputs are void elements: no children.
    const children = name === 'Input' ? [] : ['Label']
    expect(() => renderToString(createElement(component as ComponentType<{ children?: string }>, null, ...children))).not.toThrow()
  })
})
