import path from 'path';
import type { MessageAttachment } from '../types/message.types';

/** Builds the stored attachment fields from a multer upload, if one was sent. */
export function buildAttachment (file: Express.Multer.File | undefined): MessageAttachment {
  if (!file) {
    return {};
  }

  return {
    fileName: file.originalname,
    fileSize: file.size,
    fileUrl: `/api/uploads/${path.basename(file.path)}`,
  };
}
