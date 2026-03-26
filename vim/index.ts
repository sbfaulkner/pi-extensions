/**
 * Vi Input Mode — vi/readline-style modal editing for pi's TUI editor
 *
 * Implements the core vi command-line editing mode familiar from bash `set -o vi`,
 * zsh vi-mode, and other shell editors.
 *
 * Modes:
 *   INSERT  — default; all input passed through to the editor
 *   NORMAL  — navigation and editing via single-key commands
 *
 * Insert mode:
 *   Escape / Ctrl+[     → switch to normal mode
 *
 * Normal mode:
 *   Movement:
 *     h / l              — left / right
 *     0 / $              — beginning / end of line
 *     ^                  — first non-whitespace character
 *     w / W              — forward word (word / WORD)
 *     b / B              — backward word (word / WORD)
 *     e / E              — end of word (word / WORD)
 *     f{c} / F{c}        — forward / backward to character
 *     t{c} / T{c}        — forward / backward till character
 *     ; / ,              — repeat / reverse last f/F/t/T
 *     j / k              — down / up (history in single-line, cursor in multi-line)
 *
 *   Editing:
 *     i / a              — insert before / after cursor
 *     I / A              — insert at line start / end
 *     o / O              — open line below / above
 *     x                  — delete character under cursor
 *     X                  — delete character before cursor (backspace)
 *     r{c}               — replace character under cursor
 *     s                  — substitute character (delete + insert)
 *     S / cc             — substitute entire line
 *     D                  — delete to end of line
 *     C                  — change to end of line
 *     d{motion}          — delete with motion
 *     c{motion}          — change with motion
 *     y{motion}          — yank with motion
 *     dd                 — delete entire line
 *     yy                 — yank entire line
 *     p / P              — paste after / before cursor
 *     u                  — undo
 *     Ctrl+R             — redo
 *
 *   Counts:
 *     {count}{command}   — repeat command count times
 *
 * Control keys (both modes):
 *   Ctrl+C / Ctrl+D etc  — passed through to pi
 *   Enter                — submit input
 */

