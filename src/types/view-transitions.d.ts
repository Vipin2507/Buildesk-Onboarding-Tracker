export {};

declare global {
  interface Document {
    startViewTransition?: (update: () => void) => { finished: Promise<void> };
  }
}
