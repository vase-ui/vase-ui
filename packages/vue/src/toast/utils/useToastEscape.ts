import { watch } from 'vue';
import type { Ref } from 'vue';
import { addEventListener } from '../../common/addEventListener';
import { NOOP } from '../../common/empty';
import { platform } from '../../common/platform';
import { useTimeout } from '../../common/useTimeout';

export function useToastEscape(getElement: () => Element | null, isHeld: Readonly<Ref<boolean>>) {
  const compositionEnd = useTimeout();
  watch(
    [() => getElement()?.ownerDocument, isHeld],
    ([doc, held], _, onCleanup) => {
      if (!doc || held || !platform.engine.webkit) return;
      // WebKit can send Escape just after compositionend.
      onCleanup(addEventListener(doc, 'compositionend', () => compositionEnd.start(5, NOOP)));
      onCleanup(compositionEnd.clear);
    },
    { flush: 'post' },
  );

  return (event: KeyboardEvent) =>
    event.key === 'Escape' &&
    !event.isComposing &&
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- Some input methods identify the key only with code 229.
    event.keyCode !== 229 &&
    !compositionEnd.isStarted();
}
