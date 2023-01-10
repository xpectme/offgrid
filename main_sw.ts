import createApplication from "./lib/Application.ts";
import { Context } from "./lib/application/Context.ts";

const app = createApplication();

app.get("/test", (context: Context) => {
  context.render("templates/test.html", {
    title: "Hello, world!",
    content: "This is a test.",
  });
});

addEventListener("fetch", (event) => {
  app.listen(event);
});
