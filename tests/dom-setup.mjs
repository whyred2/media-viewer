import { Window } from "happy-dom";

export const testWindow = new Window({ url: "http://localhost:3000" });
for (const key of [
  "window", "document", "navigator", "localStorage", "HTMLElement", "HTMLVideoElement", "HTMLMediaElement",
  "HTMLInputElement", "HTMLButtonElement", "HTMLFormElement", "Element", "SVGElement", "Node", "Document", "DocumentFragment",
  "Event", "EventTarget", "CustomEvent", "MouseEvent", "PointerEvent", "KeyboardEvent", "FocusEvent",
  "MutationObserver", "ResizeObserver", "DOMRect", "ShadowRoot",
]) {
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: key === "window" ? testWindow : testWindow[key] });
}
for (const key of ["getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame"]) {
  globalThis[key] = testWindow[key].bind(testWindow);
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const captures = new WeakMap();
HTMLElement.prototype.setPointerCapture = function (id) { captures.set(this, id); };
HTMLElement.prototype.hasPointerCapture = function (id) { return captures.get(this) === id; };
HTMLElement.prototype.releasePointerCapture = function () { captures.delete(this); };
