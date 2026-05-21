<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useAuth } from '~/composables/useAuth'

const { user } = useAuth()
const canvasRef = ref(null)

onMounted(() => {
  const canvas = canvasRef.value
  if (!canvas) return
  
  const ctx = canvas.getContext('2d')
  let width = canvas.width = window.innerWidth
  let height = canvas.height = window.innerHeight
  
  const handleResize = () => {
    width = canvas.width = window.innerWidth
    height = canvas.height = window.innerHeight
  }
  window.addEventListener('resize', handleResize)
  
  const dots = []
  const spacing = 35
  const mouse = { x: -1000, y: -1000, radius: 120 }
  
  for (let x = 0; x < width; x += spacing) {
    for (let y = 0; y < height; y += spacing) {
      dots.push({ x, y, baseX: x, baseY: y, vx: 0, vy: 0 })
    }
  }
  
  const handleMouseMove = (e) => {
    const rect = canvas.getBoundingClientRect()
    mouse.x = e.clientX - rect.left
    mouse.y = e.clientY - rect.top
  }
  const handleMouseLeave = () => {
    mouse.x = -1000
    mouse.y = -1000
  }
  
  canvas.addEventListener('mousemove', handleMouseMove)
  canvas.addEventListener('mouseleave', handleMouseLeave)
  
  let animationFrameId
  
  const draw = () => {
    ctx.clearRect(0, 0, width, height)
    
    // Check theme
    const isDark = document.documentElement.classList.contains('dark')
    ctx.fillStyle = isDark ? 'rgba(14, 165, 233, 0.3)' : 'rgba(2, 132, 199, 0.6)'
    
    for (let i = 0; i < dots.length; i++) {
      const dot = dots[i]
      const dx = mouse.x - dot.x
      const dy = mouse.y - dot.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      
      let tx = dot.baseX
      let ty = dot.baseY
      
      if (dist < mouse.radius) {
        const force = (mouse.radius - dist) / mouse.radius
        tx -= dx * force * 0.6
        ty -= dy * force * 0.6
      }
      
      dot.vx += (tx - dot.x) * 0.1
      dot.vy += (ty - dot.y) * 0.1
      dot.vx *= 0.8
      dot.vy *= 0.8
      
      dot.x += dot.vx
      dot.y += dot.vy
      
      ctx.beginPath()
      const dotRadius = isDark ? 1.5 : 2
      ctx.arc(dot.x, dot.y, dotRadius, 0, Math.PI * 2)
      ctx.fill()
    }
    
    animationFrameId = requestAnimationFrame(draw)
  }
  
  draw()
  
  onUnmounted(() => {
    window.removeEventListener('resize', handleResize)
    canvas.removeEventListener('mousemove', handleMouseMove)
    canvas.removeEventListener('mouseleave', handleMouseLeave)
    cancelAnimationFrame(animationFrameId)
  })
})
</script>

