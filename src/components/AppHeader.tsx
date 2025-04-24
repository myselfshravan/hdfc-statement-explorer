
import React from 'react';
import { useTransactions } from '@/context/TransactionContext';
import FileUploader from './FileUploader';
import { Button } from './ui/button';
import { UploadCloud } from 'lucide-react';

const AppHeader: React.FC = () => {
  const { transactions } = useTransactions();
  const hasData = transactions.length > 0;
  
  return (
    <header className="bg-white border-b border-gray-200">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center">
          <img 
            src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 48 48' fill='none'%3E%3Crect width='48' height='48' rx='8' fill='%23004C8F'/%3E%3Cpath d='M12 18H36V28C36 29.1046 35.1046 30 34 30H14C12.8954 30 12 29.1046 12 28V18Z' fill='white'/%3E%3Cpath d='M17 15H31V22H17V15Z' fill='%23ED232A'/%3E%3C/svg%3E" 
            alt="HDFC Logo" 
            className="h-10 w-10"
          />
          <h1 className="ml-3 text-xl font-bold text-hdfc-blue">HDFC Account Explorer</h1>
        </div>
        
        {hasData && (
          <Button className="bg-hdfc-blue hover:bg-hdfc-lightBlue">
            <UploadCloud className="h-4 w-4 mr-2" />
            Upload New Statement
          </Button>
        )}
      </div>
    </header>
  );
};

export default AppHeader;
