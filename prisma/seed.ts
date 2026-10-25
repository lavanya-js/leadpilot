import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { normalizeCompanyName } from "../src/lib/normalize";

const prisma = new PrismaClient();
const DAY = 86_400_000;
const daysFromNow = (d: number) => new Date(Date.now() + d * DAY);

async function main() {
  await prisma.idempotencyKey.deleteMany();
  await prisma.activity.deleteMany();
  await prisma.task.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.company.deleteMany();
  await prisma.stage.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash("Password123!", 10);
  const admin = await prisma.user.create({
    data: { name: "Aarav Kapoor", email: "admin@leadpilot.test", passwordHash, role: "ADMIN" },
  });
  const priya = await prisma.user.create({
    data: { name: "Priya Sharma", email: "priya@leadpilot.test", passwordHash, role: "MEMBER" },
  });
  const rohan = await prisma.user.create({
    data: { name: "Rohan Mehta", email: "rohan@leadpilot.test", passwordHash, role: "MEMBER" },
  });
  const users = [admin, priya, rohan];

  const stageDefs = [
    { name: "New", kind: "OPEN" },
    { name: "Contacted", kind: "OPEN" },
    { name: "Qualified", kind: "OPEN" },
    { name: "Proposal", kind: "OPEN" },
    { name: "Won", kind: "WON" },
    { name: "Lost", kind: "LOST" },
  ];
  const stages = [];
  for (const [position, s] of stageDefs.entries()) {
    stages.push(await prisma.stage.create({ data: { ...s, position } }));
  }

  const companyDefs = [
    { name: "Infosys Solutions Pvt Ltd", domain: "infosyssol.com", industry: "IT Services" },
    { name: "GreenLeaf Organics", domain: "greenleaf.in", industry: "Retail" },
    { name: "Nimbus Cloud Technologies", domain: "nimbuscloud.io", industry: "SaaS" },
    { name: "Sundaram Textiles Ltd", domain: "sundaramtex.com", industry: "Manufacturing" },
    { name: "BrightPath Education", domain: "brightpath.edu.in", industry: "Education" },
    { name: "Kaveri Logistics", domain: "kaverilogistics.in", industry: "Logistics" },
  ];
  const companies = [];
  for (const c of companyDefs) {
    companies.push(
      await prisma.company.create({ data: { ...c, nameKey: normalizeCompanyName(c.name) } })
    );
  }

  const firstNames = ["Ananya", "Vikram", "Meera", "Karan", "Sneha", "Arjun", "Divya", "Rahul", "Neha", "Siddharth"];
  const lastNames = ["Iyer", "Nair", "Reddy", "Gupta", "Joshi", "Patel", "Verma", "Singh", "Das", "Bose"];
  const sources = ["Website", "Referral", "LinkedIn", "Cold Call", "Event"];
  const stageWeights = [0, 0, 0, 1, 1, 2, 2, 3, 4, 5]; // more New/Contacted than Won/Lost
  const activityTypes = ["CALL", "EMAIL", "MEETING", "NOTE"];

  for (let i = 0; i < 36; i++) {
    const first = firstNames[i % 10];
    const last = lastNames[(i * 3) % 10];
    const company = companies[i % companies.length];
    const owner = users[i % 3];
    const stage = stages[stageWeights[i % 10]];

    const contact = await prisma.contact.create({
      data: {
        name: `${first} ${last}`,
        email: `${first}.${last}${i}@${company.domain}`.toLowerCase(),
        phone: `+91 98${String(10000000 + i * 137).slice(0, 8)}`,
        title: i % 2 ? "Procurement Manager" : "Operations Head",
        companyId: company.id,
      },
    });

    const lead = await prisma.lead.create({
      data: {
        name: `${first} ${last}`,
        email: contact.email,
        phone: contact.phone,
        source: sources[i % sources.length],
        value: 25000 + ((i * 7919) % 175000),
        notes: i % 4 === 0 ? "Interested in annual plan." : null,
        ownerId: owner.id,
        stageId: stage.id,
        companyId: company.id,
        contactId: contact.id,
        createdAt: daysFromNow(-(i % 28) - 1),
      },
    });

    const n = 1 + (i % 3);
    for (let a = 0; a < n; a++) {
      const type = activityTypes[(i + a) % 4];
      await prisma.activity.create({
        data: {
          type,
          body: `${type === "NOTE" ? "Note" : type[0] + type.slice(1).toLowerCase()} with ${first}: discussed requirements.`,
          leadId: lead.id,
          userId: owner.id,
          createdAt: daysFromNow(-(a + 1) * 2 - (i % 5)),
        },
      });
    }

    if (i % 3 === 0 && stage.kind === "OPEN") {
      const offset = (i % 7) - 3; // some overdue, some today, some upcoming
      await prisma.task.create({
        data: {
          title: i % 2 ? `Send proposal to ${first}` : `Follow-up call with ${first}`,
          dueDate: daysFromNow(offset),
          completedAt: i % 9 === 0 ? daysFromNow(-1) : null,
          leadId: lead.id,
          assigneeId: owner.id,
          createdById: admin.id,
        },
      });
    }
  }
  console.log("Seeded: 3 users, 6 stages, 6 companies, 36 leads");
}

main().finally(() => prisma.$disconnect());