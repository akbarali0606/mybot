// app.js

require("dotenv").config(); // .env faylidagi o'zgaruvchilarni yuklash

const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");
const path = require("path");

// --- KONFIGURATSIYA ---
const token = process.env.BOT_TOKEN;

const adminId = parseInt(process.env.ADMIN_ID);
if (isNaN(adminId)) {
  console.error("❌ XATO: ADMIN_ID .env faylida to'g'ri belgilang.");
  process.exit(1);
}

let BOT_USERNAME = process.env.BOT_USERNAME; // Bot username'ini .env dan olish
const CHANNEL_LINK =
  process.env.CHANNEL_LINK || "https://t.me/your_channel_username";
// --- KONFIGURATSIYA TUGADI ---

const bot = new TelegramBot(token, { polling: true });

const usersFilePath = path.join(__dirname, "users.json");

// --- YORDAMCHI FUNKSIYALAR ---

function getUsersData() {
  try {
    if (!fs.existsSync(usersFilePath)) {
      fs.writeFileSync(usersFilePath, "[]", "utf8");
    }
    const data = fs.readFileSync(usersFilePath, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.error(
      "❌ Foydalanuvchilar faylini o‘qishda/yaratishda xato:",
      error.message
    );
    return [];
  }
}

function saveUsersData(users) {
  try {
    fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2), "utf8");
  } catch (error) {
    console.error("❌ Foydalanuvchilar fayliga yozishda xato:", error.message);
  }
}

function findOrCreateUser(userId, username, referredBy = null) {
  const users = getUsersData();
  let user = users.find((u) => u.id === userId);
  let isNewUser = false;

  if (!user) {
    user = {
      id: userId,
      username: username,
      balance: 0,
      referred_by: referredBy,
      card_number: null,
      withdraw_requests: [],
      current_action: null,
    };
    users.push(user);
    isNewUser = true;
    console.log(`👤 Yangi foydalanuvchi qo'shildi: ${userId}`);
  } else {
    if (user.username !== username) {
      user.username = username;
    }
  }
  saveUsersData(users);
  return { user, isNewUser };
}

// Bosh menyu tugmalari
const mainKeyboard = {
  reply_markup: {
    inline_keyboard: [
      [{ text: "💸 Pul ishlash", callback_data: "earn_money" }],
      [{ text: "📊 Balansim", callback_data: "check_balance" }],
      [{ text: "💳 Pulni yechish", callback_data: "withdraw_money" }],
      [{ text: "📢 Kanalga ulanish", url: CHANNEL_LINK }],
    ],
  },
};

// --- BOT BUYRUQLARI VA HODISALARI ---

bot.onText(/\/start (.+)/, async (msg, match) => {
  const userId = msg.from.id;
  const username =
    msg.from.username || msg.from.first_name || "Noma'lum foydalanuvchi";
  const referredBy = parseInt(match[1]);

  if (userId === referredBy) {
    await bot.sendMessage(
      userId,
      "O'zingizni o'zingiz taklif qila olmaysiz! 😊",
      mainKeyboard
    );
    return;
  }

  const { user, isNewUser } = findOrCreateUser(userId, username, referredBy);

  if (isNewUser) {
    const users = getUsersData();
    const referrer = users.find((u) => u.id === referredBy);

    if (referrer) {
      referrer.balance += 1000;
      saveUsersData(users);

      await bot
        .sendMessage(
          referredBy,
          `🎉 Sizning referalingiz <b>${username}</b> (ID: <code>${userId}</code>) botga qo'shildi va hisobingizga <b>1000 so'm</b> qo'shildi!`,
          { parse_mode: "HTML" }
        )
        .catch((err) =>
          console.error(
            `Referalga xabar yuborishda xato ${referredBy}:`,
            err.message
          )
        );
    }

    await bot.sendMessage(
      userId,
      `👋 Assalomu alaykum, <b>${username}</b>! Referal tizimiga xush kelibsiz! Siz <b>${referredBy}</b> orqali kirdingiz.`,
      { parse_mode: "HTML", ...mainKeyboard }
    );
  } else {
    await bot.sendMessage(
      userId,
      `👋 Assalomu alaykum, <b>${username}</b>! Siz allaqachon botdan foydalanmoqdasiz.`,
      { parse_mode: "HTML", ...mainKeyboard }
    );
  }
});

