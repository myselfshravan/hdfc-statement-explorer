import React, { useState, useRef } from "react";
import { useTransactions } from "@/context/TransactionContext";
import { Button } from "@/components/ui/button";
import { UploadCloud } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

const FileUploader: React.FC = () => {
  const { uploadAndParseStatement, isLoading } = useTransactions();
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      handleFile(files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();

    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    setSelectedFile(file);
  };

  const onUploadClick = async () => {
    if (!selectedFile) return;
    await uploadAndParseStatement(selectedFile);
  };

  const openFileSelector = () => {
    if (inputRef.current) {
      inputRef.current.click();
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardContent className="pt-6">
        <div className="space-y-6">
          <div
            className={`border-2 border-dashed rounded-lg p-8 transition-colors cursor-pointer ${
              dragActive
                ? "border-blue-500 bg-blue-50/50"
                : "border-gray-300 hover:border-gray-400"
            }`}
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={openFileSelector}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".xls,.xlsx"
              onChange={handleChange}
              className="hidden"
            />

            <div className="flex flex-col items-center justify-center gap-4">
              <div className="h-16 w-16 rounded-full bg-blue-50 flex items-center justify-center">
                <UploadCloud className="h-8 w-8 text-blue-600" />
              </div>

              <div className="text-center space-y-2">
                <p className="text-lg font-medium text-gray-700">
                  {selectedFile
                    ? selectedFile.name
                    : "Choose your HDFC Bank Statement"}
                </p>
                <p className="text-sm text-gray-500">
                  Drag & drop or click to select your .xls or .xlsx file
                </p>
              </div>
            </div>
          </div>

          {selectedFile ? (
            <div className="space-y-4">
              {isLoading ? (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600 text-center">
                    Processing your statement...
                  </p>
                  <Progress value={66} className="h-2" />
                </div>
              ) : (
                <div className="space-y-3">
                  <Button
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                    size="lg"
                    onClick={onUploadClick}
                  >
                    Analyze Statement
                  </Button>
                  <p className="text-xs text-gray-500 text-center">
                    You'll see a complete analysis of your transactions,
                    including spending patterns, credits, debits, and more
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center space-y-2">
              <p className="text-sm text-gray-600">Analysis includes:</p>
              <div className="flex justify-center gap-4 text-sm text-gray-600">
                <span>✓ Transaction Summary</span>
                <span>✓ Net Cashflow</span>
                <span>✓ Spending Patterns</span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default FileUploader;
