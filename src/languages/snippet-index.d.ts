/** `./snippets.txt?index`: the snippets' names and lengths, without their text (snippetIndex() in vite.config.ts). */
declare module '*snippets.txt?index' {
  const list: { name: string; length: 'short' | 'medium' | 'long' }[]
  export default list
}
