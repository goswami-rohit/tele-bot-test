import TelegramBot from 'node-telegram-bot-api';
import { storage } from "../storage";
import axios from 'axios';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

export interface TelegramBotConfig {
  token: string;
}

export const sendTelegramMessage = async (chatId: string, text: string) => {
  try {
    const res = await axios.post(`${TELEGRAM_API}/sendMessage`, {
      chat_id: chatId,
      text,
    });

    console.log(`✅ Message sent to Telegram user ${chatId}: ${text}`);
    return res.data;
  } catch (error: any) {
    console.error("❌ Telegram message send failed:", error.response?.data || error.message);
    throw error;
  }
};

export class TelegramBotService {
  private bot: TelegramBot | null = null;
  private isActive: boolean = true;
  private userSessions: Map<string, any> = new Map();
  private webSessionMapping: Map<number, string> = new Map(); // Maps numeric IDs to session UUIDs
  private token: string;

  constructor(config: TelegramBotConfig) {
    this.token = config.token;
  }

  private initializeBot() {
    if (this.bot) return;

    const token = this.token || process.env.TELEGRAM_BOT_TOKEN;

    if (!token || token === "demo_token" || token === "") {
      console.error("❌ No valid Telegram bot token found!");
      throw new Error("Telegram bot token is required");
    }

    console.log("🤖 Initializing Telegram bot with token:", token.substring(0, 10) + "...");

    try {
      this.bot = new TelegramBot(token, {
        polling: {
          interval: 300,
          autoStart: false,
          params: {
            timeout: 10
          }
        }
      });
    } catch (error) {
      console.error("❌ Failed to create Telegram bot:", error);
      throw error;
    }
  }

