import { execFileSync } from 'node:child_process';

const MAX_BUFFER = 64 * 1024 * 1024;
const IDS_IN_CALL = 100;
const NAMES_QUERY = 'query($ids: [ID!]!) { nodes(ids: $ids) { ... on User { login name } } }';
const COMMIT_SHA = /^[0-9a-f]{40}$/;

export interface Contributor {
  login: string;
  type: string;
  contributions: number;
  node_id: string;
}

/**
 * A person whose commits GitHub links to no account: the name in the commits and the number of
 * commits. GitHub also gives an e-mail address for this person. The type has no field for it, so
 * the address cannot reach the output.
 */
export interface UnlinkedAuthor {
  name: string;
  contributions: number;
}

export interface ContributorList {
  contributors: Contributor[];
  unlinkedAuthors: UnlinkedAuthor[];
}

function isContributor(row: unknown): row is Contributor {
  const { login, type, contributions, node_id } = (row ?? {}) as Partial<
    Record<keyof Contributor, unknown>
  >;
  return (
    typeof login === 'string' &&
    typeof type === 'string' &&
    typeof contributions === 'number' &&
    typeof node_id === 'string'
  );
}

function isAnonymous(row: unknown): boolean {
  return (row as { type?: unknown } | null)?.type === 'Anonymous';
}

function isUnlinkedAuthor(row: unknown): row is UnlinkedAuthor {
  const { name, contributions } = (row ?? {}) as Partial<Record<keyof UnlinkedAuthor, unknown>>;
  return typeof name === 'string' && typeof contributions === 'number';
}

function unexpected(what: string): Error {
  return new Error(
    `${what} has a form that this script does not read. GitHub may have changed it. Correct scripts/thanks/github.ts, then run \`pnpm thanks:render\` again.`,
  );
}

// `gh` uses the login of the person who runs the script, so the script holds no token.
function ghJson(args: string[], input?: string): unknown {
  const command = `gh ${args.join(' ')}`;
  let output: string;
  try {
    output = execFileSync('gh', args, {
      encoding: 'utf8',
      input,
      maxBuffer: MAX_BUFFER,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (error) {
    const detail = (error as { stderr?: string }).stderr?.trim() || String(error);
    throw new Error(
      `\`${command}\` failed: ${detail}\nMake sure that the GitHub CLI is installed and that you are signed in. To sign in, run \`gh auth login\`. Then run \`pnpm thanks:render\` again.`,
      { cause: error },
    );
  }
  try {
    return JSON.parse(output);
  } catch (error) {
    throw new Error(
      `\`${command}\` did not give one JSON value. Update the GitHub CLI, then run \`pnpm thanks:render\` again.`,
      { cause: error },
    );
  }
}

export function parseContributorRows(rows: unknown, repository: string): ContributorList {
  const what = `The contributor list of ${repository}`;
  if (!Array.isArray(rows)) {
    throw unexpected(what);
  }
  const anonymous = rows.filter(isAnonymous);
  const linked = rows.filter((row) => !isAnonymous(row));
  if (!anonymous.every(isUnlinkedAuthor) || !linked.every(isContributor)) {
    throw unexpected(what);
  }
  return {
    contributors: linked.map(({ login, type, contributions, node_id }) => ({
      login,
      type,
      contributions,
      node_id,
    })),
    unlinkedAuthors: anonymous.map(({ name, contributions }) => ({ name, contributions })),
  };
}

export function readContributors(repository: string): ContributorList {
  // `--paginate` joins the pages into one JSON array. `anon=1` adds the people with no account.
  const rows = ghJson([
    'api',
    `repos/${repository}/contributors?per_page=100&anon=1`,
    '--paginate',
  ]);
  return parseContributorRows(rows, repository);
}

/** The first row of the commit list is the newest commit of the default branch. */
export function readNewestCommit(repository: string): string {
  const rows = ghJson(['api', `repos/${repository}/commits?per_page=1`]);
  const sha = Array.isArray(rows) ? (rows[0] as { sha?: unknown } | undefined)?.sha : undefined;
  if (typeof sha !== 'string' || !COMMIT_SHA.test(sha)) {
    throw unexpected(`The commit list of ${repository}`);
  }
  return sha;
}

/** Gives the display name of each account by its login, or null when the account has none. */
export function readDisplayNames(nodeIds: string[]): Map<string, string | null> {
  const names = new Map<string, string | null>();
  for (let start = 0; start < nodeIds.length; start += IDS_IN_CALL) {
    const body = {
      query: NAMES_QUERY,
      variables: { ids: nodeIds.slice(start, start + IDS_IN_CALL) },
    };
    const response = ghJson(['api', 'graphql', '--input', '-'], JSON.stringify(body)) as {
      data?: { nodes?: ({ login?: unknown; name?: unknown } | null)[] };
    } | null;
    const nodes = response?.data?.nodes;
    if (!Array.isArray(nodes)) {
      throw unexpected('The answer to the name query');
    }
    for (const node of nodes) {
      if (typeof node?.login === 'string') {
        names.set(node.login, typeof node.name === 'string' ? node.name : null);
      }
    }
  }
  return names;
}
