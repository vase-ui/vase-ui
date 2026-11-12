import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPOSITORY_ROOT } from '../parity/repository.ts';
import { readContributors, readDisplayNames, readNewestCommit } from './github.ts';
import type { Contributor, UnlinkedAuthor } from './github.ts';

export interface Project {
  repository: string;
  title: string;
  relation: string;
}

/** A person with an account. `name` is the display name of the account. */
export interface Person {
  login: string;
  name: string | null;
}

export interface UnlinkedPerson {
  name: string;
}

export interface ProjectSection extends Project {
  commit: string;
  /** A person with no account has no `login`. */
  people: (Person | UnlinkedPerson)[];
}

export const PROJECTS: Project[] = [
  { repository: 'mui/base-ui', title: 'Base UI', relation: 'Vase UI is a port of Base UI.' },
  {
    repository: 'floating-ui/floating-ui',
    title: 'Floating UI',
    relation: 'Base UI ported its popup modules from Floating UI.',
  },
  {
    repository: 'theKashey/aria-hidden',
    title: 'aria-hidden',
    relation: 'Base UI ported `markOthers` from aria-hidden.',
  },
];

// GitHub lists these automation accounts as `User`. `l10nbot` commits the Crowdin updates of
// mui/base-ui. The public profiles of `mui-bot` and `renovate-bot` say that they are bots.
const AUTOMATION_LOGINS = new Set(['l10nbot', 'mui-bot', 'renovate-bot']);
// Automation that commits under a plain name, with no `[bot]` ending.
const AUTOMATION_AUTHORS = new Set(['dependabot', 'github-actions', 'renovate']);

