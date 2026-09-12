export const STUDENT_GRADES = [
  "Kindergarten",
  "1st-grade",
  "2nd-grade",
  "3rd-grade",
  "4th-grade",
  "5th-grade",
  "6th-grade",
  "7th-grade",
  "8th-grade",
  "9th-grade",
  "10th-grade",
  "11th-grade",
  "12th-grade",
  "Graduated",
] as const;

export type StudentGrade = (typeof STUDENT_GRADES)[number];

export const GRADE_LABELS: Record<StudentGrade, string> = {
  Kindergarten: "Kindergarten",
  "1st-grade": "1st Grade",
  "2nd-grade": "2nd Grade",
  "3rd-grade": "3rd Grade",
  "4th-grade": "4th Grade",
  "5th-grade": "5th Grade",
  "6th-grade": "6th Grade",
  "7th-grade": "7th Grade",
  "8th-grade": "8th Grade",
  "9th-grade": "9th Grade",
  "10th-grade": "10th Grade",
  "11th-grade": "11th Grade",
  "12th-grade": "12th Grade",
  Graduated: "Graduated",
};

const GRADE_PROGRESSION_MAP: Record<string, StudentGrade> = {
  kindergarten: "1st-grade",
  k: "1st-grade",
  "1st-grade": "2nd-grade",
  "1st grade": "2nd-grade",
  "1": "2nd-grade",
  "2nd-grade": "3rd-grade",
  "2nd grade": "3rd-grade",
  "2": "3rd-grade",
  "3rd-grade": "4th-grade",
  "3rd grade": "4th-grade",
  "3": "4th-grade",
  "4th-grade": "5th-grade",
  "4th grade": "5th-grade",
  "4": "5th-grade",
  "5th-grade": "6th-grade",
  "5th grade": "6th-grade",
  "5": "6th-grade",
  "6th-grade": "7th-grade",
  "6th grade": "7th-grade",
  "6": "7th-grade",
  "7th-grade": "8th-grade",
  "7th grade": "8th-grade",
  "7": "8th-grade",
  "8th-grade": "9th-grade",
  "8th grade": "9th-grade",
  "8": "9th-grade",
  "9th-grade": "10th-grade",
  "9th grade": "10th-grade",
  "9": "10th-grade",
  "10th-grade": "11th-grade",
  "10th grade": "11th-grade",
  "10": "11th-grade",
  "11th-grade": "12th-grade",
  "11th grade": "12th-grade",
  "11": "12th-grade",
  "12th-grade": "Graduated",
  "12th grade": "Graduated",
  "12": "Graduated",
};

export function getNextGrade(currentGrade: string | null | undefined): StudentGrade | null {
  if (!currentGrade) return null;
  const key = currentGrade.trim().toLowerCase();
  return GRADE_PROGRESSION_MAP[key] ?? null;
}
