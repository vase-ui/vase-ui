/**
 * The id of the heading of a part in the API reference, such as `api-dialog-root` for
 * `Dialog.Root`. `ApiReference.vue` gives the heading this id, and the search index links to it, so
 * a result of the search opens that heading. The rule has a module of its own, because the script
 * of the index cannot import an SFC.
 */
export function apiPartId(name: string): string {
  // The prefix makes the id different from the slug of a Markdown heading, such as the page title.
  return `api-${name.toLowerCase().replaceAll('.', '-')}`;
}
