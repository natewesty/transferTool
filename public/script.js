// Global variables
let products = [];
let currentItemId = 0;

// DOM elements
const transferForm = document.getElementById('transferForm');
const transferFrom = document.getElementById('transferFrom');
const transferTo = document.getElementById('transferTo');
const transferFromOther = document.getElementById('transferFromOther');
const transferToOther = document.getElementById('transferToOther');
const addItemBtn = document.getElementById('addItemBtn');
const itemsContainer = document.getElementById('itemsContainer');
const submitBtn = document.getElementById('submitBtn');
const successModal = document.getElementById('successModal');
const successMessage = document.getElementById('successMessage');
const closeModalBtn = document.getElementById('closeModalBtn');
const loadingSpinner = document.getElementById('loadingSpinner');

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

async function initializeApp() {
    try {
        // Load products from database
        await loadProducts();
        
        // Add event listeners
        setupEventListeners();
        
        // Add first item row
        addItemRow();
        
    } catch (error) {
        console.error('Error initializing app:', error);
        showError('Failed to initialize application. Please refresh the page.');
    }
}

function setupEventListeners() {
    // Location dropdown change handlers
    transferFrom.addEventListener('change', handleLocationChange);
    transferTo.addEventListener('change', handleLocationChange);
    
    // Form submission
    transferForm.addEventListener('submit', handleFormSubmit);
    
    // Add event listener for notes character counter
    const transferNotes = document.getElementById('transferNotes');
    const charCount = document.getElementById('charCount');
    if (transferNotes && charCount) {
        transferNotes.addEventListener('input', function() {
            charCount.textContent = this.value.length;
        });
    }
    
    // Add item button
    addItemBtn.addEventListener('click', addItemRow);
    
    // Modal close button
    closeModalBtn.addEventListener('click', closeSuccessModal);
    
    // Close modal when clicking outside
    successModal.addEventListener('click', function(e) {
        if (e.target === successModal) {
            closeSuccessModal();
        }
    });
}

function handleLocationChange(e) {
    const select = e.target;
    const otherInput = select.id === 'transferFrom' ? transferFromOther : transferToOther;
    
    if (select.value === 'Other') {
        otherInput.style.display = 'block';
        otherInput.required = true;
    } else {
        otherInput.style.display = 'none';
        otherInput.required = false;
        otherInput.value = '';
    }
}

async function loadProducts() {
    try {
        const response = await fetch('/api/products');
        if (!response.ok) {
            throw new Error('Failed to fetch products');
        }
        products = await response.json();
        console.log('Products loaded:', products.length);
    } catch (error) {
        console.error('Error loading products:', error);
        throw error;
    }
}

function addItemRow() {
    currentItemId++;
    const itemRow = document.createElement('div');
    itemRow.className = 'item-row';
    itemRow.id = `item-${currentItemId}`;
    
    itemRow.innerHTML = `
        <div class="product-search" data-label="Product">
            <input type="text" 
                   class="product-input" 
                   placeholder="Search for product..." 
                   data-item-id="${currentItemId}"
                   autocomplete="off">
            <div class="search-results" style="display: none;"></div>
        </div>
        <div data-label="SKU">
            <input type="text" 
                   class="sku-input" 
                   placeholder="SKU" 
                   readonly
                   data-item-id="${currentItemId}">
        </div>
        <div data-label="Amount - Bottles">
            <input type="number" 
                   class="amount-input bottles-input" 
                   placeholder="0" 
                   min="0" 
                   data-item-id="${currentItemId}"
                   data-type="bottles">
        </div>
        <div data-label="Amount - 9L Cases">
            <input type="number" 
                   class="amount-input cases-input" 
                   placeholder="0"
                   min="0" 
                   data-item-id="${currentItemId}"
                   data-type="cases">
        </div>
        <div data-label="Actions">
            <button type="button" 
                    class="btn btn-danger remove-item-btn" 
                    data-item-id="${currentItemId}">
                Remove
            </button>
        </div>
    `;
    
    itemsContainer.appendChild(itemRow);
    
    // Add event listeners for the new row
    setupItemRowEventListeners(currentItemId);
}

