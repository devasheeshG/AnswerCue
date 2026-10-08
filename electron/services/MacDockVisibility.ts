export interface MacDock {
  isVisible(): boolean;
  show(): Promise<void>;
  hide(): void;
}

/**
 * macOS Dock transformations are asynchronous. Repeating them can leave ghost
 * tiles; hiding within a second of show() is also ignored by Electron.
 * Keep one transition in flight and converge on the latest requested state.
 */
export class MacDockVisibility {
  private desired: boolean | undefined;
  private inFlight: Promise<void> | null = null;
  private lastShowFinishedAt = -Infinity;
  private disposed = false;

  constructor(
    private readonly dock: MacDock,
    private readonly now: () => number = Date.now,
    private readonly sleep: (ms: number) => Promise<void> = ms => new Promise(resolve => setTimeout(resolve, ms)),
  ) {}

  setVisible(visible: boolean): Promise<void> {
    if (this.disposed) return Promise.resolve();
    this.desired = visible;
    if (!this.inFlight) {
      this.inFlight = Promise.resolve().then(() => this.reconcile()).finally(() => {
        this.inFlight = null;
      });
    }
    return this.inFlight;
  }

  dispose(): void {
    this.disposed = true;
    this.desired = undefined;
  }

  private async reconcile(): Promise<void> {
    while (!this.disposed && this.desired !== undefined) {
      const target = this.desired;
      if (target !== this.dock.isVisible()) {
        if (target) {
          await this.dock.show();
          this.lastShowFinishedAt = this.now();
        } else {
          const remaining = 1100 - (this.now() - this.lastShowFinishedAt);
          if (remaining > 0) await this.sleep(remaining);
          if (this.disposed) return;
          if (this.desired !== target) continue;
          this.dock.hide();
        }
      }
      if (this.desired === target) return;
    }
  }
}
