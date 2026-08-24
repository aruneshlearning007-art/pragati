"use client";

import { useEffect } from "react";
import { setActiveSubjectId } from "@/lib/activeSubjectStore";

export function SetActiveSubject({ subjectId }: { subjectId: string | null }) {
  useEffect(() => {
    setActiveSubjectId(subjectId);
  }, [subjectId]);
  return null;
}
