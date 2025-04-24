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
  // New fields for merging
  transactionId: string; // Hash of transaction details for deduplication
  statementId: string;   // Reference to parent statement
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

export interface StatementGroup {
  id: string;
  userId: string;
  firstDate: Date;
  lastDate: Date;
  mergedSummary: StatementSummary;
  statements: Statement[];
}

export interface Statement {
  id: string;
  groupId: string;
  name: string;
  summary: StatementSummary;
  transactions: Transaction[];
  created_at: string;
}

// Utility type for B-tree node
export interface DateRangeNode {
  groupId: string;
  startDate: Date;
  endDate: Date;
  left?: DateRangeNode;
  right?: DateRangeNode;
}
