function extractArabicMetadata(text) {
  const lines = text
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0 && !/^(\d+|\s+)$/.test(l)); // remove empty or numeric lines

  // Remove lines with legal/disclaimer terms
  const skipKeywords = ['مسئولة عن', 'حقوق النشر', '©', 'www', 'البريد الإلكتروني', 'موقع إلكتروني', 'جميع الحقوق', 'ISBN'];
  const cleanedLines = lines.filter(line => !skipKeywords.some(kw => line.includes(kw)));

  const getByLabel = (labelList) => {
    for (const label of labelList) {
      const line = cleanedLines.find(l => l.includes(label));
      if (line) return line.replace(label, '').replace(/[:\-–]/g, '').trim();
    }
    return '';
  };

  const title = getByLabel(['العنوان', 'عنوان الكتاب', 'عنوان']) ||
    cleanedLines.find(l => /^[\u0600-\u06FF\s«»“”]{10,70}$/.test(l)) || 'Unknown Title';

  const author = getByLabel(['المؤلف', 'تأليف', 'بقلم', 'إعداد']) ||
    cleanedLines.find(l =>
      /^[\u0600-\u06FF\s]{3,40}$/.test(l) &&
      !l.includes('فهرس') &&
      !l.includes('الناشر') &&
      !l.includes('الطبعة')
    ) || 'Unknown Author';

  const publisher = getByLabel(['الناشر', 'دار النشر', 'نشر']) || 'Unknown Publisher';

  const yearMatch = text.match(/\b(13|14|19|20)\d{2}\b/);
  const year = yearMatch ? yearMatch[0] : 'Unknown Year';

  const summary = cleanedLines
    .slice(0, 20)
    .filter(l => l.length > 30 && l.length < 300)
    .join(' ')
    .slice(0, 500) || '[No summary]';

  return {
    title: title.trim(),
    author: author.trim(),
    publisher: publisher.trim(),
    year,
    summary: summary.trim(),
    isbn: '',
    issn: '',
    coauthors: []
  };
}
