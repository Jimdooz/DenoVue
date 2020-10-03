import { Builder } from "./Builder.ts";
import type { BuilderOptions } from "./Builder.ts";

import { minify } from "./minify.ts";
import { regexHtmlTag, fileNameOfPath } from "./regex.ts";

//Minify options for minify function
const minifyOptions = { module: true, compress: true, mangle: true };

interface VueBuilderOption extends BuilderOptions {
}

export class VueBuilder extends Builder {

    constructor(directoryRes: string, directoryBuild: string, options: VueBuilderOption = {}){
        super(directoryRes, directoryBuild, options);

        options.extensions = {
            'vue' : 'mjs'
        }
    }
    
    async buildAndSave(fileRes: string, fileSave: string): Promise<boolean> {
        await buildAndSave(fileRes, fileSave);
        return true;
    }
}

async function buildAndSave(pathFile: string, pathSave: string) {    
    const filenameExtension = fileNameOfPath(pathSave);
    const directoryBuild = pathSave.replace(filenameExtension, '');
    await Deno.mkdir(directoryBuild, { recursive: true });

    const buildedContent = await compileVue(pathFile);
    
    await Deno.writeTextFile(pathSave, buildedContent);
}

/**
 * Convert a .vue file into a module script
 * @param path the path of the file to be build
 */
export async function compileVue(path: string): Promise<string> {
    let vueFile : string = await Deno.readTextFile(path);
    if (vueFile.length == 0) throw "The file is empty";

    const reScript = regexHtmlTag("script");
    const reStyle = regexHtmlTag("style");
    
    const template = await getTemplate(vueFile);
    const script = await getScript(vueFile);
    const style = await getStyle(vueFile).catch(_ => '');

    const concatenate = await concatenateVueSystem(template, script, style);
    const minification = minify(concatenate, minifyOptions);

    if (minification.error) throw minification.error;

    return minification.code ? minification.code : '';
}

/**
 * Extract the template element of a vue file
 * @param content the vue content
 */
async function getTemplate(content: string): Promise<string> {
    const regexTemplate = regexHtmlTag("template");
    const test = regexTemplate.exec(content);

    if(test == null) throw "No template defined";
    return cleanWhiteSpace(test[2]).replace(/`/g, '\\`').replace(/\$/g, '\\\$');
}

/**
 * Extract the script element of a vue file
 * @param content the vue content
 */
async function getScript(content: string): Promise<string> {
    const regexScript = regexHtmlTag("script");
    const test = regexScript.exec(content);

    if (test == null) throw "No script defined";
    return test[2];
}

/**
 * Extract the style element of a vue file
 * @param content the vue content
 */
async function getStyle(content: string): Promise<string> {
    const regexStyle = regexHtmlTag("style");
    const test = regexStyle.exec(content);

    if (test == null) throw "No style defined";
    return cleanWhiteSpace(test[2]).replace(/`/g, '\\`').replace(/\$/g, '\\\$');
}

/**
 * Remove white space in clean way
 * @param value the value to be clean
 */
function cleanWhiteSpace(value: string) : string {
    return value.replace(/\r?\n|\r/g, ' ').replace(/(?:\s)\s/g, "")
}

/**
 * Concatenate the 3 part of vue file, template, script and style
 * @param template the template part
 * @param script the script part
 * @param style the style part
 */
async function concatenateVueSystem(template: string, script: string, style: string) : Promise<string> {
    const concatenate = (style ? 'import { addStyle } from "/client.mjs";' : '') +script.replace(/export default\s*{/g, `${await convertStyleToJs(style)};\nexport default { template : \`${template}\`,`);
    return concatenate;
}

/**
 * Convert a style string to a javascript injection
 * @param style the style content
 */
async function convertStyleToJs(style: String): Promise<string>{
    return style ? `addStyle(\`${style.trim()}\`)` : '';
    // return `
    //   const styleSheet = document.createElement("style")
    //   styleSheet.type = "text/css"
    //   styleSheet.innerText = \`${style.trim()}\`
    //   document.head.appendChild(styleSheet)
    // `;
}
