import { Router, type IRouter, type Request } from "express";
import rateLimit from "express-rate-limit";
import { hash } from "bcryptjs";
import { and, asc, count, countDistinct, desc, eq, gte, ilike, inArray, or } from "drizzle-orm";
import {
  CreateAnnouncementBody,
  CreateAnnouncementResponse,
  CreateAssessmentBody,
  CreateAssessmentResponse,
  CreateClassBody,
  CreateClassResponse,
  CreateEnrollmentBody,
  CreateEnrollmentResponse,
  CreateStudentBody,
  CreateStudentResponse,
  CreateSubjectBody,
  CreateSubjectResponse,
  CreateTeacherBody,
  CreateTeacherResponse,
  GetAcademicReportQueryParams,
  GetAcademicReportResponse,
  GetClassParams,
  GetClassResponse,
  GetDashboardResponse,
  ListAnnouncementsResponse,
  ListAssessmentsQueryParams,
  ListAssessmentsResponse,
  ListAuditLogsQueryParams,
  ListAuditLogsResponse,
  ListClassesQueryParams,
  ListClassesResponse,
  ListGradesQueryParams,
  ListGradesResponse,
  ListStudentsQueryParams,
  ListStudentsResponse,
  ListSubjectsResponse,
  ListTeachersResponse,
  ListAttendanceQueryParams,
  ListAttendanceResponse,
  RecordAttendanceBody,
  RecordAttendanceResponse,
  UpsertGradeBody,
  UpsertGradeResponse,
} from "@workspace/api-zod";
import {
  announcementsTable,
  assessmentsTable,
  attendanceTable,
  auditLogsTable,
  classesTable,
  db,
  enrollmentsTable,
  gradesTable,
  studentsTable,
  subjectsTable,
  teachersTable,
  usersTable,
} from "@workspace/db";
import { requireAuth, requireRole, type Role } from "../middlewares/edutrack-auth";
import { attendanceRate, classAccess, isEnrolled, isTeacherOfClass, isUniqueConstraintError, recordAudit, weightedAverage } from "../lib/edutrack";

const router: IRouter = Router();
const writeLimiter = rateLimit({
  windowMs: 60_000,
  limit: 60,
  standardHeaders: "draft-7",
  legacyHeaders: false,
});
router.use("/students", writeLimiter);
router.use("/teachers", writeLimiter);
router.use("/subjects", writeLimiter);
router.use("/classes", writeLimiter);
router.use("/grades", writeLimiter);
router.use("/attendance", writeLimiter);
router.use("/announcements", writeLimiter);
router.use(requireAuth);

const role = (req: Request) => req.edutrackUser!.role as Role;

function integerParam(value: string | string[]): number {
  return Number(Array.isArray(value) ? value[0] : value);
}

async function fetchClasses(userId: number, userRole: "admin" | "teacher" | "student", search?: string) {
  const access = await classAccess(userId, userRole);
  const clauses = [eq(classesTable.active, true)];
  if (access !== null) clauses.push(inArray(classesTable.id, access.length ? access : [-1]));
  if (search) clauses.push(ilike(classesTable.name, `%${search.slice(0, 80)}%`));
  const rows = await db.select({
    id: classesTable.id,
    name: classesTable.name,
    term: classesTable.term,
    subjectId: subjectsTable.id,
    subjectName: subjectsTable.name,
    teacherId: teachersTable.id,
    teacherName: usersTable.name,
  }).from(classesTable)
    .innerJoin(subjectsTable, eq(classesTable.subjectId, subjectsTable.id))
    .innerJoin(teachersTable, eq(classesTable.teacherId, teachersTable.id))
    .innerJoin(usersTable, eq(teachersTable.userId, usersTable.id))
    .where(and(...clauses)).orderBy(asc(classesTable.name));
  const ids = rows.map((item) => item.id);
  const totals = ids.length
    ? await db.select({ classId: enrollmentsTable.classId, total: count() })
      .from(enrollmentsTable).where(and(inArray(enrollmentsTable.classId, ids), eq(enrollmentsTable.status, "active")))
      .groupBy(enrollmentsTable.classId)
    : [];
  const countById = new Map(totals.map((item) => [item.classId, Number(item.total)]));
  return rows.map((item) => ({ ...item, studentsCount: countById.get(item.id) ?? 0 }));
}

