# Product

## Register

product

## Users

Buddhist practitioners (primary) and scholars (secondary). Practitioners open the app for regular recitation — they know which texts they want, they want to start reading in two taps, and they return daily. Scholars browse the full canon, cross-reference texts, and use bookmarks for research. The practitioner workflow is the critical path.

## Product Purpose

A mobile-first, offline-capable reader for the CBETA Chinese Buddhist canon. Installed as a PWA, it should feel like a native app: no browser chrome, no back button from the OS, smooth navigation, instant text access. Success is a practitioner opening 心經 without thinking about the interface.

## Brand Personality

Modern Zen: clean, approachable, quietly branded. Calm doesn't mean cold — there's warmth in the typography and deliberate restraint in every choice. Not austere, not decorative. Composed.

## Anti-references

- Bible/YouVersion: highlight culture, verse-sharing, motivational cards, bright color accents
- Meditation apps (Calm, Headspace): soft gradients, nature photography, rounded card grids, pastel warmth
- Academic databases (JSTOR): dense tables, serif-heavy bureaucratic layouts, pagination everywhere
- Generic e-readers (Kindle): library shelves, reading streaks, progress gamification

## Design Principles

1. **Text is the product.** The UI should dissolve when reading. Every chrome element competes with the sutra.
2. **Ritual over exploration.** Reduce steps to the most-used texts. The practitioner's path is a reflex, not a journey.
3. **Native-first, not web-wrapped.** Installed means committed. No browser affordances, no hover states as primary interaction, thumb-zone navigation, real page transitions.
4. **Wait with dignity.** No urgent spinners. Loading is quiet. Failure is informative without being alarming.
5. **Economy of means.** Every element earns its space. Restraint is the brand.

## Accessibility & Inclusion

- Target WCAG AA; vertical/horizontal reading modes already supported
- Dyslexia font option already present
- Minimum 44px touch targets enforced in CSS
- Reduce motion: honor `prefers-reduced-motion` for any transitions added
