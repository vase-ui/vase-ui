import { computed, onUnmounted, shallowRef } from 'vue';

export function useInvalidFeedback() {
  const focusedIndex = shallowRef(0);
  const invalidPulse = shallowRef(0);
  const statusMessage = shallowRef('');
  let invalidTimeout: ReturnType<typeof setTimeout> | null = null;
  let skipClearOnNextValueChange = false;

  onUnmounted(() => {
    if (invalidTimeout != null) {
      clearTimeout(invalidTimeout);
    }
  });

  function clearInvalidFeedback() {
    if (invalidTimeout != null) {
      clearTimeout(invalidTimeout);
      invalidTimeout = null;
    }

    invalidPulse.value = 0;
    statusMessage.value = '';
  }

  function handleValueChange() {
    if (skipClearOnNextValueChange) {
      skipClearOnNextValueChange = false;
      return;
    }

    clearInvalidFeedback();
  }

  function handleValueInvalid(value: string) {
    skipClearOnNextValueChange = true;
    invalidPulse.value += 1;
    statusMessage.value = `Unsupported characters were ignored from ${value}.`;

    if (invalidTimeout != null) {
      clearTimeout(invalidTimeout);
    }

    invalidTimeout = setTimeout(() => {
      invalidTimeout = null;
      invalidPulse.value = 0;
    }, 400);
  }

  function setFocusedIndex(index: number) {
    focusedIndex.value = index;
  }

  return {
    activeInvalidIndex: computed(() => (invalidPulse.value > 0 ? focusedIndex.value : -1)),
    invalidPulse,
    statusMessage,
    setFocusedIndex,
    handleValueChange,
    handleValueInvalid,
  };
}
