from flask import Flask, request, jsonify, send_file, send_from_directory
from flask_cors import CORS
import pandas as pd
from io import BytesIO
import os
import logging
import uuid
from collections import OrderedDict

from analysis import OUTPUT_FIELD_ORDER, find_duplicate_groups, get_col_mappings_from_df

PREVIEW_DATA_ROWS = 200
# shortcut: resultados ficam na memória do processo, então só funciona com 1 worker. Trocar por disco/Redis se escalar.
MAX_STORED_TASKS = 20

STATIC_FOLDER_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'frontend_build')

app = Flask(__name__, static_folder=STATIC_FOLDER_PATH, static_url_path='')
CORS(app, resources={r"/api/*": {"origins": "*"}}) # Aplica CORS apenas às rotas de API

app.processed_tasks = OrderedDict()

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s: %(message)s')

# Log para verificar se a pasta estática e o index.html são encontrados
if not os.path.exists(STATIC_FOLDER_PATH):
    app.logger.warning(f"ALERTA INICIAL: Pasta estática '{STATIC_FOLDER_PATH}' NÃO EXISTE no momento da instanciação do Flask.")
elif not os.path.exists(os.path.join(STATIC_FOLDER_PATH, 'index.html')):
    app.logger.warning(f"ALERTA INICIAL: 'index.html' NÃO encontrado dentro de '{STATIC_FOLDER_PATH}'.")
else:
    app.logger.info(f"SUCESSO INICIAL: Flask instanciado. Pasta estática '{STATIC_FOLDER_PATH}' e 'index.html' parecem existir.")


def core_processing_logic_and_prepare_output(df: pd.DataFrame) -> dict:
    ordered, groups = find_duplicate_groups(df)
    stored = ordered.drop(columns=[c for c in ordered.columns if c == 'original_index_col'])

    task_id = str(uuid.uuid4())
    app.processed_tasks[task_id] = stored
    while len(app.processed_tasks) > MAX_STORED_TASKS:
        app.processed_tasks.popitem(last=False)  # descarta o mais antigo que nunca foi baixado

    app.logger.info(f"Task {task_id}: {len(groups)} grupos, {len(stored)} propostas agrupadas.")
    return {
        "task_id": task_id,
        "preview_data": stored.head(PREVIEW_DATA_ROWS).to_dict(orient='records'),
        "total_grouped_items": len(stored),
        "total_groups": len(groups),
        "group_colors_present": list(stored['groupColor'].dropna().unique()) if not stored.empty else [],
    }

# --- Rotas de API ---
@app.route('/api/analyze', methods=['POST'])
def analyze_file_endpoint():
    app.logger.info("Requisição /api/analyze recebida.")
    if 'file' not in request.files:
        return jsonify({"message": "Nenhum arquivo enviado"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"message": "Nome de arquivo vazio"}), 400

    if not (file.filename.lower().endswith('.xlsx') or file.filename.lower().endswith('.xls')):
        return jsonify({"message": "Formato de arquivo inválido. Envie .xlsx ou .xls"}), 400

    try:
        app.logger.info(f"Lendo arquivo: {file.filename}")
        file_stream = BytesIO(file.read())
        
        if file.filename.lower().endswith('.xlsx'):
            df = pd.read_excel(file_stream, engine='openpyxl', dtype=str, keep_default_na=False, header=1)
        else: 
            df = pd.read_excel(file_stream, engine='xlrd', dtype=str, keep_default_na=False, header=1)
        
        df.replace({'': None}, inplace=True)

        app.logger.info(f"Arquivo lido usando a segunda linha como cabeçalho. Número de linhas de dados: {len(df)}")
        app.logger.info(f"Colunas lidas: {list(df.columns)}") 
        
        if df.empty:
            if all(isinstance(col, int) for col in df.columns):
                 app.logger.warning("Os nomes das colunas ainda são numéricos. Verifique a estrutura do arquivo Excel.")
                 return jsonify({"message": "Falha ao ler os cabeçalhos corretamente. Verifique a estrutura do arquivo Excel."}), 400
            return jsonify({"message": "O arquivo enviado está vazio ou não pôde ser lido corretamente."}), 400

        results = core_processing_logic_and_prepare_output(df) 
        return jsonify(results), 200
    
    except AttributeError as ae: 
        if "'int' object has no attribute 'lower'" in str(ae):
            app.logger.error(f"Erro de atributo ao processar nomes de colunas: {str(ae)}. Provavelmente problema com a linha de cabeçalho.", exc_info=True)
            return jsonify({"message": "Erro ao ler os nomes das colunas do arquivo. Certifique-se de que a segunda linha contenha os cabeçalhos corretos."}), 400
        else:
            app.logger.error(f"Erro de atributo inesperado: {str(ae)}", exc_info=True)
            return jsonify({"message": f"Erro interno (AttributeError): {str(ae)}"}), 500
    except ValueError as ve:
        app.logger.error(f"ValueError durante a análise: {str(ve)}", exc_info=True)
        return jsonify({"message": str(ve)}), 400
    except Exception as e:
        app.logger.error(f"Erro inesperado durante a análise do arquivo: {str(e)}", exc_info=True)
        return jsonify({"message": f"Erro interno ao processar o arquivo: {str(e)}"}), 500

