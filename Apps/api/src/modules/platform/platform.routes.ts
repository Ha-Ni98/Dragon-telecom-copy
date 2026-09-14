import { Router } from 'express';
import multer from 'multer';
import { prisma } from '@common/db/prisma';
import { validateRequest } from '@common/middlewares/validate-request.middleware';
import { requireAuth } from '@common/middlewares/auth.middleware';
import {
  IMAGE_MAX_UPLOAD_BYTES,
  PLATFORM_ROUTES,
  UserType,
  FeeQuerySchema,
  FeesExportQuerySchema,
  UploadImageSchema,
  UpsertFeesSchema,
  UpdateSettingsSchema,
} from '@dragon-telecom/contract';
import { PlatformService, SequenceService, DeliveryFeeService } from './platform.service';
import { PlatformController } from './platform.controller';

const router = Router();

// 1. Manual DI
const service = new PlatformService(prisma);
const controller = new PlatformController(service);

// Exported singletons for downstream document-module DI (SequenceService/DeliveryFeeService —
// the spec's injected-service connection rule). Built once, on the shared `prisma` singleton;
// consumers import these into their own composition roots (plan §6).
export const sequenceService = new SequenceService(prisma);
export const deliveryFeeService = new DeliveryFeeService(prisma);

const adminOnly = requireAuth({ types: [UserType.ADMIN], checkDB: true });

// No upload env knob exists yet (env-template.md lists only AWS_* generically) — an in-code
// constant is the plan §7.2-recommended choice for this single small-file upload.
const upload = multer({
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedMimeTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
    ];
    cb(null, allowedMimeTypes.includes(file.mimetype));
  },
});

// S26.1 — image uploads. memoryStorage because the Fly filesystem is ephemeral and every byte
// goes straight to sharp; the 10 MB ceiling is the contract's IMAGE_MAX_UPLOAD_BYTES so multer,
// the pipeline and the web control all enforce the same number. NO fileFilter on mimetype:
// the type is decided by magic-byte sniffing inside the pipeline, because the declared mimetype
// is attacker-controlled.
const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: IMAGE_MAX_UPLOAD_BYTES, files: 1 },
});

// 2. Routes (validation uses contract schemas per segment)
router.get(PLATFORM_ROUTES.WILAYAS, controller.listWilayas);
router.get(PLATFORM_ROUTES.FEE, validateRequest({ query: FeeQuerySchema }), controller.resolveFee);
router.get(PLATFORM_ROUTES.SETTINGS_PUBLIC, controller.getPublicSettings);

router.get(PLATFORM_ROUTES.ADMIN_FEES, adminOnly, controller.getAdminFees);
router.put(PLATFORM_ROUTES.ADMIN_FEES, adminOnly, validateRequest({ body: UpsertFeesSchema }), controller.upsertFees);
router.post(PLATFORM_ROUTES.FEES_IMPORT, adminOnly, upload.single('file'), controller.importFees);
router.get(
  PLATFORM_ROUTES.FEES_EXPORT,
  adminOnly,
  validateRequest({ query: FeesExportQuerySchema }),
  controller.exportFees,
);

router.get(PLATFORM_ROUTES.SETTINGS, adminOnly, controller.getSettings);
router.patch(
  PLATFORM_ROUTES.SETTINGS,
  adminOnly,
  validateRequest({ body: UpdateSettingsSchema }),
  controller.updateSettings,
);

router.post(
  PLATFORM_ROUTES.ADMIN_MEDIA_IMAGE,
  adminOnly,
  uploadImage.single('image'),
  validateRequest({ body: UploadImageSchema }),
  controller.uploadImage,
);

export { router };
