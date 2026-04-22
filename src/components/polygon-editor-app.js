import {
  brightenHexColor,
  centroid,
  clonePoints,
  deepEqualPoints,
  getBoundingBox,
  hexToRgba,
  pointInPolygon,
} from '../core/geometry.js';
import { HistoryManager } from '../core/history.js';
import { createRandomPolygon } from '../core/random.js';
import {
  attemptPolygonMove,
  cloneScene,
  getPolygonById,
  getPolygonIndexById,
  parseScene,
  serializeScene,
} from '../core/scene.js';

const template = document.createElement('template');
template.innerHTML = `
  <style>
    :host {
      display: block;
      min-height: 100vh;
      color: #0f172a;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background:
        radial-gradient(circle at top left, rgba(96, 165, 250, 0.22), transparent 28%),
        radial-gradient(circle at top right, rgba(167, 139, 250, 0.2), transparent 26%),
        linear-gradient(180deg, #f8fbff 0%, #eef3fb 100%);
    }

    .layout {
      min-height: 100vh;
      padding: 18px;
      display: grid;
      grid-template-rows: auto auto minmax(420px, 1fr);
      gap: 16px;
      box-sizing: border-box;
    }

    .workspace {
      min-height: 0;
      border-radius: 24px;
      background: rgba(255, 255, 255, 0.72);
      box-shadow: inset 0 0 0 1px rgba(148, 163, 184, 0.18), 0 20px 45px rgba(15, 23, 42, 0.1);
      overflow: hidden;
      position: relative;
      backdrop-filter: blur(12px);
    }

    canvas {
      width: 100%;
      height: 100%;
      display: block;
      cursor: default;
      touch-action: none;
    }

    .hint {
      position: absolute;
      inset: auto 18px 18px auto;
      padding: 10px 12px;
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.85);
      color: #475569;
      box-shadow: 0 8px 18px rgba(15, 23, 42, 0.1);
      font-size: 0.88rem;
      pointer-events: none;
    }

    @media (max-width: 720px) {
      .layout {
        padding: 12px;
        grid-template-rows: auto auto minmax(360px, 1fr);
      }

      .workspace {
        border-radius: 18px;
      }

      .hint {
        inset: auto 12px 12px auto;
        font-size: 0.8rem;
      }
    }
  </style>
  <div class="layout">
    <app-toolbar></app-toolbar>
    <app-info-panel></app-info-panel>
    <div class="workspace">
      <canvas></canvas>
      <div class="hint">Ctrl+Z / Ctrl+Y • Delete • Drag-and-drop</div>
    </div>
    <app-toast></app-toast>
  </div>
`;

