import type { Language } from '../types'
import { meta } from './meta'
import { parseSnippets } from '../snippets'
import raw from './snippets.txt?raw'

const KEYWORDS =
  'HAI KTHXBYE CAN HAS I ITZ R A VISIBLE GIMMEH SUM DIFF PRODUKT QUOSHUNT MOD BIGGR SMALLR BOTH SAEM DIFFRINT EITHER WON NOT ALL ANY OF AN O RLY YA NO WAI MEBBE OIC WTF OMG OMGWTF GTFO IM IN YR OUTTA UPPIN NERFIN TIL WILE HOW IZ IF U SAY SO FOUND MKAY SMOOSH MAEK IS NOW YARN NUMBR NUMBAR TROOF NOOB WIN FAIL'

export const lolcode: Language = {
  ...meta,
  indentSize: 2,
  highlight: {
    keywords: KEYWORDS.split(' '),
    // Keywords are all capitals, so capitals don't mean "type" here.
    capitalizedTypes: false,
    lineComments: ['BTW'],
    blockComments: [['OBTW', 'TLDR']],
    strings: ['"'],
  },
  // VS Code has no built-in LOLCODE support; these are from the LOLCODE extension
  // (arwinneil.lolcode). Its comment settings are template defaults, so comment
  // syntax above follows the LOLCODE 1.2 spec instead.
  autoClosingPairs: [
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '"', close: '"' },
    { open: "'", close: "'" },
  ],
  // Keywords and variable names typed earlier; LOLCODE has no member access.
  completion: { wordChar: /\w/, memberTriggers: [] },
  snippets: parseSnippets(raw),
}
