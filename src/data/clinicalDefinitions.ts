import { AngleInfo, StageInfo } from '../types';

export const CLINICAL_ANGLES: AngleInfo[] = [
  {
    id: 'frontal',
    labelFa: 'روبه‌رو کامل (Frontal)',
    labelEn: 'Frontal (0°)',
    degrees: '0°',
    iconName: 'User',
    descriptionFa: 'بررسی تقارن پره‌ها، خطوط پشتی بینی و نوک'
  },
  {
    id: 'profile_right',
    labelFa: 'نیم‌رخ راست (Right Profile)',
    labelEn: 'Right Profile (90°)',
    degrees: '90° R',
    iconName: 'ChevronRight',
    descriptionFa: 'بررسی قوس دورسوم، پروجکشن و زاویه نازولبیال'
  },
  {
    id: 'profile_left',
    labelFa: 'نیم‌رخ چپ (Left Profile)',
    labelEn: 'Left Profile (90°)',
    degrees: '90° L',
    iconName: 'ChevronLeft',
    descriptionFa: 'بررسی قوز استخوانی و ساپورت کلوملا چپ'
  },
  {
    id: 'oblique_right',
    labelFa: 'مایل سه‌چهارم راست (Right Oblique)',
    labelEn: 'Right Oblique (45°)',
    degrees: '45° R',
    iconName: 'CornerUpRight',
    descriptionFa: 'بررسی خط پشتی بینی و ارتباط دورسوم با گونه'
  },
  {
    id: 'oblique_left',
    labelFa: 'مایل سه‌چهارم چپ (Left Oblique)',
    labelEn: 'Left Oblique (45°)',
    degrees: '45° L',
    iconName: 'CornerUpLeft',
    descriptionFa: 'بررسی زاویه مایل و تقارن قوس لترال'
  },
  {
    id: 'basal',
    labelFa: 'قاعده / زیر کلوملا (Basal / Worm\'s Eye)',
    labelEn: 'Basal View',
    degrees: 'Submental',
    iconName: 'Triangle',
    descriptionFa: 'مثلث آلار، سپتوم قدامی، اندازه سوراخ‌ها و کلوملا'
  },
  {
    id: 'cephalic',
    labelFa: 'نمای از بالا (Sky / Cephalic)',
    labelEn: 'Cephalic (Bird\'s eye)',
    degrees: 'Top-Down',
    iconName: 'Eye',
    descriptionFa: 'انحرافات محوری و پهنای استخوان‌های بینی'
  }
];

export const SURGERY_STAGES: StageInfo[] = [
  {
    id: 'pre_op',
    labelFa: 'قبل عمل',
    labelEn: 'Pre-Op',
    colorClass: 'bg-rose-50 text-rose-700 border-rose-200',
    descriptionFa: 'قبل از جراحی'
  },
  {
    id: 'intra_op',
    labelFa: 'حین عمل',
    labelEn: 'Intra-Op',
    colorClass: 'bg-amber-50 text-amber-700 border-amber-200',
    descriptionFa: 'اتاق عمل'
  },
  {
    id: 'immediate_post',
    labelFa: 'پایان عمل',
    labelEn: 'Immediate Post-Op',
    colorClass: 'bg-emerald-50 text-emerald-800 border-emerald-300',
    descriptionFa: 'بلافاصله پس از بخیه'
  },
  {
    id: 'cast_removal',
    labelFa: 'برداشتن گچ',
    labelEn: 'Cast Removal',
    colorClass: 'bg-teal-50 text-teal-800 border-teal-200',
    descriptionFa: 'روز ۷ تا ۱۰'
  },
  {
    id: '1_month',
    labelFa: '۱ ماهه',
    labelEn: '1 Month',
    colorClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    descriptionFa: '۱ ماه پس از عمل'
  },
  {
    id: '3_months',
    labelFa: '۳ ماهه',
    labelEn: '3 Months',
    colorClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    descriptionFa: '۳ ماه پس از عمل'
  },
  {
    id: '6_months',
    labelFa: '۶ ماهه',
    labelEn: '6 Months',
    colorClass: 'bg-emerald-100 text-emerald-900 border-emerald-400',
    descriptionFa: '۶ ماه پس از عمل'
  },
  {
    id: '1_year',
    labelFa: '۱ ساله',
    labelEn: '1 Year Final',
    colorClass: 'bg-emerald-600 text-white border-emerald-600',
    descriptionFa: 'نتیجه نهایی'
  },
  {
    id: 'revision',
    labelFa: 'ترمیمی',
    labelEn: 'Revision',
    colorClass: 'bg-orange-50 text-orange-700 border-orange-200',
    descriptionFa: 'ترمیمی'
  }
];

export const QUICK_CLINICAL_TAGS = [
  'کاهش قوز استخوانی (Hump Reduction)',
  'چرخش به سمت بالا (Tip Rotation 100°+)',
  'گرافت ستون کلوملا (Columellar Strut)',
  'باریک کردن آلار (Alar Base Resection)',
  'اصلاح انحراف سپتوم (Septoplasty)',
  'قوس طبیعی نیمه‌فانتزی (Natural Curve)',
  'سوپراتیپ بریک ملایم (Supratip Break)',
  'پوست ضخیم گوشتی (Thick Sebaceous Skin)',
  'استئوتومی لترال بسته (Lateral Osteotomy)',
  'گرافت شیلد نوک (Shield Graft)'
];
