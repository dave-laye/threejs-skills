/**
 * Shared Three.js boilerplate helpers.
 *
 * These utilities capture the setup/teardown patterns that recur across the
 * skill files (renderer creation, scene bootstrap, resize handling, the
 * render loop, pointer-to-NDC conversion, and resource disposal) so examples
 * can reference a single implementation instead of copy/pasting boilerplate.
 *
 * All helpers are framework-agnostic ESM and expect `three` to be available in
 * the consuming project.
 */

import * as THREE from "three";

/** Device pixel ratio clamped to a sane maximum (defaults to 2). */
export function clampedPixelRatio(max = 2) {
  const ratio =
    typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  return Math.min(ratio, max);
}

/** Current viewport size, falling back to sensible defaults off-DOM. */
export function getViewportSize() {
  if (typeof window === "undefined") {
    return { width: 1, height: 1 };
  }
  return { width: window.innerWidth, height: window.innerHeight };
}

/**
 * Create a configured WebGLRenderer.
 *
 * Applies the size + clamped pixel-ratio pattern used throughout the skills
 * and, when `mount` is true, appends the canvas to `container`.
 */
export function createRenderer({
  canvas,
  antialias = true,
  alpha = false,
  powerPreference = "high-performance",
  width,
  height,
  maxPixelRatio = 2,
  outputColorSpace = THREE.SRGBColorSpace,
  toneMapping = THREE.ACESFilmicToneMapping,
  toneMappingExposure = 1.0,
  mount = false,
  container = typeof document !== "undefined" ? document.body : undefined,
} = {}) {
  const size = getViewportSize();
  const w = width ?? size.width;
  const h = height ?? size.height;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias,
    alpha,
    powerPreference,
  });
  renderer.setSize(w, h);
  renderer.setPixelRatio(clampedPixelRatio(maxPixelRatio));
  renderer.outputColorSpace = outputColorSpace;
  renderer.toneMapping = toneMapping;
  renderer.toneMappingExposure = toneMappingExposure;

  if (mount && container && !canvas) {
    container.appendChild(renderer.domElement);
  }

  return renderer;
}

/**
 * Bootstrap a scene, perspective camera and renderer in one call.
 *
 * Returns `{ scene, camera, renderer }`. Pass `mount: true` to append the
 * renderer canvas to the document body.
 */
export function createScene({
  fov = 75,
  near = 0.1,
  far = 1000,
  background = null,
  cameraPosition = [0, 0, 5],
  mount = true,
  renderer,
  rendererOptions = {},
} = {}) {
  const { width, height } = getViewportSize();

  const scene = new THREE.Scene();
  if (background !== null) {
    scene.background =
      background instanceof THREE.Color
        ? background
        : new THREE.Color(background);
  }

  const camera = new THREE.PerspectiveCamera(fov, width / height, near, far);
  camera.position.set(...cameraPosition);

  const activeRenderer =
    renderer ?? createRenderer({ width, height, mount, ...rendererOptions });

  return { scene, camera, renderer: activeRenderer };
}

/**
 * Resize a camera + renderer (and optional EffectComposer) to a target size.
 *
 * Defaults to the current viewport. Safe to call directly from a resize event.
 */
export function resizeRendererToDisplay(
  camera,
  renderer,
  { width, height, composer, maxPixelRatio = 2, onResize } = {},
) {
  const size = getViewportSize();
  const w = width ?? size.width;
  const h = height ?? size.height;

  if (camera && camera.isPerspectiveCamera) {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  renderer.setPixelRatio(clampedPixelRatio(maxPixelRatio));
  renderer.setSize(w, h);
  if (composer) composer.setSize(w, h);
  if (typeof onResize === "function") onResize({ width: w, height: h });
}

/**
 * Attach a window resize listener that keeps `camera`/`renderer` in sync.
 *
 * Returns an unsubscribe function that removes the listener.
 */
export function bindResize(camera, renderer, options = {}) {
  if (typeof window === "undefined") return () => {};
  const handler = () => resizeRendererToDisplay(camera, renderer, options);
  window.addEventListener("resize", handler);
  return () => window.removeEventListener("resize", handler);
}

/**
 * Create a requestAnimationFrame render loop.
 *
 * `update(delta, elapsed)` runs each frame before rendering. By default the
 * loop renders `scene`/`camera`; pass a `composer` to render through an
 * EffectComposer instead. Returns `{ start, stop }`.
 */
export function createRenderLoop({
  renderer,
  scene,
  camera,
  update,
  composer,
} = {}) {
  const clock = new THREE.Clock();
  let frameId = null;

  const tick = () => {
    frameId = requestAnimationFrame(tick);
    const delta = clock.getDelta();
    const elapsed = clock.getElapsedTime();
    if (typeof update === "function") update(delta, elapsed);
    if (composer) composer.render();
    else renderer.render(scene, camera);
  };

  return {
    start() {
      if (frameId === null) {
        clock.start();
        tick();
      }
    },
    stop() {
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
        frameId = null;
      }
    },
  };
}

/**
 * Convert a mouse/touch/pointer event to normalized device coordinates.
 *
 * When `element` is provided the conversion is relative to that element's
 * bounding rect; otherwise it uses the full window. If `out` is a Vector2-like
 * object (has `.set`) it is written in place; the coordinates are always
 * returned as `{ x, y }`.
 */
export function getPointerNDC(event, out = null, element = null) {
  const source =
    event.touches && event.touches.length > 0 ? event.touches[0] : event;

  let x;
  let y;
  if (element && typeof element.getBoundingClientRect === "function") {
    const rect = element.getBoundingClientRect();
    x = ((source.clientX - rect.left) / rect.width) * 2 - 1;
    y = -((source.clientY - rect.top) / rect.height) * 2 + 1;
  } else {
    const { width, height } = getViewportSize();
    x = (source.clientX / width) * 2 - 1;
    y = -(source.clientY / height) * 2 + 1;
  }

  if (out && typeof out.set === "function") out.set(x, y);
  return { x, y };
}

/**
 * Dispose an object's GPU resources: geometry, material(s) and their textures.
 *
 * With `recursive` (default) the whole subtree is traversed. The object is
 * detached from its parent so it can be garbage collected.
 */
export function disposeObject(object, { recursive = true } = {}) {
  if (!object) return;

  const disposeMaterial = (material) => {
    if (!material) return;
    for (const value of Object.values(material)) {
      if (value && value.isTexture) value.dispose();
    }
    if (typeof material.dispose === "function") material.dispose();
  };

  const disposeNode = (node) => {
    if (node.geometry && typeof node.geometry.dispose === "function") {
      node.geometry.dispose();
    }
    if (node.material) {
      if (Array.isArray(node.material)) node.material.forEach(disposeMaterial);
      else disposeMaterial(node.material);
    }
  };

  if (recursive && typeof object.traverse === "function") {
    object.traverse(disposeNode);
  } else {
    disposeNode(object);
  }

  if (object.parent && typeof object.parent.remove === "function") {
    object.parent.remove(object);
  }
}
