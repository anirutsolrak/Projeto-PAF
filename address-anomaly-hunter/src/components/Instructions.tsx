
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";

const Instructions: React.FC = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-fraud-primary text-xl">Como Usar Esta Ferramenta</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex">
          <div className="mr-3 flex-shrink-0">
            <div className="w-6 h-6 rounded-full bg-fraud-primary text-white flex items-center justify-center text-sm">1</div>
          </div>
          <div>
            <h3 className="font-medium mb-1">Faça o upload do arquivo de propostas</h3>
            <p className="text-sm text-muted-foreground">
              Envie seu arquivo XLSX contendo as propostas com informações de endereços. 
              O arquivo deve conter, no mínimo, as colunas de endereço (Logradouro, Número, etc).
            </p>
          </div>
        </div>
        
        <div className="flex">
          <div className="mr-3 flex-shrink-0">
            <div className="w-6 h-6 rounded-full bg-fraud-primary text-white flex items-center justify-center text-sm">2</div>
          </div>
          <div>
            <h3 className="font-medium mb-1">Visualize os resultados da análise</h3>
            <p className="text-sm text-muted-foreground">
              Os registros serão processados e endereços similares serão agrupados e destacados 
              com cores. Cada cor representa um grupo de endereços que são potencialmente o mesmo local.
            </p>
          </div>
        </div>
        
        <div className="flex">
          <div className="mr-3 flex-shrink-0">
            <div className="w-6 h-6 rounded-full bg-fraud-primary text-white flex items-center justify-center text-sm">3</div>
          </div>
          <div>
            <h3 className="font-medium mb-1">Faça o download dos resultados</h3>
            <p className="text-sm text-muted-foreground">
              Baixe o arquivo XLSX com os resultados para análise mais detalhada ou para 
              compartilhar com outros analistas de risco.
            </p>
          </div>
        </div>
        
        <div className="flex items-start mt-6">
          <CheckCircle2 className="h-5 w-5 text-fraud-primary mr-2 flex-shrink-0 mt-0.5" />
          <p className="text-sm">
            Após identificar grupos suspeitos, investigue mais profundamente as propostas 
            relacionadas - verifique CPFs, nomes, datas, e outros padrões que possam 
            confirmar ou descartar a suspeita de fraude.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default Instructions;
