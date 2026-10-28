# The Orpheus diorama

Orpheus Campus now opens as a stylized 3D diorama. The fixed orthographic camera, low-poly witnesses, muted coral/sage coats, painted room lettering, paper labels and ink edges extend the existing visual identity. Lab benches, racks, archive shelves, plants, fixtures and distinct physical records are authored geometry, not downloaded model packs. The other two maps keep their illustrated renderer.

Settings → Campus view switches between 3D diorama and 2D illustration. The selection persists locally; it still works for the current session when storage is blocked. Graphics initialization or context failure falls back to the illustrated renderer and displays a status message. This release adds no new account requirements or game rules.

The server's two-dimensional coordinates become the 3D floor plane. Camera-relative controls rotate the input vector without changing its magnitude. The existing acceleration, local prediction, remote interpolation, authoritative collisions, line-of-sight visibility, interaction radius and authenticated messages remain in use. Reveal camera framing follows only the completed incident's public result; it never reads private memories. Evidence inspection thumbnails are rendered once from the same meshes using the existing context and cached by object kind.

Performance choices:

- Static campus geometry is batched into three instanced shape draws, one combined ink-edge draw and one room-label atlas draw. Geometry and materials are built once per scene.
- Rigid character parts sharing a material are merged while legs/head retain small skeletal-free animations. Each witness uses at most eleven mesh draws, plus its name label. Off-screen witnesses behind walls are hidden using the existing visibility rule.
- There are no shadow maps, postprocessing passes, downloaded textures, physical simulation, extra movement dimensions or additional game socket messages. Lighting uses one hemisphere and one directional light, with painted fixtures and simple contact-shadow discs.
- The renderer targets 60 frames per second. Backing density is capped at 1.5; sustained slow frames lower resolution, and sustained smooth frames restore it with hysteresis. Hidden tabs stop rendering. The mostly static results background renders four times per second.
- Resize dimensions stay positive, including temporary zero-sized containers. Leaving, switching views, rematching or losing a context removes input/network listeners and disposes mesh geometry, materials, textures, instancing buffers and the renderer context.
- Both renderers are lazy chunks. Entering the campus loads the 3D chunk; the larger Phaser chunk loads only for an illustrated map, explicit 2D selection or fallback. The title/lobby load neither engine.

Verification includes geometry/draw budgets, camera-relative controls, positive framebuffer bounds, local prediction, wall visibility, reconnect reset, removed-player disposal, hidden-tab pause, context failure, adaptive resolution, thumbnail creation, saved view selection and fallback. These tests complement browser evidence and real multiplayer cases; they do not establish compatibility with every GPU or browser.

The server and map collision geometry have not changed. Cosmetic furniture does not add new collision obstacles. The incident reveal retains the established sequence panel; this revision changes its underlying campus presentation and camera framing, rather than adding a new historical movement simulation.
