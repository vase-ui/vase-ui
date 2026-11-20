/**
 * The `##` sections that a Base UI page has besides those of the template, by family. Each has the
 * title of the Base UI page. A section that comes after Examples on that page is in `AFTER_EXAMPLES`.
 */
export const TOPIC_SECTIONS: Readonly<Record<string, readonly string[]>> = {
  autocomplete: ['Item values'],
  avatar: ['Optimized and lazy-loaded images'],
  combobox: ['Item values'],
  'csp-provider': ['Supplying a nonce', 'Disable inline style elements', 'Inline style attributes'],
  'locale-provider': ['Which locale a part uses'],
  'navigation-menu': ['Closing animations'],
  select: ['Positioning'],
  toast: ['General usage', 'Global manager', 'Stacking and animations'],
  tooltip: ['Alternatives to tooltips'],
};

const AFTER_EXAMPLES = new Set(['Closing animations']);

const DIFFERENCES = 'Differences from Base UI';
const DIFFERENCES_TAG = '<BaseUiDifferences />';
const API_REFERENCE = 'API reference';
const API_REFERENCE_TAG = /<ApiReference\s*\/>/g;
const FENCE = /^\s*(```|~~~)/;
const HEADING = /^## (.+?)\s*$/;

/** The `##` sections of a family page, in their sequence, for `family`. */
export function pageSectionsOf(family: string, own: boolean): string[] {
  const topics = TOPIC_SECTIONS[family] ?? [];
  return [
    'Usage guidelines',
    'Anatomy',
    ...topics.filter((topic) => !AFTER_EXAMPLES.has(topic)),
    'Examples',
    ...topics.filter((topic) => AFTER_EXAMPLES.has(topic)),
    ...(own ? ['Keyboard'] : []),
    API_REFERENCE,
    DIFFERENCES,
  ];
}

/** The `##` sections of a Markdown text with the lines below each heading. A code block holds no heading. */
function readSections(text: string): { title: string; body: string }[] {
  const sections: { title: string; lines: string[] }[] = [];
  let fence: string | undefined;
  for (const line of text.split(/\r?\n/)) {
    const marker = FENCE.exec(line)?.[1];
    if (marker !== undefined) {
      fence = fence === undefined ? marker : fence === marker ? undefined : fence;
    }
    const title = fence === undefined ? HEADING.exec(line)?.[1] : undefined;
    if (title !== undefined) {
      sections.push({ title, lines: [] });
    } else {
      sections.at(-1)?.lines.push(line);
    }
  }
  return sections.map(({ title, lines }) => ({ title, body: lines.join('\n') }));
}

/**
 * The problems of the `##` sections of the page `path` of `family`, against the page template.
 * `own` says whether the family is a component of Vase UI's own.
 */
export function checkPageSections(
  path: string,
  family: string,
  own: boolean,
  text: string,
): string[] {
  const allowed = pageSectionsOf(family, own);
  const sections = readSections(text);
  const problems: string[] = [];
  let place = -1;
  for (const { title, body } of sections) {
    const index = allowed.indexOf(title);
    if (index === -1) {
      problems.push(
        title === 'Keyboard'
          ? `${path}: "## Keyboard" is only on the page of a component of Vase UI's own. Write each key that a prop controls in the JSDoc of that prop.`
          : `${path}: "## ${title}" is not a section of the page template. Use these sections, in this sequence: ${allowed.join(', ')}. A section of the Base UI page that the template lacks goes in TOPIC_SECTIONS of scripts/docs/pageSections.ts, with the title of the Base UI page.`,
      );
      continue;
    }
    if (index <= place) {
      problems.push(
        `${path}: "## ${title}" is out of place. Put the sections in this sequence: ${allowed.join(', ')}.`,
      );
    }
    place = Math.max(place, index);
    if (title === API_REFERENCE && (body.match(API_REFERENCE_TAG) ?? []).length !== 1) {
      problems.push(
        `${path}: "## ${API_REFERENCE}" needs one <ApiReference /> with no name, before the ### sections of its functions and types.`,
      );
    }
  }
  if (!sections.some(({ title }) => title === API_REFERENCE)) {
    problems.push(
      `${path}: the page has no "## ${API_REFERENCE}". Write it before "## ${DIFFERENCES}", with <ApiReference /> in it.`,
    );
  }
  const last = sections.at(-1);
  if (last?.title !== DIFFERENCES || last.body.trim() !== DIFFERENCES_TAG) {
    problems.push(
      `${path}: the last section must be "## ${DIFFERENCES}" with only ${DIFFERENCES_TAG} in it. The parity files give its rows.`,
    );
  }
  return problems;
}
