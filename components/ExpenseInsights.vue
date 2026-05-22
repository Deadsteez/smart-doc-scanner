<script setup lang="ts">
import { computed } from 'vue'
import { EXPENSE_CATEGORY_LABELS, EXPENSE_CATEGORY_COLORS, aggregateExpenses } from '~/services/vendorIntelligence'
import type { DocumentRecord } from '~/services/db'

const props = defineProps<{
  documents: DocumentRecord[]
}>()

const thisMonthDocs = computed(() => {
  const now   = new Date()
  const from  = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
  return props.documents.filter(d => d.createdAt >= from)
})

const lastMonthDocs = computed(() => {
  const now   = new Date()
  const from  = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime()
  const to    = new Date(now.getFullYear(), now.getMonth(), 0).getTime()
  return props.documents.filter(d => d.createdAt >= from && d.createdAt <= to)
})

const thisMonthAgg  = computed(() => aggregateExpenses(thisMonthDocs.value))
const lastMonthAgg  = computed(() => aggregateExpenses(lastMonthDocs.value))

const thisMonthTotal = computed(() =>
  Object.values(thisMonthAgg.value).reduce((s, c) => s + c.total, 0)
)

const breakdown = computed(() => {
  return Object.entries(thisMonthAgg.value)
    .map(([cat, data]) => {
      const last  = lastMonthAgg.value[cat]?.total ?? 0
      const delta = last > 0 ? ((data.total - last) / last) * 100 : null
      return {
        category:  cat,
        label:     EXPENSE_CATEGORY_LABELS[cat as keyof typeof EXPENSE_CATEGORY_LABELS] ?? cat,
        color:     EXPENSE_CATEGORY_COLORS[cat as keyof typeof EXPENSE_CATEGORY_COLORS] ?? '#475569',
        total:     data.total,
        count:     data.count,
        currency:  data.currency,
        pct:       thisMonthTotal.value > 0 ? (data.total / thisMonthTotal.value) * 100 : 0,
        delta,     // % change vs last month
      }
    })
    .sort((a, b) => b.total - a.total)
    .filter(c => c.total > 0)
})

