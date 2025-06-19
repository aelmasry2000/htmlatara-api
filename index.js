const express = require('express');
const multer = require('multer');
const cors = require('cors');
const pdfParse = require('pdf-parse');

const app = express();
const upload = multer();
app.use(cors());
app.use(express.json());

function isArabic(text) {
  const arabicChars = (text.match(/[\u0600-\u06FF]/g) || []).length;
  return arabicChars > text.length / 10;
}

function clean(text) {
  return (text || '').replace(/\s+/g, ' ').replace(/[\x00-\x1F\x7F]/g, '').trim();
}

function extractMetadata(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length);
  const isAR = isArabic(text);
  const getFirstMatch = (patterns) => {
    for (let p of patterns) {
      const line = lines.find(l => l.includes(p));
      if (line) return line.replace(p, '').replace(/[:\-–]/g, '').trim();
    }
    return '';
  };

  let title = '', author = '', publisher = '';
  if (isAR) {
    title = getFirstMatch(['العنوان', 'عنوان الكتاب']) || lines.find(l => /^[\u0600-\u06FF ]{10,}$/.test(l)) || 'عنوان غير معروف';
    author = getFirstMatch(['تأليف', 'بقلم', 'إعداد']) || 'مؤلف غير معروف';
    publisher = getFirstMatch(['الناشر', 'دار النشر']) || 'الناشر غير معروف';
  } else {
    title = getFirstMatch(['Title', 'title']) || 'Unknown Title';
    author = getFirstMatch(['Author', 'author']) || 'Unknown Author';
    publisher = getFirstMatch(['Publisher', 'publisher']) || 'Unknown Publisher';
  }

  const year = (text.match(/\b(1[89]|20|13|14)\d{2}\b/) || [])[0] || (isAR ? 'سنة غير معروفة' : 'Unknown Year');
  const isbn = (text.match(/ISBN[:\s]*([\d\-]+)/i) || [])[1] || '';
  const summary = clean(text.split(/\n\n+/).reduce((a, b) => b.length > a.length ? b : a, '').slice(0, 300));

  return {
    title: clean(title),
    author: clean(author),
    publisher: clean(publisher),
    year,
    isbn,
    issn: '',
    coauthors: [],
    summary
  };
}

function buildMARC(meta) {
  const now = new Date();
  const controlDate = now.toISOString().replace(/[-T:.Z]/g, '').slice(0, 14);
  const shortDate = now.toISOString().slice(0, 10).replace(/-/g, '');
  const { title, author, publisher, year, summary, isbn } = meta;

  return `=LDR  00000nam a2200000 a 4500
=001  000000001
=005  ${controlDate}.0
=008  ${shortDate}s${year}\\xx\\ara\\||\|
=020  ## $a${isbn || '[ISBN not found]'}
=041  0# $aara
=100  1# $a${author}.
=245  10 $a${title} / $c${author}.
=246  3# $a${title.split(' ').slice(0, 4).join(' ')}
=250  ## $aFirst edition.
=264  _1 $a[Place not identified] : $b${publisher}, $c${year}.
=300  ## $a300 pages : $bill. ; $c24 cm.
=336  ## $atext $btxt $2rdacontent
=337  ## $aunmediated $bn $2rdamedia
=338  ## $avolume $bnc $2rdacarrier
=500  ## $aCataloged using automated RDA extraction.
=520  ## $a${summary || '[No summary found]'}
=546  ## $aText in Arabic.`;
}

app.post('/extract', upload.single('file'), async (req, res) => {
  try {
    const buffer = req.file.buffer;
    const data = await pdfParse(buffer);
    const text = data.text;
    const metadata = extractMetadata(text);
    const mrk = buildMARC(metadata);
    res.json({ mrk, metadata });
  } catch (e) {
    res.status(500).json({ error: 'Extraction failed.', details: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ API listening on port ${PORT}`));
