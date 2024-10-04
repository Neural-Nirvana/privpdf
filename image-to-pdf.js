// Get references to the DOM elements
const imageInput = document.getElementById('imageInput');
const imagePreview = document.getElementById('imagePreview');
const generatePDFBtn = document.getElementById('generatePDF');
const downloadPDFBtn = document.getElementById('downloadPDF');

let selectedImages = [];
let pdfBytes;

// Function to handle image file selection and preview the images
imageInput.addEventListener('change', (event) => {
    selectedImages = Array.from(event.target.files);
    imagePreview.innerHTML = ''; // Clear previous previews

    if (selectedImages.length > 0) {
        generatePDFBtn.style.display = 'block'; // Show the generate PDF button

        selectedImages.forEach((imageFile, index) => {
            const reader = new FileReader();
            reader.onload = function (e) {
                const img = document.createElement('img');
                img.src = e.target.result;
                img.style.maxWidth = '200px';
                img.style.margin = '10px';
                img.alt = `Image ${index + 1}`;
                imagePreview.appendChild(img);
            };
            reader.readAsDataURL(imageFile);
        });
    } else {
        generatePDFBtn.style.display = 'none'; // Hide the button if no images are selected
    }
});

// Function to generate the PDF from the selected images
generatePDFBtn.addEventListener('click', async () => {
    if (selectedImages.length === 0) {
        alert("Please select images to generate the PDF.");
        return;
    }

    const pdfDoc = await PDFLib.PDFDocument.create();

    // Process each image sequentially
    for (const imageFile of selectedImages) {
        await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async function (e) {
                try {
                    const imageBytes = new Uint8Array(e.target.result);
                    let img;

                    // Check the image file type and embed the appropriate format
                    if (imageFile.type === 'image/jpeg' || imageFile.type === 'image/jpg') {
                        img = await pdfDoc.embedJpg(imageBytes);
                    } else if (imageFile.type === 'image/png') {
                        img = await pdfDoc.embedPng(imageBytes);
                    } else {
                        alert(`Unsupported image format: ${imageFile.type}`);
                        resolve(); // Skip unsupported formats
                        return;
                    }

                    // If image is valid, create a new page with the image size
                    if (img) {
                        const page = pdfDoc.addPage([img.width, img.height]);
                        page.drawImage(img, {
                            x: 0,
                            y: 0,
                            width: img.width,
                            height: img.height,
                        });
                    }
                    resolve(); // Resolve the promise once the image is processed
                } catch (error) {
                    console.error("Error embedding image:", error);
                    reject(error);
                }
            };
            reader.readAsArrayBuffer(imageFile);
        });
    }

    // Once all images are processed, save the PDF and enable download button
    pdfBytes = await pdfDoc.save();
    downloadPDFBtn.style.display = 'block'; // Show the download button
});

// Function to download the generated PDF
downloadPDFBtn.addEventListener('click', () => {
    if (pdfBytes) {
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'images-to-pdf.pdf';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
});
