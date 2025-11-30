/**
 * Mock for @prisma/client/runtime/library
 *
 * This prevents Prisma engine initialization which causes 100% CPU loops.
 * Only mocks the types/classes that are actually imported in our codebase.
 */

// Mock Decimal class - used by disk-monitor.service.ts
export class Decimal {
  private value: string;

  constructor(value: string | number | Decimal) {
    if (value instanceof Decimal) {
      this.value = value.value;
    } else {
      this.value = String(value);
    }
  }

  toString(): string {
    return this.value;
  }

  toNumber(): number {
    return parseFloat(this.value);
  }

  toFixed(decimalPlaces?: number): string {
    return this.toNumber().toFixed(decimalPlaces);
  }

  valueOf(): number {
    return this.toNumber();
  }

  // Static methods
  static add(a: Decimal | string | number, b: Decimal | string | number): Decimal {
    return new Decimal(new Decimal(a).toNumber() + new Decimal(b).toNumber());
  }

  static sub(a: Decimal | string | number, b: Decimal | string | number): Decimal {
    return new Decimal(new Decimal(a).toNumber() - new Decimal(b).toNumber());
  }

  static mul(a: Decimal | string | number, b: Decimal | string | number): Decimal {
    return new Decimal(new Decimal(a).toNumber() * new Decimal(b).toNumber());
  }

  static div(a: Decimal | string | number, b: Decimal | string | number): Decimal {
    return new Decimal(new Decimal(a).toNumber() / new Decimal(b).toNumber());
  }
}

// Export other commonly used types as mocks
export const DMMF = {};
export const DMMFClass = class {};
export const PrismaClientValidationError = class extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PrismaClientValidationError';
  }
};

export const PrismaClientKnownRequestError = class extends Error {
  code: string;
  clientVersion: string;
  meta?: Record<string, unknown>;

  constructor(message: string, { code, clientVersion, meta }: { code: string; clientVersion: string; meta?: Record<string, unknown> }) {
    super(message);
    this.name = 'PrismaClientKnownRequestError';
    this.code = code;
    this.clientVersion = clientVersion;
    this.meta = meta;
  }
};

export const PrismaClientInitializationError = class extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PrismaClientInitializationError';
  }
};

export const PrismaClientRustPanicError = class extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PrismaClientRustPanicError';
  }
};

export const PrismaClientUnknownRequestError = class extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PrismaClientUnknownRequestError';
  }
};

// Default export for CommonJS compatibility
export default {
  Decimal,
  DMMF,
  DMMFClass,
  PrismaClientValidationError,
  PrismaClientKnownRequestError,
  PrismaClientInitializationError,
  PrismaClientRustPanicError,
  PrismaClientUnknownRequestError,
};