function setupItemRowEventListeners(itemId) {
    const productInput = document.querySelector(`[data-item-id="${itemId}"].product-input`);
    const bottlesInput = document.querySelector(`[data-item-id="${itemId}"][data-type="bottles"]`);
    const casesInput = document.querySelector(`[data-item-id="${itemId}"][data-type="cases"]`);
    const removeBtn = document.querySelector(`[data-item-id="${itemId}"].remove-item-btn`);
    const searchResults = productInput.parentElement.querySelector('.search-results');
    
    // Product search functionality
    let searchTimeout;
    productInput.addEventListener('input', function() {
        clearTimeout(searchTimeout);
        const query = this.value.trim();
        
        if (query.length < 2) {
            searchResults.style.display = 'none';
            return;
        }
        
        // Clear SKU when product input is cleared
        if (query === '') {
            const skuInput = document.querySelector(`input[data-item-id="${itemId}"].sku-input`);
            if (skuInput) {
                skuInput.value = '';
            }
            
            // Reset field states when product is cleared
            const bottlesInput = document.querySelector(`[data-item-id="${itemId}"][data-type="bottles"]`);
            const casesInput = document.querySelector(`[data-item-id="${itemId}"][data-type="cases"]`);
            if (bottlesInput && casesInput) {
                bottlesInput.disabled = false;
                casesInput.disabled = false;
                bottlesInput.style.backgroundColor = 'white';
                casesInput.style.backgroundColor = 'white';
                bottlesInput.style.cursor = 'text';
                casesInput.style.cursor = 'text';
                // Clear both fields when no product is selected
                bottlesInput.value = '';
                casesInput.value = '';
            }
        }
        
        searchTimeout = setTimeout(() => {
            searchProducts(query, itemId);
        }, 300);
    });
    
    // Product selection
    productInput.addEventListener('focus', function() {
        if (this.value.trim().length >= 2) {
            searchProducts(this.value.trim(), itemId);
        }
    });
    
    // Hide search results when clicking outside
    document.addEventListener('click', function(e) {
        if (!productInput.contains(e.target) && !searchResults.contains(e.target)) {
            searchResults.style.display = 'none';
        }
    });
    
    // Amount input handling - no real-time conversion
    bottlesInput.addEventListener('input', function() {
        // Just validate the input, no conversion
        if (this.value && this.value < 0) {
            this.value = 0;
        }
    });
    
    casesInput.addEventListener('input', function() {
        // Just validate the input, no conversion
        if (this.value && this.value < 0) {
            this.value = 0;
        }
    });
    
    // Manage field states based on volume
    function updateFieldStates() {
        const volume = getProductVolume(itemId);
        if (volume === 750 || volume === 1500) {
            // Enable both fields for standard volumes
            bottlesInput.disabled = false;
            casesInput.disabled = false;
            bottlesInput.style.backgroundColor = 'white';
            casesInput.style.backgroundColor = 'white';
            bottlesInput.style.cursor = 'text';
            casesInput.style.cursor = 'text';
        } else if (volume) {
            // For non-standard volumes, allow both fields but show warning
            bottlesInput.disabled = false;
            casesInput.disabled = false;
            bottlesInput.style.backgroundColor = 'white';
            casesInput.style.backgroundColor = 'white';
            bottlesInput.style.cursor = 'text';
            casesInput.style.cursor = 'text';
            // Don't set cases to "-" - let user enter what they want
        } else {
            // No volume selected, enable both fields
            bottlesInput.disabled = false;
            casesInput.disabled = false;
            bottlesInput.style.backgroundColor = 'white';
            casesInput.style.backgroundColor = 'white';
            bottlesInput.style.cursor = 'text';
            casesInput.style.cursor = 'text';
            // Don't set cases to "-" - let user enter what they want
        }
    }
    
    // Initial field state setup
    updateFieldStates();
    
    // Remove item button
    removeBtn.addEventListener('click', function() {
        if (itemsContainer.children.length > 1) {
            // Find the parent item row and remove it
            const rowToRemove = this.closest('.item-row');
            if (rowToRemove) {
                rowToRemove.remove();
            }
        } else {
            showError('At least one item is required.');
        }
    });
}

async function searchProducts(query, itemId) {
    try {
        console.log('Searching for:', query, 'itemId:', itemId);
        const response = await fetch(`/api/products/search?q=${encodeURIComponent(query)}`);
        if (!response.ok) {
            throw new Error('Search failed');
        }
        
        const results = await response.json();
        console.log('Search results:', results);
        displaySearchResults(results, itemId);
        
    } catch (error) {
        console.error('Search error:', error);
    }
}

