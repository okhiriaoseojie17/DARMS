// src/app/api/ai/question-bank/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { generateWithGemini, GeminiError } from "@/lib/ai/gemini";
import { buildQuestionPrompt } from "@/lib/ai/buildQuestionPrompt";

const generateSchema = z.object({
  courseId: z.string().uuid(),
  sourceCategory: z.enum(["test1", "test2", "exam", "notes"]),
  questionType: z.enum(["objective", "theory", "mixed"]),
  difficulty: z.enum(["easy", "normal", "hard"]),
  // Only required when sourceCategory === "notes" — the one file the user picked.
  // For test1/test2/exam, all approved uploads of that category are pooled automatically.
  noteUploadId: z.string().uuid().optional(),
});

// GET /api/ai/question-bank?courseId=...&sourceCategory=...&questionType=...&difficulty=...&noteUploadId=...
//
// Looks up the most recent question bank this user already generated for
// this exact combination, so the AI tab can show it instantly instead of
// re-calling Gemini every time someone revisits a course/category they've
// already generated a set for. Returns { questionBank: null } (200, not 404)
// when nothing matches yet — "no cache" is a normal, expected outcome here,
// not an error.
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const courseId = searchParams.get("courseId");
  const sourceCategory = searchParams.get("sourceCategory");
  const questionType = searchParams.get("questionType");
  const difficulty = searchParams.get("difficulty");
  const noteUploadId = searchParams.get("noteUploadId");

  if (!courseId || !sourceCategory || !questionType || !difficulty) {
    return NextResponse.json(
      { error: "courseId, sourceCategory, questionType, and difficulty are required" },
      { status: 400 }
    );
  }

  let query = supabase
    .from("question_banks")
    .select("*")
    .eq("course_id", courseId)
    .eq("source_category", sourceCategory)
    .eq("question_type", questionType)
    .eq("difficulty", difficulty)
    // Belt-and-braces alongside RLS, which already scopes this to the
    // caller's own rows — being explicit here costs nothing.
    .eq("generated_by", user.id)
    .order("generated_at", { ascending: false })
    .limit(1);

  // For notes, a cached set only counts as a match if it was generated from
  // this exact note — different notes get their own cache entries, never
  // shared, since they're genuinely different source material.
  if (sourceCategory === "notes") {
    if (!noteUploadId) {
      return NextResponse.json(
        { error: "noteUploadId is required when sourceCategory is 'notes'" },
        { status: 400 }
      );
    }
    query = query.contains("source_upload_ids", [noteUploadId]);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ questionBank: data?.[0] ?? null });
}

// POST /api/ai/question-bank — always generates a fresh set (used for both
// the first generation and explicit "Regenerate" clicks). Caching which set
// to *show* is the GET route's job; this route's job is only ever "make a
// new one."
export async function POST(req: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Signed-in students only — no anonymous/public access to generation.
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const parsed = generateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { courseId, sourceCategory, questionType, difficulty, noteUploadId } =
    parsed.data;

  if (sourceCategory === "notes" && !noteUploadId) {
    return NextResponse.json(
      { error: "noteUploadId is required when sourceCategory is 'notes'" },
      { status: 400 }
    );
  }

  const { data: course } = await supabase
    .from("courses")
    .select("code, title, course_settings(ai_indexing_allowed)")
    .eq("id", courseId)
    .single();

  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }
  if (course.course_settings?.ai_indexing_allowed === false) {
    return NextResponse.json(
      { error: "AI features are disabled for this course" },
      { status: 403 }
    );
  }

  let uploadsQuery = supabase
    .from("uploads")
    .select("id, extracted_text, display_label")
    .eq("course_id", courseId)
    .eq("status", "approved")
    .not("extracted_text", "is", null);

  uploadsQuery =
    sourceCategory === "notes"
      ? uploadsQuery.eq("id", noteUploadId)
      : uploadsQuery.eq("resource_type", sourceCategory);

  const { data: uploads, error: uploadsError } = await uploadsQuery;

  if (uploadsError) {
    return NextResponse.json({ error: uploadsError.message }, { status: 500 });
  }
  if (!uploads || uploads.length === 0) {
    return NextResponse.json(
      {
        error:
          "No approved, text-extracted uploads found for this selection. " +
          "The source file(s) may still be processing, or may not have readable text.",
      },
      { status: 404 }
    );
  }

  const sourceTexts = uploads.map((u) => u.extracted_text as string);
  const sourceUploadIds = uploads.map((u) => u.id);

  const prompt = buildQuestionPrompt({
    courseTitle: course.title,
    courseCode: course.code,
    sourceCategory,
    questionType,
    difficulty,
    sourceTexts,
  });

  let content: unknown;
  try {
    const raw = await generateWithGemini(prompt, { responseFormat: "json" });
    content = JSON.parse(raw);
  } catch (err) {
    if (err instanceof GeminiError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    return NextResponse.json(
      { error: "AI returned output that could not be parsed. Please try again." },
      { status: 502 }
    );
  }

  const { data: saved, error: saveError } = await supabase
    .from("question_banks")
    .insert({
      course_id: courseId,
      source_upload_ids: sourceUploadIds,
      source_category: sourceCategory,
      difficulty,
      question_type: questionType,
      content,
      generated_by: user.id,
    })
    .select()
    .single();

  if (saveError) {
    return NextResponse.json({ error: saveError.message }, { status: 500 });
  }

  return NextResponse.json({ questionBank: saved });
}
