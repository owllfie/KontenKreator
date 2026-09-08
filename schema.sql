-- 1. Role Table
CREATE TABLE role (
    id_role SERIAL PRIMARY KEY,
    role VARCHAR(20) CHECK (role IN ('superadmin', 'admin', 'user')) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL DEFAULT NULL
);

-- 2. Permissions Table
CREATE TABLE permissions (
    id_permission SERIAL PRIMARY KEY,
    nama_permission VARCHAR(100) NOT NULL UNIQUE,
    fitur VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL DEFAULT NULL
);

-- 3. Role Permissions Table (Pivot)
CREATE TABLE role_permissions (
    id_role INT NOT NULL,
    id_permission INT NOT NULL,
    PRIMARY KEY (id_role, id_permission),
    CONSTRAINT fk_role FOREIGN KEY (id_role) REFERENCES role(id_role) ON DELETE CASCADE,
    CONSTRAINT fk_permission FOREIGN KEY (id_permission) REFERENCES permissions(id_permission) ON DELETE CASCADE
);

-- 4. Users Table
CREATE TABLE users (
    id_users SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255),
    no_telp VARCHAR(20),
    id_role INT NOT NULL,
    status VARCHAR(20) CHECK (status IN ('active', 'inactive', 'suspended')) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL DEFAULT NULL,
    CONSTRAINT fk_user_role FOREIGN KEY (id_role) REFERENCES role(id_role) ON DELETE CASCADE
);

-- 5. Activity Logs Table
CREATE TABLE activity_logs (
    id_log SERIAL PRIMARY KEY,
    id_user INT NOT NULL,
    aksi VARCHAR(20) CHECK (aksi IN ('CREATE', 'UPDATE', 'DELETE', 'RESTORE', 'LOGIN')) NOT NULL,
    nama_tabel VARCHAR(50) NOT NULL,
    id_referensi INT NOT NULL,
    keterangan TEXT,
    old_values TEXT NULL,
    new_values TEXT NULL,
    ip_address VARCHAR(45) NULL,
    user_agent VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_log_user FOREIGN KEY (id_user) REFERENCES users(id_users) ON DELETE CASCADE
);

-- 6. Team Table
CREATE TABLE team (
    id_team SERIAL PRIMARY KEY,
    nama_tim VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL DEFAULT NULL
);

-- 7. Team Member Table
CREATE TABLE team_member (
    id_member SERIAL PRIMARY KEY,
    id_team INT NOT NULL,
    id_user INT NOT NULL,
    job VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL DEFAULT NULL,
    CONSTRAINT fk_member_team FOREIGN KEY (id_team) REFERENCES team(id_team) ON DELETE CASCADE,
    CONSTRAINT fk_member_user FOREIGN KEY (id_user) REFERENCES users(id_users) ON DELETE CASCADE
);

-- 8. Project Table
CREATE TABLE project (
    id_project SERIAL PRIMARY KEY,
    nama_projek VARCHAR(50) NOT NULL,
    id_team INT NOT NULL,
    deadline TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL DEFAULT NULL,
    CONSTRAINT fk_project_team FOREIGN KEY (id_team) REFERENCES team(id_team) ON DELETE CASCADE
);

-- 9. Content Table
CREATE TABLE content (
    id_content SERIAL PRIMARY KEY,
    id_project INT NOT NULL,
    id_uploader INT NOT NULL,
    judul_konten VARCHAR(50) NOT NULL,
    file_draft VARCHAR(255),
    catatan TEXT,
    status_approval VARCHAR(20) CHECK (status_approval IN ('approved', 'pending', 'revision_needed')) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL DEFAULT NULL,
    CONSTRAINT fk_content_project FOREIGN KEY (id_project) REFERENCES project(id_project) ON DELETE CASCADE,
    CONSTRAINT fk_content_uploader FOREIGN KEY (id_uploader) REFERENCES team_member(id_member) ON DELETE CASCADE
);

-- 10. Content Revision Table
CREATE TABLE content_revision (
    id_revision SERIAL PRIMARY KEY,
    id_content INT NOT NULL,
    id_reviewer INT NOT NULL,
    timestamp_frame VARCHAR(50),
    catatan_revisi TEXT NOT NULL,
    status_revisi VARCHAR(20) CHECK (status_revisi IN ('open', 'resolved')) DEFAULT 'open',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL DEFAULT NULL,
    CONSTRAINT fk_rev_content FOREIGN KEY (id_content) REFERENCES content(id_content) ON DELETE CASCADE,
    CONSTRAINT fk_rev_reviewer FOREIGN KEY (id_reviewer) REFERENCES team_member(id_member) ON DELETE CASCADE
);

-- 11. Script Table
CREATE TABLE script (
    id_script SERIAL PRIMARY KEY,
    id_project INT NOT NULL,
    id_writer INT NOT NULL,
    judul_script VARCHAR(50) NOT NULL,
    file_script VARCHAR(255),
    script TEXT,
    status_approval VARCHAR(20) CHECK (status_approval IN ('approved', 'pending', 'revision_needed')) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL DEFAULT NULL,
    CONSTRAINT fk_script_project FOREIGN KEY (id_project) REFERENCES project(id_project) ON DELETE CASCADE,
    CONSTRAINT fk_script_writer FOREIGN KEY (id_writer) REFERENCES team_member(id_member) ON DELETE CASCADE
);

-- 12. Script Revision Table
CREATE TABLE script_revision (
    id_revision SERIAL PRIMARY KEY,
    id_script INT NOT NULL,
    id_reviewer INT NOT NULL,
    halaman VARCHAR(50),
    catatan_revisi TEXT NOT NULL,
    status_revisi VARCHAR(20) CHECK (status_revisi IN ('open', 'resolved')) DEFAULT 'open',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL DEFAULT NULL,
    CONSTRAINT fk_script_rev_script FOREIGN KEY (id_script) REFERENCES script(id_script) ON DELETE CASCADE,
    CONSTRAINT fk_script_rev_reviewer FOREIGN KEY (id_reviewer) REFERENCES team_member(id_member) ON DELETE CASCADE
);

-- 13. Backup History Table
CREATE TABLE backup_history (
    id_backup SERIAL PRIMARY KEY,
    file_name VARCHAR(255) NOT NULL,
    type VARCHAR(20) DEFAULT 'Manual' NOT NULL,
    size_bytes INT DEFAULT 0 NOT NULL,
    records INT DEFAULT 0 NOT NULL,
    created_by VARCHAR(100),
    status VARCHAR(20) DEFAULT 'Berhasil' NOT NULL,
    file_content TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);