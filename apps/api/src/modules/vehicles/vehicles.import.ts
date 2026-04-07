import ExcelJS from 'exceljs';
import { parse as parseCsv } from 'csv-parse/sync';
import { ValidationError } from '../../shared/errors';

type ImportRow = Record<string, unknown>;

const importColumnAliases: Record<string, string> = {
  acquisition_date: 'acquisitionDate',
  acquisition_value: 'acquisitionValue',
  ano: 'year',
  ano_fabricacao: 'year',
  ano_modelo: 'yearModel',
  average_consumption: 'averageConsumption',
  brand: 'brand',
  categoria: 'category',
  category: 'category',
  chassi: 'chassis',
  chassis: 'chassis',
  color: 'color',
  combustivel: 'fuelType',
  cor: 'color',
  current_driver_id: 'currentDriverId',
  current_mileage: 'currentMileage',
  data_aquisicao: 'acquisitionDate',
  expected_consumption: 'expectedConsumption',
  fuel_type: 'fuelType',
  fueltype: 'fuelType',
  km: 'currentMileage',
  marca: 'brand',
  model: 'model',
  modelo: 'model',
  notes: 'notes',
  observacao: 'notes',
  observacoes: 'notes',
  photo_urls: 'photos',
  photos: 'photos',
  placa: 'plate',
  plate: 'plate',
  quilometragem: 'currentMileage',
  renavam: 'renavam',
  status: 'status',
  tipo_combustivel: 'fuelType',
  valor_aquisicao: 'acquisitionValue',
  year: 'year',
  year_model: 'yearModel',
  yearmodel: 'yearModel',
};

const fuelAliases: Record<string, string> = {
  diesel: 'DIESEL',
  diesel_s10: 'DIESEL_S10',
  diesels10: 'DIESEL_S10',
  electric: 'ELECTRIC',
  eletrico: 'ELECTRIC',
  ethanol: 'ETHANOL',
  etanol: 'ETHANOL',
  gasolina: 'GASOLINE',
  gasoline: 'GASOLINE',
  gnv: 'GNV',
  hibrido: 'HYBRID',
  hybrid: 'HYBRID',
};

const categoryAliases: Record<string, string> = {
  bus: 'BUS',
  heavy: 'HEAVY',
  leve: 'LIGHT',
  light: 'LIGHT',
  machine: 'MACHINE',
  maquina: 'MACHINE',
  moto: 'MOTORCYCLE',
  motorcycle: 'MOTORCYCLE',
  onibus: 'BUS',
  pesado: 'HEAVY',
};

const statusAliases: Record<string, string> = {
  active: 'ACTIVE',
  ativo: 'ACTIVE',
  baixado: 'DECOMMISSIONED',
  decommissioned: 'DECOMMISSIONED',
  desativado: 'DECOMMISSIONED',
  incident: 'INCIDENT',
  maintenance: 'MAINTENANCE',
  manutencao: 'MAINTENANCE',
  reserve: 'RESERVE',
  reserva: 'RESERVE',
  sinistro: 'INCIDENT',
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

function mapEnumValue(value: unknown, aliases: Record<string, string>): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return undefined;
  }

  return aliases[normalizeToken(trimmed)] ?? trimmed.toUpperCase();
}

function mapPhotos(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  const parts = value
    .split(/[,\n;]+/g)
    .map((item) => item.trim())
    .filter(Boolean);

  return parts.length > 0 ? parts : undefined;
}

function mapImportRow(row: ImportRow): ImportRow {
  const mappedRow: ImportRow = {};

  for (const [key, value] of Object.entries(row)) {
    const mappedKey = normalizeColumnName(key);

    if (!mappedKey) {
      continue;
    }

    mappedRow[mappedKey] = value;
  }

  if ('fuelType' in mappedRow) {
    mappedRow['fuelType'] = mapEnumValue(mappedRow['fuelType'], fuelAliases);
  }

  if ('category' in mappedRow) {
    mappedRow['category'] = mapEnumValue(mappedRow['category'], categoryAliases);
  }

  if ('status' in mappedRow) {
    mappedRow['status'] = mapEnumValue(mappedRow['status'], statusAliases);
  }

  if ('photos' in mappedRow) {
    mappedRow['photos'] = mapPhotos(mappedRow['photos']);
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

  if (!worksheet) {
    return [];
  }

  const headerRow = worksheet.getRow(1);
  const headerValues = Array.isArray(headerRow.values) ? (headerRow.values as unknown[]) : [];
  const headers = headerValues
    .slice(1)
    .map((value: unknown) => (value == null ? '' : String(value).trim()));

  const rows: ImportRow[] = [];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      return;
    }

    const rawRow: ImportRow = {};
    let hasValue = false;

    headers.forEach((header: string, index: number) => {
      if (!header) {
        return;
      }

      const cellValue = row.getCell(index + 1).value;
      const normalizedValue =
        cellValue && typeof cellValue === 'object' && 'text' in cellValue
          ? String(cellValue.text)
          : cellValue == null
            ? ''
            : String(cellValue);

      if (normalizedValue.trim() !== '') {
        hasValue = true;
      }

      rawRow[header] = normalizedValue;
    });

    if (hasValue) {
      rows.push(rawRow);
    }
  });

  return rows;
}

export async function parseVehicleImportFile(file: Express.Multer.File): Promise<ImportRow[]> {
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
