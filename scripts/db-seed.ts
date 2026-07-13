/**
 * Seeds SQLite from the app's existing seed data.
 * Run: npm run db:seed
 */
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";

import {
  seedActivity,
  seedAttachments,
  seedAttendance,
  seedApprovalFlows,
  seedBOQs,
  seedChecklistItems,
  seedCompanies,
  seedContractors,
  seedCredentials,
  seedCustomerAppConfigs,
  seedDocuments,
  seedEmployees,
  seedIntegrations,
  seedLabor,
  seedMaterials,
  seedNotes,
  seedOtherCharges,
  seedPostSalesProjects,
  seedProjects,
  seedPurchaseOrders,
  seedSuppliers,
  seedTickets,
  seedTrainingSessions,
  seedTriggers,
  seedUploads,
  seedUsers,
  seedWorkOrders,
} from "../src/data/seed";
import { SEED_INVENTORY, SEED_PLATFORM, SEED_WORKFLOW_STEPS } from "../src/data/master-seed";
import { getDb, getSqlite } from "../src/server/db/client";
import * as t from "../src/server/db/schema";

async function main() {
  const dbPath =
    process.env.DATABASE_URL?.replace(/^file:/, "") ||
    (process.env.DATA_DIR ? `${process.env.DATA_DIR}/buildesk.db` : "./data/buildesk.db");
  console.log(`Seeding database: ${dbPath}`);

  getSqlite();
  const db = getDb();

  let existing;
  try {
    existing = db.select().from(t.users).all();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("no such table")) {
      console.error(
        "Tables are missing. Create the schema first, then seed:\n\n  npm run db:push\n  npm run db:seed\n\nOr in one step:  npm run db:setup\n",
      );
      process.exit(1);
    }
    throw e;
  }

  if (existing.length > 0) {
    console.log(`Database already has ${existing.length} users — skipping seed (delete the db file to reseed).`);
    return;
  }

  console.log("Seeding database…");

  const now = new Date().toISOString();

  for (const emp of seedEmployees) {
    db.insert(t.employees).values(emp).run();
  }

  for (const user of seedUsers) {
    const plain = seedCredentials[user.id] ?? "buildesk123";
    const passwordHash = await bcrypt.hash(plain, 10);
    db.insert(t.users)
      .values({
        id: user.id,
        name: user.name,
        email: user.email,
        passwordHash,
        role: user.role,
        active: user.active,
        avatarUrl: user.avatarUrl,
        phone: user.phone,
        jobTitle: user.jobTitle,
        department: user.department,
        timezone: user.timezone,
        bio: user.bio,
        notifyEmail: user.notifyEmail ?? true,
        notifyInApp: user.notifyInApp ?? true,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      })
      .run();
  }

  for (const c of seedCompanies) {
    db.insert(t.companies)
      .values({
        id: c.id,
        name: c.name,
        contact: c.contact,
        designation: c.designation,
        phone: c.phone,
        email: c.email,
        city: c.city,
        officeAddress: c.officeAddress,
        gstNumber: c.gstNumber,
        billingInfo: c.billingInfo,
        onboardingManagerId: c.onboardingManagerId,
        csmId: c.csmId,
        status: c.status,
        agreementDate: c.agreementDate,
        startDate: c.startDate || c.agreementDate,
        goLiveTarget: c.goLiveTarget,
        planExpiry: c.planExpiry,
        plan: c.plan,
        health: c.health,
        renewedAt: c.renewedAt,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })
      .run();

    for (const m of c.modules) {
      db.insert(t.companyModules)
        .values({
          id: randomUUID(),
          companyId: c.id,
          moduleKey: m.moduleKey,
          label: m.label,
          optedIn: m.optedIn,
          optedOnDate: m.optedOnDate,
        })
        .run();
    }
  }

  for (const p of seedProjects) {
    db.insert(t.projects)
      .values({
        id: p.id,
        name: p.name,
        companyId: p.companyId,
        type: p.type,
        units: p.units,
        city: p.city,
        rera: p.rera ?? "",
        status: p.status,
        currentStep: p.currentStep,
        startDate: p.startDate,
        goLiveAt: p.goLiveAt,
        address: p.address,
        state: p.state,
        pinCode: p.pinCode,
        totalTowers: p.totalTowers,
        totalFloors: p.totalFloors,
        agreementValue: p.agreementValue,
        otherChargesJson: JSON.stringify(p.otherCharges ?? []),
        customChargesJson: JSON.stringify(p.customCharges ?? []),
        logoUrl: p.logoUrl,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })
      .run();
  }

  for (const item of seedChecklistItems) {
    db.insert(t.onboardingChecklistItems).values(item).run();
  }

  for (const oc of seedOtherCharges) {
    db.insert(t.otherCharges).values(oc).run();
  }

  for (const u of seedUploads) {
    db.insert(t.unitUploads).values(u).run();
  }

  for (const cfg of seedCustomerAppConfigs) {
    db.insert(t.customerAppConfigs).values(cfg).run();
  }

  for (const psp of seedPostSalesProjects) {
    db.insert(t.postSalesProjects)
      .values({
        id: psp.id,
        companyId: psp.companyId,
        projectNumber: psp.projectNumber,
        projectName: psp.projectName,
        createdAt: psp.createdAt,
        updatedAt: psp.updatedAt,
      })
      .run();
    for (const step of psp.steps) {
      db.insert(t.postSalesSteps)
        .values({
          id: step.id,
          postSalesProjectId: psp.id,
          key: step.key,
          label: step.label,
          requiresTemplate: step.requiresTemplate,
          templateStatus: step.templateStatus,
          templateSentOn: step.templateSentOn,
          uploadStatus: step.uploadStatus,
          uploadedFileJson: step.uploadedFile ? JSON.stringify(step.uploadedFile) : null,
          approvalStatus: step.approvalStatus,
          approvedBy: step.approvedBy,
          approvedOn: step.approvedOn,
          remarks: step.remarks,
          order: step.order,
        })
        .run();
    }
  }

  for (const a of seedActivity) {
    db.insert(t.activityEntries).values(a).run();
  }

  for (const n of seedNotes) {
    db.insert(t.companyNotes)
      .values({
        id: n.id,
        companyId: n.companyId,
        projectId: n.projectId,
        body: n.body,
        author: n.author,
        pinned: n.pinned ?? false,
        createdAt: n.createdAt,
        updatedAt: n.updatedAt,
      })
      .run();
  }

  for (const att of seedAttachments) {
    db.insert(t.companyAttachments).values(att).run();
  }

  for (const ticket of seedTickets) {
    db.insert(t.tickets).values(ticket).run();
  }

  for (const s of seedTrainingSessions) {
    if (!s.companyId) continue;
    db.insert(t.trainingSessions)
      .values({
        id: s.id,
        type: s.type,
        trainerId: s.trainerId,
        companyId: s.companyId,
        date: s.date,
        attendance: s.attendance,
        recording: s.recording,
        status: s.status,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      })
      .run();
  }

  for (const l of seedLabor) {
    db.insert(t.labor).values(l).run();
  }

  for (const a of seedAttendance) {
    db.insert(t.attendanceRecords).values(a).run();
  }

  for (const m of seedMaterials) {
    db.insert(t.materials).values(m).run();
  }

  for (const s of seedSuppliers) {
    db.insert(t.suppliers).values(s).run();
  }

  for (const c of seedContractors) {
    db.insert(t.contractors).values(c).run();
  }

  for (const po of seedPurchaseOrders) {
    if (!po.projectId) continue;
    db.insert(t.purchaseOrders)
      .values({
        id: po.id,
        number: po.number,
        supplierId: po.supplierId,
        projectId: po.projectId,
        date: po.date,
        status: po.status,
        amount: po.amount,
        createdAt: po.createdAt,
        updatedAt: po.updatedAt,
      })
      .run();
  }

  for (const wo of seedWorkOrders) {
    if (!wo.projectId) continue;
    db.insert(t.workOrders)
      .values({
        id: wo.id,
        number: wo.number,
        contractorId: wo.contractorId,
        projectId: wo.projectId,
        date: wo.date,
        status: wo.status,
        amount: wo.amount,
        createdAt: wo.createdAt,
        updatedAt: wo.updatedAt,
      })
      .run();
  }

  for (const b of seedBOQs) {
    db.insert(t.boqs).values(b).run();
  }

  for (const f of seedApprovalFlows) {
    db.insert(t.approvalFlows)
      .values({
        id: f.id,
        name: f.name,
        stagesJson: JSON.stringify(f.stages),
        createdAt: f.createdAt,
        updatedAt: f.updatedAt,
      })
      .run();
  }

  for (const d of seedDocuments) {
    db.insert(t.documentTemplates).values(d).run();
  }

  for (const i of seedIntegrations) {
    db.insert(t.integrations).values(i).run();
  }

  for (const tr of seedTriggers) {
    db.insert(t.triggers).values(tr).run();
  }

  db.insert(t.appConfig)
    .values({
      key: "master",
      valueJson: JSON.stringify({
        platform: SEED_PLATFORM,
        workflowSteps: SEED_WORKFLOW_STEPS,
        inventoryItems: SEED_INVENTORY,
      }),
      updatedAt: now,
    })
    .run();

  db.insert(t.appConfig)
    .values({
      key: "settings",
      valueJson: JSON.stringify({ seeded: true }),
      updatedAt: now,
    })
    .run();

  const companyCount = db.select().from(t.companies).all().length;
  const projectCount = db.select().from(t.projects).all().length;
  console.log(`Seeded ${companyCount} companies, ${projectCount} projects, ${seedUsers.length} users.`);
  console.log("Demo login: aditya@buildesk.com / buildesk123");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
