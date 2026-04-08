import { parse as parseCsv } from 'csv-parse/sync';
import ExcelJS from 'exceljs';
import { FineSeverity, FineStatus } from '@frota-leve/shared';
import type {
  FineSeverity as DatabaseFineSeverity,
  FineStatus as DatabaseFineStatus,
} from '@frota-leve/database';
import { prisma } from '../../config/database';
import { ValidationError } from '../../shared/errors';
import type { FineActorContext } from './fines.types';

// ─── Tipos internos ───────────────────────────────────────────────────────────

type RawRow = Record<string, string>;

type ParsedRow = {
  row: number;
  plate: string;
  driverCpf: string | null;
  date: Date;
  autoNumber: string;
  location: string;
  description: string;
  severity: FineSeverity;
  points: number;
  amount: number;
  discountAmount: number | null;
  dueDate: Date;
  payrollDeduction: boolean;
  notes: string | null;
  fileUrl: string | null;
};

type RowError = {
  row: number;
  message: string;
};

export type FineImportResult = {
  total: number;
  imported: number;
  failed: number;
  errors: RowError[];
};

// ─── Mapeamento de colunas ────────────────────────────────────────────────────

const COLUMN_MAP: Record<string, string> = {
  data: 'date',
  date: 'date',
  auto: 'autoNumber',
  numero_auto: 'autoNumber',
  num_auto: 'autoNumber',
  autonumber: 'autoNumber',
  placa: 'plate',
  plate: 'plate',
  cpf: 'driverCpf',
  cpf_motorista: 'driverCpf',
  motorista_cpf: 'driverCpf',
  local: 'location',
  local_infracao: 'location',
  location: 'location',
  descricao: 'description',
  description: 'description',
  gravidade: 'severity',
  severity: 'severity',
  pontos: 'points',
  points: 'points',
  valor: 'amount',
  amount: 'amount',
  valor_multa: 'amount',
  desconto: 'discountAmount',
  valor_desconto: 'discountAmount',
  discount_amount: 'discountAmount',
  vencimento: 'dueDate',
  due_date: 'dueDate',
  data_vencimento: 'dueDate',
  desconto_folha: 'payrollDeduction',
  payroll_deduction: 'payrollDeduction',
  observacoes: 'notes',
  notes: 'notes',
  arquivo: 'fileUrl',
  file_url: 'fileUrl',
  url_arquivo: 'fileUrl',
};

// ─── Mapeamento de gravidade (PT → enum) ──────────────────────────────────────

const SEVERITY_MAP: Record<string, FineSeverity> = {
  leve: FineSeverity.LIGHT,
  light: FineSeverity.LIGHT,
  media: FineSeverity.MEDIUM,
  média: FineSeverity.MEDIUM,
  medium: FineSeverity.MEDIUM,
  grave: FineSeverity.SERIOUS,
  serious: FineSeverity.SERIOUS,
  gravissima: FineSeverity.VERY_SERIOUS,
  gravíssima: FineSeverity.VERY_SERIOUS,
  very_serious: FineSeverity.VERY_SERIOUS,
  veryseriou: FineSeverity.VERY_SERIOUS,
  // valores diretos do enum também aceitos
  [FineSeverity.LIGHT]: FineSeverity.LIGHT,
  [FineSeverity.MEDIUM]: FineSeverity.MEDIUM,
  [FineSeverity.SERIOUS]: FineSeverity.SERIOUS,
  [FineSeverity.VERY_SERIOUS]: FineSeverity.VERY_SERIOUS,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeHeader(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/\s+/g, '_');
}

function mapHeaders(rawRow: RawRow): Record<string, string> {
  const mapped: Record<string, string> = {};

  for (const [rawKey, value] of Object.entries(rawRow)) {
    const normalized = normalizeHeader(rawKey);
    const field = COLUMN_MAP[normalized];
    if (field) {
      mapped[field] = String(value ?? '').trim();
    }
  }

  return mapped;
}

function parseDate(value: string, fieldName: string): Date {
  if (!value) throw new ValidationError(`Campo "${fieldName}" é obrigatório`);

  // Suporta ISO 8601, DD/MM/YYYY e YYYY-MM-DD
  const isoMatch = /^\d{4}-\d{2}-\d{2}/.exec(value);
  const brMatch = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(value);

  let date: Date;

  if (isoMatch) {
    date = new Date(value);
  } else if (brMatch) {
    date = new Date(`${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`);
  } else {
    date = new Date(value);
  }

  if (isNaN(date.getTime())) {
    throw new ValidationError(`Campo "${fieldName}" com data inválida: "${value}"`);
  }

  return date;
}

