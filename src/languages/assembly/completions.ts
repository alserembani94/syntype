import type { CompletionItem, VocabularyPack } from '../types'

const r64 = 'rax rbx rcx rdx rsi rdi rbp rsp r8 r9 r10 r11 r12 r13 r14 r15'
const r32 = 'eax ebx ecx edx esi edi ebp esp r8d r9d r10d r11d r12d r13d r14d r15d'
const r16 = 'ax bx cx dx si di bp sp'
const r8 = 'al bl cl dl sil dil bpl spl ah bh ch dh r8b r9b r10b r11b r12b r13b r14b r15b'

/** The general-purpose registers, by size: highlighted as types, suggested as variables. */
export const REGISTERS = [r64, r32, r16, r8].join(' ').split(' ')

const items = (labels: string[]): CompletionItem[] => labels.map((label) => ({ label, kind: 'variable' }))

/** Registers are always there; labels and data names come from words typed earlier. */
export const registers: VocabularyPack = { name: 'register', globals: items(REGISTERS) }

export const packs: VocabularyPack[] = [registers]
