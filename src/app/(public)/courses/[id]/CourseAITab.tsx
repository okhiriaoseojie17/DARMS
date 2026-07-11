'use client';

import { useState } from 'react';
import Link from 'next/link';

type SourceCategory = 'test1' | 'test2' | 'exam' | 'notes';
type QuestionType = 'objective' | 'theory' | 'mixed';
type Difficulty = 'easy' | 'normal' | 'hard';

interface NoteOption {
  id: string;
  label: string;
}

interface AIAvailability {
  test1: boolean;
  test2: boolean;
  exam: boolean;
  notes: NoteOption[];
}

interface CourseAITabProps {
  courseId: string;
  courseCode: string;
  isSignedIn: boolean;
  availability: AIAvailability;
}

interface QuizQuestion {
  type: 'objective' | 'theory';
  question: string;
  options: string[] | null;
  correct_answer: string;
  explanation: string;
}

const CATEGORY_OPTIONS: { key: SourceCategory; label: string }[] = [
  { key: 'test1', label: 'Test 1' },
  { key: 'test2', label: 'Test 2' },
  { key: 'exam', label: 'Exam' },
  { key: 'notes', label: 'Notes' },
];

export function CourseAITab({ courseId, courseCode, isSignedIn, availability }: CourseAITabProps) {
  const [mode, setMode] = useState<'quiz' | 'ask'>('quiz');
  const [category, setCategory] = useState<SourceCategory | null>(null);
  const [noteUploadId, setNoteUploadId] = useState('');
  const [questionType, setQuestionType] = useState<QuestionType>('mixed');
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [question, setQuestion] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quiz, setQuiz] = useState<QuizQuestion[] | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});

  if (!isSignedIn) {
    return (
      <div className="mt-3 rounded-sm border border-paper-200/15 p-6 text-sm text-paper-200/60">
        <Link href="/sign-in" className="underline hover:text-amber-500">
          Sign in
        </Link>{' '}
        to generate AI practice questions or ask questions about {courseCode}'s materials.
      </div>
    );
  }

  const categoryHasMaterial = (key: SourceCategory) =>
    key === 'notes' ? availability.notes.length > 0 : availability[key];

  const canSubmit =
    category !== null &&
    categoryHasMaterial(category) &&
    (category !== 'notes' || noteUploadId) &&
    (mode === 'quiz' || question.trim().length >= 3);

  function resetResults() {
    setQuiz(null);
    setAnswer(null);
    setRevealed({});
    setError(null);
  }

  function handlePickCategory(key: SourceCategory) {
    setCategory(key);
    setNoteUploadId('');
    resetResults();
  }

  async function handleGenerateQuiz() {
    if (!category) return;
    resetResults();
    setLoading(true);
    try {
      const res = await fetch('/api/ai/question-bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId,
          sourceCategory: category,
          questionType,
          difficulty,
          noteUploadId: category === 'notes' ? noteUploadId : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Could not generate a question set.');
        return;
      }
      setQuiz(data.questionBank.content.questions as QuizQuestion[]);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleAsk() {
    if (!category || !question.trim()) return;
    resetResults();
    setLoading(true);
    try {
      const res = await fetch('/api/ai/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId,
          sourceCategory: category,
          question: question.trim(),
          noteUploadId: category === 'notes' ? noteUploadId : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Could not get an answer.');
        return;
      }
      setAnswer(data.answer as string);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-3 flex flex-col gap-5 rounded-sm border border-paper-200/15 p-6">
      {/* Mode toggle */}
      <div className="flex gap-2 text-xs">
        <button
          type="button"
          onClick={() => {
            setMode('quiz');
            resetResults();
          }}
          className={`rounded-sm px-3 py-2 uppercase tracking-wide ${
            mode === 'quiz' ? 'bg-amber-500 text-ink-950' : 'border border-paper-200/20 text-paper-200/60'
          }`}
        >
          Generate practice questions
        </button>
        <button
          type="button"
          onClick={() => {
            setMode('ask');
            resetResults();
          }}
          className={`rounded-sm px-3 py-2 uppercase tracking-wide ${
            mode === 'ask' ? 'bg-amber-500 text-ink-950' : 'border border-paper-200/20 text-paper-200/60'
          }`}
        >
          Just ask a question
        </button>
      </div>

      {/* Category picker */}
      <div>
        <p className="text-xs uppercase tracking-wide text-paper-200/40">Source material</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {CATEGORY_OPTIONS.map((opt) => {
            const available = categoryHasMaterial(opt.key);
            return (
              <button
                key={opt.key}
                type="button"
                disabled={!available}
                onClick={() => handlePickCategory(opt.key)}
                className={`rounded-sm px-3 py-2 text-sm ${
                  category === opt.key
                    ? 'bg-amber-500 text-ink-950'
                    : available
                    ? 'border border-paper-200/20 text-paper-100 hover:border-amber-500/60'
                    : 'border border-paper-200/10 text-paper-200/25'
                }`}
                title={available ? undefined : 'No approved uploads in this category yet'}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Note picker — only when Notes is selected */}
      {category === 'notes' && (
        <label className="flex flex-col gap-1 text-sm">
          Which note?
          <select
            value={noteUploadId}
            onChange={(e) => setNoteUploadId(e.target.value)}
            className="rounded-sm border border-paper-200/20 bg-transparent px-4 py-3 text-paper-100"
          >
            <option value="" className="text-ink-950">
              Choose a note…
            </option>
            {availability.notes.map((n) => (
              <option key={n.id} value={n.id} className="text-ink-950">
                {n.label}
              </option>
            ))}
          </select>
        </label>
      )}

      {mode === 'quiz' ? (
        <>
          <div>
            <p className="text-xs uppercase tracking-wide text-paper-200/40">Format</p>
            <div className="mt-2 flex gap-2">
              {(['objective', 'theory', 'mixed'] as QuestionType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setQuestionType(t)}
                  className={`rounded-sm px-3 py-2 text-sm capitalize ${
                    questionType === t
                      ? 'bg-amber-500 text-ink-950'
                      : 'border border-paper-200/20 text-paper-100 hover:border-amber-500/60'
                  }`}
                >
                  {t === 'objective' ? 'Objective' : t === 'theory' ? 'Theory' : 'Both'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wide text-paper-200/40">Difficulty</p>
            <div className="mt-2 flex gap-2">
              {(['easy', 'normal', 'hard'] as Difficulty[]).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDifficulty(d)}
                  className={`rounded-sm px-3 py-2 text-sm capitalize ${
                    difficulty === d
                      ? 'bg-amber-500 text-ink-950'
                      : 'border border-paper-200/20 text-paper-100 hover:border-amber-500/60'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-paper-200/40">
              {difficulty === 'easy' && 'Simplified, quick-revision style.'}
              {difficulty === 'normal' && 'Matches a real test/exam for this course.'}
              {difficulty === 'hard' &&
                'Draws on related concepts beyond the source material, to deepen understanding.'}
            </p>
          </div>

          <button
            type="button"
            disabled={!canSubmit || loading}
            onClick={handleGenerateQuiz}
            className="self-start rounded-sm bg-paper-50 px-4 py-3 text-sm font-medium text-ink-950 hover:bg-paper-100 disabled:opacity-30"
          >
            {loading ? 'Generating…' : 'Generate'}
          </button>
        </>
      ) : (
        <>
          <label className="flex flex-col gap-1 text-sm">
            Your question
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. What's the difference between a stack and a queue?"
              rows={3}
              className="rounded-sm border border-paper-200/20 bg-transparent px-4 py-3 text-paper-100 placeholder:text-paper-200/30"
            />
          </label>

          <button
            type="button"
            disabled={!canSubmit || loading}
            onClick={handleAsk}
            className="self-start rounded-sm bg-paper-50 px-4 py-3 text-sm font-medium text-ink-950 hover:bg-paper-100 disabled:opacity-30"
          >
            {loading ? 'Asking…' : 'Ask'}
          </button>
        </>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      {/* Quiz results */}
      {quiz && (
        <div className="flex flex-col gap-4 border-t border-paper-200/15 pt-5">
          {quiz.map((q, i) => (
            <div key={i} className="rounded-sm border border-paper-200/15 p-4">
              <p className="font-display text-base">
                {i + 1}. {q.question}
              </p>

              {q.options && (
                <ul className="mt-2 flex flex-col gap-1 text-sm text-paper-200/70">
                  {q.options.map((opt, j) => (
                    <li key={j}>
                      {String.fromCharCode(65 + j)}. {opt}
                    </li>
                  ))}
                </ul>
              )}

              {revealed[i] ? (
                <div className="mt-3 rounded-sm bg-paper-200/5 p-3 text-sm">
                  <p className="text-amber-500">Answer: {q.correct_answer}</p>
                  <p className="mt-1 text-paper-200/60">{q.explanation}</p>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setRevealed((r) => ({ ...r, [i]: true }))}
                  className="mt-3 text-xs uppercase tracking-wide text-amber-500 underline"
                >
                  Reveal answer
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Ask results */}
      {answer && (
        <div className="border-t border-paper-200/15 pt-5 text-sm text-paper-100">
          <p className="whitespace-pre-wrap">{answer}</p>
        </div>
      )}
    </div>
  );
}
