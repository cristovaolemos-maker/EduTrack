import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

export const usersTable = pgTable(
  "edutrack_users",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: text("role").notNull(),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("edutrack_users_email_uq").on(table.email)],
);

export const studentsTable = pgTable(
  "edutrack_students",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
    registration: text("registration").notNull(),
    phone: text("phone"),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("edutrack_students_user_uq").on(table.userId),
    uniqueIndex("edutrack_students_registration_uq").on(table.registration),
  ],
);

export const teachersTable = pgTable(
  "edutrack_teachers",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
    area: text("area").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("edutrack_teachers_user_uq").on(table.userId)],
);

export const subjectsTable = pgTable(
  "edutrack_subjects",
  {
    id: serial("id").primaryKey(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    workload: integer("workload").notNull(),
    active: boolean("active").notNull().default(true),
  },
  (table) => [uniqueIndex("edutrack_subjects_code_uq").on(table.code)],
);

export const classesTable = pgTable(
  "edutrack_classes",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    term: text("term").notNull(),
    subjectId: integer("subject_id").notNull().references(() => subjectsTable.id, { onDelete: "restrict" }),
    teacherId: integer("teacher_id").notNull().references(() => teachersTable.id, { onDelete: "restrict" }),
    active: boolean("active").notNull().default(true),
  },
  (table) => [
    index("edutrack_classes_teacher_idx").on(table.teacherId),
    index("edutrack_classes_subject_idx").on(table.subjectId),
  ],
);

export const enrollmentsTable = pgTable(
  "edutrack_enrollments",
  {
    id: serial("id").primaryKey(),
    studentId: integer("student_id").notNull().references(() => studentsTable.id, { onDelete: "restrict" }),
    classId: integer("class_id").notNull().references(() => classesTable.id, { onDelete: "restrict" }),
    status: text("status").notNull().default("active"),
    enrolledAt: timestamp("enrolled_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("edutrack_enrollment_student_class_uq").on(table.studentId, table.classId),
    index("edutrack_enrollment_class_idx").on(table.classId),
  ],
);

export const assessmentsTable = pgTable(
  "edutrack_assessments",
  {
    id: serial("id").primaryKey(),
    classId: integer("class_id").notNull().references(() => classesTable.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    scheduledDate: date("scheduled_date", { mode: "string" }).notNull(),
    maxGrade: numeric("max_grade", { precision: 7, scale: 2 }).notNull(),
    weight: numeric("weight", { precision: 7, scale: 2 }).notNull().default("1"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("edutrack_assessments_class_idx").on(table.classId)],
);

export const gradesTable = pgTable(
  "edutrack_grades",
  {
    id: serial("id").primaryKey(),
    studentId: integer("student_id").notNull().references(() => studentsTable.id, { onDelete: "restrict" }),
    assessmentId: integer("assessment_id").notNull().references(() => assessmentsTable.id, { onDelete: "restrict" }),
    value: numeric("value", { precision: 7, scale: 2 }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("edutrack_grade_student_assessment_uq").on(table.studentId, table.assessmentId),
    index("edutrack_grades_student_idx").on(table.studentId),
  ],
);

export const attendanceTable = pgTable(
  "edutrack_attendance",
  {
    id: serial("id").primaryKey(),
    studentId: integer("student_id").notNull().references(() => studentsTable.id, { onDelete: "restrict" }),
    classId: integer("class_id").notNull().references(() => classesTable.id, { onDelete: "restrict" }),
    attendanceDate: date("attendance_date", { mode: "string" }).notNull(),
    present: boolean("present").notNull(),
    recordedBy: integer("recorded_by").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("edutrack_attendance_unique_session_uq").on(
      table.studentId,
      table.classId,
      table.attendanceDate,
    ),
    index("edutrack_attendance_class_idx").on(table.classId),
  ],
);

export const announcementsTable = pgTable(
  "edutrack_announcements",
  {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    audience: text("audience").notNull().default("all"),
    createdBy: integer("created_by").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("edutrack_announcements_created_idx").on(table.createdAt)],
);

export const auditLogsTable = pgTable(
  "edutrack_audit_logs",
  {
    id: serial("id").primaryKey(),
    actorId: integer("actor_id").references(() => usersTable.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: integer("entity_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("edutrack_audit_created_idx").on(table.createdAt)],
);

// connect-pg-simple-compatible storage. Session data is server-side, never
// placed in browser storage; cookie contents contain only an opaque session id.
export const sessionsTable = pgTable(
  "edutrack_sessions",
  {
    sid: varchar("sid", { length: 255 }).primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire", { precision: 6, withTimezone: false }).notNull(),
  },
  (table) => [index("edutrack_sessions_expire_idx").on(table.expire)],
);
