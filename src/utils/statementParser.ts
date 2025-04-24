
import * as XLSX from 'xlsx';
import { Transaction, StatementSummary } from '../types/transaction';

// Pattern to extract UPI IDs from transaction narrations
const UPI_PATTERN = /UPI-([A-Za-z0-9.]+@[A-Za-z0-9]+|[A-Za-z0-9]+@[A-Za-z0-9.]+)/;

// Function to parse date from Excel serial number
const parseExcelDate = (serial: number): Date => {
  const utcDays = Math.floor(serial - 25569);
  const utcValue = utcDays * 86400;
  const date = new Date(utcValue * 1000);
  return date;
};

// Function to parse transaction narration and extract additional info
const parseNarration = (narration: string): { upiId?: string, merchant?: string, category?: string } => {
  const result: { upiId?: string, merchant?: string, category?: string } = {};
  
  // Extract UPI ID if present
  const upiMatch = narration.match(UPI_PATTERN);
  if (upiMatch && upiMatch[1]) {
    result.upiId = upiMatch[1];
    
    // Try to extract merchant name from UPI ID
    const merchantMatch = upiMatch[1].split('@');
    if (merchantMatch.length > 0) {
      let possibleMerchant = merchantMatch[0].toLowerCase();
      // Clean up common prefixes in merchant names
      if (possibleMerchant.startsWith('pay') || possibleMerchant.startsWith('paytm')) {
        result.merchant = possibleMerchant;
      }
    }
  }
  
  // Basic categorization based on keywords
  if (narration.includes('UPI')) {
    result.category = 'UPI Payment';
  } else if (narration.includes('ATM') || narration.includes('CASH')) {
    result.category = 'Cash Withdrawal';
  } else if (narration.includes('SALARY') || narration.includes('INCOME')) {
    result.category = 'Income';
  } else if (narration.includes('TRANSFER') || narration.includes('IMPS') || narration.includes('NEFT')) {
    result.category = 'Transfer';
  } else if (narration.includes('BILL') || narration.includes('PAYMENT')) {
    result.category = 'Bill Payment';
  } else if (narration.includes('INT') && narration.includes('CR')) {
    result.category = 'Interest Credit';
  } else {
    result.category = 'Others';
  }
  
  return result;
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
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    
    // Convert to JSON
    const jsonData = XLSX.utils.sheet_to_json(worksheet);
    
    // Check if this is a valid HDFC statement format
    if (jsonData.length === 0) {
      throw new Error("No data found in the Excel file");
    }
    
    // Define column mappings for HDFC statement
    const columnMappings = {
      date: "Date",
      narration: "Narration", 
      valueDate: "Value Dt",
      debitAmount: "Debit Amt",
      creditAmount: "Credit Amt",
      chqRefNumber: "Chq/Ref Number",
      closingBalance: "Closing Balance"
    };
    
    // Process transactions
    const transactions: Transaction[] = [];
    let startingBalance = 0;
    let endingBalance = 0;
    
    jsonData.forEach((row: any, index: number) => {
      // Skip header rows or invalid entries
      if (!row[columnMappings.date] || !row[columnMappings.narration]) {
        return;
      }
      
      // Parse date values
      let transactionDate: Date;
      let valueDate: Date;
      
      if (typeof row[columnMappings.date] === 'number') {
        transactionDate = parseExcelDate(row[columnMappings.date]);
      } else if (typeof row[columnMappings.date] === 'string') {
        transactionDate = new Date(row[columnMappings.date]);
      } else {
        // Skip invalid dates
        return;
      }
      
      if (typeof row[columnMappings.valueDate] === 'number') {
        valueDate = parseExcelDate(row[columnMappings.valueDate]);
      } else if (typeof row[columnMappings.valueDate] === 'string') {
        valueDate = new Date(row[columnMappings.valueDate]);
      } else {
        valueDate = transactionDate; // Default to transaction date if value date is missing
      }
      
      // Parse amounts
      const debitAmount = typeof row[columnMappings.debitAmount] === 'number' ? 
        row[columnMappings.debitAmount] : 0;
      
      const creditAmount = typeof row[columnMappings.creditAmount] === 'number' ? 
        row[columnMappings.creditAmount] : 0;
      
      const closingBalance = typeof row[columnMappings.closingBalance] === 'number' ? 
        row[columnMappings.closingBalance] : 0;
      
      // Calculate derived fields
      const amount = debitAmount > 0 ? debitAmount : creditAmount;
      const type = debitAmount > 0 ? "debit" : "credit";
      
      // Extract additional info from narration
      const additionalInfo = parseNarration(row[columnMappings.narration]);
      
      // Create transaction object
      const transaction: Transaction = {
        date: transactionDate,
        narration: row[columnMappings.narration],
        valueDate: valueDate,
        debitAmount,
        creditAmount,
        chqRefNumber: row[columnMappings.chqRefNumber] || "",
        closingBalance,
        amount,
        type,
        ...additionalInfo
      };
      
      transactions.push(transaction);
      
      // Track starting and ending balance
      if (index === 0) {
        startingBalance = closingBalance - creditAmount + debitAmount;
      }
      
      if (index === jsonData.length - 1) {
        endingBalance = closingBalance;
      }
    });
    
    // Sort transactions by date
    transactions.sort((a, b) => a.date.getTime() - b.date.getTime());
    
    // Calculate summary statistics
    const totalDebit = transactions.reduce((sum, t) => sum + t.debitAmount, 0);
    const totalCredit = transactions.reduce((sum, t) => sum + t.creditAmount, 0);
    const netCashflow = totalCredit - totalDebit;
    
    const startDate = transactions.length > 0 ? transactions[0].date : new Date();
    const endDate = transactions.length > 0 ? transactions[transactions.length - 1].date : new Date();
    
    const creditCount = transactions.filter(t => t.type === "credit").length;
    const debitCount = transactions.filter(t => t.type === "debit").length;
    
    const summary: StatementSummary = {
      totalDebit,
      totalCredit,
      netCashflow,
      startDate,
      endDate,
      startingBalance,
      endingBalance,
      transactionCount: transactions.length,
      creditCount,
      debitCount
    };
    
    return { transactions, summary };
  } catch (error) {
    console.error("Error parsing HDFC statement:", error);
    throw new Error("Failed to parse the bank statement. Please make sure it's a valid HDFC Bank statement.");
  }
};
