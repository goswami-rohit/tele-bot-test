// src/conversationFlowB.ts
import { AIService } from './bot/aiService';

export interface ConversationContextB {
  chatId: string;
  userType: 'telegram' | 'web';
  sessionId: string;
  step: string;
  data: any;
  //sendMessage: (chatId: string | number, message: string, options?: any) => Promise<void>;
}

export interface ConversationResponse {
  message: string;
  nextStep: string;
  data: any;
  action?: string; // Optional action to be performed after the step
  inlineKeyboard?: any[][]; // Optional inline keyboard for Telegram
}

const aiService = new AIService(process.env.OPENROUTER_API_KEY || '');

class ConversationFlowB {
  async processMessage(context: ConversationContextB, message: string): Promise<ConversationResponse> {
    let { step, data } = context;

    // Normalize incoming message for robust comparison (e.g., for main menu selection)
    const lowerCaseMessage = message.toLowerCase().trim();

    // Initial entry point for new conversations, /start command, or returning to main menu
    // Added 'start' to the conditions so it matches how telegram.ts initializes new sessions.
    if (step === 'start' || step === '/start' || step === 'completed' || lowerCaseMessage === '/start') {
      return {
        message: `Hello! How can I help you today? Please choose an option:

1. I want to inquire about materials (Buyer)
2. I am a vendor and want to register/update my profile
3. I want to record sales data (Sales Rep)`,
        nextStep: 'main_menu_selection',
        data: data // Preserve data if re-starting from /start or completed
      };
    }

    // Handle main menu selection
    if (step === 'main_menu_selection') {
      if (message === '1') {
        // Transition to buyer flow (AI-driven or structured)
        return {
          message: "Alright, let's start a new inquiry. What material are you looking for? (e.g., cement, TMT, both)",
          nextStep: 'material_selection', // This should be the first step of buyer inquiry flow
          data: { ...data, userType: 'buyer' }
        };
      } else if (message === '2') {
        // Transition to vendor registration flow (AI-driven or structured)
        return {
          message: "Great! Let's get you registered as a vendor. What's your company name?",
          nextStep: 'vendor_company_name', // This should be the first step of vendor registration flow
          data: { ...data, userType: 'vendor' }
        };
      } else if (message === '3') {
        // Transition to sales record flow (Option 3)
        return {
          message: `📊 **Sales Record Entry**

What type of item did you sell?

1. Cement
2. TMT
3. Both`,
          nextStep: 'sales_item_type', // Entry point for sales flow
          data: { ...data, userType: 'sales_rep' } // Set userType for context
        };
      } else {
        // Fallback for invalid main menu selection
        return {
          message: 'Please choose a valid option (1, 2, or 3).',
          nextStep: 'main_menu_selection',
          data: data
        };
      }
    }

     // --- AI-DRIVEN FLOW SEGMENT (for Buyer/Vendor inquiries) ---
    // This section can use AI to extract information and guide the conversation
    // for buyer and vendor inquiry flows, but should generally be skipped if
    // a user is in a structured sales_record step.
    const aiExtractionResult = await aiService.extractInformation(message, step);

    // Only apply AI extraction if not in a sales record specific step,
    // or if it's an initial buyer/vendor inquiry step.
    const isSalesStep = step.startsWith('sales_') || step.startsWith('cement_') || step.startsWith('tmt_') ||
                         step.startsWith('project_') || step.startsWith('manual_') || step.startsWith('completion_');

    if (aiExtractionResult.extracted && !isSalesStep) {
      // Corrected: Check data.userType for the user's role
      if (data.userType === 'buyer') {
        if (aiExtractionResult.suggestedStep === 'confirm_inquiry') {
          // AI thinks it has enough for an inquiry
          return {
            message: `I understand you need ${aiExtractionResult.data.material} in ${aiExtractionResult.data.city}. Is that correct? (Yes/No)`,
            nextStep: 'confirm_inquiry',
            data: { ...data, ...aiExtractionResult.data }
          };
        } else if (aiExtractionResult.suggestedStep === 'get_city' && !data.city) {
          // AI needs city
          return {
            message: "Which city are you looking for materials in?",
            nextStep: 'city_input',
            data: { ...data, ...aiExtractionResult.data }
          };
        } else if (aiExtractionResult.suggestedStep === 'get_quantity' && data.material && !data.quantity) {
          // AI needs quantity
          return {
            message: `How much ${data.material} do you need? (e.g., 500 bags, 10 tons)`,
            nextStep: 'quantity_input',
            data: { ...data, ...aiExtractionResult.data }
          };
        }
        // ... add more AI-driven steps for the buyer flow as needed
      } else if (data.userType === 'vendor') { // Corrected: Check data.userType for the user's role
        if (aiExtractionResult.suggestedStep === 'vendor_confirm') {
          // AI thinks it has enough for vendor registration
          return {
            message: `You are registering as a vendor. Is your company name ${aiExtractionResult.data.vendorName} and you supply ${aiExtractionResult.data.materials?.join(' and ')} in ${aiExtractionResult.data.city}? (Yes/No)`,
            nextStep: 'confirm_vendor_registration',
            data: { ...data, ...aiExtractionResult.data }
          };
        }
        // ... add more AI-driven steps for the vendor flow as needed
      }
    }
    // --- END AI-DRIVEN FLOW SEGMENT ---


    // ========== SALES RECORDS FLOW (Option 3) ==========
    // This section is a structured, rule-based flow for sales representatives.
    // It takes precedence once 'sales_item_type' step is initiated.

    // Handle sales item type selection
    if (step === 'sales_item_type') {
      if (message === '1') {
        return {
          message: `🏗️ **Cement Sales Record**

First, select the cement company:

1. Ambuja
2. ACC
3. Ultratech
4. MAX
5. DALMIA
6. Topcem
7. Black Tiger
8. Others`,
          nextStep: 'cement_company_select',
          data: { ...data, salesType: 'cement' }
        };
      } else if (message === '2') {
        return {
          message: `🔧 **TMT Sales Record**

First, select the TMT company:

1. Tata Tiscon
2. JSW
3. Shyam Steel
4. Xtech
5. Others`,
          nextStep: 'tmt_company_select',
          data: { ...data, salesType: 'tmt' }
        };
      } else if (message === '3') {
        return {
          message: `🏗️🔧 **Both Cement & TMT Sales Record**

Let's start with cement company:

1. Ambuja
2. ACC
3. Ultratech
4. MAX
5. DALMIA
6. Topcem
7. Black Tiger
8. Others`,
          nextStep: 'cement_company_select',
          data: { ...data, salesType: 'both', currentItem: 'cement' }
        };
      } else {
        return {
          message: 'Please select a valid option:\n\n1. Cement\n2. TMT\n3. Both',
          nextStep: 'sales_item_type',
          data: data
        };
      }
    }

    // Handle cement company selection
    if (step === 'cement_company_select') {
      const cementCompanies = ['Ambuja', 'ACC', 'Ultratech', 'MAX', 'DALMIA', 'Topcem', 'Black Tiger'];
      let selectedCompany = '';

      if (['1', '2', '3', '4', '5', '6', '7'].includes(message)) {
        selectedCompany = cementCompanies[parseInt(message) - 1];

        return {
          message: `✅ Company: ${selectedCompany} selected

Enter the quantity sold:

Qty Sold (${selectedCompany} Cement): ____

Enter the quantity in bags (e.g., 100, 500, 1000)`,
          nextStep: 'cement_qty_input',
          data: { ...data, cementCompany: selectedCompany }
        };
      } else if (message === '8') {
        return {
          message: `📝 **Enter Custom Company**

Please enter the cement company name:

Company Name: ____`,
          nextStep: 'cement_company_custom',
          data: data
        };
      } else {
        return {
          message: 'Please select a valid option (1-8):\n\n1. Ambuja\n2. ACC\n3. Ultratech\n4. MAX\n5. DALMIA\n6. Topcem\n7. Black Tiger\n8. Others',
          nextStep: 'cement_company_select',
          data: data
        };
      }
    }

    // Handle custom cement company input
    if (step === 'cement_company_custom') {
      if (!message || message.trim().length < 2) {
        return {
          message: 'Please enter a valid company name (minimum 2 characters)',
          nextStep: 'cement_company_custom',
          data: data
        };
      }

      return {
        message: `✅ Company: ${message} selected

Enter the quantity sold:

Qty Sold (${message} Cement): ____

Enter the quantity in bags (e.g., 100, 500, 1000)`,
        nextStep: 'cement_qty_input',
        data: { ...data, cementCompany: message }
      };
    }

    // Handle cement quantity input
    if (step === 'cement_qty_input') {
      const qty = parseInt(message);
      if (isNaN(qty) || qty <= 0) {
        return {
          message: 'Please enter a valid quantity number (e.g., 100, 500, 1000)',
          nextStep: 'cement_qty_input',
          data: data
        };
      }

      return {
        message: `✅ Quantity: ${qty} bags recorded

Enter the price per bag:

Price per bag (₹): ____

Enter the price in rupees (e.g., 350, 400, 450)`,
        nextStep: 'cement_price_input',
        data: { ...data, cementQty: qty }
      };
    }

    // Handle cement price input
    if (step === 'cement_price_input') {
      const price = parseFloat(message);
      if (isNaN(price) || price <= 0) {
        return {
          message: 'Please enter a valid price number (e.g., 350, 400, 450)',
          nextStep: 'cement_price_input',
          data: data
        };
      }

      const salesData = { ...data, cementPrice: price };

      // If both selected, move to TMT company selection
      if (data.salesType === 'both') {
        return {
          message: `✅ Cement price: ₹${price} per bag recorded

Now let's record TMT details:

Select the TMT company:

1. Tata Tiscon
2. JSW
3. Shyam Steel
4. Xtech
5. Others`,
          nextStep: 'tmt_company_select',
          data: { ...salesData, currentItem: 'tmt' }
        };
      } else {
        // Single cement sale, go to project owner
        return {
          message: `✅ Cement price: ₹${price} per bag recorded

Now enter the project owner name:

Project Owner Name: ____

Enter the full name of the project owner/client`,
          nextStep: 'project_owner_input',
          data: salesData
        };
      }
    }

    // Handle TMT company selection
    if (step === 'tmt_company_select') {
      const tmtCompanies = ['Tata Tiscon', 'JSW', 'Shyam Steel', 'Xtech'];
      let selectedCompany = '';

      if (['1', '2', '3', '4'].includes(message)) {
        selectedCompany = tmtCompanies[parseInt(message) - 1];

        return {
          message: `✅ Company: ${selectedCompany} selected

Select the TMT sizes sold (multiple selections allowed):

1. 5.5mm    2. 6mm     3. 8mm     4. 10mm
5. 12mm     6. 16mm    7. 18mm    8. 20mm
9. 24mm     10. 26mm   11. 28mm   12. 32mm
13. 36mm    14. 40mm

Enter the numbers separated by commas (e.g., 1,4,5,8 for 5.5mm, 10mm, 12mm, 20mm)`,
          nextStep: 'tmt_sizes_select',
          data: { ...data, tmtCompany: selectedCompany }
        };
      } else if (message === '5') {
        return {
          message: `📝 **Enter Custom TMT Company**

Please enter the TMT company name:

Company Name: ____`,
          nextStep: 'tmt_company_custom',
          data: data
        };
      } else {
        return {
          message: 'Please select a valid option (1-5):\n\n1. Tata Tiscon\n2. JSW\n3. Shyam Steel\n4. Xtech\n5. Others',
          nextStep: 'tmt_company_select',
          data: data
        };
      }
    }

    // Handle custom TMT company input
    if (step === 'tmt_company_custom') {
      if (!message || message.trim().length < 2) {
        return {
          message: 'Please enter a valid company name (minimum 2 characters)',
          nextStep: 'tmt_company_custom',
          data: data
        };
      }

      return {
        message: `✅ Company: ${message} selected

Select the TMT sizes sold (multiple selections allowed):

1. 5.5mm    2. 6mm     3. 8mm     4. 10mm
5. 12mm     6. 16mm    7. 18mm    8. 20mm
9. 24mm     10. 26mm   11. 28mm   12. 32mm
13. 36mm    14. 40mm

Enter the numbers separated by commas (e.g., 1,4,5,8 for 5.5mm, 10mm, 12mm, 20mm)`,
        nextStep: 'tmt_sizes_select',
        data: { ...data, tmtCompany: message }
      };
    }

    // Handle TMT sizes selection
    if (step === 'tmt_sizes_select') {
      const TMT_SIZES = ['5.5mm', '6mm', '8mm', '10mm', '12mm', '16mm', '18mm', '20mm', '24mm', '26mm', '28mm', '32mm', '36mm', '40mm'];

      const selections = message.split(',').map(s => s.trim());
      const validSelections = selections.filter(s => {
        const num = parseInt(s);
        return !isNaN(num) && num >= 1 && num <= 14;
      });

      if (validSelections.length === 0) {
        return {
          message: 'Please enter valid size numbers separated by commas (e.g., 1,4,5,8)\n\nAvailable sizes: 1-14',
          nextStep: 'tmt_sizes_select',
          data: data
        };
      }

      const selectedSizes = validSelections.map(s => TMT_SIZES[parseInt(s) - 1]);
      const firstSize = selectedSizes[0];

      return {
        message: `✅ Selected sizes: ${selectedSizes.join(', ')}

Now enter the quantity for each size:

Quantity for ${firstSize} (in kg): ____

Enter the quantity in kg (e.g., 100, 500, 1000)`,
        nextStep: 'tmt_qty_input',
        data: {
          ...data,
          tmtSizes: selectedSizes,
          currentQtyIndex: 0,
          tmtQuantities: {}
        }
      };
    }

    // Handle TMT quantity input
    if (step === 'tmt_qty_input') {
      const qty = parseInt(message);
      if (isNaN(qty) || qty <= 0) {
        const currentSize = data.tmtSizes[data.currentQtyIndex];
        return {
          message: `Please enter a valid quantity for ${currentSize} (e.g., 100, 500, 1000)`,
          nextStep: 'tmt_qty_input',
          data: data
        };
      }

      const currentSize = data.tmtSizes[data.currentQtyIndex];
      const updatedQuantities = { ...data.tmtQuantities, [currentSize]: qty };
      const nextIndex = data.currentQtyIndex + 1;

      // Check if more sizes need quantities
      if (nextIndex < data.tmtSizes.length) {
        const nextSize = data.tmtSizes[nextIndex];
        return {
          message: `✅ Quantity for ${currentSize}: ${qty} kg recorded

Quantity for ${nextSize} (in kg): ____

Enter the quantity in kg (e.g., 100, 500, 1000)`,
          nextStep: 'tmt_qty_input',
          data: {
            ...data,
            tmtQuantities: updatedQuantities,
            currentQtyIndex: nextIndex
          }
        };
      } else {
        // All quantities collected, now ask for prices
        const firstSize = data.tmtSizes[0];
        return {
          message: `✅ All quantities recorded

Now enter the price for each size:

Price for ${firstSize} (₹ per kg): ____

Enter the price in rupees (e.g., 65, 70, 75)`,
          nextStep: 'tmt_price_input',
          data: {
            ...data,
            tmtQuantities: updatedQuantities,
            currentPriceIndex: 0,
            tmtPrices: {}
          }
        };
      }
    }

    // Handle TMT price input
    if (step === 'tmt_price_input') {
      const price = parseFloat(message);
      if (isNaN(price) || price <= 0) {
        const currentSize = data.tmtSizes[data.currentPriceIndex];
        return {
          message: `Please enter a valid price number for ${currentSize} (e.g., 65, 70, 75)`,
          nextStep: 'tmt_price_input',
          data: data
        };
      }

      const currentSize = data.tmtSizes[data.currentPriceIndex];
      const updatedPrices = { ...data.tmtPrices, [currentSize]: price };
      const nextIndex = data.currentPriceIndex + 1;

      // Check if more sizes to price
      if (nextIndex < data.tmtSizes.length) {
        const nextSize = data.tmtSizes[nextIndex];
        return {
          message: `✅ Price for ${currentSize}: ₹${price} per kg recorded

Price for ${nextSize} (₹ per kg): ____

Enter the price in rupees (e.g., 65, 70, 75)`,
          nextStep: 'tmt_price_input',
          data: {
            ...data,
            tmtPrices: updatedPrices,
            currentPriceIndex: nextIndex
          }
        };
      } else {
        // All prices collected, move to project owner
        const finalData = {
          ...data,
          tmtPrices: updatedPrices
        };
        delete finalData.currentPriceIndex; // Clean up temp data

        return {
          message: `✅ All TMT prices recorded

Now enter the project owner name:

Project Owner Name: ____

Enter the full name of the project owner/client`,
          nextStep: 'project_owner_input',
          data: finalData
        };
      }
    }

    // Handle project owner input
    if (step === 'project_owner_input') {
      if (!message || message.trim().length < 2) {
        return {
          message: 'Please enter a valid project owner name (minimum 2 characters)',
          nextStep: 'project_owner_input',
          data: data
        };
      }
      return {
        message: `📝 **Manual Project Entry**

Enter the project name and/or location:

Project Name/Location: ____

Example: "XYZ Apartments, Guwahati" or "ABC Complex, Ganeshguri"`,
        nextStep: 'manual_project_input',
        data: { ...data, projectOwner: message }
      };
    }

    // Handle manual project input
    if (step === 'manual_project_input') {
      if (!message || message.trim().length < 2) {
        return {
          message: 'Please enter a valid project name/location (minimum 2 characters)',
          nextStep: 'manual_project_input',
          data: data
        };
      }

      return {
        message: `✅ Project: ${message} recorded

Enter estimated time of completion:

Estimated Time of Completion: ____ years

Enter in years (e.g., 1, 2, 3, 5)`,
        nextStep: 'completion_time_input',
        data: { ...data, projectName: message }
      };
    }

    // Handle completion time input
    if (step === 'completion_time_input') {
      const years = parseInt(message);
      if (isNaN(years) || years <= 0) {
        return {
          message: 'Please enter a valid number of years (e.g., 1, 2, 3, 5)',
          nextStep: 'completion_time_input',
          data: data
        };
      }

      return {
        message: `✅ Completion time: ${years} years recorded

Enter your contact number:

Contact Number of Sales Rep: ____

Enter your 10-digit mobile number`,
        nextStep: 'sales_contact_input',
        data: { ...data, completionTime: years }
      };
    }

    // Handle sales contact input and finalize sales record
    if (step === 'sales_contact_input') {
      const phone = message.replace(/\s+/g, '');
      if (!/^\d{10}$/.test(phone)) {
        return {
          message: 'Please enter a valid 10-digit mobile number',
          nextStep: 'sales_contact_input',
          data: data
        };
      }

      let summaryMessage = `✅ **Sales Record Complete!**

Thank you for providing your sales information. Your record has been successfully saved.

📊 **Summary:**
`;

      if (data.salesType === 'cement') {
        summaryMessage += `🏗️ Cement: ${data.cementQty} bags @ ₹${data.cementPrice}/bag`;
      } else if (data.salesType === 'tmt') {
        summaryMessage += `🔧 TMT: ${Object.entries(data.tmtQuantities).map(([size, qty]) => `${size}: ${qty}kg @ ₹${data.tmtPrices[size]}/kg`).join(', ')}`;
      } else if (data.salesType === 'both') {
        summaryMessage += `🏗️ Cement: ${data.cementQty} bags @ ₹${data.cementPrice}/bag\n🔧 TMT: ${Object.entries(data.tmtQuantities).map(([size, qty]) => `${size}: ${qty}kg @ ₹${data.tmtPrices[size]}/kg`).join(', ')}`;
      }

      summaryMessage += `
👤 Owner: ${data.projectOwner}
🏗️ Project: ${data.projectName}
⏱️ Completion: ${data.completionTime} years
📱 Contact: ${phone}

Type /start to record another sale.`;

      return {
        message: summaryMessage,
        nextStep: 'completed', // Mark conversation as completed
        action: 'create_sales_record', // Trigger action to save to storage
        data: { ...data, contactNumber: phone }
      };
    }

    // ========== END SALES RECORDS FLOW ==========


    // --- FALLBACK / DEFAULT RESPONSES (for steps not handled above) ---
    // This section should handle any other ongoing conversation flows (buyer/vendor)
    // or provide a generic response if the input doesn't match any known step.

    // Example for buyer flow (place other existing flows here)
    if (step === 'material_selection') {
      const lowerCaseMessage = message.toLowerCase();
      if (lowerCaseMessage.includes('cement') && lowerCaseMessage.includes('tmt')) {
        return {
          message: `Great! So you're looking for both Cement and TMT.
Which city are you looking for materials in?`,
          nextStep: 'city_input',
          data: { ...data, material: 'both' }
        };
      } else if (lowerCaseMessage.includes('cement')) {
        return {
          message: `Okay, Cement. Which city are you looking for cement in?`,
          nextStep: 'city_input',
          data: { ...data, material: 'cement' }
        };
      } else if (lowerCaseMessage.includes('tmt')) {
        return {
          message: `Understood, TMT. Which city are you looking for TMT in?`,
          nextStep: 'city_input',
          data: { ...data, material: 'tmt' }
        };
      } else {
        return {
          message: 'Please specify if you are looking for Cement, TMT, or Both.',
          nextStep: 'material_selection',
          data: data
        };
      }
    }

    if (step === 'city_input') {
      // Basic validation for city input
      if (message.trim().length < 2) {
        return {
          message: 'Please enter a valid city name.',
          nextStep: 'city_input',
          data: data
        };
      }
      return {
        message: `Got it. You're looking for ${data.material} in ${message}.
How much quantity do you need? (e.g., 500 bags, 10 tons)`,
        nextStep: 'quantity_input',
        data: { ...data, city: message }
      };
    }

    if (step === 'quantity_input') {
      // Simple quantity validation
      if (message.trim().length < 1) {
        return {
          message: 'Please enter the quantity you need (e.g., 500 bags, 10 tons).',
          nextStep: 'quantity_input',
          data: data
        };
      }
      return {
        message: `Okay, I'm confirming your inquiry:
Material: ${data.material}
City: ${data.city}
Quantity: ${message}

Is this correct? (Yes/No)`,
        nextStep: 'confirm_inquiry',
        data: { ...data, quantity: message }
      };
    }

    if (step === 'confirm_inquiry') {
      if (message.toLowerCase() === 'yes') {
        return {
          message: "Great! We're processing your inquiry and connecting you with relevant vendors. You'll receive quotes shortly.",
          nextStep: 'completed', // End inquiry flow
          action: 'create_inquiry', // Trigger action to create inquiry in storage
          data: data
        };
      } else if (message.toLowerCase() === 'no') {
        return {
          message: "No problem. Let's restart. What material are you looking for?",
          nextStep: 'material_selection',
          data: { userType: 'buyer' } // Reset data for a new inquiry
        };
      } else {
        return {
          message: 'Please respond with "Yes" or "No".',
          nextStep: 'confirm_inquiry',
          data: data
        };
      }
    }

    // Example for vendor registration flow
    if (step === 'vendor_company_name') {
      if (message.trim().length < 2) {
        return {
          message: 'Please enter a valid company name.',
          nextStep: 'vendor_company_name',
          data: data
        };
      }
      return {
        message: `What materials do you supply? (e.g., cement, TMT, both)`,
        nextStep: 'vendor_material_input',
        data: { ...data, vendorName: message }
      };
    }

    if (step === 'vendor_material_input') {
      const lowerCaseMessage = message.toLowerCase();
      let materials: string[] = [];
      if (lowerCaseMessage.includes('cement')) materials.push('cement');
      if (lowerCaseMessage.includes('tmt')) materials.push('tmt');

      if (materials.length === 0) {
        return {
          message: 'Please specify if you supply Cement, TMT, or Both.',
          nextStep: 'vendor_material_input',
          data: data
        };
      }
      return {
        message: `And which city are you located in?`,
        nextStep: 'vendor_city_input',
        data: { ...data, materials: materials }
      };
    }

    if (step === 'vendor_city_input') {
      if (message.trim().length < 2) {
        return {
          message: 'Please enter a valid city name.',
          nextStep: 'vendor_city_input',
          data: data
        };
      }
      return {
        message: `What is your contact phone number? (10 digits)`,
        nextStep: 'vendor_phone_input',
        data: { ...data, city: message }
      };
    }

    if (step === 'vendor_phone_input') {
      const phone = message.replace(/\s+/g, '');
      if (!/^\d{10}$/.test(phone)) {
        return {
          message: 'Please enter a valid 10-digit mobile number.',
          nextStep: 'vendor_phone_input',
          data: data
        };
      }
      return {
        message: `Thank you, ${data.vendorName}! You supply ${data.materials?.join(' and ')} in ${data.city}. Your contact is ${phone}.
Is this information correct? (Yes/No)`,
        nextStep: 'confirm_vendor_registration',
        data: { ...data, vendorPhone: phone }
      };
    }

    if (step === 'confirm_vendor_registration') {
      if (message.toLowerCase() === 'yes') {
        return {
          message: "Great! Your vendor registration is complete. We'll notify you of relevant inquiries.",
          nextStep: 'completed', // End vendor registration flow
          action: 'register_vendor', // Trigger action to register vendor in storage
          data: data
        };
      } else if (message.toLowerCase() === 'no') {
        return {
          message: "No problem. Let's restart your vendor registration. What's your company name?",
          nextStep: 'vendor_company_name',
          data: { userType: 'vendor' } // Reset data for new registration
        };
      } else {
        return {
          message: 'Please respond with "Yes" or "No".',
          nextStep: 'confirm_vendor_registration',
          data: data
        };
      }
    }


    // Generic fallback for unhandled messages/steps
    return {
      message: "I'm sorry, I didn't understand that. Please try again or type /start to go to the main menu.",
      nextStep: 'main_menu_selection', // Default to main_menu_selection for unknown state
      data: data
    };
  }
}

export const conversationFlowB = new ConversationFlowB();