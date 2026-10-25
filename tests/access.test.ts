import { describe, it, expect } from "vitest";
import { leadScope, canAccessLead, taskScope, canAccessTask } from "@/lib/access";

const admin = { id: "u-admin", name: "Admin", email: "admin@test", role: "ADMIN" };
const priya = { id: "u-priya", name: "Priya", email: "priya@test", role: "MEMBER" };
const rohan = { id: "u-rohan", name: "Rohan", email: "rohan@test", role: "MEMBER" };

describe("lead access", () => {
  it("lets admins see every lead", () => {
    expect(leadScope(admin)).toEqual({});
    expect(canAccessLead(admin, { ownerId: priya.id })).toBe(true);
  });

  it("limits members to the leads they own", () => {
    expect(leadScope(priya)).toEqual({ ownerId: priya.id });
    expect(canAccessLead(priya, { ownerId: priya.id })).toBe(true);
    expect(canAccessLead(rohan, { ownerId: priya.id })).toBe(false);
  });
});

describe("task access", () => {
  const task = { assigneeId: priya.id, createdById: admin.id, lead: { ownerId: priya.id } };

  it("lets admins see every task", () => {
    expect(taskScope(admin)).toEqual({});
    expect(canAccessTask(admin, task)).toBe(true);
  });

  it("lets a member see tasks assigned to them, created by them, or on their leads", () => {
    expect(canAccessTask(priya, task)).toBe(true); // assigned to her
    expect(canAccessTask(rohan, { ...task, createdById: rohan.id })).toBe(true); // created by him
    expect(
      canAccessTask(rohan, { assigneeId: priya.id, createdById: admin.id, lead: { ownerId: rohan.id } })
    ).toBe(true); // on his lead
  });

  it("hides tasks that are unrelated to a member", () => {
    expect(canAccessTask(rohan, task)).toBe(false);
    expect(canAccessTask(rohan, { ...task, lead: null })).toBe(false);
  });

  it("builds a member scope with all three conditions", () => {
    expect(taskScope(priya)).toEqual({
      OR: [{ assigneeId: priya.id }, { createdById: priya.id }, { lead: { ownerId: priya.id } }],
    });
  });
});