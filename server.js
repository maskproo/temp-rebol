require('dotenv').config();
const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const methodOverride = require('method-override');
const connectDB = require('./config/db');

const app = express();

// Connect to DB
connectDB();

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use(express.static('public'));

// View engine
app.set('view engine', 'ejs');
app.set('views', './views');
app.use(expressLayouts);
app.set('layout', 'layouts/main');

// Routes
app.use('/', require('./routes/dashboard'));
app.use('/accounts', require('./routes/accounts'));
app.use('/journal', require('./routes/journal'));
app.use('/customers', require('./routes/customers'));
app.use('/invoices', require('./routes/invoices'));
app.use('/expenses', require('./routes/expenses'));
app.use('/reports', require('./routes/reports'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
