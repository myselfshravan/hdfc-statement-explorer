
import * as XLSX from 'xlsx';
import { Transaction, StatementSummary } from '../types/transaction';

// Helper to parse date values
const parseDate = (value: string | number): Date => {
  if (typeof value === 'string' && value.match(/^\d{2}\/\d{2}\/\d{2}$/)) {
    // Example: 23/04/25 -> 2025-04-23
    const [day, month, year] = value.split('/');
    const fullYear = '20' + year; // Assuming all years are from 2000 onwards
    return new Date(`${fullYear}-${month}-${day}`);
  }

  if (typeof value === 'number') {
    return XLSX.SSF.parse_date_code(value);
  }

  return new Date(); // Fallback to current date
};

// Convert to number or 0
const toFloat = (val: any): number => {
  const num = parseFloat(val);
  return isNaN(num) ? 0 : num;
};

// Extract UPI info from Narration
const extractUPIDetails = (narration: string) => {
  const match = narration.match(/UPI-([A-Za-z\s]+)-(.+)/);
  
  if (match) {
    return {
      upiId: match[2].trim(),    // UPI ID (e.g., "ANKOLEABHINAV@OKAXIS")
      merchant: match[1].trim(),  // Merchant name (e.g., "ABHINAV B M")
    };
  }

  return { upiId: undefined, merchant: undefined };
};

// Main function to parse HDFC statement
export const parseHdfcStatement = async (file: File): Promise<{
  transactions: Transaction[],
  summary: StatementSummary
}> => {
  try {
    // Read the uploaded file
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);
    
    // Get first sheet
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    
    // Get raw rows (no headers)
    const rawRows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: null,
    }) as any[][];
    
    // Remove header and footer rows
    const dataRows = rawRows.slice(21, -18);
    
    if (dataRows.length === 0) {
      throw new Error("No transactions found in the statement");
    }
    
    // Process transactions
    const transactions: Transaction[] = [];
    let startingBalance = 0;
    let endingBalance = 0;
    
    dataRows.forEach((row: any[], index: number) => {
      const narration = row[1]; // Narration
      const date = parseDate(row[3]); // Date
      const withdrawal = toFloat(row[4]); // Withdrawal
      const deposit = toFloat(row[5]); // Deposit
      const balance = toFloat(row[6]); // Balance
      
      // Skip invalid entries
      if (!narration || !date) return;
      
      // Extract additional info
      const { upiId, merchant } = extractUPIDetails(narration);
      
      // Determine transaction type
      const type = withdrawal > 0 ? "debit" : "credit";
      const amount = withdrawal > 0 ? withdrawal : deposit;
      
      // Create transaction object
      const transaction: Transaction = {
        date,
        narration,
        valueDate: date, // Using same date as value date
        debitAmount: withdrawal,
        creditAmount: deposit,
        chqRefNumber: "",
        closingBalance: balance,
        amount,
        type,
        category: type === "credit" ? "Deposit" : "Withdrawal",
        upiId,
        merchant
      };
      
      transactions.push(transaction);
      
      // Track starting and ending balance
      if (index === 0) {
        startingBalance = balance + withdrawal - deposit;
      }
      if (index === dataRows.length - 1) {
        endingBalance = balance;
      }
    });
    
    // Sort transactions by date
    transactions.sort((a, b) => a.date.getTime() - b.date.getTime());
    
    // Calculate summary
    const totalDebit = transactions.reduce((sum, t) => sum + t.debitAmount, 0);
    const totalCredit = transactions.reduce((sum, t) => sum + t.creditAmount, 0);
    
    const summary: StatementSummary = {
      totalDebit,
      totalCredit,
      netCashflow: totalCredit - totalDebit,
      startDate: transactions[0]?.date || new Date(),
      endDate: transactions[transactions.length - 1]?.date || new Date(),
      startingBalance,
      endingBalance,
      transactionCount: transactions.length,
      creditCount: transactions.filter(t => t.type === "credit").length,
      debitCount: transactions.filter(t => t.type === "debit").length
    };
    
    return { transactions, summary };
    
  } catch (error) {
    console.error("Error parsing statement:", error);
    throw error;
  }
};
