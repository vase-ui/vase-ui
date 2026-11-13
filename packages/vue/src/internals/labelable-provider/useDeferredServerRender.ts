import { onServerPrefetch } from 'vue';
import { NOOP } from '../noop';

/**
 * A part calls it in `setup` when it binds the id of a part that can render after it. Examples are
 * the id of a label and of a message.
 *
 * A server writes the attributes of an element before the `setup` of each part that comes after
 * the element. Vue renders a component that has a prefetch hook in a later microtask. Before that
 * render, Vue runs the `setup` of each part that it reaches in the same synchronous pass. Each part
 * registers its id in `setup`, so the attributes of the element have the ids.
 *
 * The call has no condition on the environment. Vue makes a component that has the hook a boundary
 * for `useId`, on a server and in a browser. With the hook only on a server, the ids below the part
 * differ between the server HTML and the browser.
 */
export function useDeferredServerRender(): void {
  onServerPrefetch(NOOP);
}
