"""Detecção de propostas com o mesmo endereço (indício de fraude).

Funções puras, sem Flask: a rota em app.py e os testes usam as mesmas.
"""
import re

import numpy as np
import pandas as pd
import unidecode

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
    s = re.sub(r'[°º]', '', s)  # unidecode transformaria "n°" em "ndeg"
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

REQUIRED_ADDRESS_COLS = ['Logradouro', 'Número', 'Bairro', 'Cidade', 'UF', 'CEP']


def find_duplicate_groups(df: pd.DataFrame) -> tuple[pd.DataFrame, list[list]]:
    """Marca cada linha com a cor do seu grupo e devolve (linhas agrupadas em ordem, grupos de índices).

    Um grupo são 2+ linhas cujo endereço normalizado é idêntico.
    """
    col_mappings = get_col_mappings_from_df(list(df.columns))
    missing = [c for c in REQUIRED_ADDRESS_COLS if c not in col_mappings]
    if missing:
        examples = {k: POSSIBLE_COLUMN_MAPPINGS[k][0] for k in missing}
        raise ValueError(
            f"Colunas essenciais não encontradas ou não mapeadas corretamente: {', '.join(missing)}. "
            f"Verifique se o arquivo contém colunas como: {examples}"
        )

    df = df.copy()
    normalized = df.apply(lambda row: concatenate_address_for_row(row, col_mappings), axis=1)
    valid = normalized[normalized != '']
    counts = valid.value_counts()
    duplicated = valid[valid.isin(counts[counts > 1].index)]
    groups = [sorted(idx) for idx in duplicated.groupby(duplicated).groups.values()]
    # Mesma ordem do pandas groupby (alfabética pelo endereço normalizado), que a demo em TS reproduz.
    groups.sort(key=lambda idx: normalized[idx[0]])

    df['groupColor'] = None
    for i, idx in enumerate(groups):
        df.loc[idx, 'groupColor'] = GROUP_COLORS[i % len(GROUP_COLORS)]
    df = df.replace({pd.NA: None, np.nan: None})

    ordered = df.loc[[i for idx in groups for i in idx]] if groups else df.iloc[0:0]
    return ordered, groups
