import { isValidUUID } from "@/lib/utils";
import { describe, expect, it } from "vitest";

describe("isValidUUID", () => {
  it("rejects non-UUID strings", () => {
    expect(isValidUUID("notanUUID")).toBe(false);
  });
});
