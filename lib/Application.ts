import { Router } from "../deps.ts";
import { Context } from "./application/Context.ts";
import { Handler } from "./application/Handler.ts";
import { HttpError } from "./application/HttpError.ts";
import { Renderer } from "./application/Renderer.ts";
import { Status } from "./application/Status.ts";

declare global {
  interface Router {
    get(path: string, handler: Handler): void;
    post(path: string, handler: Handler): void;
    put(path: string, handler: Handler): void;
    delete(path: string, handler: Handler): void;
    patch(path: string, handler: Handler): void;
  }
}

export class Application extends Router {
  #errorRoutes = new Map<Status, Handler>();
  #renderer!: Renderer;
  #logger = console;
  #appState: Record<string, unknown> = {};

  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  trace: (...args: unknown[]) => void;

  get errorRoutes() {
    return this.#errorRoutes;
  }

  constructor() {
    super();
    const log =
      (method: "log" | "info" | "warn" | "error" | "trace") =>
      (...args: unknown[]) => this.#logger[method](...args);
    this.debug = log("log");
    this.info = log("info");
    this.warn = log("warn");
    this.error = log("error");
    this.trace = log("trace");
  }

  set(prop: string, value: unknown) {
    this.#appState[prop] = value;
  }

  setLogger(logger: Console) {
    this.#logger = logger;
  }

  setRenderEngine(renderer: Renderer) {
    this.#renderer = renderer as Renderer;
  }

  handleError<State extends { error: Error }>(
    status: Status,
    handler: Handler<State>,
  ) {
    this.#errorRoutes.set(status, handler as Handler);
  }

  listen(event: FetchEvent) {
    const request = event.request;
    const { pathname } = new URL(request.url);
    const match = this.match(request.method, pathname);

    if (match) {
      const context = new Context(match.params, request, this.#renderer);
      context.state = this.#appState;
      event.respondWith((async () => {
        try {
          this.info(`DONE: ${match.method} ${match.path}`, match.params);

          // call the route handler
          await match.handler(context);
          return context.getResponse();
        } catch (error) {
          this.warn(`FAIL: ${match.method} ${match.path}`, match.params);

          // get the route handler for the error status
          const handler = error instanceof HttpError
            ? this.errorRoutes.get(error.status)
            : this.errorRoutes.get(Status.InternalServerError);

          if (handler) {
            // set the error on the context, so the handler can access it
            // deno-lint-ignore no-explicit-any
            (context.state as any).error = error;

            // call the handler
            try {
              await handler(context);
              return context.getResponse();
            } catch (error) {
              this.error(`Error handler failed to respond!`);
              this.trace(error);
              // if the handler throws, return a generic error response
              return new Response(error.message, {
                status: Status.InternalServerError,
              });
            }
          }

          // otherwise, return a generic error response
          return new Response(error.message, { status: error.status });
        }
      })());
    }
  }
}

export function createApplication() {
  return new Application();
}

export default createApplication;
