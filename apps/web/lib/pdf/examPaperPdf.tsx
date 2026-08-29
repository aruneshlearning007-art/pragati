import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import type { ExamPaperView, ExamQuestionView } from "@/lib/agents/examPaper";

// Known V1 limitation: math notation ($...$) in question text renders as
// plain text here, not real math - there is no KaTeX-for-PDF equivalent in
// @react-pdf/renderer. Acceptable for a first pass since exam templates are
// opt-in per subject; revisit if a Math-subject exam paper needs it.

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 11, fontFamily: "Helvetica", color: "#1a1a1a" },
  header: { marginBottom: 18, borderBottom: 1.5, borderBottomColor: "#1a1a1a", paddingBottom: 10 },
  title: { fontSize: 16, fontFamily: "Helvetica-Bold", marginBottom: 5 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", fontSize: 10, color: "#444", marginTop: 2 },
  answerKeyBadge: { marginTop: 6, fontSize: 11, fontFamily: "Helvetica-Bold", color: "#b3401f" },
  sectionHeader: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    marginTop: 16,
    marginBottom: 8,
    textDecoration: "underline",
  },
  question: { marginBottom: 10 },
  questionText: { marginBottom: 3, lineHeight: 1.4 },
  optionRow: { flexDirection: "row", flexWrap: "wrap", marginLeft: 14, gap: 14 },
  optionText: { fontSize: 10.5 },
  blankLine: { marginLeft: 14, marginTop: 3, color: "#999", fontSize: 10.5 },
  answerText: { color: "#1a7a3a", marginTop: 3, marginLeft: 14, fontSize: 10.5 },
});

const DIFFICULTY_LABEL: Record<string, string> = {
  easy: "Set 1 - Beginner",
  medium: "Set 2 - Intermediate",
  hard: "Set 3 - Advance",
};

const SECTION_LETTERS = "ABCDEFGHIJ";
const OPTION_LETTERS = ["a", "b", "c", "d"];

interface ExamDocumentProps {
  paper: ExamPaperView;
  chapterTitle: string;
  subjectName: string;
  studentClass: string;
  board: string;
  showAnswers: boolean;
}

function QuestionBlock({ q, index, showAnswers }: { q: ExamQuestionView; index: number; showAnswers: boolean }) {
  let answerText: string | null = null;
  if (showAnswers) {
    if (q.kind === "true_false") {
      answerText = q.correctIndex === 0 ? "True" : q.correctIndex === 1 ? "False" : "—";
    } else if (q.kind === "mcq") {
      answerText = q.correctIndex !== null && q.options ? `(${OPTION_LETTERS[q.correctIndex]}) ${q.options[q.correctIndex]}` : "—";
    } else if (q.kind === "fill_blank") {
      answerText = q.correctText ?? "—";
    } else {
      answerText = q.modelAnswer ?? "—";
    }
  }

  return (
    <View style={styles.question} wrap={false}>
      <Text style={styles.questionText}>
        {index}. {q.text} ({q.marks} mark{q.marks > 1 ? "s" : ""})
      </Text>
      {q.kind === "mcq" && q.options && (
        <View style={styles.optionRow}>
          {q.options.map((opt, i) => (
            <Text key={i} style={styles.optionText}>
              ({OPTION_LETTERS[i]}) {opt}
            </Text>
          ))}
        </View>
      )}
      {q.kind === "true_false" && <Text style={styles.blankLine}>True  /  False</Text>}
      {q.kind === "subjective" && <Text style={styles.blankLine}>{"_".repeat(70)}</Text>}
      {showAnswers && <Text style={styles.answerText}>Answer: {answerText}</Text>}
    </View>
  );
}

function ExamDocument({ paper, chapterTitle, subjectName, studentClass, board, showAnswers }: ExamDocumentProps) {
  const questionsBySection = new Map<string, ExamQuestionView[]>();
  for (const q of paper.questions) {
    if (!questionsBySection.has(q.section)) questionsBySection.set(q.section, []);
    questionsBySection.get(q.section)!.push(q);
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>{chapterTitle}</Text>
          <View style={styles.metaRow}>
            <Text>
              {subjectName} · {studentClass} · {board}
            </Text>
            <Text>{DIFFICULTY_LABEL[paper.difficulty] ?? paper.difficulty}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text>Time: {paper.durationMinutes} minutes</Text>
            <Text>Max Marks: {paper.totalMarks}</Text>
          </View>
          {showAnswers && <Text style={styles.answerKeyBadge}>ANSWER KEY</Text>}
        </View>

        {paper.templateSections.map((section, i) => {
          const letter = SECTION_LETTERS[i] ?? String(i + 1);
          const questions = questionsBySection.get(letter) ?? [];
          return (
            <View key={letter}>
              <Text style={styles.sectionHeader}>
                Section {letter}: {section.label} ({section.count} × {section.marksEach} ={" "}
                {section.count * section.marksEach} Marks)
              </Text>
              {questions.map((q, qi) => (
                <QuestionBlock key={q.id} q={q} index={qi + 1} showAnswers={showAnswers} />
              ))}
            </View>
          );
        })}
      </Page>
    </Document>
  );
}

export async function renderQuestionPaperPdf(params: Omit<ExamDocumentProps, "showAnswers">): Promise<Buffer> {
  return renderToBuffer(<ExamDocument {...params} showAnswers={false} />);
}

export async function renderAnswerKeyPdf(params: Omit<ExamDocumentProps, "showAnswers">): Promise<Buffer> {
  return renderToBuffer(<ExamDocument {...params} showAnswers={true} />);
}
