import React, { useRef } from "react";
import { useTransactions } from "@/context/TransactionContext";
import { useAuth } from "@/context/AuthContext";
import { Button } from "./ui/button";
import { Link } from "react-router-dom";
import { UploadCloud, LogOut, LogIn, Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "./ui/sheet";

const AppHeader: React.FC = () => {
  const shimmerStyle = {
    background: "linear-gradient(90deg, #004C8F 25%, #0066CC 50%, #004C8F 75%)",
    backgroundSize: "200% 100%",
    animation: "shimmer 2s infinite linear",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
  };

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
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <header className="bg-gradient-to-b from-white via-gray-50 to-gray-100/95 border-b border-gray-200 shadow-sm backdrop-blur-sm sticky top-0 z-50 max-w-7xl mx-auto">
      <div className="container mx-auto py-2 px-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center w-full sm:w-auto justify-between">
            <div className="flex items-center">
              {/* Logo */}
              <div className="bg-white p-1.5 rounded-xl shadow-md">
                <img
                  src="/icon.png"
                  alt="HDFC Statement Explorer"
                  className="h-8 w-8 sm:h-7 sm:w-7 rounded-lg"
                />
              </div>
              <Link to="/">
                <h1
                  className="ml-3 text-xl sm:text-2xl font-bold truncate bg-clip-text tracking-tight"
                  style={shimmerStyle}
                >
                  HDFC Account Explorer
                </h1>
              </Link>
            </div>
            {/* Mobile Navigation */}
            <div className="sm:hidden">
              <Sheet>
                <SheetTrigger asChild>
                  <Menu size={24} />
                </SheetTrigger>
                <SheetContent>
                  <div className="flex flex-col gap-4 mt-4">
                    <NavigationButtons
                      hasData={hasData}
                      user={user}
                      signOut={signOut}
                      handleUploadClick={handleUploadClick}
                      fileInputRef={fileInputRef}
                      handleFileChange={handleFileChange}
                    />
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden sm:flex flex-row items-center gap-4">
            <NavigationButtons
              hasData={hasData}
              user={user}
              signOut={signOut}
              handleUploadClick={handleUploadClick}
              fileInputRef={fileInputRef}
              handleFileChange={handleFileChange}
            />
          </div>
        </div>
      </div>
    </header>
  );
};

interface NavigationButtonsProps {
  hasData: boolean;
  user: any;
  signOut: () => void;
  handleUploadClick: () => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const NavigationButtons: React.FC<NavigationButtonsProps> = ({
  hasData,
  user,
  signOut,
  handleUploadClick,
  fileInputRef,
  handleFileChange,
}) => {
  return (
    <>
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
            className="bg-gradient-to-r from-hdfc-blue to-hdfc-darkBlue hover:from-hdfc-lightBlue hover:to-hdfc-blue text-white w-full shadow-md hover:shadow-lg transition-all duration-300 rounded-lg font-semibold"
            onClick={handleUploadClick}
          >
            <UploadCloud className="h-4 w-4 mr-2" />
            Upload New
          </Button>
        </>
      )}

      {user ? (
        <>
          <Button
            variant="outline"
            onClick={signOut}
            className="w-full border-hdfc-blue/20 hover:bg-hdfc-blue/5 transition-all duration-300 hover:shadow-md rounded-lg font-medium"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
          <Button
            asChild
            className="bg-hdfc-blue text-white hover:bg-hdfc-darkBlue transition-all duration-300 shadow-md hover:shadow-lg w-full rounded-lg font-semibold"
          >
            <Link to="/analysis">Go to Analysis</Link>
          </Button>
          <Button
            asChild
            className="bg-hdfc-blue text-white hover:bg-hdfc-darkBlue transition-all duration-300 shadow-md hover:shadow-lg w-full rounded-lg font-semibold"
          >
            <Link to="/analysis?month=april">April</Link>
          </Button>
          <Button
            asChild
            className="bg-hdfc-blue text-white hover:bg-hdfc-darkBlue transition-all duration-300 shadow-md hover:shadow-lg w-full rounded-lg font-semibold"
          >
            <Link to="/analysis?month=may">May</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="w-full border-hdfc-blue/20 hover:bg-hdfc-blue/5 transition-all duration-300 hover:shadow-md rounded-lg font-medium"
          >
            <Link to="/tags">Manage Tags</Link>
          </Button>
        </>
      ) : (
        <Button
          variant="outline"
          asChild
          className="w-full border-hdfc-blue/20 hover:bg-hdfc-blue/5 transition-all duration-300 hover:shadow-md rounded-lg font-medium"
        >
          <Link to="/auth" className="w-full">
            <LogIn className="h-4 w-4 mr-2" />
            Sign In
          </Link>
        </Button>
      )}
    </>
  );
};

export default AppHeader;
