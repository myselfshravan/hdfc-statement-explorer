import React from "react";
import { TransactionProvider } from "@/context/TransactionContext";
import Dashboard from "@/components/Dashboard";

const DashboardPage = () => {
  return (
    <TransactionProvider>
      <div className="flex flex-col min-h-screen bg-gray-50">
        <main className="flex-1 md:p-6">
          <div className="mx-auto">
            <Dashboard />
          </div>
        </main>

        <footer className="py-6 bg-white border-t border-gray-200">
          <div className="container mx-auto px-4 flex flex-col sm:flex-row items-center justify-between text-sm text-gray-500">
            <div className="text-center sm:text-left">
              <span className="font-medium">HDFC Statement Analyser</span> -
              Explore your bank statements with ease.
            </div>
            <div className="mt-2 sm:mt-0 text-center sm:text-right">
              Built with ❤️‍🔥 by{" "}
              <a
                href="https://myselfshravan.github.io/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline font-medium"
              >
                Shravan Revanna
              </a>
            </div>
          </div>
        </footer>
      </div>
    </TransactionProvider>
  );
};

export default DashboardPage;
