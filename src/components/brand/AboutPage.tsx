import { useEffect, useRef, type ReactNode } from 'react';
import { TRANSPORT, TRANSPORT_MODES } from '../../models/transport';
import { CloseIcon, TransportIcon } from '../ui/icons';
import { BRAND, BRAND_COLORS, BRAND_TYPE } from './brand';
import { AppIcon, CreatorLink, VMark, Wordmark } from './Logo';

const FLOW = ['Địa điểm', 'Lộ trình', 'Vệt', 'Chuyển động', 'Video'];

const PRINCIPLES = [
  { title: 'Bản đồ là khung tranh', body: 'Giao diện lùi lại phía sau. Thứ nổi bật nhất trên màn hình luôn là đường đi.' },
  { title: 'Lộ trình là Vệt', body: 'Một nét duy nhất, màu hổ phách, kéo dài sau phương tiện — từ điểm đi tới điểm đến.' },
  { title: 'Chuyển động kể chuyện', body: 'Camera mở cảnh, bám theo, chậm lại khi tới nơi rồi lùi xa để thấy trọn hành trình.' },
  { title: 'Video giữ lại hành trình', body: 'Mỗi khung hình được dựng chính xác theo thời gian, ngay trong trình duyệt.' },
];

function Label({ children }: { children: ReactNode }) {
  return <h2 className="mb-6 font-mono text-[11px] tracking-[0.28em] text-muted">{children}</h2>;
}