async function getStudentRows(classId: number) {
  return db.select({
    id: studentsTable.id,
    userId: usersTable.id,
    name: usersTable.name,
    email: usersTable.email,
    registration: studentsTable.registration,
    status: studentsTable.status,
    phone: studentsTable.phone,
  }).from(enrollmentsTable)
    .innerJoin(studentsTable, eq(enrollmentsTable.studentId, studentsTable.id))
    .innerJoin(usersTable, eq(studentsTable.userId, usersTable.id))
    .where(and(eq(enrollmentsTable.classId, classId), eq(enrollmentsTable.status, "active")))
    .orderBy(asc(usersTable.name));
}

router.get("/students", requireRole("admin"), async (req, res): Promise<void> => {
  const params = ListStudentsQueryParams.safeParse(req.query);
  if (!params.success) { res.status(400).json({ error: "Filtros inválidos." }); return; }
  const { page = 1, limit = 20, search } = params.data;
  const condition = search ? ilike(usersTable.name, `%${search.slice(0, 80)}%`) : undefined;
  const [totalRow] = await db.select({ total: count() }).from(studentsTable)
    .innerJoin(usersTable, eq(studentsTable.userId, usersTable.id)).where(condition);
  const items = await db.select({
    id: studentsTable.id, userId: usersTable.id, name: usersTable.name,
    email: usersTable.email, registration: studentsTable.registration,
    status: studentsTable.status, phone: studentsTable.phone,
  }).from(studentsTable).innerJoin(usersTable, eq(studentsTable.userId, usersTable.id))
    .where(condition).orderBy(asc(usersTable.name)).limit(limit).offset((page - 1) * limit);
  res.json(ListStudentsResponse.parse({ items, total: Number(totalRow.total), page, limit }));
});

router.post("/students", requireRole("admin"), async (req, res): Promise<void> => {
  const parsed = CreateStudentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Dados do aluno inválidos.", details: parsed.error.flatten() }); return; }
  const data = parsed.data;
  try {
    const student = await db.transaction(async (tx) => {
      const [user] = await tx.insert(usersTable).values({
        name: data.name.trim(), email: data.email.toLowerCase(), passwordHash: await hash(data.password, 12), role: "student",
      }).returning();
      const [profile] = await tx.insert(studentsTable).values({
        userId: user.id, registration: data.registration.trim(), phone: data.phone ?? null,
      }).returning();
      await tx.insert(auditLogsTable).values({ actorId: req.edutrackUser!.id, action: "create", entity: "student", entityId: profile.id });
      return { id: profile.id, userId: user.id, name: user.name, email: user.email, registration: profile.registration, status: profile.status, phone: profile.phone };
    });
    res.status(201).json(CreateStudentResponse.parse(student));
  } catch (error) {
    if (isUniqueConstraintError(error)) { res.status(409).json({ error: "E-mail ou matrícula já cadastrados." }); return; }
    throw error;
  }
});

router.get("/teachers", requireRole("admin", "teacher"), async (_req, res): Promise<void> => {
  const rows = await db.select({
    id: teachersTable.id, userId: usersTable.id, name: usersTable.name, email: usersTable.email, area: teachersTable.area,
  }).from(teachersTable).innerJoin(usersTable, eq(teachersTable.userId, usersTable.id)).orderBy(asc(usersTable.name));
  res.json(ListTeachersResponse.parse(rows));
});

