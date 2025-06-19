const express = require('express');
const multer = require('multer');
const cors = require('cors');
const pdfParse = require('pdf-parse');

const app = express();
const upload = multer();
app.use(cors());
app.use(express.json());

function isArabic(text) {
  const arabicCount = (text.match(/[؀-ۿ]/g) || []).length;
  return arabicCount > text.length / 10;
}

function extractArabicMetadata(text) {
  const lines = text.split('\n').map(l => l.trim());
  const getByLabel = (labelList) => {
    for (const label of labelList) {
      const line = lines.find(l => l.includes(label));
      if (line) return line.replace(label, '').replace(/[:\-–]/g, '').trim();
    }
    return '';
  };

  const title = getByLabel(['العنوان', 'عنوان الكتاب', 'عنوان']) || lines.find(l => /^[\u0600-\u06FF ]{10,}$/.test(l)) || 'Unknown Title';
  const author = getByLabel(['المؤلف', 'تأليف', 'بقلم', 'إعداد']) || 'Unknown Author';
  const publisher = getByLabel(['الناشر', 'دار النشر']) || 'Unknown Publisher';
  const year = (text.match(/\b(13|14|19|20)\d{2}\b/) || [])[0] || 'Unknown Year';
  const summary = lines.slice(0, 10).filter(l => l.length > 30).join(' ').slice(0, 300) || '[No summary]';

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
=520  ##$a${metadata.summary}
=546  ##$aText in Arabic.`;
}

function buildJSON(metadata) {
  return JSON.stringify(metadata, null, 2);
}

function buildXML(metadata) {
  return `
<record>
  <title>${metadata.title}</title>
  <author>${metadata.author}</author>
  <publisher>${metadata.publisher}</publisher>
  <year>${metadata.year}</year>
  <summary>${metadata.summary}</summary>
</record>
`.trim();
}

app.post('/extract', upload.single('file'), async (req, res) => {
  try {
    const buffer = req.file.buffer;
    const data = await pdfParse(buffer);
    const text = data.text;
    const metadata = extractArabicMetadata(text);
    const mrk = buildMARC(metadata);
    const xml = buildXML(metadata);
    const json = buildJSON(metadata);
    res.json({ mrk, xml, json });
  } catch (err) {
    res.status(500).json({ error: 'Extraction failed.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Arabic API listening on port ${PORT}`));