function displaySearchResults(results, itemId) {
    console.log('Displaying search results for itemId:', itemId, 'results:', results);
    
    const productInput = document.querySelector(`input[data-item-id="${itemId}"].product-input`);
    if (!productInput) {
        console.error('Product input not found for itemId:', itemId);
        return;
    }
    console.log('Found product input:', productInput);
    
    const searchResults = productInput.parentElement.querySelector('.search-results');
    if (!searchResults) {
        console.error('Search results container not found for itemId:', itemId);
        return;
    }
    console.log('Found search results container:', searchResults);
    
    if (results.length === 0) {
        searchResults.innerHTML = '<div class="search-result-item">No products found</div>';
        searchResults.style.display = 'block';
        return;
    }
    
    searchResults.innerHTML = results.map(product => `
        <div class="search-result-item" 
             data-product-id="${product.product_variant_id}"
             data-product-title="${product.product_title}"
             data-variant-title="${product.variant_title || ''}"
             data-volume="${product.volume_ml}"
             data-sku="${product.sku}">
            <strong>${product.product_title}</strong>
            ${product.variant_title ? ` - ${product.variant_title}` : ''}
            <br><small>SKU: ${product.sku} | Volume: ${product.volume_ml}ml</small>
        </div>
    `).join('');
    
    searchResults.style.display = 'block';
    console.log('Search results displayed, count:', searchResults.children.length);
    
    // Add click handlers for search results
    searchResults.querySelectorAll('.search-result-item').forEach(item => {
        item.addEventListener('click', function() {
            selectProduct(this, itemId);
        });
    });
}

function selectProduct(resultElement, itemId) {
    const productInput = document.querySelector(`input[data-item-id="${itemId}"].product-input`);
    if (!productInput) {
        console.error('Product input not found for itemId:', itemId);
        return;
    }
    
    const searchResults = productInput.parentElement.querySelector('.search-results');
    if (!searchResults) {
        console.error('Search results container not found for itemId:', itemId);
        return;
    }
    
    // Set the product input value
    const productTitle = resultElement.dataset.productTitle;
    const variantTitle = resultElement.dataset.variantTitle;
    const displayTitle = variantTitle ? `${productTitle} - ${variantTitle}` : productTitle;
    
    productInput.value = displayTitle;
    productInput.dataset.productId = resultElement.dataset.productId;
    productInput.dataset.volume = resultElement.dataset.volume;
    productInput.dataset.sku = resultElement.dataset.sku;
    
    // Populate the SKU field
    const skuInput = document.querySelector(`input[data-item-id="${itemId}"].sku-input`);
    if (skuInput) {
        skuInput.value = resultElement.dataset.sku || '';
    }
    
    // Update field states based on the selected product's volume
    const bottlesInput = document.querySelector(`[data-item-id="${itemId}"][data-type="bottles"]`);
    const casesInput = document.querySelector(`[data-item-id="${itemId}"][data-type="cases"]`);
    if (bottlesInput && casesInput) {
        const volume = parseInt(resultElement.dataset.volume);
        if (volume === 750 || volume === 1500) {
            // Enable both fields for standard volumes
            bottlesInput.disabled = false;
            casesInput.disabled = false;
            bottlesInput.style.backgroundColor = 'white';
            casesInput.style.backgroundColor = 'white';
            bottlesInput.style.cursor = 'text';
            casesInput.style.cursor = 'text';
        } else if (volume) {
            // Disable cases field for non-standard volumes
            bottlesInput.disabled = false;
            casesInput.disabled = true;
            bottlesInput.style.backgroundColor = 'white';
            casesInput.style.backgroundColor = '#f8f9fa';
            casesInput.style.cursor = 'not-allowed';
            // Clear cases field when volume doesn't support it
            casesInput.value = '';
        }
    }
    
    // Hide search results
    searchResults.style.display = 'none';
}

function getProductVolume(itemId) {
    const productInput = document.querySelector(`input[data-item-id="${itemId}"].product-input`);
    if (!productInput) {
        console.error('Product input not found for itemId:', itemId);
        return null;
    }
    return productInput.dataset.volume ? parseInt(productInput.dataset.volume) : null;
}

function calculateCases(bottles, volumeMl) {
    // 1 9L case = 12 750ml bottles or 6 1.5L bottles
    if (volumeMl === 750) {
        return bottles / 12;
    } else if (volumeMl === 1500) {
        return bottles / 6;
    } else {
        // For other volumes, calculate based on 9L (9000ml)
        return (bottles * volumeMl) / 9000;
    }
}

