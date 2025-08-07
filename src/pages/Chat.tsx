import React, { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/AuthContext";
import { SuperStatementManager } from "@/utils/superStatementManager";
import { Transaction, StatementSummary } from "@/types/transaction";
import { Tag } from "@/types/tags";
import { tagManager } from "@/utils/tagManager";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Trash2, Lightbulb, TrendingUp, Brain } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github.css";
import { FinancialAnalysisService } from "@/services/FinancialAnalysisService";
import { ContextGenerationService } from "@/services/ContextGenerationService";
import { TransactionQueryEngine } from "@/services/TransactionQueryEngine";
import { InsightGenerationService } from "@/services/InsightGenerationService";
import { ConversationMemoryService } from "@/services/ConversationMemoryService";

interface ResponseMetrics {
  total_time: number;
  queue_time: number;
  prompt_time: number;
  completion_time: number;
}

interface Message {
  id: string;
  content: string;
  role: "user" | "assistant" | "system";
  timestamp: Date;
  metrics?: ResponseMetrics;
  queryResult?: {
    transactionCount: number;
    totalAmount: number;
    insights: string[];
  };
}


const STORAGE_KEY = "statement-chat-history";
const INSIGHTS_STORAGE_KEY = "financial-insights-cache";

// Debug helper with circular reference protection
const debugLog = (
  label: string,
  data: Record<string, unknown> | StatementSummary | null | undefined
) => {
  try {
    // Create a safe version of the data to prevent circular references
    const safeData = JSON.parse(JSON.stringify(data, (key, value) => {
      if (typeof value === 'object' && value !== null) {
        // Limit object depth to prevent stack overflow
        if (key.length > 50) return '[Object]';
      }
      return value;
    }));
    
    console.log(
      `%c[Chat Debug] ${label}`,
      "color: #0066CC; font-weight: bold",
      safeData
    );
  } catch (error) {
    console.log(
      `%c[Chat Debug] ${label}`,
      "color: #0066CC; font-weight: bold",
      '[Unable to serialize - circular reference]'
    );
  }
};


const Header = ({ title, subtitle }: { title: string; subtitle: string }) => (
  <div className="border-b">
    <div className="container mx-auto p-4 max-w-6xl">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="text-muted-foreground">{subtitle}</p>
    </div>
  </div>
);

