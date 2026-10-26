import {
  ArrowLeft,
  BarChart3,
  Check,
  Download,
  Lamp,
  Lock,
  MessageCircle,
  Notebook,
  PenLine,
  ShoppingBag,
  Sparkles,
  X,
} from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import { DEMO_API, type Flags, getJson, money, postJson } from './api';

// "Acme", the demo customer's own app. Six parts of it are behind FlagFlow flags; nothing here knows
// about FlagFlow beyond the flags it receives.

const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');

interface Product {
  id: string;
  name: string;
  price: number;
  tone: 'sand' | 'ochre' | 'olive' | 'slate';
}

const PRODUCT_ICONS: Record<string, typeof ShoppingBag> = {
  p1: Notebook,
  p2: PenLine,
  p3: ShoppingBag,
  p4: Lamp,
};

const TONES: Record<Product['tone'], string> = {
  sand: 'bg-[#e9dcc3]',
  ochre: 'bg-[#d9a441]',
  olive: 'bg-[#8a9a5b]',
  slate: 'bg-[#5f7380]',
};

type View = 'shop' | 'orders' | 'analytics' | 'checkout';

const button =
  'inline-flex h-10 items-center justify-center gap-2 rounded-[10px] px-4 text-[14px] font-semibold disabled:opacity-50';
const primary = `${button} bg-teal text-teal-ink hover:brightness-110`;
const secondary = `${button} border border-rule bg-card text-text hover:bg-well`;

function Banner() {
  return (
    <div
      role="note"
      className="flex items-center justify-center gap-2 bg-teal px-4 py-2 text-center text-[13px] font-medium text-teal-ink"
    >
      <Sparkles className="size-4 shrink-0" aria-hidden="true" />
      You're in the Acme beta. New features reach you first.
    </div>
  );
}

function Shop({
  bag,
  onAdd,
  onCheckout,
}: {
  bag: string[];
  onAdd: (id: string) => void;
  onCheckout: () => void;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  useEffect(() => {
    void getJson<{ products: Product[] }>('/api/catalog').then(
      (r) => setProducts(r.products),
      () => {},
    );
  }, []);
  const total = bag.reduce((n, id) => n + (products.find((p) => p.id === id)?.price ?? 0), 0);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_260px]">
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 2xl:grid-cols-4">
        {products.map((p) => (
          <li key={p.id} className="flex flex-col rounded-[16px] border border-rule bg-card p-3">
            <div className={cx('grid aspect-[4/3] place-items-center rounded-[12px]', TONES[p.tone])}>
              {(() => {
                const Icon = PRODUCT_ICONS[p.id] ?? ShoppingBag;
                return <Icon className="size-1/3 stroke-[1.25] text-black/45" aria-hidden="true" />;
              })()}
            </div>
            <p className="mt-3 text-[15px] font-semibold">{p.name}</p>
            <p className="text-[14px] text-soft">{money(p.price)}</p>
            <button type="button" onClick={() => onAdd(p.id)} className={`${secondary} mt-3`}>
              Add to bag
            </button>
          </li>
        ))}
      </ul>
      <section aria-labelledby="bag" className="h-fit rounded-[16px] border border-rule bg-card p-4">
        <h2 id="bag" className="flex items-center gap-2 text-[15px] font-semibold">
          <ShoppingBag className="size-4" aria-hidden="true" />
          Your bag
        </h2>
        {bag.length === 0 ? (
          <p className="mt-3 text-[14px] text-soft">Nothing in it yet.</p>
        ) : (
          <>
            <p className="mt-3 text-[14px] text-soft">
              {bag.length} {bag.length === 1 ? 'item' : 'items'} · {money(total)}
            </p>
            <button type="button" onClick={onCheckout} className={`${primary} mt-4 w-full`}>
              Checkout
            </button>
          </>
        )}
      </section>
    </div>
  );
}