router.post("/teachers", requireRole("admin"), async (req, res): Promise<void> => {
  const parsed = CreateTeacherBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Dados do professor inválidos.", details: parsed.error.flatten() }); return; }
  try {
    const data = parsed.data;
    const teacher = await db.transaction(async (tx) => {
      const [user] = await tx.insert(usersTable).values({
        name: data.name.trim(), email: data.email.toLowerCase(), passwordHash: await hash(data.password, 12), role: "teacher",
      }).returning();
      const [profile] = await tx.insert(teachersTable).values({ userId: user.id, area: data.area.trim() }).returning();
      await tx.insert(auditLogsTable).values({ actorId: req.edutrackUser!.id, action: "create", entity: "teacher", entityId: profile.id });
      return { id: profile.id, userId: user.id, name: user.name, email: user.email, area: profile.area };
    });
    res.status(201).json(CreateTeacherResponse.parse(teacher));
  } catch (error) {
    if (isUniqueConstraintError(error)) { res.status(409).json({ error: "E-mail já cadastrado." }); return; }
    throw error;
  }
});

router.get("/subjects", async (_req, res): Promise<void> => {
  const rows = await db.select({ id: subjectsTable.id, code: subjectsTable.code, name: subjectsTable.name, workload: subjectsTable.workload })
    .from(subjectsTable).where(eq(subjectsTable.active, true)).orderBy(asc(subjectsTable.name));
  res.json(ListSubjectsResponse.parse(rows));
});

router.post("/subjects", requireRole("admin"), async (req, res): Promise<void> => {
  const parsed = CreateSubjectBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Dados da disciplina inválidos.", details: parsed.error.flatten() }); return; }
  try {
    const [subject] = await db.insert(subjectsTable).values({
      code: parsed.data.code.trim().toUpperCase(), name: parsed.data.name.trim(), workload: parsed.data.workload,
    }).returning();
    await recordAudit(req.edutrackUser!.id, "create", "subject", subject.id);
    res.status(201).json(CreateSubjectResponse.parse(subject));
  } catch (error) {
    if (isUniqueConstraintError(error)) { res.status(409).json({ error: "Código de disciplina já cadastrado." }); return; }
    throw error;
  }
});

router.get("/classes", async (req, res): Promise<void> => {
  const parsed = ListClassesQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: "Filtro inválido." }); return; }
  const items = await fetchClasses(req.edutrackUser!.id, role(req), parsed.data.search);
  res.json(ListClassesResponse.parse(items));
});

router.post("/classes", requireRole("admin"), async (req, res): Promise<void> => {
  const parsed = CreateClassBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Dados da turma inválidos.", details: parsed.error.flatten() }); return; }
  const data = parsed.data;
  const [teacher] = await db.select({ id: teachersTable.id }).from(teachersTable).where(eq(teachersTable.id, data.teacherId)).limit(1);
  const [subject] = await db.select({ id: subjectsTable.id }).from(subjectsTable).where(and(eq(subjectsTable.id, data.subjectId), eq(subjectsTable.active, true))).limit(1);
  if (!teacher || !subject) { res.status(400).json({ error: "Professor ou disciplina inexistente." }); return; }
  const [created] = await db.insert(classesTable).values({
    name: data.name.trim(), term: data.term, teacherId: data.teacherId, subjectId: data.subjectId,
  }).returning();
  await recordAudit(req.edutrackUser!.id, "create", "class", created.id);
  const items = await fetchClasses(req.edutrackUser!.id, "admin");
  res.status(201).json(CreateClassResponse.parse(items.find((item) => item.id === created.id)));
});

router.get("/classes/:id", async (req, res): Promise<void> => {
  const parsed = GetClassParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: "Identificador de turma inválido." }); return; }
  const user = req.edutrackUser!;
  const classes = await fetchClasses(user.id, role(req));
  const classroom = classes.find((item) => item.id === parsed.data.id);
  if (!classroom) { res.status(404).json({ error: "Turma não encontrada." }); return; }
  const students = await getStudentRows(classroom.id);
  if (user.role === "student") {
    const [profile] = await db.select({ id: studentsTable.id }).from(studentsTable)
      .where(eq(studentsTable.userId, user.id)).limit(1);
    const ownStudentId = profile?.id;
    res.json(GetClassResponse.parse({ classroom, students: students.filter((item) => item.id === ownStudentId) }));
    return;
  }
  res.json(GetClassResponse.parse({ classroom, students }));
});

