import type Phaser from "phaser";

/** Rasterize the authored floor, props, signs and walls once, rather than
 * triangulating every Graphics command on every frame. Small tiles also work
 * on devices whose maximum texture size is only 2048. */
export function cacheStaticMap(scene: Phaser.Scene, width: number, height: number) {
  scene.children.depthSort();
  const artwork = [...scene.children.list];
  const tiles: Phaser.GameObjects.RenderTexture[] = [];
  try {
    for (let y = 0; y < height; y += 1024) for (let x = 0; x < width; x += 1024) {
      const tile = scene.add.renderTexture(x, y, Math.min(1024, width - x), Math.min(1024, height - y)).setOrigin(0).setDepth(0);
      tiles.push(tile);
      tile.camera.setScroll(x, y);
      tile.draw(artwork);
    }
  } catch (error) {
    // Keep the original drawing available if the device cannot allocate tiles.
    tiles.forEach(tile => tile.destroy());
    console.warn("Map texture cache unavailable; using original artwork", error);
    return;
  }
  artwork.forEach(object => object.destroy());
}