export function AboutPage({ onClose }: { onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="scroll-quiet fixed inset-0 z-50 overflow-y-auto bg-ink" role="dialog" aria-modal="true" aria-labelledby="about-title">
      <div className="sticky top-0 z-10 flex h-12 items-center justify-between border-b border-line bg-ink/90 px-5 backdrop-blur">
        <Wordmark className="text-[19px]" />
        <div className="flex items-center gap-3">
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="flex items-center gap-2 rounded-md px-3 py-1.5 text-[12px] text-muted ring-1 ring-line hover:text-fg"
          >
            Quay lại trình biên tập <CloseIcon size={13} />
          </button>
        </div>
      </div>

      <main className="mx-auto max-w-[920px] px-6">
        {/* Hero */}
        <section className="py-24">
          <h1 id="about-title" className="mb-10 text-[72px] leading-none">
            <Wordmark />
          </h1>
          <p className="font-display max-w-[640px] text-[34px] italic leading-snug">{BRAND.tagline}</p>
          <p className="mt-3 text-[15px] text-muted">{BRAND.taglineEn}</p>
          <p className="mt-10 max-w-[600px] text-[15px] leading-relaxed text-fg/80">
            <span className="font-semibold text-fg">Vệt</span> <span className="text-muted">(danh từ)</span> — {BRAND.meaning}{' '}
            Vệt biến những nơi bạn đã đi qua thành một đoạn phim bản đồ: chọn điểm đi, điểm đến, phương tiện, và xem hành
            trình tự vẽ mình thành một nét sáng.
          </p>
        </section>

        {/* Flow */}
        <section className="border-t border-line py-16">
          <Label>CÁCH HOẠT ĐỘNG</Label>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3 text-[20px] font-medium">
            {FLOW.map((step, i) => (
              <span key={step} className="flex items-center gap-4">
                <span className={step === 'Vệt' ? 'text-accent' : ''}>{step}</span>
                {i < FLOW.length - 1 && <span className="h-px w-10 bg-gradient-to-r from-accent/20 to-accent" />}
              </span>
            ))}
          </div>
          <div className="mt-12 grid gap-x-12 gap-y-8 sm:grid-cols-2">
            {PRINCIPLES.map((p) => (
              <div key={p.title}>
                <h3 className="mb-2 text-[15px] font-semibold">{p.title}</h3>
                <p className="text-[14px] leading-relaxed text-muted">{p.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Brand identity */}
        <section className="border-t border-line py-16">
          <Label>NHẬN DIỆN THƯƠNG HIỆU</Label>

          <h3 className="mb-4 text-[15px] font-semibold">Biểu tượng</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="grid h-44 place-items-center rounded-lg bg-panel ring-1 ring-line">
              <Wordmark className="text-[48px]" />
            </div>
            <div className="grid h-44 place-items-center rounded-lg bg-panel text-[84px] ring-1 ring-line">
              <VMark />
            </div>
            <div className="grid h-44 place-items-center gap-0 rounded-lg bg-[#f4f1ea] ring-1 ring-line">
              <span className="flex items-end gap-4">
                <AppIcon size={64} />
                <AppIcon size={32} />
                <AppIcon size={16} />
              </span>
            </div>
          </div>
          <p className="mt-4 max-w-[640px] text-[14px] leading-relaxed text-muted">
            Chữ <span className="text-accent">V</span> chính là một hành trình: một điểm rỗng nơi bắt đầu, một nét liền
            lượn xuống, bo tròn ở đáy rồi vươn lên — đậm dần theo quãng đường — và một điểm hổ phách đặc nơi đến. V màu hổ phách — màu của Vệt; <span className="text-fg">ỆT</span>{' '}
            màu ngà, chữ Fraunces bo mềm, giữ nguyên dấu tiếng Việt. Riêng chữ V được dùng làm biểu tượng ứng dụng và favicon.
          </p>

          <h3 className="mb-4 mt-14 text-[15px] font-semibold">Màu sắc</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {BRAND_COLORS.map((c) => (
              <div key={c.value} className="overflow-hidden rounded-lg ring-1 ring-line">
                <div className="h-24" style={{ background: c.value }} />
                <div className="bg-panel p-3">
                  <div className="text-[13px] font-semibold">
                    {c.name} <span className="font-normal text-muted">· {c.en}</span>
                  </div>
                  <div className="mt-0.5 font-mono text-[11px] uppercase text-muted">{c.value}</div>
                  <div className="mt-2 text-[11.5px] leading-snug text-faint">{c.role}</div>
                </div>
              </div>
            ))}
          </div>

          <h3 className="mb-4 mt-14 text-[15px] font-semibold">Kiểu chữ</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            {BRAND_TYPE.map((t) => (
              <div key={t.family} className="rounded-lg bg-panel p-6 ring-1 ring-line">
                <div className={`text-[20px] ${t.display ? 'font-display italic' : t.mono ? 'font-mono font-medium' : 'font-semibold tracking-[0.12em]'}`}>{t.sample}</div>
                <div className="mt-5 text-[13px] font-semibold">{t.family}</div>
                <div className="text-[12px] text-muted">{t.use}</div>
              </div>
            ))}
          </div>

          <h3 className="mb-4 mt-14 text-[15px] font-semibold">Phương tiện</h3>
          <div className="flex flex-wrap gap-6 text-muted">
            {TRANSPORT_MODES.map((m) => (
              <div key={m} className="flex flex-col items-center gap-2">
                <TransportIcon mode={m} size={26} />
                <span className="text-[11px]">{TRANSPORT[m].label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Privacy */}
        <section className="border-t border-line py-16">
          <Label>RIÊNG TƯ</Label>
          <p className="max-w-[640px] text-[14px] leading-relaxed text-muted">
            Vệt không có tài khoản, không quảng cáo, không theo dõi. Hành trình được lưu ngay trong trình duyệt của bạn và
            video được dựng trên máy của bạn — không tải lên đâu cả. Chỉ toạ độ và từ khoá tìm kiếm được gửi tới các dịch vụ
            bản đồ khi cần.
          </p>
          <p className="mt-6 text-[12px] leading-relaxed text-faint">
            Dữ liệu bản đồ © OpenStreetMap contributors · CARTO · OpenFreeMap. Tìm kiếm: Photon (komoot). Chỉ đường: OSRM
            (FOSSGIS).
          </p>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[920px] flex-wrap items-center justify-between gap-3 px-6 py-8 text-[12.5px] text-muted">
          <span>
            Tạo bởi: <CreatorLink className="text-[14px]" />
          </span>
          <span className="text-faint">{BRAND.tagline}</span>
        </div>
      </footer>
    </div>
  );
}
