export const formatIndianNumber = (num) => {
  return Number(num).toLocaleString('en-IN');
};

export const formatCrore = (num) => {
  return `\u20B9${Number(num).toLocaleString('en-IN')}`;
};

export const formatRupeeAuto = (num) => {
  const v = Number(num);
  if (v >= 10000000) {
    return `\u20B9${(v / 10000000).toFixed(2)} crore`;
  }
  return `\u20B9${(v / 100000).toFixed(2)} lakh`;
};
