<script setup>
import AppNavbar from '~/components/AppNavbar.vue'
import BottomNavigation from '~/components/BottomNavigation.vue'
</script>

<template>
    <div class="min-h-screen bg-bg-primary text-text-primary font-sans transition-colors duration-200">

        <AppNavbar />


        <main class="pb-20 md:pb-6">
            <slot />
        </main>


        <BottomNavigation />
    </div>
</template>