// Get references to the DOM elements
const pdfInput = document.getElementById('pdfInput');
const watermarkText = document.getElementById('watermarkText');
const applyWatermarkBtn = document.getElementById('applyWatermark');
const downloadPDFBtn = document.getElementById('downloadPDF');
const fileNameDisplay = document.getElementById('fileName'); // New element for file name

// Variables to hold the original PDF and the watermarked PDF
let originalPdfBytes, watermarkedPdfBytes;

// Function to load the PDF file
pdfInput.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (file && file.type === 'application/pdf') {
        fileNameDisplay.textContent = file.name; // Display the file name
        const reader = new FileReader();
        reader.onload = async function(e) {
            originalPdfBytes = new Uint8Array(e.target.result);
            console.log("PDF Loaded");
        };
        reader.readAsArrayBuffer(file);
    } else {
        fileNameDisplay.textContent = ''; // Clear the file name if not a PDF
    }
});

// Function to apply watermark
applyWatermarkBtn.addEventListener('click', async () => {
    if (!originalPdfBytes) {
        alert("Please select a PDF file first.");
        return;
    }

    const text = watermarkText.value.trim();
    if (!text) {
        alert("Please enter the watermark text.");
        return;
    }

    // Load the original PDF document
    const pdfDoc = await PDFLib.PDFDocument.load(originalPdfBytes);

    // Get the font to use for the watermark (Helvetica in this case)
    const helveticaFont = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);

    // Apply the watermark to each page
    const pages = pdfDoc.getPages();
    pages.forEach((page) => {
        const { width, height } = page.getSize();
        page.drawText(text, {
            x: width / 4,   // Position the watermark at 1/4 of the page width
            y: height / 2,  // Position the watermark at the center vertically
            size: 50,
            font: helveticaFont,
            color: PDFLib.rgb(0.75, 0.75, 0.75),  // Light gray watermark
            rotate: PDFLib.degrees(45),  // Rotate the text at 45 degrees
            opacity: 0.5,  // Semi-transparent watermark
        });
    });

    // Save the modified PDF with the watermark
    watermarkedPdfBytes = await pdfDoc.save();
    
    // Enable the download button
    downloadPDFBtn.style.display = 'block';
});

// Function to download the watermarked PDF
downloadPDFBtn.addEventListener('click', () => {
    if (watermarkedPdfBytes) {
        const blob = new Blob([watermarkedPdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'watermarked.pdf';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
});
