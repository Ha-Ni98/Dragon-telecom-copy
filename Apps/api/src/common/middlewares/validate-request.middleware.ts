import type { Request, Response, NextFunction } from 'express';
import type { z } from 'zod';

type Schemas = { body?: z.ZodType; query?: z.ZodType; params?: z.ZodType };

// this function is to normalize the request for empty string
function normalizeEmptyStrings(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeEmptyStrings);
  }

  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, val]) => [
        key,
        normalizeEmptyStrings(val),
      ]),
    );
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (trimmed === "") return undefined;
    if (trimmed === "null") return null;
    if (trimmed === "undefined") return undefined;
  }

  return value;
}

export const validateRequest =
  (schemas: Schemas) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    try {
      
      const body = normalizeEmptyStrings(req.body);
      const query = normalizeEmptyStrings(req.query);
      const params = normalizeEmptyStrings(req.params);

      req.validated = {
        body: schemas.body ? schemas.body.parse(req.body) : undefined,
        query: schemas.query ? schemas.query.parse(req.query) : undefined,
        params: schemas.params ? schemas.params.parse(req.params) : undefined,
      };
      next();
    } catch (err) {
      next(err); // ZodError → global handler → 400 VALIDATION_ERROR
    }
  };
