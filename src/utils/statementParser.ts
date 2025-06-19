import * as XLSX from "xlsx";
import { Transaction, StatementSummary } from "../types/transaction";

const parseDate = (value: string | number): Date => {
  if (typeof value === "string") {
    const match = value.match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
    if (match) {
      const [, day, month, year] = match;
      const fullYear = "20" + year;
      return new Date(`${fullYear}-${month}-${day}`);
    }
  }

  if (typeof value === "number") {
    return XLSX.SSF.parse_date_code(value);
  }

  return new Date();
};

const toFloat = (val: string | number | null): number => {
  if (typeof val === "number") return val;
  const num = parseFloat(String(val || ""));
  return isNaN(num) ? 0 : num;
};

const extractUPIDetails = (narration: string | number | null) => {
  if (!narration || typeof narration !== "string")
    return { upiId: undefined, merchant: undefined };

  const match = narration.match(/UPI-([A-Za-z\s]+)-(.+)/);

  if (match) {
    return {
      upiId: match[2].trim(),
      merchant: match[1].trim(),
    };
  }

  return { upiId: undefined, merchant: undefined };
};

export const parseHdfcStatement = async (
  file: File
): Promise<{
  transactions: Transaction[];
  summary: StatementSummary;
}> => {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];

  const rawRows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
  }) as (string | number | null)[][];

  // Find the index of the header row that contains transaction data
  const headerRowIndex = rawRows.findIndex(
    (row) =>
      row &&
      Array.isArray(row) &&
      row.some(
        (cell) =>
          cell &&
          typeof cell === "string" &&
          cell.toLowerCase().includes("date")
      )
  );

  if (headerRowIndex === -1) {
    throw new Error("Could not find transaction data in the statement");
  }

  // Start from the row after the header
  const dataRows = rawRows.slice(headerRowIndex + 1);

  // Filter out rows that don't contain valid transaction data
  const validRows = dataRows.filter((row) => {
    if (!row || !Array.isArray(row) || row.length < 7) return false;

    // Check if either withdrawal or deposit has a valid numeric value
    const withdrawal = toFloat(row[4]);
    const deposit = toFloat(row[5]);
    const balance = toFloat(row[6]);
    const dateValue = row[3];

    // Skip rows where all monetary values are 0 (likely headers or invalid data)
    if (withdrawal === 0 && deposit === 0 && balance === 0) return false;

    // Validate date value
    if (
      !dateValue ||
      (typeof dateValue !== "string" && typeof dateValue !== "number")
    )
      return false;

    // Skip rows that are just headers or formatting
    const narration = String(row[1] || "");
    if (
      narration.includes("Date") ||
      narration.includes("Description") ||
      /^\*+$/.test(narration)
    )
      return false;

    return true;
  });

  const transactions: Transaction[] = validRows.map(
    (row: (string | number | null)[]) => {
      const narration = String(row[1] || "");
      const dateValue = row[3];
      if (
        !dateValue ||
        (typeof dateValue !== "string" && typeof dateValue !== "number")
      ) {
        throw new Error("Invalid date value in transaction");
      }
      const date = parseDate(dateValue);
      const withdrawal = toFloat(row[4]);
      const deposit = toFloat(row[5]);
      const balance = toFloat(row[6]);
      const chqRefNumber = String(row[2] || "").trim();

      const { upiId, merchant } = extractUPIDetails(narration);

      const type = withdrawal > 0 ? "debit" : "credit";
      const amount = withdrawal > 0 ? withdrawal : deposit;

      return {
        date,
        narration,
        valueDate: date,
        debitAmount: withdrawal,
        creditAmount: deposit,
        chqRefNumber: chqRefNumber,
        closingBalance: balance,
        amount,
        type,
        category: type === "credit" ? "Deposit" : "Withdrawal",
        upiId,
        merchant,
        statementId: Math.random().toString(36).substring(2, 15),
      };
    }
  );

  // Get the first and last transactions for balance data
  const firstTransaction = transactions[0];
  const lastTransaction = transactions[transactions.length - 1];

  // Calculate totals
  const totalDebit = transactions.reduce((sum, t) => sum + t.debitAmount, 0);
  const totalCredit = transactions.reduce((sum, t) => sum + t.creditAmount, 0);

  const summary: StatementSummary = {
    totalDebit,
    totalCredit,
    netCashflow: totalCredit - totalDebit,
    startDate: firstTransaction?.date || new Date(),
    endDate: lastTransaction?.date || new Date(),
    startingBalance: firstTransaction?.closingBalance || 0,
    endingBalance: lastTransaction?.closingBalance || 0,
    transactionCount: transactions.length,
    creditCount: transactions.filter((t) => t.type === "credit").length,
    debitCount: transactions.filter((t) => t.type === "debit").length,
  };

  return { transactions, summary };
};
