import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { Transaction, StatementSummary, DateRange } from '../types/transaction';
import { parseHdfcStatement } from '../utils/statementParser';
import { useToast } from '@/components/ui/use-toast';

interface TransactionContextType {
  transactions: Transaction[];
  filteredTransactions: Transaction[];
  isLoading: boolean;
  summary: StatementSummary | null;
  uploadAndParseStatement: (file: File) => Promise<void>;
  dateRange: DateRange | null;
  setDateRange: (range: DateRange | null) => void;
  upiFilter: string | null;
  setUpiFilter: (upi: string | null) => void;
  categoryFilter: string | null;
  setCategoryFilter: (category: string | null) => void;
  resetFilters: () => void;
}

const defaultSummary: StatementSummary = {
  totalDebit: 0,
  totalCredit: 0,
  netCashflow: 0,
  startDate: new Date(),
  endDate: new Date(),
  startingBalance: 0,
  endingBalance: 0,
  transactionCount: 0,
  creditCount: 0,
  debitCount: 0
};

const TransactionContext = createContext<TransactionContextType | undefined>(undefined);

export const TransactionProvider = ({ children }: { children: ReactNode }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [summary, setSummary] = useState<StatementSummary | null>(null);
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [upiFilter, setUpiFilter] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const { toast } = useToast();

  const applyFilters = useCallback(() => {
    let filtered = [...transactions];
    
    if (dateRange) {
      filtered = filtered.filter(
        (tx) => tx.date >= dateRange.from && tx.date <= dateRange.to
      );
    }
    
    if (upiFilter) {
      filtered = filtered.filter(
        (tx) => tx.upiId && tx.upiId.toLowerCase().includes(upiFilter.toLowerCase())
      );
    }
    
    if (categoryFilter) {
      filtered = filtered.filter(
        (tx) => tx.category === categoryFilter
      );
    }
    
    setFilteredTransactions(filtered);
  }, [transactions, dateRange, upiFilter, categoryFilter]);

  const resetFilters = useCallback(() => {
    setDateRange(null);
    setUpiFilter(null);
    setCategoryFilter(null);
    setFilteredTransactions(transactions);
  }, [transactions]);

  React.useEffect(() => {
    applyFilters();
  }, [transactions, dateRange, upiFilter, categoryFilter, applyFilters]);

  const uploadAndParseStatement = async (file: File) => {
    setIsLoading(true);
    try {
      if (!file.name.endsWith('.xls') && !file.name.endsWith('.xlsx')) {
        throw new Error('Please upload an Excel (.xls or .xlsx) file');
      }
      
      const { transactions: parsedTransactions, summary: parsedSummary } = await parseHdfcStatement(file);
      
      if (parsedTransactions.length === 0) {
        throw new Error('No transactions found in the statement');
      }
      
      setTransactions(parsedTransactions);
      setFilteredTransactions(parsedTransactions);
      setSummary(parsedSummary);
      
      toast({
        title: "Statement uploaded successfully",
        description: `${parsedTransactions.length} transactions found from ${parsedSummary.startDate.toLocaleDateString()} to ${parsedSummary.endDate.toLocaleDateString()}`,
      });
    } catch (error) {
      console.error('Error parsing statement:', error);
      toast({
        title: "Failed to parse statement",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <TransactionContext.Provider
      value={{
        transactions,
        filteredTransactions,
        isLoading,
        summary,
        uploadAndParseStatement,
        dateRange,
        setDateRange,
        upiFilter,
        setUpiFilter,
        categoryFilter,
        setCategoryFilter,
        resetFilters,
      }}
    >
      {children}
    </TransactionContext.Provider>
  );
};

export const useTransactions = () => {
  const context = useContext(TransactionContext);
  if (context === undefined) {
    throw new Error('useTransactions must be used within a TransactionProvider');
  }
  return context;
};
