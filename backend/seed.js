require('dotenv').config();
const connectDB = require('./config/db');
const { User, Brand, Category, Setting } = require('./models');
const { DEFAULT_PHONE_BRANDS, DEFAULT_CATEGORIES } = require('./utils/constants');

const seed = async () => {
  await connectDB();

  const adminCount = await User.countDocuments({ role: 'SUPER_ADMIN' });
  if (!adminCount) {
    await User.create({
      name: 'System Administrator',
      email: 'admin@stock.com',
      password: 'admin123',
      role: 'SUPER_ADMIN',
    });
    console.log('Created Super Admin → admin@stock.com / admin123');
  }

  const brandCount = await Brand.countDocuments();
  if (!brandCount) {
    await Brand.insertMany(DEFAULT_PHONE_BRANDS.map((name) => ({ name })));
    console.log(`Created ${DEFAULT_PHONE_BRANDS.length} phone brands`);
  }

  const catCount = await Category.countDocuments();
  if (!catCount) {
    for (const c of DEFAULT_CATEGORIES) {
      const parent = await Category.create({ name: c.name });
      if (c.children.length) {
        await Category.insertMany(c.children.map((ch) => ({ name: ch, parent: parent._id })));
      }
    }
    console.log('Created default categories + subcategories');
  }

  const settingCount = await Setting.countDocuments();
  if (!settingCount) {
    await Setting.insertMany([
      { key: 'companyName', value: 'Nsenga Legacy Electronic' },
      { key: 'companyPhone', value: '+250 7XX XXX XXX' },
      { key: 'companyEmail', value: 'info@stockmanagement.rw' },
      { key: 'companyAddress', value: 'Kigali, Rwanda' },
      { key: 'currency', value: 'RWF' },
      { key: 'loanDays', value: 30 },
    ]);
    console.log('Created default settings');
  }

  console.log('Seed complete.');
  process.exit(0);
};

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});