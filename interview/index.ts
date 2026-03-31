/**
 * Interview Tool — batch multiple questions into one interactive form.
 *
 * Reduces N round-trips to 2 (ask + process) by collecting all answers at once.
 * One question shown at a time with a progress indicator and per-question editors.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Editor, type EditorTheme, Key, matchesKey, Text, truncateToWidth } from "@mariozechner/pi-tui";
import { Type } from "@sinclair/typebox";

interface InterviewAnswer {
	id: string;
	question: string;
	answer: string;
}

interface InterviewResult {
	title: string;
	answers: InterviewAnswer[];
	cancelled: boolean;
}

const InterviewParams = Type.Object({
	title: Type.String({ description: "Interview title" }),
	description: Type.Optional(Type.String({ description: "Context shown at top" })),
	questions: Type.Array(
		Type.Object({
			id: Type.String({ description: "Unique identifier" }),
			question: Type.String({ description: "The question to ask" }),
			context: Type.Optional(Type.String({ description: "Background/rationale shown as dim text" })),
			default: Type.Optional(Type.String({ description: "Pre-filled answer" })),
		}),
		{ description: "Questions to ask the user", minItems: 1 },
	),
});

export default function (pi: ExtensionAPI) {
	pi.registerTool({
		name: "interview",
		label: "Interview",
		description:
			"Present multiple questions to the user in a single interactive form. " +
			"Use this instead of asking questions one at a time to reduce round-trips. " +
			"All answers are collected and returned at once.",
		promptSnippet: "Batch-interview the user with multiple questions in one interactive form",
		promptGuidelines: [
			"When you have 3+ questions for the user, prefer the interview tool over asking one at a time.",
			"Each question needs a unique id and the question text. Optionally add context explaining why you're asking.",
		],
		parameters: InterviewParams,

		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			if (!ctx.hasUI) {
				return {
					content: [{ type: "text", text: "Error: UI not available" }],
					details: { title: params.title, answers: [], cancelled: true } satisfies InterviewResult,
				};
			}

			const questions = params.questions;

			const result = await ctx.ui.custom<InterviewResult>((tui, theme, _kb, done) => {
				let currentIndex = 0;
				let cachedLines: string[] | undefined;

				const editorTheme: EditorTheme = {
					borderColor: (s: string) => theme.fg("accent", s),
				};

				// One editor per question so answers persist when navigating
				const editors: Editor[] = questions.map((q) => {
					const ed = new Editor(tui, editorTheme);
					ed.disableSubmit = true;
					if (q.default) ed.setText(q.default);
					return ed;
				});

				function refresh() {
					cachedLines = undefined;
					tui.requestRender();
				}

				function submit(cancelled: boolean) {
					const answers: InterviewAnswer[] = questions.map((q, i) => ({
						id: q.id,
						question: q.question,
						answer: editors[i].getText().trim(),
					}));
					done({ title: params.title, answers, cancelled });
				}

				function handleInput(data: string) {
					if (matchesKey(data, Key.escape)) {
						submit(true);
						return;
					}

					// Tab / Shift+Tab navigate between questions
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

					// Enter advances to next question; submits on last
					if (matchesKey(data, Key.enter) && !matchesKey(data, Key.shift("enter"))) {
						if (currentIndex < questions.length - 1) {
							currentIndex++;
						} else {
							submit(false);
							return;
						}
						refresh();
						return;
					}

					// Everything else goes to the current editor (including Shift+Enter for newlines)
					editors[currentIndex].handleInput(data);
					refresh();
				}

				function render(width: number): string[] {
					if (cachedLines) return cachedLines;

					const lines: string[] = [];
					const add = (s: string) => lines.push(truncateToWidth(s, width));

					add(theme.fg("accent", "─".repeat(width)));
					add(theme.fg("accent", theme.bold(` ${params.title}`)));
					if (params.description) {
						add(theme.fg("muted", ` ${params.description}`));
					}
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
					add(theme.fg("text", theme.bold(` ${currentIndex + 1}/${questions.length}: ${q.question}`)));
					if (q.context) {
						add(theme.fg("dim", `   ${q.context}`));
					}
					lines.push("");

					// Editor
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

				return {
					render,
					invalidate: () => {
						cachedLines = undefined;
					},
					handleInput,
				};
			});

			if (result.cancelled) {
				return {
					content: [{ type: "text", text: "User cancelled the interview." }],
					details: result,
				};
			}

			const answeredCount = result.answers.filter((a) => a.answer !== "").length;
			const answerText = result.answers.map((a) => `Q: ${a.question}\nA: ${a.answer || "(skipped)"}`).join("\n\n");

			return {
				content: [
					{
						type: "text",
						text: `User answered ${answeredCount}/${questions.length} questions:\n\n${answerText}`,
					},
				],
				details: result,
			};
		},

		renderCall(args, theme, _context) {
			const qs = (args.questions as { id: string }[]) || [];
			let text = theme.fg("toolTitle", theme.bold("interview "));
			text += theme.fg("muted", `${qs.length} question${qs.length !== 1 ? "s" : ""}`);
			if (args.title) {
				text += theme.fg("dim", ` — ${args.title}`);
			}
			return new Text(text, 0, 0);
		},

		renderResult(result, _options, theme, _context) {
			const details = result.details as InterviewResult | undefined;
			if (!details) return new Text("", 0, 0);
			if (details.cancelled) return new Text(theme.fg("warning", "Cancelled"), 0, 0);

			const lines = details.answers.map((a) => {
				const short = a.answer.length > 60 ? a.answer.slice(0, 57) + "..." : a.answer;
				return `${theme.fg("success", "✓ ")}${theme.fg("accent", a.id)}: ${short}`;
			});
			return new Text(lines.join("\n"), 0, 0);
		},
	});
}
