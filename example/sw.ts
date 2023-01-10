import createApplication from "../lib/Application.ts";
import { Context } from "../lib/application/Context.ts";

const app = createApplication();

app.get("/example/test", (context: Context) => {
  context.render("templates/test.html", {
    title: "Hello, world!",
    content: "This is a text.",
  });
});

app.get("/example/test2", (context: Context) => {
  context.response.headers = new Headers({
    "Content-Type": "text/html",
  });
  context.render("templates/test.html", {
    title: "Hello, universe!",
    content: "Some other text.",
  });
});

globalThis.addEventListener("fetch", (event) => {
  app.listen(event);
});
