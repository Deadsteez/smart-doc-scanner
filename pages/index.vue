<script setup>
import { useAuth } from '~/composables/useAuth'
const { user } = useAuth()
</script>

<template>
  <!-- Force a dark theme specifically for the landing page hero section to match design system guidelines -->
  <div class="min-h-screen bg-bg-primary text-text-primary selection:bg-accent-primary/30 selection:text-white font-sans overflow-x-hidden">
    
    <!-- Hero Section -->
    <section class="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
      <!-- Reactive Dot Grid Background (simulated with SVG pattern) -->
      <div class="absolute inset-0 -z-10 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoNTEsIDY1LCA4NSwgMC4yKSIvPjwvc3ZnPg==')] opacity-60 [mask-image:radial-gradient(ellipse_at_center,black,transparent_80%)]"></div>
      
      <!-- Ambient Glows -->
      <div class="absolute top-1/4 left-1/2 -translate-x-1/2 w-3/4 h-64 bg-accent-primary/20 blur-[120px] rounded-full pointer-events-none -z-10"></div>
      
      <div class="max-w-7xl mx-auto px-6 text-center animate-slide-up">
        <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-bg-secondary border border-slate-1/40 text-sm font-medium text-accent-secondary mb-8 shadow-glow-cyan">
          <span class="w-2 h-2 rounded-full bg-warning animate-pulse"></span>
          SmartScan 1.0 is Live
        </div>
        
        <h1 class="text-5xl lg:text-7xl font-bold font-display tracking-tight mb-6">
          The Intelligent Workspace<br />
          <span class="text-transparent bg-clip-text bg-gradient-to-r from-accent-primary to-accent-secondary">
            for your Documents.
          </span>
        </h1>
        
        <p class="text-lg text-text-muted max-w-2xl mx-auto mb-10 leading-relaxed">
          More than just a scanner. Extract, categorize, and organize your receipts, invoices, and financial records with finance-grade AI precision.
        </p>
        
        <div class="flex flex-col sm:flex-row items-center justify-center gap-4">
          <NuxtLink v-if="user" to="/dashboard" class="px-8 py-3.5 bg-accent-primary hover:bg-accent-primary/90 text-white rounded-xl font-semibold shadow-glow-cyan transition-all active:scale-95 text-lg">
            Go to Dashboard
          </NuxtLink>
          <template v-else>
            <NuxtLink to="/register" class="px-8 py-3.5 bg-accent-primary hover:bg-accent-primary/90 text-white rounded-xl font-semibold shadow-glow-cyan transition-all active:scale-95 text-lg">
              Start Free Trial
            </NuxtLink>
            <NuxtLink to="/login" class="px-8 py-3.5 bg-bg-secondary border border-slate-1/40 hover:bg-bg-tertiary text-text-primary rounded-xl font-semibold transition-all active:scale-95 text-lg">
              Sign In
            </NuxtLink>
          </template>
        </div>
      </div>
    </section>

    <!-- Workflow Section -->
    <section class="py-24 bg-bg-secondary border-y border-slate-1/20">
      <div class="max-w-7xl mx-auto px-6">
        <div class="text-center mb-16">
          <h2 class="text-3xl font-display font-semibold mb-4">Calm. Intelligent. Productive.</h2>
          <p class="text-text-muted">A seamless pipeline from physical paper to structured data.</p>
        </div>
        
        <div class="grid md:grid-cols-3 gap-8 relative">
          <!-- Connectors (Desktop only) -->
          <div class="hidden md:block absolute top-1/2 left-1/6 right-1/6 h-px bg-gradient-to-r from-slate-1/10 via-slate-1/40 to-slate-1/10 -z-10"></div>
          
          <!-- Step 1 -->
          <div class="glass-panel p-8 rounded-2xl text-center border-t border-accent-primary/30 relative hover:-translate-y-1 transition-transform duration-300">
            <div class="w-14 h-14 mx-auto bg-accent-primary/10 rounded-xl flex items-center justify-center mb-6 shadow-glow-cyan">
              <svg class="w-7 h-7 text-accent-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9V5a2 2 0 012-2h4M15 3h4a2 2 0 012 2v4M21 15v4a2 2 0 01-2 2h-4M9 21H5a2 2 0 01-2-2v-4" />
                <line x1="12" y1="8" x2="12" y2="16" stroke-width="2" />
                <line x1="8" y1="12" x2="16" y2="12" stroke-width="2" />
              </svg>
            </div>
            <h3 class="text-xl font-semibold mb-3">1. Scan & Capture</h3>
            <p class="text-sm text-text-muted leading-relaxed">High-quality native capture interface designed for speed and clarity on mobile devices.</p>
          </div>

          <!-- Step 2 -->
          <div class="glass-panel p-8 rounded-2xl text-center border-t border-accent-secondary/30 relative hover:-translate-y-1 transition-transform duration-300">
            <div class="w-14 h-14 mx-auto bg-accent-secondary/10 rounded-xl flex items-center justify-center mb-6 shadow-glow-teal">
              <svg class="w-7 h-7 text-accent-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            </div>
            <h3 class="text-xl font-semibold mb-3">2. AI Extraction</h3>
            <p class="text-sm text-text-muted leading-relaxed">On-device OCR processes vendor names, totals, dates, and line items instantly.</p>
          </div>

          <!-- Step 3 -->
          <div class="glass-panel p-8 rounded-2xl text-center border-t border-success/30 relative hover:-translate-y-1 transition-transform duration-300">
            <div class="w-14 h-14 mx-auto bg-success/10 rounded-xl flex items-center justify-center mb-6">
              <svg class="w-7 h-7 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            </div>
            <h3 class="text-xl font-semibold mb-3">3. Structured Data</h3>
            <p class="text-sm text-text-muted leading-relaxed">Documents are automatically categorized and synchronized to your secure cloud dashboard.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Features Section -->
    <section class="py-24">
      <div class="max-w-7xl mx-auto px-6">
        <div class="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <h2 class="text-3xl font-display font-semibold mb-6">Built for precision.</h2>
            <div class="space-y-8">
              <!-- Feature -->
              <div class="flex gap-4">
                <div class="mt-1 w-10 h-10 rounded-lg bg-bg-tertiary flex items-center justify-center flex-shrink-0">
                  <svg class="w-5 h-5 text-accent-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                </div>
                <div>
                  <h4 class="text-lg font-semibold text-text-primary mb-1">Instant OCR Processing</h4>
                  <p class="text-sm text-text-muted leading-relaxed">Extract text and detect key fields from your financial documents in milliseconds using advanced AI models.</p>
                </div>
              </div>
              
              <!-- Feature -->
              <div class="flex gap-4">
                <div class="mt-1 w-10 h-10 rounded-lg bg-bg-tertiary flex items-center justify-center flex-shrink-0">
                  <svg class="w-5 h-5 text-accent-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"/></svg>
                </div>
                <div>
                  <h4 class="text-lg font-semibold text-text-primary mb-1">Offline-First Syncing</h4>
                  <p class="text-sm text-text-muted leading-relaxed">Scan documents without an internet connection. Data is stored safely in IndexedDB and syncs to Supabase when you're back online.</p>
                </div>
              </div>

              <!-- Feature -->
              <div class="flex gap-4">
                <div class="mt-1 w-10 h-10 rounded-lg bg-bg-tertiary flex items-center justify-center flex-shrink-0">
                  <svg class="w-5 h-5 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                </div>
                <div>
                  <h4 class="text-lg font-semibold text-text-primary mb-1">Automated Exports</h4>
                  <p class="text-sm text-text-muted leading-relaxed">Select multiple documents and export them seamlessly to CSV for accounting or bind them into a single PDF report.</p>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Mockup Graphic -->
          <div class="relative rounded-2xl bg-gradient-to-br from-slate-2/30 to-bg-primary p-1">
            <div class="absolute inset-0 bg-accent-primary/20 blur-3xl -z-10 rounded-full"></div>
            <div class="bg-bg-secondary rounded-xl overflow-hidden border border-slate-1/40 shadow-elevated">
              <div class="border-b border-slate-1/40 bg-bg-tertiary px-4 py-3 flex items-center gap-2">
                <div class="w-3 h-3 rounded-full bg-error/80"></div>
                <div class="w-3 h-3 rounded-full bg-warning/80"></div>
                <div class="w-3 h-3 rounded-full bg-success/80"></div>
              </div>
              <div class="p-6">
                <!-- Mockup skeleton -->
                <div class="w-3/4 h-6 bg-slate-1/30 rounded mb-6"></div>
                <div class="grid grid-cols-2 gap-4">
                  <div class="h-24 bg-slate-1/20 rounded-lg"></div>
                  <div class="h-24 bg-slate-1/20 rounded-lg"></div>
                  <div class="h-24 bg-slate-1/20 rounded-lg"></div>
                  <div class="h-24 bg-slate-1/20 rounded-lg"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Footer -->
    <footer class="border-t border-slate-1/30 bg-bg-secondary py-12">
      <div class="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
        <div class="flex items-center gap-2">
          <div class="w-6 h-6 rounded bg-accent-primary/15 flex items-center justify-center">
            <svg class="w-3.5 h-3.5 text-accent-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <span class="text-text-primary font-semibold text-sm">SmartScan</span>
        </div>
        <p class="text-text-muted text-sm">© 2026 SmartDoc Scanner. All rights reserved.</p>
      </div>
    </footer>

  </div>
</template>