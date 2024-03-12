const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const bodyParser = require('body-parser');

// Replace 'YOUR_TELEGRAM_BOT_TOKEN' with your actual bot token
const bot = new TelegramBot('6940412330:AAEMLQK86WhbeVIikCtrAx-rhAh_cy59Q0w', { polling: true });

// UC prices
const ucPrices = [
  { uc: '60UC', price: '140 Birr' },
  { uc: '300UC', price: '700 Birr' },
  { uc: '600UC', price: '1,400 Birr' },
  { uc: '1500UC', price: '3,500 Birr' },
  { uc: '3000UC', price: '7,000 Birr' },
  { uc: '6000UC', price: '14,000 Birr' }
];

// Variables to store user information
let selectedUC;
let selectedPrice;
let paymentMethod;
let accountName;
let phoneNumber;
let pubgMobileID;
let pubgMobileAccountName;
let stage = 'start'; // The starting stage of the conversation

// Let's track the order status
let orderStatus = 'pending'; // Default order status

// Express app
const app = express();
app.use(bodyParser.json());

// Webhook endpoint for receiving updates from Telegram
app.post(`/webhook/${bot.token}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// Start command
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const keyboard = {
    reply_markup: {
      inline_keyboard: ucPrices.map(item => [
        { text: `${item.uc} = ${item.price}`, callback_data: JSON.stringify(item) }
      ])
    }
  };

  bot.sendMessage(chatId, 'Choose the UC and price:', keyboard);
  stage = 'select_uc';
});

// Handling button clicks
bot.on('callback_query', (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const action = callbackQuery.data;

  if (action === 'confirm') {
    bot.sendMessage(chatId, 'Choose your payment method:', {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Hello Cash', callback_data: 'hello_cash' }, { text: 'Ebirr', callback_data: 'ebirr' }]
        ]
      }
    });
    stage = 'select_payment_method';
  } else if (action === 'cancel') {
    const keyboard = {
      reply_markup: {
        inline_keyboard: ucPrices.map(item => [
          { text: `${item.uc} = ${item.price}`, callback_data: JSON.stringify(item) }
        ])
      }
    };
    bot.sendMessage(chatId, 'Choose the UC and price:', keyboard);
    stage = 'select_uc';
  } else if (action === 'hello_cash' || action === 'ebirr') {
    paymentMethod = action;
    bot.sendMessage(chatId, `What is the name of your ${action === 'hello_cash' ? 'Hello Cash' : 'Ebirr'} account?`);
    stage = 'enter_account_name';
  } else if (action === 'complete_order' || action === 'cancel_order') {
    if (orderStatus === 'completed') {
      bot.sendMessage(chatId, 'Your order is already completed.');
    } else {
      const buttons = [
        { text: 'Complete the order', callback_data: 'complete_order' },
        { text: 'Cancel the order', callback_data: 'cancel_order' }
      ];
      bot.sendMessage(chatId, 'Please confirm your choice:', {
        reply_markup: {
          inline_keyboard: [buttons]
        }
      });
    }
  } else {
    const data = JSON.parse(action);
    selectedUC = data.uc;
    selectedPrice = data.price;

    bot.sendMessage(chatId, `Are you sure you want to buy ${data.uc} for ${data.price}?`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Yes, I\'m sure', callback_data: 'confirm' }, { text: 'No, cancel', callback_data: 'cancel' }]
        ]
      }
    });
    stage = 'confirm_purchase';
  }
});

// Handling user input at different stages
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const messageText = msg.text.trim();

  switch (stage) {
    case 'enter_account_name':
      accountName = messageText;
      bot.sendMessage(chatId, 'Send me the number that you want to make the transaction with (e.g., 0901020304):');
      stage = 'enter_phone_number';
      break;

    case 'enter_phone_number':
      if (paymentMethod && messageText.startsWith('09') && messageText.length === 10 && /^\d+$/.test(messageText)) {
        phoneNumber = messageText;
        bot.sendMessage(chatId, 'Send me the ID of your PUBG Mobile (only numbers):');
        stage = 'enter_pubg_mobile_id';
      } else if (paymentMethod) {
        bot.sendMessage(chatId, 'This number is not available in Ethiopia. Please provide a valid Ethiopian phone number (e.g., 0901020304):');
      }
      break;

    case 'enter_pubg_mobile_id':
      if (/^\d+$/.test(messageText)) {
        pubgMobileID = messageText;
        bot.sendMessage(chatId, 'Send me the right name of your PUBG Mobile account:');
        stage = 'enter_pubg_mobile_account_name';
      } else {
        bot.sendMessage(chatId, 'Invalid PUBG Mobile ID. Please provide a valid PUBG Mobile ID (only numbers):');
      }
      break;

    case 'enter_pubg_mobile_account_name':
      pubgMobileAccountName = messageText;

      // Send the collected information to your Telegram account with ID 2076385698
      const collectedInfo = `User Information:
Selected UC: ${selectedUC}
Price: ${selectedPrice}
Payment Method: ${paymentMethod === 'hello_cash' ? 'Hello Cash' : 'Ebirr'}
Account Name: ${accountName}
Phone Number: ${phoneNumber}
PUBG Mobile ID: ${pubgMobileID}
PUBG Mobile Account Name: ${pubgMobileAccountName}`;

      bot.sendMessage('7056409773', collectedInfo);

      // Show the user the collected information and ask for confirmation
      const buttons = [
        { text: 'Complete the order', callback_data: 'complete_order' },
        { text: 'Cancel the order', callback_data: 'cancel_order' }
      ];
      bot.sendMessage(chatId, `Your order details:\n${collectedInfo}\nPlease confirm your choice:`, {
        reply_markup: {
          inline_keyboard: [buttons]
        }
      });

      stage = 'order_confirmation';
      break;

    case 'order_confirmation':
      if (messageText === '/order') {
        // Show the order status to the user
        let orderStatusMessage = 'Your order is pending';
        if (orderStatus === 'completed') {
          orderStatusMessage = 'Your order is completed and verified';
        } else if (orderStatus === 'declined') {
          orderStatusMessage = 'Your order has been declined by the owner';
        }

        bot.sendMessage(chatId, orderStatusMessage);
      } else if (messageText === '/payment') {
        // Show payment information to the user
        const paymentInfo = `You have to transfer the money to this number:\n0933330073\nAccount name: Ducoo UC\nYour Telegram username: ${msg.from.username}`;
        bot.sendMessage(chatId, paymentInfo);
      }
      break;

    default:
      // In case of unexpected input, start from the beginning
      bot.sendMessage(chatId, 'Choose the UC and price:', {
        reply_markup: {
          inline_keyboard: ucPrices.map(item => [
            { text: `${item.uc} = ${item.price}`, callback_data: JSON.stringify(item) }
          ])
        }
      });
      stage = 'select_uc';
      break;
  }
});

// Handling button clicks for order confirmation
bot.on('callback_query', (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const action = callbackQuery.data;

  if (action === 'complete_order') {
    // Update order status and send confirmation to user
    orderStatus = 'completed';
    bot.sendMessage(chatId, 'Your order is now pending. You Have to transfer selected price to this number 0933330073, When you complete the transaction Click Continue.', {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Continue', callback_data: 'refresh_order_status' }]
        ]
      }
    });
  } else if (action === 'cancel_order') {
    // Send a message to the owner that the user has canceled the order
    const ownerMessage = `User has canceled the order.\n${collectedInfo}`;
    bot.sendMessage('7056409773', ownerMessage);
    bot.sendMessage(chatId, 'Your order has been canceled. Click /start to make a new order.');
  } else if (action === 'refresh_order_status') {
    // Show the current order status to the user
    let orderStatusMessage = 'Your order is pending';
    if (orderStatus === 'completed') {
      orderStatusMessage = 'Your order is completed and verified';
    } else if (orderStatus === 'declined') {
      orderStatusMessage = 'Your order has been declined by the owner';
    }

    bot.sendMessage(chatId, orderStatusMessage);
  }
});

