function cleanText(value) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

module.exports = {
  cleanText,
};
