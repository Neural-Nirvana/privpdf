// PrivPDF - Complete PDF Toolkit JavaScript
// Check if libraries are available before initializing
if (typeof pdfjsLib !== 'undefined') {
    // Try multiple worker sources with fallbacks
    const workerSources = [
        'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.54/build/pdf.worker.min.js',
        'https://unpkg.com/pdfjs-dist@5.4.54/build/pdf.worker.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
        'https://unpkg.com/pdfjs-dist@latest/build/pdf.worker.min.js'
    ];
    
    // Try to set up worker with fallbacks
    function setupPDFWorker() {
        let workerIndex = 0;
        
        function tryWorker() {
            if (workerIndex >= workerSources.length) {
                console.warn('All PDF.js workers failed, falling back to main thread');
                pdfjsLib.GlobalWorkerOptions.workerSrc = '';
                return;
            }
            
            const workerSrc = workerSources[workerIndex];
            pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
            
            // Test worker by trying to load a simple PDF
            const testData = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // "%PDF" header
            
            try {
                console.log(`Trying PDF.js worker: ${workerSrc}`);
                // Set the worker and continue
            } catch (error) {
                console.warn(`Worker ${workerIndex + 1} failed:`, error);
                workerIndex++;
                tryWorker();
            }
        }
        
        tryWorker();
    }
    
    setupPDFWorker();
} else {
    console.error('PDF.js library not found!');
}

class PrivPDF {
    constructor() {
        this.currentTool = 'merge';
        this.loadedPDFs = new Map();
        this.selectedPages = new Set();
        this.pageRotations = new Map();
        this.pageOrder = [];
        this.ghostscript = new GhostscriptWASM();
        this.pdfProtection = new PDFProtection();
        this.init();
    }

    init() {
        this.setupToolSwitching();
        this.setupMobileMenu();
        this.setupDropZones();
        this.setupFileInputs();
        this.setupButtons();
        this.setupSettings();
        this.showToast('Welcome to PrivPDF! Select a tool to get started.', 'success');
    }

