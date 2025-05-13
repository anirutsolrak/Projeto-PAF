
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Info, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";

interface FileUploaderProps {
  onFileSelect: (file: File) => void;
  isLoading: boolean;
  progress: number;
}

const FileUploader: React.FC<FileUploaderProps> = ({ onFileSelect, isLoading, progress }) => {
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { toast } = useToast();

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);

    const files = e.dataTransfer.files;
    handleFiles(files);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    handleFiles(files);
  };

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    const file = files[0];
    const extension = file.name.split('.').pop()?.toLowerCase();
    
    if (extension !== 'xlsx' && extension !== 'xls') {
      toast({
        title: "Formato de arquivo inválido",
        description: "Por favor, envie apenas arquivos XLSX ou XLS.",
        variant: "destructive"
      });
      return;
    }
    
    setSelectedFile(file);
    onFileSelect(file);
  };

  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle className="text-fraud-primary text-2xl">Upload de Arquivo de Propostas</CardTitle>
        <CardDescription>
          Envie um arquivo XLSX contendo as propostas para análise de fraudes
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center ${
            dragOver ? 'border-fraud-primary bg-fraud-accent bg-opacity-30' : 'border-gray-300'
          } transition-colors duration-200 cursor-pointer`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => document.getElementById('file-input')?.click()}
        >
          <Upload className="mx-auto h-12 w-12 text-fraud-secondary mb-4" />
          <h3 className="text-lg font-medium mb-2">
            {selectedFile ? selectedFile.name : 'Arraste ou clique para selecionar um arquivo'}
          </h3>
          <p className="text-sm text-gray-500">
            {selectedFile 
              ? `Tamanho: ${(selectedFile.size / 1024 / 1024).toFixed(2)} MB` 
              : 'Apenas arquivos XLSX são aceitos'}
          </p>
          <input
            id="file-input"
            type="file"
            className="hidden"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            disabled={isLoading}
          />
        </div>

        {isLoading && (
          <div className="mt-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">Processando</span>
              <span className="text-sm">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        <div className="mt-4 flex items-start text-sm text-muted-foreground">
          <Info className="mr-2 h-4 w-4 mt-0.5 flex-shrink-0" />
          <p>
            O arquivo deve conter, no mínimo, as colunas: Logradouro, Número, Complemento, Bairro, 
            Cidade, UF e CEP. Outras colunas serão preservadas para análise posterior.
          </p>
        </div>
      </CardContent>
      <CardFooter>
        <div className="text-sm text-muted-foreground">
          {selectedFile && !isLoading && (
            <p className="text-fraud-primary">
              {selectedFile.name} - Pronto para análise
            </p>
          )}
          {isLoading && (
            <p className="text-amber-600">
              Processando arquivo... Por favor, aguarde.
            </p>
          )}
        </div>
      </CardFooter>
    </Card>
  );
};

export default FileUploader;
