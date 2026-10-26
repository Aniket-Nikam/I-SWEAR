# Art Direction

## Design read

Stylized investigative noir inside a retro-futurist university facility. The scene should resemble a carefully built game level, not a dashboard behind a dark theme.

## Visual dials

- Design variance: 7. The facility is asymmetrical but easy to navigate.
- Motion intensity: 6. Movement, camera easing, object pulses, and overlays communicate state.
- Visual density: 6. The world contains environmental texture while the HUD remains restrained.

## Palette

- Near-black navy: `#080d12`
- Facility charcoal: `#17222b`
- Structural gray: `#42515a`
- Sodium orange: `#c58145`
- Pale cyan: `#8bbfc3`
- Warning red: `#a64f4f`
- Documentary paper: `#d8d5c9`

Orange represents the facility and primary action. Cyan represents inspection and live information. Red is reserved for warnings.

## Typography

- Bahnschrift for compressed display and room signage
- Aptos or Segoe UI for readable body text
- Cascadia Mono for room codes, logs, and system labels

## Shape language

World architecture is chunky and rectilinear. Interface surfaces use two- to three-pixel radii, hard borders, and dossier-like top rules. Character silhouettes share one scale with distinct authored colors.

## Motion

Only stateful motion is used: camera follow, walking frames, proximity pulses, connection feedback, and overlay transitions. Reduced-motion preferences collapse nonessential animation.

## Environment and sound

WorldArt draws lab benches, camera displays, server racks, file cabinets, signage, and floor markings once. Each inspectable type has a consistent authored silhouette; the inspection closeup uses a thumbnail generated from the same object geometry. The central atrium uses an etched circular floor motif, keeping the walking route clear.

WebAudio provides a quiet electrical drone, footsteps, inspection taps, evidence chimes, a low clash interval, and a restrained reveal chord. A user gesture unlocks audio; mute and volume persist locally. Every cue also has a visible message. Physical audio playback quality has not been reviewed on multiple devices.
