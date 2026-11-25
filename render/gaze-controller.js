export class GazeController {
  constructor() {
    this.targetX = 0.5;
    this.targetY = 0.5;
    this.currentX = 0.5;
    this.currentY = 0.5;
  }

  setTarget(normX, normY) {
    this.targetX = Math.max(0, Math.min(1, Number(normX) || 0.5));
    this.targetY = Math.max(0, Math.min(1, Number(normY) || 0.5));
  }

  step(smoothing = 0.18) {
    this.currentX += (this.targetX - this.currentX) * smoothing;
    this.currentY += (this.targetY - this.currentY) * smoothing;
    return { x: this.currentX, y: this.currentY };
  }
}
