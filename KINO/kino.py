import asyncio
import json
from aiogram import Bot, Dispatcher, types
from aiogram.types import Message, ReplyKeyboardMarkup, KeyboardButton, InlineKeyboardMarkup, InlineKeyboardButton
from aiogram.filters import Command
from aiogram import F

TOKEN = "7991412037:AAE3lXzplwNiGoIjnPXyeop3LUoQWCyVBuk"
ADMIN_ID = 907402803
MOVIE_FILE = "movies.json"
USER_FILE = "users.json"  # Yangi fayl nomi
CONFIG_FILE = "config.json"  # Kanal ID ni saqlash uchun fayl

bot = Bot(token=TOKEN)
dp = Dispatcher(bot=bot)

# ⚙️ Konfiguratsiyani yuklash
def load_config():
    try:
        with open(CONFIG_FILE, "r", encoding="utf-8") as file:
            return json.load(file)
    except FileNotFoundError:
        return {"channel_id": None}
    except json.JSONDecodeError:
        return {"channel_id": None}

# ⚙️ Konfiguratsiyani saqlash
def save_config(config):
    with open(CONFIG_FILE, "w", encoding="utf-8") as file:
        json.dump(config, file, ensure_ascii=False, indent=4)

config = load_config()
CHANNEL_ID = config.get("channel_id")
adding_channel_id = {}

# 🎬 Fayldan kinolarni yuklash
def load_movies():
    try:
        with open(MOVIE_FILE, "r", encoding="utf-8") as file:
            return json.load(file)
    except FileNotFoundError:
        return {}
    except json.JSONDecodeError:
        return {}

# 🎬 Kinolarni faylga yozish
def save_movies():
    with open(MOVIE_FILE, "w", encoding="utf-8") as file:
        json.dump(movies, file, ensure_ascii=False, indent=4)

# 👤 Fayldan foydalanuvchilarni yuklash
def load_users():
    try:
        with open(USER_FILE, "r", encoding="utf-8") as file:
            return json.load(file)
    except FileNotFoundError:
        return {}
    except json.JSONDecodeError:
        return {}

# 👤 Foydalanuvchilarni faylga yozish
def save_users():
    with open(USER_FILE, "w", encoding="utf-8") as file:
        json.dump(users, file, ensure_ascii=False, indent=4)

movies = load_movies()  # Bot ishga tushganda kinolarni yuklaymiz
users = load_users()  # Bot ishga tushganda foydalanuvchilarni yuklaymiz
adding_movie_code = {}

# 🎬 Asosiy menu
main_menu = ReplyKeyboardMarkup(
    keyboard=[[KeyboardButton(text="🎥 Kinolar ro‘yxati")]],
    resize_keyboard=True
)

admin_menu = ReplyKeyboardMarkup(
    keyboard=[
        [KeyboardButton(text="🎥 Kinolar ro‘yxati")],
        [KeyboardButton(text="🔑 Admin Panel")],
        [KeyboardButton(text="📊 Foydalanuvchilar")],
        [KeyboardButton(text="⚙️ Kanal sozlash")]  # Admin paneliga kanal sozlash tugmasini qo'shamiz
    ],
    resize_keyboard=True
)

@dp.message(Command("start"))
async def start(message: Message):
    user_id = message.from_user.id
    username = message.from_user.username
    first_name = message.from_user.first_name
    last_name = message.from_user.last_name

    if user_id not in users:
        users[user_id] = {
            "username": username,
            "first_name": first_name,
            "last_name": last_name,
            "joined_at": message.date.isoformat()
        }
        save_users()

    if user_id == ADMIN_ID:
        await message.answer("🎬 Salom, admin!", reply_markup=admin_menu)
    else:
        if CHANNEL_ID:
            chat_member = await bot.get_chat_member(chat_id=CHANNEL_ID, user_id=user_id)
            if chat_member.status in ["member", "administrator", "creator"]:
                await message.answer("🎬 Salom! Kino kodini kiriting", reply_markup=main_menu)
            else:
                invite_link = await bot.export_chat_invite_link(chat_id=CHANNEL_ID)
                keyboard = InlineKeyboardMarkup(inline_keyboard=[
                    [InlineKeyboardButton(text=" Kanalga qo‘shilish", url=invite_link)]
                ])
                await message.answer("⚠️ Botdan foydalanish uchun kanalga qo‘shiling:", reply_markup=keyboard)
        else:
            await message.answer("🎬 Salom! Kino kodini kiriting", reply_markup=main_menu)