function parseNumber(value: string, fieldName: string, required = true): number | null {
  if (!value || value === '') {
    if (required) throw new ValidationError(`Campo "${fieldName}" é obrigatório`);
    return null;
  }

  const normalized = value.replace(',', '.');
  const num = Number(normalized);

  if (isNaN(num) || num < 0) {
    throw new ValidationError(`Campo "${fieldName}" com valor inválido: "${value}"`);
  }

  return num;
}

function parseSeverity(value: string): FineSeverity {
  const normalized = (value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const severity = SEVERITY_MAP[normalized];

  if (!severity) {
    throw new ValidationError(
      `Gravidade inválida: "${value}". Use: LEVE, MEDIA, GRAVE ou GRAVISSIMA`,
    );
  }

  return severity;
}

function parseBool(value: string): boolean {
  const normalized = (value ?? '').trim().toLowerCase();
  return ['true', '1', 'sim', 'yes', 's', 'y'].includes(normalized);
}

function parseRow(raw: RawRow, rowNumber: number): ParsedRow {
  const mapped = mapHeaders(raw);

  const requiredFields = [
    'plate',
    'date',
    'autoNumber',
    'location',
    'description',
    'severity',
    'points',
    'amount',
    'dueDate',
  ];
  for (const field of requiredFields) {
    if (!mapped[field]) {
      throw new ValidationError(`Coluna obrigatória ausente ou vazia: "${field}"`);
    }
  }

  const plate = mapped['plate'];
  const date = mapped['date'];
  const autoNumber = mapped['autoNumber'];
  const location = mapped['location'];
  const description = mapped['description'];
  const severity = mapped['severity'];
  const points = mapped['points'];
  const amount = mapped['amount'];
  const dueDate = mapped['dueDate'];

  return {
    row: rowNumber,
    plate: plate.toUpperCase(),
    driverCpf: mapped['driverCpf'] || null,
    date: parseDate(date, 'data'),
    autoNumber,
    location,
    description,
    severity: parseSeverity(severity),
    points: Math.round(parseNumber(points, 'pontos') as number),
    amount: parseNumber(amount, 'valor') as number,
    discountAmount: parseNumber(mapped['discountAmount'] ?? '', 'valor_desconto', false),
    dueDate: parseDate(dueDate, 'vencimento'),
    payrollDeduction: parseBool(mapped['payrollDeduction'] ?? ''),
    notes: mapped['notes'] || null,
    fileUrl: mapped['fileUrl'] || null,
  };
}

// ─── Parsers de arquivo ───────────────────────────────────────────────────────

function parseCsvBuffer(buffer: Buffer): RawRow[] {
  return parseCsv(buffer, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  }) as RawRow[];
}

