const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

class CloudinaryService {
    // Delete single image by public ID
    async deleteImage(publicId) {
        try {
            const result = await cloudinary.uploader.destroy(publicId);
            return {
                success: true,
                result: result
            };
        } catch (error) {
            console.error('Cloudinary delete error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Delete multiple images by public IDs
    async deleteImages(publicIds) {
        try {
            const results = await Promise.all(
                publicIds.map(publicId => this.deleteImage(publicId))
            );

            const successful = results.filter(r => r.success).length;
            const failed = results.filter(r => !r.success).length;

            return {
                success: failed === 0,
                successful,
                failed,
                results
            };
        } catch (error) {
            console.error('Cloudinary bulk delete error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Extract public ID from Cloudinary URL
    extractPublicId(cloudinaryUrl) {
        try {
            const parts = cloudinaryUrl.split('/');
            const filename = parts[parts.length - 1];
            // Remove file extension
            const publicId = filename.split('.')[0];
            // If it's in a folder, include folder path
            const uploadIndex = parts.findIndex(part => part === 'upload');
            if (uploadIndex !== -1 && uploadIndex + 2 < parts.length - 1) {
                const folderPath = parts.slice(uploadIndex + 2, -1).join('/');
                return folderPath ? `${folderPath}/${publicId}` : publicId;
            }
            return publicId;
        } catch (error) {
            console.error('Error extracting public ID:', error);
            return null;
        }
    }

    // Extract public IDs from an array of Cloudinary URLs
    extractPublicIds(cloudinaryUrls) {
        return cloudinaryUrls
            .map(url => this.extractPublicId(url))
            .filter(id => id !== null);
    }
}

module.exports = new CloudinaryService();
