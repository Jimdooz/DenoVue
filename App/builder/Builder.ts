import { walk, exists } from "https://deno.land/std@v0.72.0/fs/mod.ts";
import { Emitter } from "../utilities/Emitter.ts";
import { fileNameOfPath } from "./regex.ts";

export interface BuilderOptions {
    watch? : boolean,
    minify?: boolean,
    extensions?: {[index:string] : string},
}

export const defaultOptions : BuilderOptions = {
    watch: true,
    minify: true,
    extensions : {},
}

export abstract class Builder extends Emitter {
    protected stopWatch: boolean = false;
    protected directoryRes: string;
    protected directoryBuild: string;
    protected options: BuilderOptions;

    constructor(directoryRes: string, directoryBuild: string, options: BuilderOptions = defaultOptions){
        super();
        this.options = {...defaultOptions, ...options};
        if (this.options.watch) this.watchSystem(directoryRes);

        this.directoryRes = directoryRes;
        this.directoryBuild = directoryBuild;
        this.options = options;

        this.buildRecursive(true);
    }

    protected async watchSystem(path: string) {
        const watcher = Deno.watchFs(path);

        for await (const event of watcher) {
            if (this.stopWatch) break;
            if (event.kind == "modify" || event.kind == "create") {
                if (event.paths.length == 1) {
                    await this.buildRecursive();
                }
            }
        }
    }

    async buildRecursive(force: boolean = false) {
        let changementsDone = false;

        for await (const entry of walk(this.directoryRes)) {
            const extension = await getExtension(entry.name);
            if (entry.isFile && this.options.extensions && this.options.extensions[extension]) {
                const staticPath = await Deno.realPath(new URL(entry.path, this.directoryRes).href);
                const staticPathBuild = await getPathBuild(staticPath, this.directoryRes, this.directoryBuild, this.options);
                const fileExist = await exists(staticPathBuild);

                if (force) {
                    await this.buildAndSave(staticPath, staticPathBuild);
                } else {
                    if (!fileExist) {
                        await this.buildAndSave(staticPath, staticPathBuild);
                        changementsDone = true;
                    }
                    else {
                        const fileRes = await Deno.open(staticPath, { read: true });
                        const fileInfoRes = await Deno.fstat(fileRes.rid);

                        const fileBuild = await Deno.open(staticPathBuild, { read: true });
                        const fileInfoBuild = await Deno.fstat(fileBuild.rid);

                        if (fileInfoRes.mtime && fileInfoBuild.mtime) {
                            if (fileInfoRes.mtime > fileInfoBuild.mtime) {
                                await this.buildAndSave(staticPath, staticPathBuild);
                                changementsDone = true;
                            }
                        } else {
                            await this.buildAndSave(staticPath, staticPathBuild);
                            changementsDone = true;
                        }
                    }
                }
            }
        }

        if (changementsDone) {
            //Emit new Changements
            this.propage("builded");
        }
    }

    abstract async buildAndSave(fileRes: string, fileSave: string) : Promise<boolean>;

    async stop() {
        this.stopWatch = true;
    }

    async start() {
        if(this.stopWatch){
            this.watchSystem(this.directoryRes);
        }
        this.stopWatch = true;
    }
}

async function getPathBuild(pathFile: string, directoryRes: string, directoryBuild: string, options: BuilderOptions) {
    const pathBuildFile = pathFile.replace(directoryRes, directoryBuild);
    const filename = fileNameOfPath(pathBuildFile, false);
    const filenameExtension = fileNameOfPath(pathBuildFile);
    const directorySave = pathBuildFile.replace(filenameExtension, '');
    const extensionFile = await getExtension(pathFile);
    if (!options.extensions || !options.extensions[extensionFile]) throw "Extension not supported";
    const extensionBuild = options.extensions[extensionFile];
    return `${directorySave}${filename}.${extensionBuild}`;
}

async function getExtension(path: string) : Promise<string> {
    const split = path.split(".");
    return split[split.length - 1];
}