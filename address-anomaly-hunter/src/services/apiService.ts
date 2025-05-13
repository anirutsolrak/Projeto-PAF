interface AddressRow {
  [key: string]: any;
  groupColor?: string;
}

type ProgressCallback = (progress: number) => void;

interface ProcessResult {
  task_id: string;
  preview_data: AddressRow[];
  total_grouped_items: number;
  total_groups: number;
  group_colors_present: string[];
}

const API_BASE_URL = 'http://localhost:5001';
// Aumentando para ~20 minutos para processamento (1080000 ms = 18 min)
// e ~22 minutos para a requisição de análise (18 min + 2 min upload = 1200000 ms)
const BASE_PROCESSING_TIMEOUT = 1080000; 
const UPLOAD_AND_PROCESS_TIMEOUT = BASE_PROCESSING_TIMEOUT + 120000; // Timeout total para a chamada de análise

async function fetchWithTimeout(resource: RequestInfo, options: RequestInit & { timeout?: number } = {}) {
  // Se um timeout específico não for passado para a chamada, usa um timeout geral menor
  // para evitar que chamadas "esquecidas" fiquem penduradas indefinidamente.
  // Para operações longas como processamento, um timeout específico deve ser passado.
  const { timeout = 60000 } = options; // Timeout padrão de 60s se não especificado
  
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  const response = await fetch(resource, {
    ...options,
    signal: controller.signal  
  });
  clearTimeout(id);
  return response;
}


export const processXlsxFile = async (
  file: File,
  onProgress: ProgressCallback
): Promise<ProcessResult> => {
  const formData = new FormData();
  formData.append('file', file);

  onProgress(0); 

  try {
    onProgress(10); 

    const response = await fetchWithTimeout(`${API_BASE_URL}/api/analyze`, {
      method: 'POST',
      body: formData,
      timeout: UPLOAD_AND_PROCESS_TIMEOUT 
    });
    
    onProgress(60); 

    if (!response.ok) {
      let errorMessage = `Erro do servidor: ${response.statusText}`;
      try {
        if (response.body) { 
            const errorData = await response.json();
            errorMessage = errorData.message || errorMessage;
        }
      } catch (e) {
        console.warn("Não foi possível parsear o corpo do erro como JSON:", e);
      }
      throw new Error(errorMessage);
    }

    const result: ProcessResult = await response.json();
    onProgress(100);
    return result;

  } catch (error) {
    onProgress(0); 
    let message = "Falha ao comunicar com o servidor.";
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        message = `A requisição excedeu o tempo limite de ${UPLOAD_AND_PROCESS_TIMEOUT / 1000} segundos. O arquivo pode ser muito grande ou o servidor está sobrecarregado.`;
      } else {
        message = `Falha ao processar arquivo: ${error.message}`;
      }
    }
    console.error("Erro em processXlsxFile:", error);
    throw new Error(message);
  }
};

export const downloadProcessedFile = async (taskId: string): Promise<Blob> => {
  if (!taskId) {
    throw new Error("Task ID é necessário para o download.");
  }
  try {
    // Para download, podemos usar um timeout menor se o arquivo já estiver processado e pronto
    const response = await fetchWithTimeout(`${API_BASE_URL}/api/download_processed/${taskId}`, {
      method: 'GET',
      timeout: BASE_PROCESSING_TIMEOUT // Tempo para o backend gerar e enviar o arquivo
    });

    if (!response.ok) {
      let errorMessage = `Erro do servidor ao baixar arquivo: ${response.statusText}`;
       try {
        if (response.body) {
            const errorData = await response.json();
            errorMessage = errorData.message || errorMessage;
        }
      } catch (e) {
        console.warn("Não foi possível parsear o corpo do erro como JSON:", e);
      }
      throw new Error(errorMessage);
    }

    const blob = await response.blob();
    return blob;

  } catch (error) {
    let message = "Falha ao baixar arquivo do servidor.";
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        message = `A requisição de download excedeu o tempo limite de ${BASE_PROCESSING_TIMEOUT / 1000} segundos.`;
      } else {
        message = `Falha ao baixar arquivo: ${error.message}`;
      }
    }
    console.error("Erro em downloadProcessedFile:", error);
    throw new Error(message);
  }
};