import { Method, Router } from "../deps.ts";
import { Context } from "./application/Context.ts";
import { Handler } from "./application/Handler.ts";
import { HttpError } from "./application/HttpError.ts";
import { Renderer } from "./application/Renderer.ts";
import { Status } from "./application/Status.ts";

export class Application extends Router<Handler> {
  #errorRoutes = new Map<Status, Handler>();
  #renderer!: Renderer;

  get errorRoutes() {
    return this.#errorRoutes;
  }

  constructor() {
    super();
  }

  renderEngine(renderer: Renderer) {
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
    const match = this.match(request.method as Method, pathname);

    if (match) {
      const context = new Context(match.params, request, this.#renderer);

      event.respondWith((async () => {
        try {
          // call the route handler
          const response = await match.handler(context);
          return response;
        } catch (error) {
          // get the route handler for the error status
          const handler = error instanceof HttpError
            ? this.errorRoutes.get(error.status)
            : this.errorRoutes.get(Status.InternalServerError);

          if (handler) {
            // set the error on the context, so the handler can access it
            // deno-lint-ignore no-explicit-any
            (context.state as any).error = error;

            // call the handler
            return handler(context);
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