router.post("/enrollments", requireRole("admin"), async (req, res): Promise<void> => {
  const parsed = CreateEnrollmentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Matrícula inválida.", details: parsed.error.flatten() }); return; }
  const { studentId, classId } = parsed.data;
  const [student] = await db.select({ id: studentsTable.id }).from(studentsTable).where(eq(studentsTable.id, studentId)).limit(1);
  const [classroom] = await db.select({ id: classesTable.id }).from(classesTable).where(and(eq(classesTable.id, classId), eq(classesTable.active, true))).limit(1);
  if (!student || !classroom) { res.status(404).json({ error: "Aluno ou turma não encontrada." }); return; }
  try {
    const [enrollment] = await db.transaction(async (tx) => {
      const [record] = await tx.insert(enrollmentsTable).values({ studentId, classId }).returning();
      await tx.insert(auditLogsTable).values({ actorId: req.edutrackUser!.id, action: "enroll", entity: "enrollment", entityId: record.id });
      return [record];
    });
    res.status(201).json(CreateEnrollmentResponse.parse(enrollment));
  } catch (error) {
    if (isUniqueConstraintError(error)) { res.status(409).json({ error: "Este aluno já está matriculado nesta turma." }); return; }
    throw error;
  }
});

router.get("/assessments", async (req, res): Promise<void> => {
  const parsed = ListAssessmentsQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: "Filtro inválido." }); return; }
  const access = await classAccess(req.edutrackUser!.id, role(req));
  const clauses = [];
  if (access !== null) clauses.push(inArray(assessmentsTable.classId, access.length ? access : [-1]));
  if (parsed.data.classId) clauses.push(eq(assessmentsTable.classId, parsed.data.classId));
  const rows = await db.select().from(assessmentsTable).where(clauses.length ? and(...clauses) : undefined).orderBy(asc(assessmentsTable.scheduledDate));
  res.json(ListAssessmentsResponse.parse(rows.map((item) => ({
    id: item.id, classId: item.classId, title: item.title, date: item.scheduledDate,
    maxGrade: Number(item.maxGrade), weight: Number(item.weight),
  }))));
});

router.post("/assessments", requireRole("admin", "teacher"), async (req, res): Promise<void> => {
  const parsed = CreateAssessmentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Dados da avaliação inválidos.", details: parsed.error.flatten() }); return; }
  const data = parsed.data;
  if (role(req) === "teacher" && !(await isTeacherOfClass(req.edutrackUser!.id, data.classId))) {
    res.status(403).json({ error: "Você não leciona nesta turma." }); return;
  }
  const [classroom] = await db.select({ id: classesTable.id }).from(classesTable).where(eq(classesTable.id, data.classId)).limit(1);
  if (!classroom) { res.status(404).json({ error: "Turma não encontrada." }); return; }
  const [assessment] = await db.insert(assessmentsTable).values({
    classId: data.classId, title: data.title.trim(), scheduledDate: data.date.toISOString().slice(0, 10), maxGrade: String(data.maxGrade), weight: String(data.weight),
  }).returning();
  await recordAudit(req.edutrackUser!.id, "create", "assessment", assessment.id);
  res.status(201).json(CreateAssessmentResponse.parse({
    id: assessment.id, classId: assessment.classId, title: assessment.title, date: assessment.scheduledDate,
    maxGrade: Number(assessment.maxGrade), weight: Number(assessment.weight),
  }));
});

