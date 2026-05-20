<script setup>
import AppNavbar from '~/components/AppNavbar.vue'
import BottomNavigation from '~/components/BottomNavigation.vue'
</script>

<template>
  <div class="min-h-screen bg-bg-primary text-text-primary font-sans transition-colors duration-200">
    <!-- Desktop floating navbar -->
    <AppNavbar />

    <!-- Main workspace area — focused, centered -->
    <main class="pb-20 md:pb-6">
      <slot />
    </main>

    <!-- Mobile bottom navigation (hidden on desktop) -->
    <BottomNavigation />
  </div>
</template>
