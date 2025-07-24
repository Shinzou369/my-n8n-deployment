let currentStep = 1;
const totalSteps = 4;

function changeStep(direction) {
    const newStep = currentStep + direction;
    
    if (newStep < 1 || newStep > totalSteps) return;
    
    // Validate current step before proceeding
    if (direction > 0 && !validateStep(currentStep)) {
        return;
    }
    
    // Hide current section
    document.querySelector(`[data-section="${currentStep}"]`).classList.remove('active');
    document.querySelector(`[data-step="${currentStep}"]`).classList.remove('active');
    if (currentStep < newStep) {
        document.querySelector(`[data-step="${currentStep}"]`).classList.add('completed');
    }
    
    // Show new section
    currentStep = newStep;
    document.querySelector(`[data-section="${currentStep}"]`).classList.add('active');
    document.querySelector(`[data-step="${currentStep}"]`).classList.add('active');
    
    // Update navigation buttons
    updateNavigation();
    
    // Show review content on step 4
    if (currentStep === 4) {
        showReviewContent();
    }
}

function updateNavigation() {
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const submitBtn = document.getElementById('submitBtn');
    
    prevBtn.style.display = currentStep > 1 ? 'block' : 'none';
    nextBtn.style.display = currentStep < totalSteps ? 'block' : 'none';
    submitBtn.style.display = currentStep === totalSteps ? 'block' : 'none';
}

function validateStep(step) {
    const errorMessage = document.getElementById('errorMessage');
    let isValid = true;
    let errorText = '';
    
    switch(step) {
        case 1:
            if (!document.getElementById('businessName').value.trim()) {
                errorText = 'Business name is required.';
                isValid = false;
            }
            break;
        case 2:
            if (!document.getElementById('contactEmail').value.trim()) {
                errorText = 'Contact email is required.';
                isValid = false;
            } else if (!document.getElementById('phoneNumber').value.trim()) {
                errorText = 'Phone number is required.';
                isValid = false;
            }
            break;
        case 3:
            // Optional validation for step 3
            break;
    }
    
    if (!isValid) {
        errorMessage.textContent = errorText;
        errorMessage.style.display = 'block';
        setTimeout(() => {
            errorMessage.style.display = 'none';
        }, 5000);
    } else {
        errorMessage.style.display = 'none';
    }
    
    return isValid;
}

function showReviewContent() {
    const reviewContent = document.getElementById('reviewContent');
    
    const formData = {
        businessName: document.getElementById('businessName').value,
        businessType: document.getElementById('businessType').value,
        businessAddress: document.getElementById('businessAddress').value,
        contactEmail: document.getElementById('contactEmail').value,
        phoneNumber: document.getElementById('phoneNumber').value,
        emergencyPhone: document.getElementById('emergencyPhone').value,
        websiteUrl: document.getElementById('websiteUrl').value,
        businessHours: document.getElementById('businessHours').value,
        appointmentUrl: document.getElementById('appointmentUrl').value,
        telegramBotToken: document.getElementById('telegramBotToken').value,
        telegramChatId: document.getElementById('telegramChatId').value
    };
    
    reviewContent.innerHTML = `
        <div style="background: #f8f9fa; padding: 20px; border-radius: 10px;">
            <h3>Business Information</h3>
            <p><strong>Name:</strong> ${formData.businessName}</p>
            <p><strong>Type:</strong> ${formData.businessType}</p>
            ${formData.businessAddress ? `<p><strong>Address:</strong> ${formData.businessAddress}</p>` : ''}
            
            <h3 style="margin-top: 20px;">Contact Information</h3>
            <p><strong>Email:</strong> ${formData.contactEmail}</p>
            <p><strong>Phone:</strong> ${formData.phoneNumber}</p>
            ${formData.emergencyPhone ? `<p><strong>Emergency Phone:</strong> ${formData.emergencyPhone}</p>` : ''}
            ${formData.websiteUrl ? `<p><strong>Website:</strong> ${formData.websiteUrl}</p>` : ''}
            
            <h3 style="margin-top: 20px;">Automation Settings</h3>
            <p><strong>Business Hours:</strong> ${formData.businessHours}</p>
            ${formData.appointmentUrl ? `<p><strong>Booking URL:</strong> ${formData.appointmentUrl}</p>` : ''}
            ${formData.telegramBotToken ? `<p><strong>Telegram Bot:</strong> Configured ✓</p>` : '<p><strong>Telegram Bot:</strong> Not configured</p>'}
            ${formData.telegramChatId ? `<p><strong>Telegram Channel:</strong> ${formData.telegramChatId}</p>` : ''}
        </div>
        <p style="margin-top: 20px; color: #666;">
            Click "Create My Workflow" to generate your personalized automation workflow. 
            This will create a custom N8N workflow configured specifically for your business.
        </p>
    `;
}

async function submitForm() {
    // Show loading
    document.querySelector('.form-container').style.display = 'none';
    document.querySelector('.loading').classList.add('active');
    
    const formData = {
        businessName: document.getElementById('businessName').value,
        businessType: document.getElementById('businessType').value,
        businessAddress: document.getElementById('businessAddress').value,
        contactEmail: document.getElementById('contactEmail').value,
        phoneNumber: document.getElementById('phoneNumber').value,
        emergencyPhone: document.getElementById('emergencyPhone').value,
        websiteUrl: document.getElementById('websiteUrl').value,
        businessHours: document.getElementById('businessHours').value,
        appointmentUrl: document.getElementById('appointmentUrl').value,
        telegramBotToken: document.getElementById('telegramBotToken').value,
        telegramChatId: document.getElementById('telegramChatId').value
    };
    
    try {
        const response = await fetch('/api/onboard', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        const result = await response.json();
        
        // Hide loading
        document.querySelector('.loading').classList.remove('active');
        
        if (result.success) {
            // Show success message
            document.getElementById('workflowName').textContent = result.workflowName;
            document.getElementById('n8nUrl').href = result.n8nUrl;
            document.getElementById('n8nUrl').textContent = result.n8nUrl;
            document.getElementById('createdTime').textContent = new Date().toLocaleString();
            
            document.querySelector('.success-message').classList.add('active');
        } else {
            // Show error
            document.querySelector('.form-container').style.display = 'block';
            const errorMessage = document.getElementById('errorMessage');
            errorMessage.textContent = 'Error: ' + (result.error || 'Failed to create workflow');
            errorMessage.style.display = 'block';
        }
        
    } catch (error) {
        console.error('Submission error:', error);
        
        // Hide loading and show error
        document.querySelector('.loading').classList.remove('active');
        document.querySelector('.form-container').style.display = 'block';
        
        const errorMessage = document.getElementById('errorMessage');
        errorMessage.textContent = 'Network error. Please try again.';
        errorMessage.style.display = 'block';
    }
}

// Initialize navigation
document.addEventListener('DOMContentLoaded', function() {
    updateNavigation();
});