import { inject, onTestFinished } from 'vitest';
import type { Component } from 'vue';
import type { hydrateComponent } from './hydrateComponent';

/**
 * Hydrates the HTML of `serverRoot`, which `renderOnServer` made from the same fixture, in a new
 * frame, and gives the element of the frame that holds the DOM. The frame loads its own copy of Vue
 * and of the library. Vue logs a hydration mismatch one time for each copy of its module
 * (`hasLoggedMismatchError`), so a case that expects that message hydrates in a frame of its own in
 * each run. The Vue of the frame writes to the console of this page, so its messages reach
 * `takeReportedMessages()`. The frame goes when the test ends. The props must hold no function,
 * because a Vapor app reads a function in a root prop as a getter of the value.
 */
export async function hydrateInFrame(
  fixture: string,
  props: Record<string, unknown>,
  serverRoot: Element,
): Promise<HTMLElement> {
  const frame = document.createElement('iframe');
  const loaded = new Promise((resolve) => frame.addEventListener('load', resolve, { once: true }));
  // With a `srcdoc` set before the insert, the first load of the frame is the load of an empty
  // document. So one `load` event comes, after the document exists.
  frame.srcdoc = '';
  document.body.append(frame);
  onTestFinished(() => frame.remove());
  await loaded;
  const { contentWindow, contentDocument } = frame;
  if (!contentWindow || !contentDocument) throw new Error('The frame has no document.');
  // Vite gives the flags of Vue to this page only.
  Object.assign(contentWindow, {
    console,
    __VUE_OPTIONS_API__: true,
    __VUE_PROD_DEVTOOLS__: false,
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
  });
  const container = contentDocument.body.appendChild(contentDocument.createElement('div'));
  container.innerHTML = serverRoot.innerHTML;
  // Vitest compiles a dynamic `import()` of a module to a call of a function that only the page of
  // the runner has. So a module of the frame has static imports only, and its script loads the
  // fixture.
  const hydrateUrl = new URL('./hydrateComponent.ts', import.meta.url).href;
  const fixtureUrl = new URL(`./fixtures/${fixture}.vue`, hydrateUrl).href;
  const [hydrate, component] = await new Promise<[typeof hydrateComponent, Component]>(
    (resolve, reject) => {
      Object.assign(contentWindow, { onFrameReady: resolve, onFrameError: reject });
      const script = contentDocument.createElement('script');
      script.type = 'module';
      script.textContent = `Promise.all([import(${JSON.stringify(hydrateUrl)}), import(${JSON.stringify(fixtureUrl)})]).then(([hydrate, fixture]) => window.onFrameReady([hydrate.hydrateComponent, fixture.default]), (error) => window.onFrameError(error));`;
      contentDocument.head.append(script);
    },
  );
  hydrate(inject('app'), component, props, container);
  return container;
}
