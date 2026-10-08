export function weightedAverage(
  grades: Array<{ value: number; maxGrade: number; weight: number }>,
): number {
  const applicable = grades.filter((grade) => grade.maxGrade > 0 && grade.weight > 0);
  const totalWeight = applicable.reduce((total, grade) => total + grade.weight, 0);
  if (!totalWeight) return 0;
  return applicable.reduce(
    (total, grade) => total + (grade.value / grade.maxGrade) * 10 * grade.weight,
    0,
  ) / totalWeight;
}

export function attendanceRate(rows: Array<{ present: boolean }>) {
  const present = rows.filter((row) => row.present).length;
  const sessions = rows.length;
  return { present, sessions, percent: sessions ? (present / sessions) * 100 : 0 };
}
