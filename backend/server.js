const express = require('express');
const connectDB = require('./config/db');
const cors = require('cors');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const { generalLimiter, authLimiter } = require('./middleware/rateLimiter');

require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use('/api', generalLimiter);

app.get('/api/health', (req, res) => res.json({ success: true, message: 'Stock Management API is running', data: { time: new Date().toISOString() } }));

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/categories', require('./routes/categoryRoutes'));
app.use('/api/brands', require('./routes/brandRoutes'));
app.use('/api/phone-models', require('./routes/phoneModelRoutes'));
app.use('/api/suppliers', require('./routes/supplierRoutes'));
app.use('/api/customers', require('./routes/customerRoutes'));
app.use('/api/sales', require('./routes/saleRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));
app.use('/api/loans', require('./routes/loanRoutes'));
app.use('/api/stock', require('./routes/stockRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/audit-logs', require('./routes/auditLogRoutes'));
app.use('/api/settings', require('./routes/settingRoutes'));

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));
});