require('dotenv').config();
const mongoose = require('mongoose');
const Account = require('./models/Account');

const accounts = [
  // Assets (1xxx)
  { code: '1000', name: 'الأصول المتداولة', type: 'asset', description: 'حساب مجمع - الأصول المتداولة' },
  { code: '1100', name: 'الصندوق (نقدية)', type: 'asset', description: 'النقد بالصندوق' },
  { code: '1110', name: 'البنك - الحساب الجاري', type: 'asset', description: 'الحساب البنكي الجاري' },
  { code: '1200', name: 'ذمم مدينة (عملاء)', type: 'asset', description: 'المبالغ المستحقة من العملاء' },
  { code: '1300', name: 'مخزون', type: 'asset', description: 'بضاعة في المستودع' },
  { code: '1400', name: 'مصاريف مدفوعة مقدماً', type: 'asset', description: 'مصاريف دُفعت مسبقاً' },
  { code: '1500', name: 'أصول ثابتة', type: 'asset', description: 'حساب مجمع - الأصول الثابتة' },
  { code: '1510', name: 'أثاث ومعدات', type: 'asset', description: 'أثاث ومعدات المكتب' },
  { code: '1520', name: 'أجهزة وحاسبات', type: 'asset', description: 'أجهزة كمبيوتر ومعدات' },
  { code: '1530', name: 'سيارات', type: 'asset', description: 'السيارات والمركبات' },

  // Liabilities (2xxx)
  { code: '2000', name: 'الالتزامات المتداولة', type: 'liability', description: 'حساب مجمع - الالتزامات المتداولة' },
  { code: '2100', name: 'ذمم دائنة (موردين)', type: 'liability', description: 'المبالغ المستحقة للموردين' },
  { code: '2200', name: 'ضريبة القيمة المضافة المستحقة', type: 'liability', description: 'VAT مستحقة للدفع' },
  { code: '2300', name: 'رواتب مستحقة الدفع', type: 'liability', description: 'رواتب موظفين غير مدفوعة' },
  { code: '2400', name: 'قروض قصيرة الأجل', type: 'liability', description: 'قروض بنكية قصيرة الأجل' },
  { code: '2500', name: 'الالتزامات طويلة الأجل', type: 'liability', description: 'حساب مجمع - الالتزامات طويلة الأجل' },
  { code: '2510', name: 'قروض طويلة الأجل', type: 'liability', description: 'قروض بنكية طويلة الأجل' },

  // Equity (3xxx)
  { code: '3000', name: 'حقوق الملكية', type: 'equity', description: 'حساب مجمع - حقوق الملكية' },
  { code: '3100', name: 'رأس المال', type: 'equity', description: 'رأس مال المنشأة' },
  { code: '3200', name: 'الأرباح المبقاة', type: 'equity', description: 'الأرباح غير الموزعة' },
  { code: '3300', name: 'سحوبات الشريك', type: 'equity', description: 'سحوبات أصحاب المنشأة' },

  // Revenue (4xxx)
  { code: '4000', name: 'الإيرادات', type: 'revenue', description: 'حساب مجمع - الإيرادات' },
  { code: '4100', name: 'إيرادات المبيعات', type: 'revenue', description: 'إيرادات بيع المنتجات والخدمات' },
  { code: '4200', name: 'إيرادات الخدمات', type: 'revenue', description: 'إيرادات تقديم الخدمات' },
  { code: '4300', name: 'إيرادات أخرى', type: 'revenue', description: 'إيرادات متنوعة' },
  { code: '4400', name: 'فوائد بنكية مكتسبة', type: 'revenue', description: 'فوائد على الودائع البنكية' },

  // Expenses (5xxx)
  { code: '5000', name: 'المصاريف', type: 'expense', description: 'حساب مجمع - المصاريف' },
  { code: '5100', name: 'تكلفة البضاعة المباعة', type: 'expense', description: 'تكلفة المنتجات المباعة' },
  { code: '5200', name: 'مصاريف الرواتب', type: 'expense', description: 'رواتب وأجور الموظفين' },
  { code: '5210', name: 'مكافآت وعمولات', type: 'expense', description: 'مكافآت الموظفين والعمولات' },
  { code: '5300', name: 'مصاريف الإيجار', type: 'expense', description: 'إيجار المكاتب والمستودعات' },
  { code: '5400', name: 'مصاريف المرافق', type: 'expense', description: 'كهرباء وماء وإنترنت وهاتف' },
  { code: '5500', name: 'مصاريف التسويق والإعلان', type: 'expense', description: 'تسويق وإعلانات' },
  { code: '5600', name: 'مصاريف الصيانة', type: 'expense', description: 'صيانة المعدات والأجهزة' },
  { code: '5700', name: 'مصاريف النقل والشحن', type: 'expense', description: 'مصاريف التوصيل والشحن' },
  { code: '5800', name: 'مصاريف الاستهلاك', type: 'expense', description: 'استهلاك الأصول الثابتة' },
  { code: '5900', name: 'مصاريف بنكية وفوائد', type: 'expense', description: 'عمولات وفوائد بنكية' },
  { code: '5950', name: 'مصاريف ضريبية', type: 'expense', description: 'الضرائب المدفوعة' },
  { code: '5990', name: 'مصاريف متنوعة', type: 'expense', description: 'مصاريف أخرى متنوعة' },
];

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('متصل بقاعدة البيانات...');

  let created = 0, skipped = 0;
  for (const acc of accounts) {
    const exists = await Account.findOne({ code: acc.code });
    if (exists) {
      skipped++;
      continue;
    }
    await Account.create(acc);
    created++;
  }

  console.log(`✅ تم إنشاء ${created} حساب | تم تخطي ${skipped} حساب موجود`);
  await mongoose.disconnect();
}

seed().catch(err => {
  console.error('❌ خطأ:', err.message);
  process.exit(1);
});
