import React from "react";
import FileUploader from "./FileUploader";
import { SavedStatements } from "./SavedStatements";

const Dashboard: React.FC = () => {
  return (
    <div className="grid grid-cols-1 gap-6 pt-10 px-4 md:px-0">
      <div className="flex items-center justify-center w-full">
        <FileUploader />
      </div>
      <div className="flex items-center justify-center">
        <SavedStatements />
      </div>
    </div>
  );
};

export default Dashboard;
