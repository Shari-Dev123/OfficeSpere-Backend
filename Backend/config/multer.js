// ============================================
// Multer Configuration - FILE UPLOADS
// ============================================

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ============================================
// STORAGE CONFIGURATION
// ============================================

// Avatar storage
const avatarStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = 'uploads/avatars';
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'avatar-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Document storage
const documentStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = 'uploads/documents';
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'doc-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Report storage
const reportStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = 'uploads/reports';
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'report-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// ✅ PROJECT FILES STORAGE (NEW)
const projectStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = 'uploads/projects';
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.]/g, '_');
    cb(null, 'project-' + uniqueSuffix + '-' + sanitizedName);
  }
});

// ============================================
// FILE FILTERS
// ============================================

// Image filter (for avatars)
const imageFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (jpeg, jpg, png, gif)'));
  }
};

// Document filter (for documents and reports)
const documentFilter = (req, file, cb) => {
  const allowedTypes = /pdf|doc|docx|xls|xlsx|txt|csv/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());

  if (extname) {
    cb(null, true);
  } else {
    cb(new Error('Only document files are allowed (pdf, doc, docx, xls, xlsx, txt, csv)'));
  }
};

// ✅ Project files filter (more permissive - accepts images, documents, archives)
const projectFileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx|txt|csv|zip|rar|ppt|pptx/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());

  if (extname) {
    cb(null, true);
  } else {
    cb(new Error('File type not allowed. Allowed: images, documents, spreadsheets, presentations, archives'));
  }
};

// ============================================
// MULTER INSTANCES
// ============================================

// Avatar upload (single file)
const uploadAvatar = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: imageFilter
}).single('avatar');

// Document upload (single file)
const uploadDocument = multer({
  storage: documentStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: documentFilter
}).single('document');

// Multiple documents upload
const uploadDocuments = multer({
  storage: documentStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB per file
  fileFilter: documentFilter
}).array('documents', 10); // Max 10 files

// Report upload (single file)
const uploadReport = multer({
  storage: reportStorage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
  fileFilter: documentFilter
}).single('report');

// ✅ PROJECT FILES UPLOAD (NEW - Multiple files)
const uploadProjectFiles = multer({
  storage: projectStorage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB per file
  fileFilter: projectFileFilter
}).array('files', 10); // Max 10 files

// ============================================
// GENERIC UPLOAD FUNCTION (REUSABLE)
// ============================================

/**
 * Generic upload function
 * @param {string} fieldName - Form field name
 * @param {number} maxCount - Maximum number of files
 * @returns {Function} Multer middleware
 */
const uploadMultiple = (fieldName = 'files', maxCount = 10) => {
  return multer({
    storage: projectStorage,
    limits: { fileSize: 20 * 1024 * 1024 }, // 20MB per file
    fileFilter: projectFileFilter
  }).array(fieldName, maxCount);
};

// ============================================
// EXPORTS
// ============================================

module.exports = {
  uploadAvatar,
  uploadDocument,
  uploadDocuments,
  uploadReport,
  uploadProjectFiles,
  uploadMultiple // ✅ Generic reusable upload
};