function calculateBottles(cases, volumeMl) {
    // 1 9L case = 12 750ml bottles or 6 1.5L bottles
    if (volumeMl === 750) {
        return cases * 12;
    } else if (volumeMl === 1500) {
        return cases * 6;
    } else {
        // For other volumes, calculate based on 9L (9000ml)
        return (cases * 9000) / volumeMl;
    }
}

async function handleFormSubmit(e) {
    e.preventDefault();
    
    if (!validateForm()) {
        return;
    }
    
    try {
        showLoading(true);
        
        const formData = collectFormData();
        const response = await submitTransfer(formData);
        
        if (response.success) {
            showSuccessModal(response.message, response.transferDoc);
            resetForm();
        } else {
            showError(response.error || 'Transfer submission failed');
        }
        
    } catch (error) {
        console.error('Form submission error:', error);
        showError('Failed to submit transfer request. Please try again.');
    } finally {
        showLoading(false);
    }
}

function validateForm() {
    // Validate locations
    const fromLocation = transferFrom.value === 'Other' ? transferFromOther.value : transferFrom.value;
    const toLocation = transferTo.value === 'Other' ? transferToOther.value : transferTo.value;
    
    if (!fromLocation || !toLocation) {
        showError('Please select both transfer locations.');
        return false;
    }
    
    if (fromLocation === toLocation) {
        showError('Transfer locations must be different.');
        return false;
    }
    
    // Validate items
    const itemRows = itemsContainer.querySelectorAll('.item-row');
    let hasValidItems = false;
    
    itemRows.forEach(row => {
        const productInput = row.querySelector('.product-input');
        const bottlesInput = row.querySelector('.bottles-input');
        const casesInput = row.querySelector('.cases-input');
        
        if (productInput.value && (bottlesInput.value || casesInput.value)) {
            hasValidItems = true;
        }
    });
    
    if (!hasValidItems) {
        showError('Please add at least one item with a product and amount.');
        return false;
    }
    
    return true;
}

function collectFormData() {
    const fromLocation = transferFrom.value === 'Other' ? transferFromOther.value : transferFrom.value;
    const toLocation = transferTo.value === 'Other' ? transferToOther.value : transferTo.value;
    
    const items = [];
    const itemRows = itemsContainer.querySelectorAll('.item-row');
    
    itemRows.forEach(row => {
        const productInput = row.querySelector('.product-input');
        const bottlesInput = row.querySelector('.bottles-input');
        const casesInput = row.querySelector('.cases-input');
        
        if (productInput.value && (bottlesInput.value || casesInput.value)) {
            items.push({
                product: productInput.value,
                productId: productInput.dataset.productId,
                sku: productInput.dataset.sku,
                volume: productInput.dataset.volume,
                bottles: parseInt(bottlesInput.value) || 0,
                cases: parseFloat(casesInput.value) || 0
            });
        }
    });
    
    // Get notes value
    const transferNotes = document.getElementById('transferNotes');
    const notes = transferNotes ? transferNotes.value.trim() : '';
    
    return {
        transferFrom: fromLocation,
        transferTo: toLocation,
        items: items,
        notes: notes
    };
}

async function submitTransfer(formData) {
    const response = await fetch('/api/transfer', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
    });
    
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Transfer submission failed');
    }
    
    return await response.json();
}

function showSuccessModal(message, transferDoc) {
    successMessage.textContent = message;
    successModal.style.display = 'flex';
}

function closeSuccessModal() {
    successModal.style.display = 'none';
}

function resetForm() {
    // Reset location fields
    transferFrom.value = '';
    transferTo.value = '';
    transferFromOther.style.display = 'none';
    transferToOther.style.display = 'none';
    transferFromOther.value = '';
    transferToOther.value = '';
    
    // Clear items
    itemsContainer.innerHTML = '';
    
    // Clear notes
    const transferNotes = document.getElementById('transferNotes');
    if (transferNotes) {
        transferNotes.value = '';
        const charCount = document.getElementById('charCount');
        if (charCount) {
            charCount.textContent = '0';
        }
    }
    
    // Add one empty item row
    addItemRow();
}

function showLoading(show) {
    loadingSpinner.style.display = show ? 'flex' : 'none';
}

function showError(message) {
    // Simple error display - you could enhance this with a toast notification
    alert(message);
}
