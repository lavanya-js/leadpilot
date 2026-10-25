import { describe, it, expect } from "vitest";
import { normalizeCompanyName, normalizeEmail } from "@/lib/normalize";

describe("normalizeCompanyName", () => {
  it("treats different spellings of the same company as equal", () => {
    const key = normalizeCompanyName("Acme");
    expect(normalizeCompanyName("ACME")).toBe(key);
    expect(normalizeCompanyName("Acme Pvt. Ltd.")).toBe(key);
    expect(normalizeCompanyName("  acme   LLP ")).toBe(key);
  });

  it("removes legal suffixes and punctuation", () => {
    expect(normalizeCompanyName("Orbit Fintech Pvt Ltd")).toBe("orbit fintech");
    expect(normalizeCompanyName("Tata & Sons Ltd.")).toBe("tata sons");
  });

  it("keeps genuinely different companies apart", () => {
    expect(normalizeCompanyName("GreenLeaf Organics")).not.toBe(
      normalizeCompanyName("GreenLeaf Foods")
    );
  });

  it("returns an empty key when the name has no real content", () => {
    expect(normalizeCompanyName("   ")).toBe("");
    expect(normalizeCompanyName("Pvt Ltd")).toBe("");
  });
});

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  Test.Lead@Example.com ")).toBe("test.lead@example.com");
  });
});