async function parseXlsxBuffer(buffer: Buffer): Promise<RawRow[]> {
  const workbook = new ExcelJS.Workbook();
  // ExcelJS declara load(buffer: Buffer) sem generic — incompatível com @types/node >= 22
  // @ts-expect-error TS2345
  await workbook.xlsx.load(buffer);

  const worksheet = workbook.worksheets[0];

  if (!worksheet) throw new ValidationError('Arquivo XLSX sem planilhas');

  const rows: RawRow[] = [];
  let headers: string[] = [];

  worksheet.eachRow((row, rowNumber) => {
    const values = (row.values as (ExcelJS.CellValue | null)[]).slice(1); // remove índice 0

    if (rowNumber === 1) {
      headers = values.map((v) => String(v ?? ''));
      return;
    }

    if (values.every((v) => v === null || v === undefined || v === '')) return;

    const rowObj: RawRow = {};
    headers.forEach((header, i) => {
      const cell = values[i];
      rowObj[header] = cell instanceof Date ? cell.toISOString() : String(cell ?? '');
    });

    rows.push(rowObj);
  });

  return rows;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class FinesImportService {
  async importFromFile(
    context: FineActorContext,
    file: Express.Multer.File,
  ): Promise<FineImportResult> {
    const { tenantId, userId, ipAddress, userAgent } = context;

    const isXlsx =
      /\.xlsx?$/i.test(file.originalname) ||
      file.mimetype.includes('spreadsheet') ||
      file.mimetype.includes('excel');

    const rawRows: RawRow[] = isXlsx
      ? await parseXlsxBuffer(file.buffer)
      : parseCsvBuffer(file.buffer);

    if (rawRows.length === 0) {
      throw new ValidationError('Arquivo sem registros para importar');
    }

    if (rawRows.length > 500) {
      throw new ValidationError('Limite de 500 registros por importação');
    }

    // ── 1. Parsear e validar todas as linhas ──────────────────────────────────
    const validRows: ParsedRow[] = [];
    const errors: RowError[] = [];

    rawRows.forEach((raw, index) => {
      const rowNumber = index + 2; // +2: 1-indexed + header
      try {
        validRows.push(parseRow(raw, rowNumber));
      } catch (err) {
        errors.push({
          row: rowNumber,
          message: err instanceof Error ? err.message : 'Erro desconhecido',
        });
      }
    });

    if (validRows.length === 0) {
      return { total: rawRows.length, imported: 0, failed: errors.length, errors };
    }

    // ── 2. Resolver veículos por placa (batch) ────────────────────────────────
    const uniquePlates = [...new Set(validRows.map((r) => r.plate))];
    const vehicles = await prisma.vehicle.findMany({
      where: { tenantId, plate: { in: uniquePlates } },
      select: { id: true, plate: true },
    });
    const vehicleByPlate = new Map(vehicles.map((v) => [v.plate, v.id]));

    // ── 3. Resolver motoristas por CPF (batch) ────────────────────────────────
    const uniqueCpfs = [...new Set(validRows.map((r) => r.driverCpf).filter(Boolean))] as string[];
    const drivers = uniqueCpfs.length
      ? await prisma.driver.findMany({
          where: { tenantId, cpf: { in: uniqueCpfs } },
          select: { id: true, cpf: true },
        })
      : [];
    const driverByCpf = new Map(drivers.map((d) => [d.cpf, d.id]));

    // ── 4. Resolver IDs e filtrar linhas com veículo válido ───────────────────
    type ReadyRow = {
      row: number;
      vehicleId: string;
      driverId: string | null;
      data: ParsedRow;
    };

    const readyRows: ReadyRow[] = [];

    for (const parsed of validRows) {
      const vehicleId = vehicleByPlate.get(parsed.plate);

      if (!vehicleId) {
        errors.push({ row: parsed.row, message: `Placa não encontrada: ${parsed.plate}` });
        continue;
      }

      const driverId = parsed.driverCpf ? (driverByCpf.get(parsed.driverCpf) ?? null) : null;

      if (parsed.driverCpf && !driverId) {
        errors.push({
          row: parsed.row,
          message: `Motorista com CPF ${parsed.driverCpf} não encontrado`,
        });
        continue;
      }

      readyRows.push({ row: parsed.row, vehicleId, driverId, data: parsed });
    }

    if (readyRows.length === 0) {
      return { total: rawRows.length, imported: 0, failed: errors.length, errors };
    }

    // ── 5. Inserção em lote ───────────────────────────────────────────────────
    const now = new Date();

    await prisma.$transaction(async (tx) => {
      await tx.fine.createMany({
        data: readyRows.map(({ vehicleId, driverId, data }) => ({
          tenantId,
          vehicleId,
          driverId,
          date: data.date,
          autoNumber: data.autoNumber,
          location: data.location,
          description: data.description,
          severity: data.severity as unknown as DatabaseFineSeverity,
          points: data.points,
          amount: data.amount,
          discountAmount: data.discountAmount,
          dueDate: data.dueDate,
          status: FineStatus.PENDING as unknown as DatabaseFineStatus,
          payrollDeduction: data.payrollDeduction,
          notes: data.notes,
          fileUrl: data.fileUrl,
          updatedAt: now,
        })),
        skipDuplicates: true,
      });

      await tx.auditLog.create({
        data: {
          tenantId,
          userId,
          action: 'FINES_IMPORTED',
          entity: 'Fine',
          entityId: tenantId,
          changes: {
            imported: readyRows.length,
            failed: errors.length,
            total: rawRows.length,
          },
          ipAddress,
          userAgent,
        },
      });
    });

    return {
      total: rawRows.length,
      imported: readyRows.length,
      failed: errors.length,
      errors,
    };
  }
}

export const finesImportService = new FinesImportService();