@dp.message(lambda message: message.text == "🎥 Kinolar ro‘yxati")
async def list_movies(message: Message):
    user_id = message.from_user.id
    if user_id == ADMIN_ID or (CHANNEL_ID and (await bot.get_chat_member(chat_id=CHANNEL_ID, user_id=user_id)).status in ["member", "administrator", "creator"]) or not CHANNEL_ID:
        if not movies:
            return await message.answer("📭 Hozircha kinolar yo‘q.")

        buttons = [[KeyboardButton(text=code)] for code in movies.keys()]
        keyboard = ReplyKeyboardMarkup(keyboard=buttons, resize_keyboard=True)
        await message.answer("📽 Kino kodini tanlang:", reply_markup=keyboard)
    else:
        invite_link = await bot.export_chat_invite_link(chat_id=CHANNEL_ID)
        keyboard = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text=" Kanalga qo‘shilish", url=invite_link)]
        ])
        await message.answer("⚠️ Botdan foydalanish uchun kanalga qo‘shiling:", reply_markup=keyboard)

@dp.message(lambda message: message.text == "🔑 Admin Panel")
async def admin_panel(message: Message):
    if message.from_user.id == ADMIN_ID:
        keyboard = ReplyKeyboardMarkup(
            keyboard=[
                [KeyboardButton(text="➕ Yangi kino qo‘shish")],
                [KeyboardButton(text="📤 Video yuklash")],
                [KeyboardButton(text="📊 Foydalanuvchilar")],
                [KeyboardButton(text="⚙️ Kanal sozlash")],
                [KeyboardButton(text="⬅️ Asosiy menyu")]
            ],
            resize_keyboard=True
        )
        await message.answer("🔑 Admin paneliga xush kelibsiz!", reply_markup=keyboard)
    else:
        await message.answer("❌ Siz admin emassiz!")

@dp.message(lambda message: message.text == "➕ Yangi kino qo‘shish")
async def add_movie_step1(message: Message):
    if message.from_user.id == ADMIN_ID:
        await message.answer("📌 Kino kodi kiriting:")
        adding_movie_code[message.from_user.id] = {"step": "waiting_for_code"}
    else:
        await message.answer("❌ Siz admin emassiz!")

@dp.message(lambda message: message.from_user.id in adding_movie_code and adding_movie_code[message.from_user.id]["step"] == "waiting_for_code")
async def add_movie_step2(message: Message):
    code = message.text
    if code in movies:
        return await message.answer("⚠️ Bunday kod allaqachon bor!")

    adding_movie_code[message.from_user.id]["code"] = code
    adding_movie_code[message.from_user.id]["step"] = "waiting_for_name"
    await message.answer("📌 Kino nomini kiriting:")

@dp.message(lambda message: message.from_user.id in adding_movie_code and adding_movie_code[message.from_user.id]["step"] == "waiting_for_name")
async def add_movie_step3(message: Message):
    name = message.text
    code = adding_movie_code[message.from_user.id]["code"]

    movies[code] = {"name": name, "file_id": None}
    save_movies()  # Kino qo‘shilgandan keyin JSON faylga yozamiz

    del adding_movie_code[message.from_user.id]
    await message.answer(f"✅ Kino '{name}' kodi '{code}' bilan qo‘shildi!")

@dp.message(lambda message: message.text == "📤 Video yuklash")
async def upload_video_step1(message: Message):
    if message.from_user.id == ADMIN_ID:
        await message.answer("📌 Qaysi kod uchun video yuklamoqchisiz?")
        adding_movie_code[message.from_user.id] = {"step": "waiting_for_video_code"}
    else:
        await message.answer("❌ Siz admin emassiz!")

@dp.message(lambda message: message.from_user.id in adding_movie_code and adding_movie_code[message.from_user.id]["step"] == "waiting_for_video_code")
async def upload_video_step2(message: Message):
    code = message.text
    if code not in movies:
        return await message.answer("❌ Bunday kodli kino mavjud emas!")

    adding_movie_code[message.from_user.id]["code"] = code
    adding_movie_code[message.from_user.id]["step"] = "waiting_for_video"
    await message.answer("📌 Endi ushbu kod uchun videoni jo‘nating:")

