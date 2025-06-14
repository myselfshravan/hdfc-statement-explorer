import React, { useState, useRef } from "react";
import { useTransactions } from "@/context/TransactionContext";
import { Button } from "@/components/ui/button";
import { UploadCloud, CheckCircle2, FileSpreadsheet, X, LogIn, Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { Link, useNavigate } from "react-router-dom";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { parseHdfcStatement } from "@/utils/statementParser";

const FileUploader: React.FC = () => {
  const { uploadAndParseStatement, isLoading } = useTransactions();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleDrag = (e: React.DragEvent) => {
    if (!isAnonymous && !user) return;
    
    e.preventDefault();
    e.stopPropagation();

    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    if (!isAnonymous && !user) return;

    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      handleFile(files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isAnonymous && !user) return;

    e.preventDefault();

    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    setSelectedFile(file);
    setUploadSuccess(false);
    setUploadProgress(0);
  };

  const onUploadClick = async () => {
    if (!selectedFile) return;
    if (!isAnonymous && !user) return;
    
    try {
      setUploadProgress(0);
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 500);

      if (isAnonymous) {
        // Parse and store in localStorage for anonymous mode
        const result = await parseHdfcStatement(selectedFile);
        localStorage.setItem('anonymousStatement', JSON.stringify({
          ...result,
          timestamp: Date.now()
        }));
        clearInterval(progressInterval);
        setUploadProgress(100);
        setUploadSuccess(true);
        navigate('/anonymous-analysis');
      } else {
        // Let TransactionContext handle parsing and uploading
        await uploadAndParseStatement(selectedFile);
        clearInterval(progressInterval);
        setUploadProgress(100);
        setUploadSuccess(true);
        
        toast({
          title: "Statement uploaded successfully!",
          description: "Click 'Analyze Statement' to process your data.",
        });
      }
    } catch (error) {
      toast({
        title: "Upload failed",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  const openFileSelector = () => {
    if (!isAnonymous && !user) return;
    
    if (inputRef.current) {
      inputRef.current.click();
    }
  };

  const clearFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedFile(null);
    setUploadSuccess(false);
    setUploadProgress(0);
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardContent className="pt-6">
        {!user && !isAnonymous ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between px-2">
              <div className="space-y-0.5">
                <h4 className="text-sm font-medium text-gray-700">Anonymous Mode</h4>
                <p className="text-xs text-gray-500">Analyze statements without signing in</p>
              </div>
              <Switch
                checked={isAnonymous}
                onCheckedChange={setIsAnonymous}
              />
            </div>
            <div className="text-center p-6 space-y-4">
              <div className="h-14 w-14 rounded-full bg-blue-50 flex items-center justify-center mx-auto">
                <LogIn className="h-7 w-7 text-hdfc-blue" />
              </div>
              <div>
                <p className="text-lg font-medium text-gray-700 mb-2">
                  Sign in to Upload Statements
                </p>
                <p className="text-sm text-gray-500 mb-4">
                  Sign in to save your statements and access advanced features
                </p>
                <Button asChild variant="default" className="bg-hdfc-blue hover:bg-hdfc-lightBlue">
                  <Link to="/auth">Sign In</Link>
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <>
            {isAnonymous && (
              <Alert className="mb-4 border-yellow-500 bg-yellow-50">
                <Info className="h-4 w-4 text-yellow-600" />
                <AlertDescription className="text-yellow-800">
                  You are in anonymous mode. Your statement data will be stored locally and will be lost when you clear your browser data.
                </AlertDescription>
              </Alert>
            )}
            <div
              className={cn(
                "rounded-lg p-4 transition-all duration-200 ease-in-out",
                !selectedFile && "border-2 border-dashed cursor-pointer",
                dragActive
                  ? "border-hdfc-blue bg-blue-50/50 scale-102"
                  : !selectedFile && "border-gray-300 hover:border-hdfc-blue hover:bg-gray-50",
                selectedFile && "bg-gray-50"
              )}
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
                <div className="relative">
                  <div className="h-14 w-14 rounded-full bg-blue-50 flex items-center justify-center transition-all duration-200">
                  {uploadSuccess ? (
                    <CheckCircle2 className="h-7 w-7 text-green-500" />
                  ) : selectedFile ? (
                    <FileSpreadsheet className="h-7 w-7 text-hdfc-blue" />
                  ) : (
                    <UploadCloud className="h-7 w-7 text-hdfc-blue" />
                  )}
                  </div>
                  {selectedFile && (
                    <button
                      onClick={clearFile}
                      className="absolute -top-2 -right-2 h-6 w-6 bg-gray-100 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-200 transition-colors"
                    >
                      <X className="h-4 w-4 text-gray-600" />
                    </button>
                  )}
                </div>

                <div className="text-center">
                  <p className="text-lg font-medium text-gray-700">
                    {selectedFile
                      ? selectedFile.name
                      : "Upload your HDFC Bank Statement"}
                  </p>
                  {!selectedFile && (
                    <p className="text-sm text-gray-500 mt-1">
                      Drag & drop or click to select your .xls or .xlsx file
                    </p>
                  )}
                </div>
              </div>
            </div>

            {selectedFile && (
              <div className="mt-6 text-center">
                {isLoading ? (
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600">
                      {uploadProgress < 100
                        ? "Processing your statement..."
                        : "Upload complete!"}
                    </p>
                    <Progress value={uploadProgress} className="h-2" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {!uploadSuccess && (
                      <Button
                        className="bg-hdfc-blue hover:bg-hdfc-lightBlue w-full"
                        onClick={onUploadClick}
                      >
                        Upload Statement
                      </Button>
                    )}
                    {uploadSuccess && (
                      <Button
                        className="bg-green-600 hover:bg-green-700 w-full text-white font-semibold"
                        onClick={onUploadClick}
                      >
                        Analyze Statement
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default FileUploader;
