import { minify } from "./minify.ts";
import { regexHtmlTag } from "./regex.ts";

const minifyOptions = { module: true, compress: true, mangle: true };

/**
 * Convert a .vue file into a module script
 * @param path the path of the file to be build
 */
export async function compileVue(path: string){
    console.log(`Demande de la compilation du fichier ${path}`);
    let vueFile : string = await Deno.readTextFile(path);
    if (vueFile.length == 0) throw "The file is empty";

    const reScript = regexHtmlTag("script");
    const reStyle = regexHtmlTag("style");
    
    const template = await getTemplate(vueFile);
    const script = await getScript(vueFile);
    const style = await getStyle(vueFile).catch(_ => '');

    const concatenate = await concatenateVueSystem(template, script, style);
    const minification = minify(concatenate, minifyOptions);
    if (!minification.error){
        return minification.code;
    }
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

function cleanWhiteSpace(value: string) : string {
    return value.replace(/\r?\n|\r/g, ' ').replace(/(?:\s)\s/g, "")
}

async function concatenateVueSystem(template: string, script: string, style: string) : Promise<string> {
    const concatenate = script.replace(/export default\s*{/g, `${await convertStyleToJs(style)};\nexport default { template : \`${template}\`,`);
    return concatenate;
}

async function convertStyleToJs(style: String): Promise<string>{
    return `
      const styleSheet = document.createElement("style")
      styleSheet.type = "text/css"
      styleSheet.innerText = \`${style.trim()}\`
      document.head.appendChild(styleSheet)
    `;
}