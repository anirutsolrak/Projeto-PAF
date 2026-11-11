import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Info } from "lucide-react";

interface GroupLegendProps {
  totalGroups: number; // Número total de grupos detectados pelo backend
  groupColorsUsed?: string[]; // Array das classes de cores únicas presentes na prévia
}

// Mapeamento de classes de cor para estilos Tailwind CSS (ajuste conforme seu `globals.css` ou onde define as cores)
// Este mapeamento é apenas para o visual da legenda. A cor real na tabela vem da classe CSS.
const tailwindColorMap: { [key: string]: string } = {
  'group-color-1': 'bg-blue-300 border-blue-500',
  'group-color-2': 'bg-purple-300 border-purple-500',
  'group-color-3': 'bg-pink-300 border-pink-500',
  'group-color-4': 'bg-green-300 border-green-500',
  'group-color-5': 'bg-yellow-300 border-yellow-500',
  // Adicione mais se tiver mais de 5 cores
};

const GroupLegend: React.FC<GroupLegendProps> = ({ totalGroups, groupColorsUsed }) => {
  if (totalGroups === 0) {
    return null;
  }
  
  const colorsToDisplay = groupColorsUsed && groupColorsUsed.length > 0 
    ? groupColorsUsed 
    : ['group-color-1', 'group-color-2', 'group-color-3', 'group-color-4', 'group-color-5'].slice(0, Math.min(totalGroups, 5));


  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center text-fraud-secondary">
          <Info className="mr-2 h-5 w-5" />
          Legenda dos Grupos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Foram identificados <span className="font-semibold">{totalGroups}</span> grupo(s) de endereços suspeitos.
          As cores na tabela ajudam a distinguir visualmente cada grupo.
        </p>
        
        {colorsToDisplay.map((colorClass, index) => (
          <div key={colorClass} className="flex items-center">
            <div 
              className={`w-5 h-5 mr-3 rounded-sm border ${tailwindColorMap[colorClass] || 'bg-gray-300 border-gray-500'}`}
            ></div>
            <span>
              Cor indicativa para Grupo {index + 1} (e subsequentes, se houver mais de 5 cores)
            </span>
          </div>
        ))}

        {totalGroups > colorsToDisplay.length && (
            <p className="text-xs text-muted-foreground italic">
                ... e outras cores para os demais grupos (se houver mais de {colorsToDisplay.length}).
            </p>
        )}
        
        <div className="text-sm text-muted-foreground mt-4 pt-3 border-t flex items-start">
          <Info className="mr-2 h-4 w-4 flex-shrink-0 mt-0.5" />
          <p>
            Os grupos representam endereços com alta similaridade.
            Estes podem indicar onde o mesmo endereço (ou muito similar) foi usado em diferentes propostas.
            Verifique os dados completos no arquivo de download.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default GroupLegend;