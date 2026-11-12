import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPOSITORY_ROOT } from '../parity/repository.ts';
import { readContributors, readDisplayNames, readNewestCommit } from './github.ts';
import type { Contributor } from './github.ts';

export interface Project {
  repository: string;
  title: string;
  relation: string;
}

export interface Person {
  login: string;
  name: string | null;
}

export interface ProjectSection extends Project {
  commit: string;
  people: Person[];
}

const PROJECTS: Project[] = [
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

const LOGIN = /^[A-Za-z0-9-]+$/;
// A display name is text that a stranger controls, and the site compiles this file as a Vue
// template. This pattern rejects `{{ }}`, HTML, Markdown syntax and `@`.
const DISPLAY_NAME = /^[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N} .'’-]*$/u;

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

export function sortContributors<T extends Pick<Contributor, 'login' | 'contributions'>>(
  contributors: T[],
): T[] {
  // `localeCompare` depends on the ICU data of the machine.
  // Code units give the same order on each machine.
  return [...contributors].sort(
    (a, b) =>
      b.contributions - a.contributions ||
      compareCodeUnits(a.login.toLowerCase(), b.login.toLowerCase()),
  );
}

export function profileLink({ login, name }: Person, repository: string): string {
  if (!LOGIN.test(login)) {
    throw new Error(
      `${repository} has the contributor ${JSON.stringify(login)}. A GitHub login has only letters, numbers and hyphens, so the script cannot make a link to this profile. If the account is automation, add its lower-case login to AUTOMATION_LOGINS in scripts/thanks/render.ts. If not, correct LOGIN in the same file.`,
    );
  }
  const displayName = name?.trim().replace(/\s+/g, ' ');
  const text = displayName !== undefined && DISPLAY_NAME.test(displayName) ? displayName : login;
  return `[${text}](https://github.com/${login})`;
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
      people.map((person) => `- ${profileLink(person, repository)}`).join('\n'),
    ].join('\n\n'),
  );
  const blocks = [
    '# Thanks',
    '<!-- #region thanks -->',
    OPENING,
    `Each list is GitHub's contributor list of the project, read on \`${readOn}\` (UTC). A list starts with the person who has the most commits. People with the same number of commits are in the sequence of their account names. A list does not have automation accounts. It also does not have a person whose commits GitHub links to no account.`,
    ...sections,
    '<!-- #endregion thanks -->',
  ];
  return `${blocks.join('\n\n')}\n`;
}

function main(): void {
  const lists = PROJECTS.map((project) => {
    const kept: Contributor[] = [];
    for (const contributor of readContributors(project.repository)) {
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
    return { project, kept: sortContributors(kept), commit: readNewestCommit(project.repository) };
  });
  const names = readDisplayNames([
    ...new Set(lists.flatMap(({ kept }) => kept.map(({ node_id }) => node_id))),
  ]);
  const projects = lists.map(({ project, kept, commit }) => ({
    ...project,
    commit,
    people: kept.map(({ login }) => ({ login, name: names.get(login) ?? null })),
  }));
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