const LOGIN = /^[A-Za-z0-9-]+$/;
// A display name is text that a stranger controls, and the site compiles this file as a Vue
// template. This pattern rejects `{{ }}`, HTML, Markdown syntax and `@`. A mark acts on the
// character before it, so a name starts with a letter or a number.
const DISPLAY_NAME = /^[\p{L}\p{N}][\p{L}\p{M}\p{N} .'’-]*$/u;
// A long name can hold a message to the readers of the page, and a stack of marks can cover the
// lines around it. So a name has at most 100 characters and at most three marks in a row.
const MAX_NAME_LENGTH = 100;
const FOUR_MARKS_IN_A_ROW = /\p{M}{4}/u;
// A name with no link is the plain text of a list item. There, `- 1. Example` is an ordered list
// (CommonMark), and `- www.example.com` is a link on github.com (GitHub Flavored Markdown).
// So each dot must follow a letter and precede a space or the end of the name.
const PLAIN_TEXT_DOTS = /^(?:[^.]|(?<=\p{L}\p{M}*)\.(?=$| ))*$/u;

const OPENING =
  'Vase UI is a port, so the people on this page did the hard part before we started. They spent years on focus management, screen readers and browser bugs. We carried their work across, and we thank each of them.';

/** The reason to remove an account from the lists, or `undefined` for an account that stays. */
export function automationRule({
  login,
  type,
}: Pick<Contributor, 'login' | 'type'>): string | undefined {
  if (type === 'Bot') {
    return 'its type is Bot';
  }
  if (login.endsWith('[bot]')) {
    return 'its login ends with [bot]';
  }
  if (AUTOMATION_LOGINS.has(login.toLowerCase())) {
    return 'its login is in AUTOMATION_LOGINS';
  }
  return undefined;
}

function compareCodeUnits(a: string, b: string): number {
  if (a < b) {
    return -1;
  }
  return a > b ? 1 : 0;
}

export function sortContributors<
  T extends Pick<Contributor, 'contributions'> & (Pick<Person, 'login'> | UnlinkedPerson),
>(contributors: T[]): T[] {
  // `localeCompare` depends on the ICU data of the machine.
  // Code units give the same order on each machine.
  const key = (person: Pick<Person, 'login'> | UnlinkedPerson) =>
    ('login' in person ? person.login : person.name).toLowerCase();
  return [...contributors].sort(
    (a, b) => b.contributions - a.contributions || compareCodeUnits(key(a), key(b)),
  );
}

// NFC puts a letter and its marks in one character where Unicode has one. So the two forms of a
// name have one text, and the check of the marks counts only the marks that remain.
function cleanName(name: string | null): string {
  return (name ?? '').trim().replace(/\s+/g, ' ').normalize('NFC');
}

function isDisplayName(name: string): boolean {
  return (
    name.length <= MAX_NAME_LENGTH && DISPLAY_NAME.test(name) && !FOUR_MARKS_IN_A_ROW.test(name)
  );
}

function isPlainText(name: string): boolean {
  return isDisplayName(name) && PLAIN_TEXT_DOTS.test(name);
}

export function profileLink({ login, name }: Person, repository: string): string {
  if (!LOGIN.test(login)) {
    throw new Error(
      `${repository} has the contributor ${JSON.stringify(login)}. A GitHub login has only letters, numbers and hyphens, so the script cannot make a link to this profile. If the account is automation, add its lower-case login to AUTOMATION_LOGINS in scripts/thanks/render.ts. If not, correct LOGIN in the same file.`,
    );
  }
  const displayName = cleanName(name);
  const text = isDisplayName(displayName) ? displayName : login;
  return `[${text}](https://github.com/${login})`;
}

function plainName({ name }: UnlinkedPerson, repository: string): string {
  const cleaned = cleanName(name);
  if (!isPlainText(cleaned)) {
    throw new Error(
      `${repository} has a person with no account, and the page cannot show the name as plain text. The script writes such a name only when isPlainText in scripts/thanks/render.ts accepts it. If THANKS.md has a line that the script did not write, run \`pnpm thanks:render\`. If not, correct selectUnlinkedPeople in the same file.`,
    );
  }
  return cleaned;
}

// The entry with the most commits gives the spelling. For equal commits, the first spelling by code
// units wins, so the result does not depend on the sequence of the rows.
function mergeAuthors(entries: UnlinkedAuthor[]): UnlinkedAuthor {
  const [first] = [...entries].sort(
    (a, b) => b.contributions - a.contributions || compareCodeUnits(a.name, b.name),
  );
  return {
    name: first.name,
    contributions: entries.reduce((sum, { contributions }) => sum + contributions, 0),
  };
}

interface UnlinkedSelection {
  people: UnlinkedAuthor[];
  automation: number;
  sameAsLinked: number;
  notPlainText: number;
  mergedByName: number;
}

export function selectUnlinkedPeople(
  unlinkedAuthors: UnlinkedAuthor[],
  linkedPeople: Person[],
): UnlinkedSelection {
  const linkedNames = new Set(
    linkedPeople
      .flatMap(({ login, name }) => [login, cleanName(name)])
      .filter((value) => value !== '')
      .map((value) => value.toLowerCase()),
  );
  const entriesByName = new Map<string, UnlinkedAuthor[]>();
  const counts = { automation: 0, sameAsLinked: 0, notPlainText: 0 };
  let entryCount = 0;
  // A name that matches a linked person is on the page already. That test comes before the test of
  // the name, so `notPlainText` counts only the people who are missing from the page.
  for (const { name, contributions } of unlinkedAuthors) {
    const cleaned = cleanName(name);
    const key = cleaned.toLowerCase();
    if (key.endsWith('[bot]') || AUTOMATION_LOGINS.has(key) || AUTOMATION_AUTHORS.has(key)) {
      counts.automation += 1;
    } else if (linkedNames.has(key)) {
      counts.sameAsLinked += 1;
    } else if (!isPlainText(cleaned)) {
      counts.notPlainText += 1;
    } else {
      entryCount += 1;
      entriesByName.set(key, [...(entriesByName.get(key) ?? []), { name: cleaned, contributions }]);
    }
  }
  const people = [...entriesByName.values()].map(mergeAuthors);
  return { people, ...counts, mergedByName: entryCount - people.length };
}

function listItem(person: Person | UnlinkedPerson, repository: string): string {
  const text = 'login' in person ? profileLink(person, repository) : plainName(person, repository);
  return `- ${text}`;
}

export function renderThanks({
  readOn,
  projects,
}: {
  readOn: string;
  projects: ProjectSection[];
}): string {
  const sections = projects.map(({ repository, title, relation, commit, people }) =>
    [
      `## ${title}`,
      `The contributors of [${repository}](https://github.com/${repository}) at commit \`${commit}\`. ${relation}`,
      people.map((person) => listItem(person, repository)).join('\n'),
    ].join('\n\n'),
  );
  const blocks = [
    '# Thanks',
    '<!-- #region thanks -->',
    OPENING,
    `Each list is GitHub's contributor list of the project, read on \`${readOn}\` (UTC). A list starts with the person who has the most commits. People with the same number of commits are in the sequence of their account names. A list does not have automation. GitHub links the commits of some people to no account. A list shows each of these people by the name in their commits, with no link. The sequence uses that name for a person who has no account name. A list does not have such a name when the page cannot show it as plain text.`,
    ...sections,
    '<!-- #endregion thanks -->',
  ];
  return `${blocks.join('\n\n')}\n`;
}

function main(): void {
  const lists = PROJECTS.map((project) => {
    const { contributors, unlinkedAuthors } = readContributors(project.repository);
    const kept: Contributor[] = [];
    for (const contributor of contributors) {
      const rule = automationRule(contributor);
      if (rule === undefined) {
        kept.push(contributor);
      } else {
        console.log(`${project.repository}: removed ${contributor.login}, because ${rule}.`);
      }
    }
    for (const { login } of kept) {
      if (login.toLowerCase().includes('bot')) {
        console.log(`${project.repository}: kept ${login}. Its login contains "bot".`);
      }
    }
    return { project, kept, unlinkedAuthors, commit: readNewestCommit(project.repository) };
  });
  const names = readDisplayNames([
    ...new Set(lists.flatMap(({ kept }) => kept.map(({ node_id }) => node_id))),
  ]);
  const projects = lists.map(({ project, kept, unlinkedAuthors, commit }) => {
    const linkedPeople = kept.map(({ login, contributions }) => ({
      login,
      name: names.get(login) ?? null,
      contributions,
    }));
    const selection = selectUnlinkedPeople(unlinkedAuthors, linkedPeople);
    // Counts only. A commit author name can be an e-mail address, and a log keeps the output.
    console.log(
      `${project.repository}: ${unlinkedAuthors.length} people have no linked account. Listed: ${selection.people.length}. The same as a linked person: ${selection.sameAsLinked}. Automation: ${selection.automation}. Names that the page cannot show: ${selection.notPlainText}. Merged by name: ${selection.mergedByName}.`,
    );
    return { ...project, commit, people: sortContributors([...linkedPeople, ...selection.people]) };
  });
  const text = renderThanks({ readOn: new Date().toISOString().slice(0, 10), projects });
  const path = join(REPOSITORY_ROOT, 'THANKS.md');
  if (existsSync(path) && readFileSync(path, 'utf8') === text) {
    console.log('THANKS.md is up to date.');
    return;
  }
  writeFileSync(path, text);
  console.log('Wrote THANKS.md.');
}

if (import.meta.main) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
