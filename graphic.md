Plan Assetów w Stylu cofounder.co
Struktura folderów
apps/web/public/
├── images/
│   ├── hero/
│   │   ├── hero-bg.jpg
│   │   └── hero-mockup.png
│   ├── features/
│   │   ├── feature-research.png
│   │   ├── feature-inbox.png
│   │   ├── feature-planning.png
│   │   ├── feature-voice.png
│   │   └── feature-receipt.png
│   ├── workflow/
│   │   └── agent-flow.png
│   ├── agents/
│   │   ├── orb-coordinator.png
│   │   ├── orb-research.png
│   │   ├── orb-inbox.png
│   │   ├── orb-planning.png
│   │   └── orb-summary.png
│   └── social/
│       └── og-image.jpg
---
### Lista Obrazków do Wygenerowania
#### 1. `hero-bg.jpg` (1920x1080)
**Prompt:**  
*"Dark futuristic SaaS hero background, deep black and charcoal gradient, subtle purple and teal neon glow emanating from center-bottom, soft bokeh light particles, abstract floating geometric shapes, glassmorphism texture, noise grain overlay, cinematic lighting, 8k, ultra minimal, premium tech aesthetic --ar 16:9"*
**Gdzie:** `public/images/hero/hero-bg.jpg`  
**Użycie:** Tło hero section, `background-image` z `object-cover`
---
2. hero-mockup.png (1600x1000, transparent background)
Prompt:  
"Modern dark-mode SaaS dashboard interface mockup floating at slight angle, showing voice chat panel with audio waveform, agent timeline with status badges, cost breakdown panel, clean glassmorphism UI cards, subtle purple and teal accent glows, deep navy/black background, isometric perspective, soft shadow beneath, no text labels, premium UI design --ar 16:9 --transparent"
Gdzie: public/images/hero/hero-mockup.png  
Użycie: Główny obrazek w hero, po prawej stronie nagłówka
---
3. feature-research.png (800x600)
Prompt:  
"Abstract 3D visualization of web research, dark background, glowing interconnected nodes and search query bubbles floating in space, cyan and teal light trails, data streams flowing between nodes, glass spheres containing webpage icons, futuristic network graph, soft bloom lighting, minimal clean composition --ar 4:3"
Gdzie: public/images/features/feature-research.png  
Użycie: Karta "Apply to Jobs" / "Deep Research"
---
4. feature-inbox.png (800x600)
Prompt:  
"Abstract 3D visualization of email inbox automation, dark background, floating translucent envelopes with soft glow, messages sorting into priority streams indicated by colored light trails, lavender and white accents, glassmorphism cards floating in space, clean minimal tech aesthetic --ar 4:3"
Gdzie: public/images/features/feature-inbox.png  
Użycie: Karta "Manage Inbox"
---
5. feature-planning.png (800x600)
Prompt:  
"Abstract 3D visualization of calendar planning, dark background, floating circular clock elements and timeline blocks arranged in spiral, soft amber and teal glows, glassmorphism scheduling bars, time flowing as light particles, futuristic minimal composition --ar 4:3"
Gdzie: public/images/features/feature-planning.png  
Użycie: Karta "Plan Your Day"
---
6. feature-voice.png (800x600)
Prompt:  
"Abstract 3D visualization of voice AI conversation, dark background, floating sound wave rings emanating from center, microphone orb with soft teal glow, voice waveform particles flowing upward, glassmorphism speech bubbles, ethereal cyan lighting, clean futuristic minimal --ar 4:3"
Gdzie: public/images/features/feature-voice.png  
Użycie: Karta "Pre-Interview Research" (voice-focused)
---
7. feature-receipt.png (800x600)
Prompt:  
"Abstract 3D visualization of blockchain receipt, dark background, holographic document floating with Solana logo glow, cryptographic hash rings spinning around it, purple and green neon verification badges, glassmorphism certificate texture, futuristic proof-of-work aesthetic --ar 4:3"
Gdzie: public/images/features/feature-receipt.png  
Użycie: Karta "Session Summary" / on-chain receipts
---
8. agent-flow.png (1600x600)
Prompt:  
"Minimal dark workflow diagram showing 5 connected AI agents as glowing orbs in horizontal flow, coordinator orb in center with branching connections to research inbox planning summary orbs, thin light trails between nodes, subtle labels beneath each orb, deep black background, glassmorphism connection lines, soft bloom, premium tech diagram aesthetic --ar 21:9"
Gdzie: public/images/workflow/agent-flow.png  
Użycie: Sekcja "How it works" / agent architecture
---
9-13. orb-*.png (5 obrazków, 400x400 każdy, transparent)
Prompt template:  
"Glowing abstract 3D orb/node floating in dark void, COLOR soft volumetric glow, glassmorphism core with subtle inner light, pulsating energy rings, particle halo, isolated on transparent background, premium tech icon, minimal clean --ar 1:1 --transparent"
Nazwa pliku	Kolor akcentu
orb-coordinator.png	Teal/cyan
orb-research.png	Amber/gold
orb-inbox.png	Lavender/purple
orb-planning.png	Emerald/green
orb-summary.png	Rose/pink
Gdzie: public/images/agents/  
Użycie: Timeline events, agent avatars, about page
---
14. og-image.jpg (1200x630)
Prompt:  
"Sleek dark SaaS product banner, Solli voice operator branding, abstract voice waveform and blockchain nodes, tagline space at bottom, deep black to dark purple gradient, teal accent glow, premium tech conference poster aesthetic, cinematic --ar 1200:630"
Gdzie: public/images/social/og-image.jpg  
Użycie: Open Graph meta tag, Twitter card
---
Instrukcje Generowania
Narzędzia AI (polecam w tej kolejności):
1. Midjourney v6 - najlepsze do abstrakcji 3D i glassmorphism
2. DALL-E 3 - dobre do UI mockupów
3. Ideogram 2.0 - najlepsze do tekstu na obrazkach (jeśli potrzebujesz)
Parametry dla Midjourney:
--style raw --stylize 250 --v 6
Dla przezroczystych tła:
Dodaj do prompta: --transparent (Midjourney) lub wygeneruj z tłem i wyczyść w remove.bg lub Photoshop AI.
---