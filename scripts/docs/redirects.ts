import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export interface Redirect {
  /** An address that the site had, such as `/parity`. Links from other sites still name it. */
  from: string;
  /** The page that has the text of that address. */
  to: string;
  /** The id of the heading of that text in the page. */
  section: string;
}

export const REDIRECTS: Redirect[] = [
  { from: '/parity', to: '/releases', section: 'parity-with-base-ui' },
  { from: '/contributing', to: '/community', section: 'get-help-and-contribute' },
  { from: '/thanks', to: '/community', section: 'thanks' },
  { from: '/philosophy', to: '/about', section: 'principles' },
  { from: '/benchmarks', to: '/about', section: 'benchmarks' },
  { from: '/handbook/server-rendering', to: '/quick-start', section: 'server-rendering' },
  { from: '/handbook/nuxt', to: '/quick-start', section: 'nuxt' },
];

/**
 * The HTML file that sends a reader from `redirect.from` to the text in its page. GitHub Pages has
 * no redirect rule, so the file is a page. An anchor of the address is a heading of the text, and
 * that heading has the same id in the page. The script thus keeps the anchor. The exception is the
 * anchor of the title of the address, which is the name of its file: the section takes its place.
 */
export function redirectPage({ from, to, section }: Redirect, site: string): string {
  const target = `${to}#${section}`;
  const title = `#${from.slice(from.lastIndexOf('/') + 1)}`;
  return `<!doctype html>
<html lang="en-US">
  <head>
    <meta charset="utf-8" />
    <title>Vase UI</title>
    <meta name="robots" content="noindex" />
    <link rel="canonical" href="${new URL(to, site).href}" />
    <script>
      var anchor = location.hash;
      location.replace(
        ${JSON.stringify(to)} +
          (anchor && anchor !== ${JSON.stringify(title)} ? anchor : ${JSON.stringify(`#${section}`)}),
      );
    </script>
    <noscript><meta http-equiv="refresh" content="0; url=${target}" /></noscript>
  </head>
  <body>
    <a href="${target}">${new URL(target, site).href}</a>
  </body>
</html>
`;
}

export function writeRedirectPages(outDir: string, site: string): void {
  for (const redirect of REDIRECTS) {
    const file = join(outDir, `${redirect.from.slice(1)}.html`);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, redirectPage(redirect, site));
  }
}
