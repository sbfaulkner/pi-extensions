import assert from "node:assert/strict";
import test from "node:test";
import vimExtension, { ViEditor } from "./index.ts";

const ESCAPE = "\x1b";
const CTRL_R = "\x12";

function createTui() {
  let renderRequests = 0;

  return {
    tui: {
      requestRender() {
        renderRequests += 1;
      },
    },
    get renderRequests() {
      return renderRequests;
    },
  };
}

function createTheme() {
  return {
    borderColor(text: string) {
      return text;
    },
    selectList: {
      selected: (text: string) => text,
      item: (text: string) => text,
      hint: (text: string) => text,
      matched: (text: string) => text,
      border: (text: string) => text,
    },
  };
}

function createKeybindings() {
  return {
    matches() {
      return false;
    },
  };
}

function createEditor(text = "") {
  const tuiHarness = createTui();
  const editor = new ViEditor(tuiHarness.tui as any, createTheme() as any, createKeybindings() as any);

  if (text) {
    editor.setText(text);
  }

  return { editor, tuiHarness };
}

function input(editor: ViEditor, keys: string[]) {
  for (const key of keys) {
    editor.handleInput(key);
  }
}

function typeText(editor: ViEditor, text: string) {
  for (const ch of text) {
    editor.handleInput(ch);
  }
}

test("session_start installs ViEditor as the editor component", () => {
  const handlers = new Map<string, (...args: any[]) => void>();
  let editorFactory: ((tui: unknown, theme: unknown, keybindings: unknown) => unknown) | undefined;
  const pi = {
    on(event: string, handler: (...args: any[]) => void) {
      handlers.set(event, handler);
    },
  };
  const ctx = {
    ui: {
      setEditorComponent(factory: typeof editorFactory) {
        editorFactory = factory;
      },
    },
  };

  vimExtension(pi as any);
  handlers.get("session_start")?.({}, ctx);

  assert.equal(typeof editorFactory, "function");
  const tuiHarness = createTui();
  const editor = editorFactory?.(tuiHarness.tui, createTheme(), createKeybindings());

  assert.ok(editor instanceof ViEditor);
});

test("insert mode accepts text and escape enters normal mode one character left", () => {
  const { editor } = createEditor();

  typeText(editor, "hello");
  assert.equal(editor.getText(), "hello");
  assert.deepEqual(editor.getCursor(), { line: 0, col: 5 });
  assert.equal(editor.getMode(), "insert");

  editor.handleInput(ESCAPE);

  assert.equal(editor.getMode(), "normal");
  assert.deepEqual(editor.getCursor(), { line: 0, col: 4 });
});

test("normal mode supports basic character and word movement", () => {
  const { editor } = createEditor("one two_three, four");

  editor.handleInput(ESCAPE);
  editor.handleInput("0");
  assert.deepEqual(editor.getCursor(), { line: 0, col: 0 });

  editor.handleInput("w");
  assert.deepEqual(editor.getCursor(), { line: 0, col: 4 });

  editor.handleInput("w");
  assert.deepEqual(editor.getCursor(), { line: 0, col: 13 });

  editor.handleInput("w");
  assert.deepEqual(editor.getCursor(), { line: 0, col: 15 });

  input(editor, ["b", "h", "l", "$"]);
  assert.deepEqual(editor.getCursor(), { line: 0, col: 18 });
});

test("normal mode insert commands place text before and after the cursor", () => {
  const { editor } = createEditor("abc");

  editor.handleInput(ESCAPE);
  editor.handleInput("0");
  input(editor, ["l", "i"]);
  typeText(editor, "X");

  assert.equal(editor.getMode(), "insert");
  assert.equal(editor.getText(), "aXbc");

  editor.handleInput(ESCAPE);
  editor.handleInput("a");
  typeText(editor, "Y");

  assert.equal(editor.getText(), "aXYbc");
});

test("normal mode x deletes into the unnamed register and P pastes before cursor", () => {
  const { editor } = createEditor("abc");

  editor.handleInput(ESCAPE);
  editor.handleInput("0");
  editor.handleInput("x");

  assert.equal(editor.getText(), "bc");
  assert.equal(editor.getRegister(), "a");

  editor.handleInput("P");

  assert.equal(editor.getText(), "abc");
});

test("operators handle word changes, undo, and redo", () => {
  const { editor } = createEditor("one two");

  editor.handleInput(ESCAPE);
  editor.handleInput("0");
  input(editor, ["d", "w"]);

  assert.equal(editor.getText(), "two");
  assert.equal(editor.getRegister(), "one ");

  editor.handleInput("u");
  assert.equal(editor.getText(), "one two");

  editor.handleInput(CTRL_R);
  assert.equal(editor.getText(), "two");
});

test("linewise yanks paste below the current line", () => {
  const { editor } = createEditor("two");

  editor.handleInput(ESCAPE);
  editor.handleInput("0");
  input(editor, ["y", "y"]);

  assert.equal(editor.getRegister(), "two\n");

  editor.handleInput("p");
  assert.equal(editor.getText(), "two\ntwo");
});
