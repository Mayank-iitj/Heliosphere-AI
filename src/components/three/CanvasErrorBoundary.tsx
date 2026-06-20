"use client";

import { Component, type ReactNode } from "react";

/**
 * Isolates the WebGL / React Three Fiber subtree. If anything inside the 3D
 * scene throws (driver quirk, lost context, shader compile failure on an exotic
 * GPU), we render a graceful CSS fallback instead of letting the error bubble up
 * and white-screen the entire page.
 */
export default class CanvasErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    // Surface it for debugging without taking the page down.
    if (typeof console !== "undefined") console.error("[3D] scene error:", error);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
