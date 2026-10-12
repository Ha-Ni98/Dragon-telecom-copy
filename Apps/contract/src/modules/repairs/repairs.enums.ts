export enum RepairStatus {
  INTAKE = 'INTAKE',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  PICKED_UP = 'PICKED_UP',
  CANCELLED = 'CANCELLED',
  // S30 — reachable only from PICKED_UP (the return document); terminal and read-only.
  RETURNED = 'RETURNED',
}

export enum ReportedIssue {
  CHARGING = 'charging',
  DISPLAY = 'display',
  BATTERY = 'battery',
  CAMERA = 'camera',
  SPEAKER = 'speaker',
  MICROPHONE = 'microphone',
  WATER_DAMAGE = 'water-damage',
  SOFTWARE = 'software',
  OTHER = 'other',
}
