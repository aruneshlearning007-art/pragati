// Every class (3-8) is school-scoped: a student only ever sees
// subjects/chapters uploaded by a teacher at their own school, regardless
// of class. Each school owns and curates its own content — nothing is
// shared across schools even when the curriculum happens to be the same
// (e.g. NCERT for Class 6-8). This is the single place that rule lives —
// both content generation/caching and "what shows in this student's
// sidebar" queries must go through it, so the rule can never drift
// between the two.
export interface ContentScope {
  schoolId: string | null;
  board: string;
  class: string;
}

export function getContentScope(params: {
  studentClass: string;
  board: string;
  schoolId: string | null;
}): ContentScope {
  return {
    schoolId: params.schoolId,
    board: params.board,
    class: params.studentClass,
  };
}