router.get("/grades", async (req, res): Promise<void> => {
  const parsed = ListGradesQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: "Filtro inválido." }); return; }
  const user = req.edutrackUser!;
  const access = await classAccess(user.id, role(req));
  const conditions = [];
  if (access !== null) conditions.push(inArray(assessmentsTable.classId, access.length ? access : [-1]));
  if (parsed.data.classId) conditions.push(eq(assessmentsTable.classId, parsed.data.classId));
  if (user.role === "student") {
    const [profile] = await db.select({ id: studentsTable.id }).from(studentsTable).where(eq(studentsTable.userId, user.id)).limit(1);
    if (!profile) { res.json([]); return; }
    conditions.push(eq(gradesTable.studentId, profile.id));
  }
  const rows = await db.select({
    id: gradesTable.id, studentId: gradesTable.studentId, assessmentId: gradesTable.assessmentId, value: gradesTable.value,
    assessmentTitle: assessmentsTable.title, classId: assessmentsTable.classId, studentName: usersTable.name,
  }).from(gradesTable).innerJoin(assessmentsTable, eq(gradesTable.assessmentId, assessmentsTable.id))
    .innerJoin(studentsTable, eq(gradesTable.studentId, studentsTable.id)).innerJoin(usersTable, eq(studentsTable.userId, usersTable.id))
    .where(conditions.length ? and(...conditions) : undefined).orderBy(asc(usersTable.name));
  res.json(ListGradesResponse.parse(rows.map((row) => ({ ...row, value: Number(row.value) }))));
});

router.post("/grades", requireRole("admin", "teacher"), async (req, res): Promise<void> => {
  const parsed = UpsertGradeBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Nota inválida.", details: parsed.error.flatten() }); return; }
  const { studentId, assessmentId, value } = parsed.data;
  const [assessment] = await db.select().from(assessmentsTable).where(eq(assessmentsTable.id, assessmentId)).limit(1);
  if (!assessment) { res.status(404).json({ error: "Avaliação não encontrada." }); return; }
  if (role(req) === "teacher" && !(await isTeacherOfClass(req.edutrackUser!.id, assessment.classId))) {
    res.status(403).json({ error: "Você não leciona nesta turma." }); return;
  }
  if (!(await isEnrolled(studentId, assessment.classId))) { res.status(400).json({ error: "O aluno não pertence à turma desta avaliação." }); return; }
  if (value > Number(assessment.maxGrade)) { res.status(400).json({ error: "A nota ultrapassa o valor máximo da avaliação." }); return; }
  const [grade] = await db.insert(gradesTable).values({ studentId, assessmentId, value: String(value) })
    .onConflictDoUpdate({ target: [gradesTable.studentId, gradesTable.assessmentId], set: { value: String(value), updatedAt: new Date() } })
    .returning();
  await recordAudit(req.edutrackUser!.id, "upsert", "grade", grade.id);
  const [profile] = await db.select({ name: usersTable.name }).from(studentsTable).innerJoin(usersTable, eq(studentsTable.userId, usersTable.id)).where(eq(studentsTable.id, studentId)).limit(1);
  res.json(UpsertGradeResponse.parse({
    id: grade.id, studentId, assessmentId, value: Number(grade.value), assessmentTitle: assessment.title, classId: assessment.classId, studentName: profile?.name ?? null,
  }));
});

router.get("/attendance", async (req, res): Promise<void> => {
  const parsed = ListAttendanceQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: "Filtro inválido." }); return; }
  const user = req.edutrackUser!;
  const access = await classAccess(user.id, role(req));
  const conditions = [];
  if (access !== null) conditions.push(inArray(attendanceTable.classId, access.length ? access : [-1]));
  if (parsed.data.classId) conditions.push(eq(attendanceTable.classId, parsed.data.classId));
  if (user.role === "student") {
    const [profile] = await db.select({ id: studentsTable.id }).from(studentsTable).where(eq(studentsTable.userId, user.id)).limit(1);
    if (!profile) { res.json([]); return; }
    conditions.push(eq(attendanceTable.studentId, profile.id));
  }
  const rows = await db.select({
    id: attendanceTable.id, studentId: attendanceTable.studentId, classId: attendanceTable.classId,
    date: attendanceTable.attendanceDate, present: attendanceTable.present, studentName: usersTable.name,
  }).from(attendanceTable).innerJoin(studentsTable, eq(attendanceTable.studentId, studentsTable.id))
    .innerJoin(usersTable, eq(studentsTable.userId, usersTable.id)).where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(attendanceTable.attendanceDate));
  res.json(ListAttendanceResponse.parse(rows));
});

