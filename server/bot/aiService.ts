interface AIExtractionResult {
  extracted: boolean;
  confidence: number;
  data: {
    userType?: 'buyer' | 'vendor';
    city?: string;
    material?: 'cement' | 'tmt';
    brand?: string;
    quantity?: string;
    vendorName?: string;
    vendorPhone?: string;
    materials?: string[];
  };
  suggestedStep: string;
}

export class AIService {
  private apiKey: string;
  private baseUrl = 'https://openrouter.ai/api/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async extractInformation(message: string, currentStep: string): Promise<AIExtractionResult> {
    try {
   const prompt = `Extract info from: "${message}"

IMPORTANT RULES:
- If message contains "I supply", "I sell", "vendor", "supplier", "dealer", "store", "business" → userType: "vendor"
- If message contains "I need", "I want", "looking for", "require", "buy" → userType: "buyer"

Return JSON:
{
  "userType": "buyer" or "vendor" or null,
  "city": "Guwahati" or "Mumbai" or "Delhi" or null,
  "material": "cement" or "tmt" or null,
  "quantity": "amount" or null,
  "brand": "brand name" or null,
  "vendorName": "company name" or null,
  "vendorPhone": "phone" or null,
  "materials": ["cement","tmt"] or null,
  "confidence": 0.0-1.0,
  "suggestedStep": "confirm" or "vendor_confirm" or "get_city" etc
}

Examples:
"I supply cement" → userType: "vendor", suggestedStep: "vendor_confirm"
"I need cement" → userType: "buyer", suggestedStep: "confirm"`;
      
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'deepseek/deepseek-chat',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
          max_tokens: 200
        })
      });

      const result = await response.json();
      const aiResponse = result.choices[0].message.content;
      
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch[0]);
      
      return {
        extracted: parsed.confidence > 0.7,
        confidence: parsed.confidence || 0,
        data: parsed,
        suggestedStep: parsed.suggestedStep || 'user_type'
      };
      
    } catch (error) {
      console.error('AI failed:', error);
      return {
        extracted: false,
        confidence: 0,
        data: {},
        suggestedStep: currentStep
      };
    }
  }
}