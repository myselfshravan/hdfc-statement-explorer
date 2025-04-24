
import * as XLSX from 'xlsx';
import { Transaction, StatementSummary } from '../types/transaction';

const parseDate = (value: string | number): Date => {
  if (typeof value === 'string' && value.match(/^\d{2}\/\d{2}\/\d{2}$/)) {
    const [day, month, year] = value.split('/');
    const fullYear = '20' + year;
    return new Date(`${fullYear}-${month}-${day}`);
  }

  if (typeof value === 'number') {
    return XLSX.SSF.parse_date_code(value);
  }

  return new Date();
};

const toFloat = (val: any): number => {
  const num = parseFloat(val);
  return isNaN(num) ? 0 : num;
};

const extractUPIDetails = (narration: string) => {
  const match = narration.match(/UPI-([A-Za-z\s]+)-(.+)/);
  
  if (match) {
    return {
      upiId: match[2].trim(),    
      merchant: match[1].trim(),  
    };
  }

  return { upiId: undefined, merchant: undefined };
};

export const parseHdfcStatement = async (file: File): Promise<{
  transactions: Transaction[],
  summary: StatementSummary
}> => {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  
  const rawRows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
  }) as any[][];
  
  const dataRows = rawRows.slice(21, -18);
  
  const transactions: Transaction[] = dataRows.map((row: any[]) => {
    const narration = row[1];
    const date = parseDate(row[3]);
    const withdrawal = toFloat(row[4]);
    const deposit = toFloat(row[5]);
    const balance = toFloat(row[6]);
    
    const { upiId, merchant } = extractUPIDetails(narration);
    
    const type = withdrawal > 0 ? "debit" : "credit";
    const amount = withdrawal > 0 ? withdrawal : deposit;
    
    return {
      date,
      narration,
      valueDate: date,
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
  });
  
  // Calculate starting balance using the first transaction's closing balance minus its impact
  const firstTransaction = transactions[0];
  const lastTransaction = transactions[transactions.length - 1];
  let startingBalance = 0;
  
  if (firstTransaction) {
    startingBalance = firstTransaction.closingBalance - 
      (firstTransaction.creditAmount - firstTransaction.debitAmount);
  }
  
  const totalDebit = transactions.reduce((sum, t) => sum + t.debitAmount, 0);
  const totalCredit = transactions.reduce((sum, t) => sum + t.creditAmount, 0);
  
  const summary: StatementSummary = {
    totalDebit,
    totalCredit,
    netCashflow: totalCredit - totalDebit,
    startDate: transactions[0]?.date || new Date(),
    endDate: transactions[transactions.length - 1]?.date || new Date(),
    startingBalance,
    endingBalance: lastTransaction?.closingBalance || 0,
    transactionCount: transactions.length,
    creditCount: transactions.filter(t => t.type === "credit").length,
    debitCount: transactions.filter(t => t.type === "debit").length
  };
  
  return { transactions, summary };
};
