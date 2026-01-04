import "dotenv/config";
import { prisma } from "./db.js";
import { hashPassword } from "./security.js";

async function main() {
  const unit = await prisma.unit.create({
    data: { name: "ネットワーク基礎", sortOrder: 1 },
  });

  const category1 = await prisma.category.create({
    data: { unitId: unit.id, name: "TCP/IP", sortOrder: 1 },
  });
  const category2 = await prisma.category.create({
    data: { unitId: unit.id, name: "DNS", sortOrder: 2 },
  });

  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@example.com";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "Password123!";

  const admin = await prisma.user.create({
    data: {
      email: adminEmail,
      passwordHash: await hashPassword(adminPassword),
      role: "ADMIN",
      emailVerifiedAt: new Date(),
    },
  });

  await prisma.question.create({
    data: {
      categoryId: category1.id,
      body: "TCPでコネクション確立に使われるハンドシェイクは？",
      explanation: "TCPは3ウェイハンドシェイクで接続を確立します。",
      createdBy: admin.id,
      choices: {
        create: [
          { label: "A", body: "3ウェイハンドシェイク", isCorrect: true },
          { label: "B", body: "2ウェイハンドシェイク", isCorrect: false },
          { label: "C", body: "4ウェイハンドシェイク", isCorrect: false },
          { label: "D", body: "ハンドシェイクはない", isCorrect: false },
        ],
      },
    },
  });

  await prisma.question.create({
    data: {
      categoryId: category2.id,
      body: "DNSの役割はどれですか？",
      explanation: "DNSはドメイン名をIPアドレスに変換します。",
      createdBy: admin.id,
      choices: {
        create: [
          { label: "A", body: "メールの暗号化", isCorrect: false },
          { label: "B", body: "ドメイン名とIPの対応", isCorrect: true },
          { label: "C", body: "ファイル転送", isCorrect: false },
          { label: "D", body: "時刻同期", isCorrect: false },
        ],
      },
    },
  });

  console.info("Seed completed");
  console.info(`Admin: ${adminEmail} / ${adminPassword}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
