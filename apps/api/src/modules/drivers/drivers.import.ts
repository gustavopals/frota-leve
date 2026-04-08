import ExcelJS from 'exceljs';
import { parse as parseCsv } from 'csv-parse/sync';
import { ValidationError } from '../../shared/errors';

type ImportRow = Record<string, unknown>;

const importColumnAliases: Record<string, string> = {
  birth_date: 'birthDate',
  cnh: 'cnhNumber',
  cnh_category: 'cnhCategory',
  cnh_expiration: 'cnhExpiration',
  cnh_expiry: 'cnhExpiration',
  cnh_number: 'cnhNumber',
  cnh_points: 'cnhPoints',
  cnh_pontos: 'cnhPoints',
  cnh_validade: 'cnhExpiration',
  cnhcategoria: 'cnhCategory',
  cnhexpiracao: 'cnhExpiration',
  cnhnumero: 'cnhNumber',
  cpf: 'cpf',
  data_nascimento: 'birthDate',
  departamento: 'department',
  department: 'department',
  email: 'email',
  hire_date: 'hireDate',
  name: 'name',
  nome: 'name',
  notes: 'notes',
  observacao: 'notes',
  observacoes: 'notes',
  phone: 'phone',
  setor: 'department',
  telefone: 'phone',
  user_id: 'userId',
};

function normalizeToken(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function normalizeColumnName(value: string): string | null {
  const normalized = normalizeToken(value);
  return importColumnAliases[normalized] ?? null;
}

function mapImportRow(row: ImportRow): ImportRow {
  const mappedRow: ImportRow = {};

  for (const [key, value] of Object.entries(row)) {
    const mappedKey = normalizeColumnName(key);
    if (!mappedKey) continue;
    mappedRow[mappedKey] = value;
  }

  return mappedRow;
}

function parseCsvRows(buffer: Buffer): ImportRow[] {
  return parseCsv(buffer.toString('utf-8'), {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as ImportRow[];
}

async function parseSpreadsheetRows(buffer: Buffer): Promise<ImportRow[]> {
  const workbook = new ExcelJS.Workbook();
  const workbookBuffer = Buffer.from(buffer) as unknown as Parameters<typeof workbook.xlsx.load>[0];
  await workbook.xlsx.load(workbookBuffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];

  const headerRow = worksheet.getRow(1);
  const headerValues = Array.isArray(headerRow.values) ? (headerRow.values as unknown[]) : [];
  const headers = headerValues
    .slice(1)
    .map((value: unknown) => (value == null ? '' : String(value).trim()));

  const rows: ImportRow[] = [];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const rawRow: ImportRow = {};
    let hasValue = false;

    headers.forEach((header: string, index: number) => {
      if (!header) return;

      const cellValue = row.getCell(index + 1).value;
      const normalizedValue =
        cellValue && typeof cellValue === 'object' && 'text' in cellValue
          ? String(cellValue.text)
          : cellValue == null
            ? ''
            : String(cellValue);

      if (normalizedValue.trim() !== '') hasValue = true;
      rawRow[header] = normalizedValue;
    });

    if (hasValue) rows.push(rawRow);
  });

  return rows;
}

export async function parseDriverImportFile(file: Express.Multer.File): Promise<ImportRow[]> {
  if (!file || file.size === 0) {
    throw new ValidationError('Arquivo de importação obrigatório');
  }

  const fileName = file.originalname.toLowerCase();
  let rows: ImportRow[];

  if (fileName.endsWith('.csv')) {
    rows = parseCsvRows(file.buffer);
  } else if (fileName.endsWith('.xlsx')) {
    rows = await parseSpreadsheetRows(file.buffer);
  } else {
    throw new ValidationError('Formato de arquivo inválido. Use CSV ou XLSX.');
  }

  if (rows.length === 0) {
    throw new ValidationError('Arquivo sem linhas válidas para importação');
  }

  return rows.map(mapImportRow);
}
