<script setup lang="ts">
const router = useRouter();
</script>

<template>
  <Button
    type="button"
    class="shrink-0 px-3 py-1 text-xs sm:text-sm"
    aria-label="Go back"
    @click="router.back"
  >
    &larr;
  </Button>
</template>