@dp.message(lambda message: message.from_user.id in adding_movie_code and adding_movie_code[message.from_user.id]["step"] == "waiting_for_video")
async def receive_video(message: Message):
    if not message.video:
        return await message.answer("❌ Iltimos, video yuboring!")

    code = adding_movie_code[message.from_user.id]["code"]
    movies[code]["file_id"] = message.video.file_id
    save_movies()  # Videoni JSON faylga yozamiz

    del adding_movie_code[message.from_user.id]
    await message.answer(f"✅ Kino '{movies[code]['name']}' yuklandi!")

@dp.message(lambda message: message.text in movies)
async def send_movie(message: Message):
    user_id = message.from_user.id
    if user_id == ADMIN_ID or (CHANNEL_ID and (await bot.get_chat_member(chat_id=CHANNEL_ID, user_id=user_id)).status in ["member", "administrator", "creator"]) or not CHANNEL_ID:
        code = message.text
        if movies[code]["file_id"]:
            await message.answer_video(movies[code]["file_id"])
        else:
            await message.answer("⚠️ Kino hali yuklanmagan!")
    else:
        invite_link = await bot.export_chat_invite_link(chat_id=CHANNEL_ID)
        keyboard = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text=" Kanalga qo‘shilish", url=invite_link)]
        ])
        await message.answer("⚠️ Botdan foydalanish uchun kanalga qo‘shiling:", reply_markup=keyboard)

@dp.message(lambda message: message.text == "⬅️ Asosiy menyu")
async def back_to_main(message: Message):
    if message.from_user.id == ADMIN_ID:
        await message.answer("🔙 Asosiy menyu", reply_markup=admin_menu)
    else:
        await message.answer("🔙 Asosiy menyu", reply_markup=main_menu)

@dp.message(lambda message: message.text == "📊 Foydalanuvchilar")
async def list_users(message: Message):
    if message.from_user.id == ADMIN_ID:
        user_count = len(users)
        await message.answer(f"🤖 Botda {user_count} ta foydalanuvchi mavjud.")
    else:
        await message.answer("❌ Siz admin emassiz!")

@dp.message(lambda message: message.text == "⚙️ Kanal sozlash")
async def set_channel_step1(message: Message):
    if message.from_user.id == ADMIN_ID:
        await message.answer("📌 Kanal ID sini kiriting (masalan, -1001234567890):")
        adding_channel_id[message.from_user.id] = {"step": "waiting_for_channel_id"}
    else:
        await message.answer("❌ Siz admin emassiz!")

@dp.message(lambda message: message.from_user.id in adding_channel_id and adding_channel_id[message.from_user.id]["step"] == "waiting_for_channel_id")
async def set_channel_step2(message: Message):
    channel_id = message.text
    try:
        channel_id = int(channel_id)
        config["channel_id"] = channel_id
        global CHANNEL_ID
        CHANNEL_ID = channel_id
        save_config(config)
        await message.answer(f"✅ Kanal ID si saqlandi: {channel_id}")
    except ValueError:
        await message.answer("❌ Kanal ID si noto‘g‘ri formatda. Iltimos, raqam kiriting.")
    finally:
        del adding_channel_id[message.from_user.id]

async def check_subscription(user_id: int):
    if CHANNEL_ID:
        chat_member = await bot.get_chat_member(chat_id=CHANNEL_ID, user_id=user_id)
        return chat_member.status in ["member", "administrator", "creator"]
    return True  # Agar kanal ID si o'rnatilmagan bo'lsa, har doim True qaytaradi

@dp.message(F.text, ~F.from_user.id.in_({ADMIN_ID}), ~Command("start"))
async def check_user_subscription(message: Message):
    if CHANNEL_ID:
        if not await check_subscription(message.from_user.id):
            invite_link = await bot.export_chat_invite_link(chat_id=CHANNEL_ID)
            keyboard = InlineKeyboardMarkup(inline_keyboard=[
                [InlineKeyboardButton(text=" Kanalga qo‘shilish", url=invite_link)]
            ])
            await message.answer("⚠️ Botdan foydalanish uchun kanalga qo‘shiling:", reply_markup=keyboard)
            raise asyncio.CancelledError() # Boshqa handlerlarga o'tmaslik uchun
    # Agar foydalanuvchi obuna bo'lgan bo'lsa, keyingi handlerlarga o'tiladi

async def main():
    await bot.delete_webhook(drop_pending_updates=True)
    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())