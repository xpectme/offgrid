import { Context } from "./Context.ts";

export interface Renderer {
  <State = Record<string, unknown>>(
    template: string,
    data: Record<string, unknown>,
    context: Context<State>,
  ): Response;
}