@app.route('/api/download_processed/<task_id>', methods=['GET'])
def download_processed_endpoint(task_id):
    app.logger.info(f"Requisição /api/download_processed/{task_id} recebida.")
    
    df_to_download_original = app.processed_tasks.get(task_id)
    
    if df_to_download_original is None:
        app.logger.warning(f"Task_id {task_id} não encontrado em processed_tasks.")
        return jsonify({"message": "Resultados não encontrados ou expirados. Por favor, processe o arquivo novamente."}), 404

    df_to_download = df_to_download_original.copy() 

    try:
        final_output_df = pd.DataFrame(columns=OUTPUT_FIELD_ORDER) 
        
        if not df_to_download.empty:
            col_mappings_for_download = get_col_mappings_from_df(list(df_to_download.columns))
            
            output_data_rows = []
            for _, row_from_stored_df in df_to_download.iterrows():
                new_row_for_excel = {}
                for standard_field_name in OUTPUT_FIELD_ORDER:
                    actual_col_name_in_df = col_mappings_for_download.get(standard_field_name)
                    
                    if actual_col_name_in_df and actual_col_name_in_df in row_from_stored_df and pd.notna(row_from_stored_df[actual_col_name_in_df]):
                        new_row_for_excel[standard_field_name] = row_from_stored_df[actual_col_name_in_df]
                    elif standard_field_name in row_from_stored_df and pd.notna(row_from_stored_df[standard_field_name]):
                        new_row_for_excel[standard_field_name] = row_from_stored_df[standard_field_name]
                    else:
                        new_row_for_excel[standard_field_name] = '' 
                output_data_rows.append(new_row_for_excel)
            
            if output_data_rows:
                final_output_df = pd.DataFrame(output_data_rows, columns=OUTPUT_FIELD_ORDER)
            
        app.logger.info(f"Gerando arquivo Excel para task_id {task_id} com {len(final_output_df)} linhas.")
        output_stream = BytesIO()
        with pd.ExcelWriter(output_stream, engine='xlsxwriter') as writer:
            final_output_df.to_excel(writer, index=False, sheet_name='Análise de Endereços Agrupados')
        output_stream.seek(0)
        
        filename = f'analise-fraude-agrupada-{pd.Timestamp.now().strftime("%Y-%m-%d_%H%M%S")}.xlsx'
        
        if task_id in app.processed_tasks:
            del app.processed_tasks[task_id]
            app.logger.info(f"Task_id {task_id} removido da memória.")

        return send_file(
            output_stream,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True,
            download_name=filename
        )

    except Exception as e:
        app.logger.error(f"Erro ao gerar arquivo para download para task_id {task_id}: {str(e)}", exc_info=True)
        return jsonify({"message": f"Erro interno ao gerar arquivo para download: {str(e)}"}), 500

# --- Servir o Frontend Estático (Catch-all route) ---
# Esta rota deve ser UMA DAS ÚLTIMAS definidas, especialmente depois das rotas de API.
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_react_app(path):
    # app.static_folder foi definido na instanciação do Flask
    if app.static_folder and os.path.exists(app.static_folder):
        # Se um caminho específico é solicitado e existe (ex: /assets/main.js ou /favicon.ico)
        path_to_check = os.path.join(app.static_folder, path)
        if path != "" and os.path.exists(path_to_check):
            # Medida de segurança simples contra directory traversal
            if not os.path.abspath(path_to_check).startswith(os.path.abspath(app.static_folder)):
                app.logger.warning(f"Tentativa de acesso inválido (directory traversal): {path}")
                return "Caminho inválido", 400
            app.logger.info(f"Servindo arquivo estático específico: {path}")
            return send_from_directory(app.static_folder, path)
        else:
            # Para a rota raiz ou qualquer outra rota não API que não corresponda a um arquivo, servir index.html
            index_html_path = os.path.join(app.static_folder, 'index.html')
            if os.path.exists(index_html_path):
                app.logger.info(f"Servindo index.html para o path: '{path}'")
                return send_from_directory(app.static_folder, 'index.html')
            else:
                app.logger.error(f"ERRO CRÍTICO: index.html não encontrado em {app.static_folder} ao tentar servir para path: '{path}'")
                return "Arquivo index.html principal não encontrado.", 404
    else:
        # Fallback se a pasta estática não estiver configurada ou não existir
        app.logger.warning(f"Tentativa de servir frontend, mas static_folder não está configurado ou não existe: '{app.static_folder}'")
        return "Interface do usuário não está disponível (static_folder não encontrado).", 404


if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5001))
    debug_mode_str = os.environ.get("FLASK_DEBUG", "0") # Padrão para 0 (False) para Docker/produção
    flask_env = os.environ.get("FLASK_ENV", "production") # Padrão para production

    if flask_env == "production":
        debug_mode = False
    else: # development ou outro
        debug_mode = debug_mode_str == "1"
           
    app.logger.info(f"Iniciando servidor Flask na porta {port} com debug={debug_mode} (FLASK_ENV={flask_env}).")
    app.run(host='0.0.0.0', port=port, debug=debug_mode)