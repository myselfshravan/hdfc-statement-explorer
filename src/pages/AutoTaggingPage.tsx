import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useTransactions } from "@/context/TransactionContext";
import { Transaction } from "@/types/transaction";
import { Tag } from "@/types/tags";
import { tagManager } from "@/utils/tagManager";
import { autoTaggingService } from "@/services/AutoTaggingService";
import { bulkTaggingManager, BulkTaggingOperation } from "@/services/BulkTaggingManager";
import { BulkTagReview } from "@/components/BulkTagReview/index";
import { TagSuggestionDialog } from "@/components/TagSuggestionDialog";
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { 
  Sparkles, 
  Play, 
  Settings, 
  TrendingUp, 
  BarChart3,
  Users,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Filter,
  Search,
  Zap,
  Target,
  Brain,
  Activity,
  Loader2
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { SuperStatementManager } from "@/utils/superStatementManager";

// Create singleton instance
const superStatementManager = new SuperStatementManager();

export function AutoTaggingPage() {
  const { user } = useAuth();
  // Track transactions state locally instead of using context
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  // Core state
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [transactionTagsMap, setTransactionTagsMap] = useState<Map<string, Tag[]>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  
  // Dialog state
  const [isBulkReviewOpen, setIsBulkReviewOpen] = useState(false);
  const [isTagSuggestionOpen, setIsTagSuggestionOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  
  // Analytics state
  const [analytics, setAnalytics] = useState({
    totalTransactions: 0,
    taggedTransactions: 0,
    untaggedTransactions: 0,
    averageTagsPerTransaction: 0,
    topCategories: [] as Array<{category: string, count: number}>,
    recentOperations: [] as BulkTaggingOperation[],
    suggestionAccuracy: 0
  });
  
  // Settings state
  const [settings, setSettings] = useState({
    minimumConfidence: 0.7,
    autoApplyHighConfidence: false,
    batchSize: 50,
    enableLearning: true,
    showLowConfidenceSuggestions: true
  });
  
  // Filters state
  const [activeTab, setActiveTab] = useState("overview");
  const [confidenceFilter, setConfidenceFilter] = useState(0.5);
  const [transactionFilter, setTransactionFilter] = useState("untagged");
  const [searchQuery, setSearchQuery] = useState("");

  const { toast } = useToast();


  const setAnalyticsData = (
    allTransactions: Transaction[],
    tagsMap: Map<string, Tag[]>,
    allTags: Tag[]
  ) => {
    const totalTransactions = allTransactions.length;
    const taggedTransactions = Array.from(tagsMap.keys()).length;
    const untaggedTransactions = totalTransactions - taggedTransactions;
    
    let totalTags = 0;
    tagsMap.forEach(tags => totalTags += tags.length);
    const averageTagsPerTransaction = taggedTransactions > 0 ? totalTags / taggedTransactions : 0;

    // Calculate top categories (based on tag usage)
    const categoryCount = new Map<string, number>();
    tagsMap.forEach(tags => {
      tags.forEach(tag => {
        categoryCount.set(tag.name, (categoryCount.get(tag.name) || 0) + 1);
      });
    });
    
    const topCategories = Array.from(categoryCount.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    setAnalytics({
      totalTransactions,
      taggedTransactions,
      untaggedTransactions,
      averageTagsPerTransaction: Number(averageTagsPerTransaction.toFixed(1)),
      topCategories,
      recentOperations: [],
      suggestionAccuracy: 0.85
    });
  };

  const loadData = React.useCallback(async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      const [txns, sum] = await Promise.all([
        superStatementManager.getSuperStatementTransactions(user.id),
        superStatementManager.getSuperStatementSummary(user.id),
      ]);

      if (!txns || txns.length === 0) {
        toast({
          title: "No Transactions",
          description: "Please upload a statement to use auto-tagging features",
          variant: "destructive",
        });
        return;
      }

      // Set transactions from super statement manager
      setTransactions(txns);
      setFilteredTransactions(txns);

      // Load tags and transaction-tag mappings
      const [tags, tagsMap] = await Promise.all([
        tagManager.getUserTags(),
        tagManager.getAllTransactionTags()
      ]);
      
      setAvailableTags(tags);
      setTransactionTagsMap(tagsMap);
      
      // Initialize auto-tagging service
      autoTaggingService.initialize(tags, tagsMap, txns);
      
      // Calculate analytics
      setAnalyticsData(txns, tagsMap, tags);
      
    } catch (error) {
      console.error('Failed to load data:', error);
      toast({
        title: "Error",
        description: "Failed to load transaction data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, loadData]);


  const getFilteredTransactionsForSuggestions = (): Transaction[] => {
    let filtered = transactions;
    
    // Apply transaction filter
    switch (transactionFilter) {
      case "untagged":
        filtered = filtered.filter(t => !transactionTagsMap.has(t.chqRefNumber));
        break;
      case "tagged":
        filtered = filtered.filter(t => transactionTagsMap.has(t.chqRefNumber));
        break;
      case "low_confidence":
        // This would need to be pre-calculated or calculated on demand
        break;
    }
    
    // Apply search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t => 
        t.narration.toLowerCase().includes(query) ||
        t.merchant?.toLowerCase().includes(query) ||
        t.upiId?.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  };

  const openBulkReview = () => {
    const filteredTransactions = getFilteredTransactionsForSuggestions();
    if (filteredTransactions.length === 0) {
      toast({
        title: "No Transactions",
        description: "No transactions match the current filters",
        variant: "destructive",
      });
      return;
    }
    setIsBulkReviewOpen(true);
  };

  const openSuggestionDialog = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setIsTagSuggestionOpen(true);
  };

  const handleBulkTaggingComplete = (operation: BulkTaggingOperation) => {
    // Refresh data after bulk operation
    loadData();
    toast({
      title: "Bulk Tagging Complete",
      description: `Successfully processed ${operation.processedTransactions} transactions`,
    });
  };

  const generateQuickSuggestions = async () => {
    const untaggedTransactions = transactions.filter(t => 
      !transactionTagsMap.has(t.chqRefNumber)
    ).slice(0, 100); // Limit to first 100 for performance

    if (untaggedTransactions.length === 0) {
      toast({
        title: "All Transactions Tagged",
        description: "All transactions already have tags",
      });
      return;
    }

    const highConfidenceSuggestions = autoTaggingService.getHighConfidenceSuggestions(
      untaggedTransactions,
      settings.minimumConfidence
    );

    if (highConfidenceSuggestions.length === 0) {
      toast({
        title: "No High-Confidence Suggestions",
        description: "No transactions found with high-confidence suggestions",
      });
      return;
    }

    toast({
      title: "Quick Suggestions Ready",
      description: `Found ${highConfidenceSuggestions.length} high-confidence suggestions`,
    });

    // Open bulk review with these transactions
    setIsBulkReviewOpen(true);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  if (!user) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center min-h-screen">
        <Card className="p-6 max-w-md">
          <CardHeader>
            <CardTitle>Authentication Required</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Please sign in to access the auto-tagging features.
            </p>
            <Button onClick={() => (window.location.href = "/auth")}>
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading auto-tagging data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Auto-Tagging</h1>
            <p className="text-muted-foreground">
              Intelligent tag suggestions powered by AI
            </p>
          </div>
        </div>
        
        <div className="flex gap-3">
          <Button onClick={generateQuickSuggestions} variant="outline">
            <Zap className="h-4 w-4 mr-2" />
            Quick Suggestions
          </Button>
          <Button onClick={openBulkReview}>
            <Play className="h-4 w-4 mr-2" />
            Bulk Review
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Transactions</p>
                <p className="text-2xl font-bold">{analytics.totalTransactions}</p>
              </div>
              <Activity className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Tagged</p>
                <p className="text-2xl font-bold text-green-600">{analytics.taggedTransactions}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Untagged</p>
                <p className="text-2xl font-bold text-orange-600">{analytics.untaggedTransactions}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Tags/Transaction</p>
                <p className="text-2xl font-bold">{analytics.averageTagsPerTransaction}</p>
              </div>
              <Target className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Tagging Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {analytics.taggedTransactions} of {analytics.totalTransactions} transactions tagged
              </span>
              <span className="text-sm font-medium">
                {((analytics.taggedTransactions / analytics.totalTransactions) * 100).toFixed(1)}%
              </span>
            </div>
            <Progress 
              value={(analytics.taggedTransactions / analytics.totalTransactions) * 100} 
              className="h-2"
            />
          </div>
        </CardContent>
      </Card>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="suggestions">Suggestions</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="h-8 w-8 mx-auto mb-2" />
                <p>No recent auto-tagging activity</p>
                <p className="text-sm">Start by reviewing bulk suggestions or individual transactions</p>
              </div>
            </CardContent>
          </Card>

          {/* Top Categories */}
          {analytics.topCategories.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Top Tag Categories</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analytics.topCategories.map((category, index) => (
                    <div key={category.category} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-muted-foreground">#{index + 1}</span>
                        <Badge variant="outline">{category.category}</Badge>
                      </div>
                      <span className="text-sm text-muted-foreground">{category.count} transactions</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="suggestions" className="space-y-6">
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="transaction-filter">Transaction Type</Label>
                  <Select value={transactionFilter} onValueChange={setTransactionFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Transactions</SelectItem>
                      <SelectItem value="untagged">Untagged Only</SelectItem>
                      <SelectItem value="tagged">Tagged Only</SelectItem>
                      <SelectItem value="low_confidence">Low Confidence Tags</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="confidence-filter">Min Confidence: {confidenceFilter}</Label>
                  <Slider
                    value={[confidenceFilter]}
                    onValueChange={([value]) => setConfidenceFilter(value)}
                    min={0}
                    max={1}
                    step={0.1}
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label htmlFor="search">Search Transactions</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="search"
                      placeholder="Search narration, merchant, UPI..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Suggestion Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>
                Efficiently review and apply tag suggestions to multiple transactions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <Button onClick={openBulkReview}>
                  <Users className="h-4 w-4 mr-2" />
                  Bulk Review ({getFilteredTransactionsForSuggestions().length} transactions)
                </Button>
                
                <Button variant="outline" onClick={generateQuickSuggestions}>
                  <Brain className="h-4 w-4 mr-2" />
                  High Confidence Suggestions
                </Button>
                
                <Button variant="outline" onClick={loadData}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh Data
                </Button>
              </div>
              
              <p className="text-sm text-muted-foreground">
                {analytics.untaggedTransactions} transactions are currently untagged and ready for suggestions.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Tagging Analytics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <BarChart3 className="h-12 w-12 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Analytics Dashboard</h3>
                <p>Detailed analytics and insights about your tagging patterns will appear here.</p>
                <p className="text-sm mt-2">This feature will be enhanced with visual charts and deeper insights.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Auto-Tagging Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="confidence-threshold">
                      Minimum Confidence Threshold: {settings.minimumConfidence}
                    </Label>
                    <span className="text-sm text-muted-foreground">
                      {(settings.minimumConfidence * 100).toFixed(0)}%
                    </span>
                  </div>
                  <Slider
                    value={[settings.minimumConfidence]}
                    onValueChange={([value]) => setSettings(prev => ({ ...prev, minimumConfidence: value }))}
                    min={0.3}
                    max={0.95}
                    step={0.05}
                    className="mt-2"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Only show suggestions above this confidence level
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="auto-apply">Auto-apply High Confidence Tags</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically apply tags with 90%+ confidence
                    </p>
                  </div>
                  <Switch
                    id="auto-apply"
                    checked={settings.autoApplyHighConfidence}
                    onCheckedChange={(checked) => setSettings(prev => ({ ...prev, autoApplyHighConfidence: checked }))}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="enable-learning">Enable Learning</Label>
                    <p className="text-sm text-muted-foreground">
                      Learn from your tagging decisions to improve suggestions
                    </p>
                  </div>
                  <Switch
                    id="enable-learning"
                    checked={settings.enableLearning}
                    onCheckedChange={(checked) => setSettings(prev => ({ ...prev, enableLearning: checked }))}
                  />
                </div>

                <div>
                  <Label htmlFor="batch-size">Batch Size: {settings.batchSize}</Label>
                  <Input
                    id="batch-size"
                    type="number"
                    min="10"
                    max="200"
                    value={settings.batchSize}
                    onChange={(e) => setSettings(prev => ({ ...prev, batchSize: parseInt(e.target.value) || 50 }))}
                    className="mt-1"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Number of transactions to process in each batch
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <BulkTagReview
        isOpen={isBulkReviewOpen}
        onOpenChange={setIsBulkReviewOpen}
        transactions={getFilteredTransactionsForSuggestions()}
        availableTags={availableTags}
        transactionTagsMap={transactionTagsMap}
        onBulkTaggingComplete={handleBulkTaggingComplete}
      />

      {selectedTransaction && (
        <TagSuggestionDialog
          isOpen={isTagSuggestionOpen}
          onOpenChange={setIsTagSuggestionOpen}
          transaction={selectedTransaction}
          availableTags={availableTags}
          currentTags={transactionTagsMap.get(selectedTransaction.chqRefNumber) || []}
          onTagsApplied={() => {
            loadData();
            setIsTagSuggestionOpen(false);
          }}
        />
      )}
    </div>
  );
}
