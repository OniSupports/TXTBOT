const express = require('express');
const multer = require('multer');
const mongoose = require('mongoose');
const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');
const os = require('os');
const path = require('path');

const BOT_TOKEN = '7751220873:AAES2itIfDg-uRxPd-7zKrt8rOBq9adkMdg';
const MONGO_URI = 'mongodb+srv://toshidev0:zcode22107@dbtxt.3dxoaud.mongodb.net/?retryWrites=true&w=majority&appName=DBTXT';
const PAGE_SIZE = 5;
const ADMIN_ID = '6344941266';

const app = express();
const bot = new Telegraf(BOT_TOKEN);

mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

const FileSchema = new mongoose.Schema({
  name: String,
  content: String,
  password: String
});
const File = mongoose.model('File', FileSchema);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const storage = multer.memoryStorage();
const upload = multer({ storage });

app.post('/upload', upload.single('file'), async (req, res) => {
  const { password } = req.body;
  const content = req.file.buffer.toString('utf-8');
  const file = new File({ name: req.file.originalname, content, password });
  await file.save();
  res.send('✅ File uploaded successfully');
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const userSessions = {};
const userPages = {};
const receiptSessions = {};

bot.start((ctx) => {
  ctx.replyWithPhoto('https://i.ibb.co/67hK6bLc/ONILOGO.jpg', {
    caption: '𝐖𝐄𝐋𝐂𝐎𝐌𝐄 𝐓𝐎 𝐎𝐍𝐈𝐂𝐇𝐀𝐍 𝐁𝐎𝐓 𝐒𝐇𝐎𝐏\n\n𝐏𝐑𝐄𝐌𝐈𝐔𝐌 𝐓𝐗𝐓\n\n𝐔𝐒𝐄𝐑𝐍𝐀𝐌𝐄 𝐀𝐍𝐃 𝐏𝐀𝐒𝐒\n\n𝐓𝐎 𝐒𝐄𝐄 𝐓𝐇𝐄 𝐀𝐕𝐀𝐈𝐋𝐀𝐁𝐋𝐄 𝐓𝐗𝐓 𝐉𝐔𝐒𝐓 𝐂𝐎𝐌𝐌𝐀𝐍𝐃 𝐓𝐇𝐄 " /files " 𝐀𝐕𝐀𝐈𝐋 𝐍𝐎𝐖 𝐁𝐀𝐒𝐈𝐂 𝐓𝐎 𝐔𝐒𝐄 𝐉𝐔𝐒𝐓 𝐒𝐄𝐍𝐃 𝐓𝐇𝐄 𝐑𝐄𝐂𝐄𝐈𝐏𝐓 𝐓𝐎 𝐓𝐇𝐄 𝐁𝐎𝐓 𝐓𝐇𝐀𝐍𝐊 𝐘𝐎𝐔𝐔𝐔𝐔𝐔\n\n𝐃𝐄𝐕𝐄𝐋𝐎𝐏𝐄𝐑 @Nighative '
  });

  const userId = ctx.from.id;
  const username = ctx.from.username || 'N/A';
  const name = `${ctx.from.first_name} ${ctx.from.last_name || ''}`;
  const userMessage = `🆕 New user started the bot!\n\nID: ${userId}\nUsername: @${username}\nName: ${name}`;

  bot.telegram.sendMessage(ADMIN_ID, userMessage);
});

bot.command('files', async (ctx) => {
  const userId = ctx.from.id;
  userPages[userId] = 0;
  await sendFilesPage(ctx, userId, 0);
});

bot.on('callback_query', async (ctx) => {
  const userId = ctx.from.id;
  const data = ctx.callbackQuery.data;

  if (data.startsWith('PAGE_')) {
    const direction = data.split('_')[1];
    userPages[userId] = userPages[userId] || 0;
    if (direction === 'NEXT') userPages[userId]++;
    if (direction === 'BACK') userPages[userId]--;
    await updateFilesPage(ctx, userId, userPages[userId], ctx.callbackQuery.message.message_id);
    return ctx.answerCbQuery();
  }

  if (data.startsWith('FILE_')) {
    const fileId = data.split('_')[1];
    userSessions[userId] = { fileId, waitingForReceipt: true };
    ctx.answerCbQuery();
    await ctx.replyWithPhoto('https://i.ibb.co/WNQtjwmc/toshicashg.jpg', {
      caption: '📸 𝐀𝐅𝐓𝐄𝐑 𝐏𝐀𝐘𝐌𝐄𝐍𝐓, 𝐑𝐄𝐏𝐋𝐘 𝐇𝐄𝐑𝐄 𝐖𝐈𝐓𝐇 𝐘𝐎𝐔𝐑 𝐑𝐄𝐂𝐄𝐈𝐏𝐓.'
    });
  }
});

bot.on('photo', async (ctx) => {
  const userId = ctx.from.id;
  const session = userSessions[userId];
  if (!session || !session.waitingForReceipt || !session.fileId) return;

  const file = await File.findById(session.fileId);
  const userName = ctx.from.username || `${ctx.from.first_name} ${ctx.from.last_name || ''}`;
  const caption = `🧾 New payment receipt from @${userName} (ID: ${userId})\nFile: ${file?.name || 'Unknown'}\n\nReply with the password to release the file.`;

  const photo = ctx.message.photo[ctx.message.photo.length - 1];
  const fileId = photo.file_id;

  const sentMsg = await ctx.telegram.sendPhoto(ADMIN_ID, fileId, { caption });

  receiptSessions[sentMsg.message_id] = {
    userId,
    fileId: session.fileId
  };

  await ctx.reply('✅ 𝐑𝐄𝐂𝐄𝐈𝐏𝐓 𝐑𝐄𝐂𝐄𝐈𝐕𝐄 ,𝐏𝐋𝐄𝐀𝐒𝐄 𝐖𝐀𝐈𝐓 𝐓𝐎 𝐓𝐇𝐄 𝐀𝐃𝐌𝐈𝐍 𝐓𝐎 𝐀𝐏𝐑𝐎𝐕𝐄 𝐘𝐎𝐔𝐑 𝐏𝐀𝐘𝐌𝐄𝐍𝐓.');
  delete userSessions[userId];
});

bot.on('message', async (ctx) => {
  const isAdmin = ctx.from.id.toString() === ADMIN_ID.toString();
  if (!isAdmin || !ctx.message.reply_to_message || !ctx.message.text) return;

  const repliedMsgId = ctx.message.reply_to_message.message_id;
  const password = ctx.message.text;
  const session = receiptSessions[repliedMsgId];

  if (!session) return;

  const { userId, fileId } = session;
  const file = await File.findById(fileId);
  if (!file) {
    ctx.reply('❌ File not found or already deleted.');
    return;
  }

  if (file.password !== password) {
    ctx.reply('❌ Incorrect password for that file.');
    return;
  }

  const tempPath = path.join(os.tmpdir(), `${Date.now()}-${file.name}`);
  fs.writeFileSync(tempPath, file.content);

  await ctx.telegram.sendDocument(userId, {
    source: tempPath,
    filename: file.name
  });

  await ctx.telegram.sendMessage(userId, '✅ 𝐀𝐃𝐌𝐈𝐍 𝐂𝐎𝐍𝐅𝐈𝐑𝐌𝐄𝐃 𝐘𝐎𝐔𝐑 𝐏𝐀𝐘𝐌𝐄𝐍𝐓 ,𝐘𝐎𝐔𝐑 𝐓𝐗𝐓 𝐖𝐈𝐋𝐋 𝐁𝐄 𝐑𝐄𝐋𝐄𝐀𝐒𝐄𝐃');
  await File.deleteOne({ _id: file._id });
  fs.unlinkSync(tempPath);

  await ctx.telegram.deleteMessage(ADMIN_ID, repliedMsgId);

  delete receiptSessions[repliedMsgId];
});

async function sendFilesPage(ctx, userId, page) {
  const totalFiles = await File.countDocuments();
  const totalPages = Math.ceil(totalFiles / PAGE_SIZE);
  const skip = page * PAGE_SIZE;
  const files = await File.find().skip(skip).limit(PAGE_SIZE);
  if (!files.length) return ctx.reply('⚠️ No files found on this page.');

  const buttons = files.map(file => [Markup.button.callback(file.name, `FILE_${file._id}`)]);
  buttons.push([
    Markup.button.callback('⬅️ Back', 'PAGE_BACK'),
    Markup.button.callback('➡️ Next', 'PAGE_NEXT')
  ]);

  ctx.reply(`𝐏𝐀𝐆𝐄  ${page + 1}𝐎𝐅  ${totalPages}`, Markup.inlineKeyboard(buttons));
}

async function updateFilesPage(ctx, userId, page, messageId) {
  const totalFiles = await File.countDocuments();
  const totalPages = Math.ceil(totalFiles / PAGE_SIZE);
  const skip = page * PAGE_SIZE;
  const files = await File.find().skip(skip).limit(PAGE_SIZE);
  if (!files.length) return ctx.reply('⚠️ No files found on this page.');

  const buttons = files.map(file => [Markup.button.callback(file.name, `FILE_${file._id}`)]);
  buttons.push([
    Markup.button.callback('⬅️ Back', 'PAGE_BACK'),
    Markup.button.callback('➡️ Next', 'PAGE_NEXT')
  ]);

  await ctx.telegram.editMessageText(ctx.chat.id, messageId, undefined, `📄𝐏𝐀𝐆𝐄 e ${page + 1}𝐎𝐅f ${totalPages}`, {
    reply_markup: Markup.inlineKeyboard(buttons).reply_markup
  });
}

bot.launch();
app.listen(3000, () => console.log('Web server running at http://localhost:3000'));
