import { Application, send } from "https://deno.land/x/oak@v6.3.0/mod.ts";
import { VueBuilder } from "./App/builder/vueBuilder.ts";
import { CssBuilder } from "./App/builder/cssBuilder.ts";
import { JsBuilder } from "./App/builder/jsBuilder.ts";
import { IoSystem } from "./App/websocket/Websocket.ts";

function staticPath(path: string) : string {
    const os = Deno.env.get("OS");
    return new URL(path, import.meta.url).href.replace('file:///', os?.includes("Windows") ? '' : '/');
}

const app = new Application();

app.use(async (context) => {
    await send(context, context.request.url.pathname, {
        root: `${Deno.cwd()}/static`,
        index: "index.html",
    }).catch(async () => {
        await send(context, context.request.url.pathname, {
            root: `${Deno.cwd()}/build`,
        });
        context.response.headers.set("content-type", 'application/javascript; charset=utf-8');
    });
});

const io = new IoSystem();

io.on("connection", (socket : any) => {
    console.log("New connection", socket ? true : false);
});

const vueBuilder = new VueBuilder(
	staticPath("./src/"),
	staticPath("./build/"),
);

const cssBuilder = new CssBuilder(
    staticPath("./src/"),
    staticPath("./build/"),
);

const jsBuilder = new JsBuilder(
    staticPath("./src/"),
    staticPath("./build/"),
);

vueBuilder.addListener("builded", () => {
    io.emit("reload:system");
});

cssBuilder.addListener("builded", () => {
    io.emit("reload:system");
});

jsBuilder.addListener("builded", () => {
    io.emit("reload:system");
});


await app.listen({ port: 8000 });
