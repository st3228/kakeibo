// DOM Elements
const cameraElement = document.getElementById('camera');
const canvasElement = document.getElementById('canvas');
const captureBtn = document.getElementById('capture-btn');
const retakeBtn = document.getElementById('retake-btn');
const photoPreview = document.getElementById('photo-preview');
const expenseForm = document.getElementById('expense-form');
const expensesTableBody = document.getElementById('expenses-table-body');
const totalAmountElement = document.getElementById('total-amount');
const filterMonthInput = document.getElementById('filter-month');
const filterCategorySelect = document.getElementById('filter-category');
const applyFilterBtn = document.getElementById('apply-filter');

// Global variables
let stream = null;
let capturedImage = null;
let expenses = [];
let currentFilters = {
    month: '',
    category: ''
};
let ocrWorker = null;
let ocrResults = null;

// Initialize Tesseract.js worker
async function initOCR() {
    try {
        ocrWorker = await Tesseract.createWorker('jpn');
        console.log('OCRワーカーが初期化されました');
    } catch (error) {
        console.error('OCRワーカーの初期化に失敗しました:', error);
    }
}

// Initialize the application
function init() {
    // Set default date to today
    document.getElementById('date').valueAsDate = new Date();
    
    // Set default month filter to current month
    const today = new Date();
    filterMonthInput.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    
    // Load expenses from localStorage
    loadExpenses();
    
    // Initialize camera
    initCamera();
    
    // Add event listeners
    addEventListeners();
}

// Initialize camera
async function initCamera() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                facingMode: 'environment',
                width: { ideal: 1280 },
                height: { ideal: 720 }
            } 
        });
        cameraElement.srcObject = stream;
        
        // Show camera section if access is granted
        document.querySelector('.camera-container').style.display = 'flex';
        document.getElementById('camera-error').style.display = 'none';
    } catch (error) {
        console.error('カメラへのアクセスに失敗しました:', error);
        
        // Show error message and manual upload option
        document.querySelector('.camera-container').style.display = 'none';
        document.getElementById('camera-error').style.display = 'block';
    }
}

// Add event listeners
function addEventListeners() {
    // Camera controls
    captureBtn.addEventListener('click', capturePhoto);
    retakeBtn.addEventListener('click', retakePhoto);
    
    // Form submission
    expenseForm.addEventListener('submit', saveExpense);
    
    // Filter controls
    applyFilterBtn.addEventListener('click', applyFilters);
    
    // Modal close event (for receipt image viewing)
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('close-modal')) {
            document.querySelector('.modal').style.display = 'none';
        }
    });
}

// Capture photo from camera
async function capturePhoto() {
    if (!stream) {
        alert('カメラが利用できません。');
        return;
    }
    
    // Set canvas dimensions to match video
    canvasElement.width = cameraElement.videoWidth;
    canvasElement.height = cameraElement.videoHeight;
    
    // Draw video frame to canvas
    const context = canvasElement.getContext('2d');
    context.drawImage(cameraElement, 0, 0, canvasElement.width, canvasElement.height);
    
    // Get image data
    capturedImage = canvasElement.toDataURL('image/jpeg');
    
    // Display captured image
    photoPreview.innerHTML = `<img src="${capturedImage}" alt="撮影したレシート">`;
    photoPreview.style.display = 'block';
    
    // Update UI
    cameraElement.style.display = 'none';
    captureBtn.style.display = 'none';
    retakeBtn.style.display = 'inline-flex';
    
    // Process image with OCR
    processImageWithOCR(capturedImage);
}