router.post("/attendance", requireRole("admin", "teacher"), async (req, res): Promise<void> => {
  const parsed = RecordAttendanceBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Dados de frequência inválidos.", details: parsed.error.flatten() }); return; }
  const data = parsed.data;
  if (role(req) === "teacher" && !(await isTeacherOfClass(req.edutrackUser!.id, data.classId))) {
    res.status(403).json({ error: "Você não leciona nesta turma." }); return;
  }
  if (!(await isEnrolled(data.studentId, data.classId))) { res.status(400).json({ error: "O aluno não está matriculado nesta turma." }); return; }
  try {
    const [row] = await db.insert(attendanceTable).values({
      studentId: data.studentId, classId: data.classId, attendanceDate: data.date.toISOString().slice(0, 10), present: data.present, recordedBy: req.edutrackUser!.id,
    }).returning();
    await recordAudit(req.edutrackUser!.id, "record", "attendance", row.id);
    const [profile] = await db.select({ name: usersTable.name }).from(studentsTable).innerJoin(usersTable, eq(studentsTable.userId, usersTable.id)).where(eq(studentsTable.id, row.studentId)).limit(1);
    res.status(201).json(RecordAttendanceResponse.parse({ id: row.id, studentId: row.studentId, classId: row.classId, date: row.attendanceDate, present: row.present, studentName: profile?.name ?? null }));
  } catch (error) {
    if (isUniqueConstraintError(error)) { res.status(409).json({ error: "A frequência deste aluno já foi registrada nesta data e turma." }); return; }
    throw error;
  }
});

router.get("/announcements", async (req, res): Promise<void> => {
  const audience = role(req);
  const rows = await db.select({
    id: announcementsTable.id, title: announcementsTable.title, body: announcementsTable.body,
    audience: announcementsTable.audience, createdAt: announcementsTable.createdAt, author: usersTable.name,
  }).from(announcementsTable).innerJoin(usersTable, eq(announcementsTable.createdBy, usersTable.id))
    .where(or(eq(announcementsTable.audience, "all"), eq(announcementsTable.audience, audience)))
    .orderBy(desc(announcementsTable.createdAt));
  res.json(ListAnnouncementsResponse.parse(rows));
});

router.post("/announcements", requireRole("admin"), async (req, res): Promise<void> => {
  const parsed = CreateAnnouncementBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Dados do aviso inválidos.", details: parsed.error.flatten() }); return; }
  const [row] = await db.insert(announcementsTable).values({
    title: parsed.data.title.trim(), body: parsed.data.body.trim(), audience: parsed.data.audience, createdBy: req.edutrackUser!.id,
  }).returning();
  await recordAudit(req.edutrackUser!.id, "create", "announcement", row.id);
  res.status(201).json(CreateAnnouncementResponse.parse({
    id: row.id, title: row.title, body: row.body, audience: row.audience, createdAt: row.createdAt, author: req.edutrackUser!.name,
  }));
});

