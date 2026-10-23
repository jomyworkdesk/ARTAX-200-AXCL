const UAE_TIME_ZONE = "Asia/Dubai";

const toDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatUaeDate = (value, options = {}) => {
  const date = toDate(value);
  if (!date) return "-";

  return new Intl.DateTimeFormat("en-AE", {
    timeZone: UAE_TIME_ZONE,
    day: "2-digit",
    month: options.numericMonth ? "2-digit" : "short",
    year: "numeric"
  }).format(date);
};

const formatUaeDateTime = (value) => {
  const date = toDate(value);
  if (!date) return "-";

  return new Intl.DateTimeFormat("en-AE", {
    timeZone: UAE_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  }).format(date);
};

module.exports = {
  formatUaeDate,
  formatUaeDateTime
};
