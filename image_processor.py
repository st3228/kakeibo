import base64
import re
import io
from PIL import Image, ImageEnhance, ImageFilter
from js import console

def preprocess_image(image_data):
    """
    Preprocess the image using PIL
    """
    try:
        # Convert base64 to image
        if isinstance(image_data, str) and image_data.startswith('data:image'):
            # Extract the base64 part
            base64_data = image_data.split(',')[1]
            image_bytes = base64.b64decode(base64_data)
            img = Image.open(io.BytesIO(image_bytes))
        else:
            img = Image.open(io.BytesIO(image_data))
        
        # Convert to grayscale
        img = img.convert('L')
        
        # Enhance contrast
        enhancer = ImageEnhance.Contrast(img)
        img = enhancer.enhance(2.0)
        
        # Apply sharpening
        img = img.filter(ImageFilter.SHARPEN)
        
        return img
    except Exception as e:
        console.error(f"Error preprocessing image: {str(e)}")
        return None

def extract_text_from_image(image_data):
    """
    This is a placeholder since we can't use pytesseract in the browser.
    In a real implementation, we would use a cloud OCR service or a JavaScript OCR library.
    For now, we'll return a mock result for testing.
    """
    try:
        # Preprocess the image
        processed_img = preprocess_image(image_data)
        if processed_img is None:
            return "Error preprocessing image"
        
        # In a real implementation, we would send the image to a server for OCR
        # or use a JavaScript OCR library.
        # For now, we'll return a mock result
        mock_text = """
        スーパーマーケット ABC
        2025年4月6日
        
        商品A     100円
        商品B     200円
        商品C     300円
        
        合計     600円
        税込     660円
        """
        
        return mock_text
    except Exception as e:
        console.error(f"Error extracting text: {str(e)}")
        return f"Error: {str(e)}"

def extract_receipt_info(text):
    """
    Extract date, store name, and amount from receipt text
    """
    lines = text.split('\n')
    lines = [line.strip() for line in lines if line.strip()]
    
    # Extract date
    date = extract_date(text, lines)
    
    # Extract store name
    store_name = extract_store_name(lines)
    
    # Extract amount
    amount = extract_amount(text, lines)
    
    # Calculate confidence scores
    date_confidence = 0.8 if date else 0
    store_confidence = 0.7 if store_name else 0
    amount_confidence = 0.9 if amount else 0
    
    return {
        "date": date,
        "storeName": store_name,
        "amount": amount,
        "confidence": {
            "date": date_confidence,
            "store": store_confidence,
            "amount": amount_confidence
        },
        "fullText": text
    }

def extract_date(text, lines):
    """
    Extract date from receipt text
    """
    # Try multiple date patterns
    date_patterns = [
        # YYYY年MM月DD日 or YYYY/MM/DD
        r'(\d{4}[年/\-\.]\s*\d{1,2}[月/\-\.]\s*\d{1,2}[日]?)',
        # MM月DD日 or MM/DD
        r'(\d{1,2}[月/\-\.]\s*\d{1,2}[日]?)',
        # YY/MM/DD
        r'(\d{2}/\d{1,2}/\d{1,2})',
        # YYYY-MM-DD
        r'(\d{4}-\d{1,2}-\d{1,2})'
    ]
    
    for pattern in date_patterns:
        match = re.search(pattern, text)
        if match:
            return match.group(1)
    
    # If no date found, look for lines with "日付" or "Date"
    for i, line in enumerate(lines):
        if '日付' in line or 'date' in line.lower():
            # Check if the next line might contain a date
            if i + 1 < len(lines):
                next_line = lines[i + 1]
                # Look for numbers and separators
                if re.search(r'\d+[\/\-年月日\.]', next_line):
                    return next_line.strip()
    
    return ""

def extract_store_name(lines):
    """
    Extract store name from receipt lines
    """
    # Common store name indicators
    store_indicators = ['店名', '店舗', 'ストア', 'マート', 'ショップ', 'STORE', 'SHOP']
    
    # First check for lines with store indicators
    for i, line in enumerate(lines):
        for indicator in store_indicators:
            if indicator in line:
                # Extract store name from this line or the next
                parts = re.split(r'[:：]|\s{2,}', line)
                if len(parts) > 1:
                    return parts[1].strip()
                elif i + 1 < len(lines):
                    return lines[i + 1].strip()
    
    # If no store name found with indicators, use the traditional approach
    for i in range(min(5, len(lines))):
        # Skip lines that are likely not store names
        if not re.search(r'合計|小計|税|円|日付|時間|レシート|領収書|¥|\d{1,2}/\d{1,2}|^\s*\d+\s*$', lines[i], re.I):
            return lines[i].strip()
    
    return ""

def extract_amount(text, lines):
    """
    Extract amount from receipt text
    """
    # Try multiple amount patterns in order of reliability
    amount_patterns = [
        # 合計 or 小計 followed by numbers
        (r'(合計|小計|総額|お買上げ|計).*?(\d[\d,]*)', 2),
        # Numbers followed by 円 or ¥
        (r'(\d[\d,]*)(?:\s*)(?:円|¥)', 1),
        # Just look for large numbers (likely to be totals)
        (r'(\d{3,}[\d,]*)', 1)
    ]
    
    for pattern, group in amount_patterns:
        match = re.search(pattern, text, re.I)
        if match:
            # Extract the amount from the specified capture group
            amount_str = match.group(group)
            return amount_str.replace(',', '')
    
    # If still no amount found, look for lines with "合計" or "Total"
    for line in lines:
        if '合計' in line or 'total' in line.lower():
            # Extract numbers from this line
            numbers = re.findall(r'\d[\d,]*', line)
            if numbers:
                # Use the largest number as it's likely the total
                largest = max([int(num.replace(',', '')) for num in numbers])
                return str(largest)
    
    return ""

def process_receipt_image(image_data):
    """
    Process receipt image and extract information
    """
    try:
        # Extract text from image
        text = extract_text_from_image(image_data)
        
        # Extract receipt information
        info = extract_receipt_info(text)
        
        return info
    except Exception as e:
        console.error(f"Error processing receipt: {str(e)}")
        return {
            "error": str(e),
            "fullText": ""
        }
