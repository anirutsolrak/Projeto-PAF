// Mesma análise de backend/analysis.py, para o modo demonstração rodar sem servidor.
// O teste analyze.test.ts usa o mesmo arquivo de exemplo que o pytest: as duas versões têm que concordar.

export type Row = Record<string, string | null | undefined> & { groupColor?: string | null };

export const GROUP_COLORS = ['group-color-1', 'group-color-2', 'group-color-3', 'group-color-4', 'group-color-5'];

export const OUTPUT_FIELD_ORDER = [
  'Proposta', 'Logradouro', 'Bairro', 'Número', 'Complemento', 'Cidade', 'UF', 'CEP',
  'Cliente', 'Tipo de Pessoa', 'CPF/CNPJ',
];

const POSSIBLE_COLUMN_MAPPINGS: Record<string, string[]> = {
  Proposta: ['proposta', 'proposal', 'numero_proposta', 'proposal_number', 'nr_proposta'],
  Logradouro: ['logradouro', 'endereco', 'rua', 'enderecamento', 'street'],
  'Número': ['numero', 'num', 'number', 'nr', 'no'],
  Complemento: ['complemento', 'compl', 'complement', 'apto', 'apartamento', 'apartment'],
  Bairro: ['bairro', 'district', 'neighborhood'],
  Cidade: ['cidade', 'city', 'municipio', 'town'],
  UF: ['uf', 'estado', 'state', 'sigla_uf'],
  CEP: ['cep', 'zip', 'zipcode', 'postal', 'postal_code'],
  Cliente: ['cliente', 'customer', 'nome', 'name', 'nome_cliente', 'customer_name'],
  'Tipo de Pessoa': ['tipo_pessoa', 'person_type', 'tipo'],
  'CPF/CNPJ': ['cpf', 'cnpj', 'cpf_cnpj', 'documento', 'document', 'id'],
};

const ADDRESS_FIELDS = ['Logradouro', 'Número', 'Complemento', 'Bairro', 'Cidade', 'UF', 'CEP'];
const REQUIRED_ADDRESS_COLS = ['Logradouro', 'Número', 'Bairro', 'Cidade', 'UF', 'CEP'];

// shortcut: NFD só tira acentos; o unidecode do Python também translitera letras como "ø". Basta para endereços brasileiros.
export function normalizeAddressVal(value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  let s = String(value).toLowerCase().replace(/[°º]/g, '');
  s = s.normalize('NFD').replace(/[̀-ͯ]/g, '');
  s = s.replace(/\brua\b|\br\./g, 'r');
  s = s.replace(/\bavenida\b|\bav\./g, 'av');
  s = s.replace(/\bnumero\b|\bn°\b|\bn\./g, 'n');
  s = s.replace(/\bapartamento\b|\bapto\b|\bap\./g, 'ap');
  s = s.replace(/\blote\b/g, 'lt');
  s = s.replace(/\bquadra\b/g, 'qd');
  s = s.replace(/\bbloco\b/g, 'bl');
  s = s.replace(/\bcasa\b/g, 'cs');
  s = s.replace(/\bsao\b/g, 's');
  s = s.replace(/[^\w\s]/g, '').trim();
  return s.replace(/\s+/g, ' ');
}

const squash = (s: string) => s.toLowerCase().replace(/ /g, '');

export function getColMappings(columns: string[]): Record<string, string> {
  const byNorm = new Map(columns.map((c) => [squash(c), c]));
  const mappings: Record<string, string> = {};
  for (const [key, variations] of Object.entries(POSSIBLE_COLUMN_MAPPINGS)) {
    const found = [key, ...variations].map((v) => byNorm.get(squash(v))).find(Boolean);
    if (found) mappings[key] = found;
  }
  return mappings;
}

export function findDuplicateGroups(rows: Row[]): { ordered: Row[]; groups: number[][] } {
  const mappings = getColMappings(Object.keys(rows[0] ?? {}));
  const missing = REQUIRED_ADDRESS_COLS.filter((c) => !mappings[c]);
  if (missing.length) {
    throw new Error(`Colunas essenciais não encontradas: ${missing.join(', ')}.`);
  }

  const normalized = rows.map((row) =>
    ADDRESS_FIELDS.map((f) => (mappings[f] ? normalizeAddressVal(row[mappings[f]]) : ''))
      .filter(Boolean)
      .join(' '),
  );

  const byAddress = new Map<string, number[]>();
  normalized.forEach((addr, i) => {
    if (addr) byAddress.set(addr, [...(byAddress.get(addr) ?? []), i]);
  });
  // Ordem alfabética do endereço normalizado, igual ao groupby do pandas.
  const groups = [...byAddress.entries()]
    .filter(([, idx]) => idx.length > 1)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([, idx]) => idx);

  const colored: Row[] = rows.map((r) => ({ ...r, groupColor: null }));
  groups.forEach((idx, g) => idx.forEach((i) => (colored[i].groupColor = GROUP_COLORS[g % GROUP_COLORS.length])));
  return { ordered: groups.flat().map((i) => colored[i]), groups };
}
