//server/conversationFLowB.ts
import { storage } from "./storage";

// conversationFlow.ts
export interface ConversationContextB {
  chatId: string;
  userType?: 'telegram' | 'web';
  sessionId?: string;
  step?: string;
  data?: any;
}

export interface FlowResponse {
  message: string;
  nextStep?: string;
  action?: string;
  data?: any;
}

export class ConversationFlowB {
  // Helper function to capitalize city names
  private capitalizeCity(cityName: string): string {
    return cityName
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  async processMessage(context: ConversationContextB, message: string): Promise<FlowResponse> {
    const { chatId, step, data = {} } = context;
    
    // Handle /start command
    if (message === '/start' || !step) {
      return {
        message: `🏗️ Welcome to CemTemBot! 

Let's get you started with your enquiry...
I help you get instant pricing for cement and TMT bars from verified vendors in your city.

Reply with the Number of the option to send purchase enquiry to vendors:
1 Buy Materials `,
        nextStep: 'user_type'
      };
    }

    // Handle user type selection
    if (step === 'user_type') {
      if (message === '1') {
        return {
          message: `🏗️ Great! I'll help you get pricing for cement and TMT bars.

What material do you need pricing for?
1 Cement
2 TMT Bars
3 Both Cement & TMT Bars

Reply with 1 or 2 or 3`,
          nextStep: 'buyer_material',
          data: { userType: 'buyer' }
        };
//       } else if (message === '2') {
//         return {
//           message: `🏢 Welcome vendor! Let's get you registered to provide quotes.

// What's your company name?`,
//           nextStep: 'vendor_company',
//           data: { userType: 'vendor' }
//         };
      } else {
        return {
          message: `Please reply with 1 to buy materials`,
          nextStep: 'user_type'
        };
      }
    }

    // Buyer flow
    if (step === 'buyer_material') {
      const material = message === '1' ? 'cement' : message === '2' ? 'tmt' : message === '3' ? ' Both Cement and TMT Bars' : null;
      if (!material) {
        return {
          message: `Please reply with 1 for Cement or 2 for TMT Bars and 3 for both`,
          nextStep: 'buyer_material'
        };
      }

      return {
        message: `📍 Which city do you need ${material === 'cement' ? 'cement' : material === 'tmt' ? 'tmt' : 'Both Cement and TMT Bars'} in?

Please enter your city name:`,
        nextStep: 'buyer_city',
        data: { ...data, material }
      };
    }

    if (step === 'buyer_city') {
      // Auto-capitalize the city name
      const capitalizedCity = this.capitalizeCity(message);
      
      return {
        message: `📦 How much ${data.material === 'cement' ? 'Cement' : data.material === 'tmt' ? 'TMT Bars' : 'Cement & TMT Bars'} do you need?

Please specify quantity (e.g., "50 bags" or "10 tons"):`,
        nextStep: 'buyer_quantity',
        data: { ...data, city: capitalizedCity }
      };
    }

    if (step === 'buyer_quantity') {
      return {
        message: `📱 Great! Please provide your phone number for vendors to contact you:`,
        nextStep: 'buyer_phone',
        data: { ...data, quantity: message }
      };
    }

    if (step === 'buyer_phone') {
      return {
        message: `✅ Perfect! Your inquiry has been created and sent to vendors in ${data.city}.

📋 **Your Inquiry Summary:**
🏗️ Material: ${data.material === 'cement' ? 'Cement' : data.material === 'tmt' ? 'TMT Bars' : 'Cement & TMT Bars'}
📍 City: ${data.city}
📦 Quantity: ${data.quantity}
📱 Contact: ${message}

Vendors will send you quotes shortly!`,
        nextStep: 'completed',
        action: 'create_inquiry',
        data: { ...data, phone: message }
      };
    }

    // Vendor registration flow
//     if (step === 'vendor_company') {
//       return {
//         message: `📱 What's your phone number?`,
//         nextStep: 'vendor_phone',
//         data: { ...data, company: message }
//       };
//     }

//     if (step === 'vendor_phone') {
//       return {
//         message: `📍 Which city are you based in?`,
//         nextStep: 'vendor_city',
//         data: { ...data, phone: message }
//       };
//     }

//     if (step === 'vendor_city') {
//       // Auto-capitalize the city name for vendors too
//       const capitalizedVendorCity = this.capitalizeCity(message);
      
//       return {
//         message: `🏗️ What materials do you supply?

// 1️⃣ Cement only
// 2️⃣ TMT Bars only  
// 3️⃣ Both Cement and TMT Bars

// Reply with 1, 2, or 3`,
//         nextStep: 'vendor_materials',
//         data: { ...data, city: capitalizedVendorCity }
//       };
//     }

//     if (step === 'vendor_materials') {
//       let materials: string[] = [];
//       if (message === '1') materials = ['cement'];
//       else if (message === '2') materials = ['tmt'];
//       else if (message === '3') materials = ['cement', 'tmt'];
//       else {
//         return {
//           message: `Please reply with 1, 2, or 3`,
//           nextStep: 'vendor_materials'
//         };
//       }

//       return {
//         message: `✅ Excellent! Your vendor registration is complete.

// 📋 **Registration Summary:**
// 🏢 Company: ${data.company}
// 📱 Phone: ${data.phone}
// 📍 City: ${data.city}
// 🏗️ Materials: ${materials.map(m => m === 'cement' ? 'Cement' : 'TMT Bars').join(', ')}

// You'll now receive inquiry notifications and can send quotes!`,
//         nextStep: 'completed',
//         action: 'register_vendor',
//         data: { ...data, materials }
//       };
//     }

    // Default response
    return {
      message: `I didn't understand that. Type /start to begin again.`,
      nextStep: 'user_type'
    };
  }
}

export const conversationFlowB = new ConversationFlowB();