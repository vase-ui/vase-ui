<script lang="ts">
import { Toast } from '../../src/toast';

// One manager for each render of the server, as a module of an application has it.
const manager = Toast.createToastManager();
</script>

<script setup lang="ts">
import ToastSharedManagerList from './ToastSharedManagerList.vue';

manager.add({ id: 'shared', title: 'Shared' });
</script>

<template>
  <Toast.Provider :toast-manager="manager">
    <ToastSharedManagerList :manager="manager" />
  </Toast.Provider>
</template>
