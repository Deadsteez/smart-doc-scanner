# SmartDoc Scanner UI Redesign Plan

This plan outlines the redesign of the SmartDoc Scanner UI to align with the "Calm Intelligent Productivity" design system, focusing on a premium, intelligent financial workspace aesthetic.

## User Review Required

> [!IMPORTANT]  
> Please review the proposed changes, particularly the adoption of the `shadcn-vue` component library and the new mobile layout structure.

## Open Questions

> [!QUESTION]  
> 1. Should we completely replace the current `AppNavbar.vue` with a new component or progressively refactor it?
> 2. For the Landing Page reactive dot grid background, do we want to use a specific library like `particles.js` or implement a custom Canvas/SVG solution?
> 3. Should we set up `shadcn-vue` right away, which involves running an initialization command and potentially overwriting some base styles?

## Proposed Changes

---

### Configuration & Dependencies

Update tailwind theme, fonts, and install necessary libraries.

#### [MODIFY] [tailwind.config.js](file:///c:/Desktop/coding/Industry%20project%20-%20smart%20doc%20scanner/smart-doc-scanner/tailwind.config.js)
- Implement the "Deep Blue + Slate Productivity Theme" color tokens (`bg-primary`, `bg-secondary`, `slate-1`, `accent-primary`, etc.).
- Add font family configurations for `Inter` (sans) and `Space Grotesk` (display).
- Add new `border-radius` values for `rounded-xl` components.

#### [MODIFY] [package.json](file:///c:/Desktop/coding/Industry%20project%20-%20smart%20doc%20scanner/smart-doc-scanner/package.json)
- Add dependencies: `lucide-vue-next` (icons), `@vueuse/motion` (animations), `clsx`, `tailwind-merge` (for shadcn-vue).
- Add Google Fonts for `Inter` and `Space Grotesk` via Nuxt config.

---

### Layouts & Root

Establish the "Adaptive Navbar + Focused Workspace" architecture.

#### [MODIFY] [app.vue](file:///c:/Desktop/coding/Industry%20project%20-%20smart%20doc%20scanner/smart-doc-scanner/app.vue)
- Apply the new root background color (`bg-primary`) and default text color (`text-primary`).
- Ensure the font family is globally set to `Inter`.
- Consider introducing a `layouts/default.vue` for shared structure (Navbar, Mobile Bottom Nav).

#### [NEW] [layouts/default.vue](file:///c:/Desktop/coding/Industry%20project%20-%20smart%20doc%20scanner/smart-doc-scanner/layouts/default.vue)
- Will contain the `FloatingTopNavbar` for desktop and `BottomNavigation` for mobile.
- Wrapper for the main workspace area.

---

### Components

Redesign core components with soft borders, depth, and rounded-xl styling.

#### [MODIFY] [components/AppNavbar.vue](file:///c:/Desktop/coding/Industry%20project%20-%20smart%20doc%20scanner/smart-doc-scanner/components/AppNavbar.vue)
- Redesign as a "Floating Top Navbar" with subtle glassmorphism.
- Include quick actions, global search trigger, and user profile.

#### [NEW] [components/BottomNavigation.vue](file:///c:/Desktop/coding/Industry%20project%20-%20smart%20doc%20scanner/smart-doc-scanner/components/BottomNavigation.vue)
- Native-inspired bottom navigation for mobile PWA (Home, Scan, Documents, Profile).
- Central "Floating Scan Button" implementation.

#### [MODIFY] [components/DocumentCard.vue](file:///c:/Desktop/coding/Industry%20project%20-%20smart%20doc%20scanner/smart-doc-scanner/components/DocumentCard.vue)
- Update styling to use `bg-elevated`, subtle borders, and `rounded-xl`.
- Enhance typography for metadata readability.

#### [MODIFY] [components/CameraCapture.vue](file:///c:/Desktop/coding/Industry%20project%20-%20smart%20doc%20scanner/smart-doc-scanner/components/CameraCapture.vue)
- Modernize the capture interface. Ensure high readability and minimal distraction during the scanning process.

---

### Pages

Apply the new visual identity to application views.

#### [MODIFY] [pages/index.vue](file:///c:/Desktop/coding/Industry%20project%20-%20smart%20doc%20scanner/smart-doc-scanner/pages/index.vue)
- Implement the "Landing Page Architecture".
- Add `Space Grotesk` typography for the Hero Title.
- Incorporate a reactive background and floating product mockups.

#### [MODIFY] [pages/login.vue](file:///c:/Desktop/coding/Industry%20project%20-%20smart%20doc%20scanner/smart-doc-scanner/pages/login.vue) & [register.vue](file:///c:/Desktop/coding/Industry%20project%20-%20smart%20doc%20scanner/smart-doc-scanner/pages/register.vue)
- Update authentication forms to use the new input component styles (subtle borders, strong focus states).

## Verification Plan

### Automated Tests
- Build the Nuxt application (`npm run build`) to ensure no typescript/compilation errors are introduced.

### Manual Verification
- Review the application on desktop to verify the floating navbar and centered workspace layout.
- Review the application on mobile (using browser DevTools device emulation) to confirm the bottom navigation, floating scan button, and stacked views.
- Test Dark/Light mode toggle to ensure correct application of the Slate Productivity theme tokens.