import { CustomEditor, type ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { matchesKey, truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";

// --- Types ---

type Mode = "normal" | "insert";
type CharMotion = "f" | "F" | "t" | "T";
type Operator = "d" | "c" | "y";

interface CharMotionMemory {
  motion: CharMotion;
  char: string;
}

// --- Constants ---

const ESC_LEFT = "\x1b[D";
const ESC_RIGHT = "\x1b[C";
const ESC_UP = "\x1b[A";
const ESC_DOWN = "\x1b[B";
const CTRL_A = "\x01"; // home
const CTRL_E = "\x05"; // end
const CTRL_K = "\x0b"; // kill to end
const CTRL_UNDERSCORE = "\x1f"; // undo
const CTRL_R = "\x12"; // redo
const NEWLINE = "\n";
const DELETE = "\x1b[3~"; // delete key
const BACKSPACE = "\x7f";

const MAX_COUNT = 9999;

// --- Character classification ---

type CharClass = "space" | "word" | "punct";

function classifyChar(ch: string | undefined, bigWord: boolean = false): CharClass {
  if (!ch || /\s/.test(ch)) return "space";
  if (bigWord) return "word"; // WORD mode: everything non-space is a word
  if (/\w/.test(ch)) return "word";
  return "punct";
}

// --- Character motion helpers ---

function findCharTarget(
  line: string,
  col: number,
  motion: CharMotion,
  target: string,
  count: number = 1,
): number | null {
  const forward = motion === "f" || motion === "t";
  const till = motion === "t" || motion === "T";

  let pos = col;
  let found = 0;

  if (forward) {
    for (let i = col + 1; i < line.length; i++) {
      if (line[i] === target) {
        found++;
        if (found === count) {
          return till ? i - 1 : i;
        }
      }
    }
  } else {
    for (let i = col - 1; i >= 0; i--) {
      if (line[i] === target) {
        found++;
        if (found === count) {
          return till ? i + 1 : i;
        }
      }
    }
  }

  return null;
}

// --- Word motion helpers ---

function findWordForward(line: string, col: number, bigWord: boolean = false): number {
  const len = line.length;
  if (col >= len) return len;

  let i = col;
  const startClass = classifyChar(line[i], bigWord);

  // Skip current class
  if (startClass !== "space") {
    while (i < len && classifyChar(line[i], bigWord) === startClass) i++;
  }
  // Skip whitespace
  while (i < len && classifyChar(line[i], bigWord) === "space") i++;

  return i;
}

function findWordBackward(line: string, col: number, bigWord: boolean = false): number {
  if (col <= 0) return 0;

  let i = col - 1;

  // Skip whitespace
  while (i > 0 && classifyChar(line[i], bigWord) === "space") i--;

  // Find start of word
  const wordClass = classifyChar(line[i], bigWord);
  while (i > 0 && classifyChar(line[i - 1], bigWord) === wordClass) i--;

  return i;
}

function findWordEnd(line: string, col: number, bigWord: boolean = false): number {
  const len = line.length;
  if (col >= len - 1) return Math.max(0, len - 1);

  let i = col + 1;

  // Skip whitespace
  while (i < len && classifyChar(line[i], bigWord) === "space") i++;

  if (i >= len) return len - 1;

  // Find end of word
  const wordClass = classifyChar(line[i], bigWord);
  while (i < len - 1 && classifyChar(line[i + 1], bigWord) === wordClass) i++;

  return i;
}

// --- First non-whitespace ---

function firstNonWhitespace(line: string): number {
  const match = line.search(/\S/);
  return match === -1 ? 0 : match;
}

// --- Editor internals interface (for direct buffer manipulation) ---

interface EditorInternals {
  state?: {
    lines?: string[];
    cursorLine?: number;
    cursorCol?: number;
  };
  preferredVisualCol?: number | null;
  historyIndex?: number;
  lastAction?: string | null;
  onChange?: (text: string) => void;
  tui?: { requestRender?: () => void };
  pushUndoSnapshot?: () => void;
  setCursorCol?: (col: number) => void;
}

// ============================================================================
// Vi Editor
// ============================================================================

export class ViEditor extends CustomEditor {
  private mode: Mode = "insert";
  private register: string = ""; // unnamed yank register
  private lastCharMotion: CharMotionMemory | null = null;
  private pendingOperator: Operator | null = null;
  private pendingCharMotion: CharMotion | null = null;
  private pendingReplace: boolean = false;
  private countBuffer: string = "";
  private operatorCountBuffer: string = "";
  private redoStack: Array<{ text: string; line: number; col: number }> = [];
  private transitionActive: boolean = false;

  // --- Public test API ---

  getMode(): Mode {
    return this.mode;
  }

  getRegister(): string {
    return this.register;
  }

  // --- Buffer access helpers ---

  private getState(): EditorInternals["state"] {
    return (this as unknown as EditorInternals).state;
  }

  private getLineText(lineIndex?: number): string {
    const state = this.getState();
    const idx = lineIndex ?? state?.cursorLine ?? 0;
    return state?.lines?.[idx] ?? "";
  }

  private getCursorPos(): { line: number; col: number } {
    const cursor = this.getCursor();
    return { line: cursor.line, col: cursor.col };
  }

  private allLines(): string[] {
    return this.getLines();
  }

  private fullText(): string {
    return this.allLines().join("\n");
  }

  // --- Cursor manipulation ---

  private setCursorDirect(line: number, col: number): void {
    const editor = this as unknown as EditorInternals;
    const state = editor.state;
    if (!state || !Array.isArray(state.lines)) return;

    const maxLine = Math.max(0, state.lines.length - 1);
    const targetLine = Math.max(0, Math.min(line, maxLine));
    const lineText = state.lines[targetLine] ?? "";
    const targetCol = Math.max(0, Math.min(col, lineText.length));

    state.cursorLine = targetLine;
    state.cursorCol = targetCol;
    editor.preferredVisualCol = targetCol;
    editor.lastAction = null;
    editor.tui?.requestRender?.();
  }

  private moveCursorToCol(col: number): void {
    const { line } = this.getCursorPos();
    this.setCursorDirect(line, col);
  }

  private moveCursorVertically(delta: number): void {
    const { line, col } = this.getCursorPos();
    const editor = this as unknown as EditorInternals;
    const preferredCol = editor.preferredVisualCol ?? col;
    const lines = this.allLines();
    const targetLine = Math.max(0, Math.min(line + delta, lines.length - 1));
    if (targetLine === line) return;

    const targetLineText = lines[targetLine] ?? "";
    const targetCol = Math.min(preferredCol, Math.max(0, targetLineText.length - 1));

    const state = this.getState();
    if (state) {
      state.cursorLine = targetLine;
      state.cursorCol = targetCol;
      editor.preferredVisualCol = preferredCol; // preserve preferred column
      editor.lastAction = null;
      editor.tui?.requestRender?.();
    }
  }

  // --- Buffer mutation ---

  private replaceBuffer(newText: string, cursorAbs: number): void {
    const editor = this as unknown as EditorInternals;
    const state = editor.state;
    if (!state) return;

    const currentText = this.fullText();
    if (currentText !== newText) {
      editor.pushUndoSnapshot?.();
    }

    const lines = newText.length === 0 ? [""] : newText.split("\n");
    state.lines = lines;

    // Convert absolute index to line/col
    let remaining = Math.max(0, Math.min(cursorAbs, newText.length));
    let targetLine = 0;
    for (let i = 0; i < lines.length; i++) {
      const lineLen = lines[i]!.length;
      if (remaining <= lineLen) {
        targetLine = i;
        break;
      }
      remaining -= lineLen + 1;
      targetLine = i + 1;
    }
    targetLine = Math.min(targetLine, lines.length - 1);
    const targetCol = Math.max(0, remaining);

    state.cursorLine = targetLine;
    state.cursorCol = targetCol;
    editor.preferredVisualCol = null;
    editor.historyIndex = -1;
    editor.lastAction = null;
    editor.onChange?.(newText);
    editor.tui?.requestRender?.();
  }

  private absoluteIndex(line: number, col: number): number {
    const lines = this.allLines();
    let idx = 0;
    for (let i = 0; i < line && i < lines.length; i++) {
      idx += lines[i]!.length + 1;
    }
    return idx + col;
  }

  // --- Undo / Redo ---

  private performUndo(): void {
    const textBefore = this.fullText();
    const posBefore = this.getCursorPos();
    this.transitionActive = true;
    super.handleInput(CTRL_UNDERSCORE);
    this.transitionActive = false;

    const textAfter = this.fullText();
    if (textBefore !== textAfter || posBefore.line !== this.getCursorPos().line || posBefore.col !== this.getCursorPos().col) {
      this.redoStack.push({ text: textBefore, line: posBefore.line, col: posBefore.col });
    }
  }

  private performRedo(): void {
    const snapshot = this.redoStack.pop();
    if (!snapshot) return;

    const editor = this as unknown as EditorInternals;
    this.transitionActive = true;
    editor.pushUndoSnapshot?.();

    const lines = snapshot.text.length === 0 ? [""] : snapshot.text.split("\n");
    const state = this.getState();
    if (state) {
      state.lines = lines;
      state.cursorLine = snapshot.line;
      state.cursorCol = snapshot.col;
      editor.preferredVisualCol = null;
      editor.historyIndex = -1;
      editor.lastAction = null;
      editor.onChange?.(snapshot.text);
      editor.tui?.requestRender?.();
    }
    this.transitionActive = false;
  }

  // --- Count handling ---

  private consumeCount(defaultVal: number = 1): number {
    const prefixRaw = this.countBuffer;
    const opRaw = this.operatorCountBuffer;
    this.countBuffer = "";
    this.operatorCountBuffer = "";

    const parse = (s: string): number | null => {
      if (!s) return null;
      const n = parseInt(s, 10);
      return Number.isFinite(n) && n > 0 ? n : null;
    };

    const prefix = parse(prefixRaw);
    const op = parse(opRaw);

    if (prefix === null && op === null) return defaultVal;
    const total = prefix !== null && op !== null ? prefix * op : (prefix ?? op ?? defaultVal);
    return Math.min(MAX_COUNT, Math.max(1, total));
  }

  // --- Pending state management ---

  private clearPending(): void {
    this.pendingOperator = null;
    this.pendingCharMotion = null;
    this.pendingReplace = false;
    this.countBuffer = "";
    this.operatorCountBuffer = "";
  }

  // --- Motion execution (returns target col, or null if no movement) ---

  private executeMotion(key: string, count: number): { col: number; inclusive: boolean } | null {
    const { line: lineIdx, col } = this.getCursorPos();
    const line = this.getLineText(lineIdx);

    switch (key) {
      case "h":
        return { col: Math.max(0, col - count), inclusive: false };
      case "l":
        return { col: Math.min(line.length, col + count), inclusive: false };
      case "0":
        return { col: 0, inclusive: false };
      case "^":
        return { col: firstNonWhitespace(line), inclusive: false };
      case "$":
        return { col: Math.max(0, line.length - 1), inclusive: true };
      case "w": {
        let pos = col;
        for (let i = 0; i < count; i++) pos = findWordForward(line, pos);
        return { col: pos, inclusive: false };
      }
      case "W": {
        let pos = col;
        for (let i = 0; i < count; i++) pos = findWordForward(line, pos, true);
        return { col: pos, inclusive: false };
      }
      case "b": {
        let pos = col;
        for (let i = 0; i < count; i++) pos = findWordBackward(line, pos);
        return { col: pos, inclusive: false };
      }
      case "B": {
        let pos = col;
        for (let i = 0; i < count; i++) pos = findWordBackward(line, pos, true);
        return { col: pos, inclusive: false };
      }
      case "e": {
        let pos = col;
        for (let i = 0; i < count; i++) pos = findWordEnd(line, pos);
        return { col: pos, inclusive: true };
      }
      case "E": {
        let pos = col;
        for (let i = 0; i < count; i++) pos = findWordEnd(line, pos, true);
        return { col: pos, inclusive: true };
      }
      default:
        return null;
    }
  }

  // --- Delete/Change/Yank range ---

  private deleteRange(startCol: number, endCol: number, lineIdx: number): void {
    const line = this.getLineText(lineIdx);
    const start = Math.min(startCol, endCol);
    const end = Math.max(startCol, endCol);
    const deleted = line.slice(start, end);
    this.register = deleted;

    const lineStart = this.absoluteIndex(lineIdx, 0);
    const text = this.fullText();
    const newText = text.slice(0, lineStart + start) + text.slice(lineStart + end);
    this.replaceBuffer(newText, lineStart + start);
  }

  private deleteLine(lineIdx: number): void {
    const lines = this.allLines();
    if (lines.length === 0) return;

    this.register = (lines[lineIdx] ?? "") + "\n";

    if (lines.length === 1) {
      this.replaceBuffer("", 0);
      return;
    }

    const text = this.fullText();
    const lineStart = this.absoluteIndex(lineIdx, 0);
    const lineEnd = lineStart + (lines[lineIdx] ?? "").length;

    let newText: string;
    let newCursorAbs: number;

    if (lineIdx < lines.length - 1) {
      // Not the last line: delete line + following newline
      newText = text.slice(0, lineStart) + text.slice(lineEnd + 1);
      newCursorAbs = lineStart;
    } else {
      // Last line: delete preceding newline + line
      newText = text.slice(0, Math.max(0, lineStart - 1)) + text.slice(lineEnd);
      newCursorAbs = Math.max(0, lineStart - 1);
    }

    this.replaceBuffer(newText, newCursorAbs);
  }

  // --- Operator + motion execution ---

  private applyOperator(op: Operator, motionKey: string, count: number): boolean {
    const { col } = this.getCursorPos();
    const result = this.executeMotion(motionKey, count);
    if (!result) return false;

    const start = Math.min(col, result.col);
    const end = Math.max(col, result.col) + (result.inclusive ? 1 : 0);
    const lineIdx = this.getCursorPos().line;
    const line = this.getLineText(lineIdx);
    const clampedEnd = Math.min(end, line.length);

    if (clampedEnd <= start && op !== "y") return true; // nothing to do

    switch (op) {
      case "d":
        this.deleteRange(start, clampedEnd, lineIdx);
        break;
      case "c":
        this.deleteRange(start, clampedEnd, lineIdx);
        this.mode = "insert";
        break;
      case "y":
        this.register = line.slice(start, clampedEnd);
        break;
    }
    return true;
  }

  private applyOperatorCharMotion(op: Operator, motion: CharMotion, targetChar: string, count: number): void {
    const { col } = this.getCursorPos();
    const lineIdx = this.getCursorPos().line;
    const line = this.getLineText(lineIdx);
    const targetCol = findCharTarget(line, col, motion, targetChar, count);

    if (targetCol === null) return;
    this.lastCharMotion = { motion, char: targetChar };

    const start = Math.min(col, targetCol);
    const end = Math.max(col, targetCol) + 1; // char motions are inclusive
    const clampedEnd = Math.min(end, line.length);

    switch (op) {
      case "d":
        this.deleteRange(start, clampedEnd, lineIdx);
        break;
      case "c":
        this.deleteRange(start, clampedEnd, lineIdx);
        this.mode = "insert";
        break;
      case "y":
        this.register = line.slice(start, clampedEnd);
        break;
    }
  }

  // --- Input handling ---

  handleInput(data: string): void {
    // Escape / Ctrl+[ always handled
    if (matchesKey(data, "escape") || matchesKey(data, "ctrl+[")) {
      return this.handleEscape();
    }

    if (this.mode === "insert") {
      super.handleInput(data);
      return;
    }

    // --- Normal mode ---

    // Pending replace: r{char}
    if (this.pendingReplace) {
      this.pendingReplace = false;
      if (this.isPrintable(data)) {
        const count = this.consumeCount(1);
        const { col } = this.getCursorPos();
        const lineIdx = this.getCursorPos().line;
        const line = this.getLineText(lineIdx);
        const endCol = Math.min(col + count, line.length);
        if (endCol > col) {
          const before = line.slice(0, col);
          const after = line.slice(endCol);
          const replacement = data.repeat(endCol - col);
          const lineStart = this.absoluteIndex(lineIdx, 0);
          const text = this.fullText();
          const newText = text.slice(0, lineStart) + before + replacement + after + text.slice(lineStart + line.length);
          this.replaceBuffer(newText, lineStart + col + (endCol - col) - 1);
        }
      } else {
        this.clearPending();
      }
      return;
    }

    // Pending char motion for standalone f/F/t/T
    if (this.pendingCharMotion && !this.pendingOperator) {
      if (this.isPrintable(data)) {
        const count = this.consumeCount(1);
        const motion = this.pendingCharMotion;
        this.pendingCharMotion = null;
        this.executeCharMotionStandalone(motion, data, count);
      } else {
        this.clearPending();
      }
      return;
    }

    // Pending char motion for operator + f/F/t/T
    if (this.pendingCharMotion && this.pendingOperator) {
      if (this.isPrintable(data)) {
        const count = this.consumeCount(1);
        const op = this.pendingOperator;
        const motion = this.pendingCharMotion;
        this.pendingCharMotion = null;
        this.pendingOperator = null;
        this.applyOperatorCharMotion(op, motion, data, count);
      } else {
        this.clearPending();
      }
      return;
    }

    // Pending operator waiting for motion
    if (this.pendingOperator) {
      this.handlePendingOperator(data);
      return;
    }

    // Top-level normal mode
    this.handleNormalKey(data);
  }

  private handleEscape(): void {
    if (this.pendingOperator || this.pendingCharMotion || this.pendingReplace || this.countBuffer || this.operatorCountBuffer) {
      this.clearPending();
      return;
    }
    if (this.mode === "insert") {
      this.mode = "normal";
      // Vim moves cursor left one on leaving insert mode
      const { col } = this.getCursorPos();
      if (col > 0) {
        this.moveCursorToCol(col - 1);
      }
    } else {
      super.handleInput("\x1b"); // pass escape through (abort agent etc)
    }
  }

  private handleNormalKey(data: string): void {
    // Count accumulation
    if (this.countBuffer.length > 0 && data >= "0" && data <= "9") {
      this.countBuffer += data;
      return;
    }
    if (data >= "1" && data <= "9") {
      this.countBuffer = data;
      return;
    }

    // Operators
    if (data === "d" || data === "c" || data === "y") {
      this.pendingOperator = data;
      return;
    }

    // Standalone commands
    const count = this.consumeCount(1);

    switch (data) {
      // --- Mode switching ---
      case "i":
        this.mode = "insert";
        return;
      case "a":
        this.mode = "insert";
        if (!this.atEol()) super.handleInput(ESC_RIGHT);
        return;
      case "A":
        this.mode = "insert";
        super.handleInput(CTRL_E);
        return;
      case "I":
        this.mode = "insert";
        this.moveCursorToCol(firstNonWhitespace(this.getLineText()));
        return;
      case "o":
        super.handleInput(CTRL_E);
        super.handleInput(NEWLINE);
        this.mode = "insert";
        return;
      case "O":
        super.handleInput(CTRL_A);
        super.handleInput(NEWLINE);
        super.handleInput(ESC_UP);
        this.mode = "insert";
        return;

      // --- Movement ---
      case "h": {
        const { col } = this.getCursorPos();
        this.moveCursorToCol(Math.max(0, col - count));
        return;
      }
      case "l": {
        const { col } = this.getCursorPos();
        const line = this.getLineText();
        this.moveCursorToCol(Math.min(line.length, col + count));
        return;
      }
      case "j": {
        const { line: curLine } = this.getCursorPos();
        const lines = this.allLines();
        if (curLine >= lines.length - 1) {
          // On last line — scroll to next history entry, cursor at top
          super.handleInput(ESC_DOWN);
          this.setCursorDirect(0, 0);
        } else {
          this.moveCursorVertically(count);
        }
        return;
      }
      case "k": {
        const { line: curLine } = this.getCursorPos();
        if (curLine <= 0) {
          // On first line — scroll to previous history entry, cursor at bottom
          super.handleInput(ESC_UP);
          const newLines = this.allLines();
          const lastLine = Math.max(0, newLines.length - 1);
          this.setCursorDirect(lastLine, 0);
        } else {
          this.moveCursorVertically(-count);
        }
        return;
      }
      case "0":
        this.moveCursorToCol(0);
        return;
      case "$":
        this.moveCursorToCol(Math.max(0, this.getLineText().length - 1));
        return;
      case "^":
        this.moveCursorToCol(firstNonWhitespace(this.getLineText()));
        return;
      case "G": {
        const editor = this as unknown as EditorInternals;
        if (editor.historyIndex !== undefined && editor.historyIndex >= 0) {
          // Browsing history — jump to end (current input)
          const maxIter = 10000;
          for (let i = 0; i < maxIter && editor.historyIndex !== undefined && editor.historyIndex >= 0; i++) {
            super.handleInput(ESC_DOWN);
          }
          this.setCursorDirect(0, 0);
        } else {
          // Not in history — go to last line of buffer
          const lines = this.allLines();
          this.setCursorDirect(lines.length - 1, 0);
        }
        return;
      }
      case "w": {
        let pos = this.getCursorPos().col;
        for (let i = 0; i < count; i++) pos = findWordForward(this.getLineText(), pos);
        this.moveCursorToCol(pos);
        return;
      }
      case "W": {
        let pos = this.getCursorPos().col;
        for (let i = 0; i < count; i++) pos = findWordForward(this.getLineText(), pos, true);
        this.moveCursorToCol(pos);
        return;
      }
      case "b": {
        let pos = this.getCursorPos().col;
        for (let i = 0; i < count; i++) pos = findWordBackward(this.getLineText(), pos);
        this.moveCursorToCol(pos);
        return;
      }
      case "B": {
        let pos = this.getCursorPos().col;
        for (let i = 0; i < count; i++) pos = findWordBackward(this.getLineText(), pos, true);
        this.moveCursorToCol(pos);
        return;
      }
      case "e": {
        let pos = this.getCursorPos().col;
        for (let i = 0; i < count; i++) pos = findWordEnd(this.getLineText(), pos);
        this.moveCursorToCol(pos);
        return;
      }
      case "E": {
        let pos = this.getCursorPos().col;
        for (let i = 0; i < count; i++) pos = findWordEnd(this.getLineText(), pos, true);
        this.moveCursorToCol(pos);
        return;
      }

      // --- Character find motions ---
      case "f":
      case "F":
      case "t":
      case "T":
        this.pendingCharMotion = data as CharMotion;
        return;
      case ";":
        if (this.lastCharMotion) {
          this.executeCharMotionStandalone(this.lastCharMotion.motion, this.lastCharMotion.char, count);
        }
        return;
      case ",":
        if (this.lastCharMotion) {
          const reversed = this.reverseCharMotion(this.lastCharMotion.motion);
          this.executeCharMotionStandalone(reversed, this.lastCharMotion.char, count);
        }
        return;

      // --- Editing ---
      case "x": {
        for (let i = 0; i < count; i++) {
          const { col } = this.getCursorPos();
          const line = this.getLineText();
          if (col < line.length) {
            this.deleteRange(col, col + 1, this.getCursorPos().line);
          }
        }
        return;
      }
      case "X": {
        for (let i = 0; i < count; i++) {
          const { col } = this.getCursorPos();
          if (col > 0) {
            this.deleteRange(col - 1, col, this.getCursorPos().line);
          }
        }
        return;
      }
      case "r":
        this.pendingReplace = true;
        return;
      case "s": {
        // Substitute: delete char(s) + enter insert
        const { col } = this.getCursorPos();
        const lineIdx = this.getCursorPos().line;
        const line = this.getLineText(lineIdx);
        const endCol = Math.min(col + count, line.length);
        if (endCol > col) {
          this.deleteRange(col, endCol, lineIdx);
        }
        this.mode = "insert";
        return;
      }
      case "S": {
        // Substitute line: clear line content + insert
        const lineIdx = this.getCursorPos().line;
        const line = this.getLineText(lineIdx);
        this.register = line;
        const lineStart = this.absoluteIndex(lineIdx, 0);
        const text = this.fullText();
        const newText = text.slice(0, lineStart) + text.slice(lineStart + line.length);
        this.replaceBuffer(newText, lineStart);
        this.mode = "insert";
        return;
      }
      case "D": {
        const { col } = this.getCursorPos();
        const lineIdx = this.getCursorPos().line;
        const line = this.getLineText(lineIdx);
        if (col < line.length) {
          this.register = line.slice(col);
          super.handleInput(CTRL_K);
          // Cursor lands on last remaining char
          if (col > 0) this.moveCursorToCol(col - 1);
        }
        return;
      }
      case "C": {
        const { col } = this.getCursorPos();
        const lineIdx = this.getCursorPos().line;
        const line = this.getLineText(lineIdx);
        if (col < line.length) {
          this.register = line.slice(col);
          super.handleInput(CTRL_K);
        }
        this.mode = "insert";
        return;
      }

      // --- Paste ---
      case "p":
        this.pasteAfter(count);
        return;
      case "P":
        this.pasteBefore(count);
        return;

      // --- Undo / Redo ---
      case "u":
        for (let i = 0; i < count; i++) this.performUndo();
        return;

      default:
        break;
    }

    // Ctrl+R = redo
    if (data === CTRL_R || matchesKey(data, "ctrl+r")) {
      const cnt = this.consumeCount(1) || count;
      for (let i = 0; i < cnt; i++) this.performRedo();
      return;
    }

    // Pass through non-printable (ctrl sequences)
    if (!this.isPrintable(data)) {
      super.handleInput(data);
    }
  }

  private handlePendingOperator(data: string): void {
    // Operator count digits
    if (data >= "0" && data <= "9") {
      if (this.operatorCountBuffer.length === 0 && data === "0") {
        // 0 is "go to beginning" motion, not a count
        // Fall through to motion handling below
      } else if (this.operatorCountBuffer.length > 0 || data !== "0") {
        this.operatorCountBuffer += data;
        return;
      }
    }

    const op = this.pendingOperator!;

    // dd / cc / yy — linewise
    if (data === op) {
      const count = this.consumeCount(1);
      const lineIdx = this.getCursorPos().line;
      const lines = this.allLines();

      if (op === "y") {
        // Yank lines
        const endLine = Math.min(lineIdx + count - 1, lines.length - 1);
        this.register = lines.slice(lineIdx, endLine + 1).join("\n") + "\n";
      } else {
        // Delete/change lines
        for (let i = 0; i < count && this.allLines().length > 0; i++) {
          const currentLine = Math.min(this.getCursorPos().line, this.allLines().length - 1);
          this.deleteLine(currentLine);
        }
        if (op === "c") {
          // If we deleted all lines, buffer is empty, insert on blank line
          this.mode = "insert";
        }
      }

      this.pendingOperator = null;
      return;
    }

    // Char motion: d/c/y + f/F/t/T
    if (data === "f" || data === "F" || data === "t" || data === "T") {
      this.pendingCharMotion = data as CharMotion;
      return;
    }

    // Regular motion
    const count = this.consumeCount(1);
    if (this.applyOperator(op, data, count)) {
      this.pendingOperator = null;
    } else {
      // Unrecognized motion — cancel
      this.clearPending();
    }
  }

  // --- Char motion standalone ---

  private executeCharMotionStandalone(motion: CharMotion, char: string, count: number): void {
    const { col } = this.getCursorPos();
    const lineIdx = this.getCursorPos().line;
    const line = this.getLineText(lineIdx);
    const target = findCharTarget(line, col, motion, char, count);

    if (target !== null) {
      this.lastCharMotion = { motion, char };
      this.moveCursorToCol(target);
    }
  }

  private reverseCharMotion(motion: CharMotion): CharMotion {
    const map: Record<CharMotion, CharMotion> = { f: "F", F: "f", t: "T", T: "t" };
    return map[motion];
  }

  // --- Paste ---

  private pasteAfter(count: number): void {
    if (!this.register) return;

    if (this.register.endsWith("\n")) {
      // Linewise paste: insert below current line
      const content = this.register.slice(0, -1);
      for (let i = 0; i < count; i++) {
        super.handleInput(CTRL_E);
        super.handleInput(NEWLINE);
        for (const ch of content) {
          super.handleInput(ch === "\n" ? NEWLINE : ch);
        }
      }
    } else {
      // Characterwise paste: insert after cursor
      if (!this.atEol()) super.handleInput(ESC_RIGHT);
      for (let i = 0; i < count; i++) {
        for (const ch of this.register) {
          super.handleInput(ch === "\n" ? NEWLINE : ch);
        }
      }
    }
  }

  private pasteBefore(count: number): void {
    if (!this.register) return;

    if (this.register.endsWith("\n")) {
      // Linewise paste: insert above current line
      const content = this.register.slice(0, -1);
      for (let i = 0; i < count; i++) {
        super.handleInput(CTRL_A);
        super.handleInput(NEWLINE);
        super.handleInput(ESC_UP);
        for (const ch of content) {
          super.handleInput(ch === "\n" ? NEWLINE : ch);
        }
      }
    } else {
      // Characterwise paste: insert before cursor
      for (let i = 0; i < count; i++) {
        for (const ch of this.register) {
          super.handleInput(ch === "\n" ? NEWLINE : ch);
        }
      }
    }
  }

  // --- Helpers ---

  private isPrintable(data: string): boolean {
    if (data.length === 0) return false;
    const code = data.codePointAt(0)!;
    return code >= 32 && code !== 127;
  }

  private atEol(): boolean {
    const { col } = this.getCursorPos();
    const line = this.getLineText();
    return col >= line.length;
  }

  // --- Render ---

  render(width: number): string[] {
    const lines = super.render(width);
    if (lines.length === 0) return lines;

    const label = this.getModeLabel();
    const last = lines.length - 1;
    if (visibleWidth(lines[last]!) >= label.length) {
      lines[last] = truncateToWidth(lines[last]!, width - label.length, "") + label;
    }
    return lines;
  }

  private getModeLabel(): string {
    if (this.mode === "insert") return " INSERT ";

    if (this.pendingReplace) {
      return this.countBuffer ? ` NORMAL ${this.countBuffer}r_ ` : " NORMAL r_ ";
    }
    if (this.pendingOperator && this.pendingCharMotion) {
      return ` NORMAL ${this.countBuffer}${this.pendingOperator}${this.operatorCountBuffer}${this.pendingCharMotion}_ `;
    }
    if (this.pendingOperator) {
      return ` NORMAL ${this.countBuffer}${this.pendingOperator}${this.operatorCountBuffer}_ `;
    }
    if (this.pendingCharMotion) {
      return ` NORMAL ${this.countBuffer}${this.pendingCharMotion}_ `;
    }

    const count = `${this.countBuffer}${this.operatorCountBuffer}`;
    if (count) return ` NORMAL ${count}_ `;
    return " NORMAL ";
  }
}

// --- Extension entry point ---

export default function (pi: ExtensionAPI) {
  pi.on("session_start", (_event, ctx) => {
    ctx.ui.setEditorComponent((tui, theme, kb) => new ViEditor(tui, theme, kb));
  });
}
