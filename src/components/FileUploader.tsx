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
        <div
          className={`upload-area ${
            dragActive ? "border-hdfc-blue bg-blue-50/50" : ""
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

          <div className="flex flex-col items-center justify-center gap-3">
            <div className="h-14 w-14 rounded-full bg-blue-50 flex items-center justify-center">
              <UploadCloud className="h-7 w-7 text-hdfc-blue" />
            </div>

            <div className="text-center">
              <p className="text-lg font-medium text-gray-700">
                {selectedFile
                  ? selectedFile.name
                  : "Upload your HDFC Bank Statement"}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Drag & drop or click to select your .xls or .xlsx file
              </p>
            </div>
          </div>
        </div>

        {selectedFile && (
          <div className="mt-6 text-center">
            {isLoading ? (
              <div className="space-y-2">
                <p className="text-sm text-gray-600">
                  Processing your statement...
                </p>
                <Progress value={66} className="h-2" />
              </div>
            ) : (
              <Button
                className="bg-hdfc-blue hover:bg-hdfc-lightBlue"
                onClick={onUploadClick}
              >
                Analyze Statement
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default FileUploader;
