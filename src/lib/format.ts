const nf = new Intl.NumberFormat("pl-PL");
const nf1 = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 1 });

export const fmt = (n: number) => nf.format(n);

/** Compact SP for small chips: 1 800, 37k, 1,2M */
export const short = (n: number) => (n >= 1e6 ? `${nf1.format(n / 1e6)}M` : n >= 1e4 ? `${Math.round(n / 1e3)}k` : nf.format(n));
