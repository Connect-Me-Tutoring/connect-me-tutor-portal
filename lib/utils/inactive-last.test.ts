import { describe, it, expect } from "vitest";
import { inactiveLast } from "./inactive-last";

const p = (id: string, status: "Active" | "Inactive") => ({ id, status });

describe("inactiveLast", () => {
  it("moves Inactive profiles after Active ones", () => {
    const out = inactiveLast([
      p("a", "Inactive"),
      p("b", "Active"),
      p("c", "Inactive"),
      p("d", "Active"),
    ]);
    expect(out.map((x) => x.status)).toEqual(["Active", "Active", "Inactive", "Inactive"]);
  });

  it("keeps the incoming order within each group (stable)", () => {
    const out = inactiveLast([
      p("1", "Inactive"),
      p("2", "Active"),
      p("3", "Inactive"),
      p("4", "Active"),
    ]);
    expect(out.map((x) => x.id)).toEqual(["2", "4", "1", "3"]);
  });

  it("does not mutate the input array", () => {
    const input = [p("1", "Inactive"), p("2", "Active")];
    const snapshot = [...input];
    inactiveLast(input);
    expect(input).toEqual(snapshot);
  });

  it("handles empty, all-Active, and all-Inactive lists", () => {
    expect(inactiveLast([])).toEqual([]);
    expect(inactiveLast([p("1", "Active"), p("2", "Active")]).map((x) => x.id)).toEqual(["1", "2"]);
    expect(inactiveLast([p("1", "Inactive"), p("2", "Inactive")]).map((x) => x.id)).toEqual([
      "1",
      "2",
    ]);
  });

  it("treats a missing status as Active, never hidden at the bottom", () => {
    const out = inactiveLast([{ id: "x", status: undefined as any }, p("y", "Inactive")]);
    expect(out.map((x) => x.id)).toEqual(["x", "y"]);
  });
});
