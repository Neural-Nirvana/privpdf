// PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.9.359/pdf.worker.min.js';

let pdfDoc = null;
let pageNum = 1;
let currentRotation = 0;
const scale = 1.5;

// File Input Elements
const pdfInput = document.getElementById('pdfInput');
const mergePdfInput = document.getElementById('mergePdfInput');

// Load PDF
pdfInput.addEventListener('change', function(e) {
    const files = e.target.files;
    if (!files || files.length === 0) {
        console.error('No file selected.');
        return;
    }

    const file = files[0];
    if (file.type && file.type !== 'application/pdf') {
        console.error('Error: Not a PDF file');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        loadPDF(e.target.result);
    };
    reader.readAsArrayBuffer(file);
});

function loadPDF(data) {
    const loadingTask = pdfjsLib.getDocument({ data: data });
    loadingTask.promise.then(function(pdf) {
        pdfDoc = pdf;
        pageNum = 1;
        currentRotation = 0; // Reset rotation
        document.getElementById('pageCount').textContent = pdfDoc.numPages;
        renderPage(pageNum);
    }).catch(function(error) {
        console.error('Error loading PDF:', error);
    });
}

function renderPage(num) {
    pdfDoc.getPage(num).then(function(page) {
        const viewport = page.getViewport({ scale: scale, rotation: currentRotation });
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
            canvasContext: ctx,
            viewport: viewport
        };

        page.render(renderContext).promise.then(function() {
            const pdfPreview = document.getElementById('pdfPreview');
            pdfPreview.innerHTML = '';
            pdfPreview.appendChild(canvas);
            document.getElementById('pageNum').textContent = num;
        }).catch(function(error) {
            console.error('Error rendering page:', error);
        });
    }).catch(function(error) {
        console.error('Error getting page:', error);
    });
}

// Merge PDFs
mergePdfInput.addEventListener('change', handleMergePdfInputChange);

async function handleMergePdfInputChange(e) {
    const files = e.target.files;
    if (files.length < 2) {
        console.log("Please select at least two PDF files to merge.");
        return;
    }

    const mergedPdfDoc = await PDFLib.PDFDocument.create();

    for (const file of files) {
        if (file.type !== 'application/pdf') {
            console.error('Error: Not a PDF file');
            return;
        }

        const arrayBuffer = await file.arrayBuffer();
        const pdfLibDoc = await PDFLib.PDFDocument.load(arrayBuffer);

        const copiedPages = await mergedPdfDoc.copyPages(pdfLibDoc, pdfLibDoc.getPageIndices());
        copiedPages.forEach(page => mergedPdfDoc.addPage(page));
    }

    const mergedPdfBytes = await mergedPdfDoc.save();

    // Load the merged PDF into the viewer
    loadPDF(mergedPdfBytes);

    console.log('PDFs merged successfully.');

    // Clear the input value
    mergePdfInput.value = '';
}

// Add Page
async function addPage() {
    if (!pdfDoc) {
        console.log("No document loaded.");
        return;
    }

    // Load the current PDF data into a PDFDocument
    const existingPdfBytes = await pdfDoc.getData();

    // Use PDF-Lib to modify the PDF
    const pdfLibDoc = await PDFLib.PDFDocument.load(existingPdfBytes);

    // Add a blank page to the PDF
    pdfLibDoc.addPage();

    // Save the updated PDFDocument
    const pdfBytes = await pdfLibDoc.save();

    // Reload the updated PDF into pdfjsLib
    loadPDF(pdfBytes);

    // Update the page number to the last page
    pageNum = pdfLibDoc.getPageCount();

    console.log("Blank page added.");
}

// Delete Page
async function deletePage() {
    if (!pdfDoc || pdfDoc.numPages === 1) {
        console.log("Cannot delete page: Document has only one page or no document loaded.");
        return;
    }

    // Get the existing PDF bytes
    const existingPdfBytes = await pdfDoc.getData();

    // Load the PDF with pdf-lib
    const pdfLibDoc = await PDFLib.PDFDocument.load(existingPdfBytes);

    // Remove the current page (page indices start from 0)
    pdfLibDoc.removePage(pageNum - 1);

    // Save the updated PDF
    const pdfBytes = await pdfLibDoc.save();

    // Reload the PDF into pdfjsLib
    loadPDF(pdfBytes);

    // Adjust the current page number if necessary
    if (pageNum > pdfLibDoc.getPageCount()) {
        pageNum = pdfLibDoc.getPageCount();
    }

    console.log(`Page ${pageNum + 1} deleted.`);
}

