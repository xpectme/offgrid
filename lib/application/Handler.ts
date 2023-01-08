import { Context } from "./Context.ts";

export interface Handler<State = Record<string, unknown>> {
  (context: Context<State>): Promise<Response>;
}
