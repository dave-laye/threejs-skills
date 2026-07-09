import test from "node:test";
import assert from "node:assert/strict";

import {
  clampedPixelRatio,
  getPointerNDC,
  disposeObject,
} from "../lib/three-utils.js";

test("clampedPixelRatio falls back to 1 without a window", () => {
  assert.equal(clampedPixelRatio(2), 1);
});

test("getPointerNDC converts window coordinates to NDC", () => {
  globalThis.window = { innerWidth: 800, innerHeight: 600 };
  const ndc = getPointerNDC({ clientX: 400, clientY: 300 });
  assert.ok(Math.abs(ndc.x) < 1e-9);
  assert.ok(Math.abs(ndc.y) < 1e-9);

  const corner = getPointerNDC({ clientX: 800, clientY: 0 });
  assert.equal(corner.x, 1);
  assert.equal(corner.y, 1);
  delete globalThis.window;
});

test("getPointerNDC prefers the first touch and writes into a target", () => {
  globalThis.window = { innerWidth: 200, innerHeight: 100 };
  const target = {
    x: null,
    y: null,
    set(x, y) {
      this.x = x;
      this.y = y;
    },
  };
  getPointerNDC({ touches: [{ clientX: 100, clientY: 50 }] }, target);
  assert.equal(target.x, 0);
  assert.equal(target.y, 0);
  delete globalThis.window;
});

test("getPointerNDC supports an element-relative rect", () => {
  const element = {
    getBoundingClientRect: () => ({
      left: 100,
      top: 50,
      width: 200,
      height: 100,
    }),
  };
  const ndc = getPointerNDC({ clientX: 200, clientY: 100 }, null, element);
  assert.equal(ndc.x, 0);
  assert.equal(ndc.y, 0);
});

test("disposeObject disposes geometry, materials, textures and detaches", () => {
  const calls = [];
  const texture = { isTexture: true, dispose: () => calls.push("texture") };
  const material = {
    map: texture,
    dispose: () => calls.push("material"),
  };
  const mesh = {
    geometry: { dispose: () => calls.push("geometry") },
    material,
  };
  const parent = {
    remove(child) {
      calls.push(child === mesh ? "removed" : "removed-other");
    },
  };
  mesh.parent = parent;

  disposeObject(mesh, { recursive: false });

  assert.deepEqual(calls.sort(), [
    "geometry",
    "material",
    "removed",
    "texture",
  ]);
});

test("disposeObject handles arrays of materials", () => {
  const calls = [];
  const mesh = {
    geometry: { dispose: () => calls.push("geometry") },
    material: [
      { dispose: () => calls.push("mat0") },
      { dispose: () => calls.push("mat1") },
    ],
  };
  disposeObject(mesh, { recursive: false });
  assert.deepEqual(calls.sort(), ["geometry", "mat0", "mat1"]);
});
