/**
 * Small declaration files that stand in for big real ones. lib.dom.d.ts is
 * 2.3 MB; snippets only touch a few host globals. @types/react,
 * @types/express and @playwright/test are large too; snippets use a
 * handful of their APIs.
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

export const PLAYWRIGHT_D_TS = `
declare module "@playwright/test" {
  type Role =
    | "alert" | "button" | "cell" | "checkbox" | "combobox" | "dialog" | "heading" | "img"
    | "link" | "listitem" | "main" | "navigation" | "option" | "row" | "tab" | "textbox";
  interface ByRoleOptions { name?: string | RegExp; exact?: boolean; checked?: boolean }
  interface Locator {
    click(): Promise<void>;
    dblclick(): Promise<void>;
    fill(value: string): Promise<void>;
    press(key: string): Promise<void>;
    check(): Promise<void>;
    uncheck(): Promise<void>;
    hover(): Promise<void>;
    selectOption(value: string | string[]): Promise<string[]>;
    setInputFiles(files: string | string[]): Promise<void>;
    textContent(): Promise<string | null>;
    innerText(): Promise<string>;
    inputValue(): Promise<string>;
    allTextContents(): Promise<string[]>;
    count(): Promise<number>;
    isVisible(): Promise<boolean>;
    waitFor(options?: { state?: "attached" | "detached" | "visible" | "hidden" }): Promise<void>;
    first(): Locator;
    last(): Locator;
    nth(index: number): Locator;
    filter(options: { hasText?: string | RegExp; has?: Locator }): Locator;
    locator(selector: string): Locator;
    getByRole(role: Role, options?: ByRoleOptions): Locator;
    getByText(text: string | RegExp, options?: { exact?: boolean }): Locator;
    getByLabel(text: string | RegExp, options?: { exact?: boolean }): Locator;
    getByPlaceholder(text: string | RegExp): Locator;
    getByTestId(testId: string): Locator;
  }
  interface Request { url(): string; method(): string; postDataJSON(): any }
  interface Route {
    fulfill(options: { status?: number; json?: unknown; body?: string; contentType?: string }): Promise<void>;
    continue(): Promise<void>;
    abort(): Promise<void>;
    request(): Request;
  }
  interface APIResponse { ok(): boolean; status(): number; json(): Promise<any>; text(): Promise<string> }
  interface APIRequestContext {
    get(url: string, options?: { params?: Record<string, string> }): Promise<APIResponse>;
    post(url: string, options?: { data?: unknown }): Promise<APIResponse>;
    put(url: string, options?: { data?: unknown }): Promise<APIResponse>;
    delete(url: string): Promise<APIResponse>;
  }
  interface Keyboard { press(key: string): Promise<void>; type(text: string): Promise<void> }
  interface Page {
    goto(url: string): Promise<APIResponse | null>;
    reload(): Promise<APIResponse | null>;
    url(): string;
    title(): Promise<string>;
    keyboard: Keyboard;
    locator(selector: string): Locator;
    getByRole(role: Role, options?: ByRoleOptions): Locator;
    getByText(text: string | RegExp, options?: { exact?: boolean }): Locator;
    getByLabel(text: string | RegExp, options?: { exact?: boolean }): Locator;
    getByPlaceholder(text: string | RegExp): Locator;
    getByTestId(testId: string): Locator;
    route(url: string | RegExp, handler: (route: Route) => Promise<void> | void): Promise<void>;
    waitForURL(url: string | RegExp): Promise<void>;
    waitForResponse(url: string | RegExp): Promise<APIResponse>;
    screenshot(options?: { path?: string; fullPage?: boolean }): Promise<unknown>;
    evaluate<R>(fn: () => R): Promise<R>;
    close(): Promise<void>;
  }
  interface BrowserContext { newPage(): Promise<Page>; clearCookies(): Promise<void> }
  interface Fixtures {
    page: Page;
    context: BrowserContext;
    request: APIRequestContext;
    browserName: "chromium" | "firefox" | "webkit";
    baseURL: string | undefined;
  }
  type Body<T> = (args: Fixtures & T) => Promise<void>;
  interface Describe {
    (title: string, body: () => void): void;
    configure(options: { mode?: "default" | "parallel" | "serial"; retries?: number; timeout?: number }): void;
    skip(title: string, body: () => void): void;
    only(title: string, body: () => void): void;
  }
  interface TestType<T = {}> {
    (title: string, body: Body<T>): void;
    describe: Describe;
    setTimeout(timeout: number): void;
    slow(): void;
    beforeEach(body: Body<T>): void;
    afterEach(body: Body<T>): void;
    beforeAll(body: Body<T>): void;
    afterAll(body: Body<T>): void;
    skip(title: string, body: Body<T>): void;
    only(title: string, body: Body<T>): void;
    step<R>(title: string, body: () => Promise<R>): Promise<R>;
    use(options: Record<string, unknown>): void;
    extend<U>(fixtures: {
      [K in keyof U]: (args: Fixtures & T, use: (value: U[K]) => Promise<void>) => Promise<void>;
    }): TestType<T & U>;
  }
  interface Matchers {
    not: Matchers;
    toBeVisible(): Promise<void>;
    toBeHidden(): Promise<void>;
    toBeEnabled(): Promise<void>;
    toBeDisabled(): Promise<void>;
    toBeChecked(): Promise<void>;
    toHaveText(text: string | RegExp | (string | RegExp)[]): Promise<void>;
    toContainText(text: string | RegExp): Promise<void>;
    toHaveValue(value: string | RegExp): Promise<void>;
    toHaveAttribute(name: string, value?: string | RegExp): Promise<void>;
    toHaveCount(count: number): Promise<void>;
    toHaveURL(url: string | RegExp): Promise<void>;
    toHaveTitle(title: string | RegExp): Promise<void>;
    toBeOK(): Promise<void>;
    toBe(value: unknown): void;
    toEqual(value: unknown): void;
    toBeTruthy(): void;
    toContain(value: unknown): void;
    toHaveLength(length: number): void;
  }
  interface Expect {
    <T>(actual: T): Matchers;
    soft<T>(actual: T): Matchers;
    poll<T>(fn: () => T | Promise<T>): Matchers;
  }
  interface Config {
    testDir?: string;
    retries?: number;
    workers?: number;
    timeout?: number;
    use?: Record<string, unknown>;
    projects?: { name: string; use?: Record<string, unknown> }[];
  }
  export const test: TestType;
  export const expect: Expect;
  export function defineConfig(config: Config): Config;
  export const devices: Record<string, Record<string, unknown>>;
  export type { Page, Locator, Route, Request, APIRequestContext, APIResponse, BrowserContext, TestType };
}
`
