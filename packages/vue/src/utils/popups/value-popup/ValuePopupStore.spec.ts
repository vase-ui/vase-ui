import type { HTMLProps } from '../../../internals/types';
import { ValuePopupFixtureStore } from '../../../../test/fixtures/ValuePopupFixture';
import { useSingleAnchorPopupRoot } from '../usePopupRoot';

function useTypeTests(props: HTMLProps) {
  const { store, bindParts } = useSingleAnchorPopupRoot(
    {},
    (initialState, defaultPopupId) => new ValuePopupFixtureStore(initialState, defaultPopupId),
    {
      name: 'TypeTest',
      onOpenChange(open, details) {
        // The details have the type of the store, and not `never`.
        const reason: 'trigger-press' | 'item-press' | 'escape-key' | 'imperative-action' | 'none' =
          details.reason;
        details.preventUnmountOnClose();
        // @ts-expect-error The store never gives this reason.
        const missing: 'outside-press' = details.reason;
        return [open, reason, missing];
      },
      onOpenChangeComplete() {},
    },
  );

  bindParts({ trigger: () => props, popup: () => props });
  store.update({ id: 'id', modal: true, selectedValue: 'a' });
  // @ts-expect-error A family field requires its declared type.
  store.update({ modal: 'invalid' });
}

void useTypeTests;
