import React from "react";
import Dashboard from "@/components/Dashboard";

const Index = () => {
  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <main className="flex-1 md:p-6">
        <div className="mx-auto">
          <Dashboard />
        </div>
      </main>

      <footer className="py-4 bg-white border-t border-gray-200">
        <div className="mx-auto px-4 text-center text-sm text-gray-500">
          HDFC Account Explorer — Analyze your bank statements with ease
        </div>
      </footer>
    </div>
  );
};

export default Index;
