<script setup>
const route = useRoute()

const navItems = [
  { label: 'Home', icon: 'home', to: '/' },
  { label: 'Scan', icon: 'scan', to: '/scan', isCta: true },
  { label: 'Documents', icon: 'docs', to: '/dashboard' },
  { label: 'Workspace', icon: 'workspace', to: '/workspace' },
  { label: 'Profile', icon: 'profile', to: '/profile' },
]

function isActive(to) {
  return route.path === to
}
</script>

<template>
  <!-- Mobile-only bottom nav bar -->
  <nav class="fixed bottom-0 inset-x-0 z-50 md:hidden">
    <!-- Frosted glass background -->
    <div class="glass-panel border-t border-slate-1/50 shadow-elevated">
      <div class="flex items-center justify-around px-2 py-1.5 safe-area-pb">
        <template v-for="item in navItems" :key="item.label">
          <!-- Floating scan button (elevated CTA) -->
          <NuxtLink
            v-if="item.isCta"
            :to="item.to"
            class="relative -mt-6 flex flex-col items-center"
          >
            <div
              class="w-14 h-14 rounded-full bg-accent-primary flex items-center justify-center shadow-glow-cyan transition-transform active:scale-90"
              :class="{ 'ring-2 ring-accent-primary/40': isActive(item.to) }"
            >
              <!-- Scan icon -->
              <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 9V5a2 2 0 012-2h4M15 3h4a2 2 0 012 2v4M21 15v4a2 2 0 01-2 2h-4M9 21H5a2 2 0 01-2-2v-4" />
                <line x1="12" y1="8" x2="12" y2="16" />
                <line x1="8" y1="12" x2="16" y2="12" />
              </svg>
            </div>
            <span class="text-[10px] mt-1 font-medium text-accent-primary">
              {{ item.label }}
            </span>
          </NuxtLink>

          <!-- Regular nav item -->
          <NuxtLink
            v-else
            :to="item.to"
            class="flex flex-col items-center gap-0.5 py-2 px-3 rounded-lg transition-colors"
            :class="isActive(item.to) ? 'text-accent-primary' : 'text-text-muted hover:text-text-secondary'"
          >
            <!-- Home icon -->
            <svg v-if="item.icon === 'home'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <!-- Docs icon -->
            <svg v-else-if="item.icon === 'docs'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <!-- Profile icon -->
            <svg v-else-if="item.icon === 'profile'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8">
              <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <!-- Workspace icon -->
            <svg v-else-if="item.icon === 'workspace'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
            </svg>
            <span class="text-[10px] font-medium">{{ item.label }}</span>
          </NuxtLink>
        </template>
      </div>
    </div>
  </nav>
</template>

<style scoped>
/* Safe area inset for iOS notch/home indicator */
.safe-area-pb {
  padding-bottom: env(safe-area-inset-bottom, 8px);
}
</style>