// Process image with OCR
async function processImageWithOCR(imageData) {
    // Clear previous OCR results
    ocrResults = null;
    
    // Remove previous OCR results display
    const previousResults = document.querySelector('.ocr-results');
    if (previousResults) {
        previousResults.remove();
    }
    
    // Check if OCR worker is initialized
    if (!ocrWorker) {
        try {
            await initOCR();
        } catch (error) {
            console.error('OCRの初期化に失敗しました:', error);
            return;
        }
    }
    
    try {
        // Show loading indicator
        document.getElementById('ocr-loading').style.display = 'flex';
        
        // Recognize text in the image
        const result = await ocrWorker.recognize(imageData);
        console.log('OCR結果:', result);
        
        // Extract information from OCR result
        const extractedInfo = extractInformationFromOCR(result);
        ocrResults = extractedInfo;
        
        // Display OCR results
        displayOCRResults(extractedInfo);
    } catch (error) {
        console.error('OCR処理中にエラーが発生しました:', error);
    } finally {
        // Hide loading indicator
        document.getElementById('ocr-loading').style.display = 'none';
    }
}

// Extract information from OCR result
function extractInformationFromOCR(ocrResult) {
    const text = ocrResult.data.text;
    const lines = text.split('\n').filter(line => line.trim() !== '');
    
    // Extract date
    const datePattern = /(\d{4}[年/\-\.]\s*\d{1,2}[月/\-\.]\s*\d{1,2}|\d{1,2}[月/\-\.]\s*\d{1,2})/;
    const dateMatch = text.match(datePattern);
    const date = dateMatch ? dateMatch[0] : '';
    
    // Extract store name (usually in the first few lines)
    let storeName = '';
    for (let i = 0; i < Math.min(5, lines.length); i++) {
        // Skip lines that are likely not store names (contain specific patterns)
        if (!lines[i].match(/合計|小計|税|円|日付|時間|レシート|領収書|¥|\d{1,2}\/\d{1,2}/i)) {
            storeName = lines[i].trim();
            break;
        }
    }
    
    // Extract amount (look for total amount)
    const amountPattern = /(合計|小計|総額|お買上げ|計).*?(\d[\d,]*)/i;
    const amountMatch = text.match(amountPattern);
    let amount = '';
    
    if (amountMatch) {
        // Extract only numbers and remove commas
        amount = amountMatch[2].replace(/,/g, '');
    } else {
        // Try to find any number followed by "円" or "¥"
        const altAmountPattern = /(\d[\d,]*)(?:\s*)(?:円|¥)/;
        const altAmountMatch = text.match(altAmountPattern);
        if (altAmountMatch) {
            amount = altAmountMatch[1].replace(/,/g, '');
        }
    }
    
    // Calculate confidence scores (simple heuristic)
    const dateConfidence = date ? 0.7 : 0;
    const storeConfidence = storeName ? 0.6 : 0;
    const amountConfidence = amount ? 0.8 : 0;
    
    return {
        date,
        storeName,
        amount,
        confidence: {
            date: dateConfidence,
            store: storeConfidence,
            amount: amountConfidence
        },
        fullText: text
    };
}

// Display OCR results
function displayOCRResults(extractedInfo) {
    // Create OCR results element
    const resultsElement = document.createElement('div');
    resultsElement.className = 'ocr-results';
    
    // Add heading
    resultsElement.innerHTML = `
        <h3>レシート解析結果</h3>
        <p>以下の情報が検出されました：</p>
    `;
    
    // Add date info if available
    if (extractedInfo.date) {
        const confidenceClass = getConfidenceClass(extractedInfo.confidence.date);
        resultsElement.innerHTML += `
            <p>
                <strong>日付:</strong> ${extractedInfo.date}
                <span class="confidence ${confidenceClass}">
                    (信頼度: ${Math.round(extractedInfo.confidence.date * 100)}%)
                </span>
            </p>
        `;
    }
    
    // Add store info if available
    if (extractedInfo.storeName) {
        const confidenceClass = getConfidenceClass(extractedInfo.confidence.store);
        resultsElement.innerHTML += `
            <p>
                <strong>店舗名:</strong> ${extractedInfo.storeName}
                <span class="confidence ${confidenceClass}">
                    (信頼度: ${Math.round(extractedInfo.confidence.store * 100)}%)
                </span>
            </p>
        `;
    }
    
    // Add amount info if available
    if (extractedInfo.amount) {
        const confidenceClass = getConfidenceClass(extractedInfo.confidence.amount);
        resultsElement.innerHTML += `
            <p>
                <strong>金額:</strong> ${extractedInfo.amount}円
                <span class="confidence ${confidenceClass}">
                    (信頼度: ${Math.round(extractedInfo.confidence.amount * 100)}%)
                </span>
            </p>
        `;
    }
    
    // Add apply button
    if (extractedInfo.date || extractedInfo.storeName || extractedInfo.amount) {
        resultsElement.innerHTML += `
            <button id="apply-ocr-btn" class="btn ocr-apply-btn">
                <i class="fas fa-check"></i> この情報を適用する
            </button>
        `;
    } else {
        resultsElement.innerHTML += `
            <p><em>レシートから情報を抽出できませんでした。手動で入力してください。</em></p>
        `;
    }
    
    // Insert results before the form
    const formSection = document.querySelector('.expense-form');
    formSection.insertBefore(resultsElement, formSection.querySelector('form'));
    
    // Add event listener to apply button
    const applyBtn = document.getElementById('apply-ocr-btn');
    if (applyBtn) {
        applyBtn.addEventListener('click', applyOCRResults);
    }
}

