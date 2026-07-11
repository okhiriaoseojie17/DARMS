// src/lib/ai/buildQuestionPrompt.ts

export type QuestionType = "objective" | "theory" | "mixed";
export type Difficulty = "easy" | "normal" | "hard";
export type SourceCategory = "test1" | "test2" | "exam" | "notes";

interface BuildQuizPromptArgs {
  courseTitle: string;
  courseCode: string;
  sourceCategory: SourceCategory;
  questionType: QuestionType;
  difficulty: Difficulty;
  sourceTexts: string[]; // extracted_text from each pooled upload
}

const DIFFICULTY_INSTRUCTIONS: Record<Difficulty, string> = {
  easy:
    "Write simplified, quick-revision-style questions. Stay strictly within " +
    "what is explicitly stated in the source material — do not introduce " +
    "outside facts. The goal is a fast, low-pressure recap, not a real test.",
  normal:
    "Write questions at the same weight and difficulty as a real test/exam " +
    "for this course. Stay grounded in the source material's content and " +
    "scope — do not introduce facts that are not present or directly " +
    "implied by the source.",
  hard:
    "Write questions that go beyond what is explicitly stated in the source " +
    "material. You may draw on closely related concepts, implications, or " +
    "adjacent facts that a strong student studying this topic should also " +
    "know, even if they are not directly in the source text. The goal is to " +
    "deepen understanding, not to trick the student with irrelevant trivia — " +
    "every question must still be clearly relevant to the topic at hand.",
};

const FORMAT_INSTRUCTIONS: Record<QuestionType, string> = {
  objective:
    "Produce only objective (multiple-choice) questions, each with exactly " +
    "one correct answer and three plausible distractors.",
  theory:
    "Produce only theory/essay-style questions requiring a written answer, " +
    "with a model answer provided for each.",
  mixed:
    "Produce a mix of objective (multiple-choice) and theory questions, " +
    "roughly balanced.",
};

function categoryLabel(sourceCategory: SourceCategory): string {
  if (sourceCategory === "notes") return "study notes";
  if (sourceCategory === "exam") return "past exam(s)";
  return `past ${sourceCategory === "test1" ? "Test 1" : "Test 2"} paper(s)`;
}

export function buildQuestionPrompt({
  courseTitle,
  courseCode,
  sourceCategory,
  questionType,
  difficulty,
  sourceTexts,
}: BuildQuizPromptArgs): string {
  const combinedSource = sourceTexts
    .map((t, i) => `--- Source document ${i + 1} ---\n${t}`)
    .join("\n\n");

  return `You are generating a practice question set for university students in the course ${courseCode} — ${courseTitle}.

The source material below is ${categoryLabel(sourceCategory)} previously used in this course. Base the new question set on the structure, topics, and style of this material.

${FORMAT_INSTRUCTIONS[questionType]}

${DIFFICULTY_INSTRUCTIONS[difficulty]}

Respond ONLY with valid JSON, no markdown fences, no preamble, in exactly this shape:
{
  "questions": [
    {
      "type": "objective" | "theory",
      "question": "string",
      "options": ["string", "string", "string", "string"] | null,
      "correct_answer": "string",
      "explanation": "string"
    }
  ]
}

For theory questions, "options" must be null and "correct_answer" should hold the model answer.

Source material:
${combinedSource}`;
}

interface BuildAskPromptArgs {
  courseTitle: string;
  courseCode: string;
  sourceCategory: SourceCategory;
  sourceTexts: string[];
  question: string;
}

// Used by the "quick question" mode on the AI tab — the student picks a
// category (or a specific note) and just asks something directly, instead
// of generating a full practice set.
export function buildAskPrompt({
  courseTitle,
  courseCode,
  sourceCategory,
  sourceTexts,
  question,
}: BuildAskPromptArgs): string {
  const combinedSource = sourceTexts
    .map((t, i) => `--- Source document ${i + 1} ---\n${t}`)
    .join("\n\n");

  return `You are a study assistant helping a university student with the course ${courseCode} — ${courseTitle}.

The source material below is ${categoryLabel(sourceCategory)} from this course. Answer the student's question using this material as your primary basis. If the material doesn't cover the question, say so plainly rather than making something up, but you may still offer a brief, clearly-labeled general explanation if it would genuinely help.

Keep the answer focused and student-friendly — this is for quick understanding, not a formal document.

Student's question: ${question}

Source material:
${combinedSource}`;
}
