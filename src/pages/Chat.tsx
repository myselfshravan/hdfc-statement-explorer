import React, { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { SuperStatementManager } from "@/utils/superStatementManager";
import { Transaction, StatementSummary } from "@/types/transaction";
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
import { Loader2, Trash2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github.css";

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
}

interface ApiMessage {
  role: string;
  content: string;
}

const STORAGE_KEY = "statement-chat-history";

// Debug helper
const debugLog = (
  label: string,
  data: Record<string, unknown> | StatementSummary | null | undefined
) => {
  console.log(
    `%c[Chat Debug] ${label}`,
    "color: #0066CC; font-weight: bold",
    data
  );
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(amount);
};

function getStatementContext(summary: StatementSummary | null) {
  debugLog("Summary Data:", summary);

  if (!summary) return "";

  return `
    Statement Summary:
    - Time Period: ${summary.startDate.toLocaleDateString()} to ${summary.endDate.toLocaleDateString()}
    - Total Credit: ${formatCurrency(summary.totalCredit)}
    - Total Debit: ${formatCurrency(summary.totalDebit)}
    - Net Cashflow: ${formatCurrency(summary.netCashflow)}
    - Transaction Count: ${summary.transactionCount} (${
    summary.creditCount
  } credits, ${summary.debitCount} debits)
    - Starting Balance: ${formatCurrency(summary.startingBalance)}
    - Ending Balance: ${formatCurrency(summary.endingBalance)}
  `;
}

const getRecentContext = (
  messages: Message[],
  summary: StatementSummary | null
): ApiMessage[] => {
  // Get last 3 pairs (6 messages) for context
  const contextMessages = messages.slice(-6);

  const statementContext = summary ? getStatementContext(summary) : "";

  return [
    {
      role: "system",
      content: `You are a helpful financial assistant analyzing bank statements.
      Your goal is to help users understand their spending patterns and provide financial insights.
      
      Current Statement Context:
      ${statementContext}
      
      Always format currency values in Indian Rupees (INR).
      Be concise but informative in your responses.
      If asked about specific transactions or patterns not covered in the summary, politely explain that you only have access to summary-level data.`,
    },
    ...contextMessages.map(({ role, content }) => ({ role, content })),
  ];
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
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load statement data on mount
  useEffect(() => {
    const loadStatementData = async () => {
      if (!user) return;

      try {
        const superStatementManager = new SuperStatementManager();
        const [transactions, fetchedSummary] = await Promise.all([
          superStatementManager.getSuperStatementTransactions(user.id),
          superStatementManager.getSuperStatementSummary(user.id),
        ]);

        // Convert date strings to Date objects
        const summary = fetchedSummary
          ? {
              ...fetchedSummary,
              startDate: new Date(fetchedSummary.startDate),
              endDate: new Date(fetchedSummary.endDate),
            }
          : null;

        debugLog("Loaded Data:", {
          transactions: transactions.length,
          summary,
          rawSummary: fetchedSummary,
        });

        setStatementData({
          transactions: transactions.map((t) => ({
            ...t,
            date: new Date(t.date),
            valueDate: new Date(t.valueDate),
          })),
          summary,
        });
      } catch (error) {
        console.error("Error loading statement data:", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load statement data.",
        });
      }
    };

    loadStatementData();
  }, [user, toast]);

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

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      content: input.trim(),
      role: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    inputRef.current?.focus();
    setIsLoading(true);

    try {
      const apiPayload = {
        model: "llama-3.3-70b-versatile",
        messages: [
          ...getRecentContext(messages, statementData.summary),
          { role: "user", content: userMessage.content },
        ],
      };
      debugLog("API Request Payload:", apiPayload);

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
      debugLog("API Response:", data);

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        content: data.choices[0].message.content,
        role: "assistant",
        timestamp: new Date(),
        metrics: {
          total_time: data.usage.total_time,
          queue_time: data.usage.queue_time,
          prompt_time: data.usage.prompt_time,
          completion_time: data.usage.completion_time,
        },
      };

      setMessages((prev) => [...prev, assistantMessage]);
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
            {!messages.length && (
              <div className="flex flex-col items-center text-center gap-6 p-6 md:p-10 rounded-xl bg-background border max-w-lg mx-auto">
                <div className="relative w-28 h-28 flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full bg-primary/20 animate-pulse blur-xl opacity-70" />
                  <div className="w-28 h-28 rounded-full bg-primary/10 flex items-center justify-center border border-primary/30 shadow-inner backdrop-blur-sm">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="w-12 h-12 text-primary"
                    >
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                  </div>
                </div>

                <div className="space-y-2">
                  <h2 className="text-2xl font-extrabold tracking-tight text-foreground">
                    Welcome to{" "}
                    <span className="text-primary">Statement Assistant</span>
                  </h2>
                  <p className="text-base text-muted-foreground max-w-sm mx-auto">
                    Ask me questions about your statement data and I'll help you
                    understand your finances better.
                  </p>
                </div>

                <div className="bg-muted/50 border border-border p-4 rounded-lg text-sm text-muted-foreground max-w-sm shadow-sm">
                  <strong className="font-medium text-foreground">
                    Examples:
                  </strong>
                  <ul className="mt-2 space-y-1">
                    <li>• "What's my total credit for this period?"</li>
                    <li>• "How many transactions are there?"</li>
                    <li>• "What's my net cashflow?"</li>
                  </ul>
                </div>
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
                      {message.role === "assistant" && message.metrics && (
                        <span className="text-xs opacity-50 ml-2">
                          {message.metrics.total_time.toFixed(2)}s
                        </span>
                      )}
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
                placeholder="Ask a question about your statement..."
                disabled={isLoading}
                autoFocus
                className="flex-1"
              />
              <Button
                type="submit"
                disabled={isLoading || !input.trim()}
                onClick={() => setTimeout(() => inputRef.current?.focus(), 0)}
                className="shrink-0"
              >
                Send
              </Button>
            </form>
          </div>
        </Card>
      </div>
    </div>
  );
}
