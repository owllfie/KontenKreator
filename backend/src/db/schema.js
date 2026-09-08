import {
  pgTable,
  serial,
  varchar,
  integer,
  timestamp,
  text,
  primaryKey,
} from "drizzle-orm/pg-core";

export const role = pgTable("role", {
  idRole: serial("id_role").primaryKey(),
  role: varchar("role", { length: 20 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const permissions = pgTable("permissions", {
  idPermission: serial("id_permission").primaryKey(),
  namaPermission: varchar("nama_permission", { length: 100 }).notNull().unique(),
  fitur: varchar("fitur", { length: 50 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const rolePermissions = pgTable(
  "role_permissions",
  {
    idRole: integer("id_role")
      .notNull()
      .references(() => role.idRole, { onDelete: "cascade" }),
    idPermission: integer("id_permission")
      .notNull()
      .references(() => permissions.idPermission, { onDelete: "cascade" }),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.idRole, table.idPermission] }),
    };
  }
);

export const users = pgTable("users", {
  idUsers: serial("id_users").primaryKey(),
  username: varchar("username", { length: 50 }).notNull(),
  email: varchar("email", { length: 100 }).notNull().unique(),
  password: varchar("password", { length: 60 }),
  noTelp: varchar("no_telp", { length: 20 }),
  idRole: integer("id_role")
    .notNull()
    .references(() => role.idRole, { onDelete: "cascade" }),
  status: varchar("status", { length: 20 }).default("active").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const activityLogs = pgTable("activity_logs", {
  idLog: serial("id_log").primaryKey(),
  idUser: integer("id_user")
    .notNull()
    .references(() => users.idUsers, { onDelete: "cascade" }),
  aksi: varchar("aksi", { length: 20 }).notNull(),
  namaTabel: varchar("nama_tabel", { length: 50 }).notNull(),
  idReferensi: integer("id_referensi").notNull(),
  keterangan: text("keterangan"),
  oldValues: text("old_values"),
  newValues: text("new_values"),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: varchar("user_agent", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const team = pgTable("team", {
  idTeam: serial("id_team").primaryKey(),
  namaTim: varchar("nama_tim", { length: 50 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const teamMember = pgTable("team_member", {
  idMember: serial("id_member").primaryKey(),
  idTeam: integer("id_team")
    .notNull()
    .references(() => team.idTeam, { onDelete: "cascade" }),
  idUser: integer("id_user")
    .notNull()
    .references(() => users.idUsers, { onDelete: "cascade" }),
  job: varchar("job", { length: 50 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const project = pgTable("project", {
  idProject: serial("id_project").primaryKey(),
  namaProjek: varchar("nama_projek", { length: 50 }).notNull(),
  idTeam: integer("id_team")
    .notNull()
    .references(() => team.idTeam, { onDelete: "cascade" }),
  deadline: timestamp("deadline", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const content = pgTable("content", {
  idContent: serial("id_content").primaryKey(),
  idProject: integer("id_project")
    .notNull()
    .references(() => project.idProject, { onDelete: "cascade" }),
  idUploader: integer("id_uploader")
    .notNull()
    .references(() => teamMember.idMember, { onDelete: "cascade" }),
  judulKonten: varchar("judul_konten", { length: 50 }).notNull(),
  fileDraft: varchar("file_draft", { length: 255 }),
  catatan: text("catatan"),
  statusApproval: varchar("status_approval", { length: 20 })
    .default("pending")
    .notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const contentRevision = pgTable("content_revision", {
  idRevision: serial("id_revision").primaryKey(),
  idContent: integer("id_content")
    .notNull()
    .references(() => content.idContent, { onDelete: "cascade" }),
  idReviewer: integer("id_reviewer")
    .notNull()
    .references(() => teamMember.idMember, { onDelete: "cascade" }),
  timestampFrame: varchar("timestamp_frame", { length: 50 }),
  catatanRevisi: text("catatan_revisi").notNull(),
  statusRevisi: varchar("status_revisi", { length: 20 })
    .default("open")
    .notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const script = pgTable("script", {
  idScript: serial("id_script").primaryKey(),
  idProject: integer("id_project")
    .notNull()
    .references(() => project.idProject, { onDelete: "cascade" }),
  idWriter: integer("id_writer")
    .notNull()
    .references(() => teamMember.idMember, { onDelete: "cascade" }),
  judulScript: varchar("judul_script", { length: 50 }).notNull(),
  fileScript: varchar("file_script", { length: 255 }),
  script: text("script"),
  statusApproval: varchar("status_approval", { length: 20 })
    .default("pending")
    .notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const scriptRevision = pgTable("script_revision", {
  idRevision: serial("id_revision").primaryKey(),
  idScript: integer("id_script")
    .notNull()
    .references(() => script.idScript, { onDelete: "cascade" }),
  idReviewer: integer("id_reviewer")
    .notNull()
    .references(() => teamMember.idMember, { onDelete: "cascade" }),
  halaman: varchar("halaman", { length: 50 }),
  catatanRevisi: text("catatan_revisi").notNull(),
  statusRevisi: varchar("status_revisi", { length: 20 })
    .default("open")
    .notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const backupHistory = pgTable("backup_history", {
  idBackup: serial("id_backup").primaryKey(),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  type: varchar("type", { length: 20 }).default("Manual").notNull(),
  sizeBytes: integer("size_bytes").default(0).notNull(),
  records: integer("records").default(0).notNull(),
  createdBy: varchar("created_by", { length: 100 }),
  status: varchar("status", { length: 20 }).default("Berhasil").notNull(),
  fileContent: text("file_content"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
