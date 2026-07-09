/**
 * Naming Service — §7 of the architecture doc.
 *
 * The user only ever supplies (resourceType, label). This function assembles
 * the official filename server-side so nobody can hand-construct a name that
 * breaks the department's naming convention.
 *
 * Examples this produces:
 *   generateFilename({ courseCode: 'CSC201', resourceType: 'notes', label: 'Linked Lists' })
 *     -> "CSC201 Notes – Linked Lists"
 *   generateFilename({ courseCode: 'CSC201', resourceType: 'test', label: '1', year: '2025' })
 *     -> "CSC201 Test 1 – 2025"
 *   generateFilename({ courseCode: 'CSC201', resourceType: 'exam', year: '2023' })
 *     -> "CSC201 Exam – 2023"
 */

export type ResourceType = 'notes' | 'test' | 'assignment' | 'exam' | 'other';

const RESOURCE_TYPE_LABEL: Record<ResourceType, string> = {
  notes: 'Notes',
  test: 'Test',
  assignment: 'Assignment',
  exam: 'Exam',
  other: 'Resource',
};

export function generateFilename(input: {
  courseCode: string;
  resourceType: ResourceType;
  label?: string; // e.g. topic name ("Linked Lists"), or a number ("1")
  year?: string;  // e.g. '2025'
}): string {
  const typeLabel = RESOURCE_TYPE_LABEL[input.resourceType];

  // "CSC201 Test 1 – 2025": label is a short number/id, year follows it directly
  if (input.label && input.year) {
    return `${input.courseCode} ${typeLabel} ${input.label} – ${input.year}`;
  }

  // "CSC201 Notes – Linked Lists" or "CSC201 Exam – 2023": one qualifier after a dash
  const qualifier = input.label ?? input.year;
  if (qualifier) {
    return `${input.courseCode} ${typeLabel} – ${qualifier}`;
  }

  // "CSC201 Assignment 1" style falls through to caller passing label='1' above;
  // bare fallback when neither label nor year is given:
  return `${input.courseCode} ${typeLabel}`;
}
