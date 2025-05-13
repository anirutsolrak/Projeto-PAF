from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import pandas as pd
import numpy as np
import re
import unidecode
# Levenshtein não é mais usado na lógica principal
# import Levenshtein 
from io import BytesIO
import os
import logging
import uuid 

app = Flask(__name__)
CORS(app) 

app.processed_tasks = {}

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s: %(message)s')

GROUP_COLORS = [
    'group-color-1', 'group-color-2', 'group-color-3', 
    'group-color-4', 'group-color-5'
]
PREVIEW_DATA_ROWS = 200 

POSSIBLE_COLUMN_MAPPINGS = {
    'Proposta': ['proposta', 'proposal', 'numero_proposta', 'proposal_number', 'nr_proposta'],
    'Logradouro': ['logradouro', 'endereco', 'rua', 'enderecamento', 'street'],
    'Número': ['numero', 'num', 'number', 'nr', 'no'],
    'Complemento': ['complemento', 'compl', 'complement', 'apto', 'apartamento', 'apartment'],
    'Bairro': ['bairro', 'district', 'neighborhood'],
    'Cidade': ['cidade', 'city', 'municipio', 'town'],
    'UF': ['uf', 'estado', 'state', 'sigla_uf'],
    'CEP': ['cep', 'zip', 'zipcode', 'postal', 'postal_code'],
    'Cliente': ['cliente', 'customer', 'nome', 'name', 'nome_cliente', 'customer_name'],
    'Tipo de Pessoa': ['tipo_pessoa', 'person_type', 'tipo'],
    'CPF/CNPJ': ['cpf', 'cnpj', 'cpf_cnpj', 'documento', 'document', 'id']
}

OUTPUT_FIELD_ORDER = [
    'Proposta', 'Logradouro', 'Bairro', 'Número', 'Complemento', 'Cidade', 'UF', 'CEP',
    'Cliente', 'Tipo de Pessoa', 'CPF/CNPJ'
]

def normalize_address_val(value: any) -> str:
    if value is None or value == '' or (isinstance(value, float) and np.isnan(value)):
        return ''
    s = str(value).lower()
    s = unidecode.unidecode(s)
    s = re.sub(r'\brua\b|\br\.', 'r', s)
    s = re.sub(r'\bavenida\b|\bav\.', 'av', s)
    s = re.sub(r'\bnumero\b|\bn°\b|\bn\.', 'n', s)
    s = re.sub(r'\bapartamento\b|\bapto\b|\bap\.', 'ap', s)
    s = re.sub(r'\blote\b', 'lt', s)
    s = re.sub(r'\bquadra\b', 'qd', s)
    s = re.sub(r'\bbloco\b', 'bl', s)
    s = re.sub(r'\bcasa\b', 'cs', s)
    s = re.sub(r'\bsao\b', 's', s)
    s = re.sub(r'[^\w\s]', '', s).strip()
    s = re.sub(r'\s+', ' ', s)
    return s

def get_col_mappings_from_df(df_columns: list) -> dict:
    mappings = {}
    # Garante que todos os nomes de coluna sejam tratados como string antes de .lower()
    df_cols_lower_stripped = {str(col).lower().replace(" ", ""): str(col) for col in df_columns}
    
    for standard_key, variations in POSSIBLE_COLUMN_MAPPINGS.items():
        standard_key_norm = standard_key.lower().replace(" ", "")
        found_col = None
        
        if standard_key_norm in df_cols_lower_stripped:
            found_col = df_cols_lower_stripped[standard_key_norm]
        
        if not found_col:
            for var in variations:
                var_norm = var.lower().replace(" ", "")
                if var_norm in df_cols_lower_stripped:
                    found_col = df_cols_lower_stripped[var_norm]
                    break
        
        if found_col:
            mappings[standard_key] = found_col
    return mappings

def concatenate_address_for_row(row: pd.Series, col_mappings: dict) -> str:
    components = []
    address_fields = ['Logradouro', 'Número', 'Complemento', 'Bairro', 'Cidade', 'UF', 'CEP']
    for field_key in address_fields:
        actual_col_name = col_mappings.get(field_key)
        if actual_col_name and actual_col_name in row and pd.notna(row[actual_col_name]):
            val = normalize_address_val(row[actual_col_name])
            if val: 
                 components.append(val)
    return ' '.join(components)

