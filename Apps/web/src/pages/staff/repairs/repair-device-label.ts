import type { RepairDto } from "@dragon-telecom/contract";

// S29 — the intake dialog's default for Repair.deviceLabel: "Samsung S24 Ultra". Blanks dropped so
// a brand chosen before its model yields "Samsung", not "Samsung ".
export function buildDeviceLabelDefault(brandName?: string, modelName?: string): string {
  return [brandName, modelName].filter(Boolean).join(" ");
}

// S29 — what to show wherever a repair's device is named. The stored free-text label WINS over the
// brand/model pair: from S29 on it is prefilled from that pair and then freely editable, so a label
// that differs from brand+model is the technician's correction and must not be overruled by a
// derived string. `?? ""` is not enough — the intake form posts "" for an untouched optional text
// input (the same shape deviceImei/reportedIssueOther have always had), so the blank must fall
// through to the pair.
export function formatRepairDeviceLabel(device: RepairDto["device"]): string {
  return device.label?.trim() || buildDeviceLabelDefault(device.brand?.name, device.model?.name);
}
