# The Orpheus diorama

Orpheus Campus now opens as a stylized 3D diorama. The fixed orthographic camera, low-poly witnesses, muted coral/sage coats, painted room lettering, paper labels and ink edges extend the existing visual identity. Lab benches, racks, archive shelves, plants, fixtures and distinct physical records are authored geometry, not downloaded model packs. The other two maps keep their illustrated renderer.

Campus always selects 3D. The old manual 2D setting has been removed and saved legacy preferences are ignored. Graphics initialization or context failure automatically falls back to an illustrated view with the same physical layout and a visible status message. Other maps retain their illustrated renderer.

The server's two-dimensional coordinates become the 3D floor plane. Camera-relative controls rotate the input vector without changing its magnitude. The existing acceleration, local prediction, remote interpolation, authoritative collisions, line-of-sight visibility, interaction radius and authenticated messages remain in use. Reveal camera framing follows only the completed incident's public result; it never reads private memories. Evidence inspection thumbnails are rendered once from the same meshes using the existing context and cached by object kind.

Performance choices:

- Static campus geometry is batched into three instanced shape draws, one combined ink-edge draw and one room-label atlas draw. Geometry and materials are built once per scene.
- Rigid character parts sharing a material are merged while legs/head retain small skeletal-free animations. Character meshes remain batched by material; extended headwear adds only a small accessory batch. Off-screen witnesses behind walls are hidden using the existing visibility rule.
- There are no shadow maps, postprocessing passes, downloaded textures, physical simulation, extra movement dimensions or additional game socket messages. Lighting uses one hemisphere and one directional light, with painted fixtures and simple contact-shadow discs.
- The renderer targets 60 frames per second. Backing density is capped at 1.5; sustained slow frames lower resolution, and sustained smooth frames restore it with hysteresis. Hidden tabs stop rendering. The mostly static results background renders four times per second.
- Resize dimensions stay positive, including temporary zero-sized containers. Leaving, rematching or losing a context removes input/network listeners and disposes mesh geometry, materials, textures, instancing buffers and the renderer context.
- Both renderers are lazy chunks. Entering the campus loads the 3D chunk; the larger Phaser chunk loads only for an illustrated map, fallback. The title/lobby load neither engine.

Wardrobe, lobby and results use 96 cached WebP portraits rendered from `WitnessModel`, avoiding per-card contexts or animation loops. Rebuild with `scripts/render_witnesses.mjs <path-to-sharp>`.

Verification includes geometry/draw budgets, camera-relative controls, positive framebuffer bounds, local prediction, wall visibility, reconnect reset, removed-player disposal, hidden-tab pause, context failure, adaptive resolution, thumbnail creation, legacy preference removal and fallback. These tests complement browser evidence and real multiplayer cases; they do not establish compatibility with every GPU or browser.

`backend/app/layout.py` supplies one public manifest for 3D art, client prediction, server collision and scripted navigation. Benches, racks, shelves, plants and raised evidence props are solid; paper, glass fragments and footprints remain on the floor. Furniture keeps door approaches open. The CCTV console has moved back from its doorway. Connecting an older saved room moves any witness embedded in new scenery to a nearby walkable spot without changing the incident. Door frames and threshold paint mark actual openings. The incident reveal retains the established sequence panel; this revision changes its underlying campus presentation and camera framing, rather than adding a new historical movement simulation.
