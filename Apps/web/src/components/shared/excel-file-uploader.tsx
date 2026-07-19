/**
 * Excel File Uploader Component
 * Handles Excel file upload with drag-and-drop support and validation
 */

import React, { useState, useRef, useCallback } from 'react';
import { Upload, FileSpreadsheet, Loader2, AlertCircle, CheckCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { ExcelImportResult } from '@/types/draft-types/admin-settings.types';

/**
 * Props for the ExcelFileUploader component
 */
interface ExcelFileUploaderProps {
  /** Callback when file is selected and processed */
  onFileProcessed: (result: ExcelImportResult) => void;
  /** Whether the uploader is disabled */
  disabled?: boolean;
  /** Whether a file is being processed */
  isProcessing?: boolean;
  /** Custom className for styling */
  className?: string;
  /** Maximum file size in MB */
  maxSize?: number;
  /** Allowed file types */
  allowedTypes?: string[];
}

/**
 * Excel File Uploader Component
 * Provides drag-and-drop functionality for Excel files with validation
 */
export function ExcelFileUploader({
  onFileProcessed,
  disabled = false,
  isProcessing = false,
  className,
  maxSize = 10, // 10MB default
  allowedTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel', // .xls
  ],
}: ExcelFileUploaderProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * Validate file
   */
  const validateFile = (file: File): string | null => {
    // Check file type
    if (!allowedTypes.includes(file.type)) {
      return 'Please select a valid Excel file (.xlsx or .xls)';
    }

    // Check file size
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > maxSize) {
      return `File size must be less than ${maxSize}MB`;
    }

    return null;
  };

  /**
   * Simulate Excel file processing
   * In a real application, this would use a library like xlsx to parse the file
   */
  const processExcelFile = async (file: File): Promise<ExcelImportResult> => {
    return new Promise((resolve) => {
      // Simulate processing time
      const interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            
            // Simulate file parsing and validation
            setTimeout(() => {
              // Mock validation - in real app, this would parse the Excel file
              const mockResult: ExcelImportResult = {
                success: true,
                data: [
                  {
                    wilaya: 'Alger',
                    commune: 'Alger Centre',
                    deliveryOffice: 500,
                    deliveryHome: 800,
                  },
                  {
                    wilaya: 'Oran',
                    commune: 'Oran Centre',
                    deliveryOffice: 400,
                    deliveryHome: 700,
                  },
                ],
                message: `Successfully imported ${2} delivery fee entries`,
              };
              
              resolve(mockResult);
            }, 500);
            
            return 100;
          }
          return prev + 10;
        });
      }, 100);
    });
  };

  /**
   * Handle file selection
   */
  const handleFileSelected = useCallback(async (file: File) => {
    setValidationError(null);
    setProgress(0);

    // Validate file
    const error = validateFile(file);
    if (error) {
      setValidationError(error);
      return;
    }

    setSelectedFile(file);

    try {
      const result = await processExcelFile(file);
      onFileProcessed(result);
    } catch (error) {
      const errorResult: ExcelImportResult = {
        success: false,
        message: 'Failed to process Excel file',
        errors: ['An error occurred while processing the file'],
      };
      onFileProcessed(errorResult);
    }
  }, [onFileProcessed, maxSize, allowedTypes]);

  /**
   * Handle drag over
   */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !isProcessing) {
      setIsDragOver(true);
    }
  }, [disabled, isProcessing]);

  /**
   * Handle drag enter
   */
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !isProcessing) {
      setDragCounter(prev => prev + 1);
      setIsDragOver(true);
    }
  }, [disabled, isProcessing]);

  /**
   * Handle drag leave
   */
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter(prev => prev - 1);
    if (dragCounter <= 1) {
      setIsDragOver(false);
    }
  }, [dragCounter]);

  /**
   * Handle drop
   */
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    setDragCounter(0);

    if (disabled || isProcessing) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelected(files[0]); // Only process the first file
    }
  }, [disabled, isProcessing, handleFileSelected]);

  /**
   * Handle file input change
   */
  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelected(files[0]);
    }
  }, [handleFileSelected]);

  /**
   * Handle click to open file dialog
   */
  const handleClick = useCallback(() => {
    if (!disabled && !isProcessing) {
      fileInputRef.current?.click();
    }
  }, [disabled, isProcessing]);

  /**
   * Clear selected file
   */
  const clearFile = useCallback(() => {
    setSelectedFile(null);
    setValidationError(null);
    setProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  /**
   * Format file size
   */
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className={className}>
      {/* File Input (Hidden) */}
      <input
        ref={fileInputRef}
        type="file"
        accept={allowedTypes.join(',')}
        onChange={handleFileInputChange}
        className="hidden"
        disabled={disabled || isProcessing}
      />

      {/* Upload Area */}
      <Card
        className={cn(
          'border-2 border-dashed transition-colors cursor-pointer',
          isDragOver && 'border-primary bg-primary/5',
          disabled && 'opacity-50 cursor-not-allowed',
          isProcessing && 'cursor-wait',
          className
        )}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <CardContent className="p-8">
          <div className="flex flex-col items-center justify-center space-y-4">
            {/* Icon */}
            <div className="relative">
              {isProcessing ? (
                <Loader2 className="h-12 w-12 text-primary animate-spin" />
              ) : (
                <FileSpreadsheet className="h-12 w-12 text-muted-foreground" />
              )}
            </div>

            {/* Text */}
            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold">
                {isProcessing ? 'Processing Excel File...' : 'Upload Excel File'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {isProcessing
                  ? 'Please wait while we process your file'
                  : 'Drag and drop your Excel file here, or click to browse'
                }
              </p>
              <p className="text-xs text-muted-foreground">
                Supported formats: .xlsx, .xls (Max {maxSize}MB)
              </p>
            </div>

            {/* Upload Button */}
            {!isProcessing && (
              <Button variant="outline" disabled={disabled}>
                <Upload className="h-4 w-4 mr-2" />
                Choose File
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Progress Bar */}
      {isProcessing && progress > 0 && (
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>Processing file...</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="w-full" />
        </div>
      )}

      {/* Selected File Info */}
      {selectedFile && !isProcessing && (
        <div className="mt-4 p-3 bg-muted rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <div>
                <p className="text-sm font-medium">{selectedFile.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(selectedFile.size)}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFile}
              disabled={isProcessing}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Validation Error */}
      {validationError && (
        <Alert variant="destructive" className="mt-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{validationError}</AlertDescription>
        </Alert>
      )}

      {/* File Format Instructions */}
      <div className="mt-4 p-4 bg-muted rounded-lg">
        <h4 className="text-sm font-medium mb-2">Expected Excel Format:</h4>
        <div className="text-xs text-muted-foreground space-y-1">
          <p>• <strong>Column A:</strong> Wilaya (e.g., "Alger", "Oran")</p>
          <p>• <strong>Column B:</strong> Commune (e.g., "Alger Centre", "Oran Centre")</p>
          <p>• <strong>Column C:</strong> Delivery Office (numeric value)</p>
          <p>• <strong>Column D:</strong> Delivery Home (numeric value)</p>
          <p>• <strong>Note:</strong> Use "Rest" for commune when applicable</p>
        </div>
      </div>
    </div>
  );
}
