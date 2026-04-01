/**
 * Interview Extension — extract questions from assistant messages and answer them in a form.
 *
 * Uses `/answer` command to:
 * 1. Find the last assistant message
 * 2. Extract questions via a cheap isolated LLM call (no context pollution)
 * 3. Present a TUI form to answer them all at once
 * 4. Send answers back as a clean message
 */

import { complete, type Model, type Api, type UserMessage } from "@mariozechner/pi-ai";
import type { ExtensionAPI, ExtensionContext, ModelRegistry } from "@mariozechner/pi-coding-agent";
import { BorderedLoader } from "@mariozechner/pi-coding-agent";
import { Editor, type EditorTheme, Key, matchesKey, truncateToWidth, wrapTextWithAnsi } from "@mariozechner/pi-tui";

interface ExtractedQuestion {
	question: string;
	context?: string;
}

interface ExtractionResult {
	questions: ExtractedQuestion[];
}

const EXTRACTION_PROMPT = `You are a question extractor. Given text from a conversation, extract any questions that need answering.

Output a JSON object with this structure:
{
  "questions": [
    {
      "question": "The question text",
      "context": "Optional context that helps answer the question"
    }
  ]
}

Rules:
- Extract all questions that require user input
- Keep questions in the order they appeared
- Be concise with question text
- Include context only when it provides essential information for answering
- If no questions are found, return {"questions": []}`;

const CHEAP_MODELS: [string, string][] = [
	["openai-codex", "gpt-5.1-codex-mini"],
	["anthropic", "claude-haiku-4-5"],
];

async function selectExtractionModel(
	currentModel: Model<Api>,
	modelRegistry: ModelRegistry,
): Promise<Model<Api>> {
	for (const [provider, id] of CHEAP_MODELS) {
		const model = modelRegistry.find(provider, id);
		if (model) {
			const auth = await modelRegistry.getApiKeyAndHeaders(model);
			if (auth.ok) return model;
		}
	}
	return currentModel;
}

function parseExtractionResult(text: string): ExtractionResult | null {
	try {
		let json = text;
		const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
		if (match) json = match[1].trim();
		const parsed = JSON.parse(json);
		if (parsed && Array.isArray(parsed.questions)) return parsed as ExtractionResult;
		return null;
	} catch {
		return null;
	}
}

function findLastAssistantText(ctx: ExtensionContext): string | undefined {
	const branch = ctx.sessionManager.getBranch();
	for (let i = branch.length - 1; i >= 0; i--) {
		const entry = branch[i];
		if (entry.type === "message") {
			const msg = entry.message;
			if ("role" in msg && msg.role === "assistant") {
				const textParts = msg.content
					.filter((c): c is { type: "text"; text: string } => c.type === "text")
					.map((c) => c.text);
				if (textParts.length > 0) return textParts.join("\n");
			}
		}
	}
	return undefined;
}

