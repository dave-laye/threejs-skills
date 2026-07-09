---
name: threejs-utils
description: Shared Three.js boilerplate helpers - renderer/scene bootstrap, resize handling, render loop, pointer-to-NDC conversion, and resource disposal. Use when wiring up the setup/teardown scaffolding that every scene needs instead of hand-rolling it.
---

# Three.js Shared Utilities

The other skills contain the same setup/teardown boilerplate over and over:
creating a renderer, bootstrapping a scene + camera, syncing on resize, running
the animation loop, converting pointer events to NDC, and disposing GPU
resources. Those patterns are implemented once in
[`lib/three-utils.js`](../../lib/three-utils.js) so examples can import them
instead of copy/pasting.

```javascript
import {
  createScene,
  bindResize,
  createRenderLoop,
  getPointerNDC,
  disposeObject,
} from "../../lib/three-utils.js";
```

## Quick Start

```javascript
import * as THREE from "three";
import {
  createScene,
  bindResize,
  createRenderLoop,
} from "../../lib/three-utils.js";

// Bootstrap scene + perspective camera + renderer (canvas is mounted for you)
const { scene, camera, renderer } = createScene({ background: 0x101010 });

const cube = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshStandardMaterial({ color: 0x00ff00 }),
);
scene.add(cube);
scene.add(new THREE.AmbientLight(0xffffff, 0.5));

// Keep camera/renderer in sync with the window
bindResize(camera, renderer);

// Render loop with delta/elapsed timing
const loop = createRenderLoop({
  renderer,
  scene,
  camera,
  update: (delta) => {
    cube.rotation.x += delta;
    cube.rotation.y += delta;
  },
});
loop.start();
```

## API

### `createRenderer(options)`

Create a configured `WebGLRenderer`. Applies `setSize` and a clamped pixel
ratio (`Math.min(devicePixelRatio, max)`), plus sensible color-space and
tone-mapping defaults. Pass `mount: true` to append the canvas to `container`
(defaults to `document.body`).

```javascript
const renderer = createRenderer({ antialias: true, mount: true });
```

### `createScene(options)`

Bootstrap `{ scene, camera, renderer }` in one call.

| Option           | Default        | Description                            |
| ---------------- | -------------- | -------------------------------------- |
| `fov`            | `75`           | Perspective camera field of view       |
| `near` / `far`   | `0.1` / `1000` | Clipping planes                        |
| `background`     | `null`         | Color hex/string/`THREE.Color`         |
| `cameraPosition` | `[0, 0, 5]`    | Initial camera position                |
| `mount`          | `true`         | Append renderer canvas to the document |
| `renderer`       | —              | Reuse an existing renderer             |

### `resizeRendererToDisplay(camera, renderer, options)`

Resize a camera + renderer (and optional `composer`) to a target size,
defaulting to the current viewport. Updates the camera aspect and projection
matrix. Pass an `onResize({ width, height })` callback for extra work (e.g.
updating pass-specific resolutions).

### `bindResize(camera, renderer, options)`

Attach a `window` resize listener that calls `resizeRendererToDisplay`. Returns
an unsubscribe function.

```javascript
const off = bindResize(camera, renderer, { composer });
// later: off();
```

### `createRenderLoop(options)`

Create a `requestAnimationFrame` loop backed by a `THREE.Clock`. The
`update(delta, elapsed)` callback runs each frame before rendering. Pass a
`composer` to render through an `EffectComposer` instead of the renderer.
Returns `{ start, stop }`.

### `getPointerNDC(event, out?, element?)`

Convert a mouse/touch/pointer event to normalized device coordinates
(`[-1, 1]`). Uses the first touch for touch events. Pass an `element` to convert
relative to its bounding rect; pass a Vector2-like `out` to write in place.
Always returns `{ x, y }`.

```javascript
const mouse = new THREE.Vector2();
window.addEventListener("pointermove", (event) => {
  getPointerNDC(event, mouse);
  raycaster.setFromCamera(mouse, camera);
});
```

### `disposeObject(object, options)`

Dispose an object's GPU resources — geometry, material(s) and any textures
referenced by those materials — then detach it from its parent. Traverses the
whole subtree unless `recursive: false`.

```javascript
disposeObject(mesh); // recursive by default
```

### `clampedPixelRatio(max)` / `getViewportSize()`

Small helpers used by the above: the clamped device pixel ratio and the current
`{ width, height }` viewport size (with off-DOM fallbacks).

## See Also

- `threejs-fundamentals` - Scene, camera, renderer, disposal concepts
- `threejs-interaction` - Raycasting and pointer input that build on `getPointerNDC`
- `threejs-postprocessing` - EffectComposer loops that use `createRenderLoop`
