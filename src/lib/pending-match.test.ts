import { describe, expect, it } from "vitest";
import { matchPendingUser, matchesPendingName } from "./pending-match";
import type { User } from "@prisma/client";

const pending = (name: string): User =>
  ({
    id: `u-${name}`,
    name,
    role: "PENDING",
  }) as User;

describe("matchesPendingName", () => {
  it("matches an exact name case-insensitively", () => {
    expect(matchesPendingName("Cate", "CATE")).toBe(true);
    expect(matchesPendingName("WAN", "wan")).toBe(true);
  });

  it("matches when the placeholder is a prefix of the login first name", () => {
    expect(matchesPendingName("Dip", "Dipesh")).toBe(true);
    expect(matchesPendingName("Kev", "Kevin")).toBe(true);
    expect(matchesPendingName("Jas", "Jasper")).toBe(true);
  });

  it("matches when the login first name is a prefix of the placeholder", () => {
    expect(matchesPendingName("Dipesh", "Dip")).toBe(true);
  });

  it("rejects different names that merely share a letter run", () => {
    expect(matchesPendingName("Charlie", "Charles")).toBe(false);
    expect(matchesPendingName("Cate", "Cathy")).toBe(false);
  });

  it("rejects empty or blank names", () => {
    expect(matchesPendingName("Charlie", "")).toBe(false);
    expect(matchesPendingName("", "Charlie")).toBe(false);
    expect(matchesPendingName("  ", "Charlie")).toBe(false);
  });
});

describe("matchPendingUser", () => {
  const users = [pending("Charlie"), pending("Kev"), pending("Jasper"), pending("Cate")];

  it("prefers an exact match over a prefix match", () => {
    const withDip = [...users, pending("Dip"), pending("Cathy")];
    expect(matchPendingUser(withDip, "Cate")?.name).toBe("Cate");
    expect(matchPendingUser(withDip, "Cathy")?.name).toBe("Cathy");
  });

  it("chooses the longest prefix match among several", () => {
    const names = [pending("Ben"), pending("Bench")];
    expect(matchPendingUser(names, "Benchmark")?.name).toBe("Bench");
  });

  it("returns null when nothing matches", () => {
    expect(matchPendingUser(users, "Nobody")).toBeNull();
  });

  it("ignores non-PENDING users", () => {
    const member = { ...pending("Charlie"), role: "MEMBER" } as User;
    expect(matchPendingUser([member], "Charlie")).toBeNull();
  });
});