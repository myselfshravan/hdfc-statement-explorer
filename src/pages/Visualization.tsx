import React, { useState, useMemo, useEffect } from 'react';
import { useTransactions } from '@/context/TransactionContext';
import { SuperStatementManager } from '@/utils/superStatementManager';
import { useAuth } from '@/context/AuthContext';
import { Transaction } from '@/types/transaction';
import { Card } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { ChartContainer } from '@/components/ui/chart';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  Area,
  ComposedChart
} from 'recharts';

type GroupBy = 'daily' | 'weekly' | 'monthly';

// Helper to format currency
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR'
  }).format(amount);
};

// Helper to format date
const formatDate = (date: Date) => {
  return new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(date);
};

const superStatementManager = new SuperStatementManager();

export default function Visualization() {
  const { user } = useAuth();
  const { dateRange, setDateRange } = useTransactions();
  const [groupBy, setGroupBy] = useState<GroupBy>('monthly');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Load transactions data
  useEffect(() => {
    const loadSuperStatement = async () => {
      if (!user) return;

      try {
        const txns = await superStatementManager.getSuperStatementTransactions(user.id);
        setTransactions(txns);
      } catch (error) {
        console.error("Error loading super statement:", error);
      } finally {
        setLoading(false);
      }
    };

    loadSuperStatement();
  }, [user]);

  // Filter transactions by date range
  const filteredTransactions = useMemo(() => {
    if (!dateRange) return transactions;
    
    return transactions.filter(tx => 
      tx.date >= dateRange.from && 
      (!dateRange.to || tx.date <= dateRange.to)
    );
  }, [transactions, dateRange]);

  const chartData = useMemo(() => {
    const groupedData = new Map<string, { credit: number; debit: number }>();

    filteredTransactions.forEach(tx => {
      let key: string;
      const date = tx.date;

      switch (groupBy) {
        case 'daily':
          key = formatDate(date);
          break;
        case 'weekly': {
          const startOfWeek = new Date(date);
          startOfWeek.setDate(date.getDate() - date.getDay());
          key = `Week of ${formatDate(startOfWeek)}`;
          break;
        }
        case 'monthly':
          key = new Intl.DateTimeFormat('en-GB', { 
            year: 'numeric',
            month: 'short'
          }).format(date);
          break;
      }

      if (!groupedData.has(key)) {
        groupedData.set(key, { credit: 0, debit: 0 });
      }
      const data = groupedData.get(key)!;

      if (tx.type === 'credit') {
        data.credit += tx.amount;
      } else {
        data.debit += tx.amount;
      }
    });

    return Array.from(groupedData.entries())
      .map(([date, values]) => ({
        date,
        ...values
      }))
      .sort((a, b) => {
        // Sort chronologically
        const aDate = new Date(a.date);
        const bDate = new Date(b.date);
        return aDate.getTime() - bDate.getTime();
      });
  }, [filteredTransactions, groupBy]);

  const chartConfig = {
    credit: {
      label: 'Credit',
      theme: {
        light: 'hsl(142.1 76.2% 36.3%)',  // Green
        dark: 'hsl(142.1 70.6% 45.3%)'
      }
    },
    debit: {
      label: 'Debit', 
      theme: {
        light: 'hsl(346.8 77.2% 49.8%)',  // Red
        dark: 'hsl(346.8 77.2% 49.8%)'
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-100 via-white to-purple-100 p-2 md:p-8">
      <div className="max-w-7xl mx-auto space-y-4 md:space-y-8">
        {/* Header */}
        <div className="relative backdrop-blur-2xl bg-white/40 rounded-2xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-white/40">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-200/20 via-purple-100/20 to-blue-100/20 rounded-2xl opacity-80" />
          <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Transaction Flow
            </h1>
            
            <div className="flex items-center gap-4">
              <Select
                value={groupBy}
                onValueChange={(value: GroupBy) => setGroupBy(value)}
              >
                <SelectTrigger className="w-[180px] border-white/40 bg-white/60 backdrop-blur-sm">
                  <SelectValue placeholder="Group by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-6">
          {/* Left side: Calendar */}
          <Card className="md:col-span-1 p-6 relative overflow-hidden backdrop-blur-2xl bg-white/40 border border-white/40 shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-200/20 via-purple-100/20 to-blue-100/20 opacity-80" />
            <div className="relative">
              <h2 className="text-lg font-semibold mb-4">Date Range</h2>
              <div className="overflow-hidden">
                <Calendar
                  mode="range"
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={1}
                  className="rounded-xl border-white/40 bg-white/60 backdrop-blur-sm scale-[0.85] sm:scale-100 -ml-4 sm:ml-0 w-[calc(100%+2rem)] sm:w-full"
                />
              </div>
            </div>
          </Card>

          {/* Right side: Chart */}
          <Card className="md:col-span-3 p-6 relative overflow-hidden backdrop-blur-2xl bg-white/40 border border-white/40 shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-200/20 via-purple-100/20 to-blue-100/20 opacity-80" />
            <div className="relative">
              <h2 className="text-lg font-semibold mb-4">Credit vs Debit Flow</h2>
              <div className="h-[300px] sm:h-[400px] md:h-[500px]">
                <ChartContainer config={chartConfig}>
              <ComposedChart data={chartData} margin={{ top: 20, right: 10, left: 10, bottom: 60 }}>
                <defs>
                  <linearGradient id="creditGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(142.1 76.2% 36.3%)" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="hsl(142.1 76.2% 36.3%)" stopOpacity={0.05}/>
                  </linearGradient>
                  <linearGradient id="debitGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(346.8 77.2% 49.8%)" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="hsl(346.8 77.2% 49.8%)" stopOpacity={0.05}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.3} />
                <XAxis 
                  dataKey="date"
                  angle={-45}
                  textAnchor="end"
                  height={60}
                  stroke="#64748b"
                  fontSize={10}
                  tickLine={false}
                  tick={{ fontSize: '0.7rem', transform: 'translate(0, 10)' }}
                  interval="preserveStartEnd"
                />
                <YAxis 
                  tickFormatter={(value) => formatCurrency(value)}
                  stroke="#64748b"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: '0.7rem' }}
                  width={80}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    
                    return (
                      <div className="bg-white/80 backdrop-blur-xl border border-white/40 rounded-xl shadow-lg p-3 text-xs sm:text-sm sm:p-4 max-w-[200px] sm:max-w-none">
                        <div className="font-medium mb-1 sm:mb-2">{payload[0].payload.date}</div>
                        {payload.map((entry, index) => (
                          <div 
                            key={index}
                            className="flex justify-between items-center gap-2 sm:gap-4"
                          >
                            <span className={entry.name === 'credit' ? 'text-green-600' : 'text-red-600'}>
                              {entry.name === 'credit' ? 'Credit' : 'Debit'}:
                            </span>
                            <span className="font-medium tabular-nums">
                              {formatCurrency(entry.value as number)}
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  }}
                />
                <Area 
                  type="monotone"
                  dataKey="credit"
                  fill="url(#creditGradient)"
                  stroke="hsl(142.1 76.2% 36.3%)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{
                    r: 4,
                    fill: "hsl(142.1 76.2% 36.3%)",
                    stroke: "white",
                    strokeWidth: 2,
                  }}
                />
                <Area 
                  type="monotone"
                  dataKey="debit"
                  fill="url(#debitGradient)"
                  stroke="hsl(346.8 77.2% 49.8%)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{
                    r: 4,
                    fill: "hsl(346.8 77.2% 49.8%)",
                    stroke: "white",
                    strokeWidth: 2,
                  }}
                />
                <Legend 
                  verticalAlign="top" 
                  height={36}
                  formatter={(value) => value.charAt(0).toUpperCase() + value.slice(1)}
                />
                </ComposedChart>
                </ChartContainer>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
