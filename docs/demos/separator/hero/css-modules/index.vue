<script setup lang="ts">
import { Separator } from '@vase-ui/vue/separator';
import styles from './index.module.css';
</script>

<template>
  <div :class="styles.Container">
    <a href="#" :class="styles.Link">Home</a>
    <a href="#" :class="styles.Link">Pricing</a>
    <a href="#" :class="styles.Link">Blog</a>
    <a href="#" :class="styles.Link">Support</a>

    <Separator orientation="vertical" :class="styles.Separator" />

    <a href="#" :class="styles.Link">Log in</a>
    <a href="#" :class="styles.Link">Sign up</a>
  </div>
</template>
