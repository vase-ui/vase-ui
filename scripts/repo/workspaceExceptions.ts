const SETTINGS = ['allowBuilds', 'minimumReleaseAgeExclude'];

export interface WorkspaceException {
  setting: string;
  /** The line of the entry, with no indent, list mark or comment. */
  entry: string;
  /** `true` when a comment is on the line before the entry, or at the end of its line. */
  hasComment: boolean;
}

/**
 * The entries of `allowBuilds` and `minimumReleaseAgeExclude`. `workspace` is the text of
 * `pnpm-workspace.yaml` in the form that Prettier writes.
 */
export function workspaceExceptions(workspace: string): WorkspaceException[] {
  const exceptions: WorkspaceException[] = [];
  let setting: string | undefined;
  let commentBefore = false;
  for (const line of workspace.split('\n')) {
    const key = /^([^\s#][^:]*):(.*)$/.exec(line);
    if (key !== null) {
      setting = SETTINGS.find((name) => name === key[1]);
      if (setting !== undefined && key[2].replace(/\s#.*$/, '').trim() !== '') {
        throw new Error(`Write each entry of "${setting}" on a line of its own.`);
      }
      commentBefore = false;
    } else if (setting !== undefined && line.trim() !== '') {
      const [entry, comment] = line.trim().split(/(?:^|\s+)#/, 2);
      if (entry === '') {
        commentBefore = true;
      } else {
        exceptions.push({
          setting,
          entry: entry.replace(/^- /, ''),
          hasComment: commentBefore || comment !== undefined,
        });
        commentBefore = false;
      }
    } else {
      commentBefore = false;
    }
  }
  return exceptions;
}
