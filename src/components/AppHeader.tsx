import React, { useRef, useState } from "react";
import { useTransactions } from "@/context/TransactionContext";
import { useAuth } from "@/context/AuthContext";
import { Button } from "./ui/button";
import { Link, useNavigate } from "react-router-dom";
import {
  UploadCloud,
  LogOut,
  LogIn,
  Menu,
  ChevronDown,
  BarChart,
  Tags,
  MessageCircle,
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "./ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

const AppHeader: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

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

  const handleNavigation = (path: string) => {
    navigate(path);
    setIsOpen(false);
  };

  return (
    <header className="bg-white border-b border-gray-200/20 shadow-sm backdrop-blur-md sticky top-0 z-50">
      <div className="container mx-auto py-2 px-4 max-w-7xl">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center w-full sm:w-auto justify-between">
            <Link to="/dashboard" className="flex items-center">
              <div className="bg-white/60 p-1.5 rounded-xl shadow-sm backdrop-blur-sm border border-gray-200/20">
                <img
                  src="/icon.png"
                  alt="HDFC Statement Analyser Logo"
                  className="h-8 w-8 sm:h-7 sm:w-7 rounded-lg"
                />
              </div>
              <h1
                className="ml-3 text-xl sm:text-2xl font-bold truncate bg-clip-text tracking-tight"
                style={shimmerStyle}
              >
                HDFC Statement Analyser
              </h1>
            </Link>
            {/* Mobile Navigation */}
            <div className="sm:hidden">
              <Sheet open={isOpen} onOpenChange={setIsOpen}>
                <SheetTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="hover:bg-gray-100/10 active:scale-95 transition-all duration-200 rounded-full p-2"
                  >
                    <Menu size={24} />
                  </Button>
                </SheetTrigger>
                <SheetContent
                  className="w-[80%] bg-white border-gray-200/20 backdrop-blur-md"
                  side="right"
                >
                  <nav className="flex flex-col gap-4 mt-4">
                    <NavigationButtons
                      hasData={hasData}
                      user={user}
                      signOut={signOut}
                      handleUploadClick={handleUploadClick}
                      fileInputRef={fileInputRef}
                      handleFileChange={handleFileChange}
                      onNavigate={handleNavigation}
                      isMobile
                    />
                  </nav>
                </SheetContent>
              </Sheet>
            </div>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden sm:flex flex-row items-center gap-3">
            {user ? (
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
                      className="bg-hdfc-blue text-white shadow-sm hover:shadow hover:bg-hdfc-darkBlue active:scale-[0.98] transition-all duration-200 rounded-lg font-semibold"
                      onClick={handleUploadClick}
                    >
                      <UploadCloud className="h-4 w-4 mr-2" />
                      Upload New
                    </Button>
                  </>
                )}

                <Button
                  onClick={() => navigate("/analysis")}
                  className="bg-hdfc-blue text-white shadow-sm hover:shadow hover:bg-hdfc-darkBlue active:scale-[0.98] transition-all duration-200 rounded-lg font-semibold"
                >
                  <BarChart className="h-4 w-4 mr-2" />
                  Analysis
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="border-gray-200 hover:bg-gray-100/10 transition-all duration-200 hover:shadow-sm rounded-lg font-medium"
                    >
                      More
                      <ChevronDown className="h-4 w-4 ml-2" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => navigate("/visualization")}
                    >
                      Flow Visualization
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate("/transactions")}>
                      All Transactions
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate("/chat")}>
                      <MessageCircle className="h-4 w-4 mr-2" />
                      Chat Assistant
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate("/tags")}>
                      <Tags className="h-4 w-4 mr-2" />
                      Manage Tags
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button
                  variant="outline"
                  onClick={signOut}
                  className="border-gray-200 hover:bg-gray-100/10 transition-all duration-200 hover:shadow-sm rounded-lg font-medium"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                onClick={() => navigate("/auth")}
                className="border-gray-200 hover:bg-gray-100/10 transition-all duration-200 hover:shadow-sm rounded-lg font-medium"
              >
                <LogIn className="h-4 w-4 mr-2" />
                Sign In
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

interface NavigationButtonsProps {
  hasData: boolean;
  user: unknown;
  signOut: () => void;
  handleUploadClick: () => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onNavigate: (path: string) => void;
  isMobile?: boolean;
}

const NavigationButtons: React.FC<NavigationButtonsProps> = ({
  hasData,
  user,
  signOut,
  handleUploadClick,
  fileInputRef,
  handleFileChange,
  onNavigate,
  isMobile = false,
}) => {
  return (
    <>
      {user ? (
        <>
          {isMobile && (
            <Button
              onClick={() => onNavigate("/dashboard")}
              variant="outline"
              className="w-full border-gray-200 hover:bg-gray-100/10 transition-all duration-200 hover:shadow-sm rounded-lg font-medium active:scale-[0.98]"
            >
              Dashboard
            </Button>
          )}

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
                className="bg-hdfc-blue text-white w-full shadow-sm hover:shadow hover:bg-hdfc-darkBlue active:scale-[0.98] transition-all duration-200 rounded-lg font-semibold"
                onClick={handleUploadClick}
              >
                <UploadCloud className="h-4 w-4 mr-2" />
                Upload New
              </Button>
            </>
          )}

          <Button
            onClick={() => onNavigate("/analysis")}
            className="bg-hdfc-blue text-white w-full shadow-sm hover:shadow hover:bg-hdfc-darkBlue active:scale-[0.98] transition-all duration-200 rounded-lg font-semibold"
          >
            <BarChart className="h-4 w-4 mr-2" />
            Analysis
          </Button>

          {/* Additional Navigation */}
          <div className="flex flex-col gap-2 w-full">
            <Button
              onClick={() => onNavigate("/visualization")}
              variant="outline"
              className="w-full border-gray-200 hover:bg-gray-100/10 transition-all duration-200 hover:shadow-sm rounded-lg font-medium active:scale-[0.98]"
            >
              Flow Visualization
            </Button>
            <Button
              variant="outline"
              onClick={() => onNavigate("/transactions")}
              className="w-full border-gray-200 hover:bg-gray-100/10 transition-all duration-200 hover:shadow-sm rounded-lg font-medium active:scale-[0.98]"
            >
              All Transactions
            </Button>
            <Button
              variant="outline"
              onClick={() => onNavigate("/tags")}
              className="w-full border-gray-200 hover:bg-gray-100/10 transition-all duration-200 hover:shadow-sm rounded-lg font-medium active:scale-[0.98]"
            >
              <Tags className="h-4 w-4 mr-2" />
              Manage Tags
            </Button>
            <Button
              variant="outline"
              onClick={() => onNavigate("/chat")}
              className="w-full border-gray-200 hover:bg-gray-100/10 transition-all duration-200 hover:shadow-sm rounded-lg font-medium active:scale-[0.98]"
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              Chat Assistant
            </Button>
          </div>

          <Button
            variant="outline"
            onClick={signOut}
            className="w-full border-gray-200 hover:bg-gray-100/10 transition-all duration-200 hover:shadow-sm rounded-lg font-medium active:scale-[0.98]"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </>
      ) : (
        <Button
          variant="outline"
          onClick={() => onNavigate("/auth")}
          className="w-full border-gray-200 hover:bg-gray-100/10 transition-all duration-200 hover:shadow-sm rounded-lg font-medium active:scale-[0.98]"
        >
          <LogIn className="h-4 w-4 mr-2" />
          Sign In
        </Button>
      )}
    </>
  );
};

export default AppHeader;
