/**
 * The part of Cloudflare D1's API the server uses. Written as plain
 * interfaces so the modules here type-check and test outside the Workers
 * runtime; env.DB satisfies them.
 */
export interface Statement {
  bind(...values: unknown[]): Statement
  first<T = Record<string, unknown>>(): Promise<T | null>
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>
  run(): Promise<{ meta: { changes: number } }>
}

export interface Db {
  prepare(query: string): Statement
  batch(statements: Statement[]): Promise<unknown[]>
}
