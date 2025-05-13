import React, { useState, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Download, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

interface ResultsTableProps {
  data: any[]; // Agora é preview_data, já ordenado e filtrado
  onDownload: () => void; 
  isLoading: boolean;
  totalGroupedItems: number;
  totalGroups: number;
}

const ResultsTable: React.FC<ResultsTableProps> = ({ data, onDownload, isLoading, totalGroupedItems, totalGroups }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10; // Paginação apenas para a prévia exibida
  
  const totalRowsInPreview = data.length;
  const totalPages = Math.max(1, Math.ceil(totalRowsInPreview / rowsPerPage));
  
  const fieldOrder = [
    'Proposta', 'Logradouro', 'Bairro', 'Número', 'Complemento', 'Cidade', 'UF', 'CEP',
    'Cliente', 'Tipo de Pessoa', 'CPF/CNPJ'
  ];
  
  const headers = useMemo(() => {
    if (data.length === 0) return fieldOrder; // Retorna ordem padrão se não houver dados
    
    // Tenta pegar as chaves do primeiro item de 'data', caso contrário usa fieldOrder
    const sampleKeys = Object.keys(data[0]);
    return fieldOrder.filter(field => 
        sampleKeys.some(key => 
            key === field || 
            key.toLowerCase() === field.toLowerCase() ||
            key.replace(/\s/g, '').toLowerCase() === field.replace(/\s/g, '').toLowerCase()
        )
    );
  }, [data]); // Depende de 'data' para os cabeçalhos
  
  const headerMapping = useMemo(() => {
    if (data.length === 0) return {};
    const mapping: Record<string, string> = {};
    const sampleRowKeys = Object.keys(data[0]);
    
    fieldOrder.forEach(desiredField => {
      const actualField = sampleRowKeys.find(key => 
        key === desiredField || 
        key.toLowerCase() === desiredField.toLowerCase() ||
        key.replace(/\s/g, '').toLowerCase() === desiredField.replace(/\s/g, '').toLowerCase()
      );
      if (actualField) {
        mapping[desiredField] = actualField;
      }
    });
    return mapping;
  }, [data]);
  
  const currentRows = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    return data.slice(startIndex, endIndex);
  }, [data, currentPage, rowsPerPage]);
  
  const handlePrevPage = () => setCurrentPage(prev => Math.max(prev - 1, 1));
  const handleNextPage = () => setCurrentPage(prev => Math.min(prev + 1, totalPages));
  const getRowColorClass = (row: any) => row?.groupColor || '';
  
  return (
    <Card className="w-full">
      <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle className="text-fraud-primary text-2xl">Resultados da Análise</CardTitle>
          <div className="text-sm text-muted-foreground mt-1">
            {totalGroups > 0 ? (
              <>
                <span className="font-medium">{totalGroups} grupos</span> de endereços suspeitos encontrados, 
                com um total de <span className="font-medium">{totalGroupedItems} entradas</span> sob análise.
                {totalRowsInPreview < totalGroupedItems && ` Exibindo prévia de ${totalRowsInPreview} entradas.`}
              </>
            ) : (
              'Nenhum grupo suspeito encontrado'
            )}
          </div>
        </div>
        <Button 
          className="mt-4 md:mt-0" 
          onClick={onDownload} 
          disabled={isLoading || totalGroupedItems === 0}
        >
          <Download className="mr-2 h-4 w-4" />
          Baixar Resultados Completos ({totalGroupedItems})
        </Button>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {currentRows.length > 0 ? (
          <Table className="data-table">
            <TableHeader>
              <TableRow>
                {headers.map((header, index) => (
                  <TableHead key={index}>{header}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentRows.map((row, rowIndex) => (
                <TableRow key={rowIndex} className={getRowColorClass(row)}>
                  {headers.map((header, cellIndex) => {
                    const mappedHeader = headerMapping[header] || header;
                    return (
                      <TableCell key={cellIndex}>{row[mappedHeader] !== undefined && row[mappedHeader] !== null ? String(row[mappedHeader]) : ''}</TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            {isLoading ? 'Carregando resultados...' : 'Nenhum endereço duplicado encontrado para exibir na prévia.'}
          </div>
        )}
      </CardContent>
      {currentRows.length > 0 && totalRowsInPreview > rowsPerPage && (
        <CardFooter className="flex justify-between">
          <div className="text-sm text-muted-foreground">
            Exibindo {currentRows.length} de {totalRowsInPreview} registros da prévia (Total agrupado: {totalGroupedItems})
          </div>
          <div className="flex space-x-2">
            <Button variant="outline" size="sm" onClick={handlePrevPage} disabled={currentPage === 1}><ChevronLeft className="h-4 w-4" /></Button>
            <span className="flex items-center px-2">{currentPage} / {totalPages}</span>
            <Button variant="outline" size="sm" onClick={handleNextPage} disabled={currentPage === totalPages}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </CardFooter>
      )}
    </Card>
  );
};

export default ResultsTable;