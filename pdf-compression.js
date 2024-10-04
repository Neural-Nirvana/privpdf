// Get references to the DOM elements
const pdfInput = document.getElementById('pdfInput');
const compressionQualityInput = document.getElementById('compressionQuality');
const qualityValueDisplay = document.getElementById('qualityValue');
const compressPDFBtn = document.getElementById('compressPDF');
const downloadPDFBtn = document.getElementById('downloadPDF');

let originalPdfBytes, compressedPdfBytes;

// Function to handle quality slider value change
compressionQualityInput.addEventListener('input', (event) => {
    qualityValueDisplay.textContent = event.target.value;
});

// Function to load the PDF file
pdfInput.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (file && file.type === 'application/pdf') {
        const reader = new FileReader();
        reader.onload = async function(e) {
            originalPdfBytes = new Uint8Array(e.target.result);
            console.log("PDF Loaded");

            // Enable the compression button after the PDF is loaded
            compressPDFBtn.style.display = 'block';
        };
        reader.readAsArrayBuffer(file);
    }
});

// Function to compress the PDF
compressPDFBtn.addEventListener('click', async () => {
    if (!originalPdfBytes) {
        alert("Please select a PDF file first.");
        return;
    }

    const quality = compressionQualityInput.value / 10; // Compression quality (0.1 to 1)

    // Load the original PDF document
    const originalPdfDoc = await PDFLib.PDFDocument.load(originalPdfBytes);
    const compressedPdfDoc = await PDFLib.PDFDocument.create();

    // Copy each page from the original PDF to the new PDF
    const pages = await compressedPdfDoc.copyPages(originalPdfDoc, originalPdfDoc.getPageIndices());
    pages.forEach((page) => {
        compressedPdfDoc.addPage(page);
    });

    // Now embed any images with compression logic
    // Iterate through the embedded images and compress them based on the quality setting
    const embeddedImages = originalPdfDoc.context.lookup(PDFLib.PDFName.of('XObject')) || {};

    for (const [key, image] of Object.entries(embeddedImages)) {
        if (image instanceof PDFLib.PDFRawStream && image.get(PDFLib.PDFName.of('Subtype')).name === 'Image') {
            const imgBytes = image.getBytes();
            let compressedImage;

            // If the image is JPEG, compress and re-embed it
            if (image.get(PDFLib.PDFName.of('Filter')).name === 'DCTDecode') {
                compressedImage = await compressedPdfDoc.embedJpg(imgBytes, { quality });
            } else if (image.get(PDFLib.PDFName.of('Filter')).name === 'FlateDecode') {
                compressedImage = await compressedPdfDoc.embedPng(imgBytes);
            }

            // Re-embed the compressed image (this step could vary depending on how your images are organized)
            // Additional code needed to position and resize the image on the page if necessary
        }
    }

    // Save the compressed PDF
    compressedPdfBytes = await compressedPdfDoc.save();

    // Enable the download button
    downloadPDFBtn.style.display = 'block';
});

// Function to download the compressed PDF
downloadPDFBtn.addEventListener('click', () => {
    if (compressedPdfBytes) {
        const blob = new Blob([compressedPdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'compressed-pdf.pdf';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
});
