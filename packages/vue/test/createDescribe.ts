import { describe } from 'vitest';

type Describe = typeof describe | typeof describe.skip;

export function createDescribe<Args extends unknown[]>(
  message: string,
  callback: (...args: Args) => void,
) {
  const create =
    (runDescribe: Describe) =>
    (...args: Args) =>
      runDescribe(message, () => callback(...args));

  return Object.assign(create(describe), {
    skip: create(describe.skip),
    only: create(describe.only),
  });
}
