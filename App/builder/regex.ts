/**
 * Create a selection for a tag
 * @param tag the tag we want select
 */
export function regexHtmlTag(tag: string): RegExp {
    const rege = `<\s*${tag}(\s.*)*>((.|\n|\r|\t)*)<\/\s*${tag}(\s.*)*>`;
    return new RegExp(rege, "g");
}

/**
 * Get the file name of a given path
 * @param path the path file who we want to extract the file name
 * @param extension keep the extension
 */
export function fileNameOfPath(path: string, extension: boolean = true): string {
    const fileName = (/([^\/\\]+)\.\w+$/g).exec(path);
    if (fileName === null || fileName.length <= 0) return "";
    return fileName[extension ? 0 : 1];
}