  async start(useWebhook = true) {
    try {
      this.initializeBot();

      if (!this.bot) {
        throw new Error("Failed to initialize Telegram bot");
      }

      this.isActive = true;
      const me = await this.bot.getMe();
      console.log('✅ Bot verified:', me.username, `(@${me.username})`);

      if (!useWebhook) {
        try {
          if (this.bot.isPolling) {
            await this.bot.stopPolling();
            console.log('🛑 Stopped existing polling');
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } catch (err) {
          console.log('No existing polling to stop');
        }

        await this.bot.startPolling();
        console.log('✅ Telegram bot started with polling');

        this.bot.on('message', async (msg) => {
          if (!msg.text) return;
          console.log('🔵 Telegram message received from:', msg.chat.id, ':', msg.text);
          await this.handleIncomingMessage(msg);
        });

        this.bot.on('error', (error) => {
          console.error('Telegram bot error:', error);
        });

        this.bot.on('polling_error', (error) => {
          console.error('Telegram polling error:', error);
        });
      } else {
        console.log('✅ Telegram bot initialized (webhook mode)');
      }

    } catch (error) {
      console.error("❌ Failed to start Telegram bot:", error);
      this.isActive = false;
      throw error;
    }
  }

  async stop() {
    this.isActive = false;
    if (this.bot) {
      try {
        await this.bot.stopPolling();
        console.log("Telegram bot stopped");
      } catch (error) {
        console.error("Error stopping bot:", error);
      }
    }
  }

  async setupWebhook(webhookUrl: string) {
    try {
      this.initializeBot();

      if (!this.bot) {
        throw new Error("Bot not initialized");
      }

      if (this.bot.isPolling) {
        await this.bot.stopPolling();
        console.log('🛑 Stopped polling');
      }

      await this.bot.setWebHook(webhookUrl);
      console.log('✅ Webhook set to:', webhookUrl);

      const info = await this.bot.getWebHookInfo();
      console.log('🔗 Webhook info:', info);

      return info;
    } catch (error) {
      console.error('❌ Failed to setup webhook:', error);
      throw error;
    }
  }

  async processWebhookUpdate(update: any) {
    try {
      if (update.message && update.message.text) {
        console.log('🔵 Webhook message received from:', update.message.chat.id, ':', update.message.text);
        await this.handleIncomingMessage(update.message);
      }
    } catch (error) {
      console.error('❌ Error processing webhook update:', error);
    }
  }

  // Web session mapping methods
  setWebSessionMapping(numericId: number, sessionId: string) {
    this.webSessionMapping.set(numericId, sessionId);
    console.log(`🔗 Mapped numeric ID ${numericId} to session ${sessionId}`);
  }

  getWebSessionId(numericId: number): string | undefined {
    return this.webSessionMapping.get(numericId);
  }

  isWebSession(chatId: number): boolean {
    return this.webSessionMapping.has(chatId);
  }

  async handleIncomingMessage(msg: any) {
    if (!this.isActive) return;

    const chatId = msg.chat.id;
    const text = msg.text;

    console.log(`🔄 Processing message from ${chatId}: "${text}"`);

    // Handle /start command
    if (text === '/start') {
      this.userSessions.delete(chatId.toString());
      const userSession = { step: 'user_type' };

      const response = `🏗️ Welcome to CemTemBot! 

I help you get instant pricing for cement and TMT bars from verified vendors in your city.

Are you a:
1️⃣ Buyer (looking for prices)
2️⃣ Vendor (want to provide quotes)

Reply with 1 or 2`;

      this.userSessions.set(chatId.toString(), userSession);
      await this.sendMessage(chatId, response);
      return;
    }

    // Handle /help command
    if (text === '/help') {
      await this.sendMessage(chatId, `🤖 CemTemBot Help:

Commands:
/start - Start a new pricing inquiry
/help - Show this help message

Simply send /start to begin!`);
      return;
    }

    // Check if this is a vendor rate response
    const isRateResponse = await this.handleVendorRateResponse(msg);
    if (isRateResponse) {
      return;
    }

    // Continue with conversation flow
    const userSession = this.userSessions.get(chatId.toString()) || { step: 'start' };
    let response = '';

    switch (userSession.step) {
      case 'start':
        response = `👋 Hello! Send /start to get started with pricing inquiries.`;
        break;

      case 'user_type':
        if (text === '1' || text?.toLowerCase().includes('buyer')) {
          userSession.userType = 'buyer';
          userSession.step = 'get_city';
          response = `Great! I'll help you find prices in your city.

📍 Which city are you in?

Available cities: Guwahati, Mumbai, Delhi

Please enter your city name:`;
        } else if (text === '2' || text?.toLowerCase().includes('vendor')) {
          userSession.userType = 'vendor';
          userSession.step = 'vendor_name';
          response = `👨‍💼 Great! Let's register you as a vendor.

What's your business/company name?`;
        } else {
          response = `Please reply with:
1 - if you're a Buyer
2 - if you're a Vendor`;
        }
        break;

      case 'vendor_name':
        userSession.vendorName = text?.trim();
        userSession.step = 'vendor_city';
        response = `📍 Business Name: ${userSession.vendorName}

Which city do you operate in?

Available cities: Guwahati, Mumbai, Delhi

Enter your city:`;
        break;

      case 'vendor_city':
        userSession.vendorCity = text?.trim();
        userSession.step = 'vendor_materials';
        response = `📍 City: ${userSession.vendorCity}

What materials do you supply?

1️⃣ Cement only
2️⃣ TMT Bars only  
3️⃣ Both Cement and TMT Bars

Reply with 1, 2, or 3:`;
        break;

      case 'vendor_materials':
        if (text === '1') {
          userSession.materials = ['cement'];
        } else if (text === '2') {
          userSession.materials = ['tmt'];
        } else if (text === '3') {
          userSession.materials = ['cement', 'tmt'];
        } else {
          response = `Please select:
1 - Cement only
2 - TMT Bars only
3 - Both materials`;
          break;
        }
        userSession.step = 'vendor_phone';
        response = `📋 Materials: ${userSession.materials.join(', ').toUpperCase()}

What's your contact phone number?

Enter your phone number:`;
        break;

      case 'vendor_phone':
        userSession.vendorPhone = text?.trim();
        userSession.step = 'vendor_confirm';

        const materialsText = userSession.materials.join(' and ').toUpperCase();
        response = `✅ Please confirm your vendor registration:

🏢 Business: ${userSession.vendorName}
📍 City: ${userSession.vendorCity}
🏗️ Materials: ${materialsText}
📞 Phone: ${userSession.vendorPhone}

Reply "confirm" to register or "restart" to start over:`;
        break;

      case 'vendor_confirm':
        if (text?.toLowerCase().trim() === 'confirm') {
          try {
            await this.processVendorRegistration(chatId, userSession);
            response = `🎉 Vendor registration successful!

Welcome to our vendor network, ${userSession.vendorName}!

You'll start receiving pricing inquiries for ${userSession.materials.join(' and ').toUpperCase()} in ${userSession.vendorCity}.

Send /start anytime for help.`;
            this.userSessions.delete(chatId.toString());
          } catch (error) {
            console.error('Vendor registration failed:', error);
            response = `❌ Registration failed. Please try again by sending /start`;
            this.userSessions.delete(chatId.toString());
          }
        } else if (text?.toLowerCase().trim() === 'restart') {
          userSession.step = 'user_type';
          response = `🔄 Let's start over!

Are you a:
1️⃣ Buyer (looking for prices)
2️⃣ Vendor (want to provide quotes)

Reply with 1 or 2`;
        } else {
          response = `Please reply "confirm" to complete registration or "restart" to start over.`;
        }
        break;

      case 'get_city':
        userSession.city = text?.trim();
        userSession.step = 'get_material';
        response = `📍 City: ${userSession.city}

What are you looking for?

1️⃣ Cement
2️⃣ TMT Bars

Reply with 1 or 2:`;
        break;

      case 'get_material':
        if (text === '1' || text?.toLowerCase().includes('cement')) {
          userSession.material = 'cement';
        } else if (text === '2' || text?.toLowerCase().includes('tmt')) {
          userSession.material = 'tmt';
        } else {
          response = `Please select:
1 - for Cement
2 - for TMT Bars`;
          break;
        }
        userSession.step = 'get_brand';
        response = `🏷️ Any specific brand preference?

For ${userSession.material}:
- Enter brand name (e.g., ACC, Ambuja, UltraTech)
- Or type "any" for any brand`;
        break;

      case 'get_brand':
        userSession.brand = text?.toLowerCase() === 'any' ? null : text?.trim();
        userSession.step = 'get_quantity';
        response = `📦 How much quantity do you need?

Examples:
- 50 bags
- 2 tons
- 100 pieces

Enter quantity:`;
        break;

      case 'get_quantity':
        userSession.quantity = text?.trim();
        userSession.step = 'confirm';

        const brandText = userSession.brand ? `Brand: ${userSession.brand}` : 'Brand: Any';
        response = `✅ Please confirm your inquiry:

📍 City: ${userSession.city}
🏗️ Material: ${userSession.material.toUpperCase()}
${brandText}
📦 Quantity: ${userSession.quantity}

Reply "confirm" to send to vendors or "restart" to start over:`;
        break;

      case 'confirm':
        if (text?.toLowerCase().trim() === 'confirm') {
          await this.processInquiry(chatId, userSession);
          response = `🚀 Your inquiry has been sent!

We've contacted vendors in ${userSession.city} for ${userSession.material} pricing. You should receive quotes shortly.

📊 Inquiry ID: INQ-${Date.now()}

Send /start for a new inquiry anytime!`;
          this.userSessions.delete(chatId.toString());
        } else if (text?.toLowerCase().trim() === 'restart') {
          userSession.step = 'user_type';
          response = `🔄 Let's start over!

Are you a:
1️⃣ Buyer (looking for prices)
2️⃣ Vendor (want to provide quotes)

Reply with 1 or 2`;
        } else {
          response = `Please reply "confirm" to send your inquiry or "restart" to start over.`;
        }
        break;

      default:
        response = `👋 Hello! Send /start to begin a new pricing inquiry.`;
        this.userSessions.delete(chatId.toString());
    }

    this.userSessions.set(chatId.toString(), userSession);
    await this.sendMessage(chatId, response);
  }

  async handleVendorRateResponse(msg: any) {
    const chatId = msg.chat.id;
    const text = msg.text;

    const ratePattern = /RATE:\s*([0-9]+(?:\.[0-9]+)?)\s*per\s*(\w+)/i;
    const gstPattern = /GST:\s*([0-9]+(?:\.[0-9]+)?)%/i;
    const deliveryPattern = /DELIVERY:\s*([0-9]+(?:\.[0-9]+)?)/i;
    const inquiryPattern = /Inquiry ID:\s*(INQ-[0-9]+)/i;

    const rateMatch = text.match(ratePattern);
    const gstMatch = text.match(gstPattern);
    const deliveryMatch = text.match(deliveryPattern);
    const inquiryMatch = text.match(inquiryPattern);

    if (rateMatch && inquiryMatch) {
      const rate = parseFloat(rateMatch[1]);
      const unit = rateMatch[2];
      const gst = gstMatch ? parseFloat(gstMatch[1]) : 0;
      const delivery = deliveryMatch ? parseFloat(deliveryMatch[1]) : 0;
      const inquiryId = inquiryMatch[1];

      await this.sendMessage(chatId, `✅ Thank you! Your quote has been received.
      
📋 Your Quote:
💰 Rate: ₹${rate} per ${unit}
📊 GST: ${gst}%
🚚 Delivery: ₹${delivery}
      
Inquiry ID: ${inquiryId}`);

      try {
        await storage.createNotification({
          message: `✅ Vendor quote received: ${rate} per ${unit} (Inquiry #${inquiryId})`,
          type: 'vendor_quote_confirmed'
        });
      } catch (err) {
        console.error('Failed to create notification:', err);
      }
      return true;
    }

    return false;
  }

  private async processInquiry(chatId: number, session: any) {
    const inquiryId = `INQ-${Date.now()}`;

    try {
      const vendors = await storage.getVendors(session.city, session.material);
      const selectedVendors = vendors.slice(0, 3);

      if (selectedVendors.length > 0) {
        await storage.createInquiry({
          inquiryId,
          userName: this.isWebSession(chatId) ? "Web User" : "Telegram User",
          userPhone: chatId.toString(),
          city: session.city,
          material: session.material,
          brand: session.brand,
          quantity: session.quantity,
          vendorsContacted: selectedVendors.map(v => v.vendorId),
          responseCount: 0,
          status: "pending",
          platform: this.isWebSession(chatId) ? "web" : "telegram"
        });

        // Send messages to vendors
        await this.sendVendorMessages(selectedVendors, session, inquiryId);
      }
    } catch (error) {
      console.error('Error processing inquiry:', error);
    }
  }

  private async processVendorRegistration(chatId: number, session: any) {
    const vendorId = `VEN-${Date.now()}`;

    try {
      const vendorData = {
        vendorId,
        name: session.vendorName,
        phone: session.vendorPhone,
        telegramId: chatId.toString(),
        city: session.vendorCity,
        materials: session.materials,
        status: 'active',
        registeredAt: new Date(),
        lastQuoted: null
      };

      await storage.createVendor(vendorData);
      console.log(`✅ New vendor registered: ${session.vendorName} (${vendorId})`);
    } catch (error) {
      console.error('Failed to register vendor:', error);
      throw error;
    }
  }

  private async sendVendorMessages(vendors: any[], inquiry: any, inquiryId: string) {
    const botConfig = await storage.getBotConfig();
    let template = botConfig?.vendorRateRequestTemplate || `Hi [Vendor Name], 

New inquiry:
- Material: [Material]
- City: [City]
- Quantity: [Quantity]
- Brand: [Brand]

Please provide your best rate.

Reply with:
**RATE: [Price] per [Unit]**
**GST: [Percentage]%**
**DELIVERY: [Charges]**

Inquiry ID: ${inquiryId}`;

    for (const vendor of vendors) {
      const message = template
        .replace(/\[Vendor Name\]/g, vendor.name)
        .replace(/\[Material\]/g, inquiry.material)
        .replace(/\[City\]/g, inquiry.city)
        .replace(/\[Quantity\]/g, inquiry.quantity || "Not specified")
        .replace(/\[Brand\]/g, inquiry.brand || "Any");

      if (vendor.telegramId && this.bot) {
        try {
          await this.bot.sendMessage(parseInt(vendor.telegramId), `🔔 **New Price Inquiry**

${message}`);
          console.log(`✅ Message sent to vendor ${vendor.name}`);
        } catch (error) {
          console.error(`❌ Failed to send message to vendor ${vendor.name}:`, error);
        }
      }

      try {
        await storage.updateVendor(vendor.id, {
          lastQuoted: new Date()
        });
      } catch (error) {
        console.error('Error updating vendor:', error);
      }
    }
  }

  async sendMessage(chatId: number, message: string) {
    try {
      if (!this.bot) {
        throw new Error("Bot not initialized");
      }

      // Check if this is a web session
      const originalSessionId = this.getWebSessionId(chatId);
      
      if (originalSessionId) {
        // Send to web user via Socket.io
        if (global.io) {
          global.io.to(`session-${originalSessionId}`).emit("bot-reply", {
            sessionId: originalSessionId,
            message: message
          });
          console.log(`📱 Web reply sent to session ${originalSessionId}`);
        }
      } else {
        // Send normal Telegram message
        const result = await this.bot.sendMessage(chatId, message);
        console.log(`📨 Telegram message sent to ${chatId}`);
        return result;
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      throw error;
    }
  }

  async testBot() {
    try {
      this.initializeBot();
      if (!this.bot) {
        throw new Error("Bot not initialized");
      }
      const me = await this.bot.getMe();
      console.log('🤖 Bot info:', me);
      return me;
    } catch (error) {
      console.error('❌ Bot token error:', error);
      return null;
    }
  }

  getStatus() {
    return {
      isActive: this.isActive,
      platform: "telegram",
      activeSessions: this.userSessions.size,
      lastUpdate: new Date()
    };
  }
}

export const telegramBot = new TelegramBotService({
  token: "" // Will be loaded when start() is called
});