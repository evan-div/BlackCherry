import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface CanvasErrorBoundaryProps {
  children: ReactNode;
  onError: (message: string) => void;
}

/** Catches errors thrown while resolving the Suspense-driven GLTF load (or any other
 * render-time error in the scene subtree) and reports them up as a friendly message
 * rather than leaving a blank canvas. React error boundaries must be class
 * components — there's no hook equivalent. */
export class CanvasErrorBoundary extends Component<CanvasErrorBoundaryProps, { hasError: boolean }> {
  constructor(props: CanvasErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[TradeShowExplorer] scene error:', error, info.componentStack);
    this.props.onError(error.message || 'The 3D model failed to load.');
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}
