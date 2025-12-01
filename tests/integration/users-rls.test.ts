import { beforeAll, afterAll, describe, expect, it } from "vitest"
import { Client } from "pg"
import { realPrisma, disconnectRealDb } from "./setup-real-db"

const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ||
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres"

const publicUser = {
  id: "11111111-1111-1111-1111-111111111111",
  email: "rls-public@example.com",
  name: "Public User",
  avatarUrl: "https://example.com/avatar/public.png",
  bio: "Public bio",
  phone: "+10000000001",
  privacySettings: { profile: "public" },
  socialLinks: { github: "public-user" },
}

const adminUser = {
  id: "22222222-2222-2222-2222-222222222222",
  email: "rls-admin@example.com",
  name: "Admin User",
  avatarUrl: "https://example.com/avatar/admin.png",
  bio: "Admin bio",
  phone: "+10000000002",
  privacySettings: { profile: "admin" },
  socialLinks: { github: "admin-user" },
}

async function queryAs(
  role: "anon" | "authenticated",
  uid: string | null,
  sql: string,
  params: unknown[] = []
) {
  const client = new Client({ connectionString: TEST_DB_URL })
  await client.connect()
  try {
    await client.query(`SET ROLE ${role};`)
    if (uid) {
      await client.query(`SELECT set_config('request.jwt.claim.sub', $1, false);`, [uid])
    } else {
      await client.query(`SELECT set_config('request.jwt.claim.sub', '', false);`)
    }
    await client.query(`SELECT set_config('request.jwt.claim.role', $1, false);`, [role])
    const res = await client.query(sql, params)
    return res
  } finally {
    await client.query("RESET ROLE;")
    await client.end()
  }
}

describe("users RLS whitelist (public columns only)", () => {
  beforeAll(async () => {
    await realPrisma.user.deleteMany({
      where: {
        id: {
          in: [
            publicUser.id,
            adminUser.id,
            "rls-public-user-001",
            "rls-admin-user-001",
          ],
        },
      },
    })

    await realPrisma.user.create({
      data: {
        id: publicUser.id,
        email: publicUser.email,
        name: publicUser.name,
        avatarUrl: publicUser.avatarUrl,
        bio: publicUser.bio,
        phone: publicUser.phone,
        privacySettings: publicUser.privacySettings as any,
        socialLinks: publicUser.socialLinks as any,
        role: "USER",
        status: "ACTIVE",
        updatedAt: new Date(),
        lastLoginAt: new Date(),
      },
    })

    await realPrisma.user.create({
      data: {
        id: adminUser.id,
        email: adminUser.email,
        name: adminUser.name,
        avatarUrl: adminUser.avatarUrl,
        bio: adminUser.bio,
        phone: adminUser.phone,
        privacySettings: adminUser.privacySettings as any,
        socialLinks: adminUser.socialLinks as any,
        role: "ADMIN",
        status: "ACTIVE",
        updatedAt: new Date(),
        lastLoginAt: new Date(),
      },
    })
  })

  afterAll(async () => {
    await realPrisma.user.deleteMany({
      where: { id: { in: [publicUser.id, adminUser.id] } },
    })
    await disconnectRealDb()
  })

  it("anon only sees whitelisted columns and cannot read sensitive fields", async () => {
    const allowed = await queryAs(
      "anon",
      null,
      `SELECT id, name, "avatarUrl", bio, "createdAt" FROM public.users WHERE id IN ($1, $2) ORDER BY id`,
      [publicUser.id, adminUser.id]
    )

    expect(allowed.rows).toHaveLength(2)
    expect(allowed.rows[0]).not.toHaveProperty("email")

    await expect(
      queryAs(
        "anon",
        null,
        `SELECT email FROM public.users WHERE id = $1`,
        [publicUser.id]
      )
    ).rejects.toThrow(/permission denied|privilege/i)
  })

  it("authenticated user gets full record only for self", async () => {
    const res = await queryAs(
      "authenticated",
      publicUser.id,
      `SELECT id, email, phone, "privacySettings" FROM public.users WHERE id IN ($1, $2) ORDER BY id`,
      [publicUser.id, adminUser.id]
    )

    expect(res.rows).toHaveLength(1)
    const row = res.rows[0]
    expect(row.id).toBe(publicUser.id)
    expect(row.email).toBe(publicUser.email)
    expect(row.phone).toBe(publicUser.phone)
  })

  it("admin can read all users with sensitive columns", async () => {
    const res = await queryAs(
      "authenticated",
      adminUser.id,
      `SELECT id, email, phone, "privacySettings" FROM public.users WHERE id IN ($1, $2) ORDER BY id`,
      [publicUser.id, adminUser.id]
    )

    expect(res.rows).toHaveLength(2)
    const ids = res.rows.map((r) => r.id)
    expect(ids).toContain(publicUser.id)
    expect(ids).toContain(adminUser.id)
    expect(res.rows.find((r) => r.id === adminUser.id)?.email).toBe(adminUser.email)
  })
})
