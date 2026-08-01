import { google } from "googleapis";
import { sanitizeForSheetCell } from "@/lib/security/spreadsheet";
import { SessionExitFormPayload } from "@/types/sessionExitForm";
import { logError } from "@/lib/posthog";

// Columns: tutorName, studentName, tutorEmail, studentEmail, formContent, category
const SHEET_RANGE_COLUMNS = "B:G";

async function authenticate() {
  const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS || "{}");

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return await auth.getClient();
}

export async function readSpreadsheet() {
  const authClient = (await authenticate()) as any;
  const sheets = google.sheets({
    version: "v4",
    auth: authClient,
  }).spreadsheets;

  const spreadsheetId = process.env.SHEET_ID;
  const range = "Questions & Concerns!A1:D5";

  try {
    const response = await sheets.values.get({
      spreadsheetId,
      range,
    });

    const rows = response.data.values;
    return rows;
  } catch (error) {
    throw error;
  }
}

function joinName(firstName?: string, lastName?: string): string {
  return [firstName, lastName].filter(Boolean).join(" ");
}

export async function getSheetSize(sheetName: string = "Questions & Concerns") {
  const authClient = (await authenticate()) as any;
  const sheets = google.sheets({ version: "v4", auth: authClient });

  const spreadsheetId = process.env.SHEET_ID;
  const range = `${sheetName}!${SHEET_RANGE_COLUMNS}`; // no cell range, just the sheet name

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const rows = response.data.values || [];

    const numRows = rows.length;
    const numCols = rows[0]?.length || 0;

    return { numRows, numCols };
  } catch (error) {
    console.error("Error getting sheet size:", error);
    await logError(error, { sheetName }, "google_sheet_error");
    throw error;
  }
}

export async function writeSpreadSheet(formData: SessionExitFormPayload) {
  const authClient = (await authenticate()) as any;
  const sheets = google.sheets({
    version: "v4",
    auth: authClient,
  }).spreadsheets;
  const spreadsheetId = process.env.SHEET_ID;

  const currRowSize = (await getSheetSize()).numRows;
  const nextRowIdx = currRowSize + 1;

  const [startCol, endCol] = SHEET_RANGE_COLUMNS.split(":");
  const range = `Questions & Concerns!${startCol}${nextRowIdx}:${endCol}${nextRowIdx}`;
  const valueInputOption = "USER_ENTERED";

  const values = [
    [
      sanitizeForSheetCell(joinName(formData.tutorFirstName, formData.tutorLastName)),
      sanitizeForSheetCell(joinName(formData.studentFirstName, formData.studentLastName)),
      sanitizeForSheetCell(formData.tutorEmail),
      sanitizeForSheetCell(formData.studentEmail),
      sanitizeForSheetCell(formData.formContent),
      sanitizeForSheetCell(formData.category),
    ],
  ];

  try {
    const response = await sheets.values.update({
      spreadsheetId,
      range,
      valueInputOption,
      requestBody: { values },
    });

    await sendDiscordNotification(nextRowIdx, formData);

    const rows = response.data;
    return rows;
  } catch (error) {
    throw error;
  }
}

async function sendDiscordNotification(rowIdx: number, formData: SessionExitFormPayload) {
  try {
    await fetch(
      "https://script.google.com/macros/s/AKfycbz642YwN0t9gUAKycvrKq5WEJueL_PfDQwug7LK36EYsF6gf9ZVpbBkCc1p88Nf83qD/exec",

      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rowIdx: rowIdx,
          tutorFirstName: formData.tutorFirstName || "",
          tutorLastName: formData.tutorLastName || "",
          studentFirstName: formData.studentFirstName || "",
          studentLastName: formData.studentLastName || "",
          questionOrConcern: formData.formContent || "",
          category: formData.category,
        }),
      },
    ).then((res) => res.text());
  } catch (error) {
    throw error;
  }
}