router.get("/dashboard", async (req, res): Promise<void> => {
  const user = req.edutrackUser!;
  const access = await classAccess(user.id, role(req));
  const classIds = access === null ? undefined : access.length ? access : [-1];
  const classWhere = classIds ? inArray(classesTable.id, classIds) : undefined;
  const [classesCount] = await db.select({ total: count() }).from(classesTable).where(classWhere);
  const [studentsCount] = await db.select({ total: countDistinct(enrollmentsTable.studentId) }).from(enrollmentsTable)
    .innerJoin(classesTable, eq(enrollmentsTable.classId, classesTable.id))
    .where(and(eq(enrollmentsTable.status, "active"), classIds ? inArray(classesTable.id, classIds) : undefined));
  const classIdsForUpcoming = access === null ? undefined : access.length ? access : [-1];
  const upcoming = await db.select().from(assessmentsTable).where(and(
    classIdsForUpcoming ? inArray(assessmentsTable.classId, classIdsForUpcoming) : undefined,
    gte(assessmentsTable.scheduledDate, new Date().toISOString().slice(0, 10)),
  )).orderBy(asc(assessmentsTable.scheduledDate)).limit(5);
  const announcements = await db.select({
    id: announcementsTable.id, title: announcementsTable.title, body: announcementsTable.body,
    audience: announcementsTable.audience, createdAt: announcementsTable.createdAt, author: usersTable.name,
  }).from(announcementsTable).innerJoin(usersTable, eq(announcementsTable.createdBy, usersTable.id))
    .where(or(eq(announcementsTable.audience, "all"), eq(announcementsTable.audience, user.role)))
    .orderBy(desc(announcementsTable.createdAt)).limit(3);

  let average = 0;
  let attendance = 0;
  let studentTotal = Number(studentsCount.total);
  let ownStudentId: number | null = null;
  if (user.role === "student") {
    const [student] = await db.select({ id: studentsTable.id }).from(studentsTable).where(eq(studentsTable.userId, user.id)).limit(1);
    if (student) {
      ownStudentId = student.id;
      const ownGrades = await db.select({ value: gradesTable.value, maxGrade: assessmentsTable.maxGrade, weight: assessmentsTable.weight })
        .from(gradesTable).innerJoin(assessmentsTable, eq(gradesTable.assessmentId, assessmentsTable.id))
        .where(eq(gradesTable.studentId, student.id));
      average = weightedAverage(ownGrades.map((item) => ({ value: Number(item.value), maxGrade: Number(item.maxGrade), weight: Number(item.weight) })));
      const ownAttendance = await db.select({ present: attendanceTable.present }).from(attendanceTable).where(eq(attendanceTable.studentId, student.id));
      attendance = attendanceRate(ownAttendance).percent;
      studentTotal = 1;
    }
  }
  const indicators = user.role === "admin"
    ? [
        { label: "Alunos ativos", value: studentTotal },
        { label: "Turmas ativas", value: Number(classesCount.total) },
        { label: "Professores", value: Number((await db.select({ total: count() }).from(teachersTable))[0].total) },
        { label: "Avisos publicados", value: Number((await db.select({ total: count() }).from(announcementsTable))[0].total) },
      ]
    : user.role === "teacher"
      ? [
          { label: "Minhas turmas", value: Number(classesCount.total) },
          { label: "Alunos nas turmas", value: studentTotal },
          { label: "Avaliações", value: upcoming.length },
        ]
      : [
          { label: "Disciplinas", value: Number(classesCount.total) },
          { label: "Média ponderada", value: Number(average.toFixed(2)) },
          { label: "Frequência", value: Number(attendance.toFixed(1)) },
        ];
  const visibleClasses = await fetchClasses(user.id, role(req));
  const performanceGrades = visibleClasses.length
    ? await db.select({
        classId: assessmentsTable.classId, value: gradesTable.value,
        maxGrade: assessmentsTable.maxGrade, weight: assessmentsTable.weight,
      }).from(gradesTable).innerJoin(assessmentsTable, eq(gradesTable.assessmentId, assessmentsTable.id))
        .where(and(
          inArray(assessmentsTable.classId, visibleClasses.map((item) => item.id)),
          ownStudentId === null ? undefined : eq(gradesTable.studentId, ownStudentId),
        ))
    : [];
  const performance = visibleClasses.map((classroom) => ({
    label: classroom.subjectName,
    value: Number(weightedAverage(performanceGrades.filter((item) => item.classId === classroom.id)
      .map((item) => ({ value: Number(item.value), maxGrade: Number(item.maxGrade), weight: Number(item.weight) }))).toFixed(2)),
  }));
  res.json(GetDashboardResponse.parse({
    role: user.role, indicators, performance,
    upcoming: upcoming.map((item) => ({ id: item.id, classId: item.classId, title: item.title, date: item.scheduledDate, maxGrade: Number(item.maxGrade), weight: Number(item.weight) })),
    announcements,
  }));
});

