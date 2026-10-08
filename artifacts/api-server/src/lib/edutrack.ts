import { and, eq, inArray } from "drizzle-orm";
import {
  auditLogsTable,
  attendanceTable,
  classesTable,
  db,
  enrollmentsTable,
  studentsTable,
  teachersTable,
} from "@workspace/db";
import type { Role } from "../middlewares/edutrack-auth";
export { attendanceRate, weightedAverage } from "./academic-calculations";

export async function classAccess(userId: number, role: Role): Promise<number[] | null> {
  if (role === "admin") return null;
  if (role === "teacher") {
    const [teacher] = await db.select({ id: teachersTable.id }).from(teachersTable).where(eq(teachersTable.userId, userId)).limit(1);
    if (!teacher) return [];
    const rows = await db.select({ id: classesTable.id }).from(classesTable).where(eq(classesTable.teacherId, teacher.id));
    return rows.map((row) => row.id);
  }
  const [student] = await db.select({ id: studentsTable.id }).from(studentsTable)
    .where(eq(studentsTable.userId, userId)).limit(1);
  if (!student) return [];
  const rows = await db.select({ id: enrollmentsTable.classId }).from(enrollmentsTable).where(
    and(eq(enrollmentsTable.studentId, student.id), eq(enrollmentsTable.status, "active")),
  );
  return rows.map((row) => row.id);
}

export async function isEnrolled(studentId: number, classId: number): Promise<boolean> {
  const [row] = await db.select({ id: enrollmentsTable.id }).from(enrollmentsTable).where(
    and(eq(enrollmentsTable.studentId, studentId), eq(enrollmentsTable.classId, classId), eq(enrollmentsTable.status, "active")),
  ).limit(1);
  return Boolean(row);
}

export async function isTeacherOfClass(userId: number, classId: number): Promise<boolean> {
  const [row] = await db.select({ id: classesTable.id }).from(classesTable).innerJoin(
    teachersTable,
    eq(classesTable.teacherId, teachersTable.id),
  ).where(and(eq(classesTable.id, classId), eq(teachersTable.userId, userId))).limit(1);
  return Boolean(row);
}

export function classFilter(ids: number[] | null, column: typeof classesTable.id) {
  return ids === null ? undefined : ids.length ? inArray(column, ids) : inArray(column, [-1]);
}

export async function recordAudit(
  actorId: number,
  action: string,
  entity: string,
  entityId: number | null = null,
) {
  await db.insert(auditLogsTable).values({ actorId, action, entity, entityId });
}

export function isUniqueConstraintError(error: unknown): boolean {
  let current = error;
  for (let depth = 0; depth < 4 && current && typeof current === "object"; depth += 1) {
    const candidate = current as { code?: unknown; cause?: unknown };
    if (candidate.code === "23505") return true;
    current = candidate.cause;
  }
  return false;
}
