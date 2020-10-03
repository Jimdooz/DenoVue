import { Builder } from "./Builder.ts";
import type { BuilderOptions } from "./Builder.ts";
import { fileNameOfPath } from "./regex.ts";
import { minify } from "./minify.ts";

//Minify options for minify function
const minifyOptions = { module: true, compress: true, mangle: true };

interface CssBuilderOption extends BuilderOptions {}

export class CssBuilder extends Builder {
    constructor(directoryRes: string, directoryBuild: string, options: CssBuilderOption = {}) {
        super(directoryRes, directoryBuild, options);

        options.extensions = {
            'css': 'css'
        }
    }

    async buildAndSave(fileRes: string, fileSave: string): Promise<boolean> {
        await buildAndSave(fileRes, fileSave);
        return true;
    }
}

async function buildAndSave(fileRes: string, fileSave: string) {
    const filenameExtension = fileNameOfPath(fileSave);
    const directoryBuild = fileSave.replace(filenameExtension, '');
    await Deno.mkdir(directoryBuild, { recursive: true });
    const buildedContent = await compileCss(fileRes);

    await Deno.writeTextFile(fileSave, buildedContent);
}

/**
 * Convert a .vue file into a module script
 * @param path the path of the file to be build
 */
export async function compileCss(path: string): Promise<string> {
    let cssFile: string = await Deno.readTextFile(path);

    let content = `import { addStyle } from "/client.mjs";
    const css = \`${cssFile}\`
    addStyle(css);
    export default css;`;

    const minifyContent = minify(content, minifyOptions);

    if(minifyContent.error) throw minifyContent.error;
    return minifyContent.code ? minifyContent.code : '';
}