import { getTextFormat, type TextFormat } from '$shared/contentTypeUtils';
import { highlightJsonToken } from '$lib/editor/languages/jsonHighlighting.js';
import { highlightXmlToken } from '$lib/editor/languages/xmlHighlighting.js';
import { highlightHtmlToken } from '$lib/editor/languages/htmlHighlighting.js';
import { highlightPlainToken } from '$lib/editor/languages/plainHighlighting.js';

type HighlightFunction = (stream: any) => string | null;

const HIGHLIGHTERS: Record<TextFormat, HighlightFunction> = {
    json: highlightJsonToken,
    xml: highlightXmlToken,
    html: highlightHtmlToken
};

export function getHighlighterForContentType(contentType: string | null): HighlightFunction {
    const format = getTextFormat(contentType);
    return format ? HIGHLIGHTERS[format] : highlightPlainToken;
}
