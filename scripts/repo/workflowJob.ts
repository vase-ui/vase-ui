/**
 * The `run` commands of one job, in the sequence of its steps. `workflow` is the text of a workflow
 * file in the form that Prettier writes.
 */
export function jobRunCommands(workflow: string, job: string): string[] {
  const lines = workflow.split('\n');
  const start = lines.indexOf(`  ${job}:`);
  if (start === -1) {
    throw new Error(`The workflow has no job "${job}".`);
  }
  const commands: string[] = [];
  for (const line of lines.slice(start + 1)) {
    // A key at two spaces or less starts the next job or ends the jobs.
    if (/^ {0,2}[^\s#]/.test(line)) {
      break;
    }
    const command = /^\s+(?:- )?run: (.*)$/.exec(line)?.[1];
    if (command === undefined) {
      continue;
    }
    if (/^[|>]/.test(command)) {
      throw new Error(
        `A "run" of the job "${job}" has more than one line. Write each command of this job as a step of one line.`,
      );
    }
    commands.push(command);
  }
  if (commands.length === 0) {
    throw new Error(`The job "${job}" has no "run" step.`);
  }
  return commands;
}