function Checkout({
  userId,
  userName,
  bag,
  modern,
  onBack,
  onDone,
}: {
  userId: string;
  userName: string;
  bag: string[];
  modern: boolean;
  onBack: () => void;
  onDone: () => void;
}) {
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<{ orderId: string; total: number; flow: string } | null>(null);
  const [error, setError] = useState('');
  const [paying, setPaying] = useState(false);

  async function pay(e?: FormEvent) {
    e?.preventDefault();
    setPaying(true);
    setError('');
    try {
      setResult(await postJson('/api/checkout', { userId, items: bag }));
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPaying(false);
    }
  }

  if (result) {
    return (
      <div className="max-w-md rounded-[16px] border border-rule bg-card p-6 text-center">
        <span className="mx-auto grid size-11 place-items-center rounded-full bg-teal-soft text-teal">
          <Check className="size-5" aria-hidden="true" />
        </span>
        <h2 className="mt-4 text-[20px] font-semibold">Order {result.orderId} placed</h2>
        <p className="mt-1 text-[14px] text-soft">
          {money(result.total)} · handled by the {result.flow === 'new' ? 'new' : 'classic'} checkout
        </p>
        <button type="button" onClick={onBack} className={`${secondary} mt-5`}>
          Back to shop
        </button>
      </div>
    );
  }

  const back = (
    <button
      type="button"
      onClick={onBack}
      className="mb-4 inline-flex items-center gap-1.5 text-[14px] font-medium text-soft hover:text-text"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      Shop
    </button>
  );

  if (modern) {
    // new_checkout on: one page, saved card, one tap.
    return (
      <div className="max-w-md" data-checkout="new">
        {back}
        <div className="rounded-[20px] border border-rule bg-card p-6">
          <span className="rounded-full bg-teal-soft px-2.5 py-1 text-[12px] font-semibold text-teal">
            New checkout
          </span>
          <h2 className="mt-4 text-[24px] font-semibold tracking-tight">Pay in one step</h2>
          <div className="mt-5 rounded-[12px] bg-well p-4 text-[14px]">
            <p className="font-medium">Visa ending 4242</p>
            <p className="text-soft">Ships to 18 Harbour Lane · arrives Thursday</p>
          </div>
          {error && (
            <p role="alert" className="mt-3 text-[14px] text-[#c2410c]">
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={() => void pay()}
            disabled={paying}
            className={`${primary} mt-5 h-12 w-full text-[15px]`}
          >
            {paying ? 'Paying…' : `Pay ${bag.length} ${bag.length === 1 ? 'item' : 'items'}`}
          </button>
        </div>
      </div>
    );
  }

  // new_checkout off: the classic three-step form.
  const steps = ['Shipping', 'Payment', 'Review'];
  return (
    <div className="max-w-md" data-checkout="classic">
      {back}
      <form
        onSubmit={(e) => (step < 2 ? (e.preventDefault(), setStep(step + 1)) : void pay(e))}
        className="rounded-[16px] border border-rule bg-card p-6"
      >
        <h2 className="text-[17px] font-semibold">Classic checkout</h2>
        <ol className="mt-4 flex gap-2 text-[12px]">
          {steps.map((s, i) => (
            <li
              key={s}
              className={cx(
                'flex-1 border-t-2 pt-2',
                i <= step ? 'border-teal font-semibold' : 'border-rule text-soft',
              )}
            >
              {i + 1}. {s}
            </li>
          ))}
        </ol>
        <div className="mt-5 flex flex-col gap-3 text-[14px]">
          {step === 0 && (
            <>
              <label className="flex flex-col gap-1">
                Full name
                <input
                  defaultValue={userName}
                  className="h-10 rounded-[10px] border border-rule bg-paper px-3"
                />
              </label>
              <label className="flex flex-col gap-1">
                Address
                <input
                  defaultValue="18 Harbour Lane"
                  className="h-10 rounded-[10px] border border-rule bg-paper px-3"
                />
              </label>
            </>
          )}
          {step === 1 && (
            <label className="flex flex-col gap-1">
              Card number
              <input
                defaultValue="4242 4242 4242 4242"
                inputMode="numeric"
                className="h-10 rounded-[10px] border border-rule bg-paper px-3 font-mono"
              />
            </label>
          )}
          {step === 2 && (
            <p className="text-soft">
              {bag.length} {bag.length === 1 ? 'item' : 'items'}, shipping to 18 Harbour Lane.
            </p>
          )}
        </div>
        {error && (
          <p role="alert" className="mt-3 text-[14px] text-[#c2410c]">
            {error}
          </p>
        )}
        <div className="mt-6 flex justify-between">
          <button
            type="button"
            onClick={() => setStep(Math.max(0, step - 1))}
            disabled={step === 0}
            className={secondary}
          >
            Back
          </button>
          <button type="submit" disabled={paying} className={primary}>
            {step < 2 ? 'Next' : paying ? 'Placing…' : 'Place order'}
          </button>
        </div>
      </form>
    </div>
  );
}

function Orders({ userId, canExport }: { userId: string; canExport: boolean }) {
  const [orders, setOrders] = useState<{ id: string; date: string; items: number; total: number }[]>([]);
  useEffect(() => {
    void getJson<{ orders: typeof orders }>(`/api/orders?userId=${encodeURIComponent(userId)}`).then(
      (r) => setOrders(r.orders),
      () => {},
    );
  }, [userId]);

  return (
    <section aria-labelledby="orders" className="rounded-[16px] border border-rule bg-card">
      <header className="flex items-center justify-between gap-3 border-b border-rule px-5 py-4">
        <h2 id="orders" className="text-[17px] font-semibold">
          Orders
        </h2>
        {canExport && (
          <a
            href={`${DEMO_API}/api/orders/export.pdf?userId=${encodeURIComponent(userId)}`}
            className={secondary}
            download
          >
            <Download className="size-4" aria-hidden="true" />
            Export PDF
          </a>
        )}
      </header>
      <ul>
        {orders.map((o) => (
          <li
            key={o.id}
            className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-0.5 border-b border-rule px-5 py-3.5 text-[14px] tabular-nums last:border-b-0 sm:grid-cols-[110px_1fr_90px_80px]"
          >
            <span className="font-mono">{o.id}</span>
            <span className="text-right font-semibold sm:order-last">{money(o.total)}</span>
            <span className="text-soft">{o.date}</span>
            <span className="text-right text-soft sm:text-left">
              {o.items} {o.items === 1 ? 'item' : 'items'}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Analytics({ userId, on }: { userId: string; on: boolean }) {
  const [data, setData] = useState<{
    revenue: number;
    orders: number;
    conversion: number;
    weekly: { week: string; orders: number }[];
  } | null>(null);
  useEffect(() => {
    if (!on) {
      setData(null);
      return;
    }
    void getJson<NonNullable<typeof data>>(`/api/analytics?userId=${encodeURIComponent(userId)}`).then(
      setData,
      () => setData(null),
    );
  }, [on, userId]);

  if (!on) {
    return (
      <div
        className="flex flex-col items-center rounded-[16px] border border-dashed border-rule bg-card px-6 py-14 text-center"
        data-analytics="locked"
      >
        <span className="grid size-11 place-items-center rounded-full bg-well text-soft">
          <Lock className="size-5" aria-hidden="true" />
        </span>
        <h2 className="mt-4 text-[18px] font-semibold">Analytics is locked</h2>
        <p className="mt-1 max-w-[36ch] text-[14px] text-soft">Sales analytics isn't on your plan yet.</p>
      </div>
    );
  }
  if (!data) return <p className="text-[14px] text-soft">Loading analytics…</p>;

  const max = Math.max(...data.weekly.map((w) => w.orders));
  const stats: [string, string][] = [
    ['Revenue', money(data.revenue)],
    ['Orders', String(data.orders)],
    ['Conversion', `${data.conversion}%`],
  ];
  return (
    <div className="flex flex-col gap-4" data-analytics="open">
      <ul className="grid gap-4 sm:grid-cols-3">
        {stats.map(([label, value]) => (
          <li key={label} className="rounded-[16px] border border-rule bg-card p-4">
            <p className="text-[13px] text-soft">{label}</p>
            <p className="mt-1 text-[26px] font-semibold tracking-tight">{value}</p>
          </li>
        ))}
      </ul>
      <section aria-labelledby="weekly" className="rounded-[16px] border border-rule bg-card p-5">
        <h2 id="weekly" className="text-[15px] font-semibold">
          Orders per week
        </h2>
        <div
          className="mt-4 flex h-40 items-end gap-3"
          role="img"
          aria-label={data.weekly.map((w) => `${w.week}: ${w.orders}`).join(', ')}
        >
          {data.weekly.map((w) => (
            <div key={w.week} className="flex flex-1 flex-col items-center gap-2">
              <div
                className="w-full rounded-t-[6px] bg-teal"
                style={{ height: `${(w.orders / max) * 100}%` }}
              />
              <span className="text-[12px] text-soft">{w.week}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Chat({ name }: { name: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="fixed right-5 bottom-5 z-10 flex flex-col items-end gap-3 lg:right-[360px]">
      {open && (
        <div
          role="dialog"
          aria-label="Support chat"
          className="w-72 rounded-[16px] border border-rule bg-card p-4 shadow-xl"
        >
          <div className="flex items-center justify-between">
            <p className="text-[14px] font-semibold">Acme support</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              className="grid size-7 place-items-center rounded-full text-soft hover:bg-well"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
          <p className="mt-3 rounded-[12px] bg-well p-3 text-[14px]">
            Hi {name.split(' ')[0]}, how can we help today?
          </p>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Close support chat' : 'Open support chat'}
        aria-expanded={open}
        className="grid size-13 place-items-center rounded-full bg-teal text-teal-ink shadow-lg hover:brightness-110"
      >
        <MessageCircle className="size-6" aria-hidden="true" />
      </button>
    </div>
  );
}

export function Acme({ userId, userName, flags }: { userId: string; userName: string; flags: Flags }) {
  const [view, setView] = useState<View>('shop');
  const [bag, setBag] = useState<string[]>([]);
  const tabs: { id: Exclude<View, 'checkout'>; label: string; icon?: typeof BarChart3 }[] = [
    { id: 'shop', label: 'Shop' },
    { id: 'orders', label: 'Orders' },
    { id: 'analytics', label: 'Analytics' },
  ];

  return (
    <div
      className={cx('acme relative flex min-h-dvh flex-col', flags.dark_mode && 'dark')}
      data-theme={flags.dark_mode ? 'dark' : 'light'}
    >
      {flags.beta_banner && <Banner />}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-rule px-5 py-4 sm:px-8">
        <span className="text-[20px] font-bold tracking-tight">
          acme<span className="text-teal">.</span>
        </span>
        <nav aria-label="Acme" className="flex gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setView(t.id)}
              aria-current={view === t.id ? 'page' : undefined}
              className={cx(
                'h-9 rounded-[9px] px-3 text-[14px] font-medium',
                view === t.id ? 'bg-well text-text' : 'text-soft hover:text-text',
              )}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <span className="hidden text-[14px] text-soft sm:inline">{userName}</span>
      </header>

      <main className="flex-1 px-5 py-8 sm:px-8">
        <h1 className="mb-6 text-[clamp(1.6rem,3vw,2.1rem)] font-semibold tracking-tight">
          {view === 'shop'
            ? 'Good things for your desk'
            : view === 'orders'
              ? 'Your orders'
              : view === 'analytics'
                ? 'Sales analytics'
                : 'Checkout'}
        </h1>
        {view === 'shop' && (
          <Shop bag={bag} onAdd={(id) => setBag((b) => [...b, id])} onCheckout={() => setView('checkout')} />
        )}
        {view === 'checkout' && (
          <Checkout
            userId={userId}
            userName={userName}
            bag={bag}
            modern={flags.new_checkout}
            onBack={() => setView('shop')}
            onDone={() => setBag([])}
          />
        )}
        {view === 'orders' && <Orders userId={userId} canExport={flags.export_report} />}
        {view === 'analytics' && <Analytics userId={userId} on={flags.analytics_dashboard} />}
      </main>

      {flags.chat_widget && <Chat name={userName} />}
    </div>
  );
}
