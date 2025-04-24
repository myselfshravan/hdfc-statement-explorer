import React, { useRef } from "react";
import { useTransactions } from "@/context/TransactionContext";
import { useAuth } from "@/context/AuthContext";
import { Button } from "./ui/button";
import { Link } from "react-router-dom";
import { UploadCloud, LogOut, LogIn } from "lucide-react";

const AppHeader: React.FC = () => {
  const { transactions, uploadAndParseStatement } = useTransactions();
  const { user, signOut } = useAuth();
  const hasData = transactions.length > 0;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await uploadAndParseStatement(file);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <header className="bg-white border-b border-gray-200">
      <div className="container mx-auto p-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center w-full sm:w-auto justify-center sm:justify-start">
            <img
              src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 48 48' fill='none'%3E%3Crect width='48' height='48' rx='8' fill='%23004C8F'/%3E%3Cpath d='M12 18H36V28C36 29.1046 35.1046 30 34 30H14C12.8954 30 12 29.1046 12 28V18Z' fill='white'/%3E%3Cpath d='M17 15H31V22H17V15Z' fill='%23ED232A'/%3E%3C/svg%3E"
              alt="HDFC Logo"
              className="h-8 w-8 sm:h-10 sm:w-10"
            />
            <h1 className="ml-3 text-lg sm:text-xl font-bold text-hdfc-blue truncate">
              HDFC Account Explorer
            </h1>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 w-full sm:w-auto">
            {hasData && (
              <>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".xls,.xlsx"
                  className="hidden"
                />
                <Button 
                  className="bg-hdfc-blue hover:bg-hdfc-lightBlue w-full sm:w-auto"
                  onClick={handleUploadClick}
                >
                  <UploadCloud className="h-4 w-4 mr-2" />
                  Upload New
                </Button>
              </>
            )}

            {user ? (
              <Button
                variant="ghost"
                onClick={signOut}
                className="w-full sm:w-auto"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            ) : (
              <Button variant="outline" asChild className="w-full sm:w-auto">
                <Link to="/auth" className="w-full">
                  <LogIn className="h-4 w-4 mr-2" />
                  Sign In
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
