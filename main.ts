import { Application, send } from "https://deno.land/x/oak@v6.3.0/mod.ts";
import { VueBuilder } from "./builder/vueBuilder.ts";

function staticPath(path: string) : string {
    return new URL(path, import.meta.url).href.replace('file:///', '/');
}

const app = new Application();

app.use(async (context) => {
    await send(context, context.request.url.pathname, {
        root: `${Deno.cwd()}/static`,
        index: "index.html",
    });
});


const vueBuilder = new VueBuilder(
	staticPath("./src/components/"),
	staticPath("./build/components/"),
	{ watch: true }
);

await app.listen({ port: 8000 });
