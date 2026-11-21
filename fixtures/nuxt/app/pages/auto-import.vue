<script setup lang="ts">
// The module of the package adds `Dialog` and `Button`, so the page imports nothing.
const handle = Dialog.createHandle();
</script>

<template>
  <main>
    <Dialog.Trigger :handle="handle" data-testid="trigger">Open</Dialog.Trigger>
    <Dialog.Root :handle="handle">
      <Dialog.Portal>
        <Dialog.Popup data-testid="popup">
          <Dialog.Title data-testid="title">Title</Dialog.Title>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
    <Button data-testid="button">Press</Button>
  </main>
</template>
