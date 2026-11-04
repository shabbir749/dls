let lang = localStorage.getItem('dls_lang') || 'bn';

export function getLang() { return lang; }
export function setLang(l) {
  lang = l;
  localStorage.setItem('dls_lang', l);
}

const dict = {
  'Upcoming': 'আসন্ন',
  'Live': 'লাইভ',
  'Completed': 'সম্পন্ন',
  '1st': '১ম',
  '2nd': '২য়',
  '3rd': '৩য়',
  'TBA': 'নির্ধারিত নয়',
  'Tournament not found': 'টুর্নামেন্ট পাওয়া যায়নি',
  'Sign in': 'সাইন ইন',
  'Home': 'হোম',
  'Host': 'হোস্ট',
  'Ranking': 'র‌্যাঙ্কিং',
  'Profile': 'প্রোফাইল',
  'Tournaments': 'টুর্নামেন্টসমূহ',
  'Teams joined': 'অংশগ্রহণকারী দল',
  'Total prizes': 'মোট প্রাইজপুল',
  'Search tournament or host': 'টুর্নামেন্ট বা হোস্ট খুঁজুন',
  'How it works': 'কীভাবে কাজ করে',
  'Stay safe': 'সতর্কতা',
  'FAQ': 'সাধারণ প্রশ্নাবলী',
  'FREE': 'ফ্রি',
  'Teams': 'টিম',
  'Prize Pool & Management Fee': 'প্রাইজপুল ও ফি',
  'Rules': 'নিয়মাবলী',
  'Confirm & join': 'কনফার্ম ও জয়েন'
};

export function L(key, ...args) {
  let str = (lang === 'bn' && dict[key]) ? dict[key] : key;
  if (args.length) {
    args.forEach((val, i) => {
      str = str.replace(new RegExp(`\\{${i}\\}`, 'g'), val);
    });
  }
  return str;
}
