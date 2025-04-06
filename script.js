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
    console.log('initOCR関数が呼び出されました');
    
    // Check if Tesseract is available
    if (typeof Tesseract === 'undefined') {
        console.error('Tesseractライブラリが読み込まれていません');
        return;
    }
    
    console.log('Tesseractライブラリが利用可能です');
    
    try {
        console.log('OCRワーカーの初期化を開始します...');
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
    
// Extract button
document.getElementById('extract-btn').addEventListener('click', function() {
    if (capturedImage) {
        // 本番環境ではこちらを使用
        // processImageWithOCR(capturedImage);
        
        // テスト用のモックデータ
        console.log('テスト用のモックデータを使用します');
        const mockResult = {
            date: '2025年4月6日',
            storeName: 'テストスーパー',
            amount: '1250',
            confidence: {
                date: 0.9,
                store: 0.8,
                amount: 0.95
            },
            fullText: 'テストスーパー\n2025年4月6日\n商品A 500円\n商品B 750円\n合計 1250円'
        };
        ocrResults = mockResult;
        displayOCRResults(mockResult);
    }
});
    
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
    
    // Show extract button
    document.getElementById('extract-controls').style.display = 'block';
}

// Process image with OCR
async function processImageWithOCR(imageData) {
    console.log('processImageWithOCR が呼び出されました');
    
    // Clear previous OCR results
    ocrResults = null;
    
    // Remove previous OCR results display
    const previousResults = document.querySelector('.ocr-results');
    if (previousResults) {
        previousResults.remove();
    }
    
    try {
        // Show loading indicator
        document.getElementById('ocr-loading').style.display = 'flex';
        
        // Check if OCR worker is initialized
        if (!ocrWorker) {
            try {
                await initOCR();
            } catch (error) {
                console.error('OCRの初期化に失敗しました:', error);
                return;
            }
        }
        
        // Recognize text in the image
        console.log('OCR認識を開始します...');
        const result = await ocrWorker.recognize(imageData);
        console.log('OCR結果:', result);
        
        // Extract information from OCR result
        console.log('情報抽出を開始します...');
        const extractedInfo = extractInformationFromOCR(result);
        console.log('抽出された情報:', extractedInfo);
        ocrResults = extractedInfo;
        
        // Display OCR results
        console.log('OCR結果を表示します...');
        displayOCRResults(extractedInfo);
        console.log('OCR結果の表示が完了しました');
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
    
    // Log the full text for debugging
    console.log('OCR抽出テキスト:', text);
    
    // Extract date - improved pattern matching
    let date = '';
    let dateConfidence = 0;
    
    // Try multiple date patterns
    const datePatterns = [
        // YYYY年MM月DD日 or YYYY/MM/DD
        /(\d{4}[年/\-\.]\s*\d{1,2}[月/\-\.]\s*\d{1,2}[日]?)/,
        // MM月DD日 or MM/DD
        /(\d{1,2}[月/\-\.]\s*\d{1,2}[日]?)/,
        // YY/MM/DD
        /(\d{2}\/\d{1,2}\/\d{1,2})/,
        // YYYY-MM-DD
        /(\d{4}-\d{1,2}-\d{1,2})/
    ];
    
    for (const pattern of datePatterns) {
        const match = text.match(pattern);
        if (match) {
            date = match[0];
            dateConfidence = 0.8; // Higher confidence for explicit date formats
            break;
        }
    }
    
    // If no date found, look for lines with "日付" or "Date"
    if (!date) {
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes('日付') || lines[i].toLowerCase().includes('date')) {
                // Check if the next line might contain a date
                if (i + 1 < lines.length) {
                    const nextLine = lines[i + 1];
                    // Look for numbers and separators
                    if (/\d+[\/\-年月日\.]/.test(nextLine)) {
                        date = nextLine.trim();
                        dateConfidence = 0.6;
                        break;
                    }
                }
            }
        }
    }
    
    // Extract store name with improved logic
    let storeName = '';
    let storeConfidence = 0;
    
    // Common store name indicators
    const storeIndicators = ['店名', '店舗', 'ストア', 'マート', 'ショップ', 'STORE', 'SHOP'];
    
    // First check for lines with store indicators
    for (let i = 0; i < Math.min(10, lines.length); i++) {
        const line = lines[i];
        
        // Check if line contains store indicators
        for (const indicator of storeIndicators) {
            if (line.includes(indicator)) {
                // Extract store name from this line or the next
                const parts = line.split(/[:：]|\s{2,}/);
                if (parts.length > 1) {
                    storeName = parts[1].trim();
                } else if (i + 1 < lines.length) {
                    storeName = lines[i + 1].trim();
                }
                
                if (storeName) {
                    storeConfidence = 0.8;
                    break;
                }
            }
        }
        
        if (storeName) break;
    }
    
    // If no store name found with indicators, use the traditional approach
    if (!storeName) {
        // Look at the first few lines for potential store names
        for (let i = 0; i < Math.min(5, lines.length); i++) {
            // Skip lines that are likely not store names
            if (!lines[i].match(/合計|小計|税|円|日付|時間|レシート|領収書|¥|\d{1,2}\/\d{1,2}|^\s*\d+\s*$/i)) {
                storeName = lines[i].trim();
                storeConfidence = 0.6;
                break;
            }
        }
    }
    
    // Extract amount with improved pattern matching
    let amount = '';
    let amountConfidence = 0;
    
    // Try multiple amount patterns in order of reliability
    const amountPatterns = [
        // 合計 or 小計 followed by numbers
        {pattern: /(合計|小計|総額|お買上げ|計).*?(\d[\d,]*)/i, confidence: 0.9},
        // Numbers followed by 円 or ¥
        {pattern: /(\d[\d,]*)(?:\s*)(?:円|¥)/i, confidence: 0.8},
        // Just look for large numbers (likely to be totals)
        {pattern: /(\d{3,}[\d,]*)/i, confidence: 0.5}
    ];
    
    for (const {pattern, confidence} of amountPatterns) {
        const match = text.match(pattern);
        if (match) {
            // For the first pattern, we want the second capture group
            const amountStr = pattern === amountPatterns[0].pattern ? match[2] : match[1];
            amount = amountStr.replace(/,/g, '');
            amountConfidence = confidence;
            break;
        }
    }
    
    // If still no amount found, look for lines with "合計" or "Total"
    if (!amount) {
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes('合計') || lines[i].toLowerCase().includes('total')) {
                // Extract numbers from this line
                const numbers = lines[i].match(/\d[\d,]*/g);
                if (numbers && numbers.length > 0) {
                    // Use the largest number as it's likely the total
                    amount = numbers.reduce((max, num) => {
                        const value = parseInt(num.replace(/,/g, ''));
                        return value > max ? value : max;
                    }, 0).toString();
                    amountConfidence = 0.7;
                    break;
                }
            }
        }
    }
    
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
    console.log('displayOCRResults関数が呼び出されました', extractedInfo);
    
    try {
        // Create OCR results element
        const resultsElement = document.createElement('div');
        resultsElement.className = 'ocr-results';
        
        // Add heading
        resultsElement.innerHTML = `
            <h3>レシート解析結果</h3>
            <p>以下の情報が検出され、自動入力されました：</p>
        `;
        
        console.log('OCR結果要素を作成しました');
        
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
            console.log('日付情報を追加しました:', extractedInfo.date);
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
            console.log('店舗名情報を追加しました:', extractedInfo.storeName);
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
            console.log('金額情報を追加しました:', extractedInfo.amount);
        }
        
        // Add message if no information was extracted
        if (!extractedInfo.date && !extractedInfo.storeName && !extractedInfo.amount) {
            resultsElement.innerHTML += `
                <p><em>レシートから情報を抽出できませんでした。手動で入力してください。</em></p>
            `;
            console.log('情報が抽出できなかったメッセージを追加しました');
        } else {
            resultsElement.innerHTML += `
                <p class="auto-fill-message">
                    <i class="fas fa-info-circle"></i> 抽出された情報は自動的にフォームに入力されました。必要に応じて修正してください。
                </p>
            `;
            console.log('自動入力メッセージを追加しました');
        }
        
        // Insert results before the form
        const formSection = document.querySelector('.expense-form');
        console.log('フォームセクション要素:', formSection);
        
        if (formSection) {
            const formElement = formSection.querySelector('form');
            console.log('フォーム要素:', formElement);
            
            if (formElement) {
                formSection.insertBefore(resultsElement, formElement);
                console.log('OCR結果要素をDOMに挿入しました');
            } else {
                console.error('フォーム要素が見つかりません');
                // フォールバック: フォームセクションの先頭に追加
                formSection.prepend(resultsElement);
                console.log('フォールバック: OCR結果要素をフォームセクションの先頭に追加しました');
            }
        } else {
            console.error('フォームセクション要素が見つかりません');
        }
        
        // Automatically apply OCR results to form
        console.log('applyOCRResults関数を呼び出します');
        applyOCRResults();
        console.log('OCR結果の表示と適用が完了しました');
    } catch (error) {
        console.error('displayOCRResults関数でエラーが発生しました:', error);
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
        // Try to convert various date formats to ISO format
        try {
            let dateStr = ocrResults.date;
            let year, month, day;
            
            // Clean up the date string
            dateStr = dateStr.trim()
                .replace(/年/g, '-')
                .replace(/月/g, '-')
                .replace(/日/g, '')
                .replace(/\s+/g, '')
                .replace(/\./g, '-');
            
            console.log('Cleaned date string:', dateStr);
            
            // Try to extract year, month, day using regex
            const fullDateMatch = dateStr.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
            const shortDateMatch = dateStr.match(/(\d{1,2})[\/\-](\d{1,2})/);
            const yymmddMatch = dateStr.match(/(\d{2})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
            
            if (fullDateMatch) {
                // YYYY-MM-DD format
                [, year, month, day] = fullDateMatch;
            } else if (yymmddMatch) {
                // YY-MM-DD format
                const yy = yymmddMatch[1];
                month = yymmddMatch[2];
                day = yymmddMatch[3];
                
                // Assume 20xx for years less than 50, 19xx otherwise
                year = parseInt(yy) < 50 ? `20${yy}` : `19${yy}`;
            } else if (shortDateMatch) {
                // MM-DD format
                month = shortDateMatch[1];
                day = shortDateMatch[2];
                year = new Date().getFullYear().toString();
            } else {
                // Try to extract numbers from the string
                const numbers = dateStr.match(/\d+/g);
                if (numbers && numbers.length >= 2) {
                    // Assume the format is either YMD, MDY, or DMY
                    if (numbers.length >= 3 && numbers[0].length === 4) {
                        // Likely YYYY-MM-DD
                        [year, month, day] = numbers;
                    } else if (numbers.length >= 3 && parseInt(numbers[1]) <= 12) {
                        // Likely DD-MM-YYYY or MM-DD-YYYY
                        // In Japan, MM-DD is more common
                        month = numbers[0];
                        day = numbers[1];
                        year = numbers[2] || new Date().getFullYear().toString();
                    } else {
                        // Default to MM-DD-YYYY
                        month = numbers[0];
                        day = numbers[1];
                        year = new Date().getFullYear().toString();
                    }
                } else {
                    // Can't parse, use current date
                    const today = new Date();
                    year = today.getFullYear().toString();
                    month = (today.getMonth() + 1).toString();
                    day = today.getDate().toString();
                }
            }
            
            // Validate year, month, day
            year = parseInt(year);
            month = parseInt(month);
            day = parseInt(day);
            
            // Basic validation
            if (isNaN(year) || isNaN(month) || isNaN(day) || 
                month < 1 || month > 12 || day < 1 || day > 31) {
                throw new Error('Invalid date components');
            }
            
            // If year is two digits, assume 2000s
            if (year < 100) {
                year += year < 50 ? 2000 : 1900;
            }
            
            // Format as ISO date string
            const isoDate = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
            document.getElementById('date').value = isoDate;
            
            console.log('Converted to ISO date:', isoDate);
        } catch (error) {
            console.error('日付の変換に失敗しました:', error);
            // Use current date as fallback
            document.getElementById('date').valueAsDate = new Date();
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
    document.getElementById('extract-controls').style.display = 'none';
    
    // Remove OCR results if any
    const previousResults = document.querySelector('.ocr-results');
    if (previousResults) {
        previousResults.remove();
    }
    
    // Clear captured image
    capturedImage = null;
    ocrResults = null;
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
        document.getElementById('extract-controls').style.display = 'block';
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
                
                // Show extract button
                document.getElementById('extract-controls').style.display = 'block';
            };
            reader.readAsDataURL(file);
        }
    });
}