export default function (pi: ExtensionAPI) {
	pi.registerCommand("answer", {
		description: "Extract questions from last assistant message into interactive Q&A",
		handler: async (_args, ctx) => {
			if (!ctx.hasUI) {
				ctx.ui.notify("answer requires interactive mode", "error");
				return;
			}

			if (!ctx.model) {
				ctx.ui.notify("No model selected", "error");
				return;
			}

			const lastAssistantText = findLastAssistantText(ctx);
			if (!lastAssistantText) {
				ctx.ui.notify("No assistant messages found", "error");
				return;
			}

			// Extract questions using a cheap model (isolated call — no context pollution)
			const extractionModel = await selectExtractionModel(ctx.model, ctx.modelRegistry);

			const extractionResult = await ctx.ui.custom<ExtractionResult | null>((tui, theme, _kb, done) => {
				const loader = new BorderedLoader(tui, theme, `Extracting questions using ${extractionModel.id}...`);
				loader.onAbort = () => done(null);

				const doExtract = async () => {
					const auth = await ctx.modelRegistry.getApiKeyAndHeaders(extractionModel);
					if (!auth.ok) throw new Error(auth.error);

					const userMessage: UserMessage = {
						role: "user",
						content: [{ type: "text", text: lastAssistantText }],
						timestamp: Date.now(),
					};

					const response = await complete(
						extractionModel,
						{ systemPrompt: EXTRACTION_PROMPT, messages: [userMessage] },
						{ apiKey: auth.apiKey!, headers: auth.headers, signal: loader.signal },
					);

					if (response.stopReason === "aborted") return null;

					const responseText = response.content
						.filter((c): c is { type: "text"; text: string } => c.type === "text")
						.map((c) => c.text)
						.join("\n");

					return parseExtractionResult(responseText);
				};

				doExtract()
					.then(done)
					.catch(() => done(null));

				return loader;
			});

			if (!extractionResult) {
				ctx.ui.notify("Cancelled", "info");
				return;
			}

			if (extractionResult.questions.length === 0) {
				ctx.ui.notify("No questions found in the last message", "info");
				return;
			}

			const questions = extractionResult.questions;

			// Present TUI form
			const answers = await ctx.ui.custom<string[] | null>((tui, theme, _kb, done) => {
				let currentIndex = 0;
				let cachedLines: string[] | undefined;

				const editorTheme: EditorTheme = {
					borderColor: (s: string) => theme.fg("accent", s),
				};

				const editors: Editor[] = questions.map(() => {
					const ed = new Editor(tui, editorTheme);
					ed.disableSubmit = true;
					return ed;
				});

				function refresh() {
					cachedLines = undefined;
					tui.requestRender();
				}

				function submit() {
					done(editors.map((ed) => ed.getText().trim()));
				}

				function handleInput(data: string) {
					if (matchesKey(data, Key.escape)) {
						done(null);
						return;
					}

					if (matchesKey(data, Key.tab)) {
						currentIndex = Math.min(currentIndex + 1, questions.length - 1);
						refresh();
						return;
					}
					if (matchesKey(data, Key.shift("tab"))) {
						currentIndex = Math.max(currentIndex - 1, 0);
						refresh();
						return;
					}

					if (matchesKey(data, Key.enter) && !matchesKey(data, Key.shift("enter"))) {
						if (currentIndex < questions.length - 1) {
							currentIndex++;
						} else {
							submit();
							return;
						}
						refresh();
						return;
					}

					editors[currentIndex].handleInput(data);
					refresh();
				}

				function render(width: number): string[] {
					if (cachedLines) return cachedLines;

					const lines: string[] = [];
					const add = (s: string) => lines.push(truncateToWidth(s, width));

					add(theme.fg("accent", "─".repeat(width)));
					add(theme.fg("accent", theme.bold(` Answer Questions`)));
					lines.push("");

					// Progress dots
					const dots = questions.map((_, i) => {
						const answered = editors[i].getText().trim().length > 0;
						if (i === currentIndex) return theme.fg("accent", "●");
						if (answered) return theme.fg("success", "●");
						return theme.fg("dim", "○");
					});
					add(` ${dots.join(" ")}`);
					lines.push("");

					// Current question
					const q = questions[currentIndex];
					for (const line of wrapTextWithAnsi(theme.fg("text", theme.bold(` ${currentIndex + 1}/${questions.length}: ${q.question}`)), width)) {
						lines.push(line);
					}
					if (q.context) {
						for (const line of wrapTextWithAnsi(theme.fg("dim", `   ${q.context}`), width)) {
							lines.push(line);
						}
					}
					lines.push("");

					for (const line of editors[currentIndex].render(Math.max(1, width - 4))) {
						add(`  ${line}`);
					}

					lines.push("");
					const isLast = currentIndex === questions.length - 1;
					const hint = isLast
						? " Enter submit • Shift+Enter newline • Shift+Tab prev • Esc cancel"
						: " Enter next • Shift+Enter newline • Tab/Shift+Tab navigate • Esc cancel";
					add(theme.fg("dim", hint));
					add(theme.fg("accent", "─".repeat(width)));

					cachedLines = lines;
					return lines;
				}

				return { render, invalidate: () => { cachedLines = undefined; }, handleInput };
			});

			if (!answers) {
				ctx.ui.notify("Cancelled", "info");
				return;
			}

			// Build clean answer text and send as a message (no tool result overhead)
			const parts: string[] = [];
			for (let i = 0; i < questions.length; i++) {
				const a = answers[i] || "(skipped)";
				parts.push(`Q: ${questions[i].question}`);
				parts.push(`A: ${a}`);
				parts.push("");
			}

			pi.sendMessage(
				{
					customType: "answers",
					content: "I answered your questions:\n\n" + parts.join("\n").trim(),
					display: true,
				},
				{ triggerTurn: true },
			);
		},
	});
}
