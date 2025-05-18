import React from "react";
import FileUploader from "./FileUploader";
import { SavedStatements } from "./SavedStatements";

const Dashboard: React.FC = () => {
  return (
    <div className="flex flex-col gap-8 pt-10 px-4 md:px-8 lg:max-w-6xl lg:mx-auto">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-3">
          HDFC Statement Analysis
        </h1>
        <p className="text-lg text-gray-600">
          Upload your HDFC bank statement to get instant insights into your
          transactions
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border p-8">
        <div className="flex flex-col items-center justify-center w-full">
          <h2 className="text-xl font-semibold mb-6">Start Your Analysis</h2>
          <FileUploader />
        </div>
      </div>

      <div className="flex items-center justify-center">
        <SavedStatements />
      </div>
    </div>
  );
};

export default Dashboard;
