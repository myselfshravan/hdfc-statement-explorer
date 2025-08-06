import { Transaction, StatementSummary } from "@/types/transaction";

// Sample merchant names and UPI IDs for realistic data
const sampleMerchants = [
  { merchant: "Swiggy", upiId: "swiggy@paytm" },
  { merchant: "Zomato", upiId: "zomato@paytm" },
  { merchant: "Amazon Pay", upiId: "amazonpay@ybl" },
  { merchant: "Flipkart", upiId: "flipkart@phonepe" },
  { merchant: "BigBasket", upiId: "bigbasket@ybl" },
  { merchant: "Uber", upiId: "uber@paytm" },
  { merchant: "Ola", upiId: "ola@ybl" },
  { merchant: "Paytm", upiId: "paytm@paytm" },
  { merchant: "PhonePe", upiId: "phonepe@ybl" },
  { merchant: "Razorpay", upiId: "razorpay@ybl" }
];

const sampleNarrations = [
  { narration: "UPI-SALARY-MYCOMPANY-SALARY FOR JANUARY", type: "credit", amount: 85000 },
  { narration: "UPI-Swiggy-swiggy@paytm-FOOD ORDER", type: "debit", amount: 450 },
  { narration: "UPI-Zomato-zomato@paytm-FOOD DELIVERY", type: "debit", amount: 380 },
  { narration: "UPI-Amazon Pay-amazonpay@ybl-ONLINE PURCHASE", type: "debit", amount: 1250 },
  { narration: "UPI-Flipkart-flipkart@phonepe-SHOPPING", type: "debit", amount: 2100 },
  { narration: "UPI-BigBasket-bigbasket@ybl-GROCERY", type: "debit", amount: 1800 },
  { narration: "UPI-Uber-uber@paytm-CAB RIDE", type: "debit", amount: 180 },
  { narration: "UPI-Ola-ola@ybl-CAB BOOKING", type: "debit", amount: 220 },
  { narration: "ATM WDL TXN DATE 15/01/24 HDFC BANK ATM", type: "debit", amount: 5000 },
  { narration: "NEFT INWARD-RENT REFUND-LANDLORD", type: "credit", amount: 8000 },
  { narration: "IMPS INWARD-FREELANCE PAYMENT-CLIENT", type: "credit", amount: 15000 },
  { narration: "UPI-Paytm-paytm@paytm-MOBILE RECHARGE", type: "debit", amount: 299 },
  { narration: "UPI-PhonePe-phonepe@ybl-ELECTRICITY BILL", type: "debit", amount: 1200 },
  { narration: "NACH DEBIT-MUTUAL FUND SIP-SBI MF", type: "debit", amount: 5000 },
  { narration: "INTEREST CREDIT AS ON 31/01/24", type: "credit", amount: 125 },
  { narration: "UPI-Netflix-netflix@paytm-SUBSCRIPTION", type: "debit", amount: 649 },
  { narration: "UPI-Spotify-spotify@ybl-MUSIC SUBSCRIPTION", type: "debit", amount: 119 },
  { narration: "DEBIT CARD PURCHASE AT SUPERMARKET", type: "debit", amount: 2400 },
  { narration: "UPI-BookMyShow-bookmyshow@paytm-MOVIE TICKETS", type: "debit", amount: 800 },
  { narration: "UPI-Petrol Pump-petrolpump@ybl-FUEL", type: "debit", amount: 3500 }
];

const getRandomDate = (start: Date, end: Date): Date => {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
};

const getRandomNarration = () => {
  return sampleNarrations[Math.floor(Math.random() * sampleNarrations.length)];
};

const extractUPIDetailsFromSample = (narration: string) => {
  const match = narration.match(/UPI-([A-Za-z\s]+)-(.+?)-/);
  if (match) {
    return {
      upiId: match[2].trim(),
      merchant: match[1].trim(),
    };
  }
  return { upiId: undefined, merchant: undefined };
};

export const generateSampleStatement = (): {
  transactions: Transaction[];
  summary: StatementSummary;
} => {
  const transactions: Transaction[] = [];
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 3); // 3 months ago
  const endDate = new Date();
  
  let currentBalance = 50000; // Starting balance
  const transactionCount = 60; // Generate 60 transactions
  
  for (let i = 0; i < transactionCount; i++) {
    const randomNarration = getRandomNarration();
    const date = getRandomDate(startDate, endDate);
    const { upiId, merchant } = extractUPIDetailsFromSample(randomNarration.narration);
    
    // Add some randomness to amounts (±20%)
    const baseAmount = randomNarration.amount;
    const variance = baseAmount * 0.2;
    const amount = baseAmount + (Math.random() - 0.5) * variance;
    const roundedAmount = Math.round(amount);
    
    const isCredit = randomNarration.type === "credit";
    
    if (isCredit) {
      currentBalance += roundedAmount;
    } else {
      currentBalance -= roundedAmount;
    }
    
    const transaction: Transaction = {
      date,
      narration: randomNarration.narration,
      valueDate: date,
      debitAmount: isCredit ? 0 : roundedAmount,
      creditAmount: isCredit ? roundedAmount : 0,
      chqRefNumber: Math.random().toString(36).substring(2, 10).toUpperCase(),
      closingBalance: currentBalance,
      amount: roundedAmount,
      type: isCredit ? "credit" : "debit",
      category: isCredit ? "Deposit" : "Withdrawal",
      upiId,
      merchant,
      statementId: `SAMPLE_${Math.random().toString(36).substring(2, 15)}`,
    };
    
    transactions.push(transaction);
  }
  
  // Sort transactions by date
  transactions.sort((a, b) => a.date.getTime() - b.date.getTime());
  
  // Recalculate balances in chronological order
  let runningBalance = 50000;
  transactions.forEach((transaction) => {
    if (transaction.type === "credit") {
      runningBalance += transaction.amount;
    } else {
      runningBalance -= transaction.amount;
    }
    transaction.closingBalance = runningBalance;
  });
  
  // Calculate summary
  const totalDebit = transactions.reduce((sum, t) => sum + t.debitAmount, 0);
  const totalCredit = transactions.reduce((sum, t) => sum + t.creditAmount, 0);
  const firstTransaction = transactions[0];
  const lastTransaction = transactions[transactions.length - 1];
  
  const summary: StatementSummary = {
    totalDebit,
    totalCredit,
    netCashflow: totalCredit - totalDebit,
    startDate: firstTransaction.date,
    endDate: lastTransaction.date,
    startingBalance: 50000,
    endingBalance: lastTransaction.closingBalance,
    transactionCount: transactions.length,
    creditCount: transactions.filter((t) => t.type === "credit").length,
    debitCount: transactions.filter((t) => t.type === "debit").length,
  };
  
  return { transactions, summary };
};

// Function to load sample data into anonymous mode
export const loadSampleData = (): void => {
  const sampleData = generateSampleStatement();
  localStorage.setItem('anonymousStatement', JSON.stringify({
    ...sampleData,
    timestamp: Date.now()
  }));
};