require('dotenv').config();
const path = require('path');
const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const methodOverride = require('method-override');
const connectDB = require('./config/db');

const app = express();

// Connect to DB
connectDB().catch(err => {
  console.error('تعذر الاتصال بقاعدة البيانات:', err.message);
  process.exit(1);
});

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use(express.static('public'));
// Front-end libraries referenced by the layout
app.use('/node_modules/bootstrap/dist', express.static(path.join(__dirname, 'node_modules/bootstrap/dist')));
app.use('/node_modules/jquery/dist', express.static(path.join(__dirname, 'node_modules/jquery/dist')));

// View engine
app.set('view engine', 'ejs');
app.set('views', './views');
app.use(expressLayouts);
app.set('layout', 'layouts/main');

// Messages passed through redirects (?error=... / ?success=...)
app.use((req, res, next) => {
  res.locals.flash = {
    error: typeof req.query.error === 'string' ? req.query.error : '',
    success: typeof req.query.success === 'string' ? req.query.success : ''
  };
  next();
});

// Routes
app.use('/', require('./routes/dashboard'));
app.use('/accounts', require('./routes/accounts'));
app.use('/journal', require('./routes/journal'));
app.use('/customers', require('./routes/customers'));
app.use('/invoices', require('./routes/invoices'));
app.use('/expenses', require('./routes/expenses'));
app.use('/reports', require('./routes/reports'));

// 404
app.use((req, res) => {
  res.status(404).render('error', { title: 'غير موجود', message: 'الصفحة المطلوبة غير موجودة' });
});

// Errors (Express 5 forwards rejected promises from async handlers here)
app.use((err, req, res, next) => {
  if (err.name === 'CastError') {
    return res.status(404).render('error', { title: 'غير موجود', message: 'السجل المطلوب غير موجود' });
  }
  console.error(err);
  res.status(500).render('error', { title: 'خطأ', message: 'حدث خطأ في السيرفر: ' + err.message });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