bot.onText(/\/start/, async (msg) => {
  const userId = msg.from.id;
  const username =
    msg.from.username || msg.from.first_name || "Noma'lum foydalanuvchi";

  findOrCreateUser(userId, username);
  await bot.sendMessage(
    userId,
    `👋 Assalomu alaykum, <b>${username}</b>! Referal tizimiga xush kelibsiz!`,
    { parse_mode: "HTML", ...mainKeyboard }
  );
});

// --- ADMIN BUYRUQLARI ---

bot.onText(/\/admin_stats/, async (msg) => {
  const userId = msg.from.id;

  if (userId !== adminId) {
    await bot.sendMessage(
      userId,
      "Sizga bu buyruqdan foydalanishga ruxsat yo'q."
    );
    return;
  }

  const users = getUsersData();
  const totalUsers = users.length;
  const withdrawnUsersCount = users.filter(
    (u) => u.withdraw_requests && u.withdraw_requests.length > 0
  ).length;
  const totalWithdrawAmount = users.reduce(
    (sum, u) =>
      sum +
      (u.withdraw_requests
        ? u.withdraw_requests.reduce((s, req) => s + req.amount, 0)
        : 0),
    0
  );
  const pendingWithdrawalsCount = users.filter(
    (u) =>
      u.withdraw_requests &&
      u.withdraw_requests.some((req) => req.status === "pending")
  ).length;

  await bot.sendMessage(
    userId,
    `📊 Statistika (Admin Paneli):\n\n` +
      `👤 Jami foydalanuvchilar: <b>${totalUsers}</b>\n` +
      `💸 Pul yechgan foydalanuvchilar: <b>${withdrawnUsersCount}</b>\n` +
      `💰 Jami yechilgan summa: <b>${totalWithdrawAmount} so'm</b>\n` +
      `⏳ Kutilayotgan to'lovlar: <b>${pendingWithdrawalsCount}</b>`,
    { parse_mode: "HTML" }
  );
});

bot.onText(/\/broadcast/, async (msg) => {
  const userId = msg.from.id;

  if (userId !== adminId) {
    await bot.sendMessage(
      userId,
      "Sizga bu buyruqdan foydalanishga ruxsat yo'q."
    );
    return;
  }

  const users = getUsersData();
  let adminUser = users.find((u) => u.id === adminId);
  if (!adminUser) {
    const { user: newAdminUser } = findOrCreateUser(adminId, "Admin");
    adminUser = newAdminUser;
  }

  adminUser.current_action = "awaiting_broadcast_message";
  saveUsersData(users);

  await bot.sendMessage(
    userId,
    "Tarqatish uchun xabar matnini kiriting. Barcha foydalanuvchilarga yuboriladi.\n\nBekor qilish uchun `/cancel` buyrug'ini bosing."
  );
});