// テスト用の関数 - 自動的にモックデータを表示
function testAutoFill() {
    console.log('テスト用の自動入力を実行します');
    
    // テスト用のモックデータ
    const mockResult = {
        date: '2025年4月6日',
        storeName: 'テストスーパー',
        amount: '1250',
        confidence: {
            date: 0.9,
            store: 0.8,
            amount: 0.95
        },
        fullText: 'テストスーパー\n2025年4月6日\n商品A 500円\n商品B 750円\n合計 1250円'
    };
    
    // 画像をキャプチャしたように見せかける
    capturedImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    
    // 画像プレビューを表示
    photoPreview.innerHTML = `<img src="${capturedImage}" alt="テスト用レシート">`;
    photoPreview.style.display = 'block';
    
    // カメラを非表示
    if (cameraElement) {
        cameraElement.style.display = 'none';
    }
    
    // 撮影ボタンを非表示、再撮影ボタンを表示
    if (captureBtn) {
        captureBtn.style.display = 'none';
    }
    if (retakeBtn) {
        retakeBtn.style.display = 'inline-flex';
    }
    
    // 抽出コントロールを表示
    const extractControls = document.getElementById('extract-controls');
    if (extractControls) {
        extractControls.style.display = 'block';
    }
    
    // OCR結果を表示
    ocrResults = mockResult;
    displayOCRResults(mockResult);
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
    
    // テスト用の自動入力を実行（デバッグ用）
    setTimeout(testAutoFill, 1000);
});
