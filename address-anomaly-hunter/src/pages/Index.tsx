import React, { useState } from 'react';
import Layout from '@/components/Layout';
import FileUploader from '@/components/FileUploader';
import ResultsTable from '@/components/ResultsTable';
import GroupLegend from '@/components/GroupLegend';
import Instructions from '@/components/Instructions';
import { useToast } from '@/hooks/use-toast';
import { processXlsxFile, downloadProcessedFile } from '@/services/apiService'; // Modificado
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import SkeletonLoader from '@/components/ui/SkeletonLoader';

interface AddressRow {
  [key: string]: any;
  groupColor?: string;
}

const Index = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<AddressRow[]>([]); // Para dados da prévia
  const [taskId, setTaskId] = useState<string | null>(null);
  const [totalGroupedItems, setTotalGroupedItems] = useState<number>(0);
  const [totalGroups, setTotalGroups] = useState<number>(0);
  const [groupColors, setGroupColors] = useState<string[]>([]);


  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const resetState = () => {
    setPreviewData([]);
    setTaskId(null);
    setTotalGroupedItems(0);
    setTotalGroups(0);
    setGroupColors([]);
    setError(null);
    setProgress(0);
  }

  const handleFileSelected = (file: File) => {
    setSelectedFile(file);
    resetState();
    handleProcessFile(file);
  };

  const handleProcessFile = async (file: File) => {
    if (!file) {
      toast({
        title: "Nenhum arquivo selecionado",
        description: "Por favor, selecione um arquivo XLSX para análise.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    setError(null);
    setProgress(0);

    try {
      const result = await processXlsxFile(file, (progressValue) => {
        setProgress(progressValue);
      });
      
      setPreviewData(result.preview_data);
      setTaskId(result.task_id);
      setTotalGroupedItems(result.total_grouped_items);
      setTotalGroups(result.total_groups);
      setGroupColors(result.group_colors_present);
      
      if (result.total_groups === 0) {
        toast({
          title: "Análise concluída",
          description: "Nenhum grupo suspeito de endereços similares foi encontrado.",
        });
      } else {
        toast({
          title: "Análise concluída",
          description: `Encontrados ${result.total_groups} grupos suspeitos com um total de ${result.total_grouped_items} endereços. Prévia exibida.`,
        });
      }
    } catch (err) {
      console.error("Erro ao processar arquivo:", err);
      const errorMessage = err instanceof Error ? err.message : "Ocorreu um erro desconhecido.";
      setError(`Ocorreu um erro ao processar o arquivo. Detalhes: ${errorMessage}. Verifique se o formato está correto e tente novamente.`);
      toast({
        title: "Erro ao processar arquivo",
        description: `Houve um problema ao analisar os dados. Detalhes: ${errorMessage}.`,
        variant: "destructive"
      });
      resetState();
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!taskId) {
      toast({
        title: "Nenhum resultado para download",
        description: "Primeiro processe um arquivo para gerar resultados para download.",
        variant: "destructive"
      });
      return;
    }
    setIsLoading(true);
    try {
      const blob = await downloadProcessedFile(taskId); 
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `analise-fraude-agrupada-${new Date().toISOString().split('T')[0]}.xlsx`;
      
      document.body.appendChild(a);
      a.click();
      
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Download iniciado",
        description: "Seu arquivo XLSX com dados agrupados foi gerado com sucesso.",
      });
    } catch (err) {
      console.error("Erro ao gerar arquivo para download:", err);
      const errorMessage = err instanceof Error ? err.message : "Ocorreu um erro desconhecido.";
      toast({
        title: "Erro ao gerar download",
        description: `Não foi possível gerar o arquivo de resultados agrupados. Detalhes: ${errorMessage}`,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Layout>
      <SkeletonLoader isLoading={isLoading && progress < 100} /> {/* Mostrar skeleton durante processamento no backend */}
      <div className={`grid grid-cols-1 md:grid-cols-3 gap-8 ${isLoading && progress < 100 ? 'opacity-50 pointer-events-none' : ''}`}>
        <div className="md:col-span-2">
          <FileUploader 
            onFileSelect={handleFileSelected}
            isLoading={isLoading}
            progress={progress}
          />
          
          {error && (
            <Alert variant="destructive" className="mt-6">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Erro</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          <div className="mt-8">
            <ResultsTable 
              data={previewData} 
              onDownload={handleDownload}
              isLoading={isLoading}
              totalGroupedItems={totalGroupedItems}
              totalGroups={totalGroups}
            />
          </div>
        </div>
        
        <div>
          <Instructions />
          <div className="mt-6">
             {/* A legenda agora pode usar groupColors se necessário, ou simplesmente contar os grupos */}
            <GroupLegend 
              totalGroups={totalGroups} 
              groupColorsUsed={groupColors} // 'groupColors' é o estado que armazena 'group_colors_present' do backend
            />
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Index;