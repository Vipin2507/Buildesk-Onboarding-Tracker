export type PaymentRemarkImage = {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  url: string;
};

export type PaymentRemark = {
  id: string;
  accountId: string;
  body: string;
  image?: PaymentRemarkImage;
  createdByUserId?: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
};

export const PAYMENT_REMARK_MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export const PAYMENT_REMARK_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export function isPaymentRemarkImageMime(mimeType: string) {
  const mime = mimeType.toLowerCase();
  return (PAYMENT_REMARK_IMAGE_MIME_TYPES as readonly string[]).includes(mime);
}
