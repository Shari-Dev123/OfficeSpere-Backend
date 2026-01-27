// config/multer.js
// Multer configuration for file uploads (avatars, documents, reports)

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directories exist
const createUploadDirs = () => {
  const dirs = [
    './uploads',
    './uploads/avatars',
    './uploads/documents',
    './uploads/reports'
  ];

  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
};

createUploadDirs();

// Storage configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    let uploadPath = './uploads/';

    // Determine upload path based on file type or request
    if (req.path.includes('avatar') || file.fieldname === 'avatar') {
      uploadPath += 'avatars/';
    } else if (req.path.includes('report') || file.fieldname === 'report') {
      uploadPath += 'reports/';
    } else {
      uploadPath += 'documents/';
    }

    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    // Generate unique filename: userId_timestamp_originalname
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const userId = req.user ? req.user.id : 'unknown';
    const ext = path.extname(file.originalname);
    const nameWithoutExt = path.basename(file.originalname, ext);
    
    cb(null, `${userId}_${uniqueSuffix}_${nameWithoutExt}${ext}`);
  }
});

// File filter - only allow certain file types
const fileFilter = (req, file, cb) => {
  // Allowed file extensions
  const allowedImageTypes = /jpeg|jpg|png|gif|webp/;
  const allowedDocTypes = /pdf|doc|docx|xls|xlsx|txt|csv/;
  
  const extname = path.extname(file.originalname).toLowerCase();
  const mimetype = file.mimetype;

  // Check if it's an image
  if (file.fieldname === 'avatar') {
    const isValidImage = allowedImageTypes.test(extname.slice(1)) && 
                         mimetype.startsWith('image/');
    
    if (isValidImage) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, JPG, PNG, GIF, WEBP) are allowed for avatars!'), false);
    }
  } 
  // Check if it's a document
  else {
    const isValidDoc = allowedDocTypes.test(extname.slice(1));
    
    if (isValidDoc) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, DOC, DOCX, XLS, XLSX, TXT, CSV files are allowed!'), false);
    }
  }
};

// Multer configuration
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max file size
  },
  fileFilter: fileFilter
});

// Export different upload types
module.exports = {
  // Single file upload
  uploadAvatar: upload.single('avatar'),
  uploadDocument: upload.single('document'),
  uploadReport: upload.single('report'),
  
  // Multiple file uploads
  uploadMultipleDocuments: upload.array('documents', 5), // Max 5 files
  
  // Multiple fields
  uploadMixed: upload.fields([
    { name: 'avatar', maxCount: 1 },
    { name: 'documents', maxCount: 5 }
  ]),

  // Delete file helper
  deleteFile: (filePath) => {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  }
};