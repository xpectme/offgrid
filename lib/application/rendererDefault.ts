import { Context } from "./Context.ts";
import { Status } from "./Status.ts";

export async function rendererDefault<State>(
  template: string,
  data: Record<string, unknown>,
  context: Context<State>,
) {
  const response = await fetch(template);
  const html = await response.text();
  const result = html.replace(/\${([^}]+)}/g, (_, key) => {
    const replacement = data[key as keyof typeof data] as string;

    // sanitize replacement for HTML
    return replacement
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  });

  const headers = new Headers(context.response.headers);
  if (headers.get("Content-Type") === null) {
    headers.set("Content-Type", "text/html");
  }

  const status = context.response.status ?? Status.OK;
  return new Response(result, { headers, status });
}
