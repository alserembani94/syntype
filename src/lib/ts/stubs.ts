/**
 * Small declaration files that stand in for big real ones. lib.dom.d.ts is
 * 2.3 MB; snippets only touch a few host globals. @types/react is large too;
 * snippets only use hooks.
 */

export const HOST_D_TS = `
interface Console {
  log(...data: any[]): void;
  error(...data: any[]): void;
  warn(...data: any[]): void;
  info(...data: any[]): void;
  debug(...data: any[]): void;
  table(data: any, columns?: string[]): void;
  time(label?: string): void;
  timeEnd(label?: string): void;
}
declare var console: Console;
declare function setTimeout(handler: (...args: any[]) => void, timeout?: number, ...args: any[]): number;
declare function clearTimeout(id: number | undefined): void;
declare function setInterval(handler: (...args: any[]) => void, timeout?: number, ...args: any[]): number;
declare function clearInterval(id: number | undefined): void;
declare function queueMicrotask(callback: () => void): void;
declare function structuredClone<T>(value: T): T;

interface Headers {
  get(name: string): string | null;
  has(name: string): boolean;
  set(name: string, value: string): void;
}
interface RequestInit {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  signal?: AbortSignal;
}
interface Response {
  readonly ok: boolean;
  readonly status: number;
  readonly statusText: string;
  readonly headers: Headers;
  json(): Promise<any>;
  text(): Promise<string>;
}
declare function fetch(input: string | URL, init?: RequestInit): Promise<Response>;

interface AbortSignal { readonly aborted: boolean }
declare class AbortController {
  readonly signal: AbortSignal;
  abort(reason?: unknown): void;
}
declare class URL {
  constructor(url: string, base?: string | URL);
  href: string;
  origin: string;
  pathname: string;
  search: string;
  readonly searchParams: URLSearchParams;
  toString(): string;
}
declare class URLSearchParams {
  constructor(init?: string | Record<string, string>);
  get(name: string): string | null;
  set(name: string, value: string): void;
  has(name: string): boolean;
  toString(): string;
}
`

export const REACT_D_TS = `
declare module "react" {
  type SetStateAction<S> = S | ((prev: S) => S);
  type Dispatch<A> = (value: A) => void;
  type DependencyList = readonly unknown[];
  export function useState<S>(initial: S | (() => S)): [S, Dispatch<SetStateAction<S>>];
  export function useState<S = undefined>(): [S | undefined, Dispatch<SetStateAction<S | undefined>>];
  export function useEffect(effect: () => void | (() => void), deps?: DependencyList): void;
  export function useLayoutEffect(effect: () => void | (() => void), deps?: DependencyList): void;
  export function useCallback<T extends Function>(callback: T, deps: DependencyList): T;
  export function useMemo<T>(factory: () => T, deps: DependencyList): T;
  export function useRef<T>(initial: T): { current: T };
  export function useReducer<S, A>(reducer: (state: S, action: A) => S, initial: S): [S, Dispatch<A>];
  export function useId(): string;
}
`
