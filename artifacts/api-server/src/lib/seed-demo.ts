import { hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import {
  announcementsTable,
  assessmentsTable,
  attendanceTable,
  classesTable,
  db,
  enrollmentsTable,
  gradesTable,
  studentsTable,
  subjectsTable,
  teachersTable,
  usersTable,
} from "@workspace/db";

const DEMO_PASSWORD = "EduTrack@2026";

function dateOffset(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export async function seedDemoData(): Promise<void> {
  if (process.env.NODE_ENV === "production") return;
  const demoEmail = "admin@edutrack.demo";
  const [existing] = await db.select({ id: usersTable.id }).from(usersTable)
    .where(eq(usersTable.email, demoEmail)).limit(1);
  if (existing) return;

  const passwordHash = await hash(DEMO_PASSWORD, 12);
  await db.transaction(async (tx) => {
    const [admin] = await tx.insert(usersTable).values({
      name: "Marina Costa", email: demoEmail, passwordHash, role: "admin",
    }).returning();

    const teacherInputs = [
      { name: "Rafael Nogueira", email: "rafael@edutrack.demo", area: "Matemática" },
      { name: "Camila Freitas", email: "camila@edutrack.demo", area: "Tecnologia" },
    ];
    const teacherProfiles = [];
    for (const input of teacherInputs) {
      const [user] = await tx.insert(usersTable).values({
        name: input.name, email: input.email, passwordHash, role: "teacher",
      }).returning();
      const [profile] = await tx.insert(teachersTable).values({ userId: user.id, area: input.area }).returning();
      teacherProfiles.push(profile);
    }

    const studentProfiles = [];
    for (let index = 1; index <= 10; index += 1) {
      const number = String(index).padStart(3, "0");
      const [user] = await tx.insert(usersTable).values({
        name: `Estudante ${number}`,
        email: `aluno${number}@edutrack.demo`,
        passwordHash,
        role: "student",
      }).returning();
      const [profile] = await tx.insert(studentsTable).values({
        userId: user.id, registration: `ET2026${number}`, phone: null,
      }).returning();
      studentProfiles.push(profile);
    }

    const subjectInputs = [
      { code: "MAT101", name: "Matemática Aplicada", workload: 60 },
      { code: "TEC102", name: "Fundamentos de Tecnologia", workload: 60 },
      { code: "POR103", name: "Comunicação e Escrita", workload: 40 },
    ];
    const subjectRows = await tx.insert(subjectsTable).values(subjectInputs).returning();
    const classInputs = [
      { name: "MAT101 · Turma A", term: "2026.2", subjectId: subjectRows[0].id, teacherId: teacherProfiles[0].id },
      { name: "TEC102 · Turma A", term: "2026.2", subjectId: subjectRows[1].id, teacherId: teacherProfiles[1].id },
      { name: "POR103 · Turma B", term: "2026.2", subjectId: subjectRows[2].id, teacherId: teacherProfiles[0].id },
    ];
    const classRows = await tx.insert(classesTable).values(classInputs).returning();

    for (const student of studentProfiles) {
      for (const classroom of classRows) {
        await tx.insert(enrollmentsTable).values({ studentId: student.id, classId: classroom.id });
      }
    }

    const assessmentRows = [];
    for (let classIndex = 0; classIndex < classRows.length; classIndex += 1) {
      const classroom = classRows[classIndex];
      for (let item = 1; item <= 3; item += 1) {
        const [assessment] = await tx.insert(assessmentsTable).values({
          classId: classroom.id,
          title: ["Avaliação diagnóstica", "Atividade prática", "Avaliação do módulo"][item - 1],
          scheduledDate: dateOffset(item === 1 ? -14 : item === 2 ? -7 : 5),
          maxGrade: "10",
          weight: item === 3 ? "2" : "1",
        }).returning();
        assessmentRows.push(assessment);
      }
    }

    for (const student of studentProfiles) {
      for (const assessment of assessmentRows) {
        const classIndex = classRows.findIndex((classroom) => classroom.id === assessment.classId);
        const score = 6 + ((student.id + assessment.id + classIndex) % 5);
        await tx.insert(gradesTable).values({
          studentId: student.id,
          assessmentId: assessment.id,
          value: String(Math.min(score, Number(assessment.maxGrade))),
        });
      }
      for (const classroom of classRows) {
        for (let day = 4; day >= 0; day -= 1) {
          await tx.insert(attendanceTable).values({
            studentId: student.id,
            classId: classroom.id,
            attendanceDate: dateOffset(-day - 1),
            present: (student.id + day) % 6 !== 0,
            recordedBy: teacherProfiles[classRows.findIndex((entry) => entry.id === classroom.id) % teacherProfiles.length].userId,
          });
        }
      }
    }

    await tx.insert(announcementsTable).values([
      {
        title: "Bem-vindos ao período 2026.2",
        body: "As atividades do novo período letivo já estão disponíveis. Consulte suas turmas e acompanhe os avisos por aqui.",
        audience: "all",
        createdBy: admin.id,
      },
      {
        title: "Avaliações desta semana",
        body: "Confira o calendário das próximas avaliações com seus professores.",
        audience: "student",
        createdBy: admin.id,
      },
    ]);
  });
}

export const demoCredentials = {
  password: DEMO_PASSWORD,
  admin: "admin@edutrack.demo",
  teacher: "rafael@edutrack.demo",
  student: "aluno001@edutrack.demo",
} as const;
