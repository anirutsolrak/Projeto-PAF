import { describe, expect, it } from 'vitest';
import fixture from './propostas-exemplo.json';
import { findDuplicateGroups, normalizeAddressVal, type Row } from './analyze';

describe('findDuplicateGroups', () => {
  it('encontra os mesmos grupos que o backend em Python', () => {
    const rows = fixture.linhas as Row[];
    const { groups, ordered } = findDuplicateGroups(rows);
    const found = groups.map((idx) => idx.map((i) => rows[i].Proposta).sort());
    const expected = fixture.gruposEsperados.map((g) => [...g].sort());
    expect(found.sort()).toEqual(expected.sort());
    expect(ordered.every((r) => r.groupColor)).toBe(true);
  });

  it('acusa coluna obrigatória faltando', () => {
    expect(() => findDuplicateGroups([{ Proposta: '1', Cidade: 'X' }])).toThrow('Logradouro');
  });
});

describe('normalizeAddressVal', () => {
  it('trata grafias diferentes como o mesmo endereço', () => {
    expect(normalizeAddressVal('Rua São José')).toBe(normalizeAddressVal('R. Sao Jose'));
    expect(normalizeAddressVal('Apartamento 12')).toBe(normalizeAddressVal('Ap. 12'));
    expect(normalizeAddressVal('Rua A, n° 12')).toBe(normalizeAddressVal('Rua A, n 12'));
    expect(normalizeAddressVal(null)).toBe('');
  });
});
