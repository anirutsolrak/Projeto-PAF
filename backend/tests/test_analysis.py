import json
from io import BytesIO
from pathlib import Path

import pandas as pd
import pytest

from analysis import find_duplicate_groups, normalize_address_val

# Mesmo arquivo que a demo do front usa: as duas implementações têm que concordar.
FIXTURE = json.loads((Path(__file__).parents[2] / 'frontend/src/demo/propostas-exemplo.json').read_text())


def test_encontra_os_grupos_esperados():
    df = pd.DataFrame(FIXTURE['linhas'])
    _, groups = find_duplicate_groups(df)
    found = [[df.loc[i, 'Proposta'] for i in idx] for idx in groups]
    expected = [sorted(g, key=lambda p: df.index[df['Proposta'] == p][0]) for g in FIXTURE['gruposEsperados']]
    assert sorted(found) == sorted(expected)


def test_grafias_diferentes_viram_o_mesmo_endereco():
    assert normalize_address_val('Rua São José') == normalize_address_val('R. Sao Jose')
    assert normalize_address_val('Apartamento 12') == normalize_address_val('Ap. 12')
    assert normalize_address_val(None) == ''


def test_coluna_obrigatoria_faltando():
    with pytest.raises(ValueError, match='Logradouro'):
        find_duplicate_groups(pd.DataFrame([{'Proposta': '1', 'Cidade': 'X'}]))


def test_rota_analyze_e_download():
    from app import app
    df = pd.DataFrame(FIXTURE['linhas'])
    buf = BytesIO()
    with pd.ExcelWriter(buf, engine='xlsxwriter') as w:
        df.to_excel(w, index=False, startrow=1)  # a planilha real tem o cabeçalho na 2ª linha
    buf.seek(0)
    client = app.test_client()
    r = client.post('/api/analyze', data={'file': (buf, 'propostas.xlsx')}, content_type='multipart/form-data')
    assert r.status_code == 200, r.json
    assert r.json['total_groups'] == len(FIXTURE['gruposEsperados'])
    d = client.get(f"/api/download_processed/{r.json['task_id']}")
    assert d.status_code == 200
    assert len(pd.read_excel(BytesIO(d.data))) == r.json['total_grouped_items']


def test_simbolo_de_numero_nao_vira_texto():
    assert normalize_address_val('Rua A, n° 12') == normalize_address_val('Rua A, nº 12') == normalize_address_val('Rua A, n 12')
