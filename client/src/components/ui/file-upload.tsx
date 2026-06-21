import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, File, X, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface FileUploadProps {
  onFileSelect: (files: File[]) => void;
  onUploadProgress?: (progress: number) => void;
  accept?: Record<string, string[]>;
  maxSize?: number;
  maxFiles?: number;
  className?: string;
}

export default function FileUpload({
  onFileSelect,
  onUploadProgress,
  accept = { "text/xml": [".xml"], "application/xml": [".xml"] },
  maxSize = 50 * 1024 * 1024, // 50MB
  maxFiles = 10,
  className,
}: FileUploadProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const newFiles = [...selectedFiles, ...acceptedFiles];
      setSelectedFiles(newFiles);
      onFileSelect(newFiles);
      setUploadStatus('idle');
    }
  }, [onFileSelect, selectedFiles]);

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop,
    accept,
    maxSize,
    maxFiles,
  });

  const clearFile = (fileIndex?: number) => {
    if (fileIndex !== undefined) {
      const newFiles = selectedFiles.filter((_, index) => index !== fileIndex);
      setSelectedFiles(newFiles);
      onFileSelect(newFiles);
    } else {
      setSelectedFiles([]);
      onFileSelect([]);
      setUploadProgress(0);
      setUploadStatus('idle');
      setIsUploading(false);
    }
  };

  const simulateUpload = () => {
    setIsUploading(true);
    setUploadStatus('uploading');
    setUploadProgress(0);

    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        const next = prev + Math.random() * 15;
        onUploadProgress?.(next);
        
        if (next >= 100) {
          clearInterval(interval);
          setIsUploading(false);
          setUploadStatus('success');
          return 100;
        }
        return next;
      });
    }, 200);
  };

  const getStatusIcon = () => {
    switch (uploadStatus) {
      case 'uploading':
        return <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-cisco-blue"></div>;
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-600" />;
      default:
        return <File className="h-5 w-5 text-gray-400" />;
    }
  };

  const totalSize = selectedFiles.reduce((sum, file) => sum + file.size, 0);

  return (
    <div className={cn("w-full", className)}>
      {selectedFiles.length === 0 ? (
        <div
          {...getRootProps()}
          className={cn(
            "border-2 border-dashed border-border-gray rounded-lg p-8 text-center hover:border-cisco-blue transition-colors cursor-pointer",
            isDragActive && "border-cisco-blue bg-blue-50"
          )}
        >
          <input {...getInputProps()} />
          <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h4 className="text-lg font-medium text-gray-900 mb-2">Upload Configuration Files</h4>
          <p className="text-sm text-gray-600 mb-4">
            {isDragActive
              ? "Drop the XML file here..."
              : "Drag and drop XML files here, or click to browse"}
          </p>
          <Button type="button" className="bg-cisco-blue hover:bg-cisco-dark">
            Select Files
          </Button>
          <p className="text-xs text-gray-500 mt-2">Supported formats: .xml (Max size: 50MB)</p>
          
          {fileRejections.length > 0 && (
            <div className="mt-4 text-sm text-red-600">
              {fileRejections.map(({ file, errors }) => (
                <div key={file.name}>
                  {errors.map((error) => (
                    <p key={error.code}>{error.message}</p>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-lg font-medium text-gray-900">
              Selected Files ({selectedFiles.length})
            </h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => clearFile()}
              disabled={isUploading}
            >
              Clear All
            </Button>
          </div>
          
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {selectedFiles.map((file, index) => (
              <div key={`${file.name}-${index}`} className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {getStatusIcon()}
                    <div>
                      <p className="text-sm font-medium text-gray-900">{file.name}</p>
                      <p className="text-sm text-gray-600">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => clearFile(index)}
                    disabled={isUploading}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>Total files: {selectedFiles.length}</span>
              <span>Total size: {(totalSize / 1024 / 1024).toFixed(2)} MB</span>
            </div>
            
            {uploadStatus === 'uploading' && (
              <>
                <Progress value={uploadProgress} className="mb-2" />
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Uploading...</span>
                  <span>{Math.round(uploadProgress)}%</span>
                </div>
              </>
            )}
            
            {uploadStatus === 'success' && (
              <p className="text-sm text-green-600">All files uploaded successfully!</p>
            )}
          </div>
          
          {/* Add more files button */}
          <div
            {...getRootProps()}
            className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-cisco-blue transition-colors cursor-pointer"
          >
            <input {...getInputProps()} />
            <p className="text-sm text-gray-600">
              {isDragActive
                ? "Drop more XML files here..."
                : "Drop more files here, or click to add more"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
