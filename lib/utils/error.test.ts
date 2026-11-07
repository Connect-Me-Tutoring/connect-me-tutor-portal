import { describe, expect, it } from "vitest";
import { getErrorMessage } from "./error";

describe("getErrorMessage", () => {
  it("hides minified React errors", () => {
    const errorMsg =
      "Error: Minified React error #441; visit https://react.dev/errors/441 for the full message or use the non-minified dev environment for full errors and additional helpful warnings.";
    const res = getErrorMessage(new Error(errorMsg));
    expect(res).toBe("Something went wrong. Please refresh the page or try again.");
  });

  it("handles string minified React errors directly", () => {
    const errorMsg =
      "Minified React error #441; visit https://react.dev/errors/441 for the full message";
    expect(getErrorMessage(errorMsg)).toBe(
      "Something went wrong. Please refresh the page or try again.",
    );
  });

  it("translates known auth errors", () => {
    expect(getErrorMessage(new Error("Invalid login credentials"))).toBe(
      "Invalid email or password. Please try again.",
    );
    expect(getErrorMessage("Token has expired or is invalid")).toBe(
      "The code or link has expired. Please request a new one.",
    );
  });

  it("extracts error_description from OAuth/auth objects", () => {
    expect(
      getErrorMessage({
        error_description: "Invalid login credentials",
      }),
    ).toBe("Invalid email or password. Please try again.");
  });

  it("suppresses database syntax, schema, and constraint errors", () => {
    const dbError = 'relation "profiles" does not exist in schema "public"';
    expect(getErrorMessage(dbError)).toBe("Something went wrong. Please try again.");

    const constraintError =
      'duplicate key value violates unique constraint "pairings_student_id_key"';
    expect(getErrorMessage(constraintError)).toBe("An entry with these details already exists.");
  });

  it("suppresses stack traces and file paths", () => {
    const stackError = "Error at Object.execute (file:///app/dist/server.js:42:10)";
    expect(getErrorMessage(stackError)).toBe("Something went wrong. Please try again.");

    const windowsPathError =
      "Failed to read file at C:\\Users\\Jithu\\Desktop\\portalcm\\backend\\secret.json";
    expect(getErrorMessage(windowsPathError)).toBe("Something went wrong. Please try again.");
  });

  it("handles empty objects, undefined, or null safely with fallback", () => {
    expect(getErrorMessage({})).toBe("Something went wrong. Please try again.");
    expect(getErrorMessage(null)).toBe("Something went wrong. Please try again.");
    expect(getErrorMessage(undefined)).toBe("Something went wrong. Please try again.");
    expect(getErrorMessage("[object Object]")).toBe("Something went wrong. Please try again.");
  });

  it("keeps user-friendly validation messages intact", () => {
    expect(getErrorMessage("Please select a session date.")).toBe("Please select a session date.");
    expect(getErrorMessage("Please enter a valid email address.")).toBe(
      "Please enter a valid email address.",
    );
  });
});
