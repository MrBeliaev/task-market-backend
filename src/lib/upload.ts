import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import multer from 'multer';

export const UPLOAD_DIR: string = path.join(process.cwd(), 'uploads');

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const ALLOWED_EXTENSIONS: RegExp = /\.(jpg|jpeg|png|gif|webp|pdf|txt|md|zip|rar|7z)$/i;
const MAX_FILE_SIZE: number = 10 * 1024 * 1024; // 10 MB

export const upload: multer.Multer = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => {
      const ext: string = path.extname(file.originalname).toLowerCase();
      cb(null, `${randomUUID()}${ext}`);
    },
  }),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_EXTENSIONS.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed. Allowed: images, PDF, text, zip'));
    }
  },
});
