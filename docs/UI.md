# Readable field-kit interface

The UI uses a shared scale in `frontend/src/readability.css`: `--font-body: 1rem` for reading and controls, and `--font-caption: .875rem` for secondary labels. At the browser's default text size these are 16 and 14 CSS pixels. There are no smaller visible CSS text declarations; intentional zero-size labels keep existing icon-only controls. Browser text scaling still applies.

The scale covers the title menu, room setup, wardrobe, lobby, investigation HUD, tutorial, memory journal, testimony, source cards, deductions, floor-plan guide, radio/voice, settings, loading, reveal and results. The title screen scrolls when its larger content needs more height. Narrow layouts wrap content instead of reducing reading text. Switches and ordinary buttons have at least 44-pixel targets, and mobile coat swatches use four columns. Three-dimensional witness labels and chat previews use larger cached lettering; long speech previews are shortened while Radio retains the complete message.

The tutorial is a clipped notebook on a dark board, with a ruled paper leaf, margin line, metal clasp and task slip. Only the leaf scrolls; the header and Back/Next controls remain available. The current chapter resets its leaf to the top. Minimizing the notebook reveals the world for movement.

Dossiers use cloth-colored bindings, a punched margin and an ink-stamped heading. Their heading and close control stay visible during scrolling. Testimony appears on taped sheets. The shared reconstruction uses a woven backing, clipped source papers, pinned numbered cards and a red sequence thread. Text remains upright. Verified, missing and disputed facts retain textual labels as well as color.

Decoration uses CSS and existing meshes/fonts. There are no new image downloads, live light passes, texture-generation loops or frame-by-frame React state updates. The shared server, collision, voting, evidence and account rules are unchanged. Interrupted world-chunk imports now show an explicit reload action rather than an empty screen.