<template>
  <div class="min-h-screen bg-bg-primary text-text-primary selection:bg-accent-primary/30 selection:text-white font-sans overflow-x-hidden transition-colors duration-300">
    
    <section class="relative min-h-[90vh] flex flex-col items-center justify-center pt-20 pb-20 overflow-hidden">
      <canvas ref="canvasRef" class="absolute inset-0 z-0 pointer-events-auto opacity-70"></canvas>
      
      <div class="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-accent-primary/20 blur-[120px] rounded-full pointer-events-none z-0 animate-pulse-soft"></div>
      
      <div class="max-w-7xl mx-auto px-6 text-center z-10 animate-slide-up relative">
        <div class="inline-flex bg-slate-1 items-center gap-2 px-4 py-2 rounded-full glass-panel shadow-[0_0_20px_rgba(20,184,166,0.2)] text-sm font-semibold text-accent-secondary mb-10 transform hover:scale-105 hover:shadow-[0_0_30px_rgba(20,184,166,0.3)] transition-all cursor-default">
          <span class="w-2.5 h-2.5 rounded-full bg-warning animate-pulse shadow-[0_0_10px_rgba(245,158,11,1.0)]"></span>
          SmartScan 1.0 is Live
        </div>
        
        <h1 class="text-5xl md:text-6xl lg:text-8xl font-bold font-display tracking-tight mb-6 drop-shadow-xl">
          The Intelligent Workspace<br />
          <span class="text-transparent bg-clip-text bg-gradient-to-r from-accent-primary to-accent-secondary drop-shadow-[0_0_25px_rgba(14,165,233,0.4)]">
            for your Documents.
          </span>
        </h1>
        
        <p class="text-xl md:text-2xl text-text-secondary max-w-3xl mx-auto mb-12 leading-relaxed font-medium drop-shadow-sm">
          More than just a scanner. Extract, categorize, and organize your receipts, invoices, and financial records with finance-grade AI precision.
        </p>
        
        <div class="flex flex-col sm:flex-row items-center justify-center gap-6">
          <NuxtLink v-if="user" to="/dashboard" class="px-10 py-4 bg-accent-primary hover:bg-sky-500 text-white rounded-full font-bold shadow-[0_0_20px_rgba(14,165,233,0.4)] hover:shadow-[0_0_40px_rgba(14,165,233,0.6)] transition-all hover:-translate-y-1 active:scale-95 text-lg flex items-center gap-2">
            Go to Dashboard
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
          </NuxtLink>
          <template v-else>
            <NuxtLink to="/register" class="px-10 py-4 bg-accent-primary hover:bg-sky-500 text-white rounded-xl font-bold shadow-[0_0_20px_rgba(14,165,233,0.4)] hover:shadow-[0_0_40px_rgba(14,165,233,0.6)] transition-all hover:-translate-y-1 active:scale-95 text-lg flex items-center gap-2">
              Start Free Trial
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
            </NuxtLink>
            <NuxtLink to="/login" class="px-10 py-4 glass-panel hover:bg-bg-elevated text-text-primary rounded-xl font-bold shadow-elevated hover:shadow-[0_0_25px_rgba(14,165,233,0.2)] transition-all hover:-translate-y-1 active:scale-95 text-lg">
              Sign In
            </NuxtLink>
          </template>
        </div>
      </div>
    </section>

    <section class="py-32 relative overflow-hidden">
      <div class="absolute inset-0 bg-gradient-to-b from-bg-primary via-bg-secondary to-bg-primary -z-10"></div>
      
      <div class="max-w-7xl mx-auto px-6 relative z-10">
        <div class="text-center mb-20">
          <h2 class="text-4xl md:text-5xl font-display font-bold mb-6 drop-shadow-[0_0_15px_rgba(14,165,233,0.1)]">Calm. Intelligent. Productive.</h2>
          <p class="text-xl text-text-secondary font-medium drop-shadow-sm">A seamless pipeline from physical paper to structured data.</p>
        </div>
        
        <div class="grid md:grid-cols-3 gap-10">
          <div class="glass-panel p-10 rounded-3xl text-center shadow-elevated hover:shadow-[0_0_40px_rgba(14,165,233,0.25)] transform hover:-translate-y-2 transition-all duration-300 group">
            <div class="w-20 h-20 mx-auto bg-accent-primary/15 rounded-2xl flex items-center justify-center mb-8 shadow-[0_0_20px_rgba(14,165,233,0.3)] group-hover:shadow-[0_0_35px_rgba(14,165,233,0.5)] group-hover:scale-110 transition-all duration-300">
              <svg class="w-10 h-10 text-accent-primary group-hover:animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9V5a2 2 0 012-2h4M15 3h4a2 2 0 012 2v4M21 15v4a2 2 0 01-2 2h-4M9 21H5a2 2 0 01-2-2v-4" />
                <line x1="12" y1="8" x2="12" y2="16" stroke-width="2" />
                <line x1="8" y1="12" x2="16" y2="12" stroke-width="2" />
              </svg>
            </div>
            <h3 class="text-2xl font-bold mb-4 text-text-primary">1. Scan & Capture</h3>
            <p class="text-base text-text-secondary leading-relaxed font-medium">High-quality native capture interface designed for speed and clarity on mobile devices.</p>
          </div>

          <div class="glass-panel p-10 rounded-3xl text-center shadow-elevated hover:shadow-[0_0_40px_rgba(20,184,166,0.25)] transform hover:-translate-y-2 transition-all duration-300 group">
            <div class="w-20 h-20 mx-auto bg-accent-secondary/15 rounded-2xl flex items-center justify-center mb-8 shadow-[0_0_20px_rgba(20,184,166,0.3)] group-hover:shadow-[0_0_35px_rgba(20,184,166,0.5)] group-hover:scale-110 transition-all duration-300">
              <svg class="w-10 h-10 text-accent-secondary group-hover:animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            </div>
            <h3 class="text-2xl font-bold mb-4 text-text-primary">2. AI Extraction</h3>
            <p class="text-base text-text-secondary leading-relaxed font-medium">On-device OCR processes vendor names, totals, dates, and line items instantly.</p>
          </div>

          <div class="glass-panel p-10 rounded-3xl text-center shadow-elevated hover:shadow-[0_0_40px_rgba(16,185,129,0.25)] transform hover:-translate-y-2 transition-all duration-300 group">
            <div class="w-20 h-20 mx-auto bg-success/15 rounded-2xl flex items-center justify-center mb-8 shadow-[0_0_20px_rgba(16,185,129,0.3)] group-hover:shadow-[0_0_35px_rgba(16,185,129,0.5)] group-hover:scale-110 transition-all duration-300">
              <svg class="w-10 h-10 text-success group-hover:animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            </div>
            <h3 class="text-2xl font-bold mb-4 text-text-primary">3. Structured Data</h3>
            <p class="text-base text-text-secondary leading-relaxed font-medium">Documents are automatically categorized and synchronized to your secure cloud dashboard.</p>
          </div>
        </div>
      </div>
    </section>

    <section class="py-32 relative overflow-hidden bg-bg-primary">
      <div class="absolute top-1/2 -right-1/4 w-[600px] h-[600px] bg-accent-secondary/10 blur-[150px] rounded-full pointer-events-none z-0"></div>
      
      <div class="max-w-7xl mx-auto px-6 relative z-10">
        <div class="grid lg:grid-cols-2 gap-20 items-center">
          <div>
            <h2 class="text-4xl md:text-5xl font-display font-bold mb-12 drop-shadow-[0_0_15px_rgba(14,165,233,0.1)]">Built for precision.</h2>
            <div class="space-y-12">
              <div class="flex gap-6 group cursor-default">
                <div class="w-16 h-16 rounded-2xl glass-panel shadow-[0_0_15px_rgba(14,165,233,0.2)] flex items-center justify-center flex-shrink-0 group-hover:scale-110 group-hover:-translate-y-1 group-hover:shadow-[0_0_25px_rgba(14,165,233,0.4)] transition-all duration-300">
                  <svg class="w-8 h-8 text-accent-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                </div>
                <div>
                  <h4 class="text-2xl font-bold text-text-primary mb-2 group-hover:text-accent-primary group-hover:drop-shadow-[0_0_8px_rgba(14,165,233,0.3)] transition-all">Instant OCR Processing</h4>
                  <p class="text-base text-text-secondary leading-relaxed font-medium">Extract text and detect key fields from your financial documents in milliseconds using advanced AI models.</p>
                </div>
              </div>
              
              <div class="flex gap-6 group cursor-default">
                <div class="w-16 h-16 rounded-2xl glass-panel shadow-[0_0_15px_rgba(20,184,166,0.2)] flex items-center justify-center flex-shrink-0 group-hover:scale-110 group-hover:-translate-y-1 group-hover:shadow-[0_0_25px_rgba(20,184,166,0.4)] transition-all duration-300">
                  <svg class="w-8 h-8 text-accent-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"/></svg>
                </div>
                <div>
                  <h4 class="text-2xl font-bold text-text-primary mb-2 group-hover:text-accent-secondary group-hover:drop-shadow-[0_0_8px_rgba(20,184,166,0.3)] transition-all">Offline-First Syncing</h4>
                  <p class="text-base text-text-secondary leading-relaxed font-medium">Scan documents without an internet connection. Data is stored safely in IndexedDB and syncs to Supabase when you're back online.</p>
                </div>
              </div>

              <div class="flex gap-6 group cursor-default">
                <div class="w-16 h-16 rounded-2xl glass-panel shadow-[0_0_15px_rgba(16,185,129,0.2)] flex items-center justify-center flex-shrink-0 group-hover:scale-110 group-hover:-translate-y-1 group-hover:shadow-[0_0_25px_rgba(16,185,129,0.4)] transition-all duration-300">
                  <svg class="w-8 h-8 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                </div>
                <div>
                  <h4 class="text-2xl font-bold text-text-primary mb-2 group-hover:text-success group-hover:drop-shadow-[0_0_8px_rgba(16,185,129,0.3)] transition-all">Automated Exports</h4>
                  <p class="text-base text-text-secondary leading-relaxed font-medium">Select multiple documents and export them seamlessly to CSV for accounting or bind them into a single PDF report.</p>
                </div>
              </div>
            </div>
          </div>
          
          <div class="relative rounded-3xl p-1 bg-gradient-to-br from-accent-primary/40 via-transparent to-accent-secondary/40 shadow-[0_0_40px_rgba(14,165,233,0.2)] transform hover:-translate-y-2 hover:shadow-[0_0_60px_rgba(14,165,233,0.4)] transition-all duration-500">
            <div class="absolute inset-0 bg-accent-primary/20 blur-2xl -z-10 rounded-full animate-pulse-soft"></div>
            <div class="glass-panel rounded-[1.4rem] overflow-hidden shadow-2xl">
              <div class="bg-bg-tertiary px-5 py-4 flex items-center gap-3 border-b border-bg-elevated">
                <div class="w-3.5 h-3.5 rounded-full bg-error shadow-[0_0_8px_rgba(239,68,68,1.0)]"></div>
                <div class="w-3.5 h-3.5 rounded-full bg-warning shadow-[0_0_8px_rgba(245,158,11,0.6)]"></div>
                <div class="w-3.5 h-3.5 rounded-full bg-success shadow-[0_0_8px_rgba(16,185,129,0.6)]"></div>
              </div>
              <div class="p-8 bg-bg-elevated/50">
                <div class="w-3/4 h-8 bg-text-muted/20 rounded-lg mb-8 animate-pulse-soft"></div>
                <div class="grid grid-cols-2 gap-6">
                  <div class="h-32 glass-panel rounded-xl flex items-center justify-center shadow-elevated transform hover:-translate-y-1 hover:shadow-[0_0_20px_rgba(14,165,233,0.4)] transition-all">
                    <svg class="w-10 h-10 text-accent-primary/70 animate-pulse drop-shadow-[0_0_5px_rgba(14,165,233,0.5)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                  </div>
                  <div class="h-32 glass-panel rounded-xl flex items-center justify-center shadow-elevated transform hover:-translate-y-1 hover:shadow-[0_0_20px_rgba(20,184,166,0.4)] transition-all">
                    <svg class="w-10 h-10 text-accent-secondary/70 animate-pulse drop-shadow-[0_0_5px_rgba(20,184,166,0.5)]" style="animation-delay: 0.5s" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                  </div>
                  <div class="h-32 glass-panel rounded-xl flex items-center justify-center shadow-elevated transform hover:-translate-y-1 hover:shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-all">
                    <svg class="w-10 h-10 text-success/70 animate-pulse drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]" style="animation-delay: 1s" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/></svg>
                  </div>
                  <div class="h-32 glass-panel rounded-xl flex items-center justify-center shadow-elevated transform hover:-translate-y-1 hover:shadow-[0_0_20px_rgba(14,165,233,0.4)] transition-all">
                    <svg class="w-10 h-10 text-text-muted/70 animate-pulse" style="animation-delay: 1.5s" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <footer class="bg-bg-secondary border-t border-slate-1/50 py-14">
      <div class="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
        <div class="flex items-center gap-3 group cursor-default">
          <div class="w-10 h-10 rounded-xl glass-panel flex items-center justify-center shadow-[0_0_15px_rgba(14,165,233,0.3)] group-hover:scale-110 group-hover:shadow-[0_0_25px_rgba(14,165,233,0.6)] transition-all">
            <svg class="w-5 h-5 text-accent-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <span class="text-text-primary font-bold text-xl tracking-tight">SmartScan</span>
        </div>
        <p class="text-text-muted font-medium text-sm">© 2026 SmartDoc Scanner. All rights reserved.</p>
      </div>
    </footer>

  </div>
</template>