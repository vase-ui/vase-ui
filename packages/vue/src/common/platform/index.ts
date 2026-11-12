/**
 * Platform flags. The module reads them one time, when it loads.
 *
 * The groups `os`, `engine`, `screenReader` and `env` hold Boolean flags that come from
 * `navigator`. With no `navigator`, each of these flags is `false`.
 * Node.js 21 and later have a `navigator`, so on a server the `os` flags describe the server.
 * The group `mediaQuery` holds CSS query strings. They are the same in each environment.
 *
 * Read a flag in an event handler or after mount.
 * Do not use a flag to compute rendered output, because the server and the browser can disagree.
 *
 * Only traits that do not change at run time are here.
 * Input modality can change, so it is not here.
 *
 * Use the group that fits the case:
 * - `os` for keyboard shortcuts and native menus.
 * - `engine` for CSS, layout and focus defects.
 * - `screenReader` for workarounds for one screen reader.
 * - `env` for test environments.
 * - `mediaQuery` for CSS.
 */
export * as platform from './parts';
