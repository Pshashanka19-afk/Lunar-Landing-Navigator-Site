export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(message: string, statusCode = 500, code = 'INTERNAL_ERROR', details?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

export class ScientificValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 422, 'SCIENTIFIC_VALIDATION_ERROR', details);
  }
}

export class ScientificResourceUnavailableError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 503, 'SCIENTIFIC_RESOURCE_UNAVAILABLE', details);
  }
}

export class DependencyFailedError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 424, 'FAILED_DEPENDENCY', details);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 404, 'NOT_FOUND', details);
  }
}

export class ComputationLimitExceededError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, 'COMPUTATION_LIMIT_EXCEEDED', details);
  }
}
