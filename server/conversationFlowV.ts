//server/conversationFLowB.ts
import { storage } from "./storage";
import { LocationManager } from './locationManager';

export interface ConversationContextV {
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
  showOptions?: string[];
}

const CEMENT_TYPES = [
  'OPC Grade 33',
  'OPC Grade 43',
  'OPC Grade 53',
  'PPC Grade 33',
  'PPC Grade 43',
  'PPC Grade 53',
  'Enter Other Specific Type'
];

const TMT_SIZES = ['5.5mm', '6mm', '8mm', '10mm', '12mm', '16mm', '18mm', '20mm', '24mm', '26mm', '28mm', '32mm', '36mm', '40mm'];

export class ConversationFlowV {
  // Helper function to capitalize city names
  private capitalizeCity(cityName: string): string {
    return cityName
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  async processMessage(context: ConversationContextV, message: string): Promise<FlowResponse> {
    const { chatId, step, data = {} } = context;

    // Handle /start command
    if (message === '/start' || !step) {
      return {
        message: `🏗️ Welcome to CemTemBot! 

Let's get you started with your enquiry...
I help you get instant pricing for cement and TMT bars from verified vendors in your city.

Reply with the Number of the option to send purchase enquiry to vendors OR register yourself as a Vendor:
1 Buy Materials
2 Register As A Vendor `,
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
      } else if (message === '2') {
        return {
          message: `🏢 Welcome vendor! Let's get you registered to provide quotes.

        What's your company name?`,
          nextStep: 'vendor_company',
          data: { userType: 'vendor' }
        };
      } else {
        return {
          message: `Please reply with 1 to buy materials`,
          nextStep: 'user_type'
        };
      }
    }

    // Buyer flow - Updated
    if (step === 'buyer_material') {
      let material, materialDisplay;

      if (message === '1') {
        material = 'cement';
        materialDisplay = 'cement';
      } else if (message === '2') {
        material = 'tmt';
        materialDisplay = 'TMT bars';
      } else if (message === '3') {
        material = 'both';
        materialDisplay = 'cement & TMT bars';
      } else {
        return {
          message: `Please reply with 1 for Cement or 2 for TMT Bars and 3 for both`,
          nextStep: 'buyer_material'
        };
      }

      // Move to company preference based on material
      if (material === 'cement') {
        return {
          message: `🏭 Select cement company preference (reply with number):

${CEMENT_COMPANIES.map((company, index) => `${index + 1}. ${company}`).join('\n')}`,
          nextStep: 'buyer_cement_company_select',
          data: { ...data, material },
          showOptions: CEMENT_COMPANIES
        };
      } else if (material === 'tmt') {
        return {
          message: `🏗️ Select TMT company preference (reply with number):

${TMT_COMPANIES.map((company, index) => `${index + 1}. ${company}`).join('\n')}`,
          nextStep: 'buyer_tmt_company_select',
          data: { ...data, material },
          showOptions: TMT_COMPANIES
        };
      } else if (material === 'both') {
        return {
          message: `🏭 Let's start with cement. Select cement company preference (reply with number):

${CEMENT_COMPANIES.map((company, index) => `${index + 1}. ${company}`).join('\n')}`,
          nextStep: 'buyer_cement_company_select',
          data: { ...data, material },
          showOptions: CEMENT_COMPANIES
        };
      }
    }

    // NEW: Cement company selection
    if (step === 'buyer_cement_company_select') {
      const selectedIndex = parseInt(message.trim()) - 1;
      const selectedCompany = CEMENT_COMPANIES[selectedIndex];

      if (!selectedCompany) {
        return {
          message: `Please select a valid number (1-${CEMENT_COMPANIES.length})`,
          nextStep: 'buyer_cement_company_select'
        };
      }

      return {
        message: `🏗️ Select cement types you need (reply with numbers separated by commas, e.g., "1,3,5"):

${CEMENT_TYPES.map((type, index) => `${index + 1}. ${type}`).join('\n')}`,
        nextStep: 'buyer_cement_types',
        data: { ...data, cementCompany: selectedCompany },
        showOptions: CEMENT_TYPES
      };
    }

    // NEW: Cement types selection
    if (step === 'buyer_cement_types') {
      const selectedIndices = message.split(',').map(num => parseInt(num.trim()) - 1);
      const selectedTypes = selectedIndices
        .filter(index => index >= 0 && index < CEMENT_TYPES.length)
        .map(index => CEMENT_TYPES[index]);

      if (selectedTypes.length === 0) {
        return {
          message: `Please select valid cement types using numbers (e.g., "1,3,5")`,
          nextStep: 'buyer_cement_types'
        };
      }

      // Handle "Enter Other Specific Type"
      if (selectedTypes.includes('Enter Other Specific Type')) {
        return {
          message: `Please specify your custom cement type:`,
          nextStep: 'buyer_cement_custom',
          data: { ...data, cementTypes: selectedTypes.filter(t => t !== 'Enter Other Specific Type') }
        };
      }

      // Check if we need TMT info (for "both" material)
      if (data.material === 'both') {
        return {
          message: `✅ Cement company: ${data.cementCompany}
✅ Cement types: ${selectedTypes.join(', ')}

🏗️ Now for TMT bars. Select TMT company preference (reply with number):

${TMT_COMPANIES.map((company, index) => `${index + 1}. ${company}`).join('\n')}`,
          nextStep: 'buyer_tmt_company_select',
          data: { ...data, cementTypes: selectedTypes },
          showOptions: TMT_COMPANIES
        };
      } else {
        // Only cement selected, move to city
        return {
          message: `✅ Company: ${data.cementCompany}
✅ Types: ${selectedTypes.join(', ')}

📍 Which city/location do you need these materials in?

Please enter your city name:`,
          nextStep: 'buyer_city',
          data: { ...data, cementTypes: selectedTypes }
        };
      }
    }

    // NEW: Handle custom cement type
    if (step === 'buyer_cement_custom') {
      const customType = message.trim();
      const allCementTypes = [...data.cementTypes, customType];

      if (data.material === 'both') {
        return {
          message: `✅ Cement company: ${data.cementCompany}
✅ Cement types: ${allCementTypes.join(', ')}

🏗️ Now for TMT bars. Select TMT company preference (reply with number):

${TMT_COMPANIES.map((company, index) => `${index + 1}. ${company}`).join('\n')}`,
          nextStep: 'buyer_tmt_company_select',
          data: { ...data, cementTypes: allCementTypes },
          showOptions: TMT_COMPANIES
        };
      } else {
        return {
          message: `✅ Company: ${data.cementCompany}
✅ Types: ${allCementTypes.join(', ')}

📍 Which city/location do you need these materials in?

Please enter your city name:`,
          nextStep: 'buyer_city',
          data: { ...data, cementTypes: allCementTypes }
        };
      }
    }

    // NEW: TMT company selection
    if (step === 'buyer_tmt_company_select') {
      const selectedIndex = parseInt(message.trim()) - 1;
      const selectedCompany = TMT_COMPANIES[selectedIndex];

      if (!selectedCompany) {
        return {
          message: `Please select a valid number (1-${TMT_COMPANIES.length})`,
          nextStep: 'buyer_tmt_company_select'
        };
      }

      return {
        message: `🔧 Select TMT sizes you need (reply with numbers separated by commas, e.g., "3,5,7"):

${TMT_SIZES.map((size, index) => `${index + 1}. ${size}`).join('\n')}`,
        nextStep: 'buyer_tmt_sizes',
        data: { ...data, tmtCompany: selectedCompany },
        showOptions: TMT_SIZES
      };
    }

    // NEW: TMT sizes selection
    if (step === 'buyer_tmt_sizes') {
      const selectedIndices = message.split(',').map(num => parseInt(num.trim()) - 1);
      const selectedSizes = selectedIndices
        .filter(index => index >= 0 && index < TMT_SIZES.length)
        .map(index => TMT_SIZES[index]);

      if (selectedSizes.length === 0) {
        return {
          message: `Please select valid TMT sizes using numbers (e.g., "3,5,7")`,
          nextStep: 'buyer_tmt_sizes'
        };
      }

      return {
        message: `✅ TMT company: ${data.tmtCompany}
✅ TMT sizes: ${selectedSizes.join(', ')}

📍 Which city/location do you need these materials in?

Please enter your city name:`,
        nextStep: 'buyer_city',
        data: { ...data, tmtSizes: selectedSizes }
      };
    }

    // Updated city step to handle new data structure
   if (step === 'buyer_city') {
  if (context.userType === 'web') {
    // For web users: expects "cityId:localityId" format
    let formattedLocation = message;
    let cityId, localityId;
    
    // Try to parse if it's in cityId:localityId format
    if (message.includes(':')) {
      [cityId, localityId] = message.split(':');
      const validLocation = LocationManager.getFormattedLocation(cityId, localityId);
      if (validLocation && validLocation !== 'Unknown Location') {
        formattedLocation = validLocation;
      }
    }
    
    //const formattedLocation = LocationManager.getFormattedLocation(cityId, localityId);

    let materialSummary = '';
    if (data.material === 'cement') {
      materialSummary = `Cement (${data.cementCompany}): ${data.cementTypes.join(', ')}`;
    } else if (data.material === 'tmt') {
      materialSummary = `TMT (${data.tmtCompany}): ${data.tmtSizes.join(', ')}`;
    } else if (data.material === 'both') {
      materialSummary = `Cement (${data.cementCompany}): ${data.cementTypes.join(', ')}\nTMT (${data.tmtCompany}): ${data.tmtSizes.join(', ')}`;
    }

    return {
      message: `📦 How much do you need?

Materials requested:
${materialSummary}
📍 Location: ${formattedLocation}

Please specify quantity (For both Cement and TMT if both are selected) (e.g., "50 bags cement or/and 200 pieces or 40kg TMT"):`,
      nextStep: 'buyer_quantity',
      data: { ...data, city: formattedLocation, cityId, localityId } // FIX: Use formattedLocation instead of capitalizedCity, add cityId & localityId
    };
  } else {
    // For Telegram users: show available locations
    const defaults = LocationManager.getDefaults();
    const defaultLocation = defaults.city && defaults.locality ? 
      LocationManager.getFormattedLocation(defaults.city.id, defaults.locality.id) : 
      'Ganeshguri, Guwahati';
    
    return {
      message: `📍 We currently serve ${defaultLocation}.

Type "yes" to continue with this location or "no" if you're in a different area:`,
      nextStep: 'buyer_city_confirm',
      data: { ...data, city: defaultLocation, cityId: 'guwahati', localityId: 'ganeshguri' }
    };
  }
}

 // Add confirmation step for Telegram users
 if (step === 'buyer_city_confirm') {
  if (message.toLowerCase() === 'yes' || message.toLowerCase() === 'y') {
    // Continue with default location
    let materialSummary = '';
    if (data.material === 'cement') {
      materialSummary = `Cement (${data.cementCompany}): ${data.cementTypes.join(', ')}`;
    } else if (data.material === 'tmt') {
      materialSummary = `TMT (${data.tmtCompany}): ${data.tmtSizes.join(', ')}`;
    } else if (data.material === 'both') {
      materialSummary = `Cement (${data.cementCompany}): ${data.cementTypes.join(', ')}\nTMT (${data.tmtCompany}): ${data.tmtSizes.join(', ')}`;
    }

    return {
      message: `📦 How much do you need?

Materials requested:
${materialSummary}
📍 Location: ${data.city}

Please specify quantity (e.g., "50 bags cement or/and 200 pieces TMT"):`,
      nextStep: 'buyer_quantity',
      data: data
    };
  } else {
    return {
      message: `Sorry, we currently only serve Guwahati area. We'll be expanding to more cities soon!

Type /start to try again or contact us for updates on new service areas.`,
      nextStep: 'completed'
    };
  }
}

 if (step === 'buyer_quantity') {
  return {
    message: `📱 Great! Please provide your phone number for vendors to contact you:`,
    nextStep: 'buyer_phone',
    data: { ...data, quantity: message }
  };
}

 // Updated phone step with detailed summary
 if (step === 'buyer_phone') {
  let materialDisplay = '';
  if (data.material === 'cement') {
    materialDisplay = `🏗️ Cement Types: ${data.cementTypes.join(', ')}
🏭 Company: ${data.cementCompany}`;
  } else if (data.material === 'tmt') {
    materialDisplay = `🔧 TMT Sizes: ${data.tmtSizes.join(', ')}
🏭 Company: ${data.tmtCompany}`;
  } else if (data.material === 'both') {
    materialDisplay = `🏗️ Cement Types: ${data.cementTypes.join(', ')}
🏭 Cement Company: ${data.cementCompany}
🔧 TMT Sizes: ${data.tmtSizes.join(', ')}
🏭 TMT Company: ${data.tmtCompany}`;
  }

  return {
    message: `✅ Perfect! Your inquiry has been created and sent to vendors in ${data.city}.

📋 **Your Inquiry Summary:**
${materialDisplay}
📍 City: ${data.city}
📦 Quantity: ${data.quantity}
📱 Contact: ${message}

Vendors will send you detailed quotes shortly!`,
    nextStep: 'completed',
    action: 'create_inquiry',
    data: { ...data, phone: message }
  };
}

    // Vendor registration flow
    if (step === 'vendor_company') {
      return {
        message: `📱 What's your phone number?`,
        nextStep: 'vendor_phone',
        data: { ...data, company: message }
      };
    }

    if (step === 'vendor_phone') {
      return {
        message: `📍 Which city are you based in?`,
        nextStep: 'vendor_city',
        data: { ...data, phone: message }
      };
    }

    if (step === 'vendor_city') {
  const cities = LocationManager.getCities();
  
  return {
    message: `📍 Select which city you operate in (reply with number):
${cities.map((city, index) => `${index + 1}. ${city.name}`).join('\n')}`,
    nextStep: 'vendor_city_select',
    data: { ...data },
    showOptions: cities.map(city => city.name)
  };
}
// Add city selection step:
if (step === 'vendor_city_select') {
  const cities = LocationManager.getCities();
  const selectedIndex = parseInt(message.trim()) - 1;
  const selectedCity = cities[selectedIndex];
  if (!selectedCity) {
    return {
      message: `Please select a valid number (1-${cities.length})`,
      nextStep: 'vendor_city_select'
    };
  }
  return {
    message: `🏘️ Select which locality you operate in (reply with number):
${selectedCity.localities.map((locality, index) => `${index + 1}. ${locality.name}`).join('\n')}`,
    nextStep: 'vendor_locality_select',
    data: { ...data, selectedCityId: selectedCity.id, selectedCityName: selectedCity.name },
    showOptions: selectedCity.localities.map(locality => locality.name)
  };
}
// Add locality selection step:
if (step === 'vendor_locality_select') {
  const cities = LocationManager.getCities();
  const selectedCity = cities.find(city => city.id === data.selectedCityId);
  
  if (!selectedCity) {
    return {
      message: `Error: Please start over.`,
      nextStep: 'vendor_city'
    };
  }
  const selectedIndex = parseInt(message.trim()) - 1;
  const selectedLocality = selectedCity.localities[selectedIndex];
  if (!selectedLocality) {
    return {
      message: `Please select a valid number (1-${selectedCity.localities.length})`,
      nextStep: 'vendor_locality_select'
    };
  }
  // Store as "locality, city" format
  const fullLocation = `${selectedLocality.name}, ${selectedCity.name}`;
  return {
    message: `✅ Great! You'll serve customers in ${fullLocation}.
📱 Please provide your contact phone number:`,
    nextStep: 'vendor_phone',
    data: { ...data, city: fullLocation } // Store full "locality, city" string
  };
}

    if (step === 'vendor_materials') {
      let materials: string[] = [];
      if (message === '1') materials = ['cement'];
      else if (message === '2') materials = ['tmt'];
      else if (message === '3') materials = ['cement', 'tmt'];
      else {
        return {
          message: `Please reply with 1, 2, or 3`,
          nextStep: 'vendor_materials'
        };
      }

      return {
        message: `✅ Excellent! Your vendor registration is complete.

    📋 **Registration Summary:**
    🏢 Company: ${data.company}
    📱 Phone: ${data.phone}
    📍 City: ${data.city}
    🏗️ Materials: ${materials.map(m => m === 'cement' ? 'Cement' : 'TMT Bars').join(', ')}

    You'll now receive inquiry notifications and can send quotes!`,
        nextStep: 'completed',
        action: 'register_vendor',
        data: { ...data, materials }
      };
    }

    // Default response
    return {
      message: `I didn't understand that. Type /start to begin again.`,
      nextStep: 'user_type'
    };
  }
}

export const conversationFlowV = new ConversationFlowV();