// Get confidence class based on confidence value
function getConfidenceClass(confidence) {
    if (confidence >= 0.7) {
        return 'high-confidence';
    } else if (confidence >= 0.4) {
        return 'medium-confidence';
    } else {
        return 'low-confidence';
    }
}

// Apply OCR results to form
function applyOCRResults() {
    if (!ocrResults) return;
    
    // Apply date if available
    if (ocrResults.date) {
        // Try to convert Japanese date format to ISO format
        try {
            let dateStr = ocrResults.date;
            
            // Replace Japanese characters with standard separators
            dateStr = dateStr.replace(/年/g, '-').replace(/月/g, '-').replace(/日/g, '');
            
            // Handle different date formats
            let dateParts;
            if (dateStr.includes('-')) {
                dateParts = dateStr.split('-');
            } else if (dateStr.includes('/')) {
                dateParts = dateStr.split('/');
            } else if (dateStr.includes('.')) {
                dateParts = dateStr.split('.');
            }
            
            if (dateParts) {
                // If year is missing, add current year
                if (dateParts.length === 2) {
                    const currentYear = new Date().getFullYear();
                    dateParts.unshift(currentYear.toString());
                }
                
                // Ensure month and day are two digits
                if (dateParts[1].length === 1) dateParts[1] = '0' + dateParts[1];
                if (dateParts[2].length === 1) dateParts[2] = '0' + dateParts[2];
                
                // Create ISO date string
                const isoDate = `${dateParts[0]}-${dateParts[1]}-${dateParts[2]}`;
                document.getElementById('date').value = isoDate;
            }
        } catch (error) {
            console.error('日付の変換に失敗しました:', error);
        }
    }
    
    // Apply store name if available
    if (ocrResults.storeName) {
        document.getElementById('store').value = ocrResults.storeName;
    }
    
    // Apply amount if available
    if (ocrResults.amount) {
        document.getElementById('amount').value = ocrResults.amount;
    }
}

// Retake photo
function retakePhoto() {
    // Reset UI
    cameraElement.style.display = 'block';
    photoPreview.style.display = 'none';
    captureBtn.style.display = 'inline-flex';
    retakeBtn.style.display = 'none';
    
    // Clear captured image
    capturedImage = null;
}

// Save expense data
function saveExpense(e) {
    e.preventDefault();
    
    // Get form data
    const date = document.getElementById('date').value;
    const store = document.getElementById('store').value;
    const amount = parseInt(document.getElementById('amount').value);
    const category = document.getElementById('category').value;
    const memo = document.getElementById('memo').value;
    
    // Validate form data
    if (!date || !store || isNaN(amount) || !category) {
        alert('必須項目を入力してください。');
        return;
    }
    
    // Create expense object
    const expense = {
        id: Date.now().toString(),
        date,
        store,
        amount,
        category,
        memo,
        receipt: capturedImage
    };
    
    // Add to expenses array
    expenses.push(expense);
    
    // Save to localStorage
    saveExpensesToLocalStorage();
    
    // Update UI
    renderExpenses();
    
    // Reset form
    expenseForm.reset();
    document.getElementById('date').valueAsDate = new Date();
    retakePhoto();
    
    // Show success message
    alert('支出データを保存しました。');
}