router.get("/reports", async (req, res): Promise<void> => {
  const parsed = GetAcademicReportQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: "Filtro inválido." }); return; }
  const user = req.edutrackUser!;
  const access = await classAccess(user.id, role(req));
  if (user.role === "student" && !parsed.data.classId) { res.status(400).json({ error: "Informe uma turma para consultar seu relatório." }); return; }
  if (parsed.data.classId && access !== null && !access.includes(parsed.data.classId)) { res.status(404).json({ error: "Turma não encontrada." }); return; }
  const classIds = parsed.data.classId ? [parsed.data.classId] : access;
  const rosterConditions = [eq(enrollmentsTable.status, "active")];
  if (classIds !== null) rosterConditions.push(inArray(enrollmentsTable.classId, classIds.length ? classIds : [-1]));
  if (user.role === "student") {
    const [student] = await db.select({ id: studentsTable.id }).from(studentsTable).where(eq(studentsTable.userId, user.id)).limit(1);
    if (!student) { res.json(GetAcademicReportResponse.parse({ summary: { averageGrade: 0, attendancePercent: 0, studentCount: 0 }, rows: [] })); return; }
    rosterConditions.push(eq(studentsTable.id, student.id));
  }
  const roster = await db.select({
    studentId: studentsTable.id, studentName: usersTable.name, classId: enrollmentsTable.classId,
  }).from(enrollmentsTable).innerJoin(studentsTable, eq(enrollmentsTable.studentId, studentsTable.id))
    .innerJoin(usersTable, eq(studentsTable.userId, usersTable.id)).where(and(...rosterConditions));
  const rows = [];
  for (const student of roster) {
    const gradeRows = await db.select({
      value: gradesTable.value, maxGrade: assessmentsTable.maxGrade, weight: assessmentsTable.weight,
    }).from(gradesTable).innerJoin(assessmentsTable, eq(gradesTable.assessmentId, assessmentsTable.id))
      .where(and(eq(gradesTable.studentId, student.studentId), eq(assessmentsTable.classId, student.classId)));
    const attendanceRows = await db.select({ present: attendanceTable.present }).from(attendanceTable)
      .where(and(eq(attendanceTable.studentId, student.studentId), eq(attendanceTable.classId, student.classId)));
    const rate = attendanceRate(attendanceRows);
    rows.push({
      studentId: student.studentId, studentName: student.studentName,
      averageGrade: Number(weightedAverage(gradeRows.map((item) => ({ value: Number(item.value), maxGrade: Number(item.maxGrade), weight: Number(item.weight) }))).toFixed(2)),
      present: rate.present, sessions: rate.sessions,
    });
  }
  const averageGrade = rows.length ? rows.reduce((sum, item) => sum + item.averageGrade, 0) / rows.length : 0;
  const sessions = rows.reduce((sum, item) => sum + item.sessions, 0);
  const presents = rows.reduce((sum, item) => sum + item.present, 0);
  const report = { summary: { averageGrade: Number(averageGrade.toFixed(2)), attendancePercent: sessions ? Number((presents / sessions * 100).toFixed(2)) : 0, studentCount: rows.length }, rows };
  res.json(GetAcademicReportResponse.parse(report));
});

router.get("/audit", requireRole("admin"), async (req, res): Promise<void> => {
  const parsed = ListAuditLogsQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: "Página inválida." }); return; }
  const page = parsed.data.page ?? 1;
  const [totalRow] = await db.select({ total: count() }).from(auditLogsTable);
  const entries = await db.select({
    id: auditLogsTable.id, actorName: usersTable.name, action: auditLogsTable.action,
    entity: auditLogsTable.entity, entityId: auditLogsTable.entityId, createdAt: auditLogsTable.createdAt,
  }).from(auditLogsTable).leftJoin(usersTable, eq(auditLogsTable.actorId, usersTable.id))
    .orderBy(desc(auditLogsTable.createdAt)).limit(30).offset((page - 1) * 30);
  res.json(ListAuditLogsResponse.parse({
    items: entries.map((item) => ({ ...item, actorName: item.actorName ?? "Conta removida" })),
    total: Number(totalRow.total), page,
  }));
});

export default router;
