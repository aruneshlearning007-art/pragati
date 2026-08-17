// India-specific curriculum rule: Class 3-5 use school-specific textbooks (no
// national standard book), Class 6-12 mostly follow NCERT and can share one
// pool of content across every school on the same board. This is the single
// place that rule lives — both content generation/caching and "what shows in
// this student's sidebar" queries must go through it, so the rule can never
// drift between the two.
export interface ContentScope {
  schoolId: string | null;
  board: string;
  class: string;
}

const SCHOOL_SCOPED_CLASSES = new Set(["Class 3", "Class 4", "Class 5"]);

export function isSchoolScoped(studentClass: string): boolean {
  return SCHOOL_SCOPED_CLASSES.has(studentClass);
}

export function getContentScope(params: {
  studentClass: string;
  board: string;
  schoolId: string | null;
}): ContentScope {
  const schoolScoped = isSchoolScoped(params.studentClass);
  return {
    schoolId: schoolScoped ? params.schoolId : null,
    board: params.board,
    class: params.studentClass,
  };
}
