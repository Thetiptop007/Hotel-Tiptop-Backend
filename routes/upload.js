const express = require('express');
const { upload, uploadDocument, deleteDocument } = require('../controllers/upload');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(protect);

// @route   POST /api/upload/document
// @desc    Upload document to Cloudinary
// @access  Private
router.post('/document', upload.single('document'), uploadDocument);

// @route   DELETE /api/upload/document/:publicId
// @desc    Delete document from Cloudinary
// @access  Private
router.delete('/document/:publicId', deleteDocument);

module.exports = router;
