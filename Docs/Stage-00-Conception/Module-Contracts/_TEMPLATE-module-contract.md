# [Module Name] Module Contract

> Full-lifecycle spec for one module. Each section is tagged by consumer: Stage 1 reads only
> the `[CONTRACT]` sections; Stage 2 reads the `[BACKEND]` ones. Copy this file to
> `Module-Contracts/[module].md` and fill it in. See `delivery-company.md` for a worked example.

## API Interface [CONTRACT]
- **Routes:** the `[MODULE]_ROUTES` constant (UPPERCASE keys), one line per endpoint (method + path).
- **Access control:** who may call each route (public / any authenticated / specific roles).
- **Input validation:** the Command (writes) and Query (reads) schemas, field by field.
- **Output DTOs:** the response DTO schema(s) — schema-derived types only (`z.infer`), ISO-string dates.

## Events [CONTRACT]
- **Emits:** event names + payload DTOs this module publishes on the bus.
- **Listens:** events from other modules this one reacts to.
- (Leave empty if the module has no realtime concerns.)

## Business Logic [BACKEND]
- The service steps for each route (hashing, DB calls, transactions, invariants enforced).

## Data Mapping [BACKEND]
- Mapper rules: entity → DTO. Exclude sensitive fields; convert `Date` → ISO string.

## Technical Constraints [BACKEND]
- Anything the implementation must honor (e.g. "hash with Argon2", "wrap X and Y in one transaction").

## Test Scenarios [BACKEND]
- Status codes and edge cases per route (happy path, validation failure, not-found, conflict, auth).
