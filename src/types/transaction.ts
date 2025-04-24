
export interface Transaction {
  date: Date;
  narration: string;
  valueDate: Date;
  debitAmount: number;
  creditAmount: number;
  chqRefNumber: string;
  closingBalance: number;
  // Derived fields
  amount: number;
  type: "debit" | "credit";
  category?: string;
  upiId?: string;
  merchant?: string;
}

export interface StatementSummary {
  totalDebit: number;
  totalCredit: number;
  netCashflow: number;
  startDate: Date;
  endDate: Date;
  startingBalance: number;
  endingBalance: number;
  transactionCount: number;
  creditCount: number;
  debitCount: number;
}

export interface DateRange {
  from: Date;
  to: Date;
}
