
require('dotenv').config();

const express = require('express');

const cors    = require('cors');

const path    = require('path');

const app     = express();



app.use(cors({ origin: '*', credentials: false }));

app.use(express.json());

app.use(express.urlencoded({ extended: true }));



app.use('/api/auth',          require('./routes/auth'));

app.use('/api/villagers',     require('./routes/villagers'));

app.use('/api/scores',        require('./routes/scores'));

app.use('/api/admins',        require('./routes/admins'));

app.use('/api/announcements', require('./routes/announcements'));

app.use('/api/exchange',      require('./routes/exchange'));



app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date() }));



app.use(express.static(path.join(__dirname, 'public')));

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));



app.use((err, req, res, next) => {

  console.error('[ERROR]', err.message);

  res.status(500).json({ code: 500, message: '服务器内部错误' });

});



const PORT = process.env.PORT || 3000;

app.listen(PORT, () => console.log(`罗峪村积分系统后端运行在端口 ${PORT}`));

