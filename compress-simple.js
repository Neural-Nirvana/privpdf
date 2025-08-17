// Simple PDF compression without PDF.js workers
async function simpleCompressPDF(file, quality) {
    try {
        const arrayBuffer = await file.arrayBuffer();
        
        // Use PDF-lib for basic compression
        const pdf = await PDFLib.PDFDocument.load(arrayBuffer);
        
        // Compression techniques based on quality
        const saveOptions = {
            useObjectStreams: quality < 7, // Use object streams for better compression
            addDefaultPage: false,
            objectsPerTick: quality < 5 ? 25 : 50 // Smaller chunks for better compression
        };
        
        // Additional compression for lower quality settings
        if (quality <= 5) {
            try {
                const pages = pdf.getPages();
                
                // Only attempt scaling if we have pages and they support these operations
                if (pages && pages.length > 0) {
                    pages.forEach((page, index) => {
                        try {
                            // Check if page has required methods before attempting operations
                            if (typeof page.getSize === 'function' && typeof page.scale === 'function') {
                                const { width, height } = page.getSize();
                                
                                // Only scale if dimensions are valid
                                if (width > 0 && height > 0) {
                                    const scaleFactor = quality <= 3 ? 0.9 : 0.95;
                                    page.scale(scaleFactor, scaleFactor);
                                }
                            }
                        } catch (pageError) {
                            console.warn(`Could not compress page ${index + 1}:`, pageError);
                        }
                    });
                }
            } catch (pagesError) {
                console.warn('Could not access pages for compression:', pagesError);
            }
        }
        
        // Remove unnecessary metadata for compression
        if (quality <= 4) {
            try {
                // Only attempt metadata operations if methods exist
                if (typeof pdf.setCreator === 'function') {
                    pdf.setCreator('');
                }
                if (typeof pdf.setProducer === 'function') {
                    pdf.setProducer('PrivPDF Compressed');
                }
                if (typeof pdf.setKeywords === 'function') {
                    pdf.setKeywords([]);
                }
            } catch (metaError) {
                console.warn('Could not modify metadata:', metaError);
            }
        }
        
        const compressedBytes = await pdf.save(saveOptions);
        
        return {
            success: true,
            data: compressedBytes,
            originalSize: file.size,
            compressedSize: compressedBytes.length,
            reduction: ((1 - compressedBytes.length / file.size) * 100).toFixed(1)
        };
        
    } catch (error) {
        console.error('Simple compression failed:', error);
        
        // Ultra-safe fallback - just reprocess with basic compression
        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await PDFLib.PDFDocument.load(arrayBuffer);
            
            // Just save with basic compression - no modifications
            const compressedBytes = await pdf.save({ 
                useObjectStreams: true,
                addDefaultPage: false 
            });
            
            return {
                success: true,
                data: compressedBytes,
                originalSize: file.size,
                compressedSize: compressedBytes.length,
                reduction: ((1 - compressedBytes.length / file.size) * 100).toFixed(1)
            };
        } catch (fallbackError) {
            console.error('Fallback compression also failed:', fallbackError);
            return {
                success: false,
                error: fallbackError.message
            };
        }
    }
}

// Export for use in main script
window.simpleCompressPDF = simpleCompressPDF;