// Callback Query (tugmalar bosilganda)
bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id; // Xabar ID'sini olamiz
  const userId = query.from.id;
  const data = query.data;

  try {
    await bot.answerCallbackQuery(query.id);
  } catch (error) {
    console.error("❌ answerCallbackQuery xatosi:", error.message);
  }

  const users = getUsersData();
  let user = users.find((u) => u.id === userId);

  if (!user) {
    await bot.sendMessage(
      chatId,
      "Sizning ma'lumotlaringiz topilmadi. Iltimos, /start buyrug'ini bosing.",
      mainKeyboard
    );
    return;
  }

  // Har bir callback'da current_action ni tozalash
  user.current_action = null;
  saveUsersData(users);

  let newText = ""; // Yangi xabar matni
  let newReplyMarkup = {
    inline_keyboard: [
      [{ text: "Asosiy menyu", callback_data: "go_to_main_menu" }],
    ],
  }; // Yangi tugmalar

  switch (data) {
    case "earn_money":
      const effectiveBotUsername = BOT_USERNAME || (await bot.getMe()).username;
      const referralLink = `https://t.me/${effectiveBotUsername}?start=${userId}`;
      newText = `<b>💸 Pul ishlash:</b>\n\nSizning referal havolangiz:\n<code>${referralLink}</code>\n\nBu havolani do'stlaringizga yuboring. Har bir taklif qilgan obunachi uchun hisobingizga <b>1000 so'm</b> bonus qo'shiladi!`;
      // Bu yerda yangiReplyMarkup avtomatik ravishda "Asosiy menyu" tugmasi bo'ladi
      break;

    case "check_balance":
      newText = `📊 Sizning balansingiz: <b>${user.balance} so'm</b>`;
      // Bu yerda yangiReplyMarkup avtomatik ravishda "Asosiy menyu" tugmasi bo'ladi
      break;

    case "withdraw_money":
      if (user.balance < 5000) {
        newText = "❗ Minimal yechib olish summasi: <b>5000 so'm</b>";
        // Bu yerda yangiReplyMarkup avtomatik ravishda "Asosiy menyu" tugmasi bo'ladi
      } else {
        newText =
          "💳 Karta raqamingizni kiriting (masalan: 8600123456789012):\n\nBekor qilish uchun `/cancel` buyrug'ini bosing.";
        // Karta raqamini kiritish bosqichida tugmalar kerak emas
        newReplyMarkup = { inline_keyboard: [] }; // Bo'sh tugmalar massivi
        user.current_action = "awaiting_card_number"; // Holatni yangilaymiz
        saveUsersData(users);
      }
      break;

    case "go_to_main_menu":
      // "Asosiy menyu" tugmasi bosilganda
      newText = `Assalomu alaykum, <b>${
        user.username || user.id
      }</b>! Asosiy menyu.`;
      newReplyMarkup = mainKeyboard.reply_markup; // Asosiy menyu tugmalarini yuklaymiz
      break;

    default:
      newText = "Noma'lum buyruq. Iltimos, asosiy menyudan foydalaning.";
      newReplyMarkup = mainKeyboard.reply_markup;
      break;
  }

  // Xabarni o'zgartirish
  try {
    await bot.editMessageText(newText, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: "HTML",
      reply_markup: newReplyMarkup, // Yangi tugmalar
    });
  } catch (error) {
    console.error("❌ Xabarni o'zgartirishda xato:", error.message);
    // Agar xabarni o'zgartirishda xato bo'lsa (masalan, xabar juda eski bo'lsa), yangi xabar yuboramiz
    await bot.sendMessage(chatId, newText, {
      parse_mode: "HTML",
      reply_markup: newReplyMarkup, // Yangi tugmalar
    });
  }
});

