import { apiPartId } from '../../docs/.vitepress/components/apiPartId.ts';
import type { ApiReference } from './apiReference.ts';

// The outline of the default theme leaves out an element with the class `ignore-header`, such as
// the heading badge. The index does the same, so the badge word is not in the title of a result.
const IGNORE_HEADER_SPAN = /\s*<span class="[^"]*\bignore-header\b[^"]*">[^<]*<\/span>/g;
const API_REFERENCE_TAG = /<ApiReference\b([^>]*?)\/>/g;
const NAME_ATTRIBUTE = /\sname="([^"]*)"/;

interface Row {
  name: string;
  description: string;
}

// A text of the reference can hold `<`, `>` and `&`, such as "Renders a `<div>` element". VitePress
// removes each piece of text that reads as a tag, so the index would lose the word `div`.
function escapeHtml(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function paragraph(description: string, ...tables: Row[][]): string {
  const rows = tables.flat().map(({ name, description: text }) => `${name} ${text}`);
  return `<p>${escapeHtml([description, ...rows].join('\n'))}</p>`;
}

/**
 * The HTML that the index reads in the place of one `<ApiReference />`. VitePress makes one section
 * from each heading that holds a link to `#<id>`, and the result of the section opens that id. Each
 * part is thus one section, and its result opens the heading that `ApiReference.vue` renders. The
 * index has names and descriptions, not types.
 *
 * With a `name`, the page writes the heading, so the text has no heading and goes to the section
 * of that heading.
 */
export function apiReferenceSearchHtml(reference: ApiReference, name?: string): string {
  if (name === undefined) {
    return reference.parts
      .map(
        (part) =>
          `<h3>${escapeHtml(part.name)} <a href="#${apiPartId(part.name)}"></a></h3>\n${paragraph(
            part.description,
            part.props,
            part.events,
            part.slots,
            part.exposed,
            part.dataAttributes,
            part.cssVariables,
          )}`,
      )
      .join('\n');
  }
  const apiFunction = reference.functions.find((item) => item.name === name);
  const apiClass = reference.classes.find((item) => item.name === name);
  const apiType = reference.types.find((item) => item.name === name);
  return paragraph(
    apiFunction?.returns.description ?? '',
    apiFunction?.parameters ?? [],
    apiClass?.properties ?? [],
    apiClass?.methods.map((method) => ({
      name: method.name,
      description: `${method.description} ${method.returns.description}`,
    })) ?? [],
    apiClass?.methods.flatMap((method) => method.parameters) ?? [],
    apiType?.properties ?? [],
    apiType?.values.map((value) => ({ name: value, description: '' })) ?? [],
  );
}

/**
 * The HTML of a page as the index reads it. `html` is the page from the Markdown renderer.
 * `reference` is the API reference of the family of the page, or `undefined` for another page.
 */
export function searchIndexHtml(html: string, reference: ApiReference | undefined): string {
  const text = html.replaceAll(IGNORE_HEADER_SPAN, '');
  return reference === undefined
    ? text
    : text.replaceAll(API_REFERENCE_TAG, (_tag, attributes: string) =>
        apiReferenceSearchHtml(reference, NAME_ATTRIBUTE.exec(attributes)?.[1]),
      );
}
