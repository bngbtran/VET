/** Vệt brand constants — one source for the app, the About page and the favicon. */
export const BRAND = {
  name: 'Vệt',
  wordmark: 'VỆT',
  tagline: 'Mỗi hành trình để lại một Vệt.',
  taglineEn: 'Every journey leaves a trace.',
  meaning: 'Dấu vết, vệt dài, đường để lại sau một chuyển động.',
  creator: 'Bùi Ngọc Bảo Trân',
  creatorEmail: 'tranbnb.2004@gmail.com',
} as const;

export const BRAND_COLORS = [
  { name: 'Mực', en: 'Ink', value: '#0b0c0e', role: 'Nền chính — bóng tối của bản đồ' },
  { name: 'Than', en: 'Panel', value: '#111215', role: 'Bề mặt, bảng điều khiển' },
  { name: 'Ngà', en: 'Ivory', value: '#f4f1ea', role: 'Chữ, điểm xuất phát' },
  { name: 'Hổ phách', en: 'Amber', value: '#f2b45a', role: 'Màu của Vệt — điểm nhấn duy nhất' },
  { name: 'Tro', en: 'Ash', value: '#8b8881', role: 'Chữ phụ, nhãn' },
] as const;

export const BRAND_TYPE = [
  { family: 'Fraunces', use: 'Logotype, khẩu hiệu — mềm, có nhịp', sample: 'Mỗi hành trình để lại một Vệt.', mono: false, display: true },
  { family: 'Be Vietnam Pro', use: 'Tên địa danh, tiêu đề, giao diện', sample: 'ĐÀ NẴNG → HUẾ', mono: false, display: false },
  { family: 'JetBrains Mono', use: 'Toạ độ, số liệu, nhãn kỹ thuật', sample: '16.0544° N   108.2022° E', mono: true, display: false },
] as const;
