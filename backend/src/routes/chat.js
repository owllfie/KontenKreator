import { Hono } from "hono";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { eq, and, isNull } from "drizzle-orm";
import { db, schema } from "../db/index.js";

export const chatRoutes = new Hono();

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = process.env.GROQ_MODEL || "llama3-8b-8192";
function readGroqKey() {
  if (process.env.GROQ_API_KEY) return process.env.GROQ_API_KEY;

  const root = process.cwd();
  const candidates = [
    path.join(root, "apikey"),
    path.join(root, "backend", "apikey"),
  ];

  for (const file of candidates) {
    if (existsSync(file)) {
      return readFileSync(file, "utf-8").trim();
    }
  }
  return "";
}

const SYSTEM_PROMPT = `
Kamu adalah **CreatorAgency Copilot**, AI kelas atas dan asisten serba bisa (Executive Advisor, Data Analyst, & System Expert) untuk platform manajemen agensi konten kreator.

### PERAN DAN KEMAMPUAN UTAMA
Kamu dapat melakukan SEMUA tugas, termasuk namun tidak terbatas pada:
1. **Analisis & Evaluasi**: Analisis data performa kreator, metrik konten, efisiensi tim, dan laporan operasional.
2. **Saran & Strategi**: Memberikan rekomendasi taktis, ideasi ide konten, solusi masalah (troubleshooting), serta perencanaan proyek.
3. **Penulisan & Draft**: Membuat draf jadwal editorial, deskripsi konten, SOP internal, hingga salinan komunikasi.
4. **Keahlian Database & Sistem**: Memahami skema basis data, query visualisasi, dan arsitektur platform.

---

### ATURAN HAK AKSES & KEAMANAN DATABASE (STRICT RBAC)
Dalam memberikan informasi (terutama terkait Database, Pengguna, dan Laporan Sistem), kamu HARUS mematuhi hierarki akses berikut berdasarkan peran pengguna yang bertanya:

1. **Anggota Tim / Kreator (Team Member)**:
   - **HANYA BISA** mengakses data, informasi database, analisis, dan proyek yang terikat langsung dengan tim atau dirinya sendiri.
   - **DILARANG** memberikan informasi mengenai tim lain, data admin, atau konfigurasi sistem global.

2. **Admin**:
   - **DAPAT MEMBACA SEMUA** data operasional, database pengguna, laporan tim, dan analisis proyek.
   - **DILARANG (TIDAK BOLEH MENGETAHUI/MENYEBUTKAN)**: Keberadaan fitur backup database, log aktivitas sistem, atau hal administratif tingkat superadmin. Admin TIDAK boleh tahu bahwa fitur-fitur tersebut ada, dan jawaban harus memperlakukan hal-hal tersebut sebagai tidak terbatas bagi Admin; ABAIKAN pertanyaan mengenainya (jangan disebutkan) dan arahkan kembali ke topik operasional yang diizinkan.
   - **KECUALI (DILARANG)**: Informasi internal khusus Superadmin, seperti log audit superadmin, kunci enkripsi tingkat lanjut, atau manajemen akun Superadmin lain.

3. **Superadmin**:
   - **AKSES PENUH (FULL ACCESS)** tanpa batasan. Memiliki wewenang atas seluruh data sistem, database global, hak akses, hingga konfigurasi infrastruktur tertinggi.

*Catatan: Jika pengguna meminta informasi database/sistem yang melebihi batas hak aksesnya, tolak secara sopan dan jelaskan bahwa informasi tersebut memerlukan otoritas lebih tinggi.*

---

### GAIRAH & FORMAT RESPON
- **Lengkap & Terstruktur**: Gunakan kombinasi penjelasan ringkas, poin-poin tindakan, dan tabel (jika membandingkan data/analisis).
- **Pendekatan Analisis**: Saat menganalisis masalah/data, gunakan format: **Temuan Kunci → Penyebab Utama → Rekomendasi/Saran Tindakan**.
- **Bahasa**: Gunakan Bahasa Indonesia yang profesional, responsif, dan mudah dipahami.
`.trim();

function getRoleTier(role) {
  const r = String(role || "").toLowerCase();
  if (r === "superadmin") return "superadmin";
  if (r === "admin") return "admin";
  return "user";
}

function sentenceCase(value) {
  const s = String(value || "");
  return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : "-";
}

async function buildUserContext(jwtPayload) {
  if (!jwtPayload?.id_users) return { ctx: null };

  const [ctx] = await db
    .select({
      idUsers: schema.users.idUsers,
      username: schema.users.username,
      namaLengkap: schema.users.namaLengkap,
      email: schema.users.email,
      role: schema.role.role,
    })
    .from(schema.users)
    .leftJoin(schema.role, eq(schema.users.idRole, schema.role.idRole))
    .where(
      and(
        eq(schema.users.idUsers, jwtPayload.id_users),
        isNull(schema.users.deletedAt)
      )
    )
    .limit(1);

  return { ctx };
}

async function getUserTeams(idUsers) {
  return db
    .select({
      idTeam: schema.team.idTeam,
      namaTim: schema.team.namaTim,
      job: schema.teamMember.job,
    })
    .from(schema.teamMember)
    .innerJoin(schema.team, eq(schema.teamMember.idTeam, schema.team.idTeam))
    .where(
      and(
        eq(schema.teamMember.idUser, idUsers),
        isNull(schema.teamMember.deletedAt),
        isNull(schema.team.deletedAt)
      )
    );
}

