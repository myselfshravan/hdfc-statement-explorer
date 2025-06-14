import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useCallback,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  Transaction,
  StatementSummary,
  DateRange,
  StatementGroup,
} from "../types/transaction";
import { parseHdfcStatement } from "../utils/statementParser";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "./AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { SuperStatementManager } from "../utils/superStatementManager";
import { v4 as uuidv4 } from "uuid";

// Create singleton instance
const superStatementManager = new SuperStatementManager();

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
  saveStatement: (name: string) => Promise<void>;
  savedStatements: Array<{
    id: string;
    name: string;
    created_at: string;
    groupId: string;
  }>;
  loadSavedStatements: () => Promise<void>;
  loadStatement: (id: string) => Promise<void>;
  currentGroup: StatementGroup | null;
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
  debitCount: 0,
};

const TransactionContext = createContext<TransactionContextType | undefined>(
  undefined
);

export const TransactionProvider = ({ children }: { children: ReactNode }) => {
  const [currentGroup, setCurrentGroup] = useState<StatementGroup | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [summary, setSummary] = useState<StatementSummary | null>(null);
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [upiFilter, setUpiFilter] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [savedStatements, setSavedStatements] = useState<Array<{
    id: string;
    name: string;
    created_at: string;
    groupId: string;
  }>>([]);

  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const applyFilters = useCallback(() => {
    let filtered = [...transactions];

    if (dateRange) {
      filtered = filtered.filter(
        (tx) => tx.date >= dateRange.from && tx.date <= (dateRange.to || dateRange.from)
      );
    }

    if (upiFilter) {
      filtered = filtered.filter(
        (tx) => tx.upiId && tx.upiId.toLowerCase().includes(upiFilter.toLowerCase())
      );
    }

    if (categoryFilter) {
      filtered = filtered.filter((tx) => tx.category === categoryFilter);
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
      if (!file.name.endsWith(".xls") && !file.name.endsWith(".xlsx")) {
        throw new Error("Please upload an Excel (.xls or .xlsx) file");
      }

      const { transactions: parsedTransactions, summary: parsedSummary } =
        await parseHdfcStatement(file);

      if (parsedTransactions.length === 0) {
        throw new Error("No transactions found in the statement");
      }

      // Ensure all dates are proper Date objects
      const transactions = parsedTransactions.map(t => ({
        ...t,
        date: new Date(t.date),
        valueDate: new Date(t.valueDate)
      }));

      const summary = {
        ...parsedSummary,
        startDate: new Date(parsedSummary.startDate),
        endDate: new Date(parsedSummary.endDate)
      };

      setTransactions(transactions);
      setFilteredTransactions(transactions);
      setSummary(summary);

      if (!user) {
        toast({
          title: "Authentication required",
          description: "Please sign in to analyze statements",
          variant: "destructive",
        });
        return;
      }

      const statementId = uuidv4();
      const formatDate = (date: Date) => {
        return new Intl.DateTimeFormat("en-GB", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric"
        }).format(date);
      };

      const defaultName = `Statement ${formatDate(summary.startDate)} - ${formatDate(summary.endDate)}`;

      const { error: statementError } = await supabase
        .from("statements")
        .insert({
          id: statementId,
          name: defaultName,
          user_id: user.id,
          summary: summary,
          transactions: transactions.map((t) => ({
            ...t,
            date: t.date.toISOString(),
            valueDate: t.valueDate.toISOString(),
          })),
        });

      if (statementError) {
        console.error("Error saving statement:", statementError);
        throw new Error("Failed to save statement. Please try again.");
      }

      const superStatement = await superStatementManager.mergeStatement(
        user.id,
        transactions,
        summary
      );

      setTransactions(superStatement.transactions);
      setFilteredTransactions(superStatement.transactions);
      setSummary(superStatement.summary);

      toast({
        title: "Statement uploaded successfully",
        description: `${transactions.length} transactions found and saved`,
      });

      navigate(`/statement/${statementId}`);
      await loadSavedStatements();

    } catch (error) {
      console.error("Error parsing statement:", error);
      toast({
        title: "Failed to parse statement",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const saveStatement = async (name: string) => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to save statements",
        variant: "destructive",
      });
      return;
    }

    if (!summary || transactions.length === 0) {
      toast({
        title: "No statement to save",
        description: "Please upload a statement first",
        variant: "destructive",
      });
      return;
    }

    try {
      const statementId = uuidv4();
      const { error: statementError } = await supabase
        .from("statements")
        .insert({
          id: statementId,
          name,
          user_id: user.id,
          summary,
          transactions: transactions.map((t) => ({
            ...t,
            date: t.date.toISOString(),
            valueDate: t.valueDate.toISOString(),
          })),
        });

      if (statementError) {
        console.error("Error saving statement:", statementError);
        throw new Error("Failed to save statement. Please try again.");
      }

      const superStatement = await superStatementManager.mergeStatement(
        user.id,
        transactions,
        summary
      );

      setTransactions(superStatement.transactions);
      setFilteredTransactions(superStatement.transactions);
      setSummary(superStatement.summary);

      toast({
        title: "Success",
        description: "Statement saved and merged successfully",
      });

      await loadSavedStatements();
    } catch (error) {
      console.error("Error saving statement:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save statement",
        variant: "destructive",
      });
    }
  };

  const loadSavedStatements = async () => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to view saved statements",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from("statements")
        .select("id, name, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setSavedStatements(
        (data || []).map((item) => ({
          id: item.id,
          name: item.name,
          created_at: item.created_at,
          groupId: item.id,
        }))
      );
    } catch (error) {
      console.error("Error loading statements:", error);
      toast({
        title: "Error",
        description: "Failed to load saved statements",
        variant: "destructive",
      });
    }
  };

  const loadStatement = async (id: string) => {
    if (!user) return;
    console.log('TransactionContext: Starting load statement:', id);

    // Don't reload if we already have this statement loaded
    if (currentGroup?.statements[0]?.id === id && transactions.length > 0) {
      console.log('TransactionContext: Statement already loaded');
      return;
    }

    setIsLoading(true);
    setTransactions([]); // Clear current data while loading
    setSummary(null);
    try {
      const { data: statement, error } = await supabase
        .from("statements")
        .select("*")
        .eq("id", id)
        .eq("user_id", user.id)
        .single();

      if (error) throw error;
      if (!statement) throw new Error("Statement not found");

      if (!currentGroup?.statements[0] || currentGroup.statements[0].id !== id) {
        // Parse all dates from the loaded statement
        console.log('TransactionContext: Parsing statement data');
        
        type StoredTransaction = Omit<Transaction, 'date' | 'valueDate'> & {
          date: string;
          valueDate: string;
        };

        // Convert all date strings to Date objects
        const parsedTransactions = (statement.transactions || []).map((t: StoredTransaction) => {
          try {
            return {
              ...t,
              date: new Date(t.date),
              valueDate: new Date(t.valueDate),
            };
          } catch (error) {
            console.error('Error parsing transaction dates:', error);
            return null;
          }
        }).filter(Boolean) as Transaction[];

        // Convert date strings back to Date objects in summary
        const parsedSummary = {
          ...statement.summary,
          startDate: new Date(statement.summary.startDate),
          endDate: new Date(statement.summary.endDate),
        };

        // Update state with the parsed data
        console.log('TransactionContext: Updating state with parsed data', {
          transactionCount: parsedTransactions.length,
          hasSummary: Boolean(parsedSummary)
        });
        
        setTransactions(parsedTransactions);
        setFilteredTransactions(parsedTransactions);
        setSummary(parsedSummary);

        // Update current group with parsed dates
        setCurrentGroup({
          id: statement.id,
          userId: user.id,
          firstDate: new Date(statement.summary.startDate),
          lastDate: new Date(statement.summary.endDate),
          mergedSummary: parsedSummary,
          statements: [statement],
        });

        toast({
          title: "Statement loaded",
          description: `Loaded statement: ${statement.name}`,
        });
      }
    } catch (error) {
      console.error("Error loading statement:", error);
      toast({
        title: "Error",
        description: "Failed to load statement",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Load saved statements when user changes
  React.useEffect(() => {
    if (user) {
      loadSavedStatements();
    } else {
      setSavedStatements([]);
    }
  }, [user]);

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
        saveStatement,
        savedStatements,
        loadSavedStatements,
        loadStatement,
        currentGroup,
      }}
    >
      {children}
    </TransactionContext.Provider>
  );
};

export const useTransactions = () => {
  const context = useContext(TransactionContext);
  if (context === undefined) {
    throw new Error("useTransactions must be used within a TransactionProvider");
  }
  return context;
};
