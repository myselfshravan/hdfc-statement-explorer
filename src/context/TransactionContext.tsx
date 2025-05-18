import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useCallback,
  useMemo,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  Transaction,
  StatementSummary,
  DateRange,
  StatementGroup,
  Statement,
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
  temporaryStatementId: string | null;
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
  const [temporaryStatementId, setTemporaryStatementId] = useState<string | null>(null);
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
        (tx) => tx.date >= dateRange.from && tx.date <= dateRange.to
      );
    }

    if (upiFilter) {
      filtered = filtered.filter(
        (tx) =>
          tx.upiId && tx.upiId.toLowerCase().includes(upiFilter.toLowerCase())
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

      // Set the data in context
      setTransactions(parsedTransactions);
      setFilteredTransactions(parsedTransactions);
      setSummary(parsedSummary);

      if (!user) {
        // For non-logged in users, use temporary ID
        const tempId = uuidv4();
        setTemporaryStatementId(tempId);
        navigate(`/statement/${tempId}`);
      } else {
        // For logged-in users, save to database first
        const statementId = uuidv4();
        const { error: statementError } = await supabase.from("statements").insert({
          id: statementId,
          name: file.name.replace(/\.[^/.]+$/, ""), // Use filename without extension as default name
          user_id: user.id,
          summary: parsedSummary,
          transactions: parsedTransactions.map(t => ({
            ...t,
            date: t.date.toISOString(),
          })),
        });

        if (statementError) throw statementError;
        navigate(`/statement/${statementId}`);
      }

      toast({
        title: user ? "Statement Saved ✨" : "Analysis Ready ✨",
        description: user
          ? `Statement saved with ${parsedTransactions.length} transactions. Opening analysis view...`
          : `Found ${parsedTransactions.length} transactions. Sign in to save your analysis.`,
        duration: 5000,
      });
    } catch (error) {
      console.error("Error parsing statement:", error);
      toast({
        title: "Failed to parse statement",
        description:
          error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const saveStatement = async (name: string) => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description:
          "You can analyze statements without logging in, but saving requires authentication. Please sign in to save this statement.",
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

      // First save individual statement for reference
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
          })),
        });

      if (statementError) {
        console.error("Error saving individual statement:", statementError);
        throw new Error("Failed to save statement. Please try again.");
      }

      // Then merge into the super statement
      const superStatement = await superStatementManager.mergeStatement(
        user.id,
        transactions,
        summary
      );

      // Update the UI with the merged data
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
        description:
          error instanceof Error ? error.message : "Failed to save statement",
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
      // Load all statements for the list
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
          groupId: item.id, // Use statement id as groupId since we're not using groups anymore
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

  const loadStatement = useCallback(async (id: string) => {
    // Prevent loading if we already have this statement's data
    if (currentGroup?.statements[0]?.id === id) {
      return;
    }

    // For temporary statements, just verify the ID matches
    if (id === temporaryStatementId && transactions.length > 0) {
      return;
    }

    // Only logged-in users can load from database
    if (!user) {
      navigate("/");
      return;
    }

    setIsLoading(true);
    try {
      const { data: statement, error } = await supabase
        .from("statements")
        .select("*")
        .eq("id", id)
        .eq("user_id", user.id)
        .single();

      if (error) throw error;
      if (!statement) throw new Error("Statement not found");

      // Process and set all the data at once to minimize rerenders
      const parsedTransactions = statement.transactions.map(
        (t: Omit<Transaction, "date"> & { date: string }) => ({
          ...t,
          date: new Date(t.date),
        })
      );

      setTransactions(parsedTransactions);
      setFilteredTransactions(parsedTransactions);
      setSummary({
        ...statement.summary,
        startDate: new Date(statement.summary.startDate),
        endDate: new Date(statement.summary.endDate),
      });

      setCurrentGroup({
        id: statement.id,
        userId: user.id,
        firstDate: new Date(statement.summary.startDate),
        lastDate: new Date(statement.summary.endDate),
        mergedSummary: statement.summary,
        statements: [statement],
      });

      toast({
        title: "Statement loaded",
        description: `Loaded statement: ${statement.name}`,
      });
    } catch (error) {
      console.error("Error loading statement:", error);
      toast({
        title: "Error",
        description: "Failed to load statement",
        variant: "destructive",
      });
      navigate("/");
    } finally {
      setIsLoading(false);
    }
  }, [currentGroup?.statements, temporaryStatementId, transactions.length, user, navigate]);

  // Load saved statements when user changes
  React.useEffect(() => {
    if (user) {
      loadSavedStatements();
    } else {
      setSavedStatements([]);
    }
  }, [user]);

  // Memoize context value
  const value = useMemo<TransactionContextType>(() => ({
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
    temporaryStatementId
  }), [
    transactions,
    filteredTransactions,
    isLoading,
    summary,
    dateRange,
    upiFilter,
    categoryFilter,
    savedStatements,
    loadStatement,
    currentGroup,
    temporaryStatementId
  ]);

  return (
    <TransactionContext.Provider value={value}>
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
