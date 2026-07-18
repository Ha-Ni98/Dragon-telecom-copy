import { faker } from '@faker-js/faker';
import { CreateRepairSchema, ReportedIssue, type CreateRepairCommand } from '@dragon-telecom/contract';

export const makeCreateRepairCommand = (overrides: Partial<CreateRepairCommand> = {}): CreateRepairCommand =>
  CreateRepairSchema.parse({
    customerName: faker.person.fullName(),
    customerPhone: faker.string.numeric(10),
    reportedIssues: [ReportedIssue.CHARGING],
    ...overrides,
  });
