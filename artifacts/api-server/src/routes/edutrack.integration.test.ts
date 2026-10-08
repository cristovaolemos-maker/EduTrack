import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { Server } from "node:http";
import app from "../app";
import { demoCredentials, seedDemoData } from "../lib/seed-demo";

let server: Server;
let baseUrl: string;

before(async () => {
  await seedDemoData();
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (server) await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

async function request(path: string, options: { method?: string; cookie?: string; body?: unknown; origin?: string } = {}) {
  const response = await fetch(`${baseUrl}/api${path}`, {
    method: options.method ?? "GET",
    headers: {
      ...(options.cookie ? { cookie: options.cookie } : {}),
      ...(options.origin ? { origin: options.origin } : {}),
      ...(options.body !== undefined ? { "content-type": "application/json" } : {}),
    },
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });
  const text = await response.text();
  return {
    status: response.status,
    headers: response.headers,
    body: text ? JSON.parse(text) as Record<string, any> : {},
  };
}

async function login(email: string, password = demoCredentials.password) {
  const response = await request("/auth/login", { method: "POST", body: { email, password } });
  assert.equal(response.status, 200);
  const setCookie = response.headers.get("set-cookie");
  assert.ok(setCookie);
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=Lax/i);
  assert.match(setCookie, /Path=\/api/i);
  return { cookie: setCookie.split(";")[0], user: response.body.user };
}

test("session security, role isolation, academic workflows, and persistent records", async () => {
  const anonymous = await request("/dashboard");
  assert.equal(anonymous.status, 401);
  const invalidLogin = await request("/auth/login", {
    method: "POST",
    body: { email: demoCredentials.admin, password: "incorrect-password" },
  });
  assert.equal(invalidLogin.status, 401);

  const spec = await request("/openapi.json");
  assert.equal(spec.status, 200);
  assert.equal(spec.body.openapi, "3.1.0");

  const admin = await login(demoCredentials.admin);
  assert.equal(admin.user.role, "admin");
  const csrfRejected = await request("/auth/logout", {
    method: "POST", cookie: admin.cookie, origin: "https://attacker.example",
  });
  assert.equal(csrfRejected.status, 403);
  const cookieHeader = await request("/auth/me", { cookie: admin.cookie });
  assert.equal(cookieHeader.status, 200);
  const sessionCookie = (await request("/auth/login", {
    method: "POST",
    body: { email: "not-an-email", password: "short" },
  })).status;
  assert.equal(sessionCookie, 400);

  const students = await request("/students?page=1&limit=20", { cookie: admin.cookie });
  assert.equal(students.status, 200);
  assert.ok(students.body.items.length >= 10);
  const classrooms = await request("/classes", { cookie: admin.cookie });
  assert.equal(classrooms.status, 200);
  assert.ok(classrooms.body.length >= 2);
  const firstClass = classrooms.body[0];
  const classDetail = await request(`/classes/${firstClass.id}`, { cookie: admin.cookie });
  assert.equal(classDetail.status, 200);
  const student = classDetail.body.students[0];
  assert.ok(student);

  const duplicateEnrollment = await request("/enrollments", {
    method: "POST", cookie: admin.cookie, body: { studentId: student.id, classId: firstClass.id },
  });
  assert.equal(duplicateEnrollment.status, 409, JSON.stringify(duplicateEnrollment.body));

  const teacher = await login(demoCredentials.teacher);
  const assessments = await request(`/assessments?classId=${firstClass.id}`, { cookie: teacher.cookie });
  assert.equal(assessments.status, 200);
  assert.ok(assessments.body.length);
  const assessment = assessments.body[0];
  const invalidGrade = await request("/grades", {
    method: "POST", cookie: teacher.cookie,
    body: { studentId: student.id, assessmentId: assessment.id, value: assessment.maxGrade + 1 },
  });
  assert.equal(invalidGrade.status, 400);

  const secondTeacher = await login("camila@edutrack.demo");
  const secondTeacherClasses = await request("/classes", { cookie: secondTeacher.cookie });
  assert.equal(secondTeacherClasses.status, 200);
  assert.ok(secondTeacherClasses.body.every((item: { id: number }) => item.id !== firstClass.id));
  const forbiddenClass = await request(`/classes/${firstClass.id}`, { cookie: secondTeacher.cookie });
  assert.equal(forbiddenClass.status, 404);

  const studentAccount = await login("aluno001@edutrack.demo");
  const forbiddenRoster = await request("/students", { cookie: studentAccount.cookie });
  assert.equal(forbiddenRoster.status, 403);
  const studentClassDetail = await request(`/classes/${firstClass.id}`, { cookie: studentAccount.cookie });
  assert.equal(studentClassDetail.status, 200);
  assert.equal(studentClassDetail.body.students.length, 1);
  const ownStudentId = studentClassDetail.body.students[0].id;
  const ownGrades = await request(`/grades?classId=${firstClass.id}`, { cookie: studentAccount.cookie });
  assert.equal(ownGrades.status, 200);
  assert.ok(ownGrades.body.every((grade: { studentId: number }) => grade.studentId === ownStudentId));

  const savedGrade = await request("/grades", {
    method: "POST", cookie: teacher.cookie,
    body: { studentId: student.id, assessmentId: assessment.id, value: 8.5 },
  });
  assert.equal(savedGrade.status, 200);
  assert.equal(savedGrade.body.value, 8.5);
  const gradesAfterSave = await request(`/grades?classId=${firstClass.id}`, { cookie: admin.cookie });
  assert.ok(gradesAfterSave.body.some((item: { studentId: number; assessmentId: number; value: number }) =>
    item.studentId === student.id && item.assessmentId === assessment.id && item.value === 8.5));

  const attendance = await request(`/attendance?classId=${firstClass.id}`, { cookie: teacher.cookie });
  assert.equal(attendance.status, 200);
  assert.ok(attendance.body.length);
  const existingAttendance = attendance.body[0];
  const duplicateAttendance = await request("/attendance", {
    method: "POST", cookie: teacher.cookie,
    body: { studentId: existingAttendance.studentId, classId: firstClass.id, date: existingAttendance.date, present: existingAttendance.present },
  });
  assert.equal(duplicateAttendance.status, 409);

  const studentDashboard = await request("/dashboard", { cookie: studentAccount.cookie });
  assert.equal(studentDashboard.status, 200);
  assert.ok(studentDashboard.body.indicators.length);
  const audit = await request("/audit", { cookie: admin.cookie });
  assert.equal(audit.status, 200);
  assert.ok(audit.body.total > 0);

  const logout = await request("/auth/logout", { method: "POST", cookie: studentAccount.cookie });
  assert.equal(logout.status, 204);
  const expiredSession = await request("/dashboard", { cookie: studentAccount.cookie });
  assert.equal(expiredSession.status, 401);
});