// Load expenses from localStorage
function loadExpenses() {
    const storedExpenses = localStorage.getItem('expenses');
    if (storedExpenses) {
        expenses = JSON.parse(storedExpenses);
        renderExpenses();
    }
}

// Save expenses to localStorage
function saveExpensesToLocalStorage() {
    localStorage.setItem('expenses', JSON.stringify(expenses));
}

// Render expenses table
function renderExpenses() {
    // Clear table
    expensesTableBody.innerHTML = '';
    
    // Filter expenses
    const filteredExpenses = filterExpenses();
    
    // Calculate total amount
    const total = filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    totalAmountElement.textContent = total.toLocaleString();
    
    // If no expenses, show message
    if (filteredExpenses.length === 0) {
        expensesTableBody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center;">データがありません</td>
            </tr>
        `;
        return;
    }
    
    // Sort expenses by date (newest first)
    filteredExpenses.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // Render each expense
    filteredExpenses.forEach(expense => {
        const row = document.createElement('tr');
        
        // Format date
        const formattedDate = new Date(expense.date).toLocaleDateString('ja-JP');
        
        row.innerHTML = `
            <td>${formattedDate}</td>
            <td>${expense.store}</td>
            <td>${expense.amount.toLocaleString()}円</td>
            <td>${expense.category}</td>
            <td>${expense.memo || '-'}</td>
            <td>
                ${expense.receipt 
                    ? `<img src="${expense.receipt}" alt="レシート" class="receipt-thumbnail" onclick="showReceiptModal('${expense.id}')">`
                    : '-'
                }
            </td>
            <td class="action-buttons">
                <button class="btn edit-btn" onclick="editExpense('${expense.id}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn delete-btn" onclick="deleteExpense('${expense.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        
        expensesTableBody.appendChild(row);
    });
}

// Filter expenses based on current filters
function filterExpenses() {
    return expenses.filter(expense => {
        // Filter by month
        if (currentFilters.month && !expense.date.startsWith(currentFilters.month)) {
            return false;
        }
        
        // Filter by category
        if (currentFilters.category && expense.category !== currentFilters.category) {
            return false;
        }
        
        return true;
    });
}

// Apply filters
function applyFilters() {
    currentFilters.month = filterMonthInput.value;
    currentFilters.category = filterCategorySelect.value;
    renderExpenses();
}

// Edit expense
function editExpense(id) {
    const expense = expenses.find(exp => exp.id === id);
    if (!expense) return;
    
    // Fill form with expense data
    document.getElementById('date').value = expense.date;
    document.getElementById('store').value = expense.store;
    document.getElementById('amount').value = expense.amount;
    document.getElementById('category').value = expense.category;
    document.getElementById('memo').value = expense.memo || '';
    
    // Show receipt image if available
    if (expense.receipt) {
        capturedImage = expense.receipt;
        photoPreview.innerHTML = `<img src="${capturedImage}" alt="撮影したレシート">`;
        photoPreview.style.display = 'block';
        cameraElement.style.display = 'none';
        captureBtn.style.display = 'none';
        retakeBtn.style.display = 'inline-flex';
    }
    
    // Remove the expense from the array
    expenses = expenses.filter(exp => exp.id !== id);
    
    // Scroll to form
    document.querySelector('.expense-form').scrollIntoView({ behavior: 'smooth' });
}

// Delete expense
function deleteExpense(id) {
    if (!confirm('この支出データを削除してもよろしいですか？')) {
        return;
    }
    
    expenses = expenses.filter(expense => expense.id !== id);
    saveExpensesToLocalStorage();
    renderExpenses();
}

