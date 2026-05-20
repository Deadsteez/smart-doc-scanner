# SmartDoc Scanner — AI UI Redesign Design System

## Version 1.0 — Production UI Blueprint

---

# 1. Project Vision

SmartDoc Scanner is not just a document scanner.

The product should feel like:

> “An intelligent financial workspace for managing and understanding documents effortlessly.”

The UI must communicate:

* trust
* productivity
* intelligence
* speed
* clarity
* modernity

WITHOUT:

* excessive futuristic gimmicks
* noisy gradients
* over-animation
* crypto-style dashboards
* gaming aesthetics

The final experience should resemble a blend of:

* Linear
* Raycast
* Perplexity
* Granola
* Stripe Dashboard

---

# 2. Product Design Philosophy

## Core UX Philosophy

### “Calm Intelligent Productivity”

The interface should:

* feel alive but not distracting
* feel modern but highly readable
* feel premium but lightweight
* feel intelligent but not overwhelming

---

# 3. Visual Identity

# Primary Identity

## Ambient Technical Workspace

The application should visually communicate:

* modern productivity
* technical elegance
* structured workflows
* intelligent automation
* calm focus

---

# 4. Design Direction

| Category      | Final Direction                             |
| ------------- | ------------------------------------------- |
| Product Feel  | Minimal Productivity + Ambient AI           |
| Layout        | Triple Pane Workspace                       |
| Motion        | Ambient on landing, minimal in app          |
| Theme         | Adaptive Dark/Light                         |
| Glassmorphism | Light/Subtle only                           |
| Mobile UX     | Native-inspired PWA                         |
| AI UX         | Optional Copilot Architecture               |
| Backgrounds   | Ambient textures + selective reactive grids |
| Branding      | Technical + trustworthy                     |

---

# 5. Theme System

# Primary Theme

## Deep Blue + Slate Productivity Theme

Avoid:

* purple AI clichés
* excessive neon gradients
* bright cyberpunk colors

Focus on:

* deep navy
* slate surfaces
* soft cyan highlights
* subtle teal success accents

---

# 6. Color Palette

# Base Colors

## Background Layers

| Token        | Color   |
| ------------ | ------- |
| bg-primary   | #0F172A |
| bg-secondary | #111827 |
| bg-tertiary  | #1E293B |
| bg-elevated  | #243041 |

---

## Slate System

| Token   | Color   |
| ------- | ------- |
| slate-1 | #334155 |
| slate-2 | #475569 |
| slate-3 | #64748B |

---

## Accent Colors

| Token            | Color   |
| ---------------- | ------- |
| accent-primary   | #0EA5E9 |
| accent-secondary | #14B8A6 |
| success          | #10B981 |
| warning          | #F59E0B |
| error            | #EF4444 |

---

## Text Colors

| Token          | Color   |
| -------------- | ------- |
| text-primary   | #F8FAFC |
| text-secondary | #CBD5E1 |
| text-muted     | #94A3B8 |

---

# 7. Glow & Ambient Effects

Glow should be:

* subtle
* soft
* low opacity
* professional

Allowed glow colors:

* cyan
* teal
* soft blue

Avoid:

* neon purple
* oversaturated pink
* strong bloom effects

---

# 8. Typography System

# Primary Font

## Inter

Used for:

* body text
* dashboards
* forms
* OCR views
* navigation

---

# Secondary Font (Optional)

## Space Grotesk

Used ONLY for:

* landing page hero titles
* marketing sections

NOT inside workspace UI.

---

# Typography Hierarchy

| Element       | Weight  |
| ------------- | ------- |
| Hero Title    | 700     |
| Section Title | 600     |
| Card Heading  | 600     |
| Body          | 400–500 |
| Metadata      | 400     |

---

# 9. Layout System

# Desktop Layout

## Triple Pane Workspace

| Panel           | Purpose                  |
| --------------- | ------------------------ |
| Left Sidebar    | Navigation               |
| Middle Panel    | Document Explorer        |
| Right Workspace | Document + OCR + Actions |

---

# Mobile Layout

## Native-inspired PWA Layout

### Bottom Navigation

* Home
* Scan
* Documents
* Insights
* Profile

### Floating Scan Button

Persistent FAB for document capture.

---

# 10. Motion System

# Landing Page Motion

### Ambient Motion Allowed

Includes:

* floating SVGs
* reactive dot grids
* subtle parallax
* glow pulses
* animated mockups
* smooth scroll transitions

Motion should feel:

* smooth
* premium
* intelligent

NOT:

* flashy
* chaotic
* game-like

---

# App Motion

### Minimal Professional Motion

Allowed:

* hover elevation
* fade transitions
* smooth state changes
* loading shimmer
* subtle floating microinteractions

Avoid:

* bouncing
* exaggerated transforms
* excessive parallax
* distracting animations

---

# 11. Background System

# Landing Page

## Reactive Dot Grid Background

Allowed:

* cursor distortion
* subtle gravity interactions
* ambient particle effects

ONLY for:

* hero sections
* onboarding
* feature showcases

---

# Workspace UI

## Ambient Slate Texture

Use:

* soft gradients
* subtle noise textures
* depth layers
* muted surfaces

Avoid:

* animated backgrounds
* strong gradients behind content
* heavy visual clutter

---

# 12. Glassmorphism Rules

Glassmorphism should be:

* subtle
* lightweight
* readability-safe

Allowed for:

* navbars
* floating panels
* modals
* command palettes
* AI assistant widgets

Avoid glass effects in:

* OCR text
* tables
* forms
* invoices
* detailed content areas

---

# 13. Component Design Rules

# Buttons

Style:

* rounded-xl
* soft shadows
* subtle hover glow
* strong contrast

---

# Cards

Cards should:

* have depth
* use soft borders
* maintain spacing consistency
* use muted elevated backgrounds

---

# Inputs

Inputs should:

* feel native
* use subtle borders
* have strong focus states
* maintain high readability

---

# Modals

Use:

* soft blur
* elevated surfaces
* centered layouts
* minimal distractions

---

# 14. Landing Page Architecture

# Landing Page Goals

The landing page should:

* impress visually
* explain the product quickly
* demonstrate intelligence
* communicate trust
* showcase responsiveness

---

# Landing Page Sections

## Hero Section

Contains:

* animated product mockup
* reactive grid background
* floating UI elements
* CTA buttons

---

## Features Section

Use:

* animated cards
* floating SVGs
* subtle interactions

---

## Workflow Section

Demonstrate:

* scan
* OCR
* extraction
* organization

---

## Integrations Carousel

Raycast-style integrations carousel.

---

# 15. Workspace UX

# Workspace Should Prioritize

* readability
* efficiency
* organization
* searchability
* structured workflows

---

# Important Workspace Features

## Document Explorer

Includes:

* filters
* tags
* search
* sorting
* categories

---

## OCR View

Should:

* maximize readability
* minimize visual noise
* allow editing
* show confidence indicators

---

## Actions Panel

Contains:

* export
* categorize
* rename
* sync
* AI suggestions (optional)

---

# 16. Responsive Design Rules

# Mobile-First Priority

The app MUST:

* work flawlessly on phones
* support gestures
* support touch interactions
* feel app-like

---

# Breakpoints

| Device  | Behavior         |
| ------- | ---------------- |
| Mobile  | stacked layouts  |
| Tablet  | hybrid panels    |
| Desktop | full triple-pane |

---

# 17. Offline-First UX

The UI must clearly communicate:

* sync state
* offline state
* local storage state
* queued uploads

Use:

* subtle indicators
* toast messages
* sync badges

Avoid intrusive popups.

---

# 18. Accessibility Rules

The UI MUST:

* support keyboard navigation
* maintain accessible contrast
* support reduced motion
* use readable font sizes
* use large touch targets

---

# 19. Recommended Frontend Architecture

# Stack

* Nuxt 4
* Vue 3
* Tailwind CSS

---

# Recommended Libraries

| Purpose    | Library                    |
| ---------- | -------------------------- |
| Components | shadcn-vue                 |
| Icons      | lucide-vue-next            |
| Motion     | Motion One / VueUse Motion |
| Charts     | ECharts                    |
| PWA        | @vite-pwa/nuxt             |

---

# 20. Tailwind Design Token Strategy

Use:

* semantic color tokens
* centralized spacing
* reusable shadows
* component variants

Avoid hardcoded colors.

---

# 21. AI Redesign Instructions

# Instructions for AI/UI Generation

When redesigning or generating UI for SmartDoc Scanner:

## ALWAYS FOLLOW THESE RULES

### Visual Style

* Use deep blue/slate productivity themes
* Use subtle teal/cyan highlights
* Maintain calm professional aesthetics
* Avoid excessive gradients
* Avoid flashy neon visuals

---

### Motion

* Keep workspace motion minimal
* Use ambient motion only in landing/onboarding
* Prioritize readability over animation

---

### Layout

* Prefer triple-pane workspace layouts
* Maintain clear visual hierarchy
* Prioritize productivity workflows

---

### Mobile UX

* Design mobile-first
* Ensure touch-friendly interactions
* Use bottom navigation
* Include floating scan action button

---

### Components

* Use rounded-xl components
* Use soft borders
* Maintain consistent spacing
* Use elevated surfaces for hierarchy

---

### Glassmorphism

* Use only subtle glass effects
* Never reduce OCR readability
* Avoid transparent text containers

---

### Landing Page

* Use reactive dot grid backgrounds
* Use floating mockups
* Use animated SVG illustrations
* Maintain premium startup feel

---

### Workspace UI

* Keep UI structured and calm
* Focus on readability
* Focus on efficient document management
* Maintain enterprise-grade clarity

---

### Accessibility

* Ensure strong contrast
* Ensure keyboard accessibility
* Respect reduced motion settings

---

# 22. Final Product Goal

The final application should feel like:

> “A premium intelligent document workspace that combines the clarity of productivity tools with the elegance of modern AI-native interfaces.”

The UI should:

* impress users immediately
* remain highly usable long-term
* scale cleanly
* feel native across desktop and mobile
* support offline-first workflows
* maintain finance-grade trust and readability
