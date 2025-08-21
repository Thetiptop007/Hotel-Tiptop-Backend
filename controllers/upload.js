const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure multer storage for Cloudinary
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'hotel-documents',
        allowed_formats: ['jpg', 'jpeg', 'png', 'pdf'],
        resource_type: 'auto',
        public_id: (req, file) => {
            // Generate unique public ID
            const timestamp = Date.now();
            const originalName = file.originalname.split('.')[0];
            return `${originalName}-${timestamp}`;
        }
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        // Check file type
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only JPEG, PNG, and PDF files are allowed.'), false);
        }
    }
});

// @desc    Upload document to Cloudinary
// @route   POST /api/upload/document
// @access  Private
exports.uploadDocument = async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Document uploaded successfully',
            data: {
                url: req.file.path,
                publicId: req.file.filename,
                originalName: req.file.originalname,
                size: req.file.size,
                format: req.file.format || req.file.mimetype
            }
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({
            success: false,
            message: 'Error uploading document',
            error: error.message
        });
    }
};

// @desc    Delete document from Cloudinary
// @route   DELETE /api/upload/document/:publicId
// @access  Private
exports.deleteDocument = async (req, res, next) => {
    try {
        const { publicId } = req.params;

        if (!publicId) {
            return res.status(400).json({
                success: false,
                message: 'Public ID is required'
            });
        }

        const result = await cloudinary.uploader.destroy(publicId);

        res.status(200).json({
            success: true,
            message: 'Document deleted successfully',
            data: result
        });
    } catch (error) {
        console.error('Delete error:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting document',
            error: error.message
        });
    }
};

module.exports = {
    upload,
    uploadDocument: exports.uploadDocument,
    deleteDocument: exports.deleteDocument
};