// Show receipt modal
function showReceiptModal(id) {
    const expense = expenses.find(exp => exp.id === id);
    if (!expense || !expense.receipt) return;
    
    // Create modal if it doesn't exist
    let modal = document.querySelector('.modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <span class="close-modal">&times;</span>
            <div class="modal-content">
                <img class="modal-image" src="" alt="レシート">
            </div>
        `;
        document.body.appendChild(modal);
    }
    
    // Set image source
    modal.querySelector('.modal-image').src = expense.receipt;
    
    // Show modal
    modal.style.display = 'block';
}

// Export data as CSV
function exportCSV() {
    // Create CSV header
    let csv = '日付,店舗名,金額,カテゴリ,メモ\n';
    
    // Add each expense as a row
    expenses.forEach(expense => {
        const row = [
            expense.date,
            `"${expense.store.replace(/"/g, '""')}"`,
            expense.amount,
            expense.category,
            `"${(expense.memo || '').replace(/"/g, '""')}"`
        ].join(',');
        
        csv += row + '\n';
    });
    
    // Create download link
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '家計簿データ.csv';
    a.click();
    
    // Clean up
    URL.revokeObjectURL(url);
}

// Add export button to the page
function addExportButton() {
    const exportBtn = document.createElement('button');
    exportBtn.className = 'btn';
    exportBtn.innerHTML = '<i class="fas fa-download"></i> CSVエクスポート';
    exportBtn.style.marginLeft = 'auto';
    exportBtn.addEventListener('click', exportCSV);
    
    document.querySelector('.expenses-summary').appendChild(exportBtn);
}

// Toggle camera section visibility
function toggleCameraSection() {
    const cameraSection = document.querySelector('.camera-section');
    const toggleBtn = document.getElementById('toggle-camera-btn');
    
    if (cameraSection.style.display === 'none') {
        cameraSection.style.display = 'block';
        toggleBtn.innerHTML = '<i class="fas fa-camera-slash"></i> カメラを非表示';
    } else {
        cameraSection.style.display = 'none';
        toggleBtn.innerHTML = '<i class="fas fa-camera"></i> カメラを表示';
    }
}

// Add a file input for manual receipt upload
function setupManualUpload() {
    const fileInput = document.getElementById('receipt-upload');
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                capturedImage = event.target.result;
                photoPreview.innerHTML = `<img src="${capturedImage}" alt="アップロードしたレシート">`;
                photoPreview.style.display = 'block';
                document.getElementById('manual-upload-preview').style.display = 'block';
                
                // Process uploaded image with OCR
                processImageWithOCR(capturedImage);
            };
            reader.readAsDataURL(file);
        }
    });
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    init();
    addExportButton();
    
    // Initialize OCR
    initOCR();
    
    // Add toggle camera button
    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'toggle-camera-btn';
    toggleBtn.className = 'btn';
    toggleBtn.innerHTML = '<i class="fas fa-camera-slash"></i> カメラを非表示';
    toggleBtn.style.marginLeft = '10px';
    toggleBtn.addEventListener('click', toggleCameraSection);
    
    document.querySelector('.camera-section h2').appendChild(toggleBtn);
    
    // Add camera error message and manual upload option
    const cameraContainer = document.querySelector('.camera-container');
    const cameraError = document.createElement('div');
    cameraError.id = 'camera-error';
    cameraError.style.display = 'none';
    cameraError.innerHTML = `
        <div class="alert alert-warning">
            <p><i class="fas fa-exclamation-triangle"></i> カメラへのアクセスができません。</p>
            <p>カメラの使用を許可するか、レシート画像を直接アップロードしてください。</p>
            <div class="manual-upload">
                <input type="file" id="receipt-upload" accept="image/*" class="file-input">
                <label for="receipt-upload" class="btn"><i class="fas fa-upload"></i> レシート画像をアップロード</label>
            </div>
            <div id="manual-upload-preview" style="display: none; margin-top: 10px;"></div>
        </div>
    `;
    
    cameraContainer.parentNode.insertBefore(cameraError, cameraContainer);
    
    // Setup manual upload
    setupManualUpload();
    
    // Check if browser supports camera
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        document.querySelector('.camera-container').style.display = 'none';
        document.getElementById('camera-error').style.display = 'block';
    }
});
