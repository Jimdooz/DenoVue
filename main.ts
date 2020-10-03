import { Application, send } from "https://deno.land/x/oak@v6.3.0/mod.ts";
import { VueBuilder } from "./App/builder/vueBuilder.ts";
import { CssBuilder } from "./App/builder/cssBuilder.ts";
import { JsBuilder } from "./App/builder/jsBuilder.ts";
import { IoSystem } from "./App/websocket/Websocket.ts";

const app = new Application();


await Deno.mkdir("./build", { recursive: true });
await Deno.mkdir("./src", { recursive: true });

const srcPath = await Deno.realPath("./src");
const buildPath = await Deno.realPath("./build");

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
    //TODO
});

const vueBuilder = new VueBuilder( srcPath, buildPath );
const cssBuilder = new CssBuilder( srcPath, buildPath );
const jsBuilder = new JsBuilder( srcPath, buildPath );

vueBuilder.addListener("builded", () => {
    io.emit("reload:system");
});

cssBuilder.addListener("builded", () => {
    io.emit("reload:system");
});

jsBuilder.addListener("builded", () => {
    io.emit("reload:system");
});

const port = 8000;

console.log("Dev server running at:");
console.log(`> Local : %chttp://localhost:%c${port}/`, "color: #49a1ef", "color: #87c2f7");

await app.listen({ port });
