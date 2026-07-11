// Semester values are stored as 'First'/'Second' in the database — that
// hasn't changed, to avoid an enum-rename migration and touching every
// place that writes those values (course creation, uploads, RLS scoping).
// What has changed is that the product now calls these "Alpha" and "Omega"
// everywhere a person actually sees them. This is the one place that
// First->Alpha / Second->Omega mapping lives, so no component duplicates it.
export function displaySemester(semester: string): string {
  if (semester === 'First') return 'Alpha';
  if (semester === 'Second') return 'Omega';
  return semester;
}
