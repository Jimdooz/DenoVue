/**
 * Create a selection for a tag
 * @param tag the tag we want select
 */
export function regexHtmlTag(tag: string): RegExp {
    const rege = `<\s*${tag}(\s.*)*>((.|\n|\r|\t)*)<\/\s*${tag}(\s.*)*>`;
    return new RegExp(rege, "g");
}