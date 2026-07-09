import { google } from "googleapis";
import { json } from "stream/consumers";

async function authenticate() {
  const credentials = JSON.parse(
    process.env.GOOGLE_APPLICATION_CREDENTIALS || "{}"
  );

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

interface FormData {
  tutorFirstName?: string;
  tutorLastName?: string;
  studentFirstName?: string;
  studentLastName?: string;
  formContent: string;
  tutorEmail?: string;
  studentEmail?: string;
  category?: string;
}
export async function getSheetSize(sheetName: string = "Questions & Concerns") {
  const authClient = (await authenticate()) as any;
  const sheets = google.sheets({ version: "v4", auth: authClient });

  const spreadsheetId = process.env.SHEET_ID;
  const range = `${sheetName}!B:G`; // no cell range, just the sheet name

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
    throw error;
  }
}

export async function writeSpreadSheet(formData: FormData) {
  const authClient = (await authenticate()) as any;
  const sheets = google.sheets({
    version: "v4",
    auth: authClient,
  }).spreadsheets;
  const spreadsheetId = process.env.SHEET_ID;

  const currRowSize = (await getSheetSize()).numRows;
  const nextRowIdx = currRowSize + 1;

  const range = `Questions & Concerns!B${nextRowIdx}:G${nextRowIdx}`;
  const valueInputOption = "USER_ENTERED";

  const values = [
    [
      formData.tutorFirstName + " " + formData.tutorLastName,
      formData.studentFirstName + " " + formData.studentLastName,
      formData.tutorEmail,
      formData.studentEmail,
      formData.formContent,
      formData.category || "General",
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

async function sendDiscordNotification(rowIdx: number, formData: FormData) {
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
        }),
      }
    )
      .then((res) => res.text())
  } catch (error) {
    throw error;
  }
}
