/**
 * Small declaration files that stand in for big real ones. lib.dom.d.ts is
 * 2.3 MB; snippets only touch a few host globals. @types/react and
 * @types/express are large too; snippets use a handful of their APIs.
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

export const EXPRESS_D_TS = `
declare module "express" {
  interface Request {
    params: Record<string, string>;
    query: Record<string, string | undefined>;
    body: any;
    headers: Record<string, string | undefined>;
    method: string;
    path: string;
    ip?: string;
    get(name: string): string | undefined;
  }
  interface Response {
    status(code: number): Response;
    json(body?: unknown): Response;
    send(body?: unknown): Response;
    sendStatus(code: number): Response;
    set(field: string, value: string): Response;
    type(type: string): Response;
    cookie(name: string, value: string): Response;
    redirect(url: string): void;
    end(): void;
  }
  type NextFunction = (err?: unknown) => void;
  type Handler = (req: Request, res: Response, next: NextFunction) => unknown;
  interface Router {
    get(path: string, ...handlers: Handler[]): this;
    post(path: string, ...handlers: Handler[]): this;
    put(path: string, ...handlers: Handler[]): this;
    patch(path: string, ...handlers: Handler[]): this;
    delete(path: string, ...handlers: Handler[]): this;
    all(path: string, ...handlers: Handler[]): this;
    use(...handlers: (string | Handler | Router)[]): this;
    route(path: string): Router;
  }
  interface Application extends Router {
    listen(port: number, callback?: () => void): unknown;
    set(name: string, value: unknown): this;
  }
  interface Express {
    (): Application;
    json(): Handler;
    urlencoded(options?: { extended?: boolean }): Handler;
    static(root: string): Handler;
    Router(): Router;
  }
  const express: Express;
  export default express;
  export type { Request, Response, NextFunction, Router, Application };
}
`
