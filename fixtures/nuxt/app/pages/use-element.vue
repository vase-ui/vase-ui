<template>
  <main>
    <Notice data-testid="default-tag" class="highlight">Default tag</Notice>
    <Notice data-testid="link" tone="warning">
      <template #element="{ props, elementRef }">
        <a v-bind="props" :ref="elementRef" href="/button">Link</a>
      </template>
    </Notice>
    <Notice data-testid="nuxt-link">
      <template #element="{ props, elementRef }">
        <NuxtLink v-slot="{ href, navigate }" to="/button" custom>
          <a v-bind="props" :ref="elementRef" :href="href" @click="navigate">Nuxt link</a>
        </NuxtLink>
      </template>
    </Notice>
  </main>
</template>
