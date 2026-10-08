CREATE TABLE "edutrack_announcements" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"audience" text DEFAULT 'all' NOT NULL,
	"created_by" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edutrack_assessments" (
	"id" serial PRIMARY KEY NOT NULL,
	"class_id" integer NOT NULL,
	"title" text NOT NULL,
	"scheduled_date" date NOT NULL,
	"max_grade" numeric(7, 2) NOT NULL,
	"weight" numeric(7, 2) DEFAULT '1' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edutrack_attendance" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" integer NOT NULL,
	"class_id" integer NOT NULL,
	"attendance_date" date NOT NULL,
	"present" boolean NOT NULL,
	"recorded_by" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edutrack_audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor_id" integer,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edutrack_classes" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"term" text NOT NULL,
	"subject_id" integer NOT NULL,
	"teacher_id" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edutrack_enrollments" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" integer NOT NULL,
	"class_id" integer NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"enrolled_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edutrack_grades" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" integer NOT NULL,
	"assessment_id" integer NOT NULL,
	"value" numeric(7, 2) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edutrack_sessions" (
	"sid" varchar(255) PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp (6) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edutrack_students" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"registration" text NOT NULL,
	"phone" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edutrack_subjects" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"workload" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edutrack_teachers" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"area" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edutrack_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "edutrack_announcements" ADD CONSTRAINT "edutrack_announcements_created_by_edutrack_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."edutrack_users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edutrack_assessments" ADD CONSTRAINT "edutrack_assessments_class_id_edutrack_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."edutrack_classes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edutrack_attendance" ADD CONSTRAINT "edutrack_attendance_student_id_edutrack_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."edutrack_students"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edutrack_attendance" ADD CONSTRAINT "edutrack_attendance_class_id_edutrack_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."edutrack_classes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edutrack_attendance" ADD CONSTRAINT "edutrack_attendance_recorded_by_edutrack_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."edutrack_users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edutrack_audit_logs" ADD CONSTRAINT "edutrack_audit_logs_actor_id_edutrack_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."edutrack_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edutrack_classes" ADD CONSTRAINT "edutrack_classes_subject_id_edutrack_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."edutrack_subjects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edutrack_classes" ADD CONSTRAINT "edutrack_classes_teacher_id_edutrack_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."edutrack_teachers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edutrack_enrollments" ADD CONSTRAINT "edutrack_enrollments_student_id_edutrack_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."edutrack_students"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edutrack_enrollments" ADD CONSTRAINT "edutrack_enrollments_class_id_edutrack_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."edutrack_classes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edutrack_grades" ADD CONSTRAINT "edutrack_grades_student_id_edutrack_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."edutrack_students"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edutrack_grades" ADD CONSTRAINT "edutrack_grades_assessment_id_edutrack_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."edutrack_assessments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edutrack_students" ADD CONSTRAINT "edutrack_students_user_id_edutrack_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."edutrack_users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edutrack_teachers" ADD CONSTRAINT "edutrack_teachers_user_id_edutrack_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."edutrack_users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "edutrack_announcements_created_idx" ON "edutrack_announcements" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "edutrack_assessments_class_idx" ON "edutrack_assessments" USING btree ("class_id");--> statement-breakpoint
CREATE UNIQUE INDEX "edutrack_attendance_unique_session_uq" ON "edutrack_attendance" USING btree ("student_id","class_id","attendance_date");--> statement-breakpoint
CREATE INDEX "edutrack_attendance_class_idx" ON "edutrack_attendance" USING btree ("class_id");--> statement-breakpoint
CREATE INDEX "edutrack_audit_created_idx" ON "edutrack_audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "edutrack_classes_teacher_idx" ON "edutrack_classes" USING btree ("teacher_id");--> statement-breakpoint
CREATE INDEX "edutrack_classes_subject_idx" ON "edutrack_classes" USING btree ("subject_id");--> statement-breakpoint
CREATE UNIQUE INDEX "edutrack_enrollment_student_class_uq" ON "edutrack_enrollments" USING btree ("student_id","class_id");--> statement-breakpoint
CREATE INDEX "edutrack_enrollment_class_idx" ON "edutrack_enrollments" USING btree ("class_id");--> statement-breakpoint
CREATE UNIQUE INDEX "edutrack_grade_student_assessment_uq" ON "edutrack_grades" USING btree ("student_id","assessment_id");--> statement-breakpoint
CREATE INDEX "edutrack_grades_student_idx" ON "edutrack_grades" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "edutrack_sessions_expire_idx" ON "edutrack_sessions" USING btree ("expire");--> statement-breakpoint
CREATE UNIQUE INDEX "edutrack_students_user_uq" ON "edutrack_students" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "edutrack_students_registration_uq" ON "edutrack_students" USING btree ("registration");--> statement-breakpoint
CREATE UNIQUE INDEX "edutrack_subjects_code_uq" ON "edutrack_subjects" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "edutrack_teachers_user_uq" ON "edutrack_teachers" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "edutrack_users_email_uq" ON "edutrack_users" USING btree ("email");