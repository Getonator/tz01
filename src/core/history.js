export class HistoryManager {
  constructor(limit = 100) {
    this.limit = limit;
    this.undoStack = [];
    this.redoStack = [];
  }

  push(entry) {
    this.undoStack.push(entry);
    if (this.undoStack.length > this.limit) {
      this.undoStack.shift();
    }
    this.redoStack = [];
  }

  undo() {
    const entry = this.undoStack.pop();
    if (!entry) {
      return null;
    }

    this.redoStack.push(entry);
    return entry.before;
  }

  redo() {
    const entry = this.redoStack.pop();
    if (!entry) {
      return null;
    }

    this.undoStack.push(entry);
    return entry.after;
  }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
  }

  canUndo() {
    return this.undoStack.length > 0;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }
}
