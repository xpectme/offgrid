import { AppResponse } from "./AppResponse.ts";
import { HttpError } from "./HttpError.ts";
import { Renderer } from "./Renderer.ts";
import { Status } from "./Status.ts";
import { rendererDefault } from "./rendererDefault.ts";

export class Context<State = Record<string, unknown>> {
  params: Record<string, string>;
  request: Request;
  response: AppResponse = {};
  state = {} as State;
  #renderer: Renderer;

  #response!: Promise<Response>;

  constructor(
    params: Record<string, string>,
    request: Request,
    renderer?: Renderer,
  ) {
    this.params = params;
    this.request = request;
    this.#renderer = renderer ?? rendererDefault;
  }

  getResponse(): Promise<Response> {
    return this.#response ?? Promise.resolve(new Response());
  }

  render(template: string, data: Record<string, unknown> = {}): void {
    this.#response = this.#renderer(template, data, this);
  }

  assert(condition: boolean, status: Status, message?: string) {
    if (!condition) {
      throw new HttpError(status, message);
    }
  }

  throws(status: Status, message?: string) {
    throw new HttpError(status, message);
  }
}