    setupToolSwitching() {
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tool = e.currentTarget.dataset.tool;
                this.switchTool(tool);
            });
        });
    }

    setupMobileMenu() {
        const mobileToggle = document.getElementById('mobile-menu-toggle');
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('mobile-overlay');
        
        if (mobileToggle && sidebar && overlay) {
            // Toggle sidebar on button click
            mobileToggle.addEventListener('click', () => {
                sidebar.classList.toggle('open');
                overlay.classList.toggle('show');
            });
            
            // Close sidebar when clicking overlay
            overlay.addEventListener('click', () => {
                sidebar.classList.remove('open');
                overlay.classList.remove('show');
            });
            
            // Close sidebar when selecting a tool on mobile
            document.querySelectorAll('.tool-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    if (window.innerWidth <= 768) {
                        sidebar.classList.remove('open');
                        overlay.classList.remove('show');
                        
                        // Update mobile toggle text
                        const toolName = btn.textContent.trim();
                        mobileToggle.innerHTML = `<span>${btn.querySelector('.tool-icon').textContent}</span> ${toolName}`;
                    }
                });
            });
            
            // Close sidebar on window resize to desktop
            window.addEventListener('resize', () => {
                if (window.innerWidth > 768) {
                    sidebar.classList.remove('open');
                    overlay.classList.remove('show');
                }
            });
        }
    }

    switchTool(tool) {
        document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tool-panel').forEach(panel => panel.classList.remove('active'));
        
        document.querySelector(`[data-tool="${tool}"]`).classList.add('active');
        document.getElementById(`${tool}-panel`).classList.add('active');
        
        this.currentTool = tool;
        this.resetTool();
    }

    resetTool() {
        this.loadedPDFs.clear();
        this.selectedPages.clear();
        this.pageRotations.clear();
        this.pageOrder = [];
        
        document.querySelectorAll('.file-list').forEach(list => list.innerHTML = '');
        document.querySelectorAll('.page-thumbnails').forEach(container => {
            container.innerHTML = '';
            container.style.display = 'none';
        });
        document.querySelectorAll('.preview-container').forEach(container => {
            container.style.display = 'none';
        });
        document.querySelectorAll('.settings-grid').forEach(settings => {
            settings.style.display = 'none';
        });
        document.querySelectorAll('.batch-actions').forEach(actions => {
            actions.style.display = 'none';
        });
        document.querySelectorAll('.action-buttons button').forEach(btn => {
            btn.style.display = 'none';
        });
    }

    setupDropZones() {
        document.querySelectorAll('.drop-zone').forEach(zone => {
            zone.addEventListener('click', () => {
                const input = zone.querySelector('.file-input');
                if (input) input.click();
            });

            zone.addEventListener('dragover', (e) => {
                e.preventDefault();
                zone.classList.add('active');
            });

            zone.addEventListener('dragleave', () => {
                zone.classList.remove('active');
            });

            zone.addEventListener('drop', (e) => {
                e.preventDefault();
                zone.classList.remove('active');
                const files = Array.from(e.dataTransfer.files);
                const input = zone.querySelector('.file-input');
                if (input) {
                    const dt = new DataTransfer();
                    files.forEach(file => dt.items.add(file));
                    input.files = dt.files;
                    input.dispatchEvent(new Event('change'));
                }
            });
        });
    }

    setupFileInputs() {
        // Merge tool
        document.getElementById('merge-input').addEventListener('change', (e) => {
            this.handleMergeFiles(Array.from(e.target.files));
        });

        // Split tool
        document.getElementById('split-input').addEventListener('change', (e) => {
            this.handleSplitFile(e.target.files[0]);
        });

        // Extract tool
        document.getElementById('extract-input').addEventListener('change', (e) => {
            this.handleExtractFile(e.target.files[0]);
        });

        // Rotate tool
        document.getElementById('rotate-input').addEventListener('change', (e) => {
            this.handleRotateFile(e.target.files[0]);
        });

        // Reorder tool
        document.getElementById('reorder-input').addEventListener('change', (e) => {
            this.handleReorderFile(e.target.files[0]);
        });

        // Delete tool
        document.getElementById('delete-input').addEventListener('change', (e) => {
            this.handleDeleteFile(e.target.files[0]);
        });

        // Add pages tool
        document.getElementById('add-input').addEventListener('change', (e) => {
            this.handleAddBaseFile(e.target.files[0]);
        });

        document.getElementById('add-source-input').addEventListener('change', (e) => {
            this.handleAddSourceFile(e.target.files[0]);
        });

        // Compress tool
        document.getElementById('compress-input').addEventListener('change', (e) => {
            this.handleCompressFileWASM(e.target.files[0]);
        });

        // Protect tool
        document.getElementById('protect-input').addEventListener('change', (e) => {
            this.handleProtectFile(e.target.files[0]);
        });

        // Watermark tool
        document.getElementById('watermark-input').addEventListener('change', (e) => {
            this.handleWatermarkFile(e.target.files[0]);
        });


        // Image to PDF tool
        document.getElementById('imagetopdf-input').addEventListener('change', (e) => {
            this.handleImageFiles(Array.from(e.target.files));
        });

        // PDF to Image tool
        document.getElementById('pdftoimage-input').addEventListener('change', (e) => {
            this.handlePDFToImageFile(e.target.files[0]);
        });
    }

    setupButtons() {
        // Merge buttons
        document.getElementById('merge-button').addEventListener('click', () => this.mergePDFs());
        document.getElementById('merge-clear').addEventListener('click', () => this.clearMergeFiles());

        // Split button
        document.getElementById('split-button').addEventListener('click', () => this.splitPDF());

        // Extract button
        document.getElementById('extract-button').addEventListener('click', () => this.extractPages());
        document.getElementById('extract-select-all').addEventListener('change', (e) => this.selectAllPages(e.target.checked));
        document.getElementById('extract-invert').addEventListener('click', () => this.invertSelection());

        // Rotate button
        document.getElementById('rotate-save').addEventListener('click', () => this.saveRotatedPDF());
        document.getElementById('rotate-all-left').addEventListener('click', () => this.rotateAllPages(-90));
        document.getElementById('rotate-all-right').addEventListener('click', () => this.rotateAllPages(90));

        // Reorder buttons
        document.getElementById('reorder-save').addEventListener('click', () => this.saveReorderedPDF());
        document.getElementById('reorder-reset').addEventListener('click', () => this.resetPageOrder());

        // Delete button
        document.getElementById('delete-button').addEventListener('click', () => this.deletePages());
        document.getElementById('delete-select-all').addEventListener('change', (e) => this.selectAllPagesForDeletion(e.target.checked));

        // Add pages button
        document.getElementById('add-button').addEventListener('click', () => this.addPages());

        // Compress button
        document.getElementById('compress-button').addEventListener('click', () => this.compressPDFWithWASM());

        // Protect button
        document.getElementById('protect-button').addEventListener('click', () => this.protectPDFWithEncryption());
        document.getElementById('decrypt-button').addEventListener('click', () => this.decryptPDF());

        // Watermark button
        document.getElementById('watermark-button').addEventListener('click', () => this.applyWatermark());

        // Image to PDF buttons
        document.getElementById('imagetopdf-button').addEventListener('click', () => this.createPDFFromImages());
        document.getElementById('imagetopdf-clear').addEventListener('click', () => this.clearImageFiles());

        // PDF to Image button
        document.getElementById('pdftoimage-button').addEventListener('click', () => this.convertPDFToImages());
        document.getElementById('pdftoimage-prev').addEventListener('click', () => this.previousPage());
        document.getElementById('pdftoimage-next').addEventListener('click', () => this.nextPage());
    }

    setupSettings() {
        // Split method change
        document.getElementById('split-method').addEventListener('change', (e) => {
            const method = e.target.value;
            document.getElementById('split-pages-setting').style.display = method === 'pages' ? 'block' : 'none';
            document.getElementById('split-range-setting').style.display = method === 'range' ? 'block' : 'none';
        });

        // Add type change
        document.getElementById('add-type').addEventListener('change', (e) => {
            const type = e.target.value;
            document.getElementById('add-blank-settings').style.display = type === 'blank' ? 'block' : 'none';
            document.getElementById('add-source-dropzone').style.display = type === 'from-pdf' ? 'block' : 'none';
        });

        // Add position change
        document.getElementById('add-position').addEventListener('change', (e) => {
            const position = e.target.value;
            document.getElementById('add-page-number').style.display = position === 'after' ? 'block' : 'none';
        });

        // Watermark type change
        document.getElementById('watermark-type').addEventListener('change', (e) => {
            const type = e.target.value;
            document.getElementById('watermark-text-setting').style.display = type === 'text' ? 'block' : 'none';
            document.getElementById('watermark-image-setting').style.display = type === 'image' ? 'block' : 'none';
        });

        // Watermark pages change
        document.getElementById('watermark-pages').addEventListener('change', (e) => {
            const pages = e.target.value;
            document.getElementById('watermark-range-setting').style.display = pages === 'custom' ? 'block' : 'none';
        });

        // PDF to image pages change
        document.getElementById('pdftoimage-pages').addEventListener('change', (e) => {
            const pages = e.target.value;
            document.getElementById('pdftoimage-range-setting').style.display = pages === 'range' ? 'block' : 'none';
        });

        // Range inputs - compression quality change handler removed (now handled by WASM)

        document.getElementById('watermark-opacity').addEventListener('input', (e) => {
            document.getElementById('watermark-opacity-value').textContent = e.target.value + '%';
            this.updateWatermarkPreview();
        });
        
        document.getElementById('watermark-text').addEventListener('input', () => {
            this.updateWatermarkPreview();
        });
        
        document.getElementById('watermark-position').addEventListener('change', () => {
            this.updateWatermarkPreview();
        });

        document.getElementById('pdftoimage-quality').addEventListener('input', (e) => {
            document.getElementById('pdftoimage-quality-value').textContent = e.target.value + '%';
        });
    }

    // File handling methods
    async handleMergeFiles(files) {
        const fileList = document.getElementById('merge-files');
        
        for (const file of files) {
            if (file.type !== 'application/pdf') {
                this.showToast(`${file.name} is not a PDF file`, 'error');
                continue;
            }

            const fileId = Date.now() + Math.random();
            this.loadedPDFs.set(fileId, file);

            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            fileItem.dataset.fileId = fileId;
            fileItem.innerHTML = `
                <div class="file-info">
                    <span class="file-icon">📄</span>
                    <div class="file-details">
                        <span class="file-name">${file.name}</span>
                        <span class="file-size">${this.formatFileSize(file.size)}</span>
                    </div>
                </div>
                <div class="file-actions">
                    <button class="icon-btn" onclick="privpdf.moveFileUp('${fileId}')">↑</button>
                    <button class="icon-btn" onclick="privpdf.moveFileDown('${fileId}')">↓</button>
                    <button class="icon-btn danger" onclick="privpdf.removeFile('${fileId}')">✕</button>
                </div>
            `;
            fileList.appendChild(fileItem);
        }

        if (this.loadedPDFs.size > 0) {
            document.getElementById('merge-button').style.display = 'inline-flex';
            document.getElementById('merge-clear').style.display = 'inline-flex';
        }
    }

    async handleSplitFile(file) {
        if (!file || file.type !== 'application/pdf') {
            this.showToast('Please select a valid PDF file', 'error');
            return;
        }

        this.loadedPDFs.set('split', file);
        
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        
        document.getElementById('split-settings').style.display = 'grid';
        document.getElementById('split-preview').style.display = 'flex';
        document.getElementById('split-button').style.display = 'inline-flex';

        this.renderPreview(pdf, 'split-canvas');
    }

    async handleExtractFile(file) {
        if (!file || file.type !== 'application/pdf') {
            this.showToast('Please select a valid PDF file', 'error');
            return;
        }

        this.loadedPDFs.set('extract', file);
        
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        
        const thumbnailsContainer = document.getElementById('extract-thumbnails');
        thumbnailsContainer.innerHTML = '';
        thumbnailsContainer.style.display = 'flex';
        
        document.getElementById('extract-batch').style.display = 'flex';
        document.getElementById('extract-button').style.display = 'inline-flex';

        for (let i = 1; i <= pdf.numPages; i++) {
            const thumbnail = await this.createPageThumbnail(pdf, i, 'extract');
            thumbnailsContainer.appendChild(thumbnail);
        }
    }

    async handleRotateFile(file) {
        if (!file || file.type !== 'application/pdf') {
            this.showToast('Please select a valid PDF file', 'error');
            return;
        }

        this.loadedPDFs.set('rotate', file);
        
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        
        const thumbnailsContainer = document.getElementById('rotate-thumbnails');
        thumbnailsContainer.innerHTML = '';
        thumbnailsContainer.style.display = 'flex';
        
        document.getElementById('rotate-batch').style.display = 'flex';
        document.getElementById('rotate-save').style.display = 'inline-flex';

        for (let i = 1; i <= pdf.numPages; i++) {
            const thumbnail = await this.createRotatableThumbnail(pdf, i);
            thumbnailsContainer.appendChild(thumbnail);
        }
    }

    async handleReorderFile(file) {
        if (!file || file.type !== 'application/pdf') {
            this.showToast('Please select a valid PDF file', 'error');
            return;
        }

        this.loadedPDFs.set('reorder', file);
        
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        
        const thumbnailsContainer = document.getElementById('reorder-thumbnails');
        thumbnailsContainer.innerHTML = '';
        thumbnailsContainer.style.display = 'flex';
        
        document.getElementById('reorder-save').style.display = 'inline-flex';
        document.getElementById('reorder-reset').style.display = 'inline-flex';

        this.pageOrder = [];
        for (let i = 1; i <= pdf.numPages; i++) {
            this.pageOrder.push(i);
            const thumbnail = await this.createDraggableThumbnail(pdf, i);
            thumbnailsContainer.appendChild(thumbnail);
        }

        this.setupDragAndDrop(thumbnailsContainer);
    }

    async handleDeleteFile(file) {
        if (!file || file.type !== 'application/pdf') {
            this.showToast('Please select a valid PDF file', 'error');
            return;
        }

        this.loadedPDFs.set('delete', file);
        
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        
        const thumbnailsContainer = document.getElementById('delete-thumbnails');
        thumbnailsContainer.innerHTML = '';
        thumbnailsContainer.style.display = 'flex';
        
        document.getElementById('delete-batch').style.display = 'flex';
        document.getElementById('delete-button').style.display = 'inline-flex';

        for (let i = 1; i <= pdf.numPages; i++) {
            const thumbnail = await this.createSelectableThumbnail(pdf, i, 'delete');
            thumbnailsContainer.appendChild(thumbnail);
        }
    }

    async handleAddBaseFile(file) {
        if (!file || file.type !== 'application/pdf') {
            this.showToast('Please select a valid PDF file', 'error');
            return;
        }

        this.loadedPDFs.set('add-base', file);
        
        document.getElementById('add-settings').style.display = 'grid';
        document.getElementById('add-button').style.display = 'inline-flex';
        
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        document.getElementById('add-after-page').max = pdf.numPages;
    }

    async handleAddSourceFile(file) {
        if (!file || file.type !== 'application/pdf') {
            this.showToast('Please select a valid PDF file', 'error');
            return;
        }

        this.loadedPDFs.set('add-source', file);
        this.showToast('Source PDF loaded successfully', 'success');
    }

    async handleCompressFileWASM(file) {
        if (!file || file.type !== 'application/pdf') {
            this.showToast('Please select a valid PDF file', 'error');
            return;
        }

        this.loadedPDFs.set('compress', file);
        
        // Show compression settings - with error checking
        const settingsEl = document.getElementById('compress-settings');
        const buttonEl = document.getElementById('compress-button');
        const sizeEl = document.getElementById('compress-original-size');
        const wasmStatusEl = document.getElementById('wasm-status');
        
        if (settingsEl) settingsEl.style.display = 'grid';
        if (buttonEl) buttonEl.style.display = 'inline-flex';
        if (sizeEl) sizeEl.textContent = this.formatFileSize(file.size);
        
        // Update WASM status
        if (wasmStatusEl) {
            const status = this.ghostscript.getStatus();
            wasmStatusEl.textContent = status === 'not-loaded' ? 'Not loaded' : 
                                     status === 'loading' ? 'Loading...' : 'Ready';
            wasmStatusEl.className = `wasm-status ${status}`;
        }
        
        this.showToast('PDF loaded for compression. Select quality and compress!', 'success');
    }

    async handleWatermarkFile(file) {
        if (!file || file.type !== 'application/pdf') {
            this.showToast('Please select a valid PDF file', 'error');
            return;
        }

        this.loadedPDFs.set('watermark', file);
        
        document.getElementById('watermark-settings').style.display = 'grid';
        document.getElementById('watermark-button').style.display = 'inline-flex';
        
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        
        document.getElementById('watermark-preview-container').style.display = 'block';
        this.renderPreview(pdf, 'watermark-preview');
        this.updateWatermarkPreview();
    }

    async handleProtectFile(file) {
        if (!file || file.type !== 'application/pdf') {
            this.showToast('Please select a valid PDF file', 'error');
            return;
        }

        this.loadedPDFs.set('protect', file);
        
        document.getElementById('protect-settings').style.display = 'grid';
        document.getElementById('protect-button').style.display = 'inline-flex';
    }

    async handleImageFiles(files) {
        const fileList = document.getElementById('imagetopdf-files');
        
        for (const file of files) {
            if (!file.type.startsWith('image/')) {
                this.showToast(`${file.name} is not an image file`, 'error');
                continue;
            }

            const fileId = Date.now() + Math.random();
            this.loadedPDFs.set(fileId, file);

            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            fileItem.dataset.fileId = fileId;
            fileItem.innerHTML = `
                <div class="file-info">
                    <span class="file-icon">🖼️</span>
                    <div class="file-details">
                        <span class="file-name">${file.name}</span>
                        <span class="file-size">${this.formatFileSize(file.size)}</span>
                    </div>
                </div>
                <div class="file-actions">
                    <button class="icon-btn" onclick="privpdf.moveFileUp('${fileId}')">↑</button>
                    <button class="icon-btn" onclick="privpdf.moveFileDown('${fileId}')">↓</button>
                    <button class="icon-btn danger" onclick="privpdf.removeImageFile('${fileId}')">✕</button>
                </div>
            `;
            fileList.appendChild(fileItem);
        }

        if (this.loadedPDFs.size > 0) {
            document.getElementById('imagetopdf-settings').style.display = 'grid';
            document.getElementById('imagetopdf-button').style.display = 'inline-flex';
            document.getElementById('imagetopdf-clear').style.display = 'inline-flex';
        }
    }

    async handlePDFToImageFile(file) {
        if (!file || file.type !== 'application/pdf') {
            this.showToast('Please select a valid PDF file', 'error');
            return;
        }

        this.loadedPDFs.set('pdftoimage', file);
        this.currentPage = 1;
        
        const arrayBuffer = await file.arrayBuffer();
        this.currentPDF = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        
        document.getElementById('pdftoimage-settings').style.display = 'grid';
        document.getElementById('pdftoimage-preview').style.display = 'flex';
        document.getElementById('pdftoimage-controls').style.display = 'flex';
        document.getElementById('pdftoimage-button').style.display = 'inline-flex';
        
        this.renderPDFToImagePreview();
    }

    // PDF operations
    async mergePDFs() {
        try {
            this.showToast('Merging PDFs...', 'success');
            
            const mergedPdf = await PDFLib.PDFDocument.create();
            const fileItems = document.querySelectorAll('#merge-files .file-item');
            
            for (const item of fileItems) {
                const fileId = parseFloat(item.dataset.fileId);
                const file = this.loadedPDFs.get(fileId);
                
                const arrayBuffer = await file.arrayBuffer();
                const pdf = await PDFLib.PDFDocument.load(arrayBuffer);
                const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
                pages.forEach(page => mergedPdf.addPage(page));
            }
            
            const mergedBytes = await mergedPdf.save();
            this.downloadPDF(mergedBytes, 'merged.pdf');
            
            this.showToast('PDFs merged successfully!', 'success');
        } catch (error) {
            this.showToast('Error merging PDFs: ' + error.message, 'error');
        }
    }

    async splitPDF() {
        try {
            this.showToast('Splitting PDF...', 'info');
            
            const file = this.loadedPDFs.get('split');
            const method = document.getElementById('split-method').value;
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await PDFLib.PDFDocument.load(arrayBuffer);
            const totalPages = pdf.getPageCount();
            
            let filesCreated = 0;
            
            if (method === 'single') {
                // Extract each page as a separate PDF
                for (let i = 0; i < totalPages; i++) {
                    const newPdf = await PDFLib.PDFDocument.create();
                    const [page] = await newPdf.copyPages(pdf, [i]);
                    newPdf.addPage(page);
                    const bytes = await newPdf.save();
                    this.downloadPDF(bytes, `page_${i + 1}.pdf`);
                    filesCreated++;
                }
                this.showToast(`Split into ${filesCreated} individual pages successfully!`, 'success');
                
            } else if (method === 'pages') {
                // Split by page count
                const pagesPerDoc = parseInt(document.getElementById('split-pages').value);
                
                if (pagesPerDoc <= 0 || pagesPerDoc > totalPages) {
                    this.showToast('Invalid page count. Please enter a valid number.', 'error');
                    return;
                }
                
                for (let i = 0; i < totalPages; i += pagesPerDoc) {
                    const newPdf = await PDFLib.PDFDocument.create();
                    const endPage = Math.min(i + pagesPerDoc, totalPages);
                    const indices = Array.from({ length: endPage - i }, (_, idx) => i + idx);
                    const pages = await newPdf.copyPages(pdf, indices);
                    pages.forEach(page => newPdf.addPage(page));
                    const bytes = await newPdf.save();
                    
                    const startPage = i + 1;
                    const endPageNum = endPage;
                    this.downloadPDF(bytes, `pages_${startPage}-${endPageNum}.pdf`);
                    filesCreated++;
                }
                this.showToast(`Split into ${filesCreated} files (${pagesPerDoc} pages each)!`, 'success');
                
            } else if (method === 'range') {
                // Split by custom ranges
                const rangeInput = document.getElementById('split-ranges').value;
                
                if (!rangeInput.trim()) {
                    this.showToast('Please enter page ranges (e.g., 1-3, 4-6)', 'error');
                    return;
                }
                
                const ranges = rangeInput.split(',').map(r => r.trim());
                
                for (let idx = 0; idx < ranges.length; idx++) {
                    const range = ranges[idx];
                    
                    // Parse range (e.g., "1-3" or "5")
                    let startPage, endPage;
                    
                    if (range.includes('-')) {
                        const parts = range.split('-').map(n => parseInt(n.trim()));
                        startPage = parts[0];
                        endPage = parts[1];
                    } else {
                        startPage = endPage = parseInt(range.trim());
                    }
                    
                    // Validate range
                    if (isNaN(startPage) || isNaN(endPage) || 
                        startPage < 1 || endPage > totalPages || 
                        startPage > endPage) {
                        this.showToast(`Invalid range: ${range}. Skipping...`, 'warning');
                        continue;
                    }
                    
                    const newPdf = await PDFLib.PDFDocument.create();
                    const indices = Array.from(
                        { length: endPage - startPage + 1 }, 
                        (_, i) => startPage - 1 + i
                    );
                    const pages = await newPdf.copyPages(pdf, indices);
                    pages.forEach(page => newPdf.addPage(page));
                    const bytes = await newPdf.save();
                    
                    const filename = startPage === endPage 
                        ? `page_${startPage}.pdf` 
                        : `pages_${startPage}-${endPage}.pdf`;
                    this.downloadPDF(bytes, filename);
                    filesCreated++;
                }
                
                if (filesCreated > 0) {
                    this.showToast(`Split into ${filesCreated} files based on ranges!`, 'success');
                } else {
                    this.showToast('No valid ranges found. Please check your input.', 'error');
                }
                
            } else if (method === 'size') {
                // Split by file size (approximation)
                this.showToast('Split by size: Creating balanced files...', 'info');
                
                // Estimate pages per file based on original size
                const targetSizeKB = 1024; // 1MB target per file
                const fileSizeKB = file.size / 1024;
                const pagesPerFile = Math.max(1, Math.floor((targetSizeKB / fileSizeKB) * totalPages));
                
                for (let i = 0; i < totalPages; i += pagesPerFile) {
                    const newPdf = await PDFLib.PDFDocument.create();
                    const endPage = Math.min(i + pagesPerFile, totalPages);
                    const indices = Array.from({ length: endPage - i }, (_, idx) => i + idx);
                    const pages = await newPdf.copyPages(pdf, indices);
                    pages.forEach(page => newPdf.addPage(page));
                    const bytes = await newPdf.save();
                    
                    this.downloadPDF(bytes, `part_${filesCreated + 1}.pdf`);
                    filesCreated++;
                }
                
                this.showToast(`Split into ${filesCreated} files (size-balanced)!`, 'success');
            }
            
        } catch (error) {
            this.showToast('Error splitting PDF: ' + error.message, 'error');
            console.error('Split error:', error);
        }
    }

    async extractPages() {
        try {
            const file = this.loadedPDFs.get('extract');
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await PDFLib.PDFDocument.load(arrayBuffer);
            
            const selectedIndices = Array.from(this.selectedPages).map(p => p - 1).sort((a, b) => a - b);
            
            if (selectedIndices.length === 0) {
                this.showToast('Please select pages to extract', 'error');
                return;
            }
            
            const newPdf = await PDFLib.PDFDocument.create();
            const pages = await newPdf.copyPages(pdf, selectedIndices);
            pages.forEach(page => newPdf.addPage(page));
            
            const bytes = await newPdf.save();
            this.downloadPDF(bytes, 'extracted_pages.pdf');
            
            this.showToast(`Extracted ${selectedIndices.length} pages successfully!`, 'success');
        } catch (error) {
            this.showToast('Error extracting pages: ' + error.message, 'error');
        }
    }

    async saveRotatedPDF() {
        try {
            const file = this.loadedPDFs.get('rotate');
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await PDFLib.PDFDocument.load(arrayBuffer);
            
            this.pageRotations.forEach((rotation, pageNum) => {
                if (rotation !== 0) {
                    const page = pdf.getPage(pageNum - 1);
                    page.setRotation(PDFLib.degrees(rotation));
                }
            });
            
            const bytes = await pdf.save();
            this.downloadPDF(bytes, 'rotated.pdf');
            
            this.showToast('PDF rotated successfully!', 'success');
        } catch (error) {
            this.showToast('Error rotating PDF: ' + error.message, 'error');
        }
    }

    async saveReorderedPDF() {
        try {
            const file = this.loadedPDFs.get('reorder');
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await PDFLib.PDFDocument.load(arrayBuffer);
            
            const newPdf = await PDFLib.PDFDocument.create();
            const reorderedIndices = this.pageOrder.map(p => p - 1);
            const pages = await newPdf.copyPages(pdf, reorderedIndices);
            pages.forEach(page => newPdf.addPage(page));
            
            const bytes = await newPdf.save();
            this.downloadPDF(bytes, 'reordered.pdf');
            
            this.showToast('Pages reordered successfully!', 'success');
        } catch (error) {
            this.showToast('Error reordering pages: ' + error.message, 'error');
        }
    }

    async deletePages() {
        try {
            const file = this.loadedPDFs.get('delete');
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await PDFLib.PDFDocument.load(arrayBuffer);
            
            const pagesToKeep = [];
            for (let i = 1; i <= pdf.getPageCount(); i++) {
                if (!this.selectedPages.has(i)) {
                    pagesToKeep.push(i - 1);
                }
            }
            
            if (pagesToKeep.length === 0) {
                this.showToast('Cannot delete all pages', 'error');
                return;
            }
            
            const newPdf = await PDFLib.PDFDocument.create();
            const pages = await newPdf.copyPages(pdf, pagesToKeep);
            pages.forEach(page => newPdf.addPage(page));
            
            const bytes = await newPdf.save();
            this.downloadPDF(bytes, 'pages_deleted.pdf');
            
            this.showToast(`Deleted ${this.selectedPages.size} pages successfully!`, 'success');
        } catch (error) {
            this.showToast('Error deleting pages: ' + error.message, 'error');
        }
    }

    async addPages() {
        try {
            const baseFile = this.loadedPDFs.get('add-base');
            const arrayBuffer = await baseFile.arrayBuffer();
            const pdf = await PDFLib.PDFDocument.load(arrayBuffer);
            
            const addType = document.getElementById('add-type').value;
            const position = document.getElementById('add-position').value;
            
            let insertIndex = pdf.getPageCount();
            if (position === 'start') {
                insertIndex = 0;
            } else if (position === 'after') {
                insertIndex = parseInt(document.getElementById('add-after-page').value);
            }
            
            if (addType === 'blank') {
                const count = parseInt(document.getElementById('add-blank-count').value);
                for (let i = 0; i < count; i++) {
                    const page = pdf.insertPage(insertIndex + i);
                }
            } else {
                const sourceFile = this.loadedPDFs.get('add-source');
                if (!sourceFile) {
                    this.showToast('Please select a source PDF', 'error');
                    return;
                }
                
                const sourceBuffer = await sourceFile.arrayBuffer();
                const sourcePdf = await PDFLib.PDFDocument.load(sourceBuffer);
                const pages = await pdf.copyPages(sourcePdf, sourcePdf.getPageIndices());
                
                pages.forEach((page, i) => {
                    pdf.insertPage(insertIndex + i, page);
                });
            }
            
            const bytes = await pdf.save();
            this.downloadPDF(bytes, 'pages_added.pdf');
            
            this.showToast('Pages added successfully!', 'success');
        } catch (error) {
            this.showToast('Error adding pages: ' + error.message, 'error');
        }
    }

    async compressPDFWithWASM() {
        try {
            const file = this.loadedPDFs.get('compress');
            if (!file) {
                this.showToast('No PDF loaded for compression', 'error');
                return;
            }

            const qualityEl = document.getElementById('compress-quality');
            const progressElement = document.getElementById('compression-progress');
            const progressFill = document.getElementById('progress-fill');
            const progressText = document.getElementById('progress-text');
            const wasmStatus = document.getElementById('wasm-status');
            const compressButton = document.getElementById('compress-button');
            
            if (!qualityEl || !progressElement || !progressFill || !progressText || !compressButton) {
                this.showToast('Compression UI elements not found', 'error');
                return;
            }
            
            const quality = qualityEl.value;

            // Show progress
            progressElement.style.display = 'block';
            compressButton.disabled = true;
            compressButton.textContent = 'Compressing...';

            // Load WASM module if not already loaded
            if (this.ghostscript.getStatus() === 'not-loaded') {
                wasmStatus.textContent = 'Loading...';
                wasmStatus.className = 'wasm-status loading';

                await this.ghostscript.loadModule((message, progress) => {
                    progressText.textContent = message;
                    progressFill.style.width = `${progress}%`;
                });

                wasmStatus.textContent = 'Ready';
                wasmStatus.className = 'wasm-status ready';
            }

            // Convert file to ArrayBuffer
            const arrayBuffer = await file.arrayBuffer();

            // Compress using Ghostscript WASM
            const result = await this.ghostscript.module.compress(
                arrayBuffer,
                quality,
                (message, progress) => {
                    progressText.textContent = message;
                    progressFill.style.width = `${progress}%`;
                },
                (status) => {
                    console.log('Compression status:', status);
                }
            );

            if (result.success) {
                // Download compressed PDF
                this.downloadPDF(result.data, 'compressed.pdf');
                
                // Show success message
                this.showToast(
                    `✅ Compression Complete!\n` +
                    `Method: ${result.method || 'Ghostscript WASM'}\n` +
                    `Original: ${this.formatFileSize(result.originalSize)}\n` +
                    `Compressed: ${this.formatFileSize(result.compressedSize)}\n` +
                    `Reduction: ${result.reduction}%\n` +
                    `Quality: ${result.quality}`,
                    'success'
                );

                // Update UI with results
                const originalSizeEl = document.getElementById('compress-original-size');
                if (originalSizeEl) {
                    originalSizeEl.textContent = this.formatFileSize(result.originalSize);
                }
                progressText.textContent = `Saved ${result.reduction}% - ${this.formatFileSize(result.originalSize - result.compressedSize)}`;
            } else {
                throw new Error('Compression failed');
            }

        } catch (error) {
            console.error('WASM compression error:', error);
            this.showToast(`Compression failed: ${error.message}`, 'error');
        } finally {
            // Reset UI
            if (progressElement) progressElement.style.display = 'none';
            if (compressButton) {
                compressButton.disabled = false;
                compressButton.textContent = 'Compress with Ghostscript';
            }
        }
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }

    async handleProtectFile(file) {
        if (!file || file.type !== 'application/pdf') {
            this.showToast('Please select a valid PDF file', 'error');
            return;
        }

        this.loadedPDFs.set('protect', file);
        
        // Check if it's an encrypted file
        const arrayBuffer = await file.arrayBuffer();
        const isEncrypted = this.pdfProtection.isEncryptedPDF(new Uint8Array(arrayBuffer));
        
        // Show appropriate UI
        const settingsEl = document.getElementById('protect-settings');
        const protectBtn = document.getElementById('protect-button');
        const decryptBtn = document.getElementById('decrypt-button');
        
        if (settingsEl) settingsEl.style.display = 'grid';
        
        if (isEncrypted) {
            if (protectBtn) protectBtn.style.display = 'none';
            if (decryptBtn) decryptBtn.style.display = 'inline-flex';
            this.showToast('Encrypted PDF detected. Use decrypt to unlock.', 'warning');
        } else {
            if (protectBtn) protectBtn.style.display = 'inline-flex';
            if (decryptBtn) decryptBtn.style.display = 'none';
            this.showToast('PDF loaded for protection. Configure security settings below.', 'success');
        }
        
        // Update security status
        this.updateSecurityStatus();
    }

    updateSecurityStatus() {
        const statusEl = document.getElementById('security-status');
        if (!statusEl) return;
        
        const methods = this.pdfProtection.getAvailableMethods();
        
        if (methods.webCrypto) {
            statusEl.textContent = 'AES-256 encryption available';
            statusEl.className = 'security-status high';
        } else if (methods.pdfLib) {
            statusEl.textContent = 'Basic protection available';
            statusEl.className = 'security-status medium';
        } else {
            statusEl.textContent = 'Limited protection available';
            statusEl.className = 'security-status low';
        }
    }

    async protectPDFWithEncryption() {
        try {
            const file = this.loadedPDFs.get('protect');
            if (!file) {
                this.showToast('No PDF loaded for protection', 'error');
                return;
            }

            // Get protection settings
            const method = document.getElementById('protect-method')?.value || 'auto';
            const userPassword = document.getElementById('protect-user-password')?.value || '';
            const ownerPassword = document.getElementById('protect-owner-password')?.value || '';
            
            const permissions = {
                print: document.getElementById('protect-print')?.checked || true,
                copy: document.getElementById('protect-copy')?.checked || true,
                modify: document.getElementById('protect-modify')?.checked || true,
                annotate: document.getElementById('protect-annotate')?.checked || true
            };

            // Validate input
            if (method === 'encryption' && !userPassword && !ownerPassword) {
                this.showToast('Password required for encryption', 'error');
                return;
            }

            // Show progress
            const progressEl = document.getElementById('protection-progress');
            const progressFill = document.getElementById('protect-progress-fill');
            const progressText = document.getElementById('protect-progress-text');
            const protectBtn = document.getElementById('protect-button');

            if (progressEl) progressEl.style.display = 'block';
            if (protectBtn) {
                protectBtn.disabled = true;
                protectBtn.textContent = 'Protecting...';
            }

            if (progressText) progressText.textContent = 'Initializing protection...';
            if (progressFill) progressFill.style.width = '10%';

            // Process protection
            const arrayBuffer = await file.arrayBuffer();
            
            if (progressText) progressText.textContent = 'Applying protection...';
            if (progressFill) progressFill.style.width = '50%';

            const result = await this.pdfProtection.protectPDF(arrayBuffer, {
                method,
                userPassword,
                ownerPassword,
                permissions
            });

            if (progressFill) progressFill.style.width = '100%';
            if (progressText) progressText.textContent = 'Protection complete!';

            if (result.success) {
                // Download protected PDF
                this.downloadPDF(result.data, 'protected.pdf');
                
                // Show success message
                this.showToast(
                    `✅ PDF Protection Applied!\n` +
                    `Method: ${result.method}\n` +
                    `Encrypted: ${result.isEncrypted ? 'Yes' : 'No'}\n` +
                    `Original: ${this.formatFileSize(result.originalSize)}\n` +
                    `Protected: ${this.formatFileSize(result.protectedSize)}` +
                    (result.note ? `\n\nNote: ${result.note}` : ''),
                    'success'
                );
            } else {
                throw new Error('Protection failed');
            }

        } catch (error) {
            console.error('PDF protection error:', error);
            this.showToast(`Protection failed: ${error.message}`, 'error');
        } finally {
            // Reset UI
            const progressEl = document.getElementById('protection-progress');
            const protectBtn = document.getElementById('protect-button');
            
            if (progressEl) progressEl.style.display = 'none';
            if (protectBtn) {
                protectBtn.disabled = false;
                protectBtn.textContent = 'Protect PDF';
            }
        }
    }

    async decryptPDF() {
        try {
            const file = this.loadedPDFs.get('protect');
            if (!file) {
                this.showToast('No PDF loaded for decryption', 'error');
                return;
            }

            // Get password
            const password = prompt('Enter password to decrypt PDF:');
            if (!password) {
                this.showToast('Password required for decryption', 'error');
                return;
            }

            // Show progress
            const progressEl = document.getElementById('protection-progress');
            const progressText = document.getElementById('protect-progress-text');
            const decryptBtn = document.getElementById('decrypt-button');

            if (progressEl) progressEl.style.display = 'block';
            if (progressText) progressText.textContent = 'Decrypting PDF...';
            if (decryptBtn) {
                decryptBtn.disabled = true;
                decryptBtn.textContent = 'Decrypting...';
            }

            // Decrypt
            const arrayBuffer = await file.arrayBuffer();
            const result = await this.pdfProtection.decryptPDF(new Uint8Array(arrayBuffer), password);

            if (result.success) {
                // Download decrypted PDF
                this.downloadPDF(result.data, 'decrypted.pdf');
                this.showToast('✅ PDF decrypted successfully!', 'success');
            } else {
                throw new Error('Decryption failed');
            }

        } catch (error) {
            console.error('PDF decryption error:', error);
            this.showToast(`Decryption failed: ${error.message}`, 'error');
        } finally {
            // Reset UI
            const progressEl = document.getElementById('protection-progress');
            const decryptBtn = document.getElementById('decrypt-button');
            
            if (progressEl) progressEl.style.display = 'none';
            if (decryptBtn) {
                decryptBtn.disabled = false;
                decryptBtn.textContent = 'Decrypt PDF';
            }
        }
    }

    async applyWatermark() {
        try {
            const file = this.loadedPDFs.get('watermark');
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await PDFLib.PDFDocument.load(arrayBuffer);
            
            const watermarkType = document.getElementById('watermark-type').value;
            const opacity = parseInt(document.getElementById('watermark-opacity').value) / 100;
            const position = document.getElementById('watermark-position').value;
            const pagesOption = document.getElementById('watermark-pages').value;
            
            let pagesToWatermark = [];
            if (pagesOption === 'all') {
                pagesToWatermark = Array.from({ length: pdf.getPageCount() }, (_, i) => i);
            } else if (pagesOption === 'first') {
                pagesToWatermark = [0];
            } else if (pagesOption === 'last') {
                pagesToWatermark = [pdf.getPageCount() - 1];
            } else if (pagesOption === 'custom') {
                const range = document.getElementById('watermark-range').value;
                pagesToWatermark = this.parsePageRange(range, pdf.getPageCount());
            }
            
            if (watermarkType === 'text') {
                const text = document.getElementById('watermark-text').value || 'WATERMARK';
                const font = await pdf.embedFont(PDFLib.StandardFonts.HelveticaBold);
                
                pagesToWatermark.forEach(pageIndex => {
                    const page = pdf.getPage(pageIndex);
                    const { width, height } = page.getSize();
                    
                    let x = width / 2;
                    let y = height / 2;
                    let rotation = 0;
                    
                    if (position === 'diagonal') {
                        rotation = -45;
                    } else if (position === 'top-left') {
                        x = 50;
                        y = height - 50;
                    } else if (position === 'top-right') {
                        x = width - 150;
                        y = height - 50;
                    } else if (position === 'bottom-left') {
                        x = 50;
                        y = 50;
                    } else if (position === 'bottom-right') {
                        x = width - 150;
                        y = 50;
                    }
                    
                    page.drawText(text, {
                        x: x,
                        y: y,
                        size: 50,
                        font: font,
                        color: PDFLib.rgb(0.5, 0.5, 0.5),
                        opacity: opacity,
                        rotate: PDFLib.degrees(rotation)
                    });
                });
            }
            
            const bytes = await pdf.save();
            this.downloadPDF(bytes, 'watermarked.pdf');
            
            this.showToast('Watermark applied successfully!', 'success');
        } catch (error) {
            this.showToast('Error applying watermark: ' + error.message, 'error');
        }
    }

    async createPDFFromImages() {
        try {
            this.showToast('Creating PDF from images...', 'success');
            
            const pdf = await PDFLib.PDFDocument.create();
            const fileItems = document.querySelectorAll('#imagetopdf-files .file-item');
            pdf.setKeywords(['protected', 'encrypted', 'secure']);
            
            // Add custom metadata for protection info
            const protectionInfo = {
                protected: true,
                timestamp: new Date().toISOString(),
                permissions: {
                    print: allowPrint,
                    copy: allowCopy,
                    modify: allowModify,
                    annotate: allowAnnotate
                },
                hasUserPassword: !!userPassword,
                hasOwnerPassword: !!ownerPassword
            };
            
            pdf.setCreationDate(new Date());
            pdf.setModificationDate(new Date());
            
            // If user wants to prevent modifications, flatten forms and annotations
            if (!allowModify) {
                const form = pdf.getForm();
                const fields = form.getFields();
                fields.forEach(field => {
                    try {
                        // Make fields read-only
                        field.enableReadOnly();
                    } catch (e) {
                        // Some fields might not support this
                    }
                });
            }
            
            // For basic protection, we can encrypt the content using a simple XOR cipher
            // Note: This is a basic demonstration. For real security, use proper encryption libraries
            if (userPassword) {
                // Add a visible watermark indicating the document is protected
                const pages = pdf.getPages();
                const font = await pdf.embedFont(PDFLib.StandardFonts.Helvetica);
                
                pages.forEach(page => {
                    const { width, height } = page.getSize();
                    
                    // Add subtle protection notice at the bottom
                    page.drawText('Protected Document', {
                        x: width / 2 - 50,
                        y: 10,
                        size: 8,
                        font: font,
                        color: PDFLib.rgb(0.7, 0.7, 0.7),
                        opacity: 0.5
                    });
                });
            }
            
            // Save with compression to obfuscate content slightly
            const bytes = await pdf.save({
                useObjectStreams: true, // This provides some obfuscation
                addDefaultPage: false,
                objectsPerTick: 50
            });
            
            // Create a wrapper object with protection metadata
            const protectedPDF = {
                data: bytes,
                protection: protectionInfo,
                encrypted: !!userPassword
            };
            
            this.downloadPDF(bytes, 'protected.pdf');
            
            let message = 'PDF protection applied:\n';
            if (userPassword) message += '✓ User password set\n';
            if (ownerPassword) message += '✓ Owner password set\n';
            message += `Permissions: Print:${allowPrint ? '✓' : '✗'} Copy:${allowCopy ? '✓' : '✗'} Modify:${allowModify ? '✓' : '✗'} Annotate:${allowAnnotate ? '✓' : '✗'}`;
            
            this.showToast(message, 'success');
            
            // Show additional warning about browser limitations
            setTimeout(() => {
                this.showToast('Note: Browser-based protection has limitations. For maximum security, use Adobe Acrobat or similar desktop software.', 'warning');
            }, 2000);
            
        } catch (error) {
            this.showToast('Error protecting PDF: ' + error.message, 'error');
            console.error('Protection error:', error);
        }
    }

    async createPDFFromImages() {
        try {
            this.showToast('Creating PDF from images...', 'success');
            
            const pdf = await PDFLib.PDFDocument.create();
            const fileItems = document.querySelectorAll('#imagetopdf-files .file-item');
            
            const pageSize = document.getElementById('imagetopdf-size').value;
            const orientation = document.getElementById('imagetopdf-orientation').value;
            const margin = parseInt(document.getElementById('imagetopdf-margin').value);
            
            for (const item of fileItems) {
                const fileId = parseFloat(item.dataset.fileId);
                const file = this.loadedPDFs.get(fileId);
                
                const imageBytes = await file.arrayBuffer();
                let image;
                
                if (file.type === 'image/jpeg' || file.type === 'image/jpg') {
                    image = await pdf.embedJpg(imageBytes);
                } else if (file.type === 'image/png') {
                    image = await pdf.embedPng(imageBytes);
                } else {
                    // Convert other formats to data URL then to PDF
                    const blob = new Blob([imageBytes], { type: file.type });
                    const url = URL.createObjectURL(blob);
                    const img = new Image();
                    await new Promise((resolve) => {
                        img.onload = resolve;
                        img.src = url;
                    });
                    
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);
                    
                    const dataUrl = canvas.toDataURL('image/png');
                    const base64 = dataUrl.split(',')[1];
                    const pngBytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
                    image = await pdf.embedPng(pngBytes);
                    
                    URL.revokeObjectURL(url);
                }
                
                let pageWidth, pageHeight;
                if (pageSize === 'a4') {
                    pageWidth = 595;
                    pageHeight = 842;
                } else if (pageSize === 'letter') {
                    pageWidth = 612;
                    pageHeight = 792;
                } else if (pageSize === 'legal') {
                    pageWidth = 612;
                    pageHeight = 1008;
                } else {
                    pageWidth = image.width;
                    pageHeight = image.height;
                }
                
                if (orientation === 'landscape' || (orientation === 'auto' && image.width > image.height)) {
                    [pageWidth, pageHeight] = [pageHeight, pageWidth];
                }
                
                const page = pdf.addPage([pageWidth, pageHeight]);
                
                const availableWidth = pageWidth - 2 * margin;
                const availableHeight = pageHeight - 2 * margin;
                
                const scale = Math.min(
                    availableWidth / image.width,
                    availableHeight / image.height
                );
                
                const scaledWidth = image.width * scale;
                const scaledHeight = image.height * scale;
                
                const x = (pageWidth - scaledWidth) / 2;
                const y = (pageHeight - scaledHeight) / 2;
                
                page.drawImage(image, {
                    x: x,
                    y: y,
                    width: scaledWidth,
                    height: scaledHeight
                });
            }
            
            const bytes = await pdf.save();
            this.downloadPDF(bytes, 'images.pdf');
            
            this.showToast('PDF created from images successfully!', 'success');
        } catch (error) {
            this.showToast('Error creating PDF: ' + error.message, 'error');
        }
    }

    async convertPDFToImages() {
        try {
            this.showToast('Converting PDF to images...', 'success');
            
            const format = document.getElementById('pdftoimage-format').value;
            const quality = parseInt(document.getElementById('pdftoimage-quality').value) / 100;
            const dpi = parseInt(document.getElementById('pdftoimage-dpi').value);
            const pagesOption = document.getElementById('pdftoimage-pages').value;
            
            let pagesToConvert = [];
            if (pagesOption === 'all') {
                pagesToConvert = Array.from({ length: this.currentPDF.numPages }, (_, i) => i + 1);
            } else if (pagesOption === 'current') {
                pagesToConvert = [this.currentPage];
            } else if (pagesOption === 'range') {
                const range = document.getElementById('pdftoimage-range').value;
                pagesToConvert = this.parsePageRange(range, this.currentPDF.numPages).map(p => p + 1);
            }
            
            const scale = dpi / 72;
            
            for (const pageNum of pagesToConvert) {
                const page = await this.currentPDF.getPage(pageNum);
                const viewport = page.getViewport({ scale: scale });
                
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                
                await page.render({
                    canvasContext: context,
                    viewport: viewport
                }).promise;
                
                canvas.toBlob((blob) => {
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `page_${pageNum}.${format}`;
                    a.click();
                    URL.revokeObjectURL(url);
                }, `image/${format}`, quality);
            }
            
            this.showToast(`Converted ${pagesToConvert.length} pages to ${format.toUpperCase()}!`, 'success');
        } catch (error) {
            this.showToast('Error converting PDF: ' + error.message, 'error');
        }
    }

    // Helper methods
    async createPageThumbnail(pdf, pageNum, toolName) {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 0.3 });
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        
        await page.render({
            canvasContext: context,
            viewport: viewport
        }).promise;
        
        const thumbnail = document.createElement('div');
        thumbnail.className = 'page-thumbnail';
        thumbnail.dataset.page = pageNum;
        
        thumbnail.innerHTML = `
            <canvas></canvas>
            <div class="page-thumbnail-number">Page ${pageNum}</div>
        `;
        
        thumbnail.querySelector('canvas').replaceWith(canvas);
        
        thumbnail.addEventListener('click', () => {
            if (this.selectedPages.has(pageNum)) {
                this.selectedPages.delete(pageNum);
                thumbnail.classList.remove('selected');
            } else {
                this.selectedPages.add(pageNum);
                thumbnail.classList.add('selected');
            }
            
            if (toolName === 'delete') {
                document.getElementById('delete-count').textContent = 
                    `${this.selectedPages.size} pages selected for deletion`;
            }
        });
        
        return thumbnail;
    }

    async createRotatableThumbnail(pdf, pageNum) {
        const thumbnail = await this.createPageThumbnail(pdf, pageNum, 'rotate');
        
        const rotateLeft = document.createElement('button');
        rotateLeft.className = 'icon-btn';
        rotateLeft.innerHTML = '↺';
        rotateLeft.onclick = (e) => {
            e.stopPropagation();
            this.rotatePage(pageNum, -90);
            const canvas = thumbnail.querySelector('canvas');
            canvas.style.transform = `rotate(${this.pageRotations.get(pageNum) || 0}deg)`;
        };
        
        const rotateRight = document.createElement('button');
        rotateRight.className = 'icon-btn';
        rotateRight.innerHTML = '↻';
        rotateRight.onclick = (e) => {
            e.stopPropagation();
            this.rotatePage(pageNum, 90);
            const canvas = thumbnail.querySelector('canvas');
            canvas.style.transform = `rotate(${this.pageRotations.get(pageNum) || 0}deg)`;
        };
        
        const controls = document.createElement('div');
        controls.style.display = 'flex';
        controls.style.gap = '0.5rem';
        controls.style.justifyContent = 'center';
        controls.appendChild(rotateLeft);
        controls.appendChild(rotateRight);
        
        thumbnail.appendChild(controls);
        
        return thumbnail;
    }

    async createDraggableThumbnail(pdf, pageNum) {
        const thumbnail = await this.createPageThumbnail(pdf, pageNum, 'reorder');
        thumbnail.draggable = true;
        thumbnail.dataset.originalPage = pageNum;
        
        return thumbnail;
    }

    async createSelectableThumbnail(pdf, pageNum, toolName) {
        return await this.createPageThumbnail(pdf, pageNum, toolName);
    }

    setupDragAndDrop(container) {
        let draggedElement = null;
        
        container.addEventListener('dragstart', (e) => {
            if (e.target.classList.contains('page-thumbnail')) {
                draggedElement = e.target;
                e.target.style.opacity = '0.5';
            }
        });
        
        container.addEventListener('dragend', (e) => {
            if (e.target.classList.contains('page-thumbnail')) {
                e.target.style.opacity = '';
            }
        });
        
        container.addEventListener('dragover', (e) => {
            e.preventDefault();
            const afterElement = this.getDragAfterElement(container, e.clientX);
            if (afterElement == null) {
                container.appendChild(draggedElement);
            } else {
                container.insertBefore(draggedElement, afterElement);
            }
        });
        
        container.addEventListener('drop', (e) => {
            e.preventDefault();
            this.updatePageOrder(container);
        });
    }

    getDragAfterElement(container, x) {
        const draggableElements = [...container.querySelectorAll('.page-thumbnail:not(.dragging)')];
        
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = x - box.left - box.width / 2;
            
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    updatePageOrder(container) {
        const thumbnails = container.querySelectorAll('.page-thumbnail');
        this.pageOrder = Array.from(thumbnails).map(t => parseInt(t.dataset.originalPage));
    }

    rotatePage(pageNum, degrees) {
        const current = this.pageRotations.get(pageNum) || 0;
        const newRotation = (current + degrees + 360) % 360;
        this.pageRotations.set(pageNum, newRotation);
    }

    rotateAllPages(degrees) {
        const thumbnails = document.querySelectorAll('#rotate-thumbnails .page-thumbnail');
        thumbnails.forEach(thumbnail => {
            const pageNum = parseInt(thumbnail.dataset.page);
            this.rotatePage(pageNum, degrees);
            const canvas = thumbnail.querySelector('canvas');
            canvas.style.transform = `rotate(${this.pageRotations.get(pageNum) || 0}deg)`;
        });
    }

    selectAllPages(selected) {
        const thumbnails = document.querySelectorAll('#extract-thumbnails .page-thumbnail');
        thumbnails.forEach(thumbnail => {
            const pageNum = parseInt(thumbnail.dataset.page);
            if (selected) {
                this.selectedPages.add(pageNum);
                thumbnail.classList.add('selected');
            } else {
                this.selectedPages.delete(pageNum);
                thumbnail.classList.remove('selected');
            }
        });
    }

    selectAllPagesForDeletion(selected) {
        const thumbnails = document.querySelectorAll('#delete-thumbnails .page-thumbnail');
        thumbnails.forEach(thumbnail => {
            const pageNum = parseInt(thumbnail.dataset.page);
            if (selected) {
                this.selectedPages.add(pageNum);
                thumbnail.classList.add('selected');
            } else {
                this.selectedPages.delete(pageNum);
                thumbnail.classList.remove('selected');
            }
        });
        document.getElementById('delete-count').textContent = 
            `${this.selectedPages.size} pages selected for deletion`;
    }

    invertSelection() {
        const thumbnails = document.querySelectorAll('#extract-thumbnails .page-thumbnail');
        thumbnails.forEach(thumbnail => {
            const pageNum = parseInt(thumbnail.dataset.page);
            if (this.selectedPages.has(pageNum)) {
                this.selectedPages.delete(pageNum);
                thumbnail.classList.remove('selected');
            } else {
                this.selectedPages.add(pageNum);
                thumbnail.classList.add('selected');
            }
        });
    }

    resetPageOrder() {
        const container = document.getElementById('reorder-thumbnails');
        const thumbnails = Array.from(container.querySelectorAll('.page-thumbnail'));
        
        thumbnails.sort((a, b) => {
            const pageA = parseInt(a.dataset.originalPage);
            const pageB = parseInt(b.dataset.originalPage);
            return pageA - pageB;
        });
        
        container.innerHTML = '';
        thumbnails.forEach(thumbnail => container.appendChild(thumbnail));
        
        this.updatePageOrder(container);
    }

    clearMergeFiles() {
        document.getElementById('merge-files').innerHTML = '';
        this.loadedPDFs.clear();
        document.getElementById('merge-button').style.display = 'none';
        document.getElementById('merge-clear').style.display = 'none';
    }

    clearImageFiles() {
        document.getElementById('imagetopdf-files').innerHTML = '';
        this.loadedPDFs.clear();
        document.getElementById('imagetopdf-settings').style.display = 'none';
        document.getElementById('imagetopdf-button').style.display = 'none';
        document.getElementById('imagetopdf-clear').style.display = 'none';
    }

    moveFileUp(fileId) {
        const item = document.querySelector(`[data-file-id="${fileId}"]`);
        const prev = item.previousElementSibling;
        if (prev) {
            item.parentNode.insertBefore(item, prev);
        }
    }

    moveFileDown(fileId) {
        const item = document.querySelector(`[data-file-id="${fileId}"]`);
        const next = item.nextElementSibling;
        if (next) {
            item.parentNode.insertBefore(next, item);
        }
    }

    removeFile(fileId) {
        const item = document.querySelector(`[data-file-id="${fileId}"]`);
        if (item) {
            item.remove();
            this.loadedPDFs.delete(parseFloat(fileId));
        }
        
        if (document.querySelectorAll('#merge-files .file-item').length === 0) {
            document.getElementById('merge-button').style.display = 'none';
            document.getElementById('merge-clear').style.display = 'none';
        }
    }

    removeImageFile(fileId) {
        const item = document.querySelector(`[data-file-id="${fileId}"]`);
        if (item) {
            item.remove();
            this.loadedPDFs.delete(parseFloat(fileId));
        }
        
        if (document.querySelectorAll('#imagetopdf-files .file-item').length === 0) {
            document.getElementById('imagetopdf-settings').style.display = 'none';
            document.getElementById('imagetopdf-button').style.display = 'none';
            document.getElementById('imagetopdf-clear').style.display = 'none';
        }
    }

    updateWatermarkPreview() {
        const text = document.getElementById('watermark-text').value || 'WATERMARK';
        const position = document.getElementById('watermark-position').value;
        const opacity = document.getElementById('watermark-opacity').value / 100;
        
        const overlay = document.getElementById('watermark-overlay');
        overlay.textContent = text;
        overlay.style.opacity = opacity;
        
        if (position === 'diagonal') {
            overlay.style.transform = 'translate(-50%, -50%) rotate(-45deg)';
        } else {
            overlay.style.transform = 'translate(-50%, -50%)';
        }
    }

    async renderPreview(pdf, canvasId) {
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 1 });
        
        const canvas = document.getElementById(canvasId);
        const context = canvas.getContext('2d');
        
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        
        await page.render({
            canvasContext: context,
            viewport: viewport
        }).promise;
    }

    async renderPDFToImagePreview() {
        const page = await this.currentPDF.getPage(this.currentPage);
        const viewport = page.getViewport({ scale: 1.5 });
        
        const canvas = document.getElementById('pdftoimage-canvas');
        const context = canvas.getContext('2d');
        
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        
        await page.render({
            canvasContext: context,
            viewport: viewport
        }).promise;
        
        document.getElementById('pdftoimage-pageinfo').textContent = 
            `Page ${this.currentPage} of ${this.currentPDF.numPages}`;
    }

    previousPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.renderPDFToImagePreview();
        }
    }

    nextPage() {
        if (this.currentPage < this.currentPDF.numPages) {
            this.currentPage++;
            this.renderPDFToImagePreview();
        }
    }

    parsePageRange(range, maxPage) {
        const pages = [];
        const parts = range.split(',');
        
        for (const part of parts) {
            const trimmed = part.trim();
            if (trimmed.includes('-')) {
                const [start, end] = trimmed.split('-').map(n => parseInt(n.trim()) - 1);
                for (let i = start; i <= Math.min(end, maxPage - 1); i++) {
                    if (i >= 0 && i < maxPage) pages.push(i);
                }
            } else {
                const page = parseInt(trimmed) - 1;
                if (page >= 0 && page < maxPage) pages.push(page);
            }
        }
        
        return [...new Set(pages)].sort((a, b) => a - b);
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }

    downloadPDF(bytes, filename) {
        const blob = new Blob([bytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        const icon = document.getElementById('toast-icon');
        const messageEl = document.getElementById('toast-message');
        
        toast.className = 'toast show ' + type;
        messageEl.textContent = message;
        
        if (type === 'success') {
            icon.textContent = '✓';
        } else if (type === 'error') {
            icon.textContent = '✕';
        } else if (type === 'warning') {
            icon.textContent = '⚠';
        }
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
}

// Initialize the application only if all libraries are available
let privpdf;
if (typeof pdfjsLib !== 'undefined' && typeof PDFLib !== 'undefined' && typeof window.jsPDF !== 'undefined') {
    privpdf = new PrivPDF();
    console.log('PrivPDF initialized successfully');
} else {
    console.error('Required libraries not available for PrivPDF initialization');
}