export default function Chat() {
  const { user } = useAuth();
  const [statementData, setStatementData] = useState<{
    summary: StatementSummary | null;
    transactions: Transaction[];
  }>({
    summary: null,
    transactions: [],
  });
  const [transactionTags, setTransactionTags] = useState<Map<string, Tag[]>>(new Map());
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [suggestedQueries, setSuggestedQueries] = useState<string[]>([]);
  const [financialInsights, setFinancialInsights] = useState<any>(null);
  const [conversationContext, setConversationContext] = useState<any>(null);
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Guards to prevent duplicate execution
  const isLoadingData = useRef(false);
  const hasLoadedData = useRef(false);

  // Initialize services
  const financialAnalysisService = useRef(new FinancialAnalysisService());
  const contextGenerationService = useRef(new ContextGenerationService());
  const queryEngine = useRef(new TransactionQueryEngine());
  const insightGenerationService = useRef(new InsightGenerationService());
  const conversationMemoryService = useRef(new ConversationMemoryService());

  // Load statement data and tags on mount
  useEffect(() => {
    const loadStatementData = async () => {
      if (!user || isLoadingData.current || hasLoadedData.current) return;
      
      isLoadingData.current = true;

      try {
        setIsAnalyzing(true);
        const superStatementManager = new SuperStatementManager();
        const [transactions, fetchedSummary, tagsMap] = await Promise.all([
          superStatementManager.getSuperStatementTransactions(user.id),
          superStatementManager.getSuperStatementSummary(user.id),
          tagManager.getAllTransactionTags(),
        ]);

        // Convert date strings to Date objects
        const summary = fetchedSummary
          ? {
              ...fetchedSummary,
              startDate: new Date(fetchedSummary.startDate),
              endDate: new Date(fetchedSummary.endDate),
            }
          : null;

        const processedTransactions = transactions.map((t) => ({
          ...t,
          date: new Date(t.date),
          valueDate: new Date(t.valueDate),
        }));



        setStatementData({
          transactions: processedTransactions,
          summary,
        });

        setTransactionTags(tagsMap);

        // Generate initial insights and suggestions
        if (processedTransactions.length > 0) {
          try {
            const insights = financialAnalysisService.current.analyzeTransactions(
              processedTransactions,
              tagsMap
            );
            
            const personalizedInsights = insightGenerationService.current.generatePersonalizedInsights(
              insights,
              processedTransactions,
              tagsMap
            );
            
            setFinancialInsights({ insights, personalizedInsights });
            
            const suggestions = queryEngine.current.suggestQueries(
              processedTransactions,
              tagsMap
            );
            setSuggestedQueries(suggestions);
            console.log("💡 System Ready: Financial insights loaded for", processedTransactions.length, "transactions");
            
            // Cache insights for performance (with error handling)
            try {
              const cacheData = { 
                hasInsights: true, 
                insightKeys: Object.keys(insights),
                timestamp: Date.now() 
              };
              localStorage.setItem(INSIGHTS_STORAGE_KEY, JSON.stringify(cacheData));
            } catch (cacheError) {
              console.warn("Failed to cache insights:", cacheError);
            }
          } catch (insightError) {
            console.error("Error generating insights:", insightError);
          }
        }
      } catch (error) {
        console.error("Error loading statement data:", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load statement data.",
        });
      } finally {
        setIsAnalyzing(false);
        isLoadingData.current = false;
        hasLoadedData.current = true;
      }
    };

    loadStatementData();
  }, [user, toast]);


  // Initialize conversation context after state is set (using ref to avoid infinite loop)
  const hasInitializedContext = useRef(false);
  useEffect(() => {
    if (user && statementData.transactions.length > 0 && !hasInitializedContext.current) {
      const convContext = conversationMemoryService.current.getOrCreateConversationContext(user.id);
      setConversationContext(convContext);
      hasInitializedContext.current = true;
    }
  }, [user, statementData.transactions.length]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const savedMessages = localStorage.getItem(STORAGE_KEY);
    if (savedMessages) {
      try {
        const parsed = JSON.parse(savedMessages);
        setMessages(
          parsed.map((msg: Message) => ({
            ...msg,
            timestamp: new Date(msg.timestamp),
          }))
        );
        setTimeout(scrollToBottom, 100);
      } catch (error) {
        console.error("Error loading chat history:", error);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  const sendMessage = async (e: React.FormEvent, queryText?: string) => {
    e.preventDefault();
    const messageContent = queryText || input.trim();
    if (!messageContent) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      content: messageContent,
      role: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    inputRef.current?.focus();
    setIsLoading(true);

    try {
      // ROBUST PIPELINE - Step 1: Validate we have required data
      if (!statementData.transactions.length) {
        console.error("❌ No transaction data available for query processing");
        throw new Error("No transaction data loaded");
      }

      console.log("📊 Processing query with", statementData.transactions.length, "transactions");

      // ROBUST PIPELINE - Step 2: Process query with transaction data  
      const queryResult = queryEngine.current.processNaturalLanguageQuery(
        messageContent,
        statementData.transactions,
        transactionTags
      );

      console.log("🔍 Query processing result:", {
        found: queryResult.summary.count,
        totalAmount: queryResult.summary.totalAmount,
        insights: queryResult.insights.length
      });

      // ROBUST PIPELINE - Step 3: Generate context with ALL available data
      const chatContext = contextGenerationService.current.generateChatContext(
        statementData.transactions,
        statementData.summary,
        transactionTags,
        messageContent
      );

      console.log("🧠 Context generation complete:", {
        contextLength: chatContext.systemPrompt.length,
        hasFinancialSummary: !!chatContext.financialSummary
      });

      // ROBUST PIPELINE - Step 4: Generate fresh insights if not available or add existing ones
      let enhancedContext = chatContext.systemPrompt;
      let currentInsights = financialInsights;

      // If no insights are loaded, generate them on-demand
      if (!currentInsights?.insights && statementData.transactions.length > 0) {
        console.log("⚡ Generating fresh financial insights for query...");
        try {
          const freshInsights = financialAnalysisService.current.analyzeTransactions(
            statementData.transactions,
            transactionTags
          );
          currentInsights = { insights: freshInsights };
        } catch (error) {
          console.error("Failed to generate fresh insights:", error);
          currentInsights = null;
        }
      }

      // Add query-specific context with current insights
      if (currentInsights?.insights) {
        console.log("🎯 Adding query-specific financial context");
        const querySpecificContext = contextGenerationService.current.generateQuerySpecificContext(
          messageContent,
          currentInsights.insights,
          statementData.transactions
        );
        if (querySpecificContext) {
          enhancedContext += `\n\nQUERY-SPECIFIC CONTEXT:\n${querySpecificContext}`;
        }
      } else {
        console.warn("⚠️ No financial insights available for enhanced context");
      }

      // Include query results in context
      if (queryResult.transactions.length > 0) {
        enhancedContext += `\n\nQUERY RESULTS:\n- Found ${queryResult.summary.count} matching transactions\n- Total amount: ₹${queryResult.summary.totalAmount.toLocaleString('en-IN')}\n- Insights: ${queryResult.insights.join(', ')}`;
      }

      const contextMessages = messages.slice(-4).map(({ role, content }) => ({ role, content }));
      
      // Determine query type for conversation memory
      const queryType = determineQueryType(messageContent);

      const apiPayload = {
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: enhancedContext },
          ...contextMessages,
          { role: "user", content: messageContent },
        ],
      };
      
      console.log("🚀 REQUEST TO LLM:");
      console.log("User Query:", messageContent);
      console.log("System Context Length:", enhancedContext.length, "chars");
      console.log("Financial Insights Status:", currentInsights?.insights ? "✅ Available" : "❌ Missing");
      console.log("Query Results:", queryResult.summary.count, "transactions found");
      console.log("Transaction Data:", statementData.transactions.length, "total transactions");
      console.log("Full System Context:", enhancedContext);

      const response = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_GROQ_API_KEY}`,
          },
          body: JSON.stringify(apiPayload),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to get response");
      }

      const data = await response.json();
      
      console.log("📨 RESPONSE FROM LLM:");
      console.log("Response Content:", data.choices[0].message.content);
      console.log("Model Used:", data.model);
      console.log("Response Time:", data.usage?.total_time || 0, "seconds");

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        content: data.choices[0].message.content,
        role: "assistant",
        timestamp: new Date(),
        metrics: {
          total_time: data.usage?.total_time || 0,
          queue_time: data.usage?.queue_time || 0,
          prompt_time: data.usage?.prompt_time || 0,
          completion_time: data.usage?.completion_time || 0,
        },
        queryResult: queryResult.summary.count > 0 ? {
          transactionCount: queryResult.summary.count,
          totalAmount: queryResult.summary.totalAmount,
          insights: queryResult.insights,
        } : undefined,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Update conversation memory
      if (conversationContext && user) {
        const updatedContext = conversationMemoryService.current.addConversationEntry(
          conversationContext,
          messageContent,
          data.choices[0].message.content,
          queryType,
          queryResult.insights,
          queryResult.transactions.slice(0, 10).map(t => t.chqRefNumber)
        );
        setConversationContext(updatedContext);
      }
    } catch (error) {
      console.error("API Error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to get response from the assistant.",
      });
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  const handleSuggestedQuery = useCallback((query: string) => {
    const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
    sendMessage(fakeEvent, query);
  }, []);

  const determineQueryType = (query: string): 'spending' | 'budget' | 'savings' | 'analysis' | 'general' => {
    const lowerQuery = query.toLowerCase();
    if (lowerQuery.includes('spend') || lowerQuery.includes('expense')) return 'spending';
    if (lowerQuery.includes('budget') || lowerQuery.includes('allocat')) return 'budget';
    if (lowerQuery.includes('save') || lowerQuery.includes('saving')) return 'savings';
    if (lowerQuery.includes('analy') || lowerQuery.includes('trend') || lowerQuery.includes('pattern')) return 'analysis';
    return 'general';
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <Card className="p-6">
          <h2 className="text-2xl font-bold mb-4">Please Sign In</h2>
          <p className="text-muted-foreground mb-4">
            You need to sign in to use the chat assistant.
          </p>
          <Button onClick={() => (window.location.href = "/auth")}>
            Sign In
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header
        title="Statement Assistant"
        subtitle="Ask questions about your financial data and get insights"
      />
      <div className="container mx-auto p-2 mt-4 flex-1 max-w-6xl">
        <Card className="flex h-[84vh] flex-col relative">
          <ScrollArea className="flex-1 p-4">
            {isAnalyzing && (
              <div className="flex flex-col items-center justify-center py-8">
                <Brain className="h-8 w-8 text-primary animate-pulse mb-4" />
                <p className="text-muted-foreground">Analyzing your financial data...</p>
              </div>
            )}
            
            {!messages.length && !isAnalyzing && (
              <div className="space-y-6">
                <div className="flex flex-col items-center text-center gap-6 p-6 md:p-10 rounded-xl bg-background border max-w-2xl mx-auto">
                  <div className="relative w-28 h-28 flex items-center justify-center">
                    <div className="absolute inset-0 rounded-full bg-primary/20 animate-pulse blur-xl opacity-70" />
                    <div className="w-28 h-28 rounded-full bg-primary/10 flex items-center justify-center border border-primary/30 shadow-inner backdrop-blur-sm">
                      <Brain className="w-12 h-12 text-primary" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h2 className="text-2xl font-extrabold tracking-tight text-foreground">
                      AI-Powered{" "}
                      <span className="text-primary">Financial Assistant</span>
                    </h2>
                    <p className="text-base text-muted-foreground max-w-md mx-auto">
                      Get personalized financial insights, spending analysis, and smart recommendations based on your transaction patterns.
                    </p>
                  </div>

                  {financialInsights?.personalizedInsights && (
                    <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 border border-blue-200 dark:border-blue-800 p-4 rounded-lg max-w-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="h-4 w-4 text-blue-600" />
                        <strong className="font-medium text-blue-900 dark:text-blue-100">
                          Quick Financial Health Summary
                        </strong>
                      </div>
                      <div className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                        <p>Financial Score: {financialInsights.insights.financialHealthScore.overall}/100</p>
                        <p>Savings Rate: {financialInsights.insights.financialHealthScore.savingsRate.toFixed(1)}%</p>
                        <p>Top Category: {financialInsights.insights.spendingPatterns[0]?.category || 'N/A'}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Suggested Queries */}
                {suggestedQueries.length > 0 && (
                  <div className="max-w-2xl mx-auto">
                    <div className="flex items-center gap-2 mb-3">
                      <Lightbulb className="h-4 w-4 text-amber-500" />
                      <span className="text-sm font-medium text-muted-foreground">
                        Try asking me:
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {suggestedQueries.slice(0, 6).map((query, index) => (
                        <Badge
                          key={index}
                          variant="outline"
                          className="cursor-pointer hover:bg-primary/10 transition-colors"
                          onClick={() => handleSuggestedQuery(query)}
                        >
                          {query}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn("flex", {
                    "justify-end": message.role === "user",
                  })}
                >
                  <div
                    className={cn(
                      "rounded-lg px-4 py-2 max-w-[80%]",
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    )}
                  >
                    {message.role === "assistant" ? (
                      <div className="text-sm prose prose-sm max-w-none dark:prose-invert">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          rehypePlugins={[rehypeHighlight]}
                          components={{
                            // Customize code block styling
                            pre: ({ children }) => (
                              <pre className="bg-gray-100 dark:bg-gray-800 p-3 rounded-md overflow-x-auto">
                                {children}
                              </pre>
                            ),
                            code: ({ children, ...props }) => {
                              const inline = !props.className?.includes('language-');
                              return (
                                <code
                                  className={
                                    inline
                                      ? "bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-sm"
                                      : ""
                                  }
                                  {...props}
                                >
                                  {children}
                                </code>
                              );
                            },
                            // Style tables
                            table: ({ children }) => (
                              <table className="border-collapse border border-gray-300 dark:border-gray-600 w-full">
                                {children}
                              </table>
                            ),
                            th: ({ children }) => (
                              <th className="border border-gray-300 dark:border-gray-600 px-2 py-1 bg-gray-50 dark:bg-gray-700 font-medium">
                                {children}
                              </th>
                            ),
                            td: ({ children }) => (
                              <td className="border border-gray-300 dark:border-gray-600 px-2 py-1">
                                {children}
                              </td>
                            ),
                            // Style lists
                            ul: ({ children }) => (
                              <ul className="list-disc pl-4 space-y-1">
                                {children}
                              </ul>
                            ),
                            ol: ({ children }) => (
                              <ol className="list-decimal pl-4 space-y-1">
                                {children}
                              </ol>
                            ),
                            // Style headings
                            h1: ({ children }) => (
                              <h1 className="text-lg font-bold mb-2">
                                {children}
                              </h1>
                            ),
                            h2: ({ children }) => (
                              <h2 className="text-base font-semibold mb-2">
                                {children}
                              </h2>
                            ),
                            h3: ({ children }) => (
                              <h3 className="text-sm font-medium mb-1">
                                {children}
                              </h3>
                            ),
                            // Style paragraphs
                            p: ({ children }) => (
                              <p className="mb-2 last:mb-0">{children}</p>
                            ),
                            // Style blockquotes
                            blockquote: ({ children }) => (
                              <blockquote className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 italic">
                                {children}
                              </blockquote>
                            ),
                          }}
                        >
                          {message.content}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">
                        {message.content}
                      </p>
                    )}
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-xs opacity-50">
                        {message.timestamp.toLocaleTimeString()}
                      </span>
                      <div className="flex items-center gap-2">
                        {message.queryResult && (
                          <Badge variant="secondary" className="text-xs">
                            {message.queryResult.transactionCount} transactions • ₹{message.queryResult.totalAmount.toLocaleString('en-IN')}
                          </Badge>
                        )}
                        {message.role === "assistant" && message.metrics && (
                          <span className="text-xs opacity-50">
                            {message.metrics.total_time.toFixed(2)}s
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-lg px-4 py-2">
                    <div className="flex space-x-2">
                      <div className="w-2 h-2 bg-current rounded-full animate-bounce" />
                      <div className="w-2 h-2 bg-current rounded-full animate-bounce [animation-delay:0.2s]" />
                      <div className="w-2 h-2 bg-current rounded-full animate-bounce [animation-delay:0.4s]" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          <div className="sticky bottom-0 border-t bg-background">
            <form
              onSubmit={sendMessage}
              className="flex items-center gap-2 p-3"
            >
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear Chat History</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete your entire chat history.
                      This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => {
                        localStorage.removeItem(STORAGE_KEY);
                        setMessages([]);
                        toast({
                          title: "Chat cleared",
                          description: "Your chat history has been cleared.",
                        });
                      }}
                    >
                      Clear Chat
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask anything about your finances - spending patterns, budgets, specific merchants..."
                disabled={isLoading || isAnalyzing}
                autoFocus
                className="flex-1"
              />
              <Button
                type="submit"
                disabled={isLoading || isAnalyzing || !input.trim()}
                onClick={() => setTimeout(() => inputRef.current?.focus(), 0)}
                className="shrink-0"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Send"
                )}
              </Button>
            </form>
          </div>
        </Card>
      </div>
    </div>
  );
}
