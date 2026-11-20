import { inject, type InjectionKey } from 'vue';
import type { CollapsibleRootChangeEventReason } from './types';

/** A panel of a root or an item, from its `setup` to its unmount. The properties are reactive. */
export interface CollapsiblePanelEntry {
  readonly id: string;
}

/**
 * What a `Collapsible.Root` or an `Accordion.Item` gives to its trigger and its panel. The
 * properties are reactive.
 */
export interface CollapsiblePart {
  readonly open: boolean;
  /** Disabled by the root, or by the item and its root. */
  readonly disabled: boolean;
  /** The id of the first panel. */
  readonly panelId: string | undefined;
  /** Emits the change events, and opens or closes the panel unless a listener cancels. */
  request(open: boolean, reason: CollapsibleRootChangeEventReason, event: Event): void;
  /** Adds a panel. Returns the function that removes it. */
  addPanel(panel: CollapsiblePanelEntry): () => void;
}

export const collapsibleKey: InjectionKey<CollapsiblePart> = Symbol('collapsible');

export function injectCollapsible() {
  const collapsible = inject(collapsibleKey, null);
  if (!collapsible) {
    throw new Error(
      'Vase UI: A part of Collapsible must be inside <Collapsible.Root>. Without a root the part has no open state to read. Put the part inside <Collapsible.Root>.',
    );
  }
  return collapsible;
}