def core_processing_logic_and_prepare_output(df: pd.DataFrame) -> dict:
    app.logger.info("Iniciando mapeamento de colunas...")
    col_mappings = get_col_mappings_from_df(list(df.columns))

    required_address_cols = ['Logradouro', 'Número', 'Bairro', 'Cidade', 'UF', 'CEP']
    missing_mapped_cols = [std_name for std_name in required_address_cols if std_name not in col_mappings]
    
    if missing_mapped_cols:
        missing_cols_examples = { k: POSSIBLE_COLUMN_MAPPINGS[k][0] for k in missing_mapped_cols }
        raise ValueError(f"Colunas essenciais não encontradas ou não mapeadas corretamente: {', '.join(missing_mapped_cols)}. Verifique se o arquivo contém colunas como: {missing_cols_examples}")

    app.logger.info("Normalizando e concatenando endereços...")
    df['enderecoNormalizado'] = df.apply(lambda row: concatenate_address_for_row(row, col_mappings), axis=1)
    
    df_original_indexed = df 
    df_original_indexed['original_index_col'] = df_original_indexed.index 

    df_filtered = df_original_indexed[df_original_indexed['enderecoNormalizado'] != ''].copy() 
    num_rows_valid = len(df_filtered)

    if num_rows_valid == 0:
        app.logger.info("Nenhum endereço válido encontrado após normalização.")
        return {
            "task_id": uuid.uuid4().hex, "preview_data": [], "total_grouped_items": 0,
            "total_groups": 0, "group_colors_present": []
        }

    app.logger.info(f"Encontrando duplicatas exatas para {num_rows_valid} endereços válidos...")
    address_counts = df_filtered['enderecoNormalizado'].value_counts()
    duplicated_address_strings = address_counts[address_counts > 1].index.tolist()

    groups_indices_list = []
    if duplicated_address_strings:
        app.logger.info(f"Encontradas {len(duplicated_address_strings)} strings de endereço únicas que são duplicadas.")
        app.logger.info("Iniciando coleta otimizada de índices para grupos duplicados...")
        
        df_only_duplicates = df_filtered[df_filtered['enderecoNormalizado'].isin(duplicated_address_strings)]
        
        grouped_indices_series = df_only_duplicates.groupby('enderecoNormalizado')['original_index_col'].apply(list)
        
        for indices_list_for_group in grouped_indices_series:
            if len(indices_list_for_group) > 1:
                groups_indices_list.append(sorted(indices_list_for_group)) 
        
        app.logger.info("Coleta otimizada de índices concluída.")
    else:
        app.logger.info("Nenhuma duplicata exata encontrada.")
    
    app.logger.info(f"Total de grupos de duplicatas exatas formados: {len(groups_indices_list)}")
    
    df_original_indexed['groupColor'] = pd.NA 
    if groups_indices_list:
        app.logger.info(f"Atribuindo cores a {len(groups_indices_list)} grupos...")
        for i, group_of_original_indices in enumerate(groups_indices_list):
            color = GROUP_COLORS[i % len(GROUP_COLORS)]
            df_original_indexed.loc[group_of_original_indices, 'groupColor'] = color
        app.logger.info("Atribuição de cores concluída.")
        
    df_all_data_with_colors = df_original_indexed.replace({pd.NA: None, np.nan: None})

    app.logger.info("Preparando DataFrame agrupado e ordenado para resultado (df_grouped_ordered)...")
    df_grouped_ordered = pd.DataFrame() 
    if groups_indices_list:
        app.logger.info("Coletando linhas para df_grouped_ordered...")
        temp_rows_list = []
        for group_of_original_indices in groups_indices_list:
            for original_idx in group_of_original_indices:
                temp_rows_list.append(df_all_data_with_colors.loc[original_idx])
        
        if temp_rows_list:
            df_grouped_ordered = pd.DataFrame(temp_rows_list)
            app.logger.info(f"df_grouped_ordered criado com {len(df_grouped_ordered)} linhas e {len(df_grouped_ordered.columns)} colunas.")
        else:
            app.logger.info("Nenhuma linha qualificada para df_grouped_ordered.")
    else:
        app.logger.info("Nenhum grupo encontrado, df_grouped_ordered permanecerá vazio.")
    
    task_id = uuid.uuid4().hex
    cols_to_store = [col for col in df_all_data_with_colors.columns if col not in ['enderecoNormalizado', 'original_index_col']]
    
    df_to_store_in_memory = pd.DataFrame(columns=cols_to_store) 
    if not df_grouped_ordered.empty:
        df_to_store_in_memory = df_grouped_ordered[cols_to_store].copy()
    
    app.processed_tasks[task_id] = df_to_store_in_memory
    
    app.logger.info(f"Resultados para task_id {task_id} armazenados. Total de itens agrupados: {len(app.processed_tasks[task_id])}.")

    preview_data_list = []
    if not app.processed_tasks[task_id].empty:
        app.logger.info("Criando preview_data_list...")
        preview_data_list = app.processed_tasks[task_id].head(PREVIEW_DATA_ROWS).to_dict(orient='records')
        app.logger.info(f"preview_data_list criada com {len(preview_data_list)} registros.")
    
    group_colors_present = []
    if not app.processed_tasks[task_id].empty and 'groupColor' in app.processed_tasks[task_id].columns:
        group_colors_present = list(app.processed_tasks[task_id]['groupColor'].dropna().unique())
    
    app.logger.info("Preparando resposta JSON final...")
    final_response = {
        "task_id": task_id,
        "preview_data": preview_data_list,
        "total_grouped_items": len(app.processed_tasks[task_id]),
        "total_groups": len(groups_indices_list),
        "group_colors_present": group_colors_present
    }
    app.logger.info("Resposta JSON final preparada. Enviando para o cliente...")
    return final_response

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

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5001)) 
    app.logger.info(f"Iniciando servidor Flask na porta {port}.")
    app.run(host='0.0.0.0', port=port, debug=True)