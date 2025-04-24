
import React from 'react';
import { useTransactions } from '@/context/TransactionContext';
import FileUploader from './FileUploader';
import SummaryStats from './SummaryStats';
import TransactionList from './TransactionList';

const Dashboard: React.FC = () => {
  const { transactions, summary } = useTransactions();
  const hasData = transactions.length > 0;
  
  return (
    <div className="flex flex-col gap-6 w-full">
      {!hasData && (
        <div className="flex items-center justify-center pt-10">
          <FileUploader />
        </div>
      )}
      
      {hasData && (
        <>
          <SummaryStats />
          <TransactionList />
        </>
      )}
    </div>
  );
};

export default Dashboard;