const topVendors = computed(() => {
  const vendorMap = new Map<string, { count: number; total: number; category: string }>()

  for (const doc of props.documents) {
    const vendor = doc.extracted?.vendor
    if (!vendor) continue
    const key  = vendor.toLowerCase().slice(0, 30)
    const prev = vendorMap.get(key) ?? { count: 0, total: 0, category: doc.expenseCategory ?? 'other' }
    const amt  = parseFloat((doc.extracted?.total ?? '0').replace(/[,\s]/g, ''))
    vendorMap.set(key, {
      count:    prev.count + 1,
      total:    prev.total + (isNaN(amt) ? 0 : amt),
      category: doc.expenseCategory ?? prev.category,
    })
  }

  return [...vendorMap.entries()]
    .map(([name, data]) => ({
      name:     name.charAt(0).toUpperCase() + name.slice(1),
      count:    data.count,
      total:    data.total,
      category: data.category,
      color:    EXPENSE_CATEGORY_COLORS[data.category as keyof typeof EXPENSE_CATEGORY_COLORS] ?? '#475569',
      label:    EXPENSE_CATEGORY_LABELS[data.category as keyof typeof EXPENSE_CATEGORY_LABELS] ?? data.category,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)
})

const smartAlerts = computed(() => {
  const alerts: { type: 'warn' | 'info' | 'ok'; message: string }[] = []

  for (const cat of breakdown.value) {
    if (cat.delta !== null && cat.delta > 40) {
      alerts.push({ type: 'warn', message: `${cat.label} spending is up ${cat.delta.toFixed(0)}% vs last month` })
    }
    if (cat.delta !== null && cat.delta < -30) {
      alerts.push({ type: 'ok', message: `${cat.label} spending dropped ${Math.abs(cat.delta).toFixed(0)}% — great!` })
    }
  }

  const recurring = topVendors.value.filter(v => v.count >= 3)
  if (recurring.length > 0) {
    alerts.push({ type: 'info', message: `Recurring vendors: ${recurring.map(v => v.name).slice(0, 3).join(', ')}` })
  }

  return alerts.slice(0, 4)
})

function fmt(n: number, ccy = 'INR') {
  if (n >= 100_000) return (n / 100_000).toFixed(1) + 'L'
  if (n >= 1_000)   return (n / 1_000).toFixed(1) + 'k'
  return n.toFixed(0)
}
</script>

<template>
  <div class="space-y-4">

    <!-- ─── Header ─────────────────────────────────────────────────────── -->
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-text-primary font-bold text-lg flex items-center gap-2">
          <span class="text-xl">✨</span> Expense Intelligence
        </h2>
        <p class="text-text-muted text-xs mt-0.5">AI-powered semantic understanding of your spending</p>
      </div>
      <div v-if="thisMonthTotal > 0" class="text-right">
        <div class="text-text-primary font-bold text-xl">₹{{ fmt(thisMonthTotal) }}</div>
        <div class="text-text-muted text-xs">this month</div>
      </div>
    </div>

    <!-- ─── Smart Alerts ───────────────────────────────────────────────── -->
    <div v-if="smartAlerts.length > 0" class="space-y-2">
      <div v-for="(alert, i) in smartAlerts" :key="i"
        class="flex items-start gap-2.5 px-3 py-2.5 rounded-xl text-xs border"
        :class="{
          'bg-amber-500/8 border-amber-500/20 text-amber-300': alert.type === 'warn',
          'bg-sky-500/8 border-sky-500/20 text-sky-300':       alert.type === 'info',
          'bg-emerald-500/8 border-emerald-500/20 text-emerald-300': alert.type === 'ok',
        }">
        <span class="flex-shrink-0 mt-0.5">
          {{ alert.type === 'warn' ? '⚠️' : alert.type === 'ok' ? '✅' : '💡' }}
        </span>
        <span>{{ alert.message }}</span>
      </div>
    </div>

    <!-- ─── Category Breakdown ─────────────────────────────────────────── -->
    <div v-if="breakdown.length > 0"
      class="bg-bg-secondary/80 border border-slate-1/50 rounded-2xl p-4 space-y-3">
      <p class="text-text-secondary text-xs uppercase tracking-wider font-semibold">Spending by Category</p>

      <div class="space-y-2.5">
        <div v-for="cat in breakdown" :key="cat.category" class="group">
          <div class="flex items-center justify-between mb-1">
            <div class="flex items-center gap-2">
              <span class="text-sm">{{ cat.label.split(' ')[0] }}</span>
              <span class="text-text-secondary text-xs font-medium">{{ cat.label.split(' ').slice(1).join(' ') }}</span>
              <span v-if="cat.delta !== null" class="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                :class="cat.delta > 0 ? 'bg-red-500/15 text-red-400' : 'bg-emerald-500/15 text-emerald-400'">
                {{ cat.delta > 0 ? '▲' : '▼' }} {{ Math.abs(cat.delta).toFixed(0) }}%
              </span>
            </div>
            <div class="text-right">
              <span class="text-text-primary text-xs font-mono font-bold">₹{{ fmt(cat.total) }}</span>
              <span class="text-text-muted text-[10px] ml-1">×{{ cat.count }}</span>
            </div>
          </div>
          <!-- Progress bar -->
          <div class="h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
            <div class="h-full rounded-full transition-all duration-700"
              :style="{ width: cat.pct + '%', background: cat.color }">
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ─── Top Vendors ────────────────────────────────────────────────── -->
    <div v-if="topVendors.length > 0"
      class="bg-bg-secondary/80 border border-slate-1/50 rounded-2xl p-4">
      <p class="text-text-secondary text-xs uppercase tracking-wider font-semibold mb-3">Top Vendors</p>
      <div class="grid grid-cols-2 gap-2">
        <div v-for="v in topVendors" :key="v.name"
          class="flex items-center gap-2.5 bg-bg-tertiary/60 rounded-xl px-3 py-2.5 border border-slate-1/30">
          <div class="w-2 h-2 rounded-full flex-shrink-0" :style="{ background: v.color }"></div>
          <div class="min-w-0">
            <p class="text-text-primary text-xs font-medium truncate">{{ v.name }}</p>
            <p class="text-text-muted text-[10px]">{{ v.label.split(' ').slice(1).join(' ') }} · {{ v.count }}×</p>
          </div>
        </div>
      </div>
    </div>

    <!-- ─── Empty state ────────────────────────────────────────────────── -->
    <div v-if="breakdown.length === 0 && documents.length > 0"
      class="bg-bg-secondary/60 border border-slate-1/30 rounded-2xl p-6 text-center">
      <p class="text-2xl mb-2">🧠</p>
      <p class="text-text-secondary text-sm font-medium">Building expense intelligence…</p>
      <p class="text-text-muted text-xs mt-1">Documents are being analyzed in the background</p>
    </div>

    <div v-if="documents.length === 0"
      class="bg-bg-secondary/60 border border-slate-1/30 rounded-2xl p-6 text-center">
      <p class="text-2xl mb-2">📄</p>
      <p class="text-text-secondary text-sm">Scan your first document to see expense insights</p>
    </div>

  </div>
</template>
