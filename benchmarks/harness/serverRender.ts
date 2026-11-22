/** The result of the server render of an app. */
export interface ServerRender {
  html: string;
  /** The HTML of each teleport, by target. */
  teleports: Record<string, string>;
  /** The errors that the render logged and did not throw. */
  errors: string[];
}