class PolygonEditorApp extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));

    this.toolbar = this.shadowRoot.querySelector('app-toolbar');
    this.infoPanel = this.shadowRoot.querySelector('app-info-panel');
    this.toast = this.shadowRoot.querySelector('app-toast');
    this.workspace = this.shadowRoot.querySelector('.workspace');
    this.canvas = this.shadowRoot.querySelector('canvas');
    this.context = this.canvas.getContext('2d');

    this.history = new HistoryManager(200);
    this.state = {
      polygons: [],
      selectedId: null,
      nextId: 1,
    };

    this.dragState = null;
    this.canvasWidth = 0;
    this.canvasHeight = 0;
    this.animationFrameId = null;
    this.resizeObserver = new ResizeObserver(() => this.resizeCanvas());

    this.handleToolbarAction = this.handleToolbarAction.bind(this);
    this.handleColorChange = this.handleColorChange.bind(this);
    this.handleImportScene = this.handleImportScene.bind(this);
    this.handleCanvasMouseDown = this.handleCanvasMouseDown.bind(this);
    this.handleCanvasMouseMove = this.handleCanvasMouseMove.bind(this);
    this.handleWindowMouseUp = this.handleWindowMouseUp.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleDocumentVisibility = this.handleDocumentVisibility.bind(this);
    this.draw = this.draw.bind(this);
  }

  connectedCallback() {
    this.toolbar.addEventListener('toolbar-action', this.handleToolbarAction);
    this.toolbar.addEventListener('color-change', this.handleColorChange);
    this.toolbar.addEventListener('import-scene', this.handleImportScene);
    this.canvas.addEventListener('mousedown', this.handleCanvasMouseDown);
    this.canvas.addEventListener('mousemove', this.handleCanvasMouseMove);
    window.addEventListener('mouseup', this.handleWindowMouseUp);
    window.addEventListener('keydown', this.handleKeyDown);
    document.addEventListener('visibilitychange', this.handleDocumentVisibility);
    this.resizeObserver.observe(this.workspace);
    this.resizeCanvas();
    this.syncUi();
  }

  disconnectedCallback() {
    this.toolbar.removeEventListener('toolbar-action', this.handleToolbarAction);
    this.toolbar.removeEventListener('color-change', this.handleColorChange);
    this.toolbar.removeEventListener('import-scene', this.handleImportScene);
    this.canvas.removeEventListener('mousedown', this.handleCanvasMouseDown);
    this.canvas.removeEventListener('mousemove', this.handleCanvasMouseMove);
    window.removeEventListener('mouseup', this.handleWindowMouseUp);
    window.removeEventListener('keydown', this.handleKeyDown);
    document.removeEventListener('visibilitychange', this.handleDocumentVisibility);
    this.resizeObserver.disconnect();
    cancelAnimationFrame(this.animationFrameId);
  }

  handleDocumentVisibility() {
    if (document.hidden) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    } else {
      this.scheduleDraw();
    }
  }

  resizeCanvas() {
    const bounds = this.workspace.getBoundingClientRect();
    const width = Math.max(320, Math.floor(bounds.width));
    const height = Math.max(360, Math.floor(bounds.height));
    const previousWidth = this.canvasWidth;
    const previousHeight = this.canvasHeight;

    if (previousWidth && previousHeight && (previousWidth !== width || previousHeight !== height)) {
      const scaleX = width / previousWidth;
      const scaleY = height / previousHeight;

      this.state.polygons = this.state.polygons.map((polygon) => ({
        ...polygon,
        points: polygon.points.map((point) => ({ x: point.x * scaleX, y: point.y * scaleY })),
      }));
    }

    this.canvasWidth = width;
    this.canvasHeight = height;

    const ratio = window.devicePixelRatio || 1;
    this.canvas.width = Math.floor(width * ratio);
    this.canvas.height = Math.floor(height * ratio);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.context.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.scheduleDraw();
  }

  scheduleDraw() {
    if (this.animationFrameId) {
      return;
    }

    this.animationFrameId = requestAnimationFrame(this.draw);
  }

  drawGrid() {
    const { context, canvasWidth, canvasHeight } = this;
    context.save();
    context.fillStyle = '#f8fbff';
    context.fillRect(0, 0, canvasWidth, canvasHeight);

    context.strokeStyle = 'rgba(148, 163, 184, 0.18)';
    context.lineWidth = 1;

    const step = 28;
    for (let x = 0; x <= canvasWidth; x += step) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, canvasHeight);
      context.stroke();
    }

    for (let y = 0; y <= canvasHeight; y += step) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(canvasWidth, y);
      context.stroke();
    }

    context.restore();
  }

  drawPolygon(polygon, timestamp) {
    const { context } = this;
    const selected = polygon.id === this.state.selectedId;
    const elapsed = Math.max(0, timestamp - (polygon.animationStart || 0));
    const progress = polygon.animationStart ? Math.min(1, elapsed / 220) : 1;
    const scale = 0.84 + progress * 0.16;
    const alpha = progress;
    const center = centroid(polygon.points);

    context.save();
    context.translate(center.x, center.y);
    context.scale(scale, scale);
    context.translate(-center.x, -center.y);
    context.globalAlpha = alpha;

    context.beginPath();
    polygon.points.forEach((point, index) => {
      if (index === 0) {
        context.moveTo(point.x, point.y);
      } else {
        context.lineTo(point.x, point.y);
      }
    });
    context.closePath();

    context.fillStyle = polygon.color;
    context.shadowColor = selected ? hexToRgba(polygon.color, 0.35) : 'rgba(15, 23, 42, 0.12)';
    context.shadowBlur = selected ? 18 : 8;
    context.shadowOffsetY = 4;
    context.fill();

    context.shadowBlur = 0;
    context.shadowOffsetY = 0;
    context.lineWidth = selected ? 4 : 2;
    context.strokeStyle = selected ? brightenHexColor(polygon.color, 64) : 'rgba(15, 23, 42, 0.78)';
    context.stroke();

    context.restore();

    return progress < 1;
  }

  draw(timestamp = performance.now()) {
    this.animationFrameId = null;
    this.drawGrid();

    let needsMoreFrames = false;
    for (const polygon of this.state.polygons) {
      needsMoreFrames = this.drawPolygon(polygon, timestamp) || needsMoreFrames;
    }

    if (needsMoreFrames || this.dragState) {
      this.scheduleDraw();
    }
  }

  syncUi() {
    const selected = getPolygonById(this.state.polygons, this.state.selectedId);

    this.toolbar.updateState({
      canUndo: this.history.canUndo(),
      canRedo: this.history.canRedo(),
      hasSelection: Boolean(selected),
      selectedColor: selected?.color,
    });

    this.infoPanel.updateState({
      count: this.state.polygons.length,
      selectedName: selected?.name || null,
    });

    this.scheduleDraw();
  }

  setSelected(polygonId) {
    this.state.selectedId = polygonId;
    this.syncUi();
  }

  commitHistory(before, after) {
    this.history.push({ before, after });
    this.syncUi();
  }

  restoreScene(snapshot) {
    this.state = cloneScene(snapshot);
    this.syncUi();
  }

  hitTest(point) {
    for (let index = this.state.polygons.length - 1; index >= 0; index -= 1) {
      const polygon = this.state.polygons[index];
      if (pointInPolygon(point, polygon.points)) {
        return polygon;
      }
    }

    return null;
  }

  getCanvasPoint(event) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }

  handleCanvasMouseDown(event) {
    if (event.button !== 0) {
      return;
    }

    const point = this.getCanvasPoint(event);
    const hitPolygon = this.hitTest(point);

    if (!hitPolygon) {
      this.setSelected(null);
      this.canvas.style.cursor = 'default';
      return;
    }

    this.setSelected(hitPolygon.id);
    this.dragState = {
      polygonId: hitPolygon.id,
      startPointer: point,
      originalPoints: clonePoints(hitPolygon.points),
      beforeScene: cloneScene(this.state),
      moved: false,
    };

    this.canvas.style.cursor = 'grabbing';
  }

  handleCanvasMouseMove(event) {
    const point = this.getCanvasPoint(event);

    if (!this.dragState) {
      const hovered = this.hitTest(point);
      this.canvas.style.cursor = hovered ? 'grab' : 'default';
      return;
    }

    const { polygonId, startPointer, originalPoints } = this.dragState;
    const dx = point.x - startPointer.x;
    const dy = point.y - startPointer.y;

    const baseScene = cloneScene(this.state);
    const polygonIndex = getPolygonIndexById(baseScene.polygons, polygonId);
    if (polygonIndex === -1) {
      return;
    }

    baseScene.polygons[polygonIndex].points = clonePoints(originalPoints);

    const moveResult = attemptPolygonMove({
      polygonId,
      dx,
      dy,
      scene: baseScene,
      width: this.canvasWidth,
      height: this.canvasHeight,
    });

    if (!moveResult) {
      return;
    }

    this.state.polygons[polygonIndex].points = moveResult.points;
    this.dragState.moved = moveResult.changed;
    this.scheduleDraw();
  }

  handleWindowMouseUp() {
    if (!this.dragState) {
      return;
    }

    const { polygonId, beforeScene, originalPoints, moved } = this.dragState;
    const polygon = getPolygonById(this.state.polygons, polygonId);
    this.dragState = null;
    this.canvas.style.cursor = 'default';

    if (!polygon || !moved || deepEqualPoints(originalPoints, polygon.points)) {
      this.syncUi();
      return;
    }

    const afterScene = cloneScene(this.state);
    this.commitHistory(beforeScene, afterScene);
  }

  createPolygon() {
    const polygon = createRandomPolygon({
      width: this.canvasWidth,
      height: this.canvasHeight,
      existingPolygons: this.state.polygons,
      nextId: this.state.nextId,
    });

    if (!polygon) {
      this.toast.show('Не удалось найти свободное место для нового полигона');
      return;
    }

    const before = cloneScene(this.state);
    this.state.polygons = [...this.state.polygons, polygon];
    this.state.selectedId = polygon.id;
    this.state.nextId += 1;
    const after = cloneScene(this.state);
    this.commitHistory(before, after);
  }

  deleteSelectedPolygon(showMessage = true) {
    if (!this.state.selectedId) {
      if (showMessage) {
        this.toast.show('Полигон не выбран');
      }
      return;
    }

    const before = cloneScene(this.state);
    this.state.polygons = this.state.polygons.filter((polygon) => polygon.id !== this.state.selectedId);
    this.state.selectedId = null;
    const after = cloneScene(this.state);
    this.commitHistory(before, after);
  }

  deleteAllPolygons() {
    if (!this.state.polygons.length) {
      this.toast.show('На холсте нет полигонов');
      return;
    }

    const before = cloneScene(this.state);
    this.state.polygons = [];
    this.state.selectedId = null;
    const after = cloneScene(this.state);
    this.commitHistory(before, after);
  }

  undo() {
    const snapshot = this.history.undo();
    if (!snapshot) {
      this.toast.show('Больше нечего отменять');
      this.syncUi();
      return;
    }

    this.restoreScene(snapshot);
  }

  redo() {
    const snapshot = this.history.redo();
    if (!snapshot) {
      this.toast.show('Больше нечего повторять');
      this.syncUi();
      return;
    }

    this.restoreScene(snapshot);
  }

  changeSelectedColor(color) {
    const polygon = getPolygonById(this.state.polygons, this.state.selectedId);
    if (!polygon) {
      this.toast.show('Сначала выберите полигон');
      return;
    }

    if (polygon.color === color) {
      return;
    }

    const before = cloneScene(this.state);
    polygon.color = color;
    const after = cloneScene(this.state);
    this.commitHistory(before, after);
  }

  exportScene() {
    const json = serializeScene(this.state);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'polygon-scene.json';
    link.click();
    URL.revokeObjectURL(url);
    this.toast.show('Сцена экспортирована в JSON');
  }

  importScene(text) {
    try {
      const imported = parseScene(text, this.canvasWidth, this.canvasHeight);
      const before = cloneScene(this.state);
      this.state = imported;
      const after = cloneScene(this.state);
      this.commitHistory(before, after);
      this.toast.show('Сцена успешно импортирована');
    } catch (error) {
      this.toast.show(error.message || 'Не удалось импортировать JSON');
      this.syncUi();
    }
  }

  handleToolbarAction(event) {
    switch (event.detail.action) {
      case 'generate':
        this.createPolygon();
        break;
      case 'delete-selected':
        this.deleteSelectedPolygon(true);
        break;
      case 'delete-all':
        this.deleteAllPolygons();
        break;
      case 'undo':
        this.undo();
        break;
      case 'redo':
        this.redo();
        break;
      case 'export':
        this.exportScene();
        break;
      default:
        break;
    }
  }

  handleColorChange(event) {
    this.changeSelectedColor(event.detail.color);
  }

  handleImportScene(event) {
    this.importScene(event.detail.text);
  }

  handleKeyDown(event) {
    const lowercaseKey = event.key.toLowerCase();

    if ((event.ctrlKey || event.metaKey) && !event.shiftKey && lowercaseKey === 'z') {
      event.preventDefault();
      this.undo();
      return;
    }

    if ((event.ctrlKey || event.metaKey) && (lowercaseKey === 'y' || (event.shiftKey && lowercaseKey === 'z'))) {
      event.preventDefault();
      this.redo();
      return;
    }

    if (event.key === 'Delete') {
      event.preventDefault();
      this.deleteSelectedPolygon(true);
    }
  }
}

customElements.define('polygon-editor-app', PolygonEditorApp);
