<script setup lang="ts">
import { h } from 'vue';
import { Toast } from '@vase-ui/vue/toast';

// #region usage
const toastManager = Toast.useToastManager();
// #endregion usage

// #region add
const toastId = toastManager.add({
  description: 'Hello, world!',
});
// #endregion add

function updateToast() {
  // #region update
  toastManager.update(toastId, {
    description: 'New description',
  });
  // #endregion update
}

function updateFromCurrentToast() {
  // #region update-function
  toastManager.update(toastId, (prevToast) => ({
    data: prevToast.data && { ...prevToast.data, progress: 100 },
  }));
  // #endregion update-function
}

function closeToast() {
  // #region close
  toastManager.close(toastId);
  // #endregion close
}

function closeAllToasts() {
  // #region close-all
  toastManager.close();
  // #endregion close-all
}

function runPromise() {
  // #region promise
  const promise = toastManager.promise(
    new Promise<string>((resolve) => {
      setTimeout(() => resolve('world!'), 1000);
    }),
    {
      // Each is a shortcut for the `description` option
      loading: 'Loading…',
      success: (data) => `Hello ${data}`,
      error: (err) => `Error: ${err}`,
    },
  );
  // #endregion promise
  return promise;
}

function runPromiseWithOptions() {
  // #region promise-options
  const promise = toastManager.promise(
    new Promise<string>((resolve) => {
      setTimeout(() => resolve('world!'), 1000);
    }),
    {
      loading: {
        id: 'my-toast',
        title: 'Loading…',
        description: 'The promise is loading.',
      },
      success: {
        title: 'Success',
        description: 'The promise resolved successfully.',
      },
      error: {
        title: 'Error',
        description: 'The promise rejected.',
        actionProps: {
          children: 'Contact support',
          onClick() {
            // Redirect to support page
          },
        },
      },
    },
  );
  // #endregion promise-options
  return promise;
}

function addRichTitle() {
  // #region label-function
  toastManager.add({
    title: () => h('strong', 'Saved'),
    description: 'The draft is in your folder.',
  });
  // #endregion label-function
}
</script>

<template>
  <button type="button" @click="updateToast">Update</button>
  <button type="button" @click="updateFromCurrentToast">Complete</button>
  <button type="button" @click="closeToast">Close</button>
  <button type="button" @click="closeAllToasts">Close all</button>
  <button type="button" @click="runPromise">Run promise</button>
  <button type="button" @click="runPromiseWithOptions">Run promise with options</button>
  <button type="button" @click="addRichTitle">Add a toast with a rich title</button>
</template>