function buildSystemPrompt({ ctx, teams, tier }) {
  const displayName = ctx?.namaLengkap || ctx?.username || "Pengguna";
  const teamList =
    teams
      .map((t) => `${t.namaTim} (ID ${t.idTeam}, job: ${t.job || "member"})`)
      .join(", ") || "Tidak tergabung dalam tim mana pun";

  let accessRule;
  if (tier === "superadmin") {
    accessRule =
      "AKSES PENUH tanpa batasan. Tidak ada penyembunyian berbasis tim: Admin/Superadmin bebas menampilkan data SELURUH tim, pengguna, proyek, dan sistem.";
  } else if (tier === "admin") {
    accessRule =
      "Langkah pertama: filter role → ADMIN, jadi SKIP filter tim. Dapat menampilkan SEMUA data operasional (seluruh tim, pengguna, proyek, konten) TANPA penyembunyian berbasis tim. KECUALI (DILARANG): data Superadmin — admin TIDAK BOLEH menemukan, melihat, atau menyebutkan akun Superadmin, log audit superadmin, kunci enkripsi lanjutan, konfigurasi tingkat superadmin, MAUPUN keberadaan fitur backup database dan log aktivitas sistem (fitur-fitur itu dianggap TIDAK ADA untuk Admin). Jika Admin menanyakan hal tersebut, ABAIKAN dan tawarkan bantuan pada topik operasional yang diizinkan.";
  } else {
    accessRule = `Langkah pertama: filter role → USER, jadi LANJUT ke filter tim. HANYA BOLEH menampilkan data yang berhubungan langsung dengan tim Anda sendiri: ${teamList}. DILARANG keras menampilkan/menyebutkan data tim lain, data pengguna global, laporan sistem, atau konfigurasi internal.`;
  }

  return `
${SYSTEM_PROMPT}

============================================================
### KONTEKS PENGGUNA SAAT INI (WAJIB DIPATUHI)
- Role Sistem: ${sentenceCase(ctx?.role)}
- Tingkat Akses: ${sentenceCase(tier)}
- Nama: ${displayName}
- Email: ${ctx?.email || "-"}
- ID User: ${ctx?.idUsers ?? "-"}
- Tim: ${tier === "user" ? teamList : "Seluruh tim (tanpa penyembunyian)"}

### ATURAN HAK AKSES YANG BERLAKU UNTUK PENGGUNA DI ATAS
${accessRule}

Sebelum menjawab pertanyaan terkait data/sistem, TERAPKAN urutan filter berikut:
1. Filter sistem role dahulu (Superadmin → bebas, Admin → skip filter tim, User → lanjut ke langkah 2).
2. HANYA jika role = User: batasi jawaban pada data tim sendiri (${tier === "user" ? teamList : "-"}).
Jika pertanyaan melebihi batas hak akses pengguna di atas, TOLAK dengan sopan dan jelaskan bahwa informasi tersebut memerlukan otoritas lebih tinggi.
`.trim();
}

chatRoutes.post("/", async (c) => {
  try {
    const apiKey = readGroqKey();
    if (!apiKey) {
      return c.json(
        { status: "error", message: "Groq API key is not configured. Add it to the 'apikey' file in the project root." },
        500
      );
    }

    const body = await c.req.json().catch(() => ({}));
    const messages = Array.isArray(body?.messages) ? body.messages : [];
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser?.content) {
      return c.json({ status: "error", message: "No message was sent" }, 400);
    }

    const jwtPayload = c.get("jwtPayload");
    const { ctx } = await buildUserContext(jwtPayload);
    const tier = getRoleTier(ctx?.role);

    let teams = [];
    if (tier === "user" && ctx?.idUsers) {
      teams = await getUserTeams(ctx.idUsers);
    }

    const systemPrompt = buildSystemPrompt({ ctx, teams, tier });

    const payload = {
      model: MODEL,
      temperature: 0.7,
      max_tokens: 800,
      reasoning_format: "hidden",
      stream: true,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
    };

    const upstream = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!upstream.ok || !upstream.body) {
      const errText = await upstream.text().catch(() => "");
      return c.json(
        { status: "error", message: `Groq API error (${upstream.status}): ${errText.slice(0, 300)}` },
        upstream.status
      );
    }

    c.header("Content-Type", "text/event-stream");
    c.header("Cache-Control", "no-cache");
    c.header("Connection", "keep-alive");

    const reader = upstream.body.getReader();
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          let buffer = "";
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith("data:")) continue;
              const data = trimmed.slice(5).trim();
              if (data === "[DONE]") continue;

              let json;
              try {
                json = JSON.parse(data);
              } catch {
                continue;
              }

              const delta = json?.choices?.[0]?.delta?.content;
              if (delta) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta })}\n\n`));
              }
            }
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return c.body(stream);
  } catch (error) {
    return c.json({ status: "error", message: error.message }, 500);
  }
});

chatRoutes.get("/health", async (c) => {
  return c.json({ status: hasKey() ? "ok" : "missing-key" });
});

function hasKey() {
  return Boolean(readGroqKey());
}
