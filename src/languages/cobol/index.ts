import type { Language } from '../types'
import { parseSnippets } from '../snippets'
import { packs } from './completions'
import raw from './snippets.txt?raw'

const KEYWORDS =
  'IDENTIFICATION ENVIRONMENT DATA PROCEDURE DIVISION SECTION PROGRAM-ID INPUT-OUTPUT FILE-CONTROL SELECT ASSIGN TO ORGANIZATION IS LINE SEQUENTIAL FILE FD WORKING-STORAGE LINKAGE PIC PICTURE VALUE OCCURS TIMES REDEFINES INDEXED BY DISPLAY ACCEPT MOVE ADD SUBTRACT MULTIPLY DIVIDE GIVING COMPUTE ROUNDED IF THEN ELSE END-IF EVALUATE WHEN OTHER END-EVALUATE PERFORM VARYING FROM UNTIL THRU END-PERFORM READ WRITE OPEN CLOSE INPUT OUTPUT AT END NOT END-READ STRING DELIMITED SIZE INTO END-STRING UNSTRING INSPECT TALLYING REPLACING STOP RUN GOBACK CALL USING RETURNING EXIT CONTINUE INITIALIZE SET TRUE FALSE ZERO ZEROS SPACE SPACES AND OR OF FUNCTION'

export const cobol: Language = {
  id: 'cobol',
  name: 'COBOL',
  extension: 'cbl',
  // Fixed format: code starts at column 8 (Area A); statements at column 12
  // (Area B), then 4 columns per level. Nothing past column 72.
  indentOffset: 7,
  indentSize: 4,
  maxLineLength: 72,
  highlight: {
    keywords: KEYWORDS.split(' '),
    caseInsensitive: true,
    // Everything is uppercase in COBOL, so capitals don't mean "type" here.
    capitalizedTypes: false,
    // COBOL words contain hyphens (WS-TOTAL, END-IF) but don't end with one.
    identifier: '[A-Za-z][A-Za-z0-9-]*[A-Za-z0-9]|[A-Za-z]',
    lineComments: ['*>'],
    strings: ['"', "'"],
  },
  // VS Code has no built-in COBOL support; these come from the COBOL extension
  // (bitlang.cobol, cobol.configuration.json in spgennard/vscode_cobol).
  autoClosingPairs: [
    { open: '[', close: ']', notIn: ['string', 'comment'] },
    { open: '(', close: ')' },
    { open: "'", close: "'", notIn: ['string', 'comment'] },
    { open: '"', close: '"', notIn: ['string', 'comment'] },
  ],
  // No language service: keywords, data names typed earlier and intrinsic
  // functions. COBOL has no member access ("." ends a sentence).
  completion: {
    // The extension's word pattern: hyphens are part of words.
    wordChar: /[\w-]/,
    memberTriggers: [],
    packs,
  },
  snippets: parseSnippets(raw),
}