// Reorder Pages
async function reorderPages() {
    if (!pdfDoc || pdfDoc.numPages <= 1 || pageNum <= 1) {
        console.log("Cannot reorder pages.");
        return;
    }

    // Get the existing PDF bytes
    const existingPdfBytes = await pdfDoc.getData();

    // Load the source PDF document into pdf-lib
    const pdfSrcDoc = await PDFLib.PDFDocument.load(existingPdfBytes);

    // Create a new PDF document
    const pdfNewDoc = await PDFLib.PDFDocument.create();

    // Get the page indices
    const pageIndices = [...Array(pdfSrcDoc.getPageCount()).keys()];

    // Swap the current page with the previous one
    const currentIndex = pageNum - 1;
    [pageIndices[currentIndex - 1], pageIndices[currentIndex]] = [pageIndices[currentIndex], pageIndices[currentIndex - 1]];

    // Copy pages in the new order
    const copiedPages = await pdfNewDoc.copyPages(pdfSrcDoc, pageIndices);

    // Add the copied pages to the new document
    copiedPages.forEach((page) => pdfNewDoc.addPage(page));

    // Save and reload the PDF
    const pdfBytes = await pdfNewDoc.save();
    loadPDF(pdfBytes);

    // Update page number
    pageNum--;

    console.log(`Moved page ${pageNum + 1} up.`);
}

// Rotate Page
function rotatePage() {
    currentRotation = (currentRotation + 90) % 360;
    renderPage(pageNum);
    console.log(`Page rotated to ${currentRotation} degrees`);
}

// Extract Pages
async function extractPages() {
    if (!pdfDoc) {
        console.log("No document loaded.");
        return;
    }

    // Get the existing PDF bytes
    const existingPdfBytes = await pdfDoc.getData();

    // Load the source PDF document into pdf-lib
    const pdfSrcDoc = await PDFLib.PDFDocument.load(existingPdfBytes);

    // Create a new PDF document
    const pdfNewDoc = await PDFLib.PDFDocument.create();

    // Copy the desired page from the source document to the new document
    const [copiedPage] = await pdfNewDoc.copyPages(pdfSrcDoc, [pageNum - 1]);

    // Add the copied page to the new document
    pdfNewDoc.addPage(copiedPage);

    // Save the new PDF document
    const pdfBytes = await pdfNewDoc.save();

    // Create a blob and trigger download
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `extracted_page_${pageNum}.pdf`;
    a.click();
    URL.revokeObjectURL(url);

    console.log(`Extracted page ${pageNum}.`);
}

// Split PDF
async function splitPDF() {
    if (!pdfDoc || pdfDoc.numPages <= 1) {
        console.log("Cannot split PDF: Not enough pages.");
        return;
    }

    const existingPdfBytes = await pdfDoc.getData();
    const pdfSrcDoc = await PDFLib.PDFDocument.load(existingPdfBytes);

    const pageCount = pdfSrcDoc.getPageCount();

    // First part (pages before current page)
    const part1Doc = await PDFLib.PDFDocument.create();
    if (pageNum > 1) {
        const pagesPart1 = await part1Doc.copyPages(pdfSrcDoc, [...Array(pageNum - 1).keys()]);
        pagesPart1.forEach(page => part1Doc.addPage(page));
    }

    // Second part (current page and after)
    const part2Doc = await PDFLib.PDFDocument.create();
    const pagesPart2 = await part2Doc.copyPages(pdfSrcDoc, Array.from({ length: pageCount - pageNum + 1 }, (_, i) => i + pageNum - 1));
    pagesPart2.forEach(page => part2Doc.addPage(page));

    // Save and download both parts
    if (part1Doc.getPageCount() > 0) {
        const pdfBytes1 = await part1Doc.save();
        const blob1 = new Blob([pdfBytes1], { type: 'application/pdf' });
        const url1 = URL.createObjectURL(blob1);
        const a1 = document.createElement('a');
        a1.href = url1;
        a1.download = `split_part1.pdf`;
        a1.click();
        URL.revokeObjectURL(url1);
    }

    if (part2Doc.getPageCount() > 0) {
        const pdfBytes2 = await part2Doc.save();
        const blob2 = new Blob([pdfBytes2], { type: 'application/pdf' });
        const url2 = URL.createObjectURL(blob2);
        const a2 = document.createElement('a');
        a2.href = url2;
        a2.download = `split_part2.pdf`;
        a2.click();
        URL.revokeObjectURL(url2);
    }

    console.log(`PDF split at page ${pageNum}.`);
}

// Download PDF
async function downloadPDF() {
    if (!pdfDoc) {
        console.log("No document loaded.");
        return;
    }

    // Get the existing PDF bytes
    const existingPdfBytes = await pdfDoc.getData();

    // Create a blob and trigger download
    const blob = new Blob([existingPdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `manipulated_pdf.pdf`;
    a.click();
    URL.revokeObjectURL(url);

    console.log('PDF downloaded.');
}

// Event Listeners
document.getElementById('addPage').addEventListener('click', addPage);
document.getElementById('deletePage').addEventListener('click', deletePage);
document.getElementById('reorderPages').addEventListener('click', reorderPages);
document.getElementById('rotatePage').addEventListener('click', rotatePage);
document.getElementById('extractPages').addEventListener('click', extractPages);
document.getElementById('splitPDF').addEventListener('click', splitPDF);
document.getElementById('downloadPDF').addEventListener('click', downloadPDF);

function showPreviousPage() {
    if (pageNum <= 1) return;
    pageNum--;
    renderPage(pageNum);
}

function showNextPage() {
    if (pageNum >= pdfDoc.numPages) return;
    pageNum++;
    renderPage(pageNum);
}

// Navigation Event Listeners
document.getElementById('prevPage').addEventListener('click', showPreviousPage);
document.getElementById('nextPage').addEventListener('click', showNextPage);
