/**
 * The `id` of the developer. HTML gives an id no white space, and white space separates the ids of
 * `aria-labelledby`, so an `id` of white space only counts as no `id`.
 */
export function givenId(id: string | undefined): string | undefined {
  return id?.trim() ? id : undefined;
}