// Foydalanuvchining matnli xabarlarini qayta ishlash
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text;

  if (
    text &&
    (text.startsWith("/start") ||
      text.startsWith("/admin_stats") ||
      text.startsWith("/broadcast"))
  ) {
    return;
  }

  if (text === "/cancel") {
    const users = getUsersData();
    const user = users.find((u) => u.id === userId);
    if (user) {
      user.current_action = null;
      saveUsersData(users);
      await bot.sendMessage(chatId, "❌ Amal bekor qilindi.", mainKeyboard);
    }
    return;
  }

  const users = getUsersData();
  let user = users.find((u) => u.id === userId);

  if (!user) {
    await bot.sendMessage(
      chatId,
      "Sizning ma'lumotlaringiz topilmadi. Iltimos, /start buyrug'ini bosing.",
      mainKeyboard
    );
    return;
  }

  if (user.current_action === "awaiting_card_number") {
    const cardNumber = text ? text.replace(/\s/g, "") : "";

    if (/^8600\d{12}$/.test(cardNumber)) {
      const currentBalance = user.balance;

      if (currentBalance < 5000) {
        await bot.sendMessage(
          chatId,
          "❗ Minimal yechib olish summasi: <b>5000 so'm</b>. Qaytadan urinish uchun asosiy menyudan foydalaning.",
          { parse_mode: "HTML", ...mainKeyboard }
        );
        user.current_action = null;
        saveUsersData(users);
        return;
      }

      user.withdraw_requests.push({
        amount: currentBalance,
        card: cardNumber,
        timestamp: new Date().toISOString(),
        status: "pending",
      });
      user.balance = 0;
      user.current_action = null;
      saveUsersData(users);

      await bot.sendMessage(
        chatId,
        "✅ So'rovingiz qabul qilindi! To'lov <b>24 soat ichida</b> amalga oshiriladi.",
        { parse_mode: "HTML", ...mainKeyboard }
      );

      await bot
        .sendMessage(
          adminId,
          `🚨 YANGI PUL YECHISH SO'ROVI!\n\nID: <code>${userId}</code>\nUsername: @${
            user.username || "mavjud emas"
          }\nSumma: <b>${currentBalance} so'm</b>\nKarta: <code>${cardNumber}</code>`,
          { parse_mode: "HTML" }
        )
        .catch((err) =>
          console.error(
            `Adminlarga pul yechish xabari yuborishda xato:`,
            err.message
          )
        );
    } else {
      await bot.sendMessage(
        chatId,
        "⚠️ Karta raqami noto'g'ri formatda. Iltimos, 16 raqamli va 8600 bilan boshlanadigan karta raqamini kiriting yoki `/cancel` bosing.",
        { parse_mode: "HTML" }
      );
    }
  } else if (
    userId === adminId &&
    user.current_action === "awaiting_broadcast_message"
  ) {
    if (!text || text.trim() === "") {
      await bot.sendMessage(
        userId,
        "Xabar matni bo'sh bo'lishi mumkin emas. Qaytadan kiriting yoki `/cancel` bosing."
      );
      return;
    }

    user.current_action = null;
    saveUsersData(users);

    const allUsers = getUsersData();
    let sentCount = 0;
    let failedCount = 0;

    for (const u of allUsers) {
      if (u.id === adminId) continue;
      try {
        await bot.sendMessage(u.id, text, { parse_mode: "HTML" });
        sentCount++;
        await new Promise((resolve) => setTimeout(resolve, 50));
      } catch (error) {
        failedCount++;
        console.error(`❌ Xabar yuborishda xato ${u.id}:`, error.message);
      }
    }

    await bot.sendMessage(
      adminId,
      `✅ Xabar yuborish yakunlandi.\n\n${sentCount} ta foydalanuvchiga yuborildi.\n${failedCount} ta xato yuz berdi.`,
      mainKeyboard
    );
  } else {
    await bot.sendMessage(
      chatId,
      "Pul ishlash uchun <b>💸 Pul ishlash</b> buyrug'ini bosing.",
      {
        parse_mode: "HTML",
        reply_markup: mainKeyboard.reply_markup,
      }
    );
  }
});

bot
  .getMe()
  .then((me) => {
    bot.options.username = me.username;
    BOT_USERNAME = me.username;
    console.log(`🚀 Bot ishga tushdi: @${me.username}`);
    if (!process.env.BOT_USERNAME) {
      console.warn(
        "⚠️ .env faylida BOT_USERNAME belgilanmagan. Botning haqiqiy username'i referal havolasi uchun ishlatiladi."
      );
    }
  })
  .catch((err) => {
    console.error("❌ Botni ishga tushirishda xato:", err.message);
  });

bot.on("polling_error", (err) =>
  console.error("❌ Polling xatosi:", err.code, err.message)
);
