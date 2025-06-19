const express = require('express');
const multer = require('multer');
const cors = require('cors');
const pdfParse = require('pdf-parse');

const app = express();
const upload = multer();
app.use(cors());
app.use(express.json());

function isArabic(text) {
  const arabicCount = (text.match(/[\u0600-\u06FF]/g) || []).length;
  return arabicCount > text.length / 10;
}

function extractEnglishMetadata(text) {
  const lines = text.split('\n').map(l => l.trim());
  const title = lines.find(l => l.toLowerCase().includes("title")) || "Unknown Title";
  const author = lines.find(l => l.toLowerCase().includes("author")) || "Unknown Author";
  const publisher = lines.find(l => l.toLowerCase().includes("publisher")) || "Unknown Publisher";
  const year = (text.match(/\b(1[89]|20)\d{2}\b/) || [])[0] || "Unknown Year";
  const summary = lines.filter(l => l.length > 30).join(' ').slice(0, 300);

  return {
    title: title.replace(/.*title[:\-\u2013]*/i, '').trim(),
    author: author.replace(/.*author[:\-\u2013]*/i, '').trim(),
    publisher: publisher.replace(/.*publisher[:\-\u2013]*/i, '').trim(),
    year,
    summary: summary || '[No summary]',
    isbn: '',
    issn: '',
    coauthors: []
  };
}

function extractArabicMetadata(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const safeLine = labelList => {
    for (const label of labelList) {
      const line = lines.find(l => l.includes(label) && l.length < 100);
      if (line) return line.replace(label, '').replace(/[:\-–]/g, '').trim();
    }
    return '';
  };

  const title = safeLine(['العنوان', 'عنوان الكتاب', 'عنوان']) || lines.find(l => /^[\u0600-\u06FF ]{10,}$/.test(l)) || 'Unknown Title';
  const author = safeLine(['المؤلف', 'تأليف', 'بقلم', 'إعداد']) || 'Unknown Author';
  const publisher = safeLine(['الناشر', 'دار النشر']) || 'Unknown Publisher';
  const year = (text.match(/\b(13|14|19|20)\d{2}\b/) || [])[0] || 'Unknown Year';

  const filteredLines = lines.filter(l =>
    !l.includes("هنداوي") &&
    !l.includes("حقوق النشر") &&
    !l.includes("جميع الحقوق")
  );
  const summary = filteredLines.slice(0, 10).filter(l => l.length > 30).join(' ').slice(0, 300) || '[No summary]';

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

function buildMARC(metadata) {
  return `=LDR  00000nam a2200000 a 4500
=001  000000001
=100  1#$a${metadata.author}.
=245  10$a${metadata.title} /$c${metadata.author}.
=264  _1$a[Place not identified] :$b${metadata.publisher},$c${metadata.year}.
=300  ##$a300 pages :$bill. ;$c24 cm.
=336  ##$atext$btxt$2rdacontent
=337  ##$aunmediated$bn$2rdamedia
=338  ##$avolume$bnc$2rdacarrier
=520  ##$a${metadata.summary}
=546  ##$aText in Arabic and/or English.`;
}

app.post('/extract', upload.single('file'), async (req, res) => {
  try {
    const buffer = req.file.buffer;
    const data = await pdfParse(buffer);
    const text = data.text;

    const metadata = isArabic(text)
      ? extractArabicMetadata(text)
      : extractEnglishMetadata(text);

    const mrk = buildMARC(metadata);
    res.json({ mrk, metadata });
  } catch (err) {
    res.status(500).json({ error: 'Extraction failed.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ API listening on port ${PORT}`));
