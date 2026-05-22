<script setup lang="ts">
import type { ApprovalStatus } from '~/types/workspace'

const props = defineProps<{
  status: ApprovalStatus
  size?: 'sm' | 'md'
}>()

const config = {
  pending:  { label: 'Pending',  classes: 'bg-warning/15 text-warning    -warning/20' },
  approved: { label: 'Approved', classes: 'bg-success/15 text-success    -success/20' },
  rejected: { label: 'Rejected', classes: 'bg-error/15   text-error      -error/20'   },
}

const current = computed(() => config[props.status] ?? config.pending)
const sizeClass = computed(() => props.size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2.5 py-1')
</script>

<template>
  <span
    :class="[
      'inline-flex items-center gap-1.5 rounded-full font-semibold uppercase tracking-wider    ',
      current.classes,
      sizeClass,
    ]"
  >
    <span class="w-1.5 h-1.5 rounded-full" :class="{
      'bg-warning animate-pulse': status === 'pending',
      'bg-success': status === 'approved',
      'bg-error':   status === 'rejected',
    }" />
    {{ current.label }}
  </span